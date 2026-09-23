/**
 * @jest-environment node
 */

// RUTA: __tests__/api/perf-upload.test.ts

/**
 * Auditoría 2026-09 · módulo perfil — POST /api/upload
 *
 * PERF-026: `formData.get('file') as File` ocultaba que el valor puede ser un
 *           string; un campo de texto o un body no multipart daban 500.
 * PERF-027: sólo se miraban el nombre y el MIME, ambos del cliente, así que un
 *           HTML renombrado a .pdf pasaba los dos controles.
 * PERF-028: el límite anunciado de 5 MB es inalcanzable en Vercel (tope de
 *           4.5 MB por request); baja a 4 MB.
 * PERF-029: el nombre público salía de Math.random + el nombre original del
 *           archivo (que suele ser el nombre de la persona).
 */

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn(() => null),
  UPLOAD_RATE_LIMIT: { maxRequests: 15, windowSeconds: 3600 },
}));

jest.mock('@vercel/blob', () => ({
  put: jest.fn(async (nombre: string) => ({
    url: `https://abc123store.public.blob.vercel-storage.com/${nombre}`,
  })),
}));

process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_TOKEN_FALSO_DE_TEST';

import { put } from '@vercel/blob';
import { POST } from '@/app/api/upload/route';

const mockPut = put as jest.Mock;

/** Cabecera de un PDF real. */
const PDF_VALIDO = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x00, 0x00, 0x00]);
/** Cabecera de un PNG real. */
const PNG_VALIDO = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49]);

function subir(file: File | string, campo = 'file') {
  const formData = new FormData();
  formData.append(campo, file as any);
  return new Request('http://localhost/api/upload', { method: 'POST', body: formData });
}

function archivo(bytes: Uint8Array | string, nombre: string, type: string) {
  return new File([bytes as any], nombre, { type });
}

describe('PERF · POST /api/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPut.mockImplementation(async (nombre: string) => ({
      url: `https://abc123store.public.blob.vercel-storage.com/${nombre}`,
    }));
  });

  describe('PERF-026 · el campo "file" puede no ser un archivo', () => {
    it('un campo de texto responde 400, no 500', async () => {
      const res = await POST(subir('hola'));

      expect(res.status).toBe(400);
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('un body que no es multipart responde 400, no 500', async () => {
      const req = new Request('http://localhost/api/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: 'x' }),
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('sin campo "file" responde 400', async () => {
      const res = await POST(subir(archivo(PDF_VALIDO, 'cv.pdf', 'application/pdf'), 'otro'));
      expect(res.status).toBe(400);
    });
  });

  describe('PERF-027 · el contenido tiene que corresponder a la extensión', () => {
    it('rechaza un HTML renombrado a .pdf aunque declare application/pdf', async () => {
      const res = await POST(subir(archivo('<html><body>hola</body></html>', 'cv.pdf', 'application/pdf')));

      expect(res.status).toBe(400);
      expect(mockPut).not.toHaveBeenCalled();
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('rechaza un binario arbitrario renombrado a .pdf', async () => {
      const res = await POST(subir(archivo(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'cv.pdf', 'application/pdf')));

      expect(res.status).toBe(400);
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('rechaza un PNG declarado como .pdf', async () => {
      const res = await POST(subir(archivo(PNG_VALIDO, 'cv.pdf', 'application/pdf')));

      expect(res.status).toBe(400);
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('acepta un PDF de verdad', async () => {
      const res = await POST(subir(archivo(PDF_VALIDO, 'cv.pdf', 'application/pdf')));

      expect(res.status).toBe(200);
      expect(mockPut).toHaveBeenCalledTimes(1);
    });

    it('acepta un PNG de verdad', async () => {
      const res = await POST(subir(archivo(PNG_VALIDO, 'foto.png', 'image/png')));

      expect(res.status).toBe(200);
      expect(mockPut).toHaveBeenCalledTimes(1);
    });
  });

  describe('PERF-028 · límite real de 4 MB', () => {
    it('rechaza un archivo de 4.8 MB con un mensaje que anuncia 4MB', async () => {
      const grande = new Uint8Array(4.8 * 1024 * 1024);
      grande.set(PDF_VALIDO, 0);

      const res = await POST(subir(archivo(grande, 'cv.pdf', 'application/pdf')));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('4MB');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('acepta un archivo de 3 MB', async () => {
      const mediano = new Uint8Array(3 * 1024 * 1024);
      mediano.set(PDF_VALIDO, 0);

      const res = await POST(subir(archivo(mediano, 'cv.pdf', 'application/pdf')));

      expect(res.status).toBe(200);
    });
  });

  describe('PERF-029 · nombre público inadivinable y sin datos personales', () => {
    it('no usa el nombre original del archivo y pide sufijo aleatorio al Blob', async () => {
      const res = await POST(subir(archivo(PDF_VALIDO, 'CV Ana Maria Lopez Hernandez.pdf', 'application/pdf')));

      expect(res.status).toBe(200);
      expect(mockPut).toHaveBeenCalledTimes(1);

      const [nombre, , opciones] = mockPut.mock.calls[0];
      expect(nombre).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/);
      expect(nombre.toLowerCase()).not.toContain('ana');
      expect(nombre.toLowerCase()).not.toContain('lopez');
      expect(opciones.addRandomSuffix).toBe(true);
    });

    it('dos subidas del mismo archivo generan nombres distintos', async () => {
      await POST(subir(archivo(PDF_VALIDO, 'cv.pdf', 'application/pdf')));
      await POST(subir(archivo(PDF_VALIDO, 'cv.pdf', 'application/pdf')));

      expect(mockPut.mock.calls[0][0]).not.toBe(mockPut.mock.calls[1][0]);
    });

    it('el nombre original se devuelve al cliente pero no va en la URL', async () => {
      const res = await POST(subir(archivo(PDF_VALIDO, 'Titulo Ana.pdf', 'application/pdf')));
      const json = await res.json();

      expect(json.filename).toBe('Titulo Ana.pdf');
      expect(json.url).not.toContain('Ana');
    });
  });
});

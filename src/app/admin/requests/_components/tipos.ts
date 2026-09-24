// RUTA: src/app/admin/requests/_components/tipos.ts
//
// Una solicitud de alta de empresa tal como la devuelve GET /api/company-requests
// (el modelo CompanyRequest completo de prisma/schema.prisma). `_components` es
// carpeta privada de Next: no genera ruta.

export interface CompanyRequest {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreEmpresa: string;
  correoEmpresa: string;
  sitioWeb: string | null;
  razonSocial: string;
  rfc: string;
  direccionEmpresa: string;
  identificacionUrl: string | null;
  documentosConstitucionUrl: string | null;
  logoUrl?: string | null; // FEAT-1b: Logo de empresa
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

/** «Ana Pérez López»: nombre y apellidos del representante que haya. */
export const nombreRepresentante = (r: Pick<CompanyRequest, 'nombre' | 'apellidoPaterno' | 'apellidoMaterno'>) =>
  [r.nombre, r.apellidoPaterno, r.apellidoMaterno].filter(Boolean).join(' ');

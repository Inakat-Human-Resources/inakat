/**
 * Flujos que estaban rotos de cara al usuario.
 *
 *  - Subir y borrar el CV desde /profile no funcionaba: la UI mandaba un
 *    FormData a una API que hace `request.json()`, y borraba con `?type=cv`
 *    cuando la API exige `?id=<docId>`.
 *  - Guardar una entrevista desde el panel de admin SIEMPRE decía «Error al
 *    guardar», aunque el cambio se hubiera aplicado: la API respondía
 *    `{ interview }` y la UI comprueba `data.success`.
 *  - Cancelar una solicitud sin horario guardaba 1970-01-01 como hora de la
 *    entrevista, porque `new Date(null)` no es NaN.
 */
import fs from 'fs';
import path from 'path';

const readFile = (filePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

describe('CV del candidato', () => {
  const p = readFile('src/app/profile/page.tsx');

  it('sube el archivo a /api/upload, que es quien recibe FormData', () => {
    const subir = p.slice(p.indexOf('setUploadingCv(true)'), p.indexOf('const deleteCv'));
    expect(subir).toContain("fetch('/api/upload'");
    expect(subir).toContain('formData.append(\'file\', file)');
  });

  it('ya no manda un FormData a la API que espera JSON', () => {
    const subir = p.slice(p.indexOf('setUploadingCv(true)'), p.indexOf('const deleteCv'));
    expect(subir).not.toMatch(/fetch\('\/api\/profile\/documents'[\s\S]{0,200}body: formData/);
  });

  it('guarda la URL en el perfil, como hace la foto', () => {
    const subir = p.slice(p.indexOf('setUploadingCv(true)'), p.indexOf('const deleteCv'));
    expect(subir).toContain("candidateData: { cvUrl: uploadData.url }");
  });

  it('borrar el CV lo pone a null en el perfil, no llama a documents?type=cv', () => {
    const borrar = p.slice(p.indexOf('const deleteCv'), p.indexOf('const deleteCv') + 1400);
    expect(borrar).toContain('candidateData: { cvUrl: null }');
    // no debe quedar la LLAMADA (el comentario que explica el cambio sí la nombra)
    expect(borrar).not.toMatch(/fetch\(\s*['"`][^'"`]*documents\?type=cv/);
  });
});

describe('Entrevistas del panel de admin', () => {
  const c = readFile('src/app/api/admin/interviews/[id]/route.ts');

  it('las respuestas llevan success, que es lo que la UI comprueba', () => {
    expect(c).not.toMatch(/return NextResponse\.json\(\{ interview \}\)/);
    expect((c.match(/NextResponse\.json\(\{ success: true, interview \}\)/g) || []).length).toBe(2);
  });

  it('null y cadena vacía significan «sin fecha», no 1970', () => {
    expect(c).toMatch(/if \(value === null \|\| value === ''\) return null/);
    // el centinela de «fecha inválida» pasa a ser undefined, para poder
    // distinguirlo de un null legítimo
    expect(c).toContain('if (d === undefined)');
  });
});

describe('La UI del perfil y la API de documentos siguen hablando el mismo idioma', () => {
  it('la API de documentos sigue esperando JSON con name y fileUrl', () => {
    // Si esto cambiara, el arreglo de arriba habría que revisarlo.
    const api = readFile('src/app/api/profile/documents/route.ts');
    expect(api).toContain('const { name, fileUrl, fileType } = await request.json()');
    expect(api).toContain("searchParams.get('id')");
  });
});

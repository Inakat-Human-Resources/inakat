// RUTA: __tests__/components/perf-perfil-ui.test.ts

/**
 * Auditoría 2026-09 · módulo perfil — UI (/profile y CandidateProfileModal)
 *
 * Estos arreglos viven en componentes cliente muy grandes (1900+ líneas) cuyo
 * render depende de Google Maps, next/navigation y varias APIs; montarlos
 * entero en jsdom no es viable. Se comprueba el CÓDIGO FUENTE con el archivo ya
 * SIN COMENTARIOS, de modo que ninguna aserción pueda pasar por una frase
 * escrita en un comentario.
 *
 * PERF-009: los errores de los modales se pintaban detrás del overlay.
 * PERF-010: guardar/borrar una experiencia recargaba todo el perfil y descartaba
 *           los cambios no guardados.
 * PERF-011: fechas mostradas un mes antes por parsear medianoche UTC en local.
 * PERF-012: vocabulario de estatus de educación incompatible entre pantallas.
 * PERF-013: al navegar Anterior/Siguiente no se reiniciaban borradores.
 * PERF-014/015: guardar nota o calificaciones fallaba en silencio.
 * PERF-017: cualquier clic en el sub-modal cerraba el modal de perfil entero.
 * PERF-030: los años de educación no se validaban.
 * PERF-032: fileType se guardaba como el subtipo MIME completo.
 * PERF-033: editar a mano la ubicación dejaba las coordenadas anteriores.
 * PERF-037: arrastrar una selección fuera del diálogo lo cerraba.
 */

import fs from 'fs';
import path from 'path';

const RAIZ = process.cwd();

/** Quita comentarios de línea, de bloque y de JSX. */
function sinComentarios(codigo: string): string {
  return codigo
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function leer(relativo: string): string {
  return sinComentarios(fs.readFileSync(path.join(RAIZ, relativo), 'utf8'));
}

const PAGINA_PERFIL = leer('src/app/profile/page.tsx');
const MODAL = leer('src/components/shared/CandidateProfileModal.tsx');

describe('PERF · /profile (src/app/profile/page.tsx)', () => {
  it('PERF-009: cada modal tiene su propio estado de error', () => {
    expect(PAGINA_PERFIL).toContain("const [expError, setExpError] = useState('')");
    expect(PAGINA_PERFIL).toContain("const [eduError, setEduError] = useState('')");
    expect(PAGINA_PERFIL).toContain("const [docError, setDocError] = useState('')");
  });

  it('PERF-009: saveExperience y saveEducation avisan dentro del modal', () => {
    const saveExperience = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const saveExperience'),
      PAGINA_PERFIL.indexOf('const deleteExperience')
    );
    expect(saveExperience).toContain('setExpError(');
    expect(saveExperience).not.toMatch(/setError\('Empresa/);

    const saveEducation = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const saveEducation'),
      PAGINA_PERFIL.indexOf('const deleteEducation')
    );
    expect(saveEducation).toContain('setEduError(');
    expect(saveEducation).not.toMatch(/setError\('Nivel/);
  });

  it('PERF-009: los tres errores se renderizan con role="alert"', () => {
    expect(PAGINA_PERFIL).toContain('{expError && (');
    expect(PAGINA_PERFIL).toContain('{eduError && (');
    expect(PAGINA_PERFIL).toContain('{docError && (');
    expect((PAGINA_PERFIL.match(/role="alert"/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('PERF-010: el CRUD de experiencia ya no llama a fetchProfile()', () => {
    const bloque = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const saveExperience'),
      PAGINA_PERFIL.indexOf('const openEduModal')
    );
    expect(bloque).not.toContain('fetchProfile()');
    expect((bloque.match(/refreshExperiences\(\)/g) || []).length).toBe(2);
  });

  it('PERF-010: refreshExperiences sólo toca la lista de experiencias', () => {
    const fn = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const refreshExperiences'),
      PAGINA_PERFIL.indexOf('const saveExperience')
    );
    expect(fn).toContain("fetch('/api/profile/experience'");
    expect(fn).toContain('setExperiences(');
    expect(fn).not.toContain('setEducacion(');
    expect(fn).not.toContain('setTelefono(');
    expect(fn).not.toContain('setLoading(true)');
  });

  it('PERF-011: formatDate formatea en UTC', () => {
    const fn = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const formatDate'),
      PAGINA_PERFIL.indexOf('const calculateAge')
    );
    expect(fn).toContain("timeZone: 'UTC'");
  });

  it('PERF-011: calculateAge compara con los getters UTC', () => {
    const fn = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const calculateAge'),
      PAGINA_PERFIL.indexOf('if (loading)')
    );
    expect(fn).toContain('getUTCFullYear()');
    expect(fn).toContain('getUTCMonth()');
    expect(fn).toContain('getUTCDate()');
    expect(fn).not.toMatch(/today\.getFullYear\(\)/);
  });

  it('PERF-012: el estatus de educación usa el vocabulario del registro', () => {
    expect(PAGINA_PERFIL).toContain("const ESTATUS_EDUCACION = ['Cursando', 'Terminado', 'Titulado', 'Trunco']");
    expect(PAGINA_PERFIL).toContain('{ESTATUS_EDUCACION.map(');
    // Ya no hay opciones fijas con el vocabulario viejo
    expect(PAGINA_PERFIL).not.toContain('<option value="Completa">');
    expect(PAGINA_PERFIL).not.toContain('<option value="Trunca">');
  });

  it('PERF-012: «sin terminar» cubre Cursando y En curso', () => {
    expect(PAGINA_PERFIL).toContain("const ESTATUS_EN_CURSO = ['Cursando', 'En curso']");
    expect(PAGINA_PERFIL).toContain('disabled={ESTATUS_EN_CURSO.includes(eduForm.estatus)}');
    expect(PAGINA_PERFIL).not.toContain("eduForm.estatus === 'En curso'");
  });

  it('PERF-030: saveEducation valida el rango de años y que fin >= inicio', () => {
    const fn = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const saveEducation'),
      PAGINA_PERFIL.indexOf('const deleteEducation')
    );
    expect(fn).toContain('ANIO_MIN_EDUCACION');
    expect(fn).toContain('ANIO_MAX_EDUCACION');
    expect(fn).toContain('fin < inicio');
    expect(PAGINA_PERFIL).toContain('const ANIO_MAX_EDUCACION = new Date().getFullYear() + 8');
  });

  it('PERF-008: un campo de años vacío no manda null', () => {
    expect(PAGINA_PERFIL).toContain("añosExperiencia: añosExperiencia === '' ? undefined : añosExperiencia");
  });

  it('PERF-024: la UI aplica la política de contraseña completa', () => {
    const fn = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const handleSubmit'),
      PAGINA_PERFIL.indexOf('const openExpModal')
    );
    expect(fn).toContain('/[A-Z]/.test(newPassword)');
    expect(fn).toContain('/[0-9]/.test(newPassword)');
  });

  it('PERF-031: los catch conservan el mensaje real del servidor', () => {
    expect(PAGINA_PERFIL).toContain('err instanceof Error ? err.message');
    const handleAddDocument = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const handleAddDocument'),
      PAGINA_PERFIL.indexOf('const deleteDocument')
    );
    expect(handleAddDocument).not.toContain("setError('Error de conexión')");
    expect(handleAddDocument).toContain('uploadData.error');
  });

  it('PERF-032: fileType se deriva de la extensión, no del MIME', () => {
    expect(PAGINA_PERFIL).toContain("fileType: newDocFile.name.split('.').pop()?.toLowerCase() || 'file'");
    expect(PAGINA_PERFIL).not.toContain("newDocFile.type.split('/')[1]");
  });

  it('PERF-033: escribir la ubicación a mano invalida las coordenadas', () => {
    const fn = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const handleUbicacionManual'),
      PAGINA_PERFIL.indexOf('useEffect(() => {')
    );
    expect(fn).toContain('setCandidateLatitude(null)');
    expect(fn).toContain('setCandidateLongitude(null)');
    // Los dos inputs de ubicación pasan por el helper
    expect((PAGINA_PERFIL.match(/onChange=\{\(e\) => handleUbicacionManual\(e\.target\.value\)\}/g) || []).length).toBe(2);
    expect(PAGINA_PERFIL).not.toContain('onChange={(e) => setUbicacionCercana(e.target.value)}');
  });

  it('PERF-001: subir CV = /api/upload + PUT /api/profile con cvUrl', () => {
    const fn = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const handleCvUpload'),
      PAGINA_PERFIL.indexOf('const deleteCv')
    );
    expect(fn).toContain("fetch('/api/upload'");
    expect(fn).toContain("fetch('/api/profile'");
    expect(fn).toContain("method: 'PUT'");
    expect(fn).toContain('candidateData: { cvUrl: uploadData.url }');
    expect(fn).toContain('setCvUrl(uploadData.url)');
    expect(fn).not.toContain('/api/profile/documents');
    expect(fn).not.toContain("formData.append('type'");
  });

  it('PERF-001: borrar CV = PUT /api/profile con cvUrl null', () => {
    const fn = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const deleteCv'),
      PAGINA_PERFIL.indexOf('const handleFotoUpload')
    );
    expect(fn).toContain("fetch('/api/profile'");
    expect(fn).toContain('candidateData: { cvUrl: null }');
    expect(fn).toContain('setCvUrl(null)');
    expect(fn).not.toContain('type=cv');
  });

  it('PERF-010: refreshExperiences recoge los años recalculados por el servidor', () => {
    const fn = PAGINA_PERFIL.slice(
      PAGINA_PERFIL.indexOf('const refreshExperiences'),
      PAGINA_PERFIL.indexOf('const saveExperience')
    );
    expect(fn).toContain('setAñosExperiencia(data.añosExperiencia)');
  });

  it('PERF-018: ensureUrl delega en normalizeUrl (respeta rutas locales)', () => {
    expect(PAGINA_PERFIL).toContain("import { normalizeUrl } from '@/lib/utils';");
    expect(PAGINA_PERFIL).toContain('const ensureUrl = (url: string) => normalizeUrl(url) ?? url;');
    expect(PAGINA_PERFIL).not.toContain("url.startsWith('http') ? url");
  });

  it('PERF-028: el límite de subida anunciado y validado es el mismo', () => {
    expect(PAGINA_PERFIL).toContain('const MAX_UPLOAD_BYTES = 4 * 1024 * 1024');
    expect(PAGINA_PERFIL).toContain('file.size > MAX_UPLOAD_BYTES');
    expect(PAGINA_PERFIL).toContain('newDocFile.size > MAX_UPLOAD_BYTES');
    expect(PAGINA_PERFIL).not.toContain('5 * 1024 * 1024');
  });
});

describe('PERF · CandidateProfileModal', () => {
  it('PERF-011: las fechas del modal se formatean en UTC', () => {
    const formatExperienceDate = MODAL.slice(
      MODAL.indexOf('const formatExperienceDate'),
      MODAL.indexOf('const getStatusBadge')
    );
    expect(formatExperienceDate).toContain("timeZone: 'UTC'");
  });

  it('PERF-011: la fecha de postulación (un instante real) se muestra en hora local', () => {
    // Con UTC, una postulación hecha a las 19:00 en México salía con la fecha
    // del día siguiente.
    const formatDate = MODAL.slice(
      MODAL.indexOf('const formatDate'),
      MODAL.indexOf('const formatExperienceDate')
    );
    expect(formatDate).not.toContain('timeZone');
    expect(MODAL).toContain('formatDate(data.appliedAt)');
  });

  it('PERF-016: el alta de documentos ya no va a la ruta reservada a admin', () => {
    const inicio = MODAL.indexOf('const handleAddDocument');
    // Rediseño 2026-09: tras handleAddDocument viene la presentación (const edad).
    const fin = MODAL.indexOf('const edad = calculateAge', inicio);
    expect(inicio).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(inicio);
    const fn = MODAL.slice(inicio, fin);
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toContain('fetch(`/api/evaluations/candidates/${candidateId}/documents`');
    expect(fn).not.toContain('/api/admin/candidates/');
  });

  it('PERF-018: ensureUrl delega en normalizeUrl (respeta rutas locales)', () => {
    expect(MODAL).toContain("import { normalizeUrl } from '@/lib/utils';");
    expect(MODAL).toContain('const ensureUrl = (url: string) => normalizeUrl(url) ?? url;');
    expect(MODAL).not.toContain("url.startsWith('http') ? url");
  });

  it('PERF-011: calculateAge usa los getters UTC', () => {
    const fn = MODAL.slice(MODAL.indexOf('const calculateAge'), MODAL.indexOf('const getLocation'));
    expect(fn).toContain('getUTCFullYear()');
    expect(fn).toContain('getUTCDate()');
  });

  it('PERF-006: parseEducacion descarta entradas que no son objetos', () => {
    const fn = MODAL.slice(
      MODAL.indexOf('const normalizarEducacion'),
      MODAL.indexOf('const educaciones =')
    );
    expect(fn).toContain("typeof entrada !== 'object'");
    expect(fn).toContain('Array.isArray(entrada)');
    expect(fn).toContain('.filter(');
    // Los campos se coaccionan a texto antes de renderizarlos
    expect(fn).toContain('String(v)');
  });

  it('PERF-012: el badge de estatus conoce los dos vocabularios', () => {
    // Rediseño 2026-09: el mapa da el TONO del Badge del sistema (el texto del
    // estatus se escribe siempre).
    expect(MODAL).toContain('const COLOR_ESTATUS_EDUCACION: Record<string, TonoBadge>');
    for (const estatus of ['Titulado', 'Completa', 'Terminado', 'Cursando', "'En curso'", 'Trunco', 'Trunca']) {
      expect(MODAL).toContain(estatus);
    }
    expect(MODAL).toContain('COLOR_ESTATUS_EDUCACION[edu.estatus]');
  });

  it('PERF-013: un efecto reinicia el estado al cambiar de candidato', () => {
    const efecto = MODAL.slice(
      MODAL.indexOf('setEvaluationNotes([]);'),
      MODAL.indexOf('const fetchSkillRatings')
    );
    for (const reset of [
      "setNewNoteContent('')",
      'setNoteDocument(null)',
      'setIsNotePublic(false)',
      'setSkillRatings({})',
      'setSavedSkillRatings([])',
      'setShowAddDocModal(false)',
    ]) {
      expect(efecto).toContain(reset);
    }
    expect(MODAL).toContain('}, [isOpen, application?.id, candidate?.id]);');
  });

  it('PERF-013: los fetch descartan respuestas fuera de orden', () => {
    expect((MODAL.match(/let ignorar = false;/g) || []).length).toBe(2);
    expect((MODAL.match(/ignorar = true;/g) || []).length).toBe(2);
    expect(MODAL).toContain('if (cancelado()) return;');
  });

  it('PERF-014/015: guardar nota trata !res.ok y !data.success', () => {
    const fn = MODAL.slice(
      MODAL.indexOf('const handleSaveNote'),
      MODAL.indexOf('if (!isOpen || (!application && !candidate))')
    );
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toContain('!res.ok || !data.success');
    expect(fn).toContain('setNoteError(');
    expect(fn).toContain('uploadData.url');
    expect(fn).not.toMatch(/throw new Error/);
  });

  it('PERF-014/015: guardar calificaciones avisa del error y del éxito', () => {
    const fn = MODAL.slice(
      MODAL.indexOf('const handleSaveSkillRatings'),
      MODAL.indexOf('const fetchEvaluationNotes')
    );
    expect(fn).toContain('!res.ok || !data.success');
    expect(fn).toContain('setRatingsError(');
    expect(fn).toContain('setRatingsSaved(true)');
    expect(MODAL).toContain('{ratingsError && (');
    expect(MODAL).toContain('{ratingsSaved && !ratingsError && (');
    expect(MODAL).toContain('{noteError && (');
  });

  it('PERF-014: el adjunto de la nota se valida en cliente', () => {
    expect(MODAL).toContain('const MAX_ADJUNTO_BYTES = 4 * 1024 * 1024');
    expect(MODAL).toContain('noteDocument.size > MAX_ADJUNTO_BYTES');
    expect(MODAL).toContain('newDocFile.size > MAX_ADJUNTO_BYTES');
  });

  // Rediseño 2026-09: la ficha usa el Modal del sistema (src/components/ui/Modal)
  // en vez de su propio overlay. Las tres garantías de abajo se comprueban
  // ahora donde viven; el comportamiento con ratón y teclado lo prueba
  // __tests__/components/ficha-candidato.test.tsx.
  const MODAL_SISTEMA = leer('src/components/ui/Modal.tsx');

  it('PERF-017/037: el fondo cierra con onMouseDown sobre sí mismo', () => {
    // La ficha no pinta overlay propio: la cierra el Modal del sistema.
    expect(MODAL).toContain("import Modal from '@/components/ui/Modal';");
    expect(MODAL).toMatch(/<Modal\s+abierto=\{isOpen\}\s+alCerrar=\{onClose\}/);
    expect(MODAL).not.toContain('fixed inset-0');
    // Y el Modal del sistema cierra sólo con mousedown sobre el propio fondo.
    expect(MODAL_SISTEMA).toContain('onMouseDown={(e) => {');
    expect(MODAL_SISTEMA).toContain('e.target === e.currentTarget) alCerrar();');
    const cierre = MODAL_SISTEMA.indexOf('e.target === e.currentTarget) alCerrar();');
    const fondo = MODAL_SISTEMA.slice(MODAL_SISTEMA.lastIndexOf('<div', cierre), MODAL_SISTEMA.indexOf('>', cierre));
    expect(fondo).toContain('onMouseDown');
    expect(fondo).not.toContain('onClick');
    expect(MODAL).not.toContain('onClick={(e) => e.stopPropagation()}');
  });

  it('PERF-017: el sub-modal es una capa aparte y no cierra la ficha', () => {
    // «Agregar documento» es otro Modal, HERMANO de la ficha (no hijo de su
    // fondo): nada de lo que pase dentro llega al fondo de la ficha.
    const ficha = MODAL.indexOf('abierto={isOpen}');
    const finFicha = MODAL.indexOf('</Modal>', ficha);
    const sub = MODAL.indexOf('abierto={showAddDocModal}');
    expect(ficha).toBeGreaterThan(-1);
    expect(sub).toBeGreaterThan(finFicha);
    const subModal = MODAL.slice(sub, MODAL.indexOf('</Modal>', sub));
    expect(subModal).toContain('alCerrar={cancelarDocumento}');
    // Como antes, pulsar el fondo del sub-modal no lo cierra.
    expect(subModal).toContain('cerrarAlPulsarFondo={false}');
    expect(MODAL_SISTEMA).toContain('role="dialog"');
  });

  it('PERF-035: Escape cancela primero el sub-modal', () => {
    // Cancelar el sub-modal lo deja limpio para el siguiente candidato…
    const cancelar = MODAL.slice(
      MODAL.indexOf('const cancelarDocumento'),
      MODAL.indexOf('const handleAddDocument')
    );
    for (const reset of ['setShowAddDocModal(false);', "setNewDocName('');", 'setNewDocFile(null);', "setDocError('');"]) {
      expect(cancelar).toContain(reset);
    }
    // …y Escape lo atiende SÓLO la capa de arriba (useFocoAtrapado con su
    // pila): la ficha ya no escucha el teclado por su cuenta.
    expect(MODAL).not.toContain("addEventListener('keydown'");
    const foco = leer('src/hooks/useFocoAtrapado.ts');
    expect(foco).toContain('if (!esSuperior()) return;');
  });

  it('PERF-032: el fileType del modal sale de la extensión', () => {
    expect(MODAL).toContain("fileType: newDocFile.name.split('.').pop()?.toLowerCase() || 'file'");
    expect(MODAL).not.toContain("newDocFile.type.split('/')[1]");
  });
});

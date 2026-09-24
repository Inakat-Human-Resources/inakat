// RUTA: src/app/admin/candidates/page.tsx

'use client';

/**
 * Banco de candidatos del administrador: buscar, filtrar, inyectar, editar y
 * borrar candidatos, y consultar su ficha con sus documentos.
 *
 * Registro de APLICACIÓN (docs/DISENO.md): PageHeader → cifras → Card con
 * FilterToolbar + DataTable paginada por la API → Drawer con la ficha →
 * CandidateForm. La lógica es la de siempre (mismas llamadas, mismos cuerpos,
 * mismos estados); sólo cambió la presentación. Lo único nuevo es de
 * presentación: los window.confirm pasaron a un Modal de confirmación que, al
 * aceptar, sigue exactamente el mismo flujo; y la página recuerda qué filtros
 * se aplicaron para avisar de los cambios que aún no se han buscado.
 */

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  SlidersHorizontal,
  RefreshCw,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Download,
  ExternalLink,
  Users,
  UserCheck,
  Briefcase,
  Award,
  GraduationCap,
  FileText,
  Paperclip,
  AlertCircle,
  KeyRound,
  StickyNote
} from 'lucide-react';
import CandidateForm from '@/components/sections/admin/CandidateForm';
import { PAGINACION_VACIA, type PaginacionApi } from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import FilterToolbar, { FiltroSelect } from '@/components/ui/FilterToolbar';
import StatusBadge, { Badge, type TonoBadge } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button, { clasesBoton } from '@/components/ui/Button';
import SelectorArchivo from '@/components/ui/SelectorArchivo';
import IconButton, { IconLink } from '@/components/ui/IconButton';
import ConfirmarModal from '@/components/ui/ConfirmarModal';
import Drawer from '@/components/ui/Drawer';
import Toast from '@/components/ui/Toast';
import Avatar from '@/components/ui/Avatar';
import { Input } from '@/components/ui/FormField';
import { SkeletonPagina, SkeletonTexto } from '@/components/ui/Skeleton';
import { isSafeHttpUrl } from '@/lib/sanitize';
import { cn } from '@/lib/utils';
import { fechaCorta } from '@/lib/fechas';

/**
 * FIX-02: asegura que los enlaces externos lleven protocolo (un "linkedin.com/in/x"
 * suelto se fuerza a https). Y sólo deja pasar http(s): con `startsWith('http')`
 * un valor raro llegaba tal cual a href. Lo que no es URL se anula.
 */
const ensureUrl = (url: string): string | undefined => {
  const candidata = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
  return isSafeHttpUrl(candidata) ? candidata : undefined;
};

/**
 * ADM-060: `fechaInicio`/`fechaFin` se guardan como medianoche UTC. Pintarlas
 * con toLocaleDateString('es-MX') a secas las corre un día hacia atrás en
 * México (UTC-6): una experiencia del 01/01/2020 se leía "31/12/2019".
 */
const formatoSoloFecha = (valor: string | Date) => fechaCorta(valor, { utc: true });

/**
 * ADM-052: el vocabulario de `estatus` de educación no era uno solo. El alta
 * desde admin guardaba Completa/En curso/Trunca y esta vista sólo coloreaba
 * Titulado/Terminado/Cursando, así que todo lo capturado por el admin salía en
 * gris. CandidateForm ya usa el vocabulario bueno; aquí se reconocen también
 * los valores viejos que siguen en la base. (El tono va con el texto del
 * estatus: nunca sólo color.)
 */
const tonoEstatusEducacion = (estatus: string): TonoBadge => {
  const verde = ['Titulado', 'Completa'];
  const azul = ['Terminado'];
  const amarillo = ['Cursando', 'En curso'];
  const rojo = ['Trunco', 'Trunca'];

  if (verde.includes(estatus)) return 'exito';
  if (azul.includes(estatus)) return 'info';
  if (amarillo.includes(estatus)) return 'aviso';
  if (rojo.includes(estatus)) return 'peligro';
  return 'neutro';
};

/** Cifra con separador de miles (1,284). */
const cifra = (n: number) => n.toLocaleString('es-MX');

/** Fuente del candidato, legible (un valor desconocido sale tal cual). */
const ETIQUETA_FUENTE: Record<string, string> = {
  manual: 'Manual',
  linkedin: 'LinkedIn',
  occ: 'OCC',
  referido: 'Referido',
  registro: 'Registro'
};
const etiquetaFuente = (source: string) => ETIQUETA_FUENTE[source] || source;

/** Sexo tal como se guarda ("M", "F", "Otro"), legible. */
const etiquetaSexo = (sexo: string | null) =>
  sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : sexo || null;

/** Tipo de archivo corto a partir del MIME ("application/pdf" → "PDF"). */
const tipoCorto = (fileType: string | null) => fileType?.split('/')[1]?.toUpperCase();

/** «1 año», «7 años». */
const textoAnios = (n: number) => `${n} ${n === 1 ? 'año' : 'años'}`;

/**
 * Vista en tarjetas (la caja de la tabla mide menos de 600 px, la misma
 * container query de app.css): renglones que en la tabla van apilados y en la
 * línea «meta» de la tarjeta van seguidos, y lo que la tarjeta no necesita.
 */
const EN_LINEA_EN_TARJETA = '[@container_ap-tabla_(max-width:599.98px)]:inline';
const OCULTO_EN_TARJETA = '[@container_ap-tabla_(max-width:599.98px)]:hidden';

/**
 * Columna de acciones fija a la derecha en vista de tabla (desde md; por
 * debajo de 600 px de tabla son tarjetas). Si la tabla no cupiera a lo ancho
 * (zoom, una ventana estrecha), Ver/Editar/Eliminar siguen a la vista en vez de
 * quedarse detrás del desplazamiento lateral.
 * - Fondo opaco sólo en las celdas del CUERPO (la cabecera conserva su papel) y
 *   que sigue al de la fila: blanco, papel al pasar el ratón; transparente en la
 *   fila abierta en la ficha (conserva su tinte; la ficha la tapa).
 * - Una celda fija se pinta encima del anillo de foco de su fila (el outline de
 *   la <tr>): lo repinta en sus bordes con sombras interiores.
 * - Sombra a la izquierda cuando la tabla desborda: DataTable marca su caja con
 *   data-desborda.
 */
const CLASES_ACCIONES_FIJAS = [
  'w-px whitespace-nowrap',
  'md:sticky md:right-0 md:z-[1]',
  'md:[tbody_&]:bg-white md:[tbody_tr:hover_&]:bg-paper md:[tbody_tr[aria-current=true]_&]:bg-transparent',
  'md:[.ap-tabla-caja[data-desborda]_&]:shadow-[-10px_0_12px_-10px_rgb(40_55_57/0.3)]',
  'md:[.ap-tabla_tbody_tr:focus-visible_&]:shadow-[inset_-2px_0_0_var(--teal),inset_0_2px_0_var(--teal),inset_0_-2px_0_var(--teal)]',
].join(' ');

interface CandidateDocument {
  id: number;
  candidateId: number;
  name: string;
  fileUrl: string;
  fileType: string | null;
  createdAt: string;
}

// FEATURE: Educación múltiple
interface Education {
  id: number;
  nivel: string;
  institucion: string;
  carrera: string;
  añoInicio?: number | null;
  añoFin?: number | null;
  estatus: string;
}

interface Candidate {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  email: string;
  telefono: string | null;
  sexo: string | null;
  fechaNacimiento: string | null;
  edad: number | null;
  universidad: string | null;
  carrera: string | null;
  nivelEstudios: string | null;
  educacion: string | null; // FEATURE: Educación múltiple (JSON string)
  profile: string | null;
  seniority: string | null;
  añosExperiencia: number;
  cvUrl: string | null;
  portafolioUrl: string | null;
  linkedinUrl: string | null;
  source: string;
  notas: string | null;
  status: string;
  createdAt: string;
  experiences: any[];
  userId: number | null;
}

/** Nombre corto de una fila (el mismo que pintaba la tabla). */
const nombreCorto = (c: Candidate) => `${c.nombre} ${c.apellidoPaterno}`;

function AdminCandidatesContent() {
  // ADM-099: el error 409 de CandidateForm enlaza a
  // /admin/candidates?search=<email>. La página ignoraba el parámetro, así que
  // el enlace sólo cerraba el modal y el admin tenía que reescribir el correo.
  const searchParams = useSearchParams();
  const searchFromUrl = searchParams.get('search') || '';

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [candidateToEdit, setCandidateToEdit] = useState<Candidate | null>(
    null
  );
  const [candidateToView, setCandidateToView] = useState<Candidate | null>(
    null
  );

  // Estados para documentos
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Confirmaciones (antes window.confirm): qué se va a borrar y si está en curso.
  const [candidatoAEliminar, setCandidatoAEliminar] = useState<Candidate | null>(null);
  const [eliminandoCandidato, setEliminandoCandidato] = useState(false);
  const [documentoAEliminar, setDocumentoAEliminar] = useState<CandidateDocument | null>(null);
  const [eliminandoDocumento, setEliminandoDocumento] = useState(false);

  // Paginación (ADM-016: la API devuelve 30 por tanda y la página no tenía
  // forma de pedir la siguiente ni de conocer el total real)
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginacionApi>(PAGINACION_VACIA);

  // Tarjetas de conteo. Antes se calculaban con .filter() sobre la página
  // cargada, así que con 500 candidatos decían "Total 30" y "Contratados 0"
  // (ADM-016). Ahora cada cifra es el `pagination.total` que devuelve la API
  // para ese estado: se cuenta en la base, no en el navegador.
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    inProcess: 0,
    hired: 0
  });
  // Sólo presentación: las cifras pintan un esqueleto hasta la primera respuesta.
  const [cifrasListas, setCifrasListas] = useState(false);

  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState(searchFromUrl);
  const [sexoFilter, setSexoFilter] = useState('');
  const [universidadFilter, setUniversidadFilter] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [seniorityFilter, setSeniorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [maxExperience, setMaxExperience] = useState('');

  // Sólo presentación: los filtros (sin la página) con los que se pidió la
  // lista que se ve. Si los del formulario son otros, hay cambios sin aplicar.
  // Arranca con la búsqueda de la URL: es la que pide la primera carga.
  const [firmaAplicada, setFirmaAplicada] = useState(() =>
    searchFromUrl ? new URLSearchParams({ search: searchFromUrl }).toString() : ''
  );

  // Opciones para filtros.
  // ADM-024: antes era una lista de 7 nombres escrita a mano. Si el admin daba
  // de alta "Marketing" en /admin/specialties no había forma de filtrar por
  // ella, y al renombrar una especialidad el filtro dejaba de encontrar a sus
  // candidatos. Ahora sale del catálogo real.
  const [profiles, setProfiles] = useState<string[]>([]);
  const seniorities = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];
  const statuses = [
    { value: 'available', label: 'Disponible' },
    { value: 'in_process', label: 'En proceso' },
    { value: 'hired', label: 'Contratado' },
    { value: 'inactive', label: 'Inactivo' }
  ];
  const sources = [
    { value: 'manual', label: 'Manual' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'occ', label: 'OCC' },
    { value: 'referido', label: 'Referido' }
  ];

  // Fetch candidates. `busqueda` permite pedir con un término que todavía no
  // está en el estado (el que llega por la URL, ADM-099).
  const fetchCandidates = async (busqueda: string = search) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (busqueda) params.append('search', busqueda);
      if (sexoFilter) params.append('sexo', sexoFilter);
      if (universidadFilter) params.append('universidad', universidadFilter);
      if (profileFilter) params.append('profile', profileFilter);
      if (seniorityFilter) params.append('seniority', seniorityFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (minAge) params.append('minAge', minAge);
      if (maxAge) params.append('maxAge', maxAge);
      if (minExperience) params.append('minExperience', minExperience);
      if (maxExperience) params.append('maxExperience', maxExperience);
      setFirmaAplicada(params.toString());
      params.append('page', String(page));

      const response = await fetch(`/api/admin/candidates?${params}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setCandidates(data.data);
        setPagination(data.pagination || PAGINACION_VACIA);
      } else {
        setError(data.error || 'Error al cargar candidatos');
      }
    } catch (error) {
      setError('Error de conexión');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Conteos del banco completo (sin filtros): una petición por estado pidiendo
   * una sola fila y quedándonos con `pagination.total`.
   * TODO(handoff): sustituir por un endpoint de conteo (groupBy status) cuando
   * exista; /api/admin/stats ya hace lo mismo para el dashboard.
   */
  const fetchStats = async () => {
    try {
      const pedirTotal = async (status?: string) => {
        const params = new URLSearchParams({ limit: '1' });
        if (status) params.append('status', status);
        const res = await fetch(`/api/admin/candidates?${params}`);
        const data = await res.json();
        return data.success ? (data.pagination?.total ?? 0) : 0;
      };

      const [total, available, inProcess, hired] = await Promise.all([
        pedirTotal(),
        pedirTotal('available'),
        pedirTotal('in_process'),
        pedirTotal('hired')
      ]);

      setStats({ total, available, inProcess, hired });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setCifrasListas(true);
    }
  };

  useEffect(() => {
    fetchCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    fetchStats();
  }, []);

  // ADM-099: el enlace "Buscar en Banco de Candidatos" del alta duplicada lleva
  // a esta misma página con ?search=<email>. Como la página ya está montada, el
  // estado inicial no se vuelve a leer: hay que reaccionar al cambio de URL.
  const busquedaDeUrlAplicada = useRef(searchFromUrl);
  useEffect(() => {
    if (searchFromUrl === busquedaDeUrlAplicada.current) return;
    busquedaDeUrlAplicada.current = searchFromUrl;
    setSearch(searchFromUrl);
    if (page !== 1) {
      setPage(1); // el efecto de [page] recarga ya con el término nuevo
    } else {
      fetchCandidates(searchFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFromUrl]);

  // Catálogo de especialidades para el filtro de perfil (ADM-024)
  useEffect(() => {
    const cargarEspecialidades = async () => {
      try {
        const res = await fetch('/api/specialties');
        const data = await res.json();
        if (data.success && Array.isArray(data.names)) {
          setProfiles(data.names as string[]);
        }
      } catch (err) {
        console.error('Error fetching specialties:', err);
      }
    };
    cargarEspecialidades();
  }, []);

  // Aplicar filtros. Siempre vuelve a la página 1: filtrar quedándose en la
  // página 4 devolvía una lista vacía sin explicación.
  const applyFilters = () => {
    if (page !== 1) {
      setPage(1);
    } else {
      fetchCandidates();
    }
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSearch('');
    setSexoFilter('');
    setUniversidadFilter('');
    setProfileFilter('');
    setSeniorityFilter('');
    setStatusFilter('');
    setSourceFilter('');
    setMinAge('');
    setMaxAge('');
    setMinExperience('');
    setMaxExperience('');
  };

  // Eliminar candidato. La confirmación la pide el Modal de abajo
  // (pedirEliminarCandidato); al aceptar, este es el flujo de siempre.
  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/admin/candidates/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchCandidates();
        fetchStats();
        setNotification({ type: 'success', message: 'Candidato eliminado exitosamente' });
      } else {
        const data = await response.json();
        setNotification({ type: 'error', message: data.error || 'Error al eliminar' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Error de conexión' });
    }
  };

  const pedirEliminarCandidato = (candidate: Candidate) => setCandidatoAEliminar(candidate);

  const confirmarEliminarCandidato = async () => {
    if (!candidatoAEliminar) return;
    setEliminandoCandidato(true);
    await handleDelete(candidatoAEliminar.id);
    setEliminandoCandidato(false);
    setCandidatoAEliminar(null);
  };

  // Editar candidato
  const handleEdit = (candidate: Candidate) => {
    setCandidateToEdit(candidate);
    setIsFormOpen(true);
  };

  // Ver candidato
  const handleView = async (candidate: Candidate) => {
    setCandidateToView(candidate);
    // Cargar documentos del candidato
    await fetchDocuments(candidate.id);
  };

  // Cerrar la ficha (lo mismo que hacía la X del modal de detalle).
  const cerrarFicha = () => {
    setCandidateToView(null);
    setDocuments([]);
    setShowAddDoc(false);
    setNewDocName('');
  };

  // Cargar documentos de un candidato.
  // ADM-059: la lista sólo se escribía cuando la respuesta venía bien, así que
  // si fallaba la de un candidato se seguían viendo los documentos del anterior
  // como si fueran suyos. Se vacía al empezar y también en caso de error.
  const fetchDocuments = async (candidateId: number) => {
    setDocuments([]);
    try {
      setIsLoadingDocs(true);
      const response = await fetch(`/api/admin/candidates/${candidateId}/documents`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.data);
      } else {
        setNotification({ type: 'error', message: data.error || 'Error al cargar los documentos del candidato.' });
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setNotification({ type: 'error', message: 'Error al cargar los documentos del candidato.' });
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Subir archivo y agregar documento
  const handleAddDocument = async (file: File) => {
    if (!candidateToView || !newDocName.trim()) return;

    // PERF-028: /api/upload rechaza por encima de 4MB y Vercel corta los
    // cuerpos de más de 4.5MB con un 413 que no es JSON.
    if (file.size > 4 * 1024 * 1024) {
      setNotification({ type: 'error', message: 'El archivo excede el tamaño máximo de 4MB.' });
      return;
    }

    try {
      setIsUploadingDoc(true);

      // 1. Subir archivo
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al subir archivo');
      }
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        setNotification({ type: 'error', message: uploadData.error || 'Error al subir archivo' });
        return;
      }

      // 2. Crear documento en BD
      const docRes = await fetch(`/api/admin/candidates/${candidateToView.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDocName.trim(),
          fileUrl: uploadData.url,
          fileType: file.type
        })
      });
      if (!docRes.ok) {
        const errorData = await docRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar documento');
      }
      const docData = await docRes.json();

      if (docData.success) {
        setDocuments([docData.data, ...documents]);
        setNewDocName('');
        setShowAddDoc(false);
        setNotification({ type: 'success', message: 'Documento agregado exitosamente' });
      } else {
        setNotification({ type: 'error', message: docData.error || 'Error al guardar documento' });
      }
    } catch (error) {
      console.error('Error adding document:', error);
      setNotification({ type: 'error', message: 'Error al agregar documento' });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Eliminar documento. La confirmación la pide el Modal de abajo; al
  // aceptar, este es el flujo de siempre.
  const handleDeleteDocument = async (docId: number) => {
    if (!candidateToView) return;

    try {
      const response = await fetch(
        `/api/admin/candidates/${candidateToView.id}/documents?documentId=${docId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (data.success) {
        setDocuments(documents.filter(d => d.id !== docId));
        setNotification({ type: 'success', message: 'Documento eliminado' });
      } else {
        setNotification({ type: 'error', message: data.error || 'Error al eliminar' });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      setNotification({ type: 'error', message: 'Error al eliminar documento' });
    }
  };

  const confirmarEliminarDocumento = async () => {
    if (!documentoAEliminar) return;
    setEliminandoDocumento(true);
    await handleDeleteDocument(documentoAEliminar.id);
    setEliminandoDocumento(false);
    setDocumentoAEliminar(null);
  };

  // Nuevo candidato
  const handleNew = () => {
    setCandidateToEdit(null);
    setIsFormOpen(true);
  };

  // FEATURE: Parsear educación múltiple
  const parseEducacion = (candidate: Candidate): Education[] => {
    if (candidate.educacion) {
      try {
        const parsed = JSON.parse(candidate.educacion);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // Si falla el parse, continuamos con fallback
      }
    }
    // Fallback: crear array con datos legacy si existen
    if (candidate.universidad || candidate.carrera || candidate.nivelEstudios) {
      return [{
        id: 1,
        nivel: candidate.nivelEstudios || '',
        institucion: candidate.universidad || '',
        carrera: candidate.carrera || '',
        añoInicio: null,
        añoFin: null,
        estatus: ''
      }];
    }
    return [];
  };

  // ---------------------------------------------------------------------------
  // Presentación
  // ---------------------------------------------------------------------------

  // Los filtros del formulario en el mismo orden en que viajan a la API: si no
  // coinciden con los de la lista que se ve, hay cambios sin aplicar.
  const firmaActual = (() => {
    const p = new URLSearchParams();
    if (search) p.append('search', search);
    if (sexoFilter) p.append('sexo', sexoFilter);
    if (universidadFilter) p.append('universidad', universidadFilter);
    if (profileFilter) p.append('profile', profileFilter);
    if (seniorityFilter) p.append('seniority', seniorityFilter);
    if (statusFilter) p.append('status', statusFilter);
    if (sourceFilter) p.append('source', sourceFilter);
    if (minAge) p.append('minAge', minAge);
    if (maxAge) p.append('maxAge', maxAge);
    if (minExperience) p.append('minExperience', minExperience);
    if (maxExperience) p.append('maxExperience', maxExperience);
    return p.toString();
  })();
  const hayCambiosSinAplicar = firmaActual !== firmaAplicada;
  const listaFiltrada = firmaAplicada !== '';

  const filtrosActivos = [
    search,
    sexoFilter,
    universidadFilter,
    profileFilter,
    seniorityFilter,
    statusFilter,
    sourceFilter,
    minAge,
    maxAge,
    minExperience,
    maxExperience
  ].filter(Boolean).length;
  // Los que viven en el panel plegable (para el contador del botón «Filtros»).
  const filtrosDelPanel = [
    seniorityFilter,
    sourceFilter,
    sexoFilter,
    universidadFilter,
    minAge,
    maxAge,
    minExperience,
    maxExperience
  ].filter(Boolean).length;

  const resumen =
    !isLoading && candidates.length > 0
      ? `Mostrando ${candidates.length} de ${pagination.total} candidato${pagination.total !== 1 ? 's' : ''}`
      : undefined;

  // Reparto de columnas (docs/DISENO.md §7). La tabla tiene que caber SIN
  // desplazarse de lado a 1440 (tabla de 1126 px), 1280 (966), 1024 (710) y
  // 820 (770). Según el ancho de la TABLA:
  //   ≥ 1280       todas las columnas
  //   1100–1279    sin Edad ni Fuente (la fuente, bajo el estado)
  //   960–1099     además sin Teléfono
  //   800–959      además sin Educación (la carrera, bajo el nombre)
  //   600–799      además sin Experiencia (los años, junto al nivel del perfil)
  //   < 600        tarjetas: nombre y estado (con la fuente) arriba; debajo
  //                «perfil · nivel · años de experiencia»; el teléfono; y las
  //                acciones abajo, a lo ancho (lo demás, en la ficha)
  // Cada celda devuelve UN solo elemento (DataTable ya envuelve la celda en
  // .ap-celda; esto es por limpieza): «7 años» es un solo texto.
  // Los textos que se recortan usan line-clamp y no truncate: truncate no deja
  // partir la línea, así que la columna medía el correo ENTERO y la tabla se
  // salía por la derecha (1398 px en una caja de 1126).
  const columnas: Columna<Candidate>[] = [
    {
      id: 'candidato',
      encabezado: 'Candidato',
      enTarjeta: 'titulo',
      // Ancho mínimo sólo en vista de tabla: en tarjetas empujaba el nombre
      // por debajo de los botones.
      className: 'md:min-w-[13rem]',
      celda: (c) => (
        // flex-nowrap: en tarjetas, DataTable deja envolver las filas flexibles
        // del título (título + insignia); aquí el nombre largo caía bajo el avatar.
        <div className="flex min-w-0 flex-nowrap items-center gap-3">
          <Avatar nombre={nombreCorto(c)} email={c.email} tamano="sm" />
          <div className="min-w-0">
            <p className="line-clamp-2 break-words font-semibold text-ink">
              {c.nombre} {c.apellidoPaterno}
            </p>
            <p className="line-clamp-1 text-[13px] text-ink-muted [overflow-wrap:anywhere]" title={c.email}>
              {c.email}
            </p>
            {(c.carrera || c.universidad) && (
              <p data-solo-bajo="lg" className="mt-0.5 line-clamp-1 text-xs text-ink-muted [overflow-wrap:anywhere]">
                <GraduationCap className="mr-1 inline h-3.5 w-3.5 align-[-3px] text-teal" aria-hidden="true" />
                <span className="sr-only">Educación: </span>
                {c.carrera || c.universidad}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'telefono',
      encabezado: 'Teléfono',
      ocultarBajo: 'xl',
      unaLinea: true,
      celda: (c) =>
        c.telefono ? (
          <span className="tabular-nums text-ink">{c.telefono}</span>
        ) : (
          <span className="text-ink-muted">
            —<span className="sr-only">Sin teléfono</span>
          </span>
        ),
    },
    {
      id: 'perfil',
      encabezado: 'Perfil',
      // En tarjetas es la línea bajo el nombre, sin etiqueta y en un renglón:
      // «Diseño Gráfico · Director · 7 años de experiencia».
      enTarjeta: 'meta',
      celda: (c) => {
        const conPerfil = Boolean(c.profile || c.seniority);
        return (
          <div className="min-w-0">
            {conPerfil ? (
              <p className={cn('break-words font-medium text-ink', EN_LINEA_EN_TARJETA)}>{c.profile || '—'}</p>
            ) : (
              <p className={cn('text-ink-muted', OCULTO_EN_TARJETA)}>
                —<span className="sr-only">Sin perfil</span>
              </p>
            )}
            <p className={cn('text-[13px] text-ink-muted', EN_LINEA_EN_TARJETA)}>
              {c.seniority && (
                <>
                  {c.profile && (
                    <span data-solo-tarjeta aria-hidden="true">
                      {' · '}
                    </span>
                  )}
                  {c.seniority}
                </>
              )}
              {/* Con la columna Experiencia escondida (tabla < 800 px), los años suben aquí. */}
              <span data-solo-bajo="md" className="tabular-nums">
                {c.seniority ? ' · ' : ''}
                {textoAnios(c.añosExperiencia)}
                <span className="sr-only"> de experiencia</span>
              </span>
              {/* …y en la tarjeta (donde Experiencia no sale), con su nombre. */}
              <span data-solo-tarjeta className="tabular-nums">
                {conPerfil ? ' · ' : ''}
                {textoAnios(c.añosExperiencia)} de experiencia
              </span>
            </p>
          </div>
        );
      },
    },
    {
      id: 'educacion',
      encabezado: 'Educación',
      ocultarBajo: 'lg',
      // En tarjetas no sale (está en la ficha): con dos renglones largos
      // alargaba cada tarjeta y se salía por la derecha.
      enTarjeta: 'oculta',
      className: 'md:min-w-[10rem]',
      celda: (c) =>
        c.universidad || c.carrera ? (
          <div className="min-w-0">
            <p className="line-clamp-1 text-ink [overflow-wrap:anywhere]" title={c.universidad || undefined}>
              {c.universidad || '—'}
            </p>
            {c.carrera && (
              <p className="line-clamp-1 text-[13px] text-ink-muted [overflow-wrap:anywhere]" title={c.carrera}>
                {c.carrera}
              </p>
            )}
          </div>
        ) : (
          <span className="text-ink-muted">
            —<span className="sr-only">Sin educación</span>
          </span>
        ),
    },
    {
      id: 'experiencia',
      encabezado: 'Experiencia',
      numerica: true,
      ocultarBajo: 'md',
      unaLinea: true,
      // En tarjetas, los años van en la línea del perfil.
      enTarjeta: 'oculta',
      celda: (c) => (
        <span className="text-[13px] text-ink-muted">
          <span className="font-display text-sm font-semibold text-ink">{c.añosExperiencia}</span>{' '}
          {c.añosExperiencia === 1 ? 'año' : 'años'}
        </span>
      ),
    },
    {
      id: 'edad',
      encabezado: 'Edad',
      numerica: true,
      // Edad y Fuente sólo caben con la TABLA a 1280 px o más (ventanas de
      // ~1600 px). En tarjetas no salen.
      ocultarBajo: '2xl',
      enTarjeta: 'oculta',
      celda: (c) =>
        c.edad ? (
          <span>{c.edad}</span>
        ) : (
          <span className="text-ink-muted">
            —<span className="sr-only">Sin edad</span>
          </span>
        ),
    },
    {
      id: 'estado',
      encabezado: 'Estado',
      // En tarjetas, arriba a la derecha junto al nombre: el papel «acciones»
      // de DataTable es una POSICIÓN (arriba a la derecha, sin etiqueta).
      enTarjeta: 'acciones',
      celda: (c) => (
        <div className="flex flex-col flex-nowrap items-start gap-1">
          <StatusBadge estado={c.status} contexto="candidato" />
          {/* Mientras la columna Fuente no cabe (y en tarjetas), la fuente va bajo el
              estado. No es data-solo-bajo="2xl": ése no se ve en tarjetas. */}
          <span className="whitespace-nowrap text-xs text-ink-muted [@container_ap-tabla_(min-width:1280px)]:hidden">
            Fuente: {etiquetaFuente(c.source)}
          </span>
        </div>
      ),
    },
    {
      id: 'fuente',
      encabezado: 'Fuente',
      ocultarBajo: '2xl',
      enTarjeta: 'oculta',
      celda: (c) => (
        <Badge tono="neutro" sinPunto>
          {etiquetaFuente(c.source)}
        </Badge>
      ),
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      // En tarjetas, abajo y a lo ancho: arriba a la derecha, los cuatro
      // iconos dejaban al nombre sin sitio y se metía debajo de ellos.
      enTarjeta: 'completa',
      className: CLASES_ACCIONES_FIJAS,
      celda: (c) => {
        const linkedin = c.linkedinUrl ? ensureUrl(c.linkedinUrl) : undefined;
        return (
          <div className="flex items-center justify-end gap-0.5">
            <IconButton
              etiqueta={`Ver ficha de ${nombreCorto(c)}`}
              title="Ver ficha"
              icono={Eye}
              tamano="sm"
              onClick={() => handleView(c)}
            />
            <IconButton
              etiqueta={`Editar a ${nombreCorto(c)}`}
              title="Editar"
              icono={Pencil}
              tamano="sm"
              onClick={() => handleEdit(c)}
            />
            {linkedin && (
              <IconLink
                href={linkedin}
                etiqueta={`LinkedIn de ${nombreCorto(c)}`}
                title="Ver LinkedIn"
                icono={ExternalLink}
                tamano="sm"
              />
            )}
            <IconButton
              etiqueta={`Eliminar a ${nombreCorto(c)}`}
              title="Eliminar"
              icono={Trash2}
              tamano="sm"
              variante="peligro"
              onClick={() => pedirEliminarCandidato(c)}
            />
          </div>
        );
      },
    },
  ];

  const ficha = candidateToView;
  const educacionFicha = ficha ? parseEducacion(ficha) : [];
  const enlacesFicha = ficha
    ? [
        { etiqueta: 'Ver CV', icono: Download, url: ficha.cvUrl ? ensureUrl(ficha.cvUrl) : undefined },
        { etiqueta: 'LinkedIn', icono: ExternalLink, url: ficha.linkedinUrl ? ensureUrl(ficha.linkedinUrl) : undefined },
        { etiqueta: 'Portafolio', icono: ExternalLink, url: ficha.portafolioUrl ? ensureUrl(ficha.portafolioUrl) : undefined },
      ].filter((e) => e.url)
    : [];

  return (
    <>
      <PageHeader
        antetitulo="Sistema"
        titulo="Candidatos"
        remate="en el banco de talento"
        descripcion="Inyecta candidatos de LinkedIn, OCC y otras fuentes, y consulta su ficha y sus documentos."
        acciones={
          <Button icono={Plus} onClick={handleNew}>
            Nuevo candidato
          </Button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark"
        >
          <AlertCircle size={18} aria-hidden="true" className="flex-none" />
          <span className="min-w-0 flex-1">{error}</span>
          <Button variante="contorno" tamano="sm" icono={RefreshCw} onClick={() => fetchCandidates()}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Cifras del banco completo (cada una es el total que cuenta la API) */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 xl:grid-cols-4">
        <StatCard
          etiqueta="Total"
          valor={cifra(stats.total)}
          detalle="En el banco de talento"
          icono={Users}
          tono="ink"
          cargando={!cifrasListas}
        />
        <StatCard
          etiqueta="Disponibles"
          valor={cifra(stats.available)}
          detalle="Listos para asignar"
          icono={UserCheck}
          tono="lime"
          cargando={!cifrasListas}
        />
        <StatCard
          etiqueta="En proceso"
          valor={cifra(stats.inProcess)}
          detalle="En alguna vacante"
          icono={Briefcase}
          tono="orange"
          cargando={!cifrasListas}
        />
        <StatCard
          etiqueta="Contratados"
          valor={cifra(stats.hired)}
          detalle="Con estado Contratado"
          icono={Award}
          tono="teal"
          cargando={!cifrasListas}
        />
      </div>

      <Card titulo="Banco de candidatos" descripcion="Ordenados del más reciente al más antiguo." sinRelleno>
        {/* Los filtros se aplican con «Buscar» (o Intro en cualquier campo,
            también en los avanzados), como siempre: FilterToolbar en modo
            alAplicar es el formulario. */}
        <FilterToolbar
          className="border-b border-line px-5 py-4"
          alAplicar={applyFilters}
          sinAplicar={hayCambiosSinAplicar}
          aplicando={isLoading}
          busqueda={{
            valor: search,
            alCambiar: setSearch,
            etiqueta: 'Buscar candidatos',
            placeholder: 'Nombre, correo o carrera'
          }}
          activos={filtrosActivos}
          alLimpiar={clearFilters}
          resumen={resumen}
          acciones={
            <IconButton
              etiqueta="Actualizar lista de candidatos"
              title="Actualizar lista"
              icono={RefreshCw}
              variante="contorno"
              tamano="sm"
              onClick={() => fetchCandidates()}
              disabled={isLoading}
              className={cn('h-9 w-9', isLoading && '[&_svg]:animate-spin')}
            />
          }
          debajo={
            showFilters && (
              <div
                id="filtros-avanzados"
                className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <FiltroSelect etiqueta="Nivel" value={seniorityFilter} onChange={(e) => setSeniorityFilter(e.target.value)}>
                  <option value="">Todos</option>
                  {seniorities.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </FiltroSelect>
                <FiltroSelect etiqueta="Fuente" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                  <option value="">Todas</option>
                  {sources.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </FiltroSelect>
                <FiltroSelect etiqueta="Sexo" value={sexoFilter} onChange={(e) => setSexoFilter(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="Otro">Otro</option>
                </FiltroSelect>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filtro-universidad" className="text-xs font-medium text-ink-muted">
                    Universidad
                  </label>
                  <Input
                    id="filtro-universidad"
                    type="text"
                    value={universidadFilter}
                    onChange={(e) => setUniversidadFilter(e.target.value)}
                    placeholder="Ej: UANL, Tec…"
                    className={cn('h-9 text-[13px]', universidadFilter && 'border-teal bg-teal-tint/40')}
                  />
                </div>
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-xs font-medium text-ink-muted">Edad (años)</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="filtro-edad-min" className="text-[11px] text-ink-muted">
                        Mínima
                      </label>
                      <Input
                        id="filtro-edad-min"
                        type="number"
                        inputMode="numeric"
                        value={minAge}
                        onChange={(e) => setMinAge(e.target.value)}
                        placeholder="18"
                        min="18"
                        max="70"
                        className={cn('h-9 text-[13px] tabular-nums', minAge && 'border-teal bg-teal-tint/40')}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="filtro-edad-max" className="text-[11px] text-ink-muted">
                        Máxima
                      </label>
                      <Input
                        id="filtro-edad-max"
                        type="number"
                        inputMode="numeric"
                        value={maxAge}
                        onChange={(e) => setMaxAge(e.target.value)}
                        placeholder="70"
                        min="18"
                        max="70"
                        className={cn('h-9 text-[13px] tabular-nums', maxAge && 'border-teal bg-teal-tint/40')}
                      />
                    </div>
                  </div>
                </fieldset>
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-xs font-medium text-ink-muted">Años de experiencia</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="filtro-exp-min" className="text-[11px] text-ink-muted">
                        Mínimo
                      </label>
                      <Input
                        id="filtro-exp-min"
                        type="number"
                        inputMode="numeric"
                        value={minExperience}
                        onChange={(e) => setMinExperience(e.target.value)}
                        placeholder="0"
                        min="0"
                        max="40"
                        className={cn('h-9 text-[13px] tabular-nums', minExperience && 'border-teal bg-teal-tint/40')}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="filtro-exp-max" className="text-[11px] text-ink-muted">
                        Máximo
                      </label>
                      <Input
                        id="filtro-exp-max"
                        type="number"
                        inputMode="numeric"
                        value={maxExperience}
                        onChange={(e) => setMaxExperience(e.target.value)}
                        placeholder="40"
                        min="0"
                        max="40"
                        className={cn('h-9 text-[13px] tabular-nums', maxExperience && 'border-teal bg-teal-tint/40')}
                      />
                    </div>
                  </div>
                </fieldset>
                <p className="text-[13px] text-ink-muted sm:col-span-2 lg:col-span-4">
                  Los filtros se aplican al pulsar <span className="font-medium text-ink">Buscar</span> o Intro.
                </p>
              </div>
            )
          }
        >
          <FiltroSelect etiqueta="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </FiltroSelect>
          <FiltroSelect etiqueta="Perfil" value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)}>
            <option value="">Todos</option>
            {profiles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </FiltroSelect>
          <Button
            variante={showFilters ? 'secundario' : 'contorno'}
            tamano="sm"
            icono={SlidersHorizontal}
            className="h-9"
            aria-expanded={showFilters}
            aria-controls="filtros-avanzados"
            onClick={() => setShowFilters(!showFilters)}
          >
            Filtros
            {filtrosDelPanel > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums',
                  showFilters ? 'bg-white text-ink' : 'bg-ink text-white'
                )}
              >
                {filtrosDelPanel}
                <span className="sr-only"> activos</span>
              </span>
            )}
          </Button>
        </FilterToolbar>

        <DataTable
          etiqueta="Banco de candidatos"
          columnas={columnas}
          filas={candidates}
          claveFila={(c) => c.id}
          cargando={isLoading}
          alActivarFila={handleView}
          filaSeleccionada={(c) => candidateToView?.id === c.id}
          // Como antes, el paginador no se ofrece mientras llega una página.
          paginacion={isLoading ? undefined : pagination}
          alCambiarPagina={setPage}
          etiquetaTotal="candidatos"
          vacio={
            <EmptyState
              frase="Nada por aquí, todavía."
              titulo={listaFiltrada ? 'No hay candidatos con estos filtros' : 'No hay candidatos registrados'}
              descripcion={
                listaFiltrada
                  ? 'Cambia o limpia los filtros y pulsa Buscar.'
                  : 'Inyecta el primero desde LinkedIn, OCC o un referido.'
              }
              accion={
                listaFiltrada ? undefined : (
                  <Button variante="contorno" tamano="sm" icono={Plus} onClick={handleNew}>
                    Nuevo candidato
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      {/* Alta y edición (modal propio de CandidateForm) */}
      <CandidateForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setCandidateToEdit(null);
        }}
        onSuccess={() => {
          fetchCandidates();
          fetchStats();
        }}
        candidateToEdit={candidateToEdit}
      />

      {/* Ficha del candidato: panel lateral sin salir de la lista */}
      <Drawer
        abierto={ficha !== null}
        alCerrar={cerrarFicha}
        ancho="w-[min(40rem,100vw)]"
        titulo={ficha ? `${ficha.nombre} ${ficha.apellidoPaterno}${ficha.apellidoMaterno ? ` ${ficha.apellidoMaterno}` : ''}` : ''}
        descripcion={ficha?.email}
        pie={
          ficha && (
            <>
              <Button variante="contorno" onClick={cerrarFicha}>
                Cerrar
              </Button>
              <Button
                variante="secundario"
                icono={Pencil}
                onClick={() => {
                  cerrarFicha();
                  handleEdit(ficha);
                }}
              >
                Editar
              </Button>
            </>
          )
        }
      >
        {ficha && (
          <div className="space-y-7">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge estado={ficha.status} contexto="candidato" />
              <Badge tono="neutro" sinPunto>
                Fuente: {etiquetaFuente(ficha.source)}
              </Badge>
              {ficha.userId && (
                <Badge tono="info" icono={KeyRound}>
                  Con cuenta de acceso
                </Badge>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {[
                { termino: 'Teléfono', valor: ficha.telefono },
                { termino: 'Edad', valor: ficha.edad ? `${ficha.edad} años` : null },
                { termino: 'Sexo', valor: etiquetaSexo(ficha.sexo) },
                { termino: 'Perfil', valor: ficha.profile },
                { termino: 'Nivel', valor: ficha.seniority },
                { termino: 'Años de experiencia', valor: String(ficha.añosExperiencia) },
              ].map((d) => (
                <div key={d.termino} className="min-w-0">
                  <dt className="text-xs text-ink-muted">{d.termino}</dt>
                  <dd className={cn('mt-0.5 break-words text-sm font-medium', d.valor ? 'text-ink tabular-nums' : 'text-ink-muted')}>
                    {d.valor || '—'}
                  </dd>
                </div>
              ))}
            </dl>

            {enlacesFicha.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {enlacesFicha.map(({ etiqueta, icono: Icono, url }) => (
                  <a
                    key={etiqueta}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clasesBoton({ variante: 'contorno', tamano: 'sm' })}
                  >
                    <Icono aria-hidden="true" />
                    {etiqueta}
                    <span className="sr-only"> (se abre en otra pestaña)</span>
                  </a>
                ))}
              </div>
            )}

            {/* FEATURE: Educación múltiple */}
            {educacionFicha.length > 0 && (
              <section aria-labelledby="ficha-educacion" className="[overflow:visible]">
                <h3 id="ficha-educacion" className="mb-2.5 flex items-center gap-2 font-display text-sm font-semibold text-ink">
                  <GraduationCap size={16} className="text-teal" aria-hidden="true" />
                  Educación
                </h3>
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {educacionFicha.map((edu) => (
                    <li key={edu.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{edu.carrera || 'Sin carrera'}</p>
                        <p className="text-sm text-ink-muted">{edu.institucion || 'Sin institución'}</p>
                        {(edu.nivel || edu.añoInicio || edu.añoFin) && (
                          <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                            {edu.nivel}
                            {edu.nivel && (edu.añoInicio || edu.añoFin) && ' · '}
                            {(edu.añoInicio || edu.añoFin) && `${edu.añoInicio || '?'} – ${edu.añoFin || 'Presente'}`}
                          </p>
                        )}
                      </div>
                      {edu.estatus && (
                        <Badge tono={tonoEstatusEducacion(edu.estatus)} className="flex-none">
                          {edu.estatus}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {ficha.experiences.length > 0 && (
              <section aria-labelledby="ficha-experiencia" className="[overflow:visible]">
                <h3 id="ficha-experiencia" className="mb-2.5 flex items-center gap-2 font-display text-sm font-semibold text-ink">
                  <Briefcase size={16} className="text-teal" aria-hidden="true" />
                  Experiencia laboral
                </h3>
                <ol className="space-y-0">
                  {ficha.experiences.map((exp: any, i: number) => (
                    <li key={i} className="relative border-l-2 border-line pb-4 pl-5 last:pb-0">
                      <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-teal" aria-hidden="true" />
                      <p className="font-medium text-ink">{exp.puesto}</p>
                      <p className="text-sm text-ink-muted">{exp.empresa}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                        {formatoSoloFecha(exp.fechaInicio)}{' '}
                        –
                        {exp.esActual
                          ? ' Actual'
                          : exp.fechaFin
                          ? ` ${formatoSoloFecha(exp.fechaFin)}`
                          : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {ficha.notas && (
              <section aria-labelledby="ficha-notas" className="[overflow:visible]">
                <h3 id="ficha-notas" className="mb-2.5 flex items-center gap-2 font-display text-sm font-semibold text-ink">
                  <StickyNote size={16} className="text-teal" aria-hidden="true" />
                  Notas internas
                </h3>
                <p className="whitespace-pre-wrap rounded-xl bg-paper px-4 py-3 text-sm leading-relaxed text-ink">
                  {ficha.notas}
                </p>
              </section>
            )}

            {/* Documentos adicionales */}
            <section aria-labelledby="ficha-documentos" className="border-t border-line pt-6 [overflow:visible]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 id="ficha-documentos" className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
                  <Paperclip size={16} className="text-teal" aria-hidden="true" />
                  Documentos adicionales
                  {!isLoadingDocs && documents.length > 0 && (
                    <span className="rounded-full bg-mist px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-ink">
                      {documents.length}
                    </span>
                  )}
                </h3>
                <Button
                  variante="fantasma"
                  tamano="sm"
                  icono={Plus}
                  aria-expanded={showAddDoc}
                  aria-controls="ficha-nuevo-documento"
                  onClick={() => setShowAddDoc(!showAddDoc)}
                >
                  Agregar
                </Button>
              </div>

              {/* Formulario para agregar documento */}
              {showAddDoc && (
                <div id="ficha-nuevo-documento" className="mb-4 space-y-3 rounded-xl border border-line bg-paper p-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="ficha-nombre-documento" className="text-sm font-medium text-ink">
                      Nombre del documento
                    </label>
                    <Input
                      id="ficha-nombre-documento"
                      type="text"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      placeholder="Ej: CV actualizado, carta de recomendación…"
                      aria-describedby="ficha-documento-ayuda"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SelectorArchivo
                      variante="secundario"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      disabled={!newDocName.trim()}
                      cargando={isUploadingDoc}
                      textoCargando="Subiendo…"
                      aria-describedby="ficha-documento-ayuda"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAddDocument(file);
                        e.target.value = '';
                      }}
                    >
                      {newDocName.trim() ? 'Seleccionar archivo' : 'Escribe el nombre primero'}
                    </SelectorArchivo>
                    <Button
                      variante="fantasma"
                      tamano="sm"
                      onClick={() => {
                        setShowAddDoc(false);
                        setNewDocName('');
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                  <p id="ficha-documento-ayuda" className="text-[13px] text-ink-muted">
                    Formatos: PDF, JPG, PNG, WEBP. Máximo 4MB.
                  </p>
                </div>
              )}

              {/* Lista de documentos */}
              {isLoadingDocs ? (
                <div role="status" className="rounded-xl border border-line p-4">
                  <span className="sr-only">Cargando documentos…</span>
                  <SkeletonTexto lineas={2} />
                </div>
              ) : documents.length === 0 ? (
                <EmptyState compacto icono={FileText} titulo="No hay documentos adicionales" />
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {documents.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-teal-tint text-teal" aria-hidden="true">
                          <FileText size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{doc.name}</p>
                          <p className="text-xs tabular-nums text-ink-muted">
                            {fechaCorta(doc.createdAt)}
                            {doc.fileType && ` · ${tipoCorto(doc.fileType)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-none items-center gap-0.5">
                        {/* ADM-079: el fileUrl de documentos creados desde
                            admin no se validaba; sólo http(s) llega a href. */}
                        {isSafeHttpUrl(doc.fileUrl) && (
                          <IconLink
                            href={doc.fileUrl}
                            etiqueta={`Ver o descargar ${doc.name}`}
                            title="Ver/Descargar"
                            icono={Download}
                            tamano="sm"
                          />
                        )}
                        <IconButton
                          etiqueta={`Eliminar ${doc.name}`}
                          title="Eliminar"
                          icono={Trash2}
                          tamano="sm"
                          variante="peligro"
                          onClick={() => setDocumentoAEliminar(doc)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Drawer>

      {/* Confirmación: eliminar candidato (antes window.confirm) */}
      <ConfirmarModal
        abierto={candidatoAEliminar !== null}
        alCancelar={() => setCandidatoAEliminar(null)}
        alConfirmar={confirmarEliminarCandidato}
        cargando={eliminandoCandidato}
        titulo="Eliminar candidato"
        descripcion={
          candidatoAEliminar
            ? `¿Seguro que quieres eliminar a ${nombreCorto(candidatoAEliminar)} del banco de candidatos? Esta acción no se puede deshacer.`
            : undefined
        }
        icono={Trash2}
        textoConfirmar="Eliminar"
        textoCargando="Eliminando…"
      />

      {/* Confirmación: eliminar documento (antes window.confirm). Va después
          del Drawer: queda encima y sólo ella atiende Escape. */}
      <ConfirmarModal
        abierto={documentoAEliminar !== null}
        alCancelar={() => setDocumentoAEliminar(null)}
        alConfirmar={confirmarEliminarDocumento}
        cargando={eliminandoDocumento}
        titulo="Eliminar documento"
        descripcion={documentoAEliminar ? `¿Eliminar «${documentoAEliminar.name}»? Esta acción no se puede deshacer.` : undefined}
        icono={Trash2}
        textoConfirmar="Eliminar"
        textoCargando="Eliminando…"
      />

      {/* Avisos de éxito y error de las acciones */}
      <Toast
        mensaje={notification.type ? notification.message : null}
        tono={notification.type === 'error' ? 'error' : 'exito'}
        alCerrar={() => setNotification({ type: null, message: '' })}
      />
    </>
  );
}

// useSearchParams exige Suspense en el App Router (ADM-099)
export default function AdminCandidatesPage() {
  return (
    <Suspense fallback={<SkeletonPagina />}>
      <AdminCandidatesContent />
    </Suspense>
  );
}

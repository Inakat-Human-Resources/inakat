// RUTA: src/components/sections/talents/SearchPositionsSection.tsx
//
// La bolsa de trabajo pública: buscador, resultados y detalle.
//
// Presentación (registro PÚBLICO «Arco», estilos en src/app/talents/talents.css):
// - el buscador es una pieza blanca acoplada al pie de la portada («el
//   muelle»): cruza del suelo arena al suelo tinta de los resultados;
// - resultados en suelo tinta: titular grande, la cifra de vacantes en lima y
//   un tablero de dos columnas desde 1024 px (lista a la izquierda, detalle
//   fijo a la derecha con su propio scroll);
// - por debajo de 1024 px la lista ocupa todo y el detalle se abre en un
//   Drawer al elegir una vacante.
//
// Lógica: la de siempre. Mismas llamadas (/api/auth/me, /api/specialties,
// /api/jobs paginado de 20 en 20 con los filtros en el servidor, /api/jobs/:id
// para ?vacante=), mismos estados y mismas reglas de quién puede postularse.

'use client';

import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Info, Loader2, LogIn, MapPin, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ApplyJobModal from './ApplyJobModal';
import TarjetaVacante from './TarjetaVacante';
import DetalleVacante from './DetalleVacante';
import { textoPublicada, type Job } from './vacante';
import Drawer from '@/components/ui/Drawer';
import EmptyState from '@/components/ui/EmptyState';
import FormField, { Input, Select } from '@/components/ui/FormField';
import Skeleton from '@/components/ui/Skeleton';
import Toast from '@/components/ui/Toast';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

/** Tamaño de página del listado público (la API admite hasta 100). */
const JOBS_POR_PAGINA = 20;

/** id del panel de detalle (lo enlazan las tarjetas con aria-controls). */
const ID_DETALLE = 'tl-detalle';

/** Por debajo de este ancho el detalle se abre en un Drawer (lg de Tailwind). */
const CONSULTA_ESTRECHA = '(max-width: 1023.98px)';

const OPCIONES_ORDEN = [
  { value: 'newest', label: 'Más reciente' },
  { value: 'oldest', label: 'Menos reciente' },
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
];

/** ¿Pantalla estrecha? Sin matchMedia (jsdom, navegadores viejos) se trata como escritorio. */
const pantallaEstrecha = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(CONSULTA_ESTRECHA).matches;

const prefiereMenosMovimiento = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SearchPositionsSection = () => {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalJobs, setTotalJobs] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);

  // Usuario actual
  const [user, setUser] = useState<User | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');

  // FIX-05: Estado para ordenamiento (ahora un <select> nativo con etiqueta:
  // el desplegable propio no tenía teclado ni aria-expanded).
  const [sortOrder, setSortOrder] = useState<string>('newest');

  // FIX-06: Estado para filtro de especialidad
  const [specialties, setSpecialties] = useState<{id: number, name: string}[]>([]);
  const [specialtyFilter, setSpecialtyFilter] = useState('');

  // Modal de aplicación
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState(false);

  // Presentación: el detalle en un Drawer por debajo de 1024 px.
  const [detalleMovilAbierto, setDetalleMovilAbierto] = useState(false);
  const busquedaRef = useRef<HTMLInputElement>(null);
  const detallePorEnlaceMostradoRef = useRef(false);

  // Identifica la última petición del listado (ver fetchJobs).
  const peticionVacantesRef = useRef(0);

  // Vacante pedida por URL (/talents?vacante=ID). Es a donde vuelve el login
  // desde "INICIA SESIÓN PARA POSTULARTE": antes se volvía a /talents a secas y
  // el candidato aterrizaba en la primera vacante, no en la que había elegido.
  // Se consume una sola vez, con la primera carga del listado.
  const vacantePedidaRef = useRef<number | null>(null);
  const vacantePedidaResueltaRef = useRef(false);

  useEffect(() => {
    try {
      const id = Number(new URLSearchParams(window.location.search).get('vacante'));
      if (Number.isInteger(id) && id > 0) {
        vacantePedidaRef.current = id;
      }
    } catch {
      // Sin query legible: se comporta como /talents normal.
    }
  }, []);

  // Si la ventana se ensancha con el Drawer abierto, el detalle ya se ve en
  // su columna: se cierra el Drawer.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const consulta = window.matchMedia(CONSULTA_ESTRECHA);
    const alCambiar = () => {
      if (!consulta.matches) setDetalleMovilAbierto(false);
    };
    consulta.addEventListener?.('change', alCambiar);
    return () => consulta.removeEventListener?.('change', alCambiar);
  }, []);

  // Cargar usuario actual
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // FIX-06: Cargar especialidades al montar
  useEffect(() => {
    fetch('/api/specialties')
      .then(res => res.json())
      .then(data => {
        if (data.success) setSpecialties(data.data);
      })
      .catch(err => console.error('Error fetching specialties:', err));
  }, []);

  // Los filtros se resuelven EN EL SERVIDOR (GET /api/jobs ya acepta search,
  // location, jobType, profile, page y limit). Filtrar en el cliente sobre la
  // primera página escondía todas las vacantes fuera de ella: una vacante pagada
  // publicada semanas atrás no aparecía ni buscándola por su título exacto.
  // Se espera 300 ms para no disparar una consulta por tecla.
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setPage(1);
      fetchJobs(1, false);
    }, 300);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, locationFilter, jobTypeFilter, specialtyFilter]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUser(data.user);
        }
      }
      // Si no está logueado o error, user queda null (está bien)
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  /** Construye la query del listado con los filtros activos. */
  const construirQueryVacantes = (paginaPedida: number) => {
    const params = new URLSearchParams();
    params.set('status', 'active');
    params.set('page', String(paginaPedida));
    params.set('limit', String(JOBS_POR_PAGINA));

    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if (locationFilter.trim()) params.set('location', locationFilter.trim());
    if (jobTypeFilter && jobTypeFilter !== 'all') {
      params.set('jobType', jobTypeFilter);
    }
    if (specialtyFilter) params.set('profile', specialtyFilter);

    return params.toString();
  };

  /**
   * Pide una página del listado. `append` distingue el "Cargar más" (acumula)
   * de un cambio de filtros (reemplaza).
   */
  const fetchJobs = async (paginaPedida = 1, append = false) => {
    // Cada búsqueda lleva número: si una respuesta llega tarde (el usuario ya
    // tecleó otra cosa) se descarta en vez de pisar los resultados nuevos.
    const peticion = ++peticionVacantesRef.current;

    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const response = await fetch(`/api/jobs?${construirQueryVacantes(paginaPedida)}`);
      const data = await response.json();
      if (peticion !== peticionVacantesRef.current) return;

      if (data.success) {
        const recibidas: Job[] = data.data || [];
        setJobs((previas) => {
          if (!append) return recibidas;
          // La vacante pedida por URL pudo entrar antes de su página: sin
          // duplicarla al llegar a ella con "Cargar más".
          const yaCargadas = new Set(previas.map((job) => job.id));
          return [...previas, ...recibidas.filter((job) => !yaCargadas.has(job.id))];
        });
        setTotalJobs(data.pagination?.total ?? recibidas.length);
        setHasNext(Boolean(data.pagination?.hasNext));
        if (!append) {
          await resolverVacantePedida(recibidas);
        }
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      if (peticion === peticionVacantesRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  /**
   * Selecciona la vacante de /talents?vacante=ID tras la primera carga. Si no
   * está en la primera página se pide aparte y se antepone al listado, siempre
   * que siga activa.
   */
  const resolverVacantePedida = async (recibidas: Job[]) => {
    const id = vacantePedidaRef.current;
    if (id === null || vacantePedidaResueltaRef.current) return;
    vacantePedidaResueltaRef.current = true;

    const enLista = recibidas.find((job) => job.id === id);
    if (enLista) {
      setSelectedJob(enLista);
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${id}`);
      if (!response.ok) return;
      const data = await response.json();
      const job: Job | undefined = data?.data;
      if (!data?.success || !job || job.status !== 'active') return;

      setJobs((previas) =>
        previas.some((previa) => previa.id === job.id) ? previas : [job, ...previas]
      );
      setSelectedJob(job);
    } catch {
      // Si falla, el listado sigue funcionando con su primera vacante.
    }
  };

  /** Login que vuelve a esta misma vacante al terminar. */
  const irALoginParaPostular = (jobId: number) => {
    const destino = `/talents?vacante=${jobId}`;
    router.push(`/login?redirect=${encodeURIComponent(destino)}`);
  };

  const cargarMasVacantes = () => {
    if (isLoadingMore || !hasNext) return;
    const siguiente = page + 1;
    setPage(siguiente);
    fetchJobs(siguiente, true);
  };

  // El orden se aplica sobre las vacantes ya cargadas. 'newest' coincide con el
  // orden del servidor (createdAt desc), así que es global; los demás ordenan lo
  // que hay en pantalla hasta que la API acepte un parámetro `sort`.
  const jobsOrdenadas = useMemo(() => {
    const listado = [...jobs];

    switch (sortOrder) {
      case 'newest':
        listado.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        listado.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'az':
        listado.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'za':
        listado.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return listado;
  }, [jobs, sortOrder]);

  // El detalle debe seguir a la lista: si la vacante seleccionada ya no está en
  // los resultados, se pasa a la primera (antes quedaba el detalle y el botón
  // POSTULARME de una vacante que el filtro ya había descartado).
  useEffect(() => {
    if (jobsOrdenadas.length === 0) {
      if (selectedJob !== null) setSelectedJob(null);
      return;
    }
    if (!selectedJob || !jobsOrdenadas.some((job) => job.id === selectedJob.id)) {
      setSelectedJob(jobsOrdenadas[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsOrdenadas]);

  // Presentación: quien vuelve del login a /talents?vacante=ID en el móvil no
  // ve la columna de detalle; se le abre el Drawer con esa vacante (una vez).
  useEffect(() => {
    if (detallePorEnlaceMostradoRef.current || !selectedJob) return;
    if (!vacantePedidaResueltaRef.current || selectedJob.id !== vacantePedidaRef.current) return;
    detallePorEnlaceMostradoRef.current = true;
    if (pantallaEstrecha()) setDetalleMovilAbierto(true);
  }, [selectedJob]);

  // Por tramos: pasado un mes, la fecha corta en vez de «hace 212 días».
  const getTimeSincePosted = (createdAt: string) => textoPublicada(createdAt);

  const handleApplyClick = () => {
    setIsApplyModalOpen(true);
  };

  const handleApplicationSuccess = () => {
    setApplicationSuccess(true);
    setTimeout(() => setApplicationSuccess(false), 5000);
  };

  // Elegir una vacante: la de siempre (setSelectedJob) y, en pantallas
  // estrechas, además se abre el detalle en el Drawer.
  const seleccionarVacante = (job: Job) => {
    setSelectedJob(job);
    if (pantallaEstrecha()) setDetalleMovilAbierto(true);
  };

  // #64: el filtrado es reactivo (en vivo): «Buscar» lleva a los resultados.
  const irAResultados = () => {
    document
      .getElementById('resultados-vacantes')
      ?.scrollIntoView({ behavior: prefiereMenosMovimiento() ? 'auto' : 'smooth' });
  };

  // Vuelve a los filtros iniciales (dispara la misma búsqueda que al cargar).
  const limpiarFiltros = () => {
    setSearchTerm('');
    setLocationFilter('');
    setJobTypeFilter('');
    setSpecialtyFilter('');
    busquedaRef.current?.focus();
  };

  // Verificar si el usuario puede aplicar
  // Permitimos: no logueados, candidatos, y usuarios generales
  // Bloqueamos: empresas, admins, reclutadores, especialistas
  const blockedRoles = ['company', 'admin', 'recruiter', 'specialist'];
  const canApply = !user || !blockedRoles.includes(user.role);

  const hayFiltrosActivos = Boolean(
    searchTerm.trim() ||
      locationFilter.trim() ||
      (jobTypeFilter && jobTypeFilter !== 'all') ||
      specialtyFilter
  );
  const filtrosActivos = [
    searchTerm.trim(),
    locationFilter.trim(),
    jobTypeFilter && jobTypeFilter !== 'all' ? jobTypeFilter : '',
    specialtyFilter,
  ].filter(Boolean).length;

  // La cifra grande espera a la primera respuesta (no pinta un «0» falso).
  const primeraCarga = isLoading && jobs.length === 0;

  const estadoResultados = isLoading
    ? ''
    : totalJobs > 0
      ? `Mostrando ${jobsOrdenadas.length} de ${totalJobs} vacante${totalJobs === 1 ? '' : 's'}`
      : hayFiltrosActivos
        ? 'Ninguna vacante coincide con tu búsqueda'
        : '';

  /** Botón (o aviso) del pie del detalle: los tres estados de siempre. */
  const accionPostular = (job: Job) =>
    !user ? (
      // No logueado → botón que lleva a login
      <button
        type="button"
        onClick={() => irALoginParaPostular(job.id)}
        className="hm-btn hm-btn--orange tl-accion"
      >
        <LogIn aria-hidden="true" />
        Inicia sesión para postularte
      </button>
    ) : canApply ? (
      // Candidato logueado → aplicar normal
      <button type="button" onClick={handleApplyClick} className="hm-btn hm-btn--orange tl-accion">
        Postularme
        <ArrowRight aria-hidden="true" />
      </button>
    ) : (
      // Otros roles → mensaje informativo
      <p className="tl-aviso-rol bg-mist text-ink">
        <Info className="h-5 w-5 flex-none text-teal" aria-hidden="true" />
        <span>
          {user?.role === 'company' && 'Las empresas no pueden aplicar a vacantes'}
          {user?.role === 'admin' && 'Los administradores no pueden aplicar a vacantes'}
          {user?.role === 'recruiter' && 'Los reclutadores no pueden aplicar a vacantes'}
          {user?.role === 'specialist' && 'Los especialistas no pueden aplicar a vacantes'}
        </span>
      </p>
    );

  // Avisos por rol (textos de siempre; un solo estilo: el color no los distingue).
  const avisoRol =
    user && user.role === 'company'
      ? {
          titulo: 'Estás viendo como empresa',
          texto:
            'Puedes ver las vacantes publicadas pero no aplicar a ellas. Para publicar tus vacantes, ve a tu panel de empresa.',
        }
      : user && user.role === 'admin'
        ? { titulo: 'Vista de administrador', texto: 'Estás viendo las vacantes activas en la plataforma.' }
        : user && user.role === 'recruiter'
          ? {
              titulo: 'Vista de reclutador',
              texto: 'Estás viendo las vacantes activas. Para gestionar candidatos, ve a tu dashboard.',
            }
          : user && user.role === 'specialist'
            ? {
                titulo: 'Vista de especialista',
                texto: 'Estás viendo las vacantes activas. Para evaluar candidatos, ve a tu dashboard.',
              }
            : null;

  return (
    <section className="tl-bolsa hm-suelo--tinta" aria-labelledby="tl-bolsa-titulo">
      {/* Modal de aplicación */}
      {selectedJob && (
        <ApplyJobModal
          jobId={selectedJob.id}
          jobTitle={selectedJob.title}
          company={selectedJob.company}
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          onSuccess={handleApplicationSuccess}
        />
      )}

      {/* Mensaje de éxito: aviso flotante, se ve esté donde esté la persona. */}
      <Toast
        tono="exito"
        mensaje={
          applicationSuccess
            ? '¡Aplicación enviada exitosamente! El reclutador revisará tu perfil pronto.'
            : null
        }
        alCerrar={() => setApplicationSuccess(false)}
        duracion={5000}
      />

      <div className="tl-bolsa__deco" aria-hidden="true">
        <span className="tl-bolsa__arco" />
        <span className="tl-bolsa__arco tl-bolsa__arco--b" />
      </div>

      {/* ── El buscador: el muelle entre la portada y los resultados ── */}
      <div className="hm-wrap tl-muelle">
        <form
          id="vacantes"
          role="search"
          aria-label="Buscar vacantes"
          className="tl-busqueda"
          onSubmit={(e) => {
            e.preventDefault();
            irAResultados();
          }}
        >
          <div className="tl-busqueda__campos">
            <FormField etiqueta="¿Qué buscas?" className="tl-campo tl-campo--que">
              <Input
                ref={busquedaRef}
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Puesto, área o empresa"
                prefijo={<Search />}
                autoComplete="off"
                enterKeyHint="search"
                className="tl-control"
              />
            </FormField>

            <FormField etiqueta="¿Dónde?" className="tl-campo tl-campo--donde">
              <Input
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Ciudad o estado"
                prefijo={<MapPin />}
                autoComplete="address-level2"
                enterKeyHint="search"
                className="tl-control"
              />
            </FormField>

            <FormField etiqueta="Tipo de trabajo" className="tl-campo">
              <Select
                value={jobTypeFilter}
                onChange={(e) => setJobTypeFilter(e.target.value)}
                className="tl-control"
              >
                <option value="all">Todos</option>
                <option value="Tiempo Completo">Tiempo completo</option>
                <option value="Medio Tiempo">Medio tiempo</option>
                <option value="Por Proyecto">Por proyecto</option>
              </Select>
            </FormField>

            {/* FIX-06: Filtro por especialidad */}
            <FormField etiqueta="Especialidad" className="tl-campo">
              <Select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="tl-control"
              >
                <option value="">Todas</option>
                {specialties.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </Select>
            </FormField>

            <button type="submit" className="hm-btn hm-btn--orange tl-busqueda__boton">
              <Search aria-hidden="true" />
              Buscar
            </button>
          </div>

          {hayFiltrosActivos && (
            <div className="tl-busqueda__pie border-t border-line">
              <p className="text-sm text-ink-muted">
                {filtrosActivos} {filtrosActivos === 1 ? 'filtro activo' : 'filtros activos'} · los resultados se
                actualizan solos
              </p>
              <button type="button" onClick={limpiarFiltros} className="tl-limpiar text-teal">
                <X aria-hidden="true" />
                Limpiar filtros
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ── Resultados ── */}
      <div className="hm-wrap tl-resultados">
        <div id="resultados-vacantes" className="tl-cabeza">
          <div>
            <p className="hm-eyebrow">Vacantes</p>
            <h2
              id="tl-bolsa-titulo"
              className="hm-h2 tl-cabeza__titulo mt-5"
              aria-label="Descubre tus oportunidades."
            >
              <span className="tl-renglon hm-mask" aria-hidden="true">
                <span>Descubre tus</span>
              </span>
              <span className="tl-renglon hm-mask" aria-hidden="true">
                <span>
                  <em>oportunidades.</em>
                </span>
              </span>
            </h2>
          </div>

          {/* Decorativa: la misma cifra la anuncia la línea de estado. */}
          {!primeraCarga && (
            <p className="tl-cifra" aria-hidden="true" data-cargando={isLoading || undefined}>
              <span className="tl-cifra__n">{totalJobs.toLocaleString('es-MX')}</span>
              <span className="tl-cifra__l">
                {totalJobs === 1 ? 'vacante' : 'vacantes'}{' '}
                {hayFiltrosActivos ? 'con tu búsqueda' : totalJobs === 1 ? 'activa' : 'activas'}
              </span>
            </p>
          )}
        </div>

        {/* Aviso por rol */}
        {avisoRol && (
          <div className="tl-aviso bg-teal-tint text-teal-dark">
            <Info className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <div>
              <p className="font-display font-semibold">{avisoRol.titulo}</p>
              <p className="mt-0.5 text-sm">{avisoRol.texto}</p>
            </div>
          </div>
        )}

        {/* Estado y orden. Los botones 'Guardados' / 'Postulados' / 'Vencidos'
            se retiraron: no tenían onClick ni estado, 'Guardados' aparecía
            siempre activo y no existe modelo ni API de vacantes guardadas. Se
            reponen cuando la función exista de verdad. */}
        <div className="tl-barra">
          <p className="tl-barra__estado" role="status" aria-live="polite">
            {estadoResultados}
          </p>

          <div className="tl-orden">
            <label htmlFor="tl-orden">Ordenar por</label>
            <Select
              id="tl-orden"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="tl-orden__control"
            >
              {OPCIONES_ORDEN.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <noscript>
          <p className="tl-sin-js">Para buscar y ver las vacantes necesitas activar JavaScript en tu navegador.</p>
        </noscript>

        {/* Cargando */}
        {isLoading && (
          <div className="tl-cargando" role="status" aria-live="polite">
            <span className="sr-only">Cargando vacantes…</span>
            <div className="tl-tablero" aria-hidden="true">
              <div className="tl-lista">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="tl-tarjeta tl-tarjeta--hueco">
                    <Skeleton className="tl-tarjeta__logo h-10 w-10 rounded-lg" />
                    <div className="space-y-2.5">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-6 w-28 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="tl-detalle tl-detalle--hueco hidden lg:block">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-5 h-9 w-2/3" />
                <Skeleton className="mt-3 h-4 w-1/3" />
                <Skeleton className="mt-8 h-16 w-full rounded-xl" />
                <Skeleton className="mt-8 h-3.5 w-full" />
                <Skeleton className="mt-2.5 h-3.5 w-11/12" />
                <Skeleton className="mt-2.5 h-3.5 w-4/5" />
              </div>
            </div>
          </div>
        )}

        {/* No hay vacantes */}
        {!isLoading && jobsOrdenadas.length === 0 && (
          <div className="tl-vacio">
            <EmptyState
              frase={hayFiltrosActivos ? 'Ninguna coincidencia, por ahora.' : 'Vuelve pronto.'}
              titulo={
                hayFiltrosActivos
                  ? 'No se encontraron vacantes que coincidan con tu búsqueda.'
                  : 'No hay vacantes disponibles en este momento.'
              }
              descripcion={
                hayFiltrosActivos
                  ? 'Prueba con otra palabra, otra ciudad o quita algún filtro.'
                  : 'Crea tu perfil y podrás postularte en cuanto se publiquen nuevas vacantes.'
              }
              accion={
                hayFiltrosActivos ? (
                  <button type="button" onClick={limpiarFiltros} className="hm-btn hm-btn--ghost tl-vacio__boton">
                    <X aria-hidden="true" />
                    Limpiar filtros
                  </button>
                ) : (
                  <Link href="/register" className="hm-btn hm-btn--orange tl-vacio__boton">
                    Regístrate ahora
                    <ArrowRight aria-hidden="true" />
                  </Link>
                )
              }
            />
          </div>
        )}

        {/* Lista y Detalle */}
        {!isLoading && jobsOrdenadas.length > 0 && (
          <div className="tl-tablero">
            {/* Columna izquierda: la lista se desplaza con la página */}
            <div className="tl-tablero__lista">
              <ol className="tl-lista" aria-label="Vacantes encontradas">
                {jobsOrdenadas.map((job) => (
                  <li key={job.id} className="tl-lista__item">
                    <TarjetaVacante
                      job={job}
                      seleccionada={selectedJob?.id === job.id}
                      publicada={getTimeSincePosted(job.createdAt)}
                      alSeleccionar={() => seleccionarVacante(job)}
                      idDetalle={ID_DETALLE}
                    />
                  </li>
                ))}
              </ol>

              {/* Paginación: la API devuelve la página y si quedan más. Sin esto
                  las vacantes fuera de la primera página eran inalcanzables. */}
              {hasNext && (
                <div className="tl-mas">
                  <p className="tl-mas__cuenta">
                    Has visto <strong>{jobsOrdenadas.length}</strong> de {totalJobs}
                  </p>
                  <span className="tl-mas__barra" aria-hidden="true">
                    <span
                      style={
                        { '--p': Math.min(1, jobsOrdenadas.length / Math.max(totalJobs, 1)) } as CSSProperties
                      }
                    />
                  </span>
                  <button
                    type="button"
                    onClick={cargarMasVacantes}
                    disabled={isLoadingMore}
                    aria-busy={isLoadingMore || undefined}
                    className="hm-btn hm-btn--lime tl-mas__boton"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden="true" />
                        Cargando…
                      </>
                    ) : (
                      <>
                        Cargar más vacantes
                        <ArrowDown aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Columna derecha: el detalle, fijo y con scroll propio (desde 1024 px) */}
            <aside className="tl-tablero__detalle hidden lg:block" aria-label="Detalle de la vacante">
              {selectedJob && (
                // key: al cambiar de vacante el panel se monta de nuevo y vuelve
                // arriba (si no, la nueva se leía a media altura).
                <DetalleVacante
                  key={selectedJob.id}
                  id={ID_DETALLE}
                  job={selectedJob}
                  publicada={getTimeSincePosted(selectedJob.createdAt)}
                  accion={accionPostular(selectedJob)}
                  desplazable
                  className="lg:sticky lg:top-[calc(var(--nav)_+_1rem)] lg:max-h-[calc(100vh_-_var(--nav)_-_2rem)] lg:overflow-y-auto lg:overscroll-contain"
                />
              )}
            </aside>
          </div>
        )}
      </div>

      {/* Móvil y tablet: el mismo detalle en un panel lateral */}
      <Drawer
        abierto={detalleMovilAbierto && Boolean(selectedJob)}
        alCerrar={() => setDetalleMovilAbierto(false)}
        titulo={selectedJob?.title}
        ancho="w-full sm:w-[min(36rem,100vw)]"
        pie={selectedJob ? accionPostular(selectedJob) : undefined}
      >
        {selectedJob && (
          <DetalleVacante
            key={selectedJob.id}
            job={selectedJob}
            publicada={getTimeSincePosted(selectedJob.createdAt)}
            conTitulo={false}
            className="tl-detalle--cajon"
          />
        )}
      </Drawer>
    </section>
  );
};

export default SearchPositionsSection;

// RUTA: src/app/diseno/page.tsx
'use client';

/**
 * Galería del sistema de diseño (sólo desarrollo). Cada componente de
 * src/components/ui con sus variantes y estados, los tokens con sus contrastes
 * medidos, las primitivas del registro público y los enlaces al banco de
 * pruebas de cada página real (/diseno/vista/…).
 */

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Download,
  Eye,
  FileText,
  Inbox,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import StatusBadge, { Badge, ESTADOS, type TonoBadge } from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { type Columna } from '@/components/ui/DataTable';
import Pagination, { paginacionLocal } from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton, { SkeletonTexto } from '@/components/ui/Skeleton';
import Toast, { AvisosProvider, useAvisos } from '@/components/ui/Toast';
import FormField, { Checkbox, Input, Select, Textarea } from '@/components/ui/FormField';
import Modal from '@/components/ui/Modal';
import Drawer from '@/components/ui/Drawer';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import Stepper from '@/components/ui/Stepper';
import FilterToolbar, { FiltroSelect } from '@/components/ui/FilterToolbar';
import Isotipo from '@/components/ui/Isotipo';
import MarcaInakat, { SimboloInakat } from '@/components/ui/MarcaInakat';
import Avatar from '@/components/ui/Avatar';
import TituloMascara from '@/components/ui/TituloMascara';
import Switch from '@/components/ui/Switch';
import Aviso from '@/components/ui/Aviso';
import MenuAcciones from '@/components/ui/MenuAcciones';
import { useConfirmacion } from '@/components/ui/useConfirmacion';
import EtapasPipeline from '@/components/ui/EtapasPipeline';
import CampoContrasena from '@/components/ui/CampoContrasena';
import SelectorArchivo from '@/components/ui/SelectorArchivo';
import { IconLink } from '@/components/ui/IconButton';
import { colores } from '@/components/ui/tokens';
import { VACANTES } from './fixtures/base';

type Vacante = (typeof VACANTES)[number];

const SECCIONES = [
  ['color', 'Color'],
  ['tipo', 'Tipografía'],
  ['botones', 'Botones'],
  ['estados', 'Estados'],
  ['cifras', 'Cifras y tarjetas'],
  ['tabla', 'Tabla de datos'],
  ['formularios', 'Formularios'],
  ['navegacion', 'Pestañas y pasos'],
  ['capas', 'Modal, cajón y avisos'],
  ['piezas', 'Piezas compartidas'],
  ['vacios', 'Vacío y carga'],
  ['publico', 'Registro público'],
  ['banco', 'Banco de pruebas'],
] as const;

const PAGINAS_BANCO: Array<[string, string[]]> = [
  [
    'Administración',
    [
      '/admin', '/admin/assign-candidates', '/admin/assignments', '/admin/candidates', '/admin/contact-messages',
      '/admin/credit-packages', '/admin/direct-applications', '/admin/interviews', '/admin/pricing',
      '/admin/requests', '/admin/specialties', '/admin/users', '/admin/vendors', '/applications',
    ],
  ],
  [
    'Empresa',
    ['/company/dashboard', '/company/jobs/101/candidates', '/company/interviews', '/company/profile', '/company/integrations', '/create-job', '/credits/purchase'],
  ],
  ['Candidato', ['/candidate/applications', '/my-applications', '/profile', '/notifications']],
  ['Equipo', ['/recruiter/dashboard', '/recruiter/jobs/101', '/specialist/dashboard', '/specialist/jobs/101', '/vendor/dashboard']],
];

function Seccion({ id, titulo, children, nota }: { id: string; titulo: string; nota?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line pt-10 [overflow:visible]">
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">{titulo}</h2>
      {nota && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{nota}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Muestra({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{titulo}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** Lo que la integración de la tanda subió a src/components/ui (docs/DISENO.md §4). */
function PiezasCompartidas() {
  const [activo, setActivo] = useState(true);
  const [ver, setVer] = useState(false);
  const [clave, setClave] = useState('');
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmacion();
  return (
    <>
      <Muestra titulo="Switch (activo / inactivo)">
        <Switch activo={activo} alCambiar={() => setActivo(!activo)} objeto="Pack 10" />
        <Switch activo={!activo} alCambiar={() => setActivo(!activo)} objeto="Ana Ruiz" tono="lima-oscuro" />
        <Switch activo alCambiar={() => undefined} objeto="Tecnología" cargando />
      </Muestra>
      <Muestra titulo="MenuAcciones · useConfirmacion">
        <MenuAcciones
          etiqueta="Más acciones para Analista contable"
          opciones={[
            {
              id: 'pausar',
              etiqueta: 'Pausar',
              alElegir: async () =>
                setRespuesta(
                  (await confirmar({ titulo: '¿Pausar «Analista contable»?', descripcion: 'Dejará de recibir postulaciones.', textoConfirmar: 'Pausar' }))
                    ? 'Confirmado'
                    : 'Cancelado'
                ),
            },
            { id: 'cancelar', etiqueta: 'Cancelar vacante', detalle: 'No se deshace', peligro: true, alElegir: () => setRespuesta('Cancelar vacante') },
          ]}
        />
        {respuesta && <span className="text-[13px] text-ink-muted">Respuesta: {respuesta}</span>}
        {dialogo}
      </Muestra>
      <Muestra titulo="Aviso en línea">
        <div className="grid w-full gap-3 lg:grid-cols-2">
          <Aviso mensaje="No se pudieron cargar los usuarios." alReintentar={() => undefined} alCerrar={() => undefined} />
          <Aviso tono="exito" titulo="Listo">Te enviamos el correo.</Aviso>
          <Aviso tono="info">La primera página se pide como siempre.</Aviso>
          <Aviso tono="aviso" compacto mensaje="Te quedan 2 créditos." />
        </div>
      </Muestra>
      <Muestra titulo="EtapasPipeline">
        <EtapasPipeline
          className="w-full max-w-2xl"
          etapas={[
            { id: 'p', etiqueta: 'Pendientes', valor: 4, punto: 'bg-orange' },
            { id: 'r', etiqueta: 'En revisión', valor: 2, punto: 'bg-teal' },
            { id: 'e', etiqueta: 'Especialista', valor: 0, punto: 'bg-teal' },
            { id: 'c', etiqueta: 'Empresa', valor: 1, punto: 'bg-lime' },
          ]}
        />
      </Muestra>
      <Muestra titulo="Campos: contraseña, archivo, enlace externo">
        <FormField etiqueta="Contraseña" className="w-full max-w-xs">
          <CampoContrasena value={clave} onChange={(e) => setClave(e.target.value)} visible={ver} alAlternar={() => setVer(!ver)} autoComplete="new-password" />
        </FormField>
        <SelectorArchivo accept=".pdf" onChange={() => undefined}>
          Subir archivo
        </SelectorArchivo>
        <IconLink href="https://www.linkedin.com" etiqueta="LinkedIn de ejemplo" icono={ArrowRight} variante="contorno" tamano="sm" />
      </Muestra>
    </>
  );
}

function Galeria() {
  const { avisar } = useAvisos();
  const [orden, setOrden] = useState<{ columna: string; direccion: 'asc' | 'desc' }>({ columna: 'createdAt', direccion: 'desc' });
  const [pagina, setPagina] = useState(1);
  const [estadoTabla, setEstadoTabla] = useState<'datos' | 'cargando' | 'vacio'>('datos');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<Vacante | null>(null);
  const [modal, setModal] = useState(false);
  const [modalPeligro, setModalPeligro] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pestana, setPestana] = useState('datos');
  const [paso, setPaso] = useState(1);
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = VACANTES.filter(
      (v) => (!filtroEstado || v.status === filtroEstado) && (!q || `${v.title} ${v.company}`.toLowerCase().includes(q))
    );
    const signo = orden.direccion === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
      const va = String(a[orden.columna as keyof Vacante] ?? '');
      const vb = String(b[orden.columna as keyof Vacante] ?? '');
      return va.localeCompare(vb) * signo;
    });
  }, [busqueda, filtroEstado, orden]);

  const columnas: Columna<Vacante>[] = [
    {
      id: 'title',
      encabezado: 'Vacante',
      ordenable: true,
      enTarjeta: 'titulo',
      // El nivel, EN LÍNEA con el título (debajo, la fila crecía a 77 px).
      celda: (v) => (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-semibold">{v.title}</p>
          <Badge tono="neutro" sinPunto tamano="sm">
            {v.seniority}
          </Badge>
        </div>
      ),
    },
    // En tarjetas, «meta»: una línea bajo el título, «Grupo Andes · Monterrey, NL».
    { id: 'company', encabezado: 'Empresa', ordenable: true, enTarjeta: 'meta', truncarEn: '14rem', tituloCelda: (v) => v.company, celda: (v) => v.company },
    { id: 'location', encabezado: 'Ubicación', ocultarBajo: 'lg', enTarjeta: 'meta', truncarEn: '12rem', tituloCelda: (v) => v.location, celda: (v) => <span className="text-ink-muted">{v.location}</span> },
    { id: 'applications', encabezado: 'Candidatos', numerica: true, celda: (v) => v._count.applications },
    { id: 'status', encabezado: 'Estado', ordenable: true, unaLinea: true, celda: (v) => <StatusBadge estado={v.status} contexto="vacante" /> },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      encabezadoOculto: true,
      alinear: 'fin',
      enTarjeta: 'acciones',
      celda: (v) => <IconButton etiqueta={`Ver ${v.title}`} icono={Eye} tamano="sm" onClick={() => setSeleccion(v)} />,
    },
  ];

  const porPagina = 8;
  const errorCorreo = enviado && !/^\S+@\S+\.\S+$/.test(correo) ? 'Escribe un correo con @ y dominio, p. ej. ana@empresa.com' : null;

  return (
    <div className="mx-auto max-w-app px-4 pb-24 sm:px-6 lg:px-8">
      {/* Cabecera de la galería */}
      <header className="flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <SimboloInakat className="h-9" />
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Sistema de diseño</span>
          </div>
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-tight text-ink sm:text-[44px]">
            Arco, <em className="font-serif font-normal italic text-teal">para trabajar.</em>
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
            Un punto y un arco: la persona y el puente. El sitio público lo dice en grande; el panel lo dice en
            voz baja, para que se pueda trabajar. Guía completa en <code className="rounded bg-mist px-1.5 py-0.5 text-[13px]">docs/DISENO.md</code>.
          </p>
        </div>
        <ButtonLink href="/diseno/vista/admin" iconoFinal={ArrowRight}>
          Ver el panel de ejemplo
        </ButtonLink>
      </header>

      <nav aria-label="Secciones de la galería" className="sticky top-0 z-20 -mx-4 mb-8 overflow-x-auto border-y border-line bg-paper/90 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <ul className="flex gap-1 py-2">
          {SECCIONES.map(([id, nombre]) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-flex h-8 items-center whitespace-nowrap rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:bg-ink/[0.06] hover:text-ink">
                {nombre}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-14">
        {/* COLOR */}
        <Seccion id="color" titulo="Color" nota="Seis colores de marca y sus derivados. Cada par que lleva texto está medido con la fórmula WCAG; los que no pasan, no se usan para texto.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['ink', colores.ink.DEFAULT, 'text-white', 'blanco 12.38'],
              ['teal', colores.teal.DEFAULT, 'text-white', 'blanco 7.38'],
              ['lime', colores.lime.DEFAULT, 'text-ink', 'tinta 5.67'],
              ['orange', colores.orange.DEFAULT, 'text-ink', 'tinta 4.87 · blanco ✗ 2.54'],
              ['sand', colores.sand, 'text-ink', 'tinta 9.91'],
              ['paper', colores.paper, 'text-ink', 'tinta 11.35'],
            ].map(([nombre, hex, texto, par]) => (
              <div key={nombre} className="overflow-hidden rounded-xl border border-line bg-white shadow-ap-1">
                <div className={`flex h-24 items-end p-3 font-display text-lg font-bold ${texto}`} style={{ background: hex }}>
                  Aa
                </div>
                <div className="p-3 text-[13px]">
                  <p className="font-display font-semibold">{nombre}</p>
                  <p className="font-mono text-xs text-ink-muted">{hex}</p>
                  <p className="mt-1 text-xs text-ink-muted">{par}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {[
              ['ink-muted', colores.ink.muted, '5.85 / blanco'],
              ['ink-soft', colores.ink.soft, 'blanco 10.06'],
              ['line', colores.line.DEFAULT, 'decorativo'],
              ['line-strong', colores.line.strong, '3.83 borde'],
              ['teal-tint', colores.teal.tint, 'teal 6.18'],
              ['lime-tint', colores.lime.tint, 'lima osc. 7.84'],
              ['orange-tint', colores.orange.tint, 'naranja osc. 6.14'],
              ['danger', colores.danger.DEFAULT, 'blanco 6.57'],
            ].map(([nombre, hex, par]) => (
              <div key={nombre} className="rounded-lg border border-line bg-white p-2">
                <div className="mb-2 h-10 rounded-md border border-black/5" style={{ background: hex }} />
                <p className="font-display text-xs font-semibold">{nombre}</p>
                <p className="font-mono text-[11px] text-ink-muted">{hex}</p>
                <p className="text-[11px] text-ink-muted">{par}</p>
              </div>
            ))}
          </div>
        </Seccion>

        {/* TIPOGRAFÍA */}
        <Seccion id="tipo" titulo="Tipografía" nota="Outfit para la estructura (títulos, cifras, botones), DM Sans para el texto, Instrument Serif itálica para la voz humana.">
          <Card>
            <div className="space-y-4">
              <p className="font-display text-[34px] font-bold leading-tight tracking-tight">h1 de página · 28–34 px <em className="font-serif font-normal italic text-teal">con remate</em></p>
              <p className="font-display text-base font-semibold">h2 de tarjeta · Outfit 16 semibold</p>
              <p className="text-sm">Texto de la aplicación · DM Sans 14 · Tabla, formularios, descripciones.</p>
              <p className="text-[13px] text-ink-muted">Texto secundario · 13 · ink-muted (5.85:1)</p>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Cabecera de tabla · 12 mayúsculas</p>
              <p className="font-display text-[32px] font-semibold tabular-nums">1,284 · 3,417 · 148</p>
              <p className="font-serif text-xl italic">Todavía nada por aquí. (serif: estados vacíos, citas)</p>
            </div>
          </Card>
        </Seccion>

        {/* BOTONES */}
        <Seccion id="botones" titulo="Botones" nota="Uno primario por vista. El naranja lleva SIEMPRE texto tinta. type=&quot;button&quot; por defecto.">
          <Muestra titulo="Variantes">
            <Button icono={Plus}>Primario</Button>
            <Button variante="secundario">Secundario</Button>
            <Button variante="contorno" icono={RefreshCw}>Contorno</Button>
            <Button variante="fantasma">Fantasma</Button>
            <Button variante="peligro" icono={Trash2}>Peligro</Button>
            <ButtonLink href="#botones" variante="contorno" iconoFinal={ArrowRight}>ButtonLink</ButtonLink>
          </Muestra>
          <Muestra titulo="Tamaños">
            <Button tamano="sm">Pequeño 32</Button>
            <Button tamano="md">Mediano 40</Button>
            <Button tamano="lg">Grande 48</Button>
          </Muestra>
          <Muestra titulo="Estados">
            <Button cargando>Guardando</Button>
            <Button variante="secundario" cargando textoCargando="Publicando…">Publicar</Button>
            <Button disabled>Deshabilitado</Button>
          </Muestra>
          <Muestra titulo="IconButton (etiqueta obligatoria)">
            <IconButton etiqueta="Editar" icono={Pencil} />
            <IconButton etiqueta="Descargar" icono={Download} variante="contorno" />
            <IconButton etiqueta="Ver pipeline" icono={BarChart3} variante="secundario" />
            <IconButton etiqueta="Eliminar" icono={Trash2} variante="peligro" />
            <IconButton etiqueta="Actualizando" icono={RefreshCw} cargando />
          </Muestra>
        </Seccion>

        {/* ESTADOS */}
        <Seccion id="estados" titulo="Estados" nota="StatusBadge cubre todos los estados de la aplicación con color Y texto. Con contexto, la etiqueta cambia (Activa / Activo, Pendiente / Por revisar).">
          <Muestra titulo="Tonos">
            {(['exito', 'aviso', 'info', 'peligro', 'neutro', 'destacado', 'marca'] as TonoBadge[]).map((t) => (
              <Badge key={t} tono={t}>{t}</Badge>
            ))}
            <Badge tono="info" icono={Users}>12 candidatos</Badge>
            <Badge tono="neutro" sinPunto>Sr</Badge>
          </Muestra>
          <Muestra titulo="Todos los estados (sin contexto)">
            {Object.keys(ESTADOS).map((e) => (
              <span key={e} className="inline-flex items-center gap-1.5">
                <StatusBadge estado={e} />
                <code className="text-[10px] text-ink-muted">{e}</code>
              </span>
            ))}
          </Muestra>
          <Muestra titulo="Con contexto">
            <StatusBadge estado="pending" contexto="postulacion" />
            <StatusBadge estado="pending" contexto="entrevista" />
            <StatusBadge estado="approved" contexto="solicitud" />
            <StatusBadge estado="paid" contexto="comision" />
            <StatusBadge estado="rejected" contexto="pago" />
          </Muestra>
        </Seccion>

        {/* CIFRAS */}
        <Seccion id="cifras" titulo="Cifras y tarjetas">
          <PageHeader
            migas={[{ etiqueta: 'Panel', href: '#cifras' }, { etiqueta: 'Vacantes', href: '#cifras' }, { etiqueta: 'Desarrollador Full Stack' }]}
            antetitulo="Reclutamiento"
            titulo="Desarrollador Full Stack"
            remate="en Grupo Andes"
            descripcion="PageHeader: migas opcionales, antetítulo con el punto, h1 con remate en serif, descripción y acciones."
            acciones={
              <>
                <Button variante="contorno" icono={Pencil}>Editar</Button>
                <Button icono={Users}>Asignar candidatos</Button>
              </>
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard etiqueta="Vacantes totales" valor={148} detalle="96 activas, 21 borradores" alerta="7 pausadas" icono={Briefcase} />
            <StatCard etiqueta="Candidatos" valor="1,284" detalle="En banco de talentos" icono={Users} tono="lime" />
            <StatCard etiqueta="Aplicaciones" valor="3,417" detalle="Total recibidas" icono={FileText} tono="ink" />
            <StatCard etiqueta="Solicitudes pendientes" valor={5} icono={Building2} tono="orange" enlace={{ href: '#cifras', etiqueta: 'Ver solicitudes' }} />
            <StatCard etiqueta="Cargando" valor={0} cargando icono={Inbox} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card titulo="Card con cabecera" descripcion="Título, descripción y acciones" acciones={<Button variante="contorno" tamano="sm">Acción</Button>} pie={<span className="text-[13px] text-ink-muted">Pie de tarjeta</span>}>
              <SkeletonTexto lineas={3} />
            </Card>
            <Card
              titulo="Avatar y marca"
              descripcion="La marca es la MISMA en el sitio y en el panel: la figura de logo.png (MarcaInakat). El arco y el punto (Isotipo) son un motivo, no la marca."
            >
              <div className="flex flex-wrap items-center gap-4">
                <Avatar nombre="Lucía Herrera" />
                <Avatar nombre="Tomás Rivas" tamano="lg" />
                <span className="inline-flex h-14 items-center rounded-lg bg-ink px-4">
                  <MarcaInakat />
                </span>
                <SimboloInakat className="h-10" />
                <Isotipo className="h-10 w-auto" />
                <Isotipo className="h-10 w-auto" color={colores.teal.DEFAULT} colorPunto={colores.lime.DEFAULT} />
              </div>
            </Card>
          </div>
        </Seccion>

        {/* TABLA */}
        <Seccion id="tabla" titulo="Tabla de datos" nota="Columnas declarativas, orden, fila clicable con teclado (Intro), cabecera fija desde 1024 px de ventana, columnas que se esconden según el ancho de la TABLA (md 800 · lg 960 · xl 1100), tarjetas cuando la tabla mide menos de 600 px y paginación con el total real. Achica la ventana para verlo.">
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Estado de la tabla de ejemplo">
            {(['datos', 'cargando', 'vacio'] as const).map((e) => (
              <Button key={e} tamano="sm" variante={estadoTabla === e ? 'secundario' : 'contorno'} onClick={() => setEstadoTabla(e)} aria-pressed={estadoTabla === e}>
                {e === 'datos' ? 'Con datos' : e === 'cargando' ? 'Cargando' : 'Vacía'}
              </Button>
            ))}
          </div>
          <Card titulo="Vacantes" descripcion="FilterToolbar + DataTable + Pagination dentro de una Card sin relleno" sinRelleno>
            <div className="border-b border-line px-5 py-4">
              <FilterToolbar
                busqueda={{ valor: busqueda, alCambiar: (v) => { setBusqueda(v); setPagina(1); }, etiqueta: 'Buscar vacantes', placeholder: 'Puesto o empresa' }}
                activos={[filtroEstado, busqueda].filter(Boolean).length}
                alLimpiar={() => { setFiltroEstado(''); setBusqueda(''); }}
                resumen={`${filas.length} vacantes`}
                acciones={<Button variante="contorno" tamano="sm" icono={Download}>Exportar</Button>}
              >
                <FiltroSelect etiqueta="Estado" value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}>
                  <option value="">Todos</option>
                  <option value="active">Activas</option>
                  <option value="paused">Pausadas</option>
                  <option value="draft">Borradores</option>
                  <option value="closed">Cerradas</option>
                </FiltroSelect>
              </FilterToolbar>
            </div>
            <DataTable
              etiqueta="Vacantes de ejemplo"
              columnas={columnas}
              filas={estadoTabla === 'vacio' ? [] : filas.slice((pagina - 1) * porPagina, pagina * porPagina)}
              claveFila={(v) => v.id}
              cargando={estadoTabla === 'cargando'}
              orden={orden}
              alOrdenar={(c) => setOrden((o) => ({ columna: c, direccion: o.columna === c && o.direccion === 'asc' ? 'desc' : 'asc' }))}
              alActivarFila={setSeleccion}
              filaSeleccionada={(v) => v.id === seleccion?.id}
              paginacion={paginacionLocal(estadoTabla === 'vacio' ? 0 : filas.length, pagina, porPagina)}
              alCambiarPagina={setPagina}
              etiquetaTotal="vacantes"
              vacio={
                <EmptyState
                  frase="Todavía nada por aquí."
                  titulo="No hay vacantes con estos filtros"
                  descripcion="Prueba con otro estado o borra la búsqueda."
                  accion={<Button variante="contorno" tamano="sm" onClick={() => setEstadoTabla('datos')}>Limpiar filtros</Button>}
                />
              }
            />
          </Card>
          <div className="mt-4 rounded-xl border border-line bg-white">
            <Pagination pagination={paginacionLocal(148, 4, 20)} alCambiar={() => undefined} etiqueta="candidatos" />
          </div>
        </Seccion>

        {/* FORMULARIOS */}
        <Seccion id="formularios" titulo="Formularios" nota="Etiqueta visible SIEMPRE asociada; ayuda y error enlazados con aria-describedby; el borde del campo mide 3.83:1.">
          <Card>
            <form
              className="grid gap-5 md:grid-cols-2"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                setEnviado(true);
              }}
            >
              <FormField etiqueta="Correo de contacto" requerido ayuda="Te escribiremos aquí cuando haya candidatos." error={errorCorreo}>
                <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="ana@empresa.com" />
              </FormField>
              <FormField etiqueta="Buscar" etiquetaOculta>
                <Input prefijo={<Search />} placeholder="Buscar candidatos" />
              </FormField>
              <FormField etiqueta="Especialidad">
                <Select defaultValue="">
                  <option value="" disabled>Elige una</option>
                  <option>Tecnología</option>
                  <option>Ingeniería</option>
                </Select>
              </FormField>
              <FormField etiqueta="Salario mensual" opcional ayuda="Bruto, en pesos mexicanos.">
                <Input inputMode="numeric" prefijo={<span className="text-sm">$</span>} placeholder="35,000" />
              </FormField>
              <FormField etiqueta="Descripción del puesto" className="md:col-span-2" ayuda="Qué hará la persona en su primer mes.">
                <Textarea placeholder="Describe responsabilidades y contexto" />
              </FormField>
              <FormField etiqueta="Campo deshabilitado">
                <Input disabled value="No editable" readOnly />
              </FormField>
              <div className="space-y-3">
                <Checkbox etiqueta="Vacante confidencial" descripcion="No se muestra el nombre de la empresa a los candidatos." />
                <Checkbox etiqueta="Acepto los términos" defaultChecked />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit">Validar</Button>
                <Button variante="contorno" onClick={() => { setEnviado(false); setCorreo(''); }}>Limpiar</Button>
              </div>
            </form>
          </Card>
        </Seccion>

        {/* PESTAÑAS Y PASOS */}
        <Seccion id="navegacion" titulo="Pestañas y pasos" nota="Tabs: flechas ←/→ entre pestañas. Stepper: puntos unidos por el puente; en móvil se resume en «Paso 2 de 4».">
          <Card>
            <Tabs
              idBase="demo"
              etiqueta="Secciones de ejemplo"
              activa={pestana}
              alCambiar={setPestana}
              pestanas={[
                { id: 'datos', etiqueta: 'Datos personales' },
                { id: 'experiencia', etiqueta: 'Experiencia', contador: 3 },
                { id: 'documentos', etiqueta: 'Documentos', contador: 2 },
                { id: 'bloqueada', etiqueta: 'Bloqueada', deshabilitada: true },
              ]}
            />
            <PanelPestana idBase="demo" id="datos" activa={pestana}><SkeletonTexto lineas={2} /></PanelPestana>
            <PanelPestana idBase="demo" id="experiencia" activa={pestana}><p className="text-sm">Tres experiencias registradas.</p></PanelPestana>
            <PanelPestana idBase="demo" id="documentos" activa={pestana}><p className="text-sm">CV y cédula profesional.</p></PanelPestana>
          </Card>
          <Card className="mt-4">
            <Stepper
              pasos={[
                { id: 'puesto', etiqueta: 'El puesto', descripcion: 'Título, especialidad y nivel' },
                { id: 'detalle', etiqueta: 'Detalle', descripcion: 'Responsabilidades y requisitos' },
                { id: 'condiciones', etiqueta: 'Condiciones', descripcion: 'Salario, modalidad y lugar' },
                { id: 'revision', etiqueta: 'Revisión', descripcion: 'Costo y publicación' },
              ]}
              actual={paso}
              alIrA={setPaso}
            />
            <div className="mt-6 flex justify-between">
              <Button variante="contorno" onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0}>Anterior</Button>
              <Button onClick={() => setPaso((p) => Math.min(3, p + 1))} disabled={paso === 3} iconoFinal={ArrowRight}>Siguiente</Button>
            </div>
          </Card>
        </Seccion>

        {/* CAPAS */}
        <Seccion id="capas" titulo="Modal, cajón y avisos" nota="Foco atrapado, Escape cierra, el foco vuelve al botón que abrió, scroll del fondo bloqueado. Avisos: role=alert para errores, status para lo demás.">
          <Muestra titulo="Capas">
            <Button variante="contorno" onClick={() => setModal(true)}>Abrir modal</Button>
            <Button variante="peligro" onClick={() => setModalPeligro(true)}>Confirmar borrado</Button>
            <Button variante="contorno" onClick={() => setSeleccion(VACANTES[0])}>Abrir cajón</Button>
          </Muestra>
          <Muestra titulo="Avisos">
            <Button variante="contorno" onClick={() => setToast('No se pudo guardar. Revisa tu conexión.')}>Toast de error</Button>
            <Button variante="contorno" onClick={() => avisar({ tono: 'exito', mensaje: 'Vacante publicada' })}>useAvisos · éxito</Button>
            <Button variante="contorno" onClick={() => avisar({ tono: 'info', titulo: 'Sincronizado', mensaje: 'Se actualizaron 12 precios.' })}>useAvisos · info</Button>
            <Button variante="contorno" onClick={() => avisar({ tono: 'aviso', mensaje: 'Te quedan 2 créditos.' })}>useAvisos · aviso</Button>
          </Muestra>
        </Seccion>

        {/* PIEZAS COMPARTIDAS */}
        <Seccion id="piezas" titulo="Piezas compartidas" nota="Lo que antes copiaba cada página: interruptor, menú ⋯ de fila con su confirmación, avisos en línea, el embudo en puntos y los campos de contraseña y archivo.">
          <PiezasCompartidas />
        </Seccion>

        {/* VACÍOS */}
        <Seccion id="vacios" titulo="Vacío y carga">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <EmptyState frase="Todavía nada por aquí." titulo="No hay postulaciones" descripcion="Cuando alguien se postule a esta vacante, aparecerá aquí." accion={<Button tamano="sm" icono={Plus}>Publicar otra vacante</Button>} />
            </Card>
            <Card>
              <EmptyState compacto icono={Inbox} titulo="Bandeja vacía" descripcion="Versión compacta, con icono, para dentro de tarjetas." />
              <div className="mt-4 space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <SkeletonTexto lineas={3} />
              </div>
            </Card>
          </div>
        </Seccion>

        {/* PÚBLICO */}
        <Seccion id="publico" titulo="Registro público" nota="Las primitivas de site.css (prefijo hm-). Las páginas públicas van en <main className=&quot;hm&quot;> y montan <SiteMotion />.">
          <div className="hm relative overflow-hidden rounded-2xl px-6 py-12 sm:px-10">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <span className="hm-arc hm-arc--b" />
              <span className="hm-arc hm-arc--c" />
            </div>
            <div className="relative">
              <p className="hm-eyebrow">Antetítulo con el punto</p>
              <TituloMascara
                como="p"
                className="hm-h2 mt-4"
                renglones={[{ texto: 'Titular que llena' }, { texto: 'el encuadre.', contenido: <em>el encuadre.</em> }]}
              />
              <p className="hm-lead mt-6">hm-lead: la entradilla de una sección pública, con aire y a 1.5 de interlineado.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#publico" className="hm-btn hm-btn--orange">Naranja + tinta <ArrowRight aria-hidden="true" /></a>
                <a href="#publico" className="hm-btn hm-btn--ghost">Fantasma</a>
                <a href="#publico" className="hm-btn hm-btn--ink">Tinta</a>
                <a href="#publico" className="hm-btn hm-btn--lime">Lima</a>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {['hm-suelo--tinta', 'hm-suelo--teal', 'hm-suelo--naranja'].map((s) => (
              <div key={s} className={`hm ${s} rounded-2xl p-6`}>
                <p className="hm-eyebrow">{s}</p>
                <p className="hm-h2 mt-3 !text-4xl">Suelo <em>alterno</em></p>
              </div>
            ))}
          </div>
        </Seccion>

        {/* BANCO */}
        <Seccion id="banco" titulo="Banco de pruebas" nota="Cada página REAL de la aplicación, con fetch simulado (src/app/diseno/fixtures) y el AppShell de su rol. Añade ?rol=company (u otro) para forzar el rol.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PAGINAS_BANCO.map(([grupo, rutas]) => (
              <Card key={grupo} titulo={grupo} nivelTitulo={3}>
                <ul className="space-y-1">
                  {rutas.map((r) => (
                    <li key={r}>
                      <Link href={`/diseno/vista${r}`} className="group flex items-center justify-between rounded-md px-2 py-1.5 font-mono text-[13px] text-ink hover:bg-paper">
                        {r}
                        <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </Seccion>
      </div>

      {/* Capas de la demo */}
      <Modal
        abierto={modal}
        alCerrar={() => setModal(false)}
        titulo="Editar vacante"
        descripcion="Modal con formulario: el foco entra al primer campo."
        pie={
          <>
            <Button variante="contorno" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={() => { setModal(false); avisar({ tono: 'exito', mensaje: 'Cambios guardados' }); }}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField etiqueta="Título del puesto" requerido>
            <Input defaultValue="Desarrollador Full Stack" />
          </FormField>
          <FormField etiqueta="Notas internas" opcional>
            <Textarea />
          </FormField>
        </div>
      </Modal>
      <Modal
        abierto={modalPeligro}
        alCerrar={() => setModalPeligro(false)}
        tamano="sm"
        titulo="¿Eliminar la vacante?"
        descripcion="Se borrará con sus postulaciones. Esta acción no se puede deshacer."
        pie={
          <>
            <Button variante="contorno" onClick={() => setModalPeligro(false)}>Cancelar</Button>
            <Button variante="peligro" icono={Trash2} onClick={() => setModalPeligro(false)}>Eliminar</Button>
          </>
        }
      />
      <Drawer
        abierto={seleccion !== null}
        alCerrar={() => setSeleccion(null)}
        titulo={seleccion?.title}
        descripcion={seleccion ? `${seleccion.company} · ${seleccion.location}` : undefined}
        pie={<Button variante="contorno" onClick={() => setSeleccion(null)}>Cerrar</Button>}
      >
        {seleccion && (
          <div className="space-y-4 text-sm">
            <StatusBadge estado={seleccion.status} contexto="vacante" />
            <p className="whitespace-pre-wrap">{seleccion.description}</p>
            <p className="whitespace-pre-wrap text-ink-muted">{seleccion.requirements}</p>
          </div>
        )}
      </Drawer>
      <Toast tono="error" mensaje={toast} alCerrar={() => setToast(null)} />
    </div>
  );
}

export default function DisenoPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <AvisosProvider>
        <Galeria />
      </AvisosProvider>
    </div>
  );
}

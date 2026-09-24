'use client';

/**
 * Mis postulaciones (rol usuario). Registro de aplicación (docs/DISENO.md):
 * PageHeader → tarjeta «Tus postulaciones» con las pestañas de estado y su
 * conteo → lista de postulaciones.
 *
 * Es la hermana de /candidate/applications (rol candidato) y se pinta igual:
 * mismo título, la misma tarjeta de postulación (FilaPostulacion) con los
 * mismos detalles, la misma fecha corta y el mismo aviso por estado. La única
 * diferencia es que aquí se filtra por estado: las pestañas SON los filtros de
 * antes (mismo estado `filterStatus`) y llevan el conteo de cada grupo, que
 * antes se repetía en seis tarjetas. No lleva además tarjetas de cifras: sus
 * grupos no coinciden con los de las pestañas («En proceso» cuenta cosas
 * distintas en cada sitio) y en la misma pantalla se contradecían.
 *
 * La lógica es la de siempre: GET /api/my-applications (401 → login con
 * redirect), los mismos grupos de filtro y los conteos calculados aquí.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Banknote, Briefcase, MapPin, Monitor, Search } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Tabs, { PanelPestana } from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import Button, { ButtonLink } from '@/components/ui/Button';
import { SkeletonPagina } from '@/components/ui/Skeleton';
import { getCandidateStatusView } from '@/lib/application-status';
import FilaPostulacion, {
  avisoDeEstado,
  etiquetaModalidad,
  fechaCorta
} from '../candidate/_componentes/FilaPostulacion';

/**
 * Filtros de la página agrupados como los ve el candidato. Cada filtro cubre
 * todos los estados internos que comparten etiqueta: antes 'Pendientes' sólo
 * miraba `pending` y 'Rechazados' sólo `rejected`, así que una postulación
 * `discarded`, `evaluating` o `company_interested` no aparecía en ningún filtro
 * y las tarjetas no sumaban el total.
 */
const GRUPOS_FILTRO: Record<string, string[]> = {
  pending: ['pending', 'injected_by_admin'],
  reviewing: [
    'reviewing',
    'evaluating',
    'sent_to_specialist',
    'sent_to_company',
    'company_interested'
  ],
  interviewed: ['interviewed'],
  accepted: ['accepted'],
  rejected: ['rejected', 'discarded', 'archived']
};

/** Nombre de cada filtro, alineado con las etiquetas del mapa de estados. */
const NOMBRES_FILTRO: Record<string, string> = {
  pending: 'En revisión',
  reviewing: 'En proceso',
  interviewed: 'Entrevistados',
  accepted: 'Aceptados',
  rejected: 'No seleccionados'
};

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  jobType: string;
  workMode: string;
  status: string;
  logoUrl?: string | null; // FEAT-1b: Logo de empresa
}

interface Application {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  coverLetter: string | null;
  cvUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  job: Job;
}

interface Stats {
  total: number;
  pending: number;
  reviewing: number;
  interviewed: number;
  accepted: number;
  rejected: number;
}

interface ApplicationsData {
  applications: Application[];
  stats: Stats;
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const [data, setData] = useState<ApplicationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/my-applications');

      if (response.status === 401) {
        router.push('/login?redirect=/my-applications');
        return;
      }

      if (!response.ok) {
        throw new Error('Error al cargar aplicaciones');
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
      setError('Error al cargar las aplicaciones');
    } finally {
      setLoading(false);
    }
  };

  const todasLasAplicaciones = data?.applications || [];

  const filteredApplications =
    filterStatus === 'all'
      ? todasLasAplicaciones
      : todasLasAplicaciones.filter((app) =>
          (GRUPOS_FILTRO[filterStatus] || []).includes(app.status)
        );

  // Conteos por grupo calculados aquí, con los mismos grupos que el filtro:
  // los de la API cuentan estados sueltos y dejaban fuera `discarded`,
  // `evaluating`, `company_interested`, etc., así que las tarjetas no sumaban
  // el total y el número del botón no coincidía con lo que mostraba el filtro.
  const conteos: Stats = {
    total: todasLasAplicaciones.length,
    pending: 0,
    reviewing: 0,
    interviewed: 0,
    accepted: 0,
    rejected: 0
  };
  for (const app of todasLasAplicaciones) {
    for (const [grupo, estados] of Object.entries(GRUPOS_FILTRO)) {
      if (estados.includes(app.status)) {
        conteos[grupo as Exclude<keyof Stats, 'total'>]++;
        break;
      }
    }
  }

  if (loading) {
    return <SkeletonPagina conCifras={false} />;
  }

  const cabecera = (conAcciones: boolean) => (
    <PageHeader
      antetitulo="Tu búsqueda"
      titulo="Mis postulaciones"
      descripcion="Aquí puedes ver el estado de tus postulaciones."
      acciones={
        conAcciones ? (
          <ButtonLink href="/talents" icono={Search}>
            Buscar vacantes
          </ButtonLink>
        ) : undefined
      }
    />
  );

  if (error || !data) {
    return (
      <>
        {cabecera(false)}
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-tint px-4 py-4 text-sm text-danger-dark sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 flex-none" aria-hidden="true" />
            <div>
              <p className="font-display font-semibold">Error al cargar</p>
              <p className="mt-0.5">{error || 'No se pudieron cargar tus postulaciones'}</p>
            </div>
          </div>
          <Button variante="contorno" tamano="sm" icono={Briefcase} onClick={() => router.push('/talents')}>
            Ver vacantes
          </Button>
        </div>
      </>
    );
  }

  const pestanas = [
    { id: 'all', etiqueta: 'Todas', contador: conteos.total },
    { id: 'pending', etiqueta: NOMBRES_FILTRO.pending, contador: conteos.pending },
    { id: 'reviewing', etiqueta: NOMBRES_FILTRO.reviewing, contador: conteos.reviewing },
    { id: 'interviewed', etiqueta: NOMBRES_FILTRO.interviewed, contador: conteos.interviewed },
    { id: 'accepted', etiqueta: NOMBRES_FILTRO.accepted, contador: conteos.accepted },
    { id: 'rejected', etiqueta: NOMBRES_FILTRO.rejected, contador: conteos.rejected }
  ];

  return (
    <>
      {cabecera(true)}

      <Card
        titulo="Tus postulaciones"
        descripcion={todasLasAplicaciones.length > 0 ? 'De la más reciente a la más antigua.' : undefined}
        sinRelleno
      >
        {/* Filtros: las mismas seis opciones de antes, con su conteo. */}
        <Tabs
          idBase="mis-aplicaciones"
          etiqueta="Filtrar por estado"
          pestanas={pestanas}
          activa={filterStatus}
          alCambiar={setFilterStatus}
          className="px-2 sm:px-3"
        />

        <PanelPestana idBase="mis-aplicaciones" id={filterStatus} activa={filterStatus} className="pt-0 focus-visible:outline-offset-[-2px]">
          {filteredApplications.length === 0 ? (
            <EmptyState
              frase={filterStatus === 'all' ? 'Todo empieza con una postulación.' : 'Nada en este grupo, por ahora.'}
              titulo={filterStatus === 'all' ? 'No tienes postulaciones aún' : 'No hay postulaciones en este grupo'}
              descripcion={
                filterStatus === 'all'
                  ? 'Cuando apliques a vacantes, aparecerán aquí para que puedas darles seguimiento.'
                  : `No tienes postulaciones con estado «${NOMBRES_FILTRO[filterStatus] || filterStatus}».`
              }
              accion={
                <Button variante="secundario" tamano="sm" icono={Briefcase} onClick={() => router.push('/talents')}>
                  Ver vacantes disponibles
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {filteredApplications.map((application) => {
                const vista = getCandidateStatusView(application.status);
                const fechas = [{ etiqueta: 'Aplicado', valor: fechaCorta(application.createdAt) }];
                if (application.reviewedAt) {
                  fechas.push({ etiqueta: 'Revisado', valor: fechaCorta(application.reviewedAt) });
                }
                return (
                  // Application.notes NO se pinta aquí: es la nota INTERNA que
                  // escriben admin, empresa y el inyector de candidatos
                  // ("Candidato inyectado por Admin. Fuente original: occ…",
                  // motivos de descarte). Se mostraba al candidato como "Nota de
                  // la empresa". Cuando exista un campo público (publicNote) se
                  // repone con ese.
                  // La misma tarjeta que /candidate/applications: los mismos
                  // detalles en el mismo orden y el mismo aviso por estado.
                  <FilaPostulacion
                    key={application.id}
                    titulo={application.job.title}
                    empresa={application.job.company}
                    logoUrl={application.job.logoUrl}
                    estado={application.status}
                    etiquetaEstado={vista.label}
                    colorEstado={vista.color}
                    detalles={[
                      { icono: MapPin, etiqueta: 'Ubicación', valor: application.job.location },
                      { icono: Banknote, etiqueta: 'Salario', valor: application.job.salary },
                      { icono: Briefcase, etiqueta: 'Jornada', valor: application.job.jobType },
                      { icono: Monitor, etiqueta: 'Modalidad', valor: etiquetaModalidad(application.job.workMode) }
                    ]}
                    fechas={fechas}
                    aviso={avisoDeEstado(application.status)}
                  />
                );
              })}
            </ul>
          )}
        </PanelPestana>
      </Card>
    </>
  );
}

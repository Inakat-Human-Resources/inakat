// RUTA: src/app/candidate/applications/page.tsx

'use client';

/**
 * Mis postulaciones (rol candidato). Registro de aplicación (docs/DISENO.md):
 * PageHeader → aviso de error → cifras → lista de postulaciones.
 *
 * La lógica es la de siempre: una sola llamada a /api/candidate/applications
 * (con credenciales), las mismas cuatro cifras calculadas aquí y el mismo
 * «Actualizar». Las etiquetas de estado llegan hechas de la API (mapa único de
 * src/lib/application-status.ts).
 */

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Banknote,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Monitor,
  RefreshCw,
  Search
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Button, { ButtonLink } from '@/components/ui/Button';
import { SkeletonPagina } from '@/components/ui/Skeleton';
// La tarjeta de postulación y sus formatos (fecha corta, modalidad, aviso por
// estado) son los mismos que en /my-applications: viven en FilaPostulacion.
import FilaPostulacion, { avisoDeEstado, etiquetaModalidad, fechaCorta } from '../_componentes/FilaPostulacion';

interface Application {
  id: number;
  jobId: number;
  candidateName: string;
  candidateEmail: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  createdAt: string;
  updatedAt: string;
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    salary: string;
    jobType: string;
    workMode: string;
    status: string;
    profile: string | null;
    seniority: string | null;
    logoUrl?: string | null; // FEAT-1: Logo de empresa
  };
}

interface CandidateInfo {
  id: number;
  nombre: string;
  email: string;
}

export default function CandidateApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/candidate/applications', {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setApplications(data.data);
        setCandidate(data.candidate);
      } else {
        setError(data.error || 'Error al cargar postulaciones');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  // Estadísticas
  // 'evaluating' y 'company_interested' también son estados en proceso (los ponen
  // el especialista y la empresa). Faltaban aquí, así que esas postulaciones no
  // sumaban en ninguna tarjeta y el total no cuadraba.
  const ESTADOS_EN_PROCESO = [
    'pending',
    'injected_by_admin',
    'reviewing',
    'evaluating',
    'sent_to_specialist',
    'sent_to_company',
    'company_interested'
  ];

  const stats = {
    total: applications.length,
    inProcess: applications.filter(a => ESTADOS_EN_PROCESO.includes(a.status)).length,
    interviewed: applications.filter(a => a.status === 'interviewed').length,
    accepted: applications.filter(a => a.status === 'accepted').length
  };

  if (isLoading) {
    return <SkeletonPagina />;
  }

  // Un error sin datos no es «no tienes postulaciones»: se dice que falló y se
  // ofrece reintentar, sin cifras en cero ni estado vacío engañosos.
  const sinDatosPorError = Boolean(error) && applications.length === 0;

  return (
    <>
      <PageHeader
        antetitulo="Tu búsqueda"
        titulo="Mis postulaciones"
        descripcion={
          candidate
            ? `Hola, ${candidate.nombre}. Aquí puedes ver el estado de tus postulaciones.`
            : 'Aquí puedes ver el estado de tus postulaciones.'
        }
        acciones={
          <>
            <Button variante="contorno" icono={RefreshCw} onClick={fetchApplications}>
              Actualizar
            </Button>
            <ButtonLink href="/talents" icono={Search}>
              Buscar vacantes
            </ButtonLink>
          </>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-6 flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <AlertCircle size={18} className="flex-none" aria-hidden="true" />
            {error}
          </span>
          <Button variante="contorno" tamano="sm" icono={RefreshCw} onClick={fetchApplications}>
            Reintentar
          </Button>
        </div>
      )}

      {!sinDatosPorError && (
        <>
          {/* Cifras */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 xl:grid-cols-4">
            <StatCard etiqueta="Postulaciones" valor={stats.total} detalle="En total" icono={Briefcase} tono="ink" />
            <StatCard etiqueta="En proceso" valor={stats.inProcess} icono={Clock} tono="orange" />
            <StatCard etiqueta="Con entrevista" valor={stats.interviewed} icono={CalendarCheck} tono="teal" />
            <StatCard etiqueta="Aceptadas" valor={stats.accepted} icono={CheckCircle2} tono="lime" />
          </div>

          {/* Lista de postulaciones */}
          <Card
            titulo="Tus postulaciones"
            descripcion={applications.length > 0 ? 'De la más reciente a la más antigua.' : undefined}
            sinRelleno
          >
            {applications.length === 0 ? (
              <EmptyState
                frase="Todo empieza con una postulación."
                titulo="No tienes postulaciones aún"
                descripcion="Cuando apliques a vacantes, aparecerán aquí para que puedas darles seguimiento."
                accion={
                  <ButtonLink href="/talents" variante="secundario" tamano="sm" icono={Briefcase}>
                    Ver vacantes disponibles
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {applications.map(app => (
                  <FilaPostulacion
                    key={app.id}
                    titulo={app.job.title}
                    empresa={app.job.company}
                    logoUrl={app.job.logoUrl}
                    estado={app.status}
                    etiquetaEstado={app.statusLabel}
                    colorEstado={app.statusColor}
                    detalles={[
                      { icono: MapPin, etiqueta: 'Ubicación', valor: app.job.location },
                      { icono: Banknote, etiqueta: 'Salario', valor: app.job.salary },
                      { icono: Briefcase, etiqueta: 'Jornada', valor: app.job.jobType },
                      { icono: Monitor, etiqueta: 'Modalidad', valor: etiquetaModalidad(app.job.workMode) }
                    ]}
                    etiquetas={[app.job.profile ?? '', app.job.seniority ?? '']}
                    fechas={[{ etiqueta: 'Aplicado', valor: fechaCorta(app.createdAt) }]}
                    aviso={avisoDeEstado(app.status)}
                  />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}

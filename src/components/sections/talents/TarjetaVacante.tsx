// RUTA: src/components/sections/talents/TarjetaVacante.tsx
//
// Tarjeta de una vacante en la bolsa pública. Presentación pura: la selección
// la decide SearchPositionsSection.
//
// Teclado y lector de pantalla: el título es un h3 con un <button> dentro (se
// llega con Tab y se activa con Intro o Espacio) y la vacante que se está
// viendo lleva aria-current. El resto de la tarjeta también responde al clic:
// el ::after del botón la cubre entera (y dibuja el anillo de foco alrededor
// de toda la tarjeta). Antes la tarjeta entera era un role="button", que
// convierte a sus hijos en presentacionales: el h3 desaparecía de la lista de
// encabezados y no se podía saltar de vacante en vacante con la tecla H.

import { Banknote, MapPin } from 'lucide-react';
import CompanyLogo from '@/components/shared/CompanyLogo';
import { Badge } from '@/components/ui/Badge';
import { EtiquetaModalidad, type Job } from './vacante';
import { etiquetaTipoTrabajo } from '@/lib/tipos-trabajo';

interface TarjetaVacanteProps {
  job: Job;
  seleccionada: boolean;
  /** «Publicado hace 3 días.» o, pasado un mes, «Publicado en dic 2025.» (textoPublicada). */
  publicada: string;
  alSeleccionar: () => void;
  /** id del panel de detalle al que apunta (aria-controls). */
  idDetalle: string;
}

export default function TarjetaVacante({
  job,
  seleccionada,
  publicada,
  alSeleccionar,
  idDetalle,
}: TarjetaVacanteProps) {
  return (
    <article className="tl-tarjeta" data-seleccionada={seleccionada || undefined}>
      <CompanyLogo logoUrl={job.logoUrl} companyName={job.company} size="md" className="tl-tarjeta__logo" />

      <h3 className="tl-tarjeta__titulo">
        <button
          type="button"
          className="tl-tarjeta__boton"
          // Zona de clic estirada (::after): sin el «hundido» de globals.css.
          data-sin-hundir
          onClick={alSeleccionar}
          aria-current={seleccionada ? 'true' : undefined}
          aria-controls={idDetalle}
        >
          {job.title}
        </button>
      </h3>

      {/* DB-003: sin estrella de companyRating hasta que haya reseñas reales;
          las vacantes antiguas conservan el 5.0 del default y parecía
          reputación verificada. */}
      <p className="tl-tarjeta__empresa font-medium text-ink">{job.company}</p>

      <dl className="tl-tarjeta__datos">
        <div>
          <dt className="sr-only">Ubicación</dt>
          <dd className="text-ink-muted">
            <MapPin aria-hidden="true" />
            {job.location}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Salario</dt>
          <dd className="tl-tarjeta__salario text-ink">
            <Banknote aria-hidden="true" />
            {job.salary}
          </dd>
        </div>
      </dl>

      <div className="tl-tarjeta__pie">
        <Badge tono="neutro" sinPunto tamano="sm">
          {etiquetaTipoTrabajo(job.jobType)}
        </Badge>
        <EtiquetaModalidad workMode={job.workMode} tamano="sm" />
        {publicada && (
          <time className="tl-tarjeta__fecha text-ink-muted" dateTime={job.createdAt}>
            {publicada}
          </time>
        )}
      </div>

      {/* El estado ya lo anuncia aria-current en el botón; esto es para la vista. */}
      {seleccionada && (
        <span className="tl-tarjeta__viendo" aria-hidden="true">
          Viendo
        </span>
      )}
    </article>
  );
}

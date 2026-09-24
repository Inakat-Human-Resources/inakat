// RUTA: src/components/sections/talents/DetalleVacante.tsx
//
// Detalle legible de una vacante: cabecera con los datos clave (salario, tipo
// de trabajo, modalidad, especialidad) y el texto largo en bloques con su h3.
// Presentación pura; la acción (postularse, iniciar sesión o el aviso de rol)
// la construye SearchPositionsSection y llega en `accion`.
//
// Se pinta en dos sitios:
// - escritorio (≥ 1024 px): columna derecha fija, con su propio scroll y la
//   acción pegada al pie del panel (siempre a mano);
// - móvil y tablet: dentro de un Drawer. Allí el título lo pone el Drawer
//   (su h2 es el nombre del diálogo), así que `conTitulo` va a false, y la
//   acción va en el pie del Drawer.

import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import CompanyLogo from '@/components/shared/CompanyLogo';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { leerHabilidades, textoModalidad, type Job } from './vacante';
import { etiquetaTipoTrabajo } from '@/lib/tipos-trabajo';

interface DetalleVacanteProps {
  job: Job;
  /** «Publicado hace 3 días.» o, pasado un mes, «Publicado en dic 2025.» (textoPublicada). */
  publicada: string;
  /** Pie del panel (el botón de postularse o el aviso). */
  accion?: ReactNode;
  /** false dentro del Drawer: su cabecera ya lleva el título. */
  conTitulo?: boolean;
  id?: string;
  className?: string;
  /** El panel se desplaza por dentro: se enfoca con Tab para poder leerlo con el teclado. */
  desplazable?: boolean;
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="tl-bloque">
      <h3 className="tl-bloque__titulo">{titulo}</h3>
      {children}
    </section>
  );
}

export default function DetalleVacante({
  job,
  publicada,
  accion,
  conTitulo = true,
  id,
  className,
  desplazable = false,
}: DetalleVacanteProps) {
  const habilidades = leerHabilidades(job.habilidades);
  const modalidad = textoModalidad(job.workMode);
  const idTitulo = id ? `${id}-titulo` : undefined;

  return (
    <article
      id={id}
      className={cn('tl-detalle', className)}
      aria-labelledby={conTitulo ? idTitulo : undefined}
      tabIndex={desplazable ? 0 : undefined}
    >
      <header className="tl-detalle__cabeza border-b border-line">
        {publicada && (
          <p className="text-[13px] text-ink-muted">
            <time dateTime={job.createdAt}>{publicada}</time>
          </p>
        )}

        <div className="mt-3 flex items-start gap-4">
          <CompanyLogo logoUrl={job.logoUrl} companyName={job.company} size="lg" />
          <div className="min-w-0 flex-1">
            {conTitulo && (
              <h2 id={idTitulo} className="tl-detalle__titulo">
                {job.title}
              </h2>
            )}
            <p className={cn('font-display font-semibold text-ink', conTitulo && 'mt-2')}>{job.company}</p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-muted">
              <MapPin className="h-4 w-4 flex-none text-teal" aria-hidden="true" />
              {job.location}
            </p>
          </div>
        </div>

        <dl className="tl-hechos border border-line bg-line">
          <div className="tl-hechos__dato bg-paper">
            <dt className="text-ink-muted">Salario</dt>
            <dd className="tl-hechos__valor tabular-nums">{job.salary}</dd>
          </div>
          <div className="tl-hechos__dato bg-paper">
            <dt className="text-ink-muted">Tipo de trabajo</dt>
            <dd className="tl-hechos__valor">{etiquetaTipoTrabajo(job.jobType)}</dd>
          </div>
          {modalidad && (
            <div className="tl-hechos__dato bg-paper">
              <dt className="text-ink-muted">Modalidad</dt>
              <dd className="tl-hechos__valor">{modalidad}</dd>
            </div>
          )}
        </dl>

        {/* Especialidad, nivel y estudios: la misma condición de siempre. */}
        {(job.profile || job.seniority || job.educationLevel) && (
          <ul className="tl-detalle__chips" aria-label="Perfil del puesto">
            {job.profile && (
              <li>
                <Badge tono="info" sinPunto>
                  {job.profile}
                </Badge>
              </li>
            )}
            {job.subcategory && (
              <li>
                <Badge tono="neutro" sinPunto>
                  {job.subcategory}
                </Badge>
              </li>
            )}
            {job.seniority && (
              <li>
                <Badge tono="neutro" sinPunto>
                  Nivel {job.seniority}
                </Badge>
              </li>
            )}
            {job.educationLevel && job.educationLevel !== 'Sin requisito' && (
              <li>
                <Badge tono="neutro" sinPunto>
                  {job.educationLevel}
                </Badge>
              </li>
            )}
          </ul>
        )}
      </header>

      <div className="tl-detalle__cuerpo">
        <Bloque titulo="Descripción del puesto">
          <p className="tl-bloque__texto">{job.description}</p>
        </Bloque>

        {job.requirements && (
          <Bloque titulo="Requisitos">
            <p className="tl-bloque__texto">{job.requirements}</p>
          </Bloque>
        )}

        {habilidades.length > 0 && (
          <Bloque titulo="Habilidades requeridas">
            <ul className="tl-habilidades">
              {habilidades.map((skill, i) => (
                <li key={i} className="bg-lime-tint text-lime-dark">
                  {skill}
                </li>
              ))}
            </ul>
          </Bloque>
        )}

        {job.responsabilidades && (
          <Bloque titulo="Responsabilidades">
            <p className="tl-bloque__texto">{job.responsabilidades}</p>
          </Bloque>
        )}

        {job.resultadosEsperados && (
          <Bloque titulo="Resultados esperados (3-6 meses)">
            <p className="tl-bloque__texto">{job.resultadosEsperados}</p>
          </Bloque>
        )}

        {job.valoresActitudes && (
          <Bloque titulo="Valores y actitudes">
            <p className="tl-bloque__texto">{job.valoresActitudes}</p>
          </Bloque>
        )}

        {job.informacionAdicional && (
          <Bloque titulo="Información adicional">
            <p className="tl-bloque__texto">{job.informacionAdicional}</p>
          </Bloque>
        )}
      </div>

      {accion && <footer className="tl-detalle__accion border-t border-line">{accion}</footer>}
    </article>
  );
}

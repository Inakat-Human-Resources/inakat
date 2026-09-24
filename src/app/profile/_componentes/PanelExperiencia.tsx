// RUTA: src/app/profile/_componentes/PanelExperiencia.tsx
//
// Pestaña «Experiencia» de /profile. Sólo presentación: abrir el modal, editar
// y borrar son las funciones de la página (el borrado, tras su confirmación).
// Cada alta o cambio se guarda al momento (POST/PUT /api/profile/experience).

import { Briefcase, Building, Calendar, Loader2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import EmptyState from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import Trayectoria from './Trayectoria';

export interface ExperienciaPerfil {
  id: number;
  empresa: string;
  puesto: string;
  ubicacion?: string;
  fechaInicio: string;
  fechaFin?: string;
  esActual: boolean;
  descripcion?: string;
}

export interface PanelExperienciaProps {
  experiencias: ExperienciaPerfil[];
  /** La lista se está recargando (sin desmontar nada, #PERF-010). */
  actualizando: boolean;
  /** El formato de fecha de la página (en UTC, #PERF-011). */
  formatearFecha: (iso: string) => string;
  alAgregar: () => void;
  alEditar: (exp: ExperienciaPerfil) => void;
  alEliminar: (exp: ExperienciaPerfil) => void;
}

export default function PanelExperiencia({
  experiencias,
  actualizando,
  formatearFecha,
  alAgregar,
  alEditar,
  alEliminar,
}: PanelExperienciaProps) {
  return (
    <Card
      id="perfil-experiencia"
      titulo={
        <span className="inline-flex items-center gap-2">
          Experiencia laboral
          {actualizando && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-ink-muted" aria-hidden="true" />
              <span className="sr-only" role="status">
                Actualizando…
              </span>
            </>
          )}
        </span>
      }
      descripcion="Cada cambio se guarda al momento."
      acciones={
        <Button variante="secundario" tamano="sm" icono={Plus} onClick={alAgregar}>
          Agregar experiencia
        </Button>
      }
      className="scroll-mt-32"
    >
      {experiencias.length === 0 ? (
        <EmptyState
          compacto
          icono={Briefcase}
          titulo="No has agregado experiencias laborales"
          descripcion="Agrega tus empleos anteriores para mejorar tu perfil"
        />
      ) : (
        <Trayectoria
          etiqueta="Experiencia laboral"
          entradas={experiencias.map((exp) => ({
            id: exp.id,
            titulo: exp.puesto,
            actual: exp.esActual,
            subtitulo: (
              <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Building size={14} className="flex-none" aria-hidden="true" />
                <span className="font-medium text-ink">{exp.empresa}</span>
                {exp.ubicacion && (
                  <>
                    <span aria-hidden="true">·</span>
                    <MapPin size={14} className="flex-none" aria-hidden="true" />
                    <span>{exp.ubicacion}</span>
                  </>
                )}
              </span>
            ),
            meta: (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} className="flex-none" aria-hidden="true" />
                  {formatearFecha(exp.fechaInicio)} –{' '}
                  {exp.esActual ? 'Presente' : exp.fechaFin ? formatearFecha(exp.fechaFin) : 'N/A'}
                </span>
                {exp.esActual && (
                  <Badge tono="exito" tamano="sm">
                    Actual
                  </Badge>
                )}
              </>
            ),
            descripcion: exp.descripcion,
            acciones: (
              <>
                <IconButton
                  etiqueta={`Editar experiencia: ${exp.puesto} en ${exp.empresa}`}
                  title="Editar"
                  icono={Pencil}
                  tamano="sm"
                  onClick={() => alEditar(exp)}
                />
                <IconButton
                  etiqueta={`Eliminar experiencia: ${exp.puesto} en ${exp.empresa}`}
                  title="Eliminar"
                  icono={Trash2}
                  tamano="sm"
                  variante="peligro"
                  onClick={() => alEliminar(exp)}
                />
              </>
            ),
          }))}
        />
      )}
    </Card>
  );
}

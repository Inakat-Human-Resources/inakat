// RUTA: src/app/profile/_componentes/PanelEducacion.tsx
//
// Pestaña «Educación» de /profile. Sólo presentación. OJO: la educación se
// edita en local y se guarda con «Guardar cambios» (va dentro del PUT
// /api/profile); por eso la tarjeta lo dice.

import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import EmptyState from '@/components/ui/EmptyState';
import { Badge, type TonoBadge } from '@/components/ui/Badge';
import Trayectoria from './Trayectoria';

export interface EducacionPerfil {
  id: number;
  nivel: string;
  institucion: string;
  carrera: string;
  añoInicio?: number | null;
  añoFin?: number | null;
  estatus: string;
}

/**
 * Tono del estatus, con los dos vocabularios (#PERF-012): el del registro
 * (Cursando/Terminado/Titulado/Trunco) y el antiguo (Completa/En curso/Trunca).
 * Siempre con su texto al lado.
 */
const TONO_ESTATUS_EDUCACION: Record<string, TonoBadge> = {
  Titulado: 'exito',
  Completa: 'exito',
  Terminado: 'info',
  Cursando: 'aviso',
  'En curso': 'aviso',
  Trunco: 'neutro',
  Trunca: 'neutro',
};

export interface PanelEducacionProps {
  entradas: EducacionPerfil[];
  /** ¿El estatus significa «sin terminar»? (la regla de la página). */
  esEnCurso: (estatus: string) => boolean;
  alAgregar: () => void;
  alEditar: (edu: EducacionPerfil) => void;
  alEliminar: (edu: EducacionPerfil) => void;
}

export default function PanelEducacion({ entradas, esEnCurso, alAgregar, alEditar, alEliminar }: PanelEducacionProps) {
  return (
    <Card
      id="perfil-educacion"
      titulo="Educación"
      descripcion="Los cambios se aplican al pulsar «Guardar cambios»."
      acciones={
        <Button variante="secundario" tamano="sm" icono={Plus} onClick={alAgregar}>
          Agregar educación
        </Button>
      }
      className="scroll-mt-32"
    >
      {entradas.length === 0 ? (
        <EmptyState
          compacto
          icono={GraduationCap}
          titulo="No has agregado información de educación"
          descripcion="Agrega tu formación académica para mejorar tu perfil"
        />
      ) : (
        <Trayectoria
          etiqueta="Educación"
          entradas={entradas.map((edu) => ({
            id: edu.id,
            titulo: edu.carrera || edu.nivel,
            actual: esEnCurso(edu.estatus),
            subtitulo: edu.institucion,
            meta: (
              <>
                {edu.nivel && (
                  <Badge tono="neutro" sinPunto tamano="sm">
                    {edu.nivel}
                  </Badge>
                )}
                {edu.estatus && (
                  <Badge tono={TONO_ESTATUS_EDUCACION[edu.estatus] ?? 'neutro'} tamano="sm">
                    {edu.estatus}
                  </Badge>
                )}
                {(edu.añoInicio || edu.añoFin) && (
                  <span className="tabular-nums">
                    {edu.añoInicio || '?'} – {edu.añoFin || 'Presente'}
                  </span>
                )}
              </>
            ),
            acciones: (
              <>
                <IconButton
                  etiqueta={`Editar educación: ${edu.carrera || edu.nivel}`}
                  title="Editar"
                  icono={Pencil}
                  tamano="sm"
                  onClick={() => alEditar(edu)}
                />
                <IconButton
                  etiqueta={`Eliminar educación: ${edu.carrera || edu.nivel}`}
                  title="Eliminar"
                  icono={Trash2}
                  tamano="sm"
                  variante="peligro"
                  onClick={() => alEliminar(edu)}
                />
              </>
            ),
          }))}
        />
      )}
    </Card>
  );
}

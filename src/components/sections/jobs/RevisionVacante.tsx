// RUTA: src/components/sections/jobs/RevisionVacante.tsx
//
// Resumen de lectura del último paso de «Publicar vacante» (docs/DISENO.md §6:
// «el paso final repite un resumen de lo capturado»). No edita nada: cada
// bloque tiene «Editar», que vuelve a su paso.

import { Pencil } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/** Lo que se muestra de la vacante (los mismos campos del formulario). */
export interface DatosRevision {
  title: string;
  company: string;
  location: string;
  salaryMin: string;
  salaryMax: string;
  jobType: string;
  description: string;
  requirements: string;
  profile: string;
  subcategory: string;
  seniority: string;
  educationLevel: string;
  habilidades: string[];
  responsabilidades: string;
  resultadosEsperados: string;
  valoresActitudes: string;
  informacionAdicional: string;
  notasInternas: string;
  isConfidential: boolean;
}

export interface RevisionVacanteProps {
  datos: DatosRevision;
  /** Tipo de trabajo como se lee («Tiempo completo»), no como se guarda. */
  tipoTrabajo: string;
  /** Modalidad ya traducida («Presencial»). */
  modalidad: string;
  /** ¿Se eligió un punto exacto en el mapa? */
  conPunto: boolean;
  /** Vuelve al paso indicado (índice del Stepper). */
  alEditar: (paso: number) => void;
}

const pesos = (valor: string) => {
  const n = parseInt(valor);
  return Number.isFinite(n) ? `$${n.toLocaleString('es-MX')}` : null;
};

export default function RevisionVacante({ datos, tipoTrabajo, modalidad, conPunto, alEditar }: RevisionVacanteProps) {
  const min = pesos(datos.salaryMin);
  const max = pesos(datos.salaryMax);
  const salario = min && max ? `${min} – ${max} MXN al mes` : null;

  const bloques: Array<{ titulo: string; paso: number | null; filas: Array<[string, string | null]> }> = [
    {
      titulo: 'Puesto',
      paso: 0,
      filas: [
        ['Título', datos.title],
        ['Empresa', datos.company],
        ['Tipo de trabajo', tipoTrabajo],
        ['Modalidad', modalidad],
        [
          'Ubicación',
          datos.location ? `${datos.location}${conPunto ? ' (con punto en el mapa)' : ' (sin punto en el mapa)'}` : null,
        ],
      ],
    },
    {
      titulo: 'Perfil y sueldo',
      paso: 1,
      filas: [
        ['Especialidad', datos.profile],
        ['Sub-especialidad', datos.subcategory],
        ['Nivel de experiencia', datos.seniority],
        ['Nivel de estudios', datos.educationLevel],
        ['Salario mensual', salario],
      ],
    },
    {
      titulo: 'Descripción',
      paso: 2,
      filas: [
        ['Descripción', datos.description],
        ['Requisitos', datos.requirements],
        // En una sola línea: cada habilidad ya se ve como etiqueta en su paso.
        ['Habilidades', datos.habilidades.length > 0 ? datos.habilidades.join(', ') : null],
        ['Responsabilidades', datos.responsabilidades],
        ['Resultados esperados', datos.resultadosEsperados],
        ['Valores y actitudes', datos.valoresActitudes],
        ['Información adicional', datos.informacionAdicional],
      ],
    },
    {
      titulo: 'Privacidad',
      paso: null,
      filas: [
        ['Vacante confidencial', datos.isConfidential ? 'Sí' : 'No'],
        ['Información interna', datos.notasInternas],
      ],
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="font-display text-base font-semibold text-ink">Resumen de la vacante</h3>
      {bloques.map((bloque) => (
        <div key={bloque.titulo} className="rounded-lg border border-line">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-paper/60 px-4 py-2.5">
            <h4 className="font-display text-sm font-semibold text-ink">{bloque.titulo}</h4>
            {bloque.paso !== null && (
              <Button
                variante="fantasma"
                tamano="sm"
                icono={Pencil}
                onClick={() => alEditar(bloque.paso as number)}
                aria-label={`Editar ${bloque.titulo.toLowerCase()}`}
              >
                Editar
              </Button>
            )}
          </div>
          <dl className="divide-y divide-line">
            {bloque.filas.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-[13px] text-ink-muted">{etiqueta}</dt>
                <dd className={cn('min-w-0 whitespace-pre-line break-words', valor ? 'text-ink' : 'text-ink-muted')}>
                  {valor || 'Sin indicar'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

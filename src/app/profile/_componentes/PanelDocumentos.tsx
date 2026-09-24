// RUTA: src/app/profile/_componentes/PanelDocumentos.tsx
//
// Pestaña «Documentos» de /profile: el CV (vive en Candidate.cvUrl) y los
// documentos adicionales. Sólo presentación: subir, reemplazar y borrar los
// hace la página con sus funciones de siempre (los borrados, tras su Modal de
// confirmación).

import type { ChangeEvent, RefObject } from 'react';
import { ExternalLink, FileCheck2, FileImage, FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button, { clasesBoton } from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import EmptyState from '@/components/ui/EmptyState';
import { FOCO_ETIQUETA_ARCHIVO } from './estilos';

export interface DocumentoPerfil {
  id: number;
  name: string;
  fileUrl: string;
  fileType?: string;
}

export interface PanelDocumentosProps {
  /** Enlace ya normalizado al CV, o null si no hay CV. */
  hrefCv: string | null;
  subiendoCv: boolean;
  cvInputRef: RefObject<HTMLInputElement | null>;
  alCambiarCv: (e: ChangeEvent<HTMLInputElement>) => void;
  alEliminarCv: () => void;
  documentos: DocumentoPerfil[];
  alAgregarDocumento: () => void;
  alEliminarDocumento: (doc: DocumentoPerfil) => void;
  /** «4MB» */
  limiteSubida: string;
}

const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'webp'];

export default function PanelDocumentos({
  hrefCv,
  subiendoCv,
  cvInputRef,
  alCambiarCv,
  alEliminarCv,
  documentos,
  alAgregarDocumento,
  alEliminarDocumento,
  limiteSubida,
}: PanelDocumentosProps) {
  return (
    <>
      <Card
        id="perfil-cv"
        titulo="Mi currículum vitae"
        descripcion="Se guarda al momento y se usa en tus postulaciones."
        className="scroll-mt-32"
      >
        {hrefCv ? (
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-paper/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-lime-tint text-lime-dark"
                aria-hidden="true"
              >
                <FileCheck2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-sm font-semibold text-ink">CV cargado</p>
                <a
                  href={hrefCv}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded text-sm font-medium text-teal hover:text-teal-dark hover:underline"
                >
                  Ver documento <ExternalLink size={14} aria-hidden="true" />
                  <span className="sr-only"> (se abre en otra pestaña)</span>
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className={`${clasesBoton({ variante: 'contorno', tamano: 'sm' })} relative ${FOCO_ETIQUETA_ARCHIVO}`}>
                {subiendoCv ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                Reemplazar
                <span className="sr-only"> el CV</span>
                <input type="file" ref={cvInputRef} onChange={alCambiarCv} accept=".pdf,.doc,.docx" className="sr-only" />
              </label>
              <IconButton etiqueta="Eliminar CV" icono={Trash2} variante="peligro" onClick={alEliminarCv} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-line-strong/50 px-6 py-8 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mist text-teal" aria-hidden="true">
              <Upload className="h-5 w-5" />
            </span>
            <p className="text-sm text-ink">Sube tu CV para usarlo en tus postulaciones</p>
            <label className={`${clasesBoton({ variante: 'secundario' })} relative mt-4 ${FOCO_ETIQUETA_ARCHIVO}`}>
              {subiendoCv ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload aria-hidden="true" />
                  Seleccionar archivo
                </>
              )}
              <input
                type="file"
                ref={cvInputRef}
                onChange={alCambiarCv}
                accept=".pdf,.doc,.docx"
                className="sr-only"
                disabled={subiendoCv}
              />
            </label>
            <p className="mt-2 text-xs text-ink-muted">PDF, DOC, DOCX (máx. {limiteSubida})</p>
          </div>
        )}
      </Card>

      <Card
        titulo="Mis documentos"
        descripcion="Títulos, certificaciones y constancias. Se guardan al momento."
        acciones={
          <Button variante="secundario" tamano="sm" icono={Plus} onClick={alAgregarDocumento}>
            Agregar documento
          </Button>
        }
      >
        {documentos.length === 0 ? (
          <EmptyState
            compacto
            icono={FileText}
            titulo="No tienes documentos adicionales"
            descripcion="Agrega títulos, certificaciones, etc."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {documentos.map((doc) => {
              // Los antiguos guardaban el MIME completo; sólo se pinta la extensión.
              const tipo = doc.fileType && !doc.fileType.includes('/') ? doc.fileType : '';
              const IconoDoc = EXTENSIONES_IMAGEN.includes(tipo.toLowerCase()) ? FileImage : FileText;
              return (
                <li key={doc.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <span
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-teal-tint text-teal"
                    aria-hidden="true"
                  >
                    <IconoDoc className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink" title={doc.name}>
                      {doc.name}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-ink-muted">
                      {tipo && <span className="font-semibold uppercase tracking-wide">{tipo}</span>}
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded font-medium text-teal hover:text-teal-dark hover:underline"
                      >
                        Ver documento
                        <ExternalLink size={12} aria-hidden="true" />
                        <span className="sr-only"> {doc.name} (se abre en otra pestaña)</span>
                      </a>
                    </p>
                  </div>
                  <IconButton
                    etiqueta={`Eliminar ${doc.name}`}
                    title="Eliminar"
                    icono={Trash2}
                    tamano="sm"
                    variante="peligro"
                    onClick={() => alEliminarDocumento(doc)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

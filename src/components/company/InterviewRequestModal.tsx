// RUTA: src/components/company/InterviewRequestModal.tsx

'use client';

/**
 * Solicitud de entrevista de la empresa (la coordina INAKAT con el candidato).
 *
 * En el Modal del sistema: role=dialog, foco atrapado, Escape cierra (con el
 * mismo reinicio que «Cancelar»), portal. El envío, sus validaciones y el
 * cuerpo de la petición son los de siempre. La rejilla de horarios es una tabla
 * de botones de alternar con nombre completo («Lunes 22 sep, 09:00») y
 * aria-pressed: antes cada celda era un «·» sin nombre para el lector.
 */

import { useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  MapPin,
  Plus,
  Send,
  Trash2,
  Video,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import FormField, { Input, Select, Textarea } from '@/components/ui/FormField';
import CandidatePhoto from '@/components/shared/CandidatePhoto';
import { cn } from '@/lib/utils';

interface Participant {
  nombre: string;
  email: string;
}

interface TimeSlot {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

interface InterviewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: number;
  candidateName: string;
  jobTitle: string;
  candidatePhoto?: string | null;
  // Los datos de la empresa se retiraron de las props: ningún llamador los
  // pasaba, así que la lista de participantes siempre arrancaba vacía igualmente.
  onSuccess: () => void;
}

// Generar los próximos 5 días laborales (Lun-Vie)
function getNextBusinessDays(count: number): { date: string; label: string; dayName: string }[] {
  const days: { date: string; label: string; dayName: string }[] = [];
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const current = new Date();
  // Empezar desde mañana
  current.setDate(current.getDate() + 1);

  while (days.length < count) {
    const dayOfWeek = current.getDay();
    // Solo lunes a viernes (1-5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // La etiqueta se calcula con métodos LOCALES, así que la fecha guardada
      // también tiene que serlo. Con `toISOString()` (UTC) en UTC-6 cualquier
      // hora a partir de las 18:00 devolvía el día siguiente: la empresa
      // marcaba «Mar 22 sep» y se guardaba 2026-09-23, que el admin interpreta
      // como fecha local y agenda un día tarde (incluso en sábado).
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        label: `${current.getDate()} ${monthNames[current.getMonth()]}`,
        dayName: dayNames[dayOfWeek],
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

const TIPOS: Array<{ valor: 'videocall' | 'presential'; etiqueta: string; detalle: string; icono: LucideIcon }> = [
  { valor: 'videocall', etiqueta: 'Videollamada', detalle: 'INAKAT comparte el enlace', icono: Video },
  { valor: 'presential', etiqueta: 'Presencial', detalle: 'En tus oficinas', icono: MapPin },
];

export default function InterviewRequestModal({
  isOpen,
  onClose,
  applicationId,
  candidateName,
  jobTitle,
  candidatePhoto,
  onSuccess
}: InterviewRequestModalProps) {
  const [type, setType] = useState<'videocall' | 'presential'>('videocall');
  const [duration, setDuration] = useState(45);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const businessDays = getNextBusinessDays(5);

  const toggleSlot = (date: string, time: string) => {
    setSelectedSlots(prev => {
      const exists = prev.some(s => s.date === date && s.time === time);
      if (exists) {
        return prev.filter(s => !(s.date === date && s.time === time));
      }
      return [...prev, { date, time }];
    });
  };

  const isSlotSelected = (date: string, time: string) => {
    return selectedSlots.some(s => s.date === date && s.time === time);
  };

  const addParticipant = () => {
    if (!newParticipantName.trim() || !newParticipantEmail.trim()) return;
    // El input type=email no valida nada porque no hay submit de formulario, y
    // el servidor rechaza la solicitud completa si un correo es inválido: mejor
    // decirlo aquí, al añadirlo, que al final con todos los horarios marcados.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newParticipantEmail.trim())) {
      setError('El correo del participante no es válido');
      return;
    }
    if (participants.length >= 10) {
      setError('Máximo 10 participantes');
      return;
    }
    setError('');
    setParticipants(prev => [...prev, { nombre: newParticipantName.trim(), email: newParticipantEmail.trim() }]);
    setNewParticipantName('');
    setNewParticipantEmail('');
    setShowAddParticipant(false);
  };

  const removeParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (selectedSlots.length === 0) {
      setError('Selecciona al menos un horario disponible');
      return;
    }

    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/company/interview-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          type,
          duration,
          participants: participants.length > 0 ? participants : null,
          availableSlots: selectedSlots,
          message: message.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Error al enviar solicitud');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setType('videocall');
    setDuration(45);
    setParticipants([]);
    setSelectedSlots([]);
    setMessage('');
    setError('');
    setShowAddParticipant(false);
    onClose();
  };

  if (!isOpen) return null;

  const etiquetaTitulo = 'block font-display text-sm font-semibold text-ink';

  return (
    <Modal
      abierto={isOpen}
      alCerrar={handleClose}
      // Hay un formulario a medias: un clic fuera no lo tira (tampoco lo hacía antes).
      cerrarAlPulsarFondo={false}
      tamano="lg"
      iconoTitulo={<Calendar className="h-5 w-5 text-teal" aria-hidden="true" />}
      titulo="Solicitar entrevista"
      descripcion="Se enviará al equipo de INAKAT, quien coordinará los horarios con el candidato."
      pie={
        <>
          <Button variante="contorno" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            icono={Send}
            onClick={handleSubmit}
            cargando={sending}
            textoCargando="Enviando…"
            disabled={selectedSlots.length === 0}
          >
            Enviar solicitud a INAKAT
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Candidato */}
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper/60 p-3">
          <CandidatePhoto fotoUrl={candidatePhoto} candidateName={candidateName} size="md" />
          <div className="min-w-0">
            <p className="truncate font-display font-semibold text-ink">{candidateName}</p>
            <p className="truncate text-sm text-ink-muted">{jobTitle}</p>
          </div>
        </div>

        {/* Tipo de entrevista: un grupo de radios con aspecto de tarjeta */}
        <fieldset>
          <legend className={cn(etiquetaTitulo, 'mb-2')}>Tipo de entrevista</legend>
          <div className="grid grid-cols-2 gap-3">
            {TIPOS.map((opcion) => {
              const Icono = opcion.icono;
              const elegido = type === opcion.valor;
              return (
                <label
                  key={opcion.valor}
                  className={cn(
                    'relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors duration-150',
                    // ring y no outline: cn (tailwind-merge 3) descarta `outline` junto a `outline-2`.
                    'focus-within:ring-2 focus-within:ring-teal focus-within:ring-offset-2',
                    elegido ? 'border-teal bg-teal-tint' : 'border-line-strong bg-white hover:bg-paper'
                  )}
                >
                  <input
                    type="radio"
                    name={`tipo-entrevista-${applicationId}`}
                    value={opcion.valor}
                    checked={elegido}
                    onChange={() => setType(opcion.valor)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      'flex h-9 w-9 flex-none items-center justify-center rounded-lg',
                      elegido ? 'bg-teal text-white' : 'bg-mist text-ink'
                    )}
                    aria-hidden="true"
                  >
                    <Icono className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{opcion.etiqueta}</span>
                    <span className="block text-xs text-ink-muted">{opcion.detalle}</span>
                  </span>
                  {elegido && <Check className="absolute right-2.5 top-2.5 h-4 w-4 text-teal" aria-hidden="true" />}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Duración */}
        <FormField etiqueta="Duración">
          <Select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))}>
            <option value={30}>30 minutos</option>
            <option value={45}>45 minutos</option>
            <option value={60}>60 minutos</option>
          </Select>
        </FormField>

        {/* Participantes */}
        <section className="[overflow:visible]" aria-labelledby={`participantes-${applicationId}`}>
          <h3 id={`participantes-${applicationId}`} className={etiquetaTitulo}>
            Participantes <span className="font-body font-normal text-ink-muted">(opcional)</span>
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-muted">Quién entrevistará de tu lado. Hasta 10 personas.</p>
          {participants.length > 0 && (
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {participants.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{p.nombre}</p>
                    <p className="truncate text-xs text-ink-muted">{p.email}</p>
                  </div>
                  <IconButton
                    etiqueta={`Quitar a ${p.nombre}`}
                    icono={Trash2}
                    variante="peligro"
                    tamano="sm"
                    onClick={() => removeParticipant(i)}
                  />
                </li>
              ))}
            </ul>
          )}
          {showAddParticipant ? (
            <div className="mt-3 space-y-3 rounded-xl border border-line bg-paper/60 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField etiqueta="Nombre del entrevistador">
                  <Input
                    type="text"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    autoComplete="name"
                  />
                </FormField>
                <FormField etiqueta="Correo del entrevistador">
                  <Input
                    type="email"
                    value={newParticipantEmail}
                    onChange={(e) => setNewParticipantEmail(e.target.value)}
                    autoComplete="email"
                  />
                </FormField>
              </div>
              <div className="flex gap-2">
                <Button
                  variante="secundario"
                  tamano="sm"
                  onClick={addParticipant}
                  disabled={!newParticipantName.trim() || !newParticipantEmail.trim()}
                >
                  Agregar
                </Button>
                <Button
                  variante="contorno"
                  tamano="sm"
                  onClick={() => {
                    setShowAddParticipant(false);
                    setNewParticipantName('');
                    setNewParticipantEmail('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button variante="fantasma" tamano="sm" icono={Plus} onClick={() => setShowAddParticipant(true)} className="mt-2 -ml-2 text-teal">
              Añadir participante
            </Button>
          )}
        </section>

        {/* Selector de horarios */}
        <section className="[overflow:visible]" aria-labelledby={`horarios-${applicationId}`}>
          <h3 id={`horarios-${applicationId}`} className={etiquetaTitulo}>
            Horarios disponibles
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Marca uno o varios: INAKAT confirmará con el candidato el que mejor le funcione.
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[19rem] border-separate border-spacing-1">
              <caption className="sr-only">Horarios de los próximos cinco días hábiles</caption>
              <thead>
                <tr>
                  <td className="w-11" />
                  {businessDays.map((day) => (
                    <th key={day.date} scope="col" className="pb-1 text-center font-normal">
                      <span className="block font-display text-xs font-semibold text-ink">{day.dayName.substring(0, 3)}</span>
                      <span className="block text-[11px] tabular-nums text-ink-muted">{day.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((time) => (
                  <tr key={time}>
                    <th scope="row" className="pr-1 text-right text-xs font-medium tabular-nums text-ink-muted">
                      {time}
                    </th>
                    {businessDays.map((day) => {
                      const selected = isSlotSelected(day.date, time);
                      return (
                        <td key={`${day.date}-${time}`} className="p-0">
                          <button
                            type="button"
                            onClick={() => toggleSlot(day.date, time)}
                            aria-pressed={selected}
                            aria-label={`${day.dayName} ${day.label}, ${time}`}
                            className={cn(
                              'flex h-8 w-full items-center justify-center rounded-md border transition-colors duration-150',
                              // Seleccionado: blanco sobre verde azulado 7.38. Libre: borde de control 3.83.
                              selected
                                ? 'border-teal bg-teal text-white'
                                : 'border-line-strong bg-white text-ink-muted hover:border-teal hover:bg-teal-tint'
                            )}
                          >
                            {selected ? (
                              <Check className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <span className="h-1 w-1 rounded-full bg-line-strong" aria-hidden="true" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-muted" aria-live="polite">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {selectedSlots.length > 0 ? (
              <span className="font-medium text-teal">
                {selectedSlots.length} horario{selectedSlots.length > 1 ? 's' : ''} seleccionado{selectedSlots.length > 1 ? 's' : ''}
              </span>
            ) : (
              'Ningún horario seleccionado todavía'
            )}
          </p>
        </section>

        {/* Mensaje opcional */}
        <FormField etiqueta="Mensaje para el reclutador" opcional>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ej: Nos gustaría conocer más sobre su experiencia en..."
            className="resize-none"
            rows={3}
          />
        </FormField>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

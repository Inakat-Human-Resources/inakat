// RUTA: src/components/company/InterviewRequestModal.tsx

'use client';

import { useState } from 'react';
import {
  X,
  Video,
  MapPin,
  Clock,
  Plus,
  Trash2,
  Loader2,
  Calendar,
  Send,
  User
} from 'lucide-react';

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
  companyName?: string;
  companyEmail?: string;
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
      const dateStr = current.toISOString().split('T')[0];
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

export default function InterviewRequestModal({
  isOpen,
  onClose,
  applicationId,
  candidateName,
  jobTitle,
  candidatePhoto,
  companyName,
  companyEmail,
  onSuccess
}: InterviewRequestModalProps) {
  const [type, setType] = useState<'videocall' | 'presential'>('videocall');
  const [duration, setDuration] = useState(45);
  const initialParticipants = companyName && companyEmail
    ? [{ nombre: companyName, email: companyEmail }]
    : [];
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
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
    setParticipants(initialParticipants);
    setSelectedSlots([]);
    setMessage('');
    setError('');
    setShowAddParticipant(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Solicitar Entrevista</h2>
              <p className="text-sm text-gray-500">{candidateName}</p>
              <p className="text-xs text-purple-600 mt-0.5">Se enviará al equipo de INAKAT, quien coordinará los horarios con el candidato.</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Info del candidato */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
              {candidatePhoto ? (
                <img src={candidatePhoto} alt={candidateName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{candidateName}</p>
              <p className="text-sm text-gray-500">{jobTitle}</p>
            </div>
          </div>

          {/* Tipo de entrevista */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de entrevista</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setType('videocall')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  type === 'videocall'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Video className="w-5 h-5" />
                <span className="font-medium text-sm">Videollamada</span>
              </button>
              <button
                type="button"
                onClick={() => setType('presential')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  type === 'presential'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <MapPin className="w-5 h-5" />
                <span className="font-medium text-sm">Presencial</span>
              </button>
            </div>
          </div>

          {/* Duración */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Duración
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value={30}>30 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={60}>60 minutos</option>
            </select>
          </div>

          {/* Participantes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Participantes
            </label>
            {participants.length > 0 && (
              <div className="space-y-2 mb-3">
                {participants.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                      <p className="text-xs text-gray-500">{p.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeParticipant(i)}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {showAddParticipant ? (
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <input
                  type="text"
                  placeholder="Nombre del entrevistador"
                  value={newParticipantName}
                  onChange={(e) => setNewParticipantName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <input
                  type="email"
                  placeholder="Email del entrevistador"
                  value={newParticipantEmail}
                  onChange={(e) => setNewParticipantEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addParticipant}
                    disabled={!newParticipantName.trim() || !newParticipantEmail.trim()}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Agregar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddParticipant(false);
                      setNewParticipantName('');
                      setNewParticipantEmail('');
                    }}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddParticipant(true)}
                className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Añadir Participante
              </button>
            )}
          </div>

          {/* Selector de horarios */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Horarios disponibles
            </label>
            <p className="text-xs text-gray-500 mb-3">(Selecciona uno o varios horarios)</p>

            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="min-w-[500px] px-4 md:px-0">
                {/* Headers de días */}
                <div className="grid grid-cols-6 gap-1 mb-2">
                  <div className="text-xs text-gray-400 font-medium p-1"></div>
                  {businessDays.map((day) => (
                    <div key={day.date} className="text-center">
                      <p className="text-xs font-semibold text-gray-700">{day.dayName.substring(0, 3)}</p>
                      <p className="text-xs text-gray-500">{day.label}</p>
                    </div>
                  ))}
                </div>

                {/* Grid de horarios */}
                {TIME_SLOTS.map((time) => (
                  <div key={time} className="grid grid-cols-6 gap-1 mb-1">
                    <div className="text-xs text-gray-500 font-medium flex items-center justify-end pr-2">
                      {time}
                    </div>
                    {businessDays.map((day) => {
                      const selected = isSlotSelected(day.date, time);
                      return (
                        <button
                          key={`${day.date}-${time}`}
                          type="button"
                          onClick={() => toggleSlot(day.date, time)}
                          className={`p-1.5 rounded text-xs font-medium transition-colors ${
                            selected
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700'
                          }`}
                        >
                          {selected ? '✓' : '·'}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {selectedSlots.length > 0 && (
              <p className="text-xs text-purple-600 font-medium mt-2">
                {selectedSlots.length} horario{selectedSlots.length > 1 ? 's' : ''} seleccionado{selectedSlots.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Mensaje opcional */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Mensaje para el reclutador (opcional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ej: Nos gustaría conocer más sobre su experiencia en..."
              className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex flex-col sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || selectedSlots.length === 0}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar solicitud a INAKAT
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

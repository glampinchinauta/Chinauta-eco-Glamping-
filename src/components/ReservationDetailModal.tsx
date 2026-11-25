import React, { useEffect, useState } from 'react';
import { X, Copy, Check, MessageCircle } from 'lucide-react';
import { readJson } from '../lib/api';
import { whatsappLink, toWhatsappNumber } from '../config/business';

// Database timestamps are UTC. Show them in Colombia time.
export function formatBogota(sqlUtc?: string): string {
  if (!sqlUtc) return '-';
  const d = new Date(sqlUtc.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return sqlUtc;
  return d.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
}

interface ReservationDetailModalProps {
  reservationId: number | null;
  code?: string;
  customerWhatsapp?: string;
  customerPhone?: string;
  onClose: () => void;
}

// Full booking for the admin: everything the guest ordered, from the same text that WhatsApp uses.
export const ReservationDetailModal: React.FC<ReservationDetailModalProps> = ({
  reservationId, code, customerWhatsapp, customerPhone, onClose,
}) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (reservationId == null) return;
    setText('');
    setError('');
    fetch(`/api/reservations/${reservationId}/summary`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await readJson(res);
          throw new Error(data.error || 'No se pudo cargar el detalle.');
        }
        return res.text();
      })
      .then(setText)
      .catch((err) => setError(err.message));
  }, [reservationId]);

  if (reservationId == null) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar. Selecciona el texto y cópialo manualmente.');
    }
  };

  const guestNumber = toWhatsappNumber(customerWhatsapp || customerPhone || '');
  const guestMessage = `Hola, le escribimos de Eco Glamping Chinauta sobre su reserva ${code || ''}.\n\n${text}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5 flex items-center justify-between">
          <h3 className="font-bold">Detalle de la reserva {code}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {error && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">{error}</div>}
          {!error && !text && <p className="text-sm text-slate-500">Cargando detalle…</p>}
          {text && (
            <pre className="whitespace-pre-wrap break-words text-xs sm:text-sm font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-4">{text}</pre>
          )}
        </div>

        {text && (
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={copy} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado' : 'Copiar detalle'}</span>
            </button>
            {guestNumber ? (
              <a
                href={whatsappLink(guestMessage, guestNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar al cliente por WhatsApp</span>
              </a>
            ) : (
              <span className="flex-1 text-center text-xs text-slate-500 py-3">Esta reserva no tiene un número de WhatsApp.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

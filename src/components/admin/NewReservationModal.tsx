import React, { useState } from 'react';
import type { Dome } from '../../types';
import { Modal, fieldClass, labelClass, addDays, bogotaToday, fmtCOP, nightsBetween } from './ui';

interface Props {
  domes: Dome[];
  staffName: string;
  onClose: () => void;
  onCreated: (code: string) => void;
}

/** Reserva hecha por el equipo (por teléfono, WhatsApp o en recepción). El valor lo calcula el servidor. */
export const NewReservationModal: React.FC<Props> = ({ domes, staffName, onClose, onCreated }) => {
  const today = bogotaToday();
  const bookable = domes.filter(d => d.status !== 'Fuera de servicio');
  const [domeId, setDomeId] = useState<number>(bookable[0]?.id ?? 0);
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dome = bookable.find(d => d.id === domeId);
  const nights = nightsBetween(checkIn, checkOut);

  const onCheckIn = (value: string) => {
    setCheckIn(value);
    if (checkOut <= value) setCheckOut(addDays(value, 1));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!consent) { setError('Confirma que el huésped aceptó los términos y es mayor de edad.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dome_id: domeId, check_in: checkIn, check_out: checkOut, guests,
          customer: { name: name.trim(), phone: phone.trim(), whatsapp: phone.trim(), email: email.trim() },
          notes: notes.trim() ? `Reserva manual: ${notes.trim()}` : 'Reserva manual',
          user_name: staffName,
          consent: { terms: true, age: true, marketing: false },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear la reserva.');
      onCreated(String(data.reservation_code || ''));
    } catch (err: any) {
      setError(err.message || 'No se pudo crear la reserva.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Nueva reserva" subtitle="Para reservas por teléfono, WhatsApp o en recepción." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="nr-dome">Domo</label>
          <select id="nr-dome" value={domeId} onChange={e => { const id = Number(e.target.value); setDomeId(id); const d = bookable.find(x => x.id === id); if (d && guests > d.capacity) setGuests(d.capacity); }} className={fieldClass}>
            {bookable.map(d => <option key={d.id} value={d.id}>{d.name} · {fmtCOP(d.price_per_night)} / noche</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="nr-in">Llegada</label>
            <input id="nr-in" type="date" required value={checkIn} onChange={e => onCheckIn(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="nr-out">Salida</label>
            <input id="nr-out" type="date" required min={addDays(checkIn, 1)} value={checkOut} onChange={e => setCheckOut(e.target.value)} className={fieldClass} />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="nr-guests">Personas{dome ? ` (máximo ${dome.capacity})` : ''}</label>
          <input id="nr-guests" type="number" min={1} max={dome?.capacity || 10} required value={guests} onChange={e => setGuests(Number(e.target.value))} className={fieldClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor="nr-name">Nombre del huésped</label>
          <input id="nr-name" required value={name} onChange={e => setName(e.target.value)} className={fieldClass} autoComplete="off" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="nr-phone">WhatsApp / teléfono</label>
            <input id="nr-phone" type="tel" inputMode="tel" required value={phone} onChange={e => setPhone(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="nr-email">Correo (opcional)</label>
            <input id="nr-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={fieldClass} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="nr-notes">Notas (opcional)</label>
          <input id="nr-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej. llega tarde, celebración…" className={fieldClass} />
        </div>

        {dome && nights > 0 && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-2xl px-4 py-3">
            {nights} {nights === 1 ? 'noche' : 'noches'} desde <strong>{fmtCOP(dome.price_per_night * nights)}</strong>. El sistema calcula el valor final (personas extra, mascotas, etc.).
          </p>
        )}

        <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 w-5 h-5 accent-emerald-600 shrink-0" />
          <span>El huésped aceptó los términos y condiciones y es mayor de 18 años.</span>
        </label>

        {error && <p role="alert" className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-12 rounded-2xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button disabled={busy} className="flex-[1.4] h-12 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 egc-press">{busy ? 'Creando…' : 'Crear reserva'}</button>
        </div>
      </form>
    </Modal>
  );
};

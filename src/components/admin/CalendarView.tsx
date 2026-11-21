import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Reservation, Dome, MaintenanceBlock } from '../../types';
import { Card, LoadingBlocks, addDays, bogotaToday, toneFor, shortDate, nightsBetween, EASE } from './ui';

const DAYS = 14;
const CANCELLED = ['Cancelada', 'No show'];
const LIGHT_BARS = ['Pendiente', 'Pendiente de pago', 'Check-out', 'Completada'];

interface Props {
  reservations: Reservation[];
  domes: Dome[];
  maintenance: MaintenanceBlock[];
  ready: boolean;
}

/** Cuadrícula de ocupación: una fila por domo y una columna por día. */
export const CalendarView: React.FC<Props> = ({ reservations, domes, maintenance, ready }) => {
  const today = bogotaToday();
  const [start, setStart] = useState(addDays(today, -1));
  if (!ready) return <LoadingBlocks />;

  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const end = addDays(start, DAYS); // primer día fuera de la ventana
  const col = (iso: string) => Math.max(0, Math.min(DAYS, nightsBetween(start, iso)));
  const first = shortDate(days[0]);
  const last = shortDate(days[DAYS - 1]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-600 font-medium first-letter:uppercase">{first} – {last}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior" className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={() => setStart(addDays(today, -1))} className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold">Hoy</button>
          <button onClick={() => setStart(addDays(start, 7))} aria-label="Semana siguiente" className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Encabezado de días */}
            <div className="grid" style={{ gridTemplateColumns: `9rem repeat(${DAYS}, minmax(0, 1fr))` }}>
              <div className="sticky left-0 z-10 bg-white p-3 text-xs font-bold text-slate-400 uppercase">Domo</div>
              {days.map(d => {
                const isToday = d === today;
                const [wd, num] = shortDate(d).split(' ');
                return (
                  <div key={d} className={`py-2 text-center border-l border-slate-100 ${isToday ? 'bg-emerald-50' : ''}`}>
                    <p className="text-[11px] uppercase text-slate-400 font-semibold">{wd}</p>
                    <p className={`text-sm font-bold ${isToday ? 'text-emerald-700' : 'text-slate-800'}`}>{num}</p>
                  </div>
                );
              })}
            </div>

            {/* Filas por domo */}
            {domes.map((dome, rowIdx) => {
              const bookings = reservations
                .filter(r => String(r.dome_id) === String(dome.id) && !CANCELLED.includes(r.status) && r.check_in < end && r.check_out > start);
              const blocks = maintenance.filter(m => String(m.dome_id) === String(dome.id) && m.start_date < end && addDays(m.end_date, 1) > start);
              return (
                <div key={dome.id} className="relative grid border-t border-slate-100" style={{ gridTemplateColumns: `9rem repeat(${DAYS}, minmax(0, 1fr))` }}>
                  <div className="sticky left-0 z-10 bg-white p-3 flex items-center gap-2 min-h-14">
                    <span className="font-semibold text-slate-900 text-sm leading-tight">{dome.name}</span>
                  </div>
                  {days.map(d => <div key={d} className={`border-l border-slate-100 ${d === today ? 'bg-emerald-50/60' : ''}`} />)}

                  {/* Barras (se dibujan encima de las celdas) */}
                  <div className="absolute inset-y-0 left-36 right-0 grid items-center py-2.5 pointer-events-none" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` }}>
                    {blocks.map(m => {
                      const s = col(m.start_date), e = col(addDays(m.end_date, 1));
                      if (e <= s) return null;
                      return (
                        <div
                          key={`m${m.id}`} title={`Mantenimiento: ${m.reason}`}
                          className="pointer-events-auto h-8 mx-0.5 rounded-lg bg-slate-200 text-slate-600 text-xs font-semibold px-2 flex items-center truncate bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(100,116,139,.15)_6px,rgba(100,116,139,.15)_12px)]"
                          style={{ gridColumn: `${s + 1} / ${e + 1}`, gridRow: 1 }}
                        >
                          Mantenimiento
                        </div>
                      );
                    })}
                    {bookings.map((r, i) => {
                      const s = col(r.check_in), e = col(r.check_out);
                      if (e <= s) return null;
                      return (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }}
                          transition={{ duration: 0.45, ease: EASE, delay: rowIdx * 0.05 + i * 0.03 }}
                          style={{ gridColumn: `${s + 1} / ${e + 1}`, gridRow: 1, transformOrigin: 'left center' }}
                          title={`${r.customer_name} · ${r.status} · ${shortDate(r.check_in)} → ${shortDate(r.check_out)}`}
                          className={`pointer-events-auto h-8 mx-0.5 rounded-lg ${toneFor(r.status).bar} ${LIGHT_BARS.includes(r.status) ? 'text-slate-900' : 'text-white'} text-xs font-semibold px-2.5 flex items-center shadow-sm`}
                        >
                          <span className="truncate">{r.customer_name}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 px-1">
        {[['Confirmada', 'bg-emerald-500'], ['Hospedado', 'bg-sky-500'], ['Por confirmar', 'bg-amber-400'], ['Ya salió', 'bg-slate-300']].map(([label, c]) => (
          <span key={label} className="inline-flex items-center gap-1.5"><span className={`w-3 h-3 rounded ${c}`} />{label}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200" />Mantenimiento</span>
      </div>
    </div>
  );
};

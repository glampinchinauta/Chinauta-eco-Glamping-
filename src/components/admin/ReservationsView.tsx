import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, MessageCircle, MoreHorizontal, CalendarSearch, Users, Moon, X, CalendarX2 } from 'lucide-react';
import type { Reservation, Dome } from '../../types';
import {
  Card, EmptyState, LoadingBlocks, SegmentedTabs, StatusBadge, toneFor,
  addDays, bogotaToday, fmtCOP, nightsBetween, shortDate, whatsappLink, EASE,
} from './ui';
import { ReservationDetailModal, formatBogota } from './ReservationDetailModal';

interface Props {
  reservations: Reservation[];
  domes: Dome[];
  ready: boolean;
  onStatus: (id: number, status: string) => void;
  onCollect: (resv: Reservation) => void;
  onNew: () => void;
}

type Tab = 'current' | 'toConfirm' | 'past' | 'cancelled';
const PENDING = ['Pendiente', 'Pendiente de pago'];
const CANCELLED = ['Cancelada', 'No show'];
const IN_HOUSE = ['Hospedado', 'Check-in'];

export const ReservationsView: React.FC<Props> = ({ reservations, domes, ready, onStatus, onCollect, onNew }) => {
  const today = bogotaToday();
  const [detailResv, setDetailResv] = useState<Reservation | null>(null);
  const [tab, setTab] = useState<Tab>('current');
  const [query, setQuery] = useState('');
  const [domeId, setDomeId] = useState('ALL');
  const [showDates, setShowDates] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [menuId, setMenuId] = useState<number | null>(null);

  const counts = useMemo(() => ({
    current: reservations.filter(r => !CANCELLED.includes(r.status) && r.check_out >= today).length,
    toConfirm: reservations.filter(r => PENDING.includes(r.status)).length,
    past: reservations.filter(r => !CANCELLED.includes(r.status) && r.check_out < today).length,
    cancelled: reservations.filter(r => CANCELLED.includes(r.status)).length,
  }), [reservations, today]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = reservations.filter(r => {
      if (tab === 'current' && (CANCELLED.includes(r.status) || r.check_out < today)) return false;
      if (tab === 'toConfirm' && !PENDING.includes(r.status)) return false;
      if (tab === 'past' && (CANCELLED.includes(r.status) || r.check_out >= today)) return false;
      if (tab === 'cancelled' && !CANCELLED.includes(r.status)) return false;
      if (domeId !== 'ALL' && String(r.dome_id) !== domeId) return false;
      if (from && r.check_out < from) return false;
      if (to && r.check_in > to) return false;
      if (q && ![r.reservation_code, r.customer_name, r.customer_phone, r.customer_email].some(v => (v || '').toLowerCase().includes(q))) return false;
      return true;
    });
    const dir = tab === 'past' || tab === 'cancelled' ? -1 : 1;
    return list.sort((a, b) => dir * a.check_in.localeCompare(b.check_in));
  }, [reservations, tab, query, domeId, from, to, today]);

  const groups = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    rows.forEach(r => map.set(r.check_in, [...(map.get(r.check_in) || []), r]));
    return [...map.entries()];
  }, [rows]);

  if (!ready) return <LoadingBlocks />;

  const dayLabel = (iso: string) => iso === today ? 'Hoy' : iso === addDays(today, 1) ? 'Mañana' : shortDate(iso);
  const hasFilters = query || domeId !== 'ALL' || from || to;

  /** La acción más probable para cada reserva, a un toque. */
  const primaryAction = (r: Reservation) => {
    if (PENDING.includes(r.status)) return { label: 'Confirmar', run: () => onStatus(r.id, 'Confirmada') };
    if (r.status === 'Confirmada' && r.check_in <= today) return { label: 'Check-in', run: () => onStatus(r.id, 'Hospedado') };
    if (IN_HOUSE.includes(r.status)) return { label: 'Check-out', run: () => onStatus(r.id, 'Check-out') };
    return null;
  };

  const cancel = (r: Reservation) => {
    setMenuId(null);
    if (window.confirm(`¿Cancelar la reserva ${r.reservation_code} de ${r.customer_name}?`)) onStatus(r.id, 'Cancelada');
  };

  return (
    <div className="space-y-5">
      <ReservationDetailModal
        reservationId={detailResv ? detailResv.id : null}
        code={detailResv?.reservation_code}
        customerWhatsapp={detailResv?.customer_whatsapp}
        customerPhone={detailResv?.customer_phone}
        onClose={() => setDetailResv(null)}
      />
      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs<Tab>
          group="res-status" value={tab} onChange={setTab}
          tabs={[
            { id: 'current', label: 'Vigentes', count: counts.current },
            { id: 'toConfirm', label: 'Por confirmar', count: counts.toConfirm },
            { id: 'past', label: 'Pasadas' },
            { id: 'cancelled', label: 'Canceladas' },
          ]}
        />
        <button onClick={onNew} className="h-11 px-5 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2 shadow-sm egc-press">
          <Plus className="w-4 h-4" /> Nueva reserva
        </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre, teléfono o código"
              className="w-full h-11 pl-10 pr-3 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            />
          </div>
          <select
            value={domeId} onChange={e => setDomeId(e.target.value)} aria-label="Filtrar por domo"
            className="h-11 px-3 rounded-2xl border border-slate-200 bg-white text-sm font-medium"
          >
            <option value="ALL">Todos los domos</option>
            {domes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button
            onClick={() => setShowDates(v => !v)} aria-expanded={showDates}
            className={`h-11 px-4 rounded-2xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${showDates || from || to ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'}`}
          >
            <CalendarSearch className="w-4 h-4" /> Fechas
          </button>
        </div>
        <AnimatePresence initial={false}>
          {showDates && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 pt-1">
                <label className="flex items-center gap-2">Desde <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-white" /></label>
                <label className="flex items-center gap-2">Hasta <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-white" /></label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {hasFilters && (
          <button
            onClick={() => { setQuery(''); setDomeId('ALL'); setFrom(''); setTo(''); }}
            className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 hover:underline"
          >
            <X className="w-4 h-4" /> Quitar filtros · {rows.length} {rows.length === 1 ? 'resultado' : 'resultados'}
          </button>
        )}
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        <Card><EmptyState icon={<CalendarX2 className="w-7 h-7" />} title="No hay reservas aquí" hint={hasFilters ? 'Prueba quitando algún filtro.' : 'Cuando lleguen reservas nuevas aparecerán en esta lista.'} /></Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, list]) => (
            <section key={date}>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2 px-1 flex items-center gap-2">
                <span className={date === today ? 'text-emerald-700' : ''}>{dayLabel(date)}</span>
                {date === today || date === addDays(today, 1) ? <span className="text-slate-400 font-medium normal-case">{shortDate(date)}</span> : null}
                <span className="text-slate-400 font-medium">· {list.length}</span>
              </h3>
              <div className="space-y-3">
                {list.map((r, i) => {
                  const primary = primaryAction(r);
                  const paidPct = r.total_amount ? Math.min(100, Math.round(((r.amount_paid || 0) / r.total_amount) * 100)) : 0;
                  const owes = (r.amount_pending || 0) > 0 && !CANCELLED.includes(r.status);
                  const wa = whatsappLink(r.customer_whatsapp || r.customer_phone, `Hola ${r.customer_name}, te escribimos de Eco Glamping Chinauta sobre tu reserva ${r.reservation_code}.`);
                  return (
                    <motion.div
                      key={r.id} layout="position"
                      className={`relative ${menuId === r.id ? 'z-30' : ''}`}
                      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: EASE, delay: Math.min(i, 8) * 0.04 }}
                    >
                      <Card className="relative hover:shadow-md transition-shadow">
                        <span className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-3xl ${toneFor(r.status).bar}`} />
                        <div className="p-4 sm:p-5 pl-5 sm:pl-6 flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-base">{r.customer_name}</h4>
                              <StatusBadge status={r.status} />
                            </div>
                            <p className="text-sm text-slate-600">
                              <span className="font-semibold text-slate-800">{r.dome_name}</span> · {shortDate(r.check_in)} → {shortDate(r.check_out)}
                            </p>
                            <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="inline-flex items-center gap-1"><Moon className="w-3.5 h-3.5" />{nightsBetween(r.check_in, r.check_out)} {nightsBetween(r.check_in, r.check_out) === 1 ? 'noche' : 'noches'}</span>
                              <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{r.guests} {r.guests === 1 ? 'persona' : 'personas'}</span>
                              <span className="font-mono">{r.reservation_code}</span>
                              <span>Reservada: {formatBogota(r.created_at)}</span>
                            </p>
                          </div>

                          {/* Pago */}
                          <div className="lg:w-48 lg:shrink-0 space-y-1.5">
                            <div className="flex items-baseline justify-between text-sm">
                              <span className="font-bold text-slate-900">{fmtCOP(r.total_amount)}</span>
                              <span className={`text-xs font-semibold ${owes ? 'text-amber-700' : 'text-emerald-700'}`}>{owes ? `Debe ${fmtCOP(r.amount_pending)}` : 'Pagado'}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${owes ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                initial={{ width: 0 }} animate={{ width: `${paidPct}%` }} transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
                              />
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-2 lg:w-80 lg:shrink-0 lg:justify-end relative">
                            {primary && (
                              <button onClick={primary.run} className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 egc-press">{primary.label}</button>
                            )}
                            {owes && (
                              <button onClick={() => onCollect(r)} className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 egc-press">Cobrar</button>
                            )}
                            <button onClick={() => setDetailResv(r)} className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 egc-press">Ver detalle</button>
                            {wa && (
                              <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${r.customer_name}`} className="w-10 h-10 rounded-xl border border-slate-200 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center egc-press">
                                <MessageCircle className="w-5 h-5" />
                              </a>
                            )}
                            <button
                              onClick={() => setMenuId(menuId === r.id ? null : r.id)} aria-label="Más opciones" aria-expanded={menuId === r.id}
                              className="w-10 h-10 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center"
                            >
                              <MoreHorizontal className="w-5 h-5" />
                            </button>
                            <AnimatePresence>
                              {menuId === r.id && (
                                <>
                                  <button aria-label="Cerrar menú" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuId(null)} />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-12 z-20 w-52 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 text-sm"
                                  >
                                    {r.status !== 'Confirmada' && <MenuItem onClick={() => { setMenuId(null); onStatus(r.id, 'Confirmada'); }}>Marcar como confirmada</MenuItem>}
                                    {!IN_HOUSE.includes(r.status) && !CANCELLED.includes(r.status) && <MenuItem onClick={() => { setMenuId(null); onStatus(r.id, 'Hospedado'); }}>Hacer check-in</MenuItem>}
                                    {r.status !== 'Check-out' && !CANCELLED.includes(r.status) && <MenuItem onClick={() => { setMenuId(null); onStatus(r.id, 'Check-out'); }}>Hacer check-out</MenuItem>}
                                    {!PENDING.includes(r.status) && <MenuItem onClick={() => { setMenuId(null); onStatus(r.id, 'Pendiente'); }}>Volver a «por confirmar»</MenuItem>}
                                    {r.status !== 'Cancelada' && <MenuItem danger onClick={() => cancel(r)}>Cancelar reserva</MenuItem>}
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{ onClick: () => void; danger?: boolean; children: React.ReactNode }> = ({ onClick, danger, children }) => (
  <button onClick={onClick} className={`w-full text-left px-3 py-2.5 rounded-xl font-medium hover:bg-slate-50 ${danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700'}`}>
    {children}
  </button>
);

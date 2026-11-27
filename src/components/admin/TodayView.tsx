import React from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { LogIn, LogOut, BedDouble, Wallet, CheckCircle2, Sparkles, MessageCircle, Users } from 'lucide-react';
import type { Reservation, Dome } from '../../types';
import {
  Card, CountUp, EmptyState, LoadingBlocks, Stagger, StaggerItem, StatusBadge,
  addDays, bogotaToday, fmtCOP, greeting, longToday, shortDate, whatsappLink, EASE,
} from './ui';
import { TripStatus, GlampingLocationCard } from './TripStatus';

interface TodayViewProps {
  firstName: string;
  reservations: Reservation[];
  domes: Dome[];
  finances: any;
  ready: boolean;
  onStatus: (id: number, status: string) => void;
  onCollect: (resv: Reservation) => void;
  notify?: (msg: string, kind?: 'error') => void;
}

const CANCELLED = ['Cancelada', 'No show'];
const PENDING = ['Pendiente', 'Pendiente de pago'];
const IN_HOUSE = ['Hospedado', 'Check-in'];

export const TodayView: React.FC<TodayViewProps> = ({ firstName, reservations, domes, finances, ready, onStatus, onCollect, notify }) => {
  if (!ready) return <LoadingBlocks />;

  const today = bogotaToday();
  const live = reservations.filter(r => !CANCELLED.includes(r.status));
  const arrivals = live.filter(r => r.check_in === today);
  const departures = live.filter(r => r.check_out === today);
  const totalDomes = domes.filter(d => d.status !== 'Fuera de servicio').length || domes.length || 1;
  const occupied = new Set(
    live.filter(r => r.check_in <= today && r.check_out > today && ['Confirmada', ...IN_HOUSE].includes(r.status)).map(r => r.dome_id),
  ).size;
  const occupancy = Math.min(100, Math.round((occupied / totalDomes) * 100));

  // Lo que necesita una acción del equipo, lo más urgente primero.
  const toConfirm = live.filter(r => PENDING.includes(r.status)).sort((a, b) => a.check_in.localeCompare(b.check_in));
  const toCollect = live
    .filter(r => (r.amount_pending || 0) > 0 && !PENDING.includes(r.status) && (IN_HOUSE.includes(r.status) || r.check_in <= addDays(today, 3)))
    .sort((a, b) => a.check_in.localeCompare(b.check_in));
  const attention = [
    ...toConfirm.map(r => ({ r, kind: 'confirm' as const })),
    ...toCollect.map(r => ({ r, kind: 'collect' as const })),
  ];

  // Ingresos de los últimos 7 días, incluyendo los días sin pagos.
  const byDay = new Map<string, number>((finances?.dailyChart || []).map((d: any) => [String(d.date).slice(0, 10), Number(d.total) || 0]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, label: shortDate(date).split(' ')[0], total: byDay.get(date) || 0 };
  });

  const kpis = [
    { label: 'Llegan hoy', value: arrivals.length, icon: LogIn, tone: 'from-emerald-500 to-teal-500', hint: arrivals.length ? 'Prepara la bienvenida' : 'Sin llegadas' },
    { label: 'Salen hoy', value: departures.length, icon: LogOut, tone: 'from-sky-500 to-cyan-500', hint: departures.length ? 'Revisa los domos' : 'Sin salidas' },
    { label: 'Domos ocupados', value: occupied, suffix: ` de ${totalDomes}`, icon: BedDouble, tone: 'from-violet-500 to-fuchsia-500', hint: `${occupancy}% de ocupación`, bar: occupancy },
    { label: 'Ingresos del mes', value: Number(finances?.monthRevenue) || 0, money: true, icon: Wallet, tone: 'from-amber-500 to-orange-500', hint: `Hoy: ${fmtCOP(finances?.todayRevenue)}` },
  ];

  return (
    <div className="space-y-6">
      {/* Saludo */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{greeting()}, {firstName}</h2>
        <p className="text-slate-500 first-letter:uppercase">{longToday()} · {attention.length === 0 ? 'todo al día' : `${attention.length} ${attention.length === 1 ? 'cosa necesita' : 'cosas necesitan'} tu atención`}</p>
      </motion.div>

      {/* Números del día */}
      <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map(k => (
          <StaggerItem key={k.label}>
            <Card className="p-4 sm:p-5 h-full hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${k.tone} text-white flex items-center justify-center shadow-sm`}>
                <k.icon className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-3">{k.label}</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                <CountUp value={k.value} format={k.money ? fmtCOP : undefined} />
                {k.suffix && <span className="text-base font-semibold text-slate-400">{k.suffix}</span>}
              </p>
              {k.bar !== undefined ? (
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" initial={{ width: 0 }} animate={{ width: `${k.bar}%` }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 }} />
                </div>
              ) : null}
              <p className="text-xs text-slate-400 mt-1.5">{k.hint}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      {/* Necesita tu atención */}
      <Card className="overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" /> Necesita tu atención
          </h3>
          {attention.length > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">{attention.length}</span>}
        </div>
        {attention.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="w-7 h-7" />} title="Todo al día" hint="No hay reservas por confirmar ni saldos por cobrar." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {attention.slice(0, 8).map(({ r, kind }, i) => (
              <motion.li
                key={`${kind}-${r.id}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.25 + i * 0.05 }}
                className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 truncate">{r.customer_name}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {r.dome_name} · {shortDate(r.check_in)} → {shortDate(r.check_out)}
                    {kind === 'collect' && <span className="text-amber-700 font-semibold"> · debe {fmtCOP(r.amount_pending)}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {whatsappLink(r.customer_whatsapp || r.customer_phone) && (
                    <a
                      href={whatsappLink(r.customer_whatsapp || r.customer_phone, `Hola ${r.customer_name}, te escribimos de Eco Glamping Chinauta sobre tu reserva ${r.reservation_code}.`)}
                      target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${r.customer_name}`}
                      className="w-10 h-10 rounded-xl border border-slate-200 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center egc-press"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </a>
                  )}
                  {kind === 'confirm' ? (
                    <button onClick={() => onStatus(r.id, 'Confirmada')} className="px-4 h-10 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 egc-press">Confirmar reserva</button>
                  ) : (
                    <button onClick={() => onCollect(r)} className="px-4 h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 egc-press">Cobrar {fmtCOP(r.amount_pending)}</button>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </Card>

      {/* Llegadas y salidas de hoy ("Voy en camino" muestra cuánto le falta a cada huésped) */}
      {arrivals.length > 0 && <GlampingLocationCard notify={notify} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <MovementCard
          title="Llegan hoy" icon={<LogIn className="w-5 h-5 text-emerald-600" />} empty="Nadie llega hoy"
          items={arrivals}
          extra={r => <TripStatus r={r} />}
          action={r => r.status === 'Confirmada' ? { label: 'Hacer check-in', run: () => onStatus(r.id, 'Hospedado') } : null}
        />
        <MovementCard
          title="Salen hoy" icon={<LogOut className="w-5 h-5 text-sky-600" />} empty="Nadie sale hoy"
          items={departures}
          action={r => IN_HOUSE.includes(r.status) ? { label: 'Hacer check-out', run: () => onStatus(r.id, 'Check-out') } : null}
        />
      </div>

      {/* Ingresos de la semana */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900">Ingresos de los últimos 7 días</h3>
            <p className="text-sm text-slate-500">{fmtCOP(week.reduce((s, d) => s + d.total, 0))} recibidos</p>
          </div>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={week} margin={{ left: -10, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="todayArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: any) => [fmtCOP(Number(v)), 'Ingresos']} labelFormatter={(_, p: any) => p?.[0]?.payload?.date ? shortDate(p[0].payload.date) : ''} />
              <Area type="monotone" dataKey="total" stroke="#059669" strokeWidth={2.5} fill="url(#todayArea)" animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

const MovementCard: React.FC<{
  title: string; icon: React.ReactNode; empty: string; items: Reservation[];
  action: (r: Reservation) => { label: string; run: () => void } | null;
  extra?: (r: Reservation) => React.ReactNode;
}> = ({ title, icon, empty, items, action, extra }) => (
  <Card className="overflow-hidden">
    <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
      <h3 className="font-bold text-slate-900 flex items-center gap-2">{icon}{title}</h3>
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{items.length}</span>
    </div>
    {items.length === 0 ? (
      <p className="px-6 py-8 text-center text-sm text-slate-400">{empty}</p>
    ) : (
      <ul className="divide-y divide-slate-100">
        {items.map(r => {
          const a = action(r);
          return (
            <li key={r.id} className="px-5 sm:px-6 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                {(r.customer_name || '?').trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 truncate">{r.customer_name}</p>
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <span className="truncate">{r.dome_name}</span>
                  <span className="inline-flex items-center gap-1 shrink-0"><Users className="w-3.5 h-3.5" />{r.guests}</span>
                </p>
                {extra?.(r)}
              </div>
              {a ? (
                <button onClick={a.run} className="px-3.5 h-9 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 egc-press shrink-0">{a.label}</button>
              ) : (
                <StatusBadge status={r.status} />
              )}
            </li>
          );
        })}
      </ul>
    )}
  </Card>
);

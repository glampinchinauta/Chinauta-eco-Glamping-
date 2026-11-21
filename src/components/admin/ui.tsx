import React, { useEffect, useRef, useState } from 'react';
import { motion, animate, useInView, type Variants } from 'framer-motion';

/** Misma curva suave que usa el sitio público (sin rebote). */
export const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- Utilidades ---------- */

export const fmtCOP = (n: number | undefined | null) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

/** Fecha de hoy (AAAA-MM-DD) en hora de Colombia, sin importar dónde esté el servidor. */
export const bogotaToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const parseDay = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

export const addDays = (iso: string, days: number) => {
  const d = parseDay(iso);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

export const nightsBetween = (a: string, b: string) =>
  Math.max(0, Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000));

/** "mar 21 nov" */
export const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).format(parseDay(iso)).replace(/[.,]/g, '').replace(/ de /g, ' ');

export const longToday = () =>
  new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

export const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', hour12: false }).format(new Date()));
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};

export const whatsappLink = (phone?: string, text?: string) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const full = digits.length === 10 ? `57${digits}` : digits;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

/* ---------- Movimiento ---------- */

/** Transición al cambiar de vista: aparece subiendo un poco. */
export const PageFade: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.35, ease: EASE }}
    className={className}
  >
    {children}
  </motion.div>
);

const staggerParent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const staggerChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** Hace aparecer a sus <StaggerItem> uno tras otro. */
export const Stagger: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <motion.div variants={staggerParent} initial="hidden" animate="show" className={className}>
    {children}
  </motion.div>
);
export const StaggerItem: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <motion.div variants={staggerChild} className={className}>
    {children}
  </motion.div>
);

/** Número que "sube" hasta su valor cuando aparece en pantalla. */
export const CountUp: React.FC<{ value: number; format?: (n: number) => string; className?: string }> = ({
  value, format = (n) => String(Math.round(n)), className,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration: 0.9, ease: EASE, onUpdate: setShown });
    return () => controls.stop();
  }, [inView, value]);
  return <span ref={ref} className={className}>{format(inView ? shown : 0)}</span>;
};

/* ---------- Piezas visuales ---------- */

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />
);

export const LoadingBlocks: React.FC = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
    </div>
    <Skeleton className="h-64" />
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; hint?: string }> = ({ icon, title, hint }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-6 text-slate-500">
    {icon && <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">{icon}</div>}
    <p className="font-semibold text-slate-800">{title}</p>
    {hint && <p className="text-sm mt-1 max-w-sm">{hint}</p>}
  </div>
);

/** Tarjeta base del panel. */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={`bg-white rounded-3xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,.04)] ${className}`} {...rest}>
    {children}
  </div>
);

/* ---------- Estados ---------- */

type Tone = { badge: string; dot: string; bar: string; label: string };
const TONES: Record<string, Tone> = {
  Pendiente: { badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500', bar: 'bg-amber-400', label: 'Por confirmar' },
  'Pendiente de pago': { badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500', bar: 'bg-amber-400', label: 'Pendiente de pago' },
  Confirmada: { badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500', label: 'Confirmada' },
  'Check-in': { badge: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500', bar: 'bg-sky-500', label: 'Hospedado' },
  Hospedado: { badge: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500', bar: 'bg-sky-500', label: 'Hospedado' },
  'Check-out': { badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-300', label: 'Terminó su estadía' },
  Completada: { badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-300', label: 'Completada' },
  Cancelada: { badge: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500', bar: 'bg-rose-300', label: 'Cancelada' },
  'No show': { badge: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500', bar: 'bg-rose-300', label: 'No llegó' },
};
export const toneFor = (status: string): Tone => TONES[status] || TONES.Completada;

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const tone = toneFor(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${tone.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
};

/** Pestañas tipo "píldora" con indicador que se desliza. `group` evita choques entre varias barras. */
export function SegmentedTabs<T extends string>({
  tabs, value, onChange, group,
}: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void; group: string }) {
  return (
    <div role="tablist" className="inline-flex max-w-full overflow-x-auto no-scrollbar gap-1 p-1 rounded-2xl bg-slate-200/60">
      {tabs.map(tab => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${active ? 'text-emerald-800' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${group}`}
                className="absolute inset-0 rounded-xl bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300/70 text-slate-700'}`}>
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Ventana emergente: se cierra con Escape o tocando el fondo. */
export const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }> = ({ title, subtitle, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        role="dialog" aria-modal="true" aria-label={title}
        initial={{ opacity: 0, y: 40, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 sm:pb-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto"
      >
        <div>
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
};

export const fieldClass = 'w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';
export const labelClass = 'block text-sm font-semibold text-slate-700 mb-1.5';

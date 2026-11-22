import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Tag, Plus, CalendarDays } from 'lucide-react';
import { Card, EmptyState, LoadingBlocks, fieldClass, labelClass, EASE } from './ui';

export interface PromoCode {
  id: number | string;
  code: string;
  percent: number;
  active: number;
}

interface Props {
  promos: PromoCode[];
  ready: boolean;
  onCreate: (code: string, percent: number) => Promise<boolean>;
  onToggle: (promo: PromoCode) => void;
}

const PERCENTS = [5, 10, 15, 20];

export const PromosView: React.FC<Props> = ({ promos, ready, onCreate, onToggle }) => {
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState(10);
  const [busy, setBusy] = useState(false);

  if (!ready) return <LoadingBlocks />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onCreate(code, percent);
    setBusy(false);
    if (ok) setCode('');
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6 flex gap-4 items-start bg-emerald-50/60 border-emerald-100">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><CalendarDays className="w-5 h-5" /></div>
        <div className="text-sm text-slate-700 space-y-1">
          <p className="font-semibold text-slate-900">Así funcionan los descuentos</p>
          <p>Toda reserva que <strong>llega de lunes a jueves</strong> tiene <strong>10% de descuento automático</strong>. Si además se usa un código, se aplica <strong>el mayor</strong> de los dos (no se suman). El descuento es solo sobre el domo, personas extra, mascotas y extras, no sobre la comida.</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-3 overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Códigos de promoción</h3>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{promos.length}</span>
          </div>
          {promos.length === 0 ? (
            <EmptyState icon={<Tag className="w-7 h-7" />} title="Todavía no hay códigos" hint="Crea el primero con el formulario." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {promos.map((p, i) => {
                const on = Number(p.active) === 1;
                return (
                  <motion.li
                    key={p.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, ease: EASE, delay: Math.min(i, 8) * 0.04 }}
                    className="px-5 sm:px-6 py-3.5 flex items-center gap-3"
                  >
                    <div className={`w-12 h-12 rounded-2xl font-bold flex items-center justify-center shrink-0 ${on ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>{p.percent}%</div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-mono font-bold tracking-wide ${on ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{p.code}</p>
                      <p className="text-xs text-slate-500">{on ? 'Activo: se puede usar' : 'Apagado: no se puede usar'}</p>
                    </div>
                    <button
                      onClick={() => onToggle(p)} role="switch" aria-checked={on} aria-label={`${on ? 'Apagar' : 'Encender'} ${p.code}`}
                      className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2 p-5 sm:p-6 h-fit">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-600" /> Crear un código</h3>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className={labelClass} htmlFor="promo-code">Código</label>
              <input id="promo-code" required value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="Ej. NAVIDAD" maxLength={20} className={`${fieldClass} font-mono uppercase`} autoComplete="off" />
            </div>
            <div>
              <span className={labelClass}>Descuento</span>
              <div className="grid grid-cols-4 gap-2">
                {PERCENTS.map(p => (
                  <button key={p} type="button" onClick={() => setPercent(p)} aria-pressed={percent === p}
                    className={`h-11 rounded-2xl border text-sm font-bold transition-colors ${percent === p ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <button disabled={busy} className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 egc-press">{busy ? 'Guardando…' : 'Crear código'}</button>
          </form>
        </Card>
      </div>
    </div>
  );
};

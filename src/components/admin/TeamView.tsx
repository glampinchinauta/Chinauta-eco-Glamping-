import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Trash2, ShieldCheck, Check, X, Mail } from 'lucide-react';
import { Card, EmptyState, LoadingBlocks, fieldClass, labelClass, EASE } from './ui';

export interface StaffMember {
  email: string;
  name: string;
  role: 'SUPERADMIN' | 'RECEPCION';
  fixed: boolean;
}

interface Props {
  staff: StaffMember[];
  ready: boolean;
  onAdd: (email: string, name: string) => Promise<boolean>;
  onRemove: (email: string) => void;
}

const CAN = [
  'Crear reservas manuales: escoger domo y fechas (el domo queda bloqueado)',
  'Aplicar códigos de promoción en esas reservas',
  'Ver, confirmar, hacer check-in y check-out',
  'Registrar pagos y ver los huéspedes',
  'Bloquear fechas por mantenimiento',
  'Ver el calendario y las finanzas (solo lectura)',
];
const CANNOT = [
  'Cambiar precios, fotos o datos de los domos',
  'Crear, cambiar o apagar códigos de promoción',
  'Cambiar el menú, la galería o la configuración',
  'Dar o quitar accesos a otras personas',
  'Ver el registro de auditoría',
];

export const TeamView: React.FC<Props> = ({ staff, ready, onAdd, onRemove }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!ready) return <LoadingBlocks />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onAdd(email, name);
    setBusy(false);
    if (ok) { setEmail(''); setName(''); }
  };

  const remove = (m: StaffMember) => {
    if (window.confirm(`¿Quitar el acceso de ${m.name || m.email}? Ya no podrá entrar al panel.`)) onRemove(m.email);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Personas con acceso */}
        <Card className="xl:col-span-3 overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Personas con acceso al panel</h3>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{staff.length}</span>
          </div>
          {staff.length === 0 ? (
            <EmptyState icon={<Mail className="w-7 h-7" />} title="Aún no hay nadie" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {staff.map((m, i) => (
                <motion.li
                  key={m.email}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, ease: EASE, delay: Math.min(i, 8) * 0.04 }}
                  className="px-5 sm:px-6 py-3.5 flex items-center gap-3"
                >
                  <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center shrink-0 ${m.role === 'SUPERADMIN' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                    {(m.name || m.email).trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{m.name || m.email}</p>
                    {m.name && <p className="text-sm text-slate-500 truncate">{m.email}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset shrink-0 ${m.role === 'SUPERADMIN' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-sky-50 text-sky-800 ring-sky-200'}`}>
                    {m.role === 'SUPERADMIN' ? 'Administrador' : 'Recepción'}
                  </span>
                  {m.fixed ? (
                    <span className="w-10 shrink-0" title="Se cambia desde Vercel" />
                  ) : (
                    <button onClick={() => remove(m)} aria-label={`Quitar acceso a ${m.email}`} className="w-10 h-10 rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.li>
              ))}
            </ul>
          )}
        </Card>

        {/* Agregar */}
        <Card className="xl:col-span-2 p-5 sm:p-6 h-fit">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><UserPlus className="w-5 h-5 text-emerald-600" /> Dar acceso a recepción</h3>
          <p className="text-sm text-slate-500 mt-1">La persona entrará con su correo y una contraseña que ella misma crea, o con su cuenta de Google.</p>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div>
              <label className={labelClass} htmlFor="staff-name">Nombre</label>
              <input id="staff-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Ana Pérez" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="staff-email">Correo</label>
              <input id="staff-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="persona@gmail.com" className={fieldClass} />
            </div>
            <button disabled={busy} className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 egc-press">
              {busy ? 'Guardando…' : 'Dar acceso'}
            </button>
          </form>
        </Card>
      </div>

      {/* Qué puede hacer recepción */}
      <Card className="p-5 sm:p-6">
        <h3 className="font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Qué puede hacer recepción</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <ul className="space-y-2">
            {CAN.map(t => <li key={t} className="flex gap-2.5 text-sm text-slate-700"><Check className="w-5 h-5 text-emerald-600 shrink-0" />{t}</li>)}
          </ul>
          <ul className="space-y-2">
            {CANNOT.map(t => <li key={t} className="flex gap-2.5 text-sm text-slate-700"><X className="w-5 h-5 text-rose-500 shrink-0" />{t}</li>)}
          </ul>
        </div>
        <p className="text-xs text-slate-400 mt-4">Todo lo que haga cada persona queda anotado en la pestaña Auditoría.</p>
      </Card>
    </div>
  );
};

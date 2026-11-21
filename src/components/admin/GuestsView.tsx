import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MessageCircle, Mail, Star, UserRound } from 'lucide-react';
import type { Customer } from '../../types';
import { Card, EmptyState, LoadingBlocks, fmtCOP, whatsappLink, EASE } from './ui';

const AVATARS = ['bg-emerald-100 text-emerald-800', 'bg-sky-100 text-sky-800', 'bg-violet-100 text-violet-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-teal-100 text-teal-800'];

export const GuestsView: React.FC<{ customers: Customer[]; ready: boolean }> = ({ customers, ready }) => {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter(c => !q || [c.name, c.phone, c.whatsapp, c.email].some(v => (v || '').toLowerCase().includes(q)));
  }, [customers, query]);

  if (!ready) return <LoadingBlocks />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-slate-600"><span className="font-bold text-slate-900">{customers.length}</span> {customers.length === 1 ? 'huésped registrado' : 'huéspedes registrados'}</p>
        <div className="relative sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, teléfono o correo"
            className="w-full h-11 pl-10 pr-3 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          />
        </div>
      </div>

      {list.length === 0 ? (
        <Card><EmptyState icon={<UserRound className="w-7 h-7" />} title={query ? 'No encontramos a nadie con ese dato' : 'Aún no hay huéspedes'} hint={query ? undefined : 'Se registran solos cuando alguien reserva.'} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {list.map((c, i) => {
            const wa = whatsappLink(c.whatsapp || c.phone, `Hola ${c.name}, te escribimos de Eco Glamping Chinauta.`);
            const trips = c.total_reservations || 0;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: Math.min(i, 9) * 0.04 }}>
                <Card className="p-4 sm:p-5 h-full hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-2xl font-bold text-lg flex items-center justify-center shrink-0 ${AVATARS[Number(c.id) % AVATARS.length]}`}>
                      {(c.name || '?').trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                        {c.name}
                        {trips >= 2 && <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" aria-label="Huésped frecuente" />}
                      </p>
                      <p className="text-sm text-slate-500 truncate">{c.whatsapp || c.phone || 'Sin teléfono'}</p>
                      {c.email && <p className="text-xs text-slate-400 truncate">{c.email}</p>}
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="flex gap-5">
                      <div><p className="text-xl font-bold text-slate-900 leading-none">{trips}</p><p className="text-xs text-slate-500 mt-1">{trips === 1 ? 'reserva' : 'reservas'}</p></div>
                      <div><p className="text-xl font-bold text-emerald-700 leading-none">{fmtCOP(c.total_spent)}</p><p className="text-xs text-slate-500 mt-1">en total</p></div>
                    </div>
                    <div className="flex gap-2">
                      {c.email && <a href={`mailto:${c.email}`} aria-label={`Correo a ${c.name}`} className="w-10 h-10 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center egc-press"><Mail className="w-5 h-5" /></a>}
                      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${c.name}`} className="w-10 h-10 rounded-xl border border-slate-200 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center egc-press"><MessageCircle className="w-5 h-5" /></a>}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

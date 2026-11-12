import React, { useState } from 'react';
import { X, Search, Phone } from 'lucide-react';
import { Reservation } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface MyReservationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MyReservationsModal: React.FC<MyReservationsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [contactTerm, setContactTerm] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim() || !contactTerm.trim()) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ code: searchTerm.trim(), contact: contactTerm.trim() });
      const res = await fetch(`/api/reservations/lookup?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setReservations(data);
        setSearched(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="glass-card w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden bg-white my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Search className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t('my_reservations.title')}</h3>
              <p className="text-xs text-emerald-200">{t('my_reservations.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t('my_reservations.search_ph')}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-emerald-500 font-medium"
              required
            />
            <input
              type="text"
              value={contactTerm}
              onChange={e => setContactTerm(e.target.value)}
              placeholder="Correo o teléfono usado en la reserva"
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-emerald-500 font-medium"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              {loading ? t('my_reservations.searching') : t('my_reservations.search_btn')}
            </button>
          </form>

          {searched && (
            <div className="space-y-4 pt-4">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                {t('my_reservations.results_count')} ({reservations.length})
              </h4>

              {reservations.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                  {t('my_reservations.no_results')}
                </div>
              ) : (
                reservations.map(resv => (
                  <div key={resv.id} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-emerald-700 text-base">{resv.reservation_code}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          resv.status === 'Confirmada' || resv.status === 'Hospedado' ? 'bg-emerald-100 text-emerald-800' :
                          resv.status === 'Pendiente' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {resv.status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">{t('my_reservations.created_on')} {resv.created_at?.split('T')[0]}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm bg-slate-50 p-4 rounded-xl">
                      <div>
                        <p className="text-xs text-slate-500 font-medium">{t('my_reservations.dome_label')}</p>
                        <p className="font-bold text-slate-900">{resv.dome_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">{t('my_reservations.dates_label')}</p>
                        <p className="font-semibold text-slate-900">{resv.check_in} {t('my_reservations.to')} {resv.check_out}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">{t('my_reservations.total_label')}</p>
                        <p className="font-bold text-emerald-700">${resv.total_amount?.toLocaleString('es-CO')} COP</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-medium text-slate-600">{t('my_reservations.payment_status')} <strong>{resv.payment_status}</strong></span>
                      <a
                        href={`https://wa.me/573213109331?text=Hola,%20quisiera%20consultar%20sobre%20mi%20reserva%20${resv.reservation_code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{t('my_reservations.contact_whatsapp')}</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Calendar, Search, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ImageCarousel } from './ImageCarousel';
import { getDomeImages } from '../utils/domeImages';
import { useLanguage } from '../context/LanguageContext';

interface AvailabilityCheckerProps {
  onOpenBookingWithDates: (checkIn: string, checkOut: string, domeId: number) => void;
}

export const AvailabilityChecker: React.FC<AvailabilityCheckerProps> = ({ onOpenBookingWithDates }) => {
  const { t } = useLanguage();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 3);

  const toLocalYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [checkIn, setCheckIn] = useState(toLocalYMD(tomorrow));
  const [checkOut, setCheckOut] = useState(toLocalYMD(dayAfter));
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);
    if (!checkIn || !checkOut) return;
    if (checkIn >= checkOut) {
      setDateError(t('avail.date_err'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/availability?checkIn=${checkIn}&checkOut=${checkOut}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setResults(data);
        setSearched(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12"
    >
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-emerald-600 font-bold">{t('avail.tag')}</h2>
        <h3 className="text-3xl sm:text-4xl font-bold text-slate-900">{t('avail.title')}</h3>
        <p className="text-slate-600">
          {t('avail.desc')}
        </p>
      </div>

      {/* Search Form Card */}
      <div className="glass-card max-w-4xl mx-auto p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200">
        {dateError && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{dateError}</span>
          </div>
        )}
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">{t('avail.checkin')}</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-3.5 w-5 h-5 text-emerald-600" />
              <input
                type="date"
                value={checkIn}
                min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })()}
                onChange={e => setCheckIn(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium focus:outline-hidden focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">{t('avail.checkout')}</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-3.5 w-5 h-5 text-emerald-600" />
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={e => setCheckOut(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium focus:outline-hidden focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-semibold shadow-lg shadow-emerald-700/20 hover:from-emerald-700 hover:to-teal-800 transition-all flex items-center justify-center space-x-2"
            >
              <Search className="w-5 h-5" />
              <span>{loading ? t('avail.searching') : t('avail.search_btn')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Results Section */}
      {searched && (
        <div className="space-y-6 pt-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h4 className="text-xl font-bold text-slate-900">
              {t('avail.results_title')} ({checkIn} {t('my_reservations.to')} {checkOut})
            </h4>
            <span className="text-sm text-slate-500">
              {t('avail.available_count')
                .replace('{available}', String(results.filter(r => r.isAvailable).length))
                .replace('{total}', String(results.length))}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map(dome => (
              <div
                key={dome.id}
                className={`glass-card rounded-2xl p-6 border transition-all flex flex-col justify-between ${
                  dome.isAvailable ? 'border-emerald-300 shadow-lg' : 'border-slate-200 opacity-80'
                }`}
              >
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden">
                    <ImageCarousel
                      images={getDomeImages(dome)}
                      alt={dome.name}
                      className="h-48"
                      overlayBadge={
                        dome.isAvailable ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600/90 text-white flex items-center gap-1 shadow-sm">
                            {t('avail.available_tag')}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-600/90 text-white flex items-center gap-1 shadow-sm">
                            {t('avail.unavailable_tag')}
                          </span>
                        )
                      }
                    />
                  </div>

                  <div>
                    <h5 className="text-lg font-bold text-slate-900">{dome.name}</h5>
                    <p className="text-xs text-slate-500">
                      {dome.code} • {t('avail.capacity_guests').replace('{count}', String(dome.capacity))}
                    </p>
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">{dome.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="font-bold text-emerald-700 text-base">
                      ${dome.price_per_night.toLocaleString('es-CO')} <span className="text-xs text-slate-500 font-normal">{t('domes.night')}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100">
                  {dome.isAvailable ? (
                    <button
                      onClick={() => onOpenBookingWithDates(checkIn, checkOut, dome.id)}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      {t('avail.book_btn')}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 font-medium cursor-not-allowed"
                    >
                      {t('avail.unavailable_btn')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

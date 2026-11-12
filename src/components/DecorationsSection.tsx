import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const DECORATION_GROUPS = [
  {
    key: 'vip',
    title: 'Decoración VIP',
    title_en: 'VIP Decoration',
    price: '$150.000 COP',
    includes: [
      ['1 botella de vino', '1 bottle of wine'],
      ['5 snacks', '5 snacks'],
      ['2 postres', '2 desserts'],
      ['2 botellas de agua', '2 bottles of water'],
      ['Mensaje personalizado en la cama', 'Personalized message on the bed'],
      ['12 globos', '12 balloons'],
    ],
    photos: [1, 2, 3, 4, 5].map(n => `/assets/images/decoracion-vip-${n}.jpg`),
  },
  {
    key: 'basica',
    title: 'Decoración Básica',
    title_en: 'Basic Decoration',
    price: '$75.000 COP',
    includes: [
      ['12 globos', '12 balloons'],
      ['Mensaje personalizado', 'Personalized message'],
      ['Decoraciones', 'Decorations'],
    ],
    photos: [1, 2, 3, 4].map(n => `/assets/images/decoracion-basica-${n}.jpg`),
  },
];

interface DecorationsSectionProps {
  onOpenBooking?: () => void;
}

export const DecorationsSection: React.FC<DecorationsSectionProps> = ({ onOpenBooking }) => {
  const { language } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);
  const isEn = language === 'en';

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-16 space-y-12 sm:space-y-16">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
          <Sparkles className="w-4 h-4" />
          <span>{isEn ? 'Decorations' : 'Decoraciones'}</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          {isEn ? 'Make your stay special' : 'Haz tu estadía especial'}
        </h2>
      </div>

      {DECORATION_GROUPS.map(group => (
        <div key={group.key} className="space-y-6 sm:space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-xl sm:text-3xl font-extrabold text-slate-900">
              {isEn ? group.title_en : group.title}
            </h3>
            <p className="text-xl sm:text-3xl font-extrabold text-emerald-700">{group.price}</p>
            <ul className="text-sm sm:text-base text-slate-700 max-w-md mx-auto text-left space-y-1.5 pt-2">
              {group.includes.map(([es, en]) => (
                <li key={es} className="flex items-start space-x-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{isEn ? en : es}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {group.photos.map((src, idx) => (
              <button
                key={src}
                type="button"
                onClick={() => setPreview(src)}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden shadow-md bg-slate-100 cursor-zoom-in"
              >
                <img
                  src={src}
                  alt={`${isEn ? group.title_en : group.title} ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        </div>
      ))}

      {onOpenBooking && (
        <div className="text-center">
          <button
            type="button"
            onClick={onOpenBooking}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold shadow-lg shadow-emerald-700/30 hover:from-emerald-700 hover:to-teal-800 text-sm"
          >
            {isEn ? 'Book now' : 'Reservar ahora'}
          </button>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label={isEn ? 'Close' : 'Cerrar'}
          >
            <X className="w-6 h-6" />
          </button>
          <img src={preview} alt="Vista ampliada de la decoración" className="max-h-[90vh] max-w-full rounded-xl object-contain" />
        </div>
      )}
    </section>
  );
};

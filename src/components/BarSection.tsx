import React from 'react';
import { Wine } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { whatsappLink } from '../config/business';

// Bebidas y licores que se venden en el glamping (todo es consumo aparte).
// Se muestra en el inicio y en la página "Menú", justo después de la comida. El menú del sitio lleva aquí con #bar.
const DRINKS = [
  { icon: '🍺', es: 'Cerveza', en: 'Beer', es_d: 'Bien fría', en_d: 'Ice cold' },
  { icon: '🥃', es: 'Aguardiente', en: 'Aguardiente', es_d: 'El clásico colombiano', en_d: 'The Colombian classic' },
  { icon: '🥃', es: 'Ron', en: 'Rum', es_d: 'Para compartir', en_d: 'To share' },
  { icon: '🍷', es: 'Vino', en: 'Wine', es_d: 'Para una noche romántica', en_d: 'For a romantic night' },
  { icon: '🍾', es: 'Champaña', en: 'Champagne', es_d: 'Para brindar', en_d: 'For a toast' },
];

export const BarSection: React.FC = () => {
  const { language } = useLanguage();
  const en = language === 'en';
  return (
    <section id="bar" className="scroll-mt-24 bg-gradient-to-b from-amber-50 to-white py-14 sm:py-20" aria-labelledby="bar-title">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-8 sm:mb-12">
          <h2 className="text-xs uppercase tracking-widest text-amber-700 font-bold">
            {en ? 'Drinks & liquor' : 'Bebidas y licores'}
          </h2>
          <h3 id="bar-title" className="text-3xl sm:text-4xl font-bold text-slate-900">
            {en ? 'Our Glamping Bar' : 'El Bar del Glamping'}
          </h3>
          <p className="text-slate-600 text-base">
            {en
              ? 'No need to bring drinks: we sell beer and liquor for your celebration. Everything is charged separately, only what you drink.'
              : 'No necesitas traer trago: aquí vendemos cerveza y licores para tu celebración. Todo es consumo aparte: pagas solo lo que tomes.'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-5">
          {DRINKS.map((d, i) => (
            <div
              key={d.es}
              className={`bg-white rounded-2xl border border-amber-100 shadow-sm p-4 sm:p-5 text-center space-y-1.5 ${i === DRINKS.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}
            >
              <div className="text-3xl sm:text-4xl" aria-hidden="true">{d.icon}</div>
              <h4 className="font-bold text-slate-900">{en ? d.en : d.es}</h4>
              <p className="text-xs text-slate-500">{en ? d.en_d : d.es_d}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-slate-900 text-white">
          <div className="flex items-start gap-3">
            <Wine className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-200">
              {en
                ? 'Your dome also has a minibar with soft drinks, alcoholic drinks and snacks. All minibar items are charged separately.'
                : 'Tu domo además tiene frigobar con gaseosas, bebidas alcohólicas y snacks. Todo lo del frigobar es consumo aparte.'}
            </p>
          </div>
          <a
            href={whatsappLink(en
              ? 'Hello, I would like the prices of the drinks and liquor at Eco Glamping Chinauta.'
              : 'Hola, quisiera conocer los precios de las bebidas y licores de Eco Glamping Chinauta.')}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-bold"
          >
            {en ? 'Ask for prices on WhatsApp' : 'Preguntar precios por WhatsApp'}
          </a>
        </div>
      </div>
    </section>
  );
};

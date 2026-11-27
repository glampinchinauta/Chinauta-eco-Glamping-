import React, { useState } from 'react';
import { MapPin, Navigation, Compass, Sparkles, Trees, Coffee, Mountain, ExternalLink, Clock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface Attraction {
  id: string;
  name: string;
  category: 'Glamping' | 'Naturaleza' | 'Turismo' | 'Vía';
  categoryKey: string;
  distance: string;
  time: string;
  description: string;
  coordinates: { x: number; y: number }; // Percentage on map canvas
  icon: any;
}

export const InteractiveMap: React.FC = () => {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [activeAttraction, setActiveAttraction] = useState<Attraction | null>(null);

  const attractions: Attraction[] = [
    {
      id: 'glamping',
      name: 'Eco Glamping Chinauta (Ubicación Central)',
      category: 'Glamping',
      categoryKey: 'map.cat_glamping',
      distance: '0 km',
      time: t('map.departure_point'),
      description: 'Vía Principal Chinauta Km 4.5, Fusagasugá. Domos geodésicos con jacuzzi privado y mallas flotantes.',
      coordinates: { x: 50, y: 55 },
      icon: Sparkles
    },
    {
      id: 'cerro',
      name: 'Cerro Fusacatán & Miradores',
      category: 'Naturaleza',
      categoryKey: 'map.cat_nature',
      distance: '12.5 km',
      time: '25 min',
      description: 'Majestuoso cerro tutelar ideal para senderismo ecológico, avistamiento de aves e historia muisca.',
      coordinates: { x: 28, y: 30 },
      icon: Mountain
    },
    {
      id: 'piscilago',
      name: 'Parque Acuático Piscilago',
      category: 'Turismo',
      categoryKey: 'map.cat_tourism',
      distance: '18.2 km',
      time: '20 min Melgar',
      description: 'Uno de los parques de conservación de fauna y atracciones acuáticas más grandes de Colombia.',
      coordinates: { x: 78, y: 75 },
      icon: Trees
    },
    {
      id: 'plaza',
      name: 'Plaza de Mercado & Centro Fusagasugá',
      category: 'Turismo',
      categoryKey: 'map.cat_tourism',
      distance: '8.4 km',
      time: '15 min',
      description: 'Mercado tradicional de frutas exóticas de la región del Sumapaz, artesanías y cafés de origen.',
      coordinates: { x: 35, y: 70 },
      icon: Coffee
    },
    {
      id: 'cascada',
      name: 'Cascadas Ocultas de Chinauta',
      category: 'Naturaleza',
      categoryKey: 'map.cat_nature',
      distance: '4.2 km',
      time: '10 min',
      description: 'Saltos de agua cristalina rodeados de bosque nativo y vegetación tropical templada.',
      coordinates: { x: 68, y: 35 },
      icon: Trees
    },
    {
      id: 'autopista',
      name: 'Troncal Bogotá - Girardot (Km 4.5)',
      category: 'Vía',
      categoryKey: 'map.cat_route',
      distance: '0.5 km',
      time: '2 min',
      description: 'Vía principal pavimentada de doble calzada con excelente accesibilidad desde Bogotá (1.5 horas).',
      coordinates: { x: 52, y: 88 },
      icon: Navigation
    }
  ];

  const categories = [
    { id: 'Todos', labelKey: 'map.cat_all' },
    { id: 'Glamping', labelKey: 'map.cat_glamping' },
    { id: 'Naturaleza', labelKey: 'map.cat_nature' },
    { id: 'Turismo', labelKey: 'map.cat_tourism' },
    { id: 'Vía', labelKey: 'map.cat_route' }
  ];

  const filteredAttractions = selectedCategory === 'Todos'
    ? attractions
    : attractions.filter(item => item.category === selectedCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <span>{t('map.tag')}</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">{t('map.heading')}</h2>
        <p className="text-slate-600 text-base">
          {t('map.subheading')}
        </p>

        {/* Categories */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Map Container & Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Interactive Simulated Map Canvas (2 columns) */}
        <div className="lg:col-span-2 glass-card rounded-3xl overflow-hidden shadow-xl border border-slate-200 relative h-[420px] sm:h-[500px] lg:h-[600px] bg-slate-900 flex items-center justify-center">
          
          {/* Topographic map background graphic */}
          <div className="absolute inset-0 opacity-40">
            <img
              src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1600&q=80"
              alt="Map Topography Background"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover filter brightness-75 contrast-125"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/80 via-slate-900/40 to-emerald-950/40"></div>

          {/* Grid lines & radar rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-96 h-96 rounded-full border border-emerald-500/20 animate-ping [animation-duration:4s]"></div>
            <div className="absolute w-64 h-64 rounded-full border border-cyan-500/30"></div>
            <div className="absolute w-32 h-32 rounded-full border border-emerald-400/40"></div>
          </div>

          {/* Pins on Canvas */}
          {filteredAttractions.map(item => {
            const IconComponent = item.icon;
            const isCentral = item.id === 'glamping';
            const isActive = activeAttraction?.id === item.id;

            return (
              <div
                key={item.id}
                onClick={() => setActiveAttraction(item)}
                style={{ left: `${item.coordinates.x}%`, top: `${item.coordinates.y}%` }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
              >
                <div className={`relative flex items-center justify-center p-3 rounded-full shadow-2xl transition-all transform group-hover:scale-125 ${
                  isCentral 
                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-400/40 animate-bounce' 
                    : isActive 
                    ? 'bg-teal-600 text-white ring-4 ring-teal-400/50' 
                    : 'bg-slate-900 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white'
                }`}>
                  <IconComponent className="w-5 h-5" />
                </div>

                {/* Pin Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap bg-slate-950 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl border border-slate-800 z-30">
                  <span className="font-bold">{item.name}</span>
                  <span className="block text-[10px] text-emerald-400">{item.distance} • {item.time}</span>
                </div>
              </div>
            );
          })}

          {/* Map Overlay Controls / Legend */}
          <div className="absolute bottom-3 sm:bottom-6 left-3 sm:left-6 right-3 sm:right-6 bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 sm:gap-4 text-[11px] sm:text-xs text-white">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold truncate max-w-[200px] sm:max-w-none">Eco Glamping Chinauta (Km 4.5)</span>
            </div>
            <div className="flex items-center space-x-3 sm:space-x-4 text-slate-300">
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span><span>{t('map.cat_glamping')}</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span><span>{t('map.cat_nature')}</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span><span>{t('map.cat_tourism')}</span></span>
            </div>
          </div>
        </div>

        {/* Attractions List Sidebar (1 column) */}
        <div className="space-y-4 lg:max-h-[600px] lg:overflow-y-auto lg:pr-2">
          <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Compass className="w-5 h-5 text-emerald-600" />
            <span>{t('map.nearby_points')}</span>
          </h3>

          {filteredAttractions.map(item => {
            const IconComponent = item.icon;
            const isSelected = activeAttraction?.id === item.id;

            return (
              <div
                key={item.id}
                onClick={() => setActiveAttraction(item)}
                className={`p-5 rounded-2xl cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-300 shadow-md ring-2 ring-emerald-500/20'
                    : 'glass-card border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-xl ${
                      item.id === 'glamping' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                      <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">{t(item.categoryKey)}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                  {item.description}
                </p>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{item.distance}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      <span>{item.time}</span>
                    </span>
                  </div>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' Fusagasugá')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center space-x-1 text-emerald-700 font-semibold hover:text-emerald-800"
                  >
                    <span>{t('map.gps_route')}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};

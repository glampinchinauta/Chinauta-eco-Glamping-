import React, { useEffect, useState, useRef } from 'react';
import { Dome } from '../types';
import { 
  Compass, Calendar, MapPin, Sparkles, Wifi, Coffee, Waves, Flame, 
  Star, ChevronRight, CheckCircle2, X, ChevronLeft, Maximize2, Camera, 
  Plus, Play, ImagePlus, CheckCircle, Users, Heart, ShieldCheck
} from 'lucide-react';
import { TestimonialsSection } from './TestimonialsSection';
import { WeatherWidget } from './WeatherWidget';
import { FoodMenuSection } from './FoodMenuSection';
import { ImageCarousel } from './ImageCarousel';
import { LocationPhotos } from './LocationPhotos';
import { BochicaCarousel } from './BochicaCarousel';
import { HuitacaVideoCard } from './HuitacaVideoCard';
import { DomeMediaCard } from './DomeMediaCard';
import { MediaGallery } from './MediaGallery';
import { ResponsivePicture } from './ResponsivePicture';
import { getDomeImages, DEFAULT_DOMES } from '../utils/domeImages';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getResponsiveImageData } from '../utils/imageUtils';
import regeneratedDome2Image from '../assets/images/regenerated_image_1790617455020.jpg';
import bochicaRomanticDecor from '../assets/images/bochica_romantic_decor_1790618007934.jpg';
import bochicaJacuzziDeck from '../assets/images/bochica_jacuzzi_deck_1790618019311.jpg';
import bochicaSunsetView from '../assets/images/bochica_sunset_view_1790617981274.jpg';
import chinautaDeckAsoleadoras from '../assets/images/chinauta_deck_asoleadoras_1790624838157.jpg';
import chinautaRomanticDomeNight from '../assets/images/chinauta_romantic_dome_night_1790624852355.jpg';

interface HomePortalProps {
  onOpenBooking: (domeId?: number) => void;
  onNavigateTab: (tab: string) => void;
}

export const HomePortal: React.FC<HomePortalProps> = ({ onOpenBooking, onNavigateTab }) => {
  const { t, language } = useLanguage();
  const [domes, setDomes] = useState<Dome[]>(DEFAULT_DOMES);
  const [loading, setLoading] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        setScrollProgress((window.scrollY / totalScroll) * 100);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Real uploaded videos for Domes (Domos 1, 3, 5 and custom uploaded)
  const [domeVideos, setDomeVideos] = useState<Record<number, string>>({
    1: '/assets/videos/domo_1_user_video.mp4',
    2: '/assets/videos/domo_2_user_video.mp4',
    3: '/assets/videos/domo_3_user_video.mp4',
    5: '/assets/videos/domo_5_user_video.mp4'
  });
  const [videoError, setVideoError] = useState(false);

  const handleVideoUpload = (domeId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setDomeVideos(prev => ({ ...prev, [domeId]: url }));
    }
  };

  useEffect(() => {
    fetch('/api/domes')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          // Sync videos from server
          const serverVideos: Record<number, string> = {
            1: '/assets/videos/domo_1_user_video.mp4',
            2: '/assets/videos/domo_2_user_video.mp4',
            3: '/assets/videos/domo_3_user_video.mp4',
            5: '/assets/videos/domo_5_user_video.mp4'
          };
          data.forEach((d: any) => {
            if (d.video_url) {
              serverVideos[d.id] = d.video_url;
            }
          });
          setDomeVideos(serverVideos);

          // Merge API data with default domes to ensure complete fields
          const merged = DEFAULT_DOMES.map(def => {
            const serverDome = data.find((d: any) => d.id === def.id || d.code === def.code);
            if (!serverDome) return def;
            return {
              ...def,
              ...serverDome,
              images: Array.isArray(serverDome.images) && serverDome.images.length > 0 
                ? serverDome.images 
                : def.images
            };
          });
          setDomes(merged);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-20 pb-20 relative"
    >
      {/* Slim Scroll Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-200/50 z-50 pointer-events-none">
        <div 
          className="h-full bg-emerald-500 transition-all duration-100 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
      
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center bg-slate-950 overflow-hidden">
        {/* Background image with subtle dark overlay */}
        <div className="absolute inset-0 z-0 opacity-55">
          <ResponsivePicture
            src={chinautaRomanticDomeNight}
            alt="Eco Glamping Chinauta - Pareja bajo las estrellas"
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-cover scale-105"
            pictureClassName="w-full h-full block"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-0"></div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center space-y-8 pt-12">
          <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-medium backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{t('hero.badge')}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white">
            {t('hero.title_p1')} <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              {t('hero.title_p2')}
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-xl text-slate-300 font-normal leading-relaxed">
            {t('hero.desc')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => onOpenBooking()}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-xl shadow-emerald-900/40 transition-all transform hover:-translate-y-0.5"
            >
              {t('hero.book_btn')}
            </button>
            <button
              onClick={() => onNavigateTab('availability')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md transition-all"
            >
              {t('hero.check_btn')}
            </button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-12 max-w-3xl mx-auto border-t border-white/10">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400">{t('stats.domes_count')}</p>
              <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">{t('stats.domes_label')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-teal-400">{t('stats.nature_count')}</p>
              <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">{t('stats.nature_label')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400">{t('stats.rating_count')}</p>
              <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">{t('stats.rating_label')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-teal-400">{t('stats.service_count')}</p>
              <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">{t('stats.service_label')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Weather Widget Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <WeatherWidget />
      </section>

      {/* Domes Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold tracking-wide uppercase">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{language === 'en' ? 'Exclusive Stays' : 'Hospedaje Exclusivo'}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            {language === 'en' ? 'Our Six Ancestral Domes' : 'Nuestros Seis Domos Ancestrales'}
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            {language === 'en'
              ? 'Inspired by the sacred forces of nature and Muisca mythology. Each dome features a private open-air hot jacuzzi, solarium deck, romantic decor, and panoramic mountain views.'
              : 'Inspirados en las fuerzas sagradas de la naturaleza y la mitología muisca. Cada domo cuenta con jacuzzi privado al aire libre, deck solárium, ambiente romántico y vista panorámica a las montañas de Chinauta.'}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 font-medium">{t('domes.loading')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {domes.map(dome => (
              <div key={dome.id} className="glass-card rounded-3xl overflow-hidden shadow-lg border border-slate-200/90 flex flex-col hover:shadow-2xl transition-all duration-300 group bg-white">
                <DomeMediaCard
                  dome={dome}
                  onOpenBooking={() => onOpenBooking(dome.id)}
                />

                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    {/* Header: Name, Code, Capacity */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                          {dome.code}
                        </span>
                        <h4 className="text-2xl font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {dome.name}
                        </h4>
                      </div>
                      <span className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200/80 whitespace-nowrap">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{dome.capacity} {dome.capacity === 1 ? (language === 'en' ? 'Guest' : 'Persona') : (language === 'en' ? 'Guests' : 'Personas')}</span>
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline space-x-1.5 pt-1">
                      <span className="text-2xl font-black text-emerald-600">
                        ${dome.price_per_night?.toLocaleString('es-CO')}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        COP / {language === 'en' ? 'night' : 'noche'}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {dome.description}
                    </p>

                    {/* Amenities & Features */}
                    <div className="pt-2">
                      <div className="text-xs text-slate-500 flex flex-wrap gap-1.5">
                        {dome.features.split(',').map((feature, idx) => (
                          <span
                            key={idx}
                            className="bg-emerald-50/80 text-emerald-800 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-emerald-100"
                          >
                            ✨ {feature.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions: Availability & Book CTA */}
                  <div className="pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center space-x-1.5 ${
                      dome.status === 'Disponible' 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${dome.status === 'Disponible' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                      <span>{dome.status === 'Disponible' ? (language === 'en' ? 'Available' : 'Disponible') : (language === 'en' ? 'Unavailable' : dome.status)}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => onOpenBooking(dome.id)}
                      className="inline-flex items-center space-x-1.5 px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 transition-all shadow-md shadow-emerald-700/20 active:scale-95 cursor-pointer"
                    >
                      <span>{language === 'en' ? 'Book Dome' : 'Reservar Domo'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dedicated Interactive Photo & Video Gallery Component */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <MediaGallery onOpenBooking={onOpenBooking} />
      </section>

      {/* Food Menu Section */}
      <section className="bg-slate-50/50 py-12 border-y border-slate-200/60">
        <FoodMenuSection onOpenBooking={onOpenBooking} />
      </section>

      {/* Services & Amenities */}
      <section className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Comodidades</h2>
            <h3 className="text-3xl sm:text-4xl font-bold text-white">Una Experiencia Todo Incluido</h3>
            <p className="text-slate-300 text-base">
              Diseñado para ofrecer el máximo descanso, privacidad y desconexión en medio de la naturaleza de Chinauta.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="glass-dark p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Waves className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Jacuzzis de Hidromasaje</h4>
              <p className="text-slate-400 text-sm">Jacuzzis privados de hidromasaje en deck al aire libre con vista a las montañas.</p>
            </div>

            <div className="glass-dark p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Coffee className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Desayuno Campesino</h4>
              <p className="text-slate-400 text-sm">Incluido todas las mañanas, elaborado con ingredientes locales frescos de la región.</p>
            </div>

            <div className="glass-dark p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Flame className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Fogata Comunitaria</h4>
              <p className="text-slate-400 text-sm">Una sola fogata comunitaria para todo el glamping, para compartir vino y malvaviscos.</p>
            </div>

            <div className="glass-dark p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Zona Barbacoa & Desconexión</h4>
              <p className="text-slate-400 text-sm">Zona BBQ y descanso total en medio de la naturaleza (cabañas libres de wifi).</p>
            </div>
          </div>
        </div>
      </section>

      {/* Location & Contact Info */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl p-8 sm:p-12 border border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>{language === 'en' ? 'Prime Location' : 'Ubicación Privilegiada'}</span>
            </div>
            <h3 className="text-3xl font-bold text-slate-900">Chinauta, Fusagasugá, Cundinamarca</h3>
            <p className="text-slate-600 leading-relaxed text-base">
              {language === 'en' ? 'Just 1.5 hours from Bogotá, in the heart of Chinauta\'s mild climate. An oasis of peace, fresh air and majestic mountain landscapes.' : 'A tan solo 1.5 horas de Bogotá, en el corazón del clima templado de Chinauta. Un oasis de paz, aire puro y paisajes montañosos majestuosos.'}
            </p>
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-3 text-slate-700 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{language === 'en' ? 'Paved road to the main entrance' : 'Vía pavimentada hasta la entrada principal'}</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-700 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{language === 'en' ? 'Free parking' : 'Parqueadero gratis'}</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-700 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{language === 'en' ? 'Internal ecological trails' : 'Senderos ecológicos internos'}</span>
              </div>
            </div>
            <div className="pt-4">
              <button
                onClick={() => onNavigateTab('contact')}
                className="px-6 py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
              >
                Ver Información de Contacto
              </button>
            </div>
          </div>

          <LocationPhotos
            alt="Instalaciones y Entorno Eco Glamping Chinauta"
            defaultImages={[
              '/assets/images/chinauta-ubicacion-1.webp',
              '/assets/images/chinauta-ubicacion-2.webp',
              '/assets/images/chinauta-ubicacion-3.webp',
              '/assets/images/chinauta-ubicacion-4.webp'
            ]}
          />
        </div>
      </section>

      {/* Testimonials Section */}
      <TestimonialsSection />

    </motion.div>
  );
};

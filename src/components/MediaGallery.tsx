import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Video, Plus, X, UploadCloud, Play, Pause, Maximize2, 
  ChevronLeft, ChevronRight, CheckCircle, Sparkles, ImagePlus, 
  Volume2, VolumeX, Eye, Download, Trash2, Heart, Share2,
  Smartphone, LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { getResponsiveImageData } from '../utils/imageUtils';

// Import default bundled assets as fallback
import chinautaDeckAsoleadoras from '../assets/images/chinauta_deck_asoleadoras_1790624838157.jpg';
import chinautaRomanticDomeNight from '../assets/images/chinauta_romantic_dome_night_1790624852355.jpg';
import bochicaRomanticDecor from '../assets/images/bochica_romantic_decor_1790618007934.jpg';
import bochicaJacuzziDeck from '../assets/images/bochica_jacuzzi_deck_1790618019311.jpg';
import bochicaSunsetView from '../assets/images/bochica_sunset_view_1790617981274.jpg';
import { useIsAdmin } from '../lib/useIsAdmin';

export interface GalleryMediaItem {
  id: string | number;
  title: string;
  category: string;
  media_type: 'image' | 'video';
  media_url: string;
  image?: string;
  description?: string;
  created_at?: string;
}

const DEFAULT_GALLERY_ITEMS: GalleryMediaItem[] = [
  {
    id: 1,
    title: 'Deck Solárium con Asoleadoras & Sombrilla',
    category: 'Jacuzzis & Vistas',
    media_type: 'image',
    media_url: chinautaDeckAsoleadoras,
    image: chinautaDeckAsoleadoras,
    description: 'Deck privado en madera con asoleadoras, sombrilla verde, zona BBQ y tina de hidromasaje en Chinauta.'
  },
  {
    id: 2,
    title: 'Domo Bochica — Decoración Romántica Interior',
    category: 'Domos',
    media_type: 'image',
    media_url: bochicaRomanticDecor,
    image: bochicaRomanticDecor,
    description: 'Cama decorada para ocasiones especiales con rosas, globos y ambiente cálido acogedor.'
  },
  {
    id: 3,
    title: 'Domo 1 Huitaca — Video Tour y Jacuzzi Privado',
    category: 'Videos',
    media_type: 'video',
    media_url: '/assets/videos/domo_1_huitaca.mp4',
    image: chinautaDeckAsoleadoras,
    description: 'Recorrido en video de alta definición por las instalaciones, jacuzzi del Domo Huitaca.'
  },
  {
    id: 4,
    title: 'Domo Bochica — Jacuzzi en Deck al Atardecer',
    category: 'Jacuzzis & Vistas',
    media_type: 'image',
    media_url: bochicaJacuzziDeck,
    image: bochicaJacuzziDeck,
    description: 'Jacuzzi privado exterior en plataforma de madera rodeado de naturaleza y luces cálidas.'
  },
  {
    id: 5,
    title: 'Domo Bochica — Vista Panorámica al Ocaso',
    category: 'Domos',
    media_type: 'image',
    media_url: bochicaSunsetView,
    image: bochicaSunsetView,
    description: 'Vista privilegiada del atardecer a través de los ventanales triangulares geodésicos.'
  },
  {
    id: 6,
    title: 'Noche Mágica Bajo las Estrellas — Pareja en Domo',
    category: 'Domos',
    media_type: 'image',
    media_url: chinautaRomanticDomeNight,
    image: chinautaRomanticDomeNight,
    description: 'Cena romántica para parejas en bata blanca con vino tinto y vista estelar a través de los paneles geodésicos.'
  },
  {
    id: 7,
    title: 'Atardecer en Fusagasugá',
    category: 'Naturaleza',
    media_type: 'image',
    media_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    description: 'Puestas de sol mágicas y clima templado perfecto todo el año en la cordillera.'
  },
  {
    id: 8,
    title: 'Zona Fogata & Noche de Malvaviscos',
    category: 'Comodidades',
    media_type: 'image',
    media_url: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
    image: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
    description: 'Una fogata comunitaria para todo el glamping, con vino de la casa y vista a las estrellas.'
  }
];

interface MediaGalleryProps {
  onOpenBooking?: () => void;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({ onOpenBooking }) => {
  const canEdit = useIsAdmin(); // Only a signed-in administrator sees upload controls
  const { language, t } = useLanguage();
  const [items, setItems] = useState<GalleryMediaItem[]>(DEFAULT_GALLERY_ITEMS);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Mobile Touch Slider & View Mode State
  const [viewMode, setViewMode] = useState<'slider' | 'grid'>('slider');
  const [sliderIndex, setSliderIndex] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  
  // Drag & Drop / Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form fields
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Domos');
  const [newDesc, setNewDesc] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');

  // Lightbox player controls
  const [isPlayingVideo, setIsPlayingVideo] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const lightboxVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch('/api/gallery')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map((item: any) => ({
            ...item,
            image: item.media_url,
            media_url: item.media_url,
            media_type: item.media_type || (item.media_url?.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image')
          }));
          setItems(formatted);
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const categories = [
    { id: 'Todos', label: t('gallery.cat_all') },
    { id: 'Videos', label: t('gallery.cat_videos') },
    { id: 'Domos', label: t('gallery.cat_domes') },
    { id: 'Jacuzzis & Vistas', label: t('gallery.cat_jacuzzis') },
    { id: 'Naturaleza', label: t('gallery.cat_nature') },
    { id: 'Comodidades', label: t('gallery.cat_amenities') }
  ];

  const filteredItems = activeCategory === 'Todos'
    ? items
    : activeCategory === 'Videos'
    ? items.filter(item => item.media_type === 'video' || item.category === 'Videos')
    : items.filter(item => item.category === activeCategory);

  // File processing and upload
  const processAndUploadFile = async (file: File) => {
    if (!file) return;
    const isVideo = file.type.startsWith('video') || file.name.match(/\.(mp4|webm|mov|m4v)$/i);
    setIsUploading(true);
    setUploadProgress(20);

    try {
      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 60) + 20);
        }
      };

      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          setUploadProgress(85);

          const res = await fetch('/api/upload-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              mediaData: base64,
              type: isVideo ? 'video' : 'image'
            })
          });

          const data = await res.json();
          setUploadProgress(100);

          if (data?.url) {
            setNewMediaUrl(data.url);
            setNewMediaType(isVideo ? 'video' : 'image');
            if (!newTitle) {
              const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
              setNewTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
            }
            showToast(t('gallery.upload_success'));
          }
        } catch (err: any) {
          showToast(err.message || 'Error al procesar archivo');
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setIsUploadModalOpen(true);
      processAndUploadFile(file);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaUrl) {
      showToast(t('gallery.require_media'));
      return;
    }

    const newItem: GalleryMediaItem = {
      id: Date.now(),
      title: newTitle || t('gallery.form_title_ph'),
      category: newCategory,
      media_type: newMediaType,
      media_url: newMediaUrl,
      image: newMediaUrl,
      description: newDesc || ''
    };

    setItems([newItem, ...items]);
    setIsUploadModalOpen(false);

    try {
      await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newItem.title,
          category: newItem.category,
          media_type: newItem.media_type,
          media_url: newItem.media_url,
          description: newItem.description
        })
      });
      showToast(t('gallery.success_toast'));
    } catch (err) {
      console.warn("Gallery API error:", err);
    }

    setNewTitle('');
    setNewDesc('');
    setNewMediaUrl('');
  };

  // Lightbox keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev !== null && prev < filteredItems.length - 1 ? prev + 1 : 0));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredItems.length - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, filteredItems.length]);

  // Reset slider index when active category changes
  useEffect(() => {
    setSliderIndex(0);
  }, [activeCategory]);

  const paginateSlider = (direction: number) => {
    if (filteredItems.length === 0) return;
    setSliderIndex((prev) => {
      const next = prev + direction;
      if (next < 0) return filteredItems.length - 1;
      if (next >= filteredItems.length) return 0;
      return next;
    });
  };

  // Lightbox touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX !== null && touchEndX !== null) {
      const diff = touchStartX - touchEndX;
      if (diff > 50) {
        // Swiped left -> next item
        setLightboxIndex((prev) => (prev !== null && prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (diff < -50) {
        // Swiped right -> prev item
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredItems.length - 1));
      }
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  return (
    <div 
      className="space-y-10 relative"
      onDragOver={canEdit ? handleDragOver : undefined}
      onDragLeave={handleDragLeave}
      onDrop={canEdit ? handleDrop : undefined}
    >
      {/* Hidden file input */}
      {canEdit && (
<input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files?.[0]) {
            processAndUploadFile(e.target.files[0]);
          }
        }}
        accept="image/*,video/*"
        className="hidden"
      />
)}

      {/* Global Drag & Drop Overlay Indicator */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-emerald-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white border-4 border-dashed border-emerald-400 m-4 rounded-3xl pointer-events-none"
          >
            <div className="p-6 rounded-full bg-emerald-500/20 text-emerald-300 mb-4 animate-bounce">
              <UploadCloud className="w-16 h-16" />
            </div>
            <h3 className="text-3xl font-extrabold tracking-tight mb-2">
              {t('gallery.drop_title')}
            </h3>
            <p className="text-slate-300 text-sm max-w-md text-center">
              {t('gallery.drop_desc')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section with CTA */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left max-w-2xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold tracking-wide uppercase">
            <Camera className="w-4 h-4 text-emerald-600" />
            <span>{t('gallery.tag')}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            {t('gallery.title')}
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            {t('gallery.desc')}
          </p>
        </div>

        {/* Upload Button */}
        {canEdit && (
<button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          className="w-full sm:w-auto justify-center px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs sm:text-sm flex items-center space-x-2.5 shadow-xl shadow-emerald-700/20 transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
        >
          <UploadCloud className="w-5 h-5 text-emerald-200" />
          <span>{t('gallery.upload_btn')}</span>
        </button>
)}
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {categories.map((cat) => {
          const isSelected = activeCategory === cat.id;
          const count = cat.id === 'Todos' 
            ? items.length 
            : cat.id === 'Videos' 
            ? items.filter(i => i.media_type === 'video' || i.category === 'Videos').length 
            : items.filter(i => i.category === cat.id).length;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 scale-105'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-200 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* View Mode Switcher & Counter */}
      <div className="flex items-center justify-between pt-2 pb-1">
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          {t('gallery.showing')} {filteredItems.length} {t('gallery.experiences')}
        </p>

        <div className="inline-flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode('slider')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'slider'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Vista Deslizable con Gestos Táctiles"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{t('gallery.slider_mode')}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Vista en Cuadrícula"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{t('gallery.grid_mode')}</span>
          </button>
        </div>
      </div>

      {/* Touch-Friendly Slider Mode (Optimized for Mobile Gestures) */}
      {viewMode === 'slider' && filteredItems.length > 0 && (
        <div className="relative w-full overflow-hidden rounded-3xl bg-slate-950 border border-slate-200/90 shadow-xl">
          {(() => {
            const safeIdx = Math.min(Math.max(sliderIndex, 0), filteredItems.length - 1);
            const activeItem = filteredItems[safeIdx];
            const isVideo = activeItem.media_type === 'video';
            const imgData = getResponsiveImageData(activeItem.image || activeItem.media_url, '(max-width: 640px) 100vw, 900px');

            return (
              <div className="relative flex flex-col justify-between min-h-[380px] sm:min-h-[460px] md:min-h-[500px]">
                {/* Active Slide Canvas with Framer Motion Drag Gestures */}
                <div className="absolute inset-0 overflow-hidden">
                  <AnimatePresence initial={false} mode="wait">
                    <motion.div
                      key={activeItem.id}
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                      transition={{ duration: 0.25 }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.2}
                      onDragEnd={(_, { offset, velocity }) => {
                        const swipe = Math.abs(offset.x) * velocity.x;
                        if (swipe < -80 || offset.x < -50) {
                          paginateSlider(1);
                        } else if (swipe > 80 || offset.x > 50) {
                          paginateSlider(-1);
                        }
                      }}
                      className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing select-none"
                    >
                      {isVideo ? (
                        <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                          <video
                            src={activeItem.media_url}
                            muted
                            loop
                            autoPlay
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                          <div 
                            onClick={() => setLightboxIndex(safeIdx)}
                            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors cursor-pointer"
                          >
                            <div className="w-16 h-16 rounded-full bg-emerald-600/90 hover:bg-emerald-500 text-white flex items-center justify-center shadow-2xl backdrop-blur-xs transition-transform transform active:scale-95">
                              <Play className="w-8 h-8 text-white fill-current ml-1" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={imgData.webpSrc || activeItem.image || activeItem.media_url}
                          srcSet={imgData.webpSrcSet || undefined}
                          sizes={imgData.sizes || undefined}
                          alt={activeItem.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      )}

                      {/* Gradient Scrim for readable text */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-slate-950/40 pointer-events-none" />
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Top Overlay Bar */}
                <div className="relative z-20 p-4 sm:p-6 flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-emerald-300 border border-white/20 shadow-md">
                      {isVideo ? '🎥 Video Tour HD' : activeItem.category}
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-slate-300 border border-white/10">
                      {safeIdx + 1} / {filteredItems.length}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(safeIdx)}
                      className="p-2 sm:p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-md"
                      title="Ver en pantalla completa"
                      aria-label="Ver en pantalla completa"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Navigation Arrows for touch or click */}
                <div className="relative z-20 flex items-center justify-between px-3 sm:px-5 pointer-events-none">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      paginateSlider(-1);
                    }}
                    className="pointer-events-auto p-3 sm:p-3.5 rounded-full bg-slate-900/85 hover:bg-emerald-600 text-white backdrop-blur-md border border-white/20 transition-all transform active:scale-90 shadow-xl cursor-pointer"
                    aria-label="Experiencia anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      paginateSlider(1);
                    }}
                    className="pointer-events-auto p-3 sm:p-3.5 rounded-full bg-slate-900/85 hover:bg-emerald-600 text-white backdrop-blur-md border border-white/20 transition-all transform active:scale-90 shadow-xl cursor-pointer"
                    aria-label="Siguiente experiencia"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Bottom Content Area & Dots */}
                <div className="relative z-20 p-5 sm:p-6 space-y-3 pointer-events-auto">
                  <div 
                    onClick={() => setLightboxIndex(safeIdx)}
                    className="cursor-pointer space-y-1.5"
                  >
                    <h3 className="text-xl sm:text-2xl font-black text-white hover:text-emerald-300 transition-colors">
                      {activeItem.title}
                    </h3>
                    {activeItem.description && (
                      <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed">
                        {activeItem.description}
                      </p>
                    )}
                  </div>

                  {/* Dot Indicators & Swipe Hint */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
                    {/* Swipe Instruction Hint */}
                    <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-medium">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span>{t('gallery.swipe_hint')}</span>
                    </div>

                    {/* Dots */}
                    <div className="flex items-center space-x-1.5 overflow-x-auto max-w-full py-1">
                      {filteredItems.slice(0, 12).map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSliderIndex(idx)}
                          className={`relative h-2 rounded-full transition-all duration-300 before:content-[''] before:absolute before:-inset-x-1.5 before:-inset-y-3 ${
                            safeIdx === idx
                              ? 'w-6 bg-emerald-400 shadow-xs'
                              : 'w-2 bg-white/40 hover:bg-white/80'
                          }`}
                          aria-label={`Ir a experiencia ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Gallery Grid Mode (Responsive WebP Images) */}
      {(viewMode === 'grid' || filteredItems.length === 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => {
            const isVideo = item.media_type === 'video';
            const imgData = getResponsiveImageData(item.image || item.media_url, '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw');

            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                key={item.id}
                onClick={() => setLightboxIndex(index)}
                className="group relative h-80 rounded-3xl overflow-hidden shadow-md cursor-pointer border border-slate-200/90 bg-slate-950 hover:shadow-2xl transition-all duration-500"
              >
                {isVideo ? (
                  <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
                    <video
                      src={item.media_url}
                      muted
                      loop
                      preload="metadata"
                      playsInline
                      className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-14 h-14 rounded-full bg-emerald-600/90 text-white flex items-center justify-center shadow-xl backdrop-blur-xs group-hover:scale-110 group-hover:bg-emerald-500 transition-all">
                        <Play className="w-7 h-7 text-white fill-current ml-1" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={imgData.webpSrc || item.image || item.media_url}
                    srcSet={imgData.webpSrcSet || undefined}
                    sizes={imgData.sizes || undefined}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                  />
                )}

                {/* Gradient Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-transparent opacity-85 group-hover:opacity-95 transition-opacity pointer-events-none"></div>

                {/* Top badges */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-emerald-300 border border-white/20 shadow-md">
                    {isVideo ? '🎥 Video Tour' : item.category}
                  </span>

                  <div className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                </div>

                {/* Bottom text */}
                <div className="absolute bottom-0 inset-x-0 p-6 space-y-1.5 text-white transform transition-transform pointer-events-none z-10">
                  <h4 className="text-lg font-extrabold leading-snug group-hover:text-emerald-300 transition-colors">
                    {item.title}
                  </h4>
                  {item.description && (
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Lightbox Viewer Modal with Touch Gestures */}
      <AnimatePresence>
        {lightboxIndex !== null && filteredItems[lightboxIndex] && (
          <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between text-white border-b border-slate-800/80 pb-4 z-20">
              <div className="flex items-center space-x-3">
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase tracking-wider">
                  {filteredItems[lightboxIndex].media_type === 'video' ? '🎥 Video Tour HD' : filteredItems[lightboxIndex].category}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {lightboxIndex + 1} / {filteredItems.length}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setLightboxIndex(null)}
                  className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                  title="Cerrar (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Center Area with Nav Buttons and Touch Swipe Handlers */}
            <div 
              className="relative flex-1 flex items-center justify-center my-4 overflow-hidden touch-pan-y"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Previous Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredItems.length - 1));
                }}
                className="absolute left-2 sm:left-4 z-20 p-3 sm:p-4 rounded-full bg-slate-900/80 hover:bg-emerald-600 text-white backdrop-blur-md border border-white/20 transition-all transform hover:scale-110 active:scale-95 cursor-pointer shadow-2xl"
                title="Anterior (Flecha Izquierda o Deslizar)"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Media Container */}
              <div className="max-w-5xl w-full h-full max-h-[70vh] flex items-center justify-center px-8">
                {filteredItems[lightboxIndex].media_type === 'video' ? (
                  <div className="relative w-full h-full max-h-[70vh] flex items-center justify-center bg-black rounded-3xl overflow-hidden shadow-2xl">
                    <video
                      ref={lightboxVideoRef}
                      src={filteredItems[lightboxIndex].media_url}
                      controls
                      autoPlay
                      playsInline
                      muted={isMuted}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  (() => {
                    const lbData = getResponsiveImageData(
                      filteredItems[lightboxIndex].image || filteredItems[lightboxIndex].media_url, 
                      '(max-width: 1024px) 100vw, 1200px'
                    );
                    return (
                      <img
                        src={lbData.webpSrc || filteredItems[lightboxIndex].image || filteredItems[lightboxIndex].media_url}
                        srcSet={lbData.webpSrcSet || undefined}
                        sizes={lbData.sizes || undefined}
                        alt={filteredItems[lightboxIndex].title}
                        className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-2xl"
                      />
                    );
                  })()
                )}
              </div>

              {/* Next Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev !== null && prev < filteredItems.length - 1 ? prev + 1 : 0));
                }}
                className="absolute right-2 sm:right-4 z-20 p-3 sm:p-4 rounded-full bg-slate-900/80 hover:bg-emerald-600 text-white backdrop-blur-md border border-white/20 transition-all transform hover:scale-110 active:scale-95 cursor-pointer shadow-2xl"
                title="Siguiente (Flecha Derecha o Deslizar)"
                aria-label="Siguiente"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Bottom Info Bar & Thumbnails */}
            <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-slate-800 text-white flex flex-col md:flex-row items-center justify-between gap-4 z-20">
              <div className="space-y-1 text-center md:text-left max-w-xl">
                <h3 className="text-xl font-bold text-white">{filteredItems[lightboxIndex].title}</h3>
                {filteredItems[lightboxIndex].description && (
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {filteredItems[lightboxIndex].description}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setLightboxIndex(null);
                    if (onOpenBooking) onOpenBooking();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-900/40 transition-all cursor-pointer"
                >
                  {t('avail.reserve_now')}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Modal with Drag & Drop Zone */}
      <AnimatePresence>
        {canEdit && isUploadModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                  <UploadCloud className="w-6 h-6 text-emerald-600" />
                  <h3 className="font-extrabold text-lg text-slate-900">
                    {t('gallery.modal_title')}
                  </h3>
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drag & Drop Box */}
              <div
                ref={dropZoneRef}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                  newMediaUrl
                    ? 'border-emerald-500 bg-emerald-50/40'
                    : 'border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30'
                }`}
              >
                {newMediaUrl ? (
                  <div className="space-y-3 w-full">
                    <div className="h-40 w-full rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-200">
                      {newMediaType === 'video' ? (
                        <video src={newMediaUrl} controls className="h-full object-cover" />
                      ) : (
                        <img src={newMediaUrl} alt="Preview" className="h-full object-cover" />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-emerald-700 flex items-center justify-center space-x-1">
                      <CheckCircle className="w-4 h-4" />
                      <span>{t('gallery.file_ready')}</span>
                    </p>
                  </div>
                ) : isUploading ? (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mx-auto"></div>
                    <p className="text-xs font-bold text-slate-700">
                      {t('gallery.uploading')} {uploadProgress}%
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                      <ImagePlus className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      {t('gallery.drag_prompt')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t('gallery.browse_files')}
                    </p>
                  </div>
                )}
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {t('gallery.form_title')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder={t('gallery.form_title_ph')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {t('gallery.form_cat')}
                  </label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 focus:outline-hidden bg-white"
                  >
                    <option value="Domos">{t('gallery.cat_domes')}</option>
                    <option value="Jacuzzis & Vistas">{t('gallery.cat_jacuzzis')}</option>
                    <option value="Naturaleza">{t('gallery.cat_nature')}</option>
                    <option value="Comodidades">{t('gallery.cat_amenities')}</option>
                    <option value="Videos">{t('gallery.cat_videos')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {t('gallery.form_desc')}
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder={t('gallery.form_desc_ph')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    {t('gallery.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!newMediaUrl || isUploading}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {t('gallery.publish')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-24 lg:bottom-6 right-4 sm:right-6 z-50 bg-emerald-600 text-white text-xs px-4 py-2.5 rounded-full font-semibold shadow-2xl flex items-center space-x-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

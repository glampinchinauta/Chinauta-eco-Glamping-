import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Maximize2, Film, Camera, Upload, CheckCircle, ImagePlus, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { Dome } from '../types';
import { getDomeImages } from '../utils/domeImages';
import defaultDomo1Video from '../assets/videos/domo_1_huitaca.mp4';
import { getResponsiveImageData } from '../utils/imageUtils';
import { useLanguage } from '../context/LanguageContext';
import { useIsAdmin } from '../lib/useIsAdmin';

interface DomeMediaCardProps {
  dome: Dome;
  className?: string;
  onOpenBooking?: () => void;
}

export const DomeMediaCard: React.FC<DomeMediaCardProps> = ({
  dome,
  className = 'h-64 sm:h-72 md:h-80',
  onOpenBooking
}) => {
  const { t } = useLanguage();
  const canEdit = useIsAdmin(); // Only a signed-in administrator sees upload/delete controls
  const domeId = Number(dome.id);

  // Tab State: 'video' | 'photos'
  const [activeTab, setActiveTab] = useState<'video' | 'photos'>('video');

  // Video State
  const [videoSrc, setVideoSrc] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(`dome_${domeId}_custom_video`);
      if (stored && !stored.startsWith('blob:')) {
        return stored;
      }
      if (stored && stored.startsWith('blob:')) {
        localStorage.removeItem(`dome_${domeId}_custom_video`);
      }
    } catch (_) {}

    // Default per dome
    if (domeId === 1) {
      return defaultDomo1Video || '/assets/videos/domo_1_huitaca.mp4';
    }
    if (domeId === 2 || domeId === 3 || domeId === 5) {
      return `/assets/videos/domo_${domeId}_user_video.mp4`;
    }
    // High quality nature and glamping fallback video for other domes
    return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [videoError, setVideoError] = useState(false);

  // Images State
  const [images, setImages] = useState<string[]>(() => {
    const baseImages = getDomeImages(dome);
    try {
      const stored = localStorage.getItem(`dome_${domeId}_custom_images`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Combine stored and base images avoiding duplicates
          return Array.from(new Set([...parsed, ...baseImages]));
        }
      }
    } catch (_) {}
    return baseImages;
  });

  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const [isFullscreenPhoto, setIsFullscreenPhoto] = useState(false);

  // Sync images when dome prop changes
  useEffect(() => {
    const baseImages = getDomeImages(dome);
    try {
      const stored = localStorage.getItem(`dome_${domeId}_custom_images`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setImages(Array.from(new Set([...parsed, ...baseImages])));
          return;
        }
      }
    } catch (_) {}
    setImages(baseImages);
  }, [dome.id, dome.images, dome.image_url]);

  // Upload Feedback
  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Safe Play
  const safePlay = () => {
    if (videoRef.current) {
      const promise = videoRef.current.play();
      if (promise !== undefined) {
        promise
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      safePlay();
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const toggleFullscreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration || 1;
    setProgress((current / total) * 100);
  };

  const handleVideoError = () => {
    if (videoSrc !== '/assets/videos/domo_1_huitaca.mp4' && domeId === 1) {
      setVideoSrc('/assets/videos/domo_1_huitaca.mp4');
    } else {
      setVideoError(true);
      setActiveTab('photos');
    }
  };

  // Upload Video Handler
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const blobUrl = URL.createObjectURL(file);
      setVideoSrc(blobUrl);
      setVideoError(false);
      setActiveTab('video');

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await fetch('/api/upload-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domeId,
              filename: `domo_${domeId}_user_video.mp4`,
              videoData: base64
            })
          });
          const data = await res.json();
          if (data?.url) {
            localStorage.setItem(`dome_${domeId}_custom_video`, data.url);
            setVideoSrc(data.url);
          }
        } catch (err) {
          console.warn("Server video upload fallback:", err);
        }
      };
      reader.readAsDataURL(file);

      showToast(`${t('domes.toast_video_loaded')} ${dome.name}!`);
      setTimeout(safePlay, 100);
    } catch (err) {
      console.error("Error al cargar video:", err);
    } finally {
      setIsUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  // Upload Image Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      const newImages = [previewUrl, ...images];
      setImages(newImages);
      setCurrentPhotoIdx(0);
      setActiveTab('photos');

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domeId,
              filename: `dome_${domeId}_${Date.now()}.jpg`,
              imageData: base64
            })
          });
          const data = await res.json();
          if (data?.url) {
            const persistentImages = [data.url, ...images.filter(img => !img.startsWith('blob:'))];
            setImages(persistentImages);
            localStorage.setItem(`dome_${domeId}_custom_images`, JSON.stringify(persistentImages));
          }
        } catch (err) {
          console.warn("Server image upload fallback:", err);
        }
      };
      reader.readAsDataURL(file);

      showToast(`${t('domes.toast_photo_added')} ${dome.name}!`);
    } catch (err) {
      console.error("Error al cargar imagen:", err);
    } finally {
      setIsUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const nextPhoto = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentPhotoIdx(prev => (prev + 1) % images.length);
  };

  const prevPhoto = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentPhotoIdx(prev => (prev - 1 + images.length) % images.length);
  };

  const handleDeleteCurrentPhoto = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (images.length <= 1) {
      showToast(t('domes.cannot_delete_only_photo'));
      return;
    }
    const newImages = images.filter((_, idx) => idx !== currentPhotoIdx);
    setImages(newImages);
    setCurrentPhotoIdx(prev => (prev >= newImages.length ? 0 : prev));
    localStorage.setItem(`dome_${domeId}_custom_images`, JSON.stringify(newImages));
    showToast(t('domes.photo_deleted'));

    try {
      await fetch(`/api/domes/${domeId}/images`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: newImages, user_name: 'Administrador' })
      });
    } catch (err) {
      console.warn("Error updating dome images on server:", err);
    }
  };

  return (
    <div className={`relative w-full overflow-hidden select-none bg-slate-950 rounded-t-2xl flex flex-col justify-end ${className}`}>
      {/* Hidden File Inputs for Video and Image */}
      {canEdit && (
<input
        type="file"
        ref={videoInputRef}
        onChange={handleVideoUpload}
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
      />
)}
      {canEdit && (
<input
        type="file"
        ref={imageInputRef}
        onChange={handleImageUpload}
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
      />
)}

      {/* Main Display: Video vs Photos */}
      {activeTab === 'video' && !videoError ? (
        <div className="absolute inset-0 overflow-hidden cursor-pointer" onClick={togglePlay}>
          <video
            ref={videoRef}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={handleVideoError}
            className="w-full h-full object-cover"
          >
            <source src={videoSrc} type="video/mp4" />
            {domeId === 1 && <source src="/assets/videos/domo_1_huitaca.mp4" type="video/mp4" />}
          </video>

          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/50 pointer-events-none" />

          {/* Big Play Button when paused */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-14 h-14 rounded-full bg-emerald-600/90 text-white flex items-center justify-center shadow-xl backdrop-blur-md"
              >
                <Play className="w-7 h-7 text-white fill-current ml-1" />
              </motion.div>
            </div>
          )}

          {/* Top Left: Badges */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 pointer-events-auto">
            <span className="bg-slate-900/85 backdrop-blur-md text-white text-[11px] px-2.5 py-1 rounded-full font-medium shadow-sm border border-white/10">
              {t('domes.capacity_label')} {dome.capacity} {t('domes.people')}
            </span>
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/85 backdrop-blur-md text-emerald-300 text-[11px] font-semibold border border-emerald-500/30 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{t('domes.video_tour')}</span>
            </span>
          </div>

          {/* Top Right Controls: Subir Video, Subir Foto, Mute, Fullscreen */}
          <div className="absolute top-3 right-3 z-20 flex items-center space-x-1.5 pointer-events-auto">
            {canEdit && (
<button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                videoInputRef.current?.click();
              }}
              title={`${t('domes.upload_video')} - ${dome.name}`}
              className="px-2.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-emerald-600 text-white text-[11px] font-semibold backdrop-blur-md border border-white/25 transition-all flex items-center space-x-1 shadow-md active:scale-95 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('domes.upload_video')}</span>
            </button>
)}

            {canEdit && (
<button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                imageInputRef.current?.click();
              }}
              title={`${t('domes.upload_photo')} - ${dome.name}`}
              className="px-2.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-teal-600 text-white text-[11px] font-semibold backdrop-blur-md border border-white/25 transition-all flex items-center space-x-1 shadow-md active:scale-95 cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5 text-teal-300" />
              <span className="hidden sm:inline">{t('domes.upload_photo')}</span>
            </button>
)}

            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
              className="p-2 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white backdrop-blur-md border border-white/25 transition-transform active:scale-95 shadow-md cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-300" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Pantalla completa"
              className="p-2 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white backdrop-blur-md border border-white/25 transition-transform active:scale-95 shadow-md cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Video Progress Bar */}
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
            <div
              className="h-full bg-emerald-400 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        /* Photos Carousel */
        <div className="absolute inset-0 overflow-hidden group/carousel">
          {(() => {
            const rawPhoto = images[currentPhotoIdx] || images[0];
            const resp = getResponsiveImageData(rawPhoto, '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw');
            return (
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentPhotoIdx}
                  src={resp.webpSrc || rawPhoto}
                  srcSet={resp.webpSrcSet || undefined}
                  sizes={resp.sizes || undefined}
                  alt={`${dome.name} - Foto ${currentPhotoIdx + 1}`}
                  loading="lazy"
                  decoding="async"
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0.2 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setIsFullscreenPhoto(true)}
                />
              </AnimatePresence>
            );
          })()}

          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/40 pointer-events-none" />

          {/* Top Left: Badges */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 pointer-events-auto">
            <span className="bg-slate-900/85 backdrop-blur-md text-white text-[11px] px-2.5 py-1 rounded-full font-medium shadow-sm border border-white/10">
              {t('domes.capacity_label')} {dome.capacity} {t('domes.people')}
            </span>
            <span className="bg-slate-900/85 backdrop-blur-md text-slate-300 text-[11px] px-2 py-1 rounded-full font-medium shadow-sm border border-white/10">
              {currentPhotoIdx + 1} / {images.length}
            </span>
          </div>

          {/* Top Right: Subir Imagen, Subir Video, Borrar & Expand */}
          <div className="absolute top-3 right-3 z-20 flex items-center space-x-1.5 pointer-events-auto">
            {canEdit && (
<button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                imageInputRef.current?.click();
              }}
              title={`${t('domes.upload_photo')} - ${dome.name}`}
              className="px-2.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-emerald-600 text-white text-[11px] font-semibold backdrop-blur-md border border-white/25 transition-all flex items-center space-x-1 shadow-md active:scale-95 cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('domes.upload_photo')}</span>
            </button>
)}

            {canEdit && (
<button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                videoInputRef.current?.click();
              }}
              title={`${t('domes.upload_video')} - ${dome.name}`}
              className="px-2.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-teal-600 text-white text-[11px] font-semibold backdrop-blur-md border border-white/25 transition-all flex items-center space-x-1 shadow-md active:scale-95 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-teal-300" />
              <span className="hidden sm:inline">{t('domes.upload_video')}</span>
            </button>
)}

            {canEdit && images.length > 1 && (
              <button
                type="button"
                onClick={handleDeleteCurrentPhoto}
                title="Eliminar esta foto de la galería"
                className="p-2 rounded-full bg-slate-900/90 hover:bg-rose-600 text-slate-300 hover:text-white backdrop-blur-md border border-white/25 transition-all active:scale-95 shadow-md cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreenPhoto(true);
              }}
              title="Ver imagen en tamaño completo"
              className="p-2 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white backdrop-blur-md border border-white/25 transition-transform active:scale-95 shadow-md cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Carousel Arrows */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevPhoto}
                aria-label="Foto anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition-opacity z-20 opacity-80 sm:opacity-0 group-hover/carousel:opacity-100 shadow-md backdrop-blur-xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextPhoto}
                aria-label="Siguiente foto"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition-opacity z-20 opacity-80 sm:opacity-0 group-hover/carousel:opacity-100 shadow-md backdrop-blur-xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Dot Indicators */}
          <div className="absolute bottom-16 inset-x-0 flex justify-center space-x-1.5 z-20 pointer-events-none">
            {images.slice(0, 7).map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentPhotoIdx ? 'w-5 bg-emerald-400' : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom Floating Bar: Price and Tab switcher + Upload Action */}
      <div className="relative z-20 p-3 sm:p-4 flex items-center justify-between pointer-events-auto">
        {/* Price Tag */}
        <div className="bg-emerald-600/95 text-white text-xs px-2.5 py-1 rounded-md font-bold shadow-md">
          ${dome.price_per_night.toLocaleString('es-CO')} COP {t('domes.night')}
        </div>

        {/* Tab & Upload Switcher */}
        <div className="flex items-center space-x-1 bg-slate-950/85 backdrop-blur-md rounded-full p-1 border border-white/15 shadow-lg">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setVideoError(false);
              setActiveTab('video');
              setTimeout(safePlay, 50);
            }}
            className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'video'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>{t('domes.video_tab')}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('photos');
            }}
            className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'photos'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{t('domes.photos_tab')}</span>
          </button>
        </div>
      </div>

      {/* Floating Quick Upload Bar on Mobile */}
      <div className="absolute bottom-1.5 right-3 sm:hidden z-20 flex items-center space-x-1">
        {canEdit && (
<button
          type="button"
          onClick={() => (activeTab === 'video' ? videoInputRef.current?.click() : imageInputRef.current?.click())}
          className="text-[10px] text-emerald-300 underline font-medium"
        >
          {activeTab === 'video' ? `+ ${t('domes.upload_video')}` : `+ ${t('domes.upload_photo')}`}
        </button>
)}
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-emerald-600 text-white text-xs px-3.5 py-1.5 rounded-full font-medium shadow-xl flex items-center space-x-1.5 whitespace-nowrap"
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Photo Modal */}
      <AnimatePresence>
        {isFullscreenPhoto && (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between p-4">
            <div className="flex items-center justify-between text-white z-10">
              <span className="text-sm font-semibold">{dome.name} • {t('domes.photos_tab')} {currentPhotoIdx + 1} {t('domes.of')} {images.length}</span>
              <button
                type="button"
                onClick={() => setIsFullscreenPhoto(false)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="relative flex-1 flex items-center justify-center p-2">
              {(() => {
                const fsPhoto = images[currentPhotoIdx];
                const fsResp = getResponsiveImageData(fsPhoto, '(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px');
                return (
                  <img
                    src={fsResp.webpSrc || fsPhoto}
                    srcSet={fsResp.webpSrcSet || undefined}
                    sizes={fsResp.sizes || undefined}
                    alt={`${dome.name} full`}
                    className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
                  />
                );
              })()}

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevPhoto}
                    className="absolute left-2 sm:left-6 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={nextPhoto}
                    className="absolute right-2 sm:right-6 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 py-2">
              {canEdit && (
<button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md active:scale-95"
              >
                <ImagePlus className="w-4 h-4" />
                <span>{t('domes.upload_photo')}</span>
              </button>
)}

              {canEdit && images.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteCurrentPhoto}
                  className="px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t('domes.delete_photo')}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

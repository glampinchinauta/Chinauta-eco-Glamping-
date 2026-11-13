import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Maximize2, Film, Camera, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import defaultVideoUrl from '../assets/videos/domo_1_huitaca.mp4';
import { ImageCarousel } from './ImageCarousel';
import { useLanguage } from '../context/LanguageContext';
import { useIsAdmin } from '../lib/useIsAdmin';

interface HuitacaVideoCardProps {
  images: string[];
  domeName?: string;
  pricePerNight?: number;
  overlayBadge?: React.ReactNode;
  className?: string;
  onVideoChange?: (url: string) => void;
}

export const HuitacaVideoCard: React.FC<HuitacaVideoCardProps> = ({
  images,
  domeName = 'Domo Huitaca',
  pricePerNight = 350000,
  overlayBadge,
  className = 'h-64 sm:h-72',
  onVideoChange
}) => {
  const { t } = useLanguage();
  const canEdit = useIsAdmin(); // Only a signed-in administrator sees upload controls
  const [activeTab, setActiveTab] = useState<'video' | 'photos'>('video');
  const [videoSrc, setVideoSrc] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('domo_1_custom_video');
      // Expired blob: URLs cause "The element has no supported sources." on page reload
      if (stored && !stored.startsWith('blob:')) {
        return stored;
      }
      if (stored && stored.startsWith('blob:')) {
        localStorage.removeItem('domo_1_custom_video');
      }
    } catch (_) {}
    return defaultVideoUrl || '/assets/videos/domo_1_huitaca.mp4';
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Safely trigger video play with Promise handling
  const safePlay = () => {
    if (videoRef.current) {
      const promise = videoRef.current.play();
      if (promise !== undefined) {
        promise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.debug("Video play waiting or prevented:", err.message);
            setIsPlaying(false);
          });
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
    console.warn("Video failed to load primary source, falling back to static URL or photo gallery.");
    // If current source failed and isn't the direct static path, try the static server path
    if (videoSrc !== '/assets/videos/domo_1_huitaca.mp4') {
      setVideoSrc('/assets/videos/domo_1_huitaca.mp4');
    } else {
      setVideoError(true);
      setActiveTab('photos');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const blobUrl = URL.createObjectURL(file);
      setVideoSrc(blobUrl);
      setVideoError(false);
      setActiveTab('video');
      if (onVideoChange) onVideoChange(blobUrl);

      // Upload to server so it has a permanent non-blob URL
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await fetch('/api/upload-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domeId: 1,
              filename: 'domo_1_huitaca.mp4',
              videoData: base64
            })
          });
          const data = await res.json();
          if (data?.url) {
            localStorage.setItem('domo_1_custom_video', data.url);
            setVideoSrc(data.url);
          }
        } catch (err) {
          console.warn("Backend video upload fallback used:", err);
        }
      };
      reader.readAsDataURL(file);

      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3500);
      safePlay();
    } catch (err) {
      console.error("Error setting video:", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`relative w-full overflow-hidden select-none group bg-slate-950 rounded-t-2xl flex flex-col justify-end ${className}`}>
      {/* Hidden File Input for uploading custom video */}
      {canEdit && (
<input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
      />
)}

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
            <source src="/assets/videos/domo_1_huitaca.mp4" type="video/mp4" />
          </video>

          {/* Cinematic Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/50 pointer-events-none" />

          {/* Center Play/Pause button when paused */}
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

          {/* Top Left: Overlay Badge & Video Tour Badge */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 pointer-events-auto">
            {overlayBadge}
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/85 backdrop-blur-md text-emerald-300 text-[11px] font-semibold border border-emerald-500/30 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{t('domes.video_tour')}</span>
            </span>
          </div>

          {/* Top Right: Upload Video & Fullscreen */}
          <div className="absolute top-3 right-3 z-20 flex items-center space-x-1.5 pointer-events-auto">
            {canEdit && (
<button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              title={`${t('domes.upload_video')} - ${domeName}`}
              className="px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-emerald-600 text-white text-[11px] font-semibold backdrop-blur-md border border-white/20 transition-all flex items-center space-x-1 shadow-sm"
            >
              <Upload className="w-3 h-3" />
              <span className="hidden sm:inline">{t('domes.upload_video')}</span>
            </button>
)}

            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="p-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white backdrop-blur-md border border-white/20 transition-transform active:scale-95 shadow-sm"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-300" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
              className="p-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white backdrop-blur-md border border-white/20 transition-transform active:scale-95 shadow-sm"
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
        <div className="absolute inset-0">
          <ImageCarousel
            images={images}
            alt={domeName}
            className="h-full"
            overlayBadge={overlayBadge}
          />
        </div>
      )}

      {/* Bottom Floating Bar: Price and Tab switcher */}
      <div className="relative z-20 p-3 sm:p-4 flex items-center justify-between pointer-events-auto">
        <div className="bg-emerald-600/95 text-white text-xs px-2.5 py-1 rounded-md font-bold shadow-md">
          ${pricePerNight.toLocaleString('es-CO')} COP {t('domes.night')}
        </div>

        {/* Tab Switcher: Video vs Fotos */}
        <div className="bg-slate-950/85 backdrop-blur-md rounded-full p-0.5 border border-white/15 flex items-center shadow-lg">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setVideoError(false);
              setActiveTab('video');
              setTimeout(safePlay, 50);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center space-x-1.5 ${
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
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center space-x-1.5 ${
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

      {/* Upload Success Banner */}
      <AnimatePresence>
        {uploadSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-xl flex items-center space-x-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{t('domes.toast_video_loaded')} {domeName}!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

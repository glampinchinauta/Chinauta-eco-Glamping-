import React, { useState, useRef } from 'react';
import { MapPin, Phone, Mail, HelpCircle, Upload, Camera, CheckCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageCarousel } from './ImageCarousel';
import { useLanguage } from '../context/LanguageContext';
import { useIsAdmin } from '../lib/useIsAdmin';

export const ContactView: React.FC = () => {
  const canEdit = useIsAdmin(); // Only a signed-in administrator can change the photo gallery
  const { t, language } = useLanguage();
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await fetch('/api/upload-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              mediaData: base64,
              type: 'image'
            })
          });
          const data = await res.json();
          if (data?.url) {
            setGalleryImages([data.url, ...galleryImages]);
            showToast('¡Imagen subida con éxito a la galería de Chinauta!');
          } else {
            showToast('Error al subir la imagen.');
          }
        } catch (err) {
          console.error(err);
          showToast('Error de conexión al subir imagen.');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
    }
  };

  const removeGalleryImage = (indexToRemove: number) => {
    setGalleryImages(galleryImages.filter((_, idx) => idx !== indexToRemove));
    showToast('Imagen eliminada de la galería.');
  };

  const faqs = [
    {
      q: t('contact.faq1_q'),
      a: t('contact.faq1_a')
    },
    {
      q: t('contact.faq2_q'),
      a: t('contact.faq2_a')
    },
    {
      q: t('contact.faq3_q'),
      a: t('contact.faq3_a')
    },
    {
      q: t('contact.faq4_q'),
      a: t('contact.faq4_a')
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 relative"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-24 lg:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-3 border border-emerald-500/30"
          >
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-medium">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-emerald-600 font-bold">{t('contact.badge')}</h2>
        <h3 className="text-3xl sm:text-4xl font-bold text-slate-900">{t('contact.hero_title')}</h3>
        <p className="text-slate-600">
          {t('contact.hero_desc')}
        </p>
      </div>

      {/* Visual Tour Carousel of Facilities & Access */}
      <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden shadow-xl border border-slate-200">
        <ImageCarousel
          images={[
            'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1200&q=80'
          ]}
          alt={t('contact.carousel_alt')}
          className="h-72 sm:h-96"
          overlayBadge={
            <div className="bg-slate-900/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-sm">
              {t('contact.carousel_badge')}
            </div>
          }
        />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="glass-card p-8 rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm hover:shadow-md transition-all">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <Phone className="w-7 h-7" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">{t('contact.phone_title')}</h4>
          <p className="text-slate-600 text-sm">+57 321 310 9331</p>
          <a
            href="https://wa.me/573213109331"
            target="_blank"
            rel="noreferrer"
            className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors"
          >
            {t('contact.whatsapp_btn')}
          </a>
        </div>

        <div className="glass-card p-8 rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm hover:shadow-md transition-all">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">{t('contact.email_card_title')}</h4>
          <p className="text-slate-600 text-sm">ecoglampingventas@gmail.com</p>
          <a
            href="mailto:ecoglampingventas@gmail.com"
            className="inline-block px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors"
          >
            {t('contact.email_btn')}
          </a>
        </div>

        <div className="glass-card p-8 rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm hover:shadow-md transition-all">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <MapPin className="w-7 h-7" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">{t('contact.location_card_title')}</h4>
          <p className="text-slate-600 text-sm">Vía Principal Chinauta Km 4.5, Fusagasugá, Cundinamarca</p>
          <span className="inline-block text-xs text-emerald-700 font-semibold">{t('contact.location_travel_time')}</span>
        </div>
      </div>

      {/* Chinauta Fusagasugá Photo Gallery & Upload Section */}
      <div className="glass-card p-8 sm:p-10 rounded-3xl border border-slate-200 space-y-8 bg-gradient-to-b from-white to-slate-50 shadow-md">
        {canEdit && (
<input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />
)}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/80 pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'en' ? 'Chinauta Fusagasugá Gallery' : 'Galería Chinauta Fusagasugá'}</span>
            </div>
            <h4 className="text-2xl font-bold text-slate-900">Postales y Momentos en Chinauta</h4>
            <p className="text-sm text-slate-600">Fotos reales de los domos y paisajes de Chinauta.</p>
          </div>

          {canEdit && (
<button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-emerald-700/20 hover:from-emerald-700 hover:to-teal-800 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{isUploading ? 'Subiendo imagen...' : 'Subir Imagen a la Galería'}</span>
          </button>
)}
        </div>

        {galleryImages.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-3">
            <Camera className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm">No hay imágenes en la galería actualmente. ¡Sube tu primera foto usando el botón de arriba!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {galleryImages.map((imgUrl, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="h-56 rounded-2xl overflow-hidden shadow-md border border-slate-200 group relative bg-slate-100"
              >
                <img
                  src={imgUrl}
                  alt={`Chinauta Fusagasugá ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                  <span className="text-white text-xs font-medium flex items-center space-x-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Chinauta Fusagasugá</span>
                  </span>
                  {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeGalleryImage(index)}
                    className="p-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs transition-colors shadow-sm cursor-pointer"
                    title="Eliminar imagen"
                  >
                    🗑️
                  </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* FAQs */}
      <div className="max-w-4xl mx-auto space-y-6">
        <h4 className="text-2xl font-bold text-slate-900 text-center mb-8">{t('contact.faq_heading')}</h4>
        
        {faqs.map((faq, idx) => (
          <div key={idx} className="glass-card p-6 rounded-2xl border border-slate-200 space-y-2 shadow-sm">
            <h5 className="font-bold text-slate-900 flex items-center space-x-2">
              <HelpCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{faq.q}</span>
            </h5>
            <p className="text-slate-600 text-sm pl-7 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>

    </motion.div>
  );
};

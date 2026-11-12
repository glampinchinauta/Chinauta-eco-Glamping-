import React, { useState, useEffect, useRef } from 'react';
import { Star, CheckCircle2, Quote, Upload, Camera, Plus, X, ImagePlus, Video, CheckCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { getResponsiveImageData } from '../utils/imageUtils';
import { useIsAdmin } from '../lib/useIsAdmin';

export interface Testimonial {
  id: string | number;
  name: string;
  location: string;
  dome: string;
  rating: number;
  date: string;
  comment: string;
  avatar: string;
  image?: string | null;
  video_url?: string | null;
}

// Sin reseñas de ejemplo: solo se muestran opiniones reales enviadas por huéspedes.
const DEFAULT_TESTIMONIALS: Testimonial[] = [];

export const TestimonialsSection: React.FC = () => {
  const canEdit = useIsAdmin(); // Only a signed-in administrator can add or edit testimonials
  const { t, language } = useLanguage();
  const [testimonials, setTestimonials] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeUploadTarget, setActiveUploadTarget] = useState<{ id: string | number; type: 'image' | 'video' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for new review
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDome, setNewDome] = useState('Domo Huitaca');
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/testimonials')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTestimonials(data);
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Upload photo/video for an existing testimonial card
  const handleCardMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadTarget) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const isVideo = activeUploadTarget.type === 'video' || file.type.startsWith('video');
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
          if (data?.url) {
            const updated = testimonials.map(t => {
              if (t.id === activeUploadTarget.id) {
                return isVideo ? { ...t, video_url: data.url, image: null } : { ...t, image: data.url, video_url: null };
              }
              return t;
            });
            setTestimonials(updated);

            // Update server
            await fetch(`/api/testimonials/${activeUploadTarget.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(isVideo ? { video_url: data.url } : { image: data.url })
            });

            showToast(language === 'en' ? 'Guest media updated!' : '¡Foto/video de huésped actualizado!');
          }
        } catch (err) {
          console.error("Error updating testimonial media:", err);
        } finally {
          setIsUploading(false);
          setActiveUploadTarget(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
    }
  };

  // Upload photo/video inside Modal
  const handleModalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const isVideo = file.type.startsWith('video');
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
              type: isVideo ? 'video' : 'image'
            })
          });
          const data = await res.json();
          if (data?.url) {
            setNewMediaUrl(data.url);
            setNewMediaType(isVideo ? 'video' : 'image');
            showToast(language === 'en' ? 'Media uploaded successfully!' : '¡Archivo cargado con éxito!');
          }
        } catch (err) {
          console.error(err);
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

  // Submit new testimonial
  const handleCreateTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newComment) return;

    const newTestimonial: Testimonial = {
      id: Date.now(),
      name: newName,
      location: newLocation || (language === 'en' ? 'Guest' : 'Huésped'),
      dome: newDome,
      rating: newRating,
      date: language === 'en' ? 'Recent Stay' : 'Estadía Reciente',
      comment: newComment,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      image: newMediaType === 'image' ? newMediaUrl : null,
      video_url: newMediaType === 'video' ? newMediaUrl : null
    };

    setTestimonials([newTestimonial, ...testimonials]);
    setIsAddModalOpen(false);

    try {
      await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTestimonial)
      });
      showToast(t('testimonials.success_msg'));
    } catch (err) {
      console.warn("Server testimonial create notice:", err);
    }

    // Reset Form
    setNewName('');
    setNewLocation('');
    setNewComment('');
    setNewMediaUrl('');
  };

  return (
    <section className="py-20 bg-slate-50 border-y border-slate-200/60 relative">
      {canEdit && (
<input
        type="file"
        ref={fileInputRef}
        onChange={handleCardMediaUpload}
        accept="image/*,video/*"
        className="hidden"
      />
)}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Header with Add Testimonial Action */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-4 text-center md:text-left max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
              <Star className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              <span>{t('testimonials.tag')}</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-bold text-slate-900">
              {t('testimonials.title')}
            </h3>
            <p className="text-slate-600 text-base">
              {t('testimonials.desc')}
            </p>
          </div>

          {canEdit && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto justify-center px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs sm:text-sm flex items-center space-x-2 shadow-lg shadow-emerald-700/20 transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('testimonials.add_btn')}</span>
          </button>
          )}
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map(item => (
            <div
              key={item.id}
              className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-lg flex flex-col justify-between space-y-6 relative overflow-hidden group hover:shadow-xl transition-all"
            >
              <div className="absolute top-6 right-6 text-emerald-600/20 group-hover:text-emerald-600/30 transition-colors pointer-events-none">
                <Quote className="w-10 h-10" />
              </div>

              <div className="space-y-4 relative z-10">
                {/* Rating stars */}
                <div className="flex items-center space-x-1">
                  {[...Array(item.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />
                  ))}
                  <span className="text-xs font-bold text-slate-700 ml-2">{item.rating}.0</span>
                </div>

                <p className="text-slate-700 text-sm leading-relaxed italic">
                  "{item.comment}"
                </p>

                {/* Real Guest Photo (Videos are kept in data but hidden as requested) */}
                {item.image ? (
                  <div className="h-52 rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative group/img">
                    {(() => {
                      const testImg = getResponsiveImageData(item.image, '(max-width: 640px) 100vw, 400px');
                      return (
                        <img
                          src={testImg.webpSrc || item.image}
                          srcSet={testImg.webpSrcSet || undefined}
                          sizes={testImg.sizes || undefined}
                          alt={item.dome}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      );
                    })()}
                  </div>
                ) : null}

                {/* Quick Upload Action on Card */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  {canEdit && (
<button
                    type="button"
                    onClick={() => {
                      setActiveUploadTarget({ id: item.id, type: 'image' });
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200/70 transition-all active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t('testimonials.upload_photo_btn')}</span>
                  </button>
)}

                  {canEdit && (
<button
                    type="button"
                    onClick={() => {
                      setActiveUploadTarget({ id: item.id, type: 'video' });
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center space-x-1.5 text-xs text-teal-700 font-semibold hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl border border-teal-200/70 transition-all active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <Video className="w-3.5 h-3.5 text-teal-600" />
                    <span>{t('testimonials.upload_video_btn')}</span>
                  </button>
)}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between relative z-10">
                <div className="flex items-center space-x-3">
                  <img
                    src={item.avatar}
                    alt={item.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500"
                  />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                    <p className="text-xs text-slate-500">{item.location}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-semibold">
                    {item.dome}
                  </span>
                  <div className="flex items-center justify-end space-x-1 text-[10px] text-emerald-600 mt-1">
                    <span>{language === 'en' ? 'Guest review' : 'Reseña de huésped'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {testimonials.length === 0 && (
          <p className="text-center text-sm text-slate-600">
            {language === 'en'
              ? 'No guest reviews have been published yet. Share your stay with us!'
              : 'Todavía no hay reseñas publicadas. ¡Cuéntanos tu experiencia!'}
          </p>
        )}

      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-xs px-4 py-2.5 rounded-full font-semibold shadow-2xl flex items-center space-x-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Testimonial Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-lg text-slate-900">
                    {t('testimonials.modal_title')}
                  </h3>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTestimonial} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {t('testimonials.name_label')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder={t('testimonials.name_ph')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      {t('testimonials.city_label')}
                    </label>
                    <input
                      type="text"
                      value={newLocation}
                      onChange={e => setNewLocation(e.target.value)}
                      placeholder={t('testimonials.city_ph')}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      {t('testimonials.dome_label')}
                    </label>
                    <select
                      value={newDome}
                      onChange={e => setNewDome(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 focus:outline-hidden bg-white"
                    >
                      <option value="Domo Huitaca">{language === 'en' ? 'Dome 1 — Huitaca' : 'Domo 1 — Huitaca'}</option>
                      <option value="Domo Bochica">{language === 'en' ? 'Dome 2 — Bochica' : 'Domo 2 — Bochica'}</option>
                      <option value="Domo Bachué">{language === 'en' ? 'Dome 3 — Bachué' : 'Domo 3 — Bachué'}</option>
                      <option value="Domo Luna Chía">{language === 'en' ? 'Dome 4 — Luna Chía' : 'Domo 4 — Luna Chía'}</option>
                      <option value="Domo Chiminichagua">{language === 'en' ? 'Dome 5 — Chiminichagua' : 'Domo 5 — Chiminichagua'}</option>
                      <option value="Domo Xue Sol">{language === 'en' ? 'Dome 6 — Xue Sol' : 'Domo 6 — Xue Sol'}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {t('testimonials.rating_label')}
                  </label>
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setNewRating(star)}
                        className="p-1"
                      >
                        <Star className={`w-6 h-6 ${star <= newRating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {t('testimonials.comment_label')}
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder={t('testimonials.comment_ph')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* Upload Real Vacation Photo/Video */}
{canEdit && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    {t('testimonials.upload_photo_btn')} / {t('testimonials.upload_video_btn')}
                  </label>

                  {canEdit && (
<input
                    type="file"
                    ref={modalFileInputRef}
                    onChange={handleModalFileUpload}
                    accept="image/*,video/*"
                    className="hidden"
                  />
)}

                  <div className="flex items-center space-x-3">
                    {canEdit && (
<button
                      type="button"
                      onClick={() => modalFileInputRef.current?.click()}
                      disabled={isUploading}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center space-x-2 transition-colors border border-slate-300"
                    >
                      <ImagePlus className="w-4 h-4 text-emerald-600" />
                      <span>{isUploading ? '...' : t('testimonials.upload_photo_btn')}</span>
                    </button>
)}

                    {newMediaUrl && (
                      <span className="text-xs text-emerald-700 font-medium flex items-center space-x-1">
                        <CheckCircle className="w-4 h-4" />
                        <span>✓</span>
                      </span>
                    )}
                  </div>

                  {newMediaUrl && (
                    <div className="mt-2 h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center">
                      {newMediaType === 'video' ? (
                        <video src={newMediaUrl} controls className="h-full object-cover" />
                      ) : (
                        <img src={newMediaUrl} alt="Preview" className="h-full object-cover" />
                      )}
                    </div>
                  )}
                </div>
)}


                <div className="pt-4 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    {t('testimonials.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md"
                  >
                    {t('testimonials.submit')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};

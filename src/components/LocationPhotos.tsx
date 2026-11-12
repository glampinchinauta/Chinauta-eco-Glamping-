import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, Trash2 } from 'lucide-react';
import { ImageCarousel } from './ImageCarousel';
import { useIsAdmin } from '../lib/useIsAdmin';

interface LocationPhoto {
  id: number;
  url: string;
}

interface LocationPhotosProps {
  defaultImages: string[];
  alt: string;
}

export const LocationPhotos: React.FC<LocationPhotosProps> = ({ defaultImages, alt }) => {
  const canEdit = useIsAdmin(); // Only a signed-in administrator can add or remove photos
  const [photos, setPhotos] = useState<LocationPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/location-photos');
      const data = await res.json();
      if (Array.isArray(data)) setPhotos(data);
    } catch {
      // Sin conexión: se muestran las fotos por defecto
    }
  };

  useEffect(() => {
    load();
  }, []);

  const images = photos.length > 0 ? photos.map(p => p.url) : defaultImages;

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    let ok = 0;
    let failed = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        failed++;
        continue;
      }
      try {
        const mediaData = await readAsDataUrl(file);
        const up = await fetch('/api/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, mediaData, type: 'image' })
        });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok || !upData.url) throw new Error(upData.error || 'No se pudo subir la imagen.');

        const save = await fetch('/api/location-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: upData.url })
        });
        const saveData = await save.json().catch(() => ({}));
        if (!save.ok || !saveData.success) throw new Error(saveData.error || 'No se pudo guardar la foto.');
        ok++;
      } catch {
        failed++;
      }
    }
    await load();
    setBusy(false);
    setMsg(failed === 0 ? `${ok} foto(s) guardada(s).` : `${ok} guardada(s), ${failed} no se pudieron subir.`);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Quitar esta foto?')) return;
    setBusy(true);
    try {
      await fetch(`/api/location-photos/${id}`, { method: 'DELETE' });
      await load();
    } catch {
      setMsg('No se pudo quitar la foto.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden shadow-lg border border-slate-200">
        <ImageCarousel
          images={images}
          alt={alt}
          className="h-80 sm:h-96"
          overlayBadge={
            <div className="bg-slate-900/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-sm">
              Chinauta, Fusagasugá
            </div>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canEdit && (
<input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
)}
        {canEdit && (
<button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
        >
          <UploadCloud className="w-4 h-4" />
          <span>{busy ? 'Procesando...' : 'Subir fotos'}</span>
        </button>
)}
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, idx) => (
            <div key={p.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
              <img src={p.url} alt={`${alt} - foto ${idx + 1}`} className="w-full h-full object-cover" />
              {canEdit && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleDelete(p.id)}
                className="absolute top-0.5 right-0.5 bg-slate-900/80 text-white rounded-full p-0.5 hover:bg-rose-600"
                aria-label="Quitar foto"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

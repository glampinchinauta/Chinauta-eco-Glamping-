import React, { useEffect, useState } from 'react';
import { Navigation, MapPin, Send, Loader2 } from 'lucide-react';
import type { Reservation } from '../../types';
import { whatsappLink } from './ui';

/** Sin datos en este tiempo, la ubicación se muestra como "sin actualizar". */
const STALE_MS = 15 * 60 * 1000;

const formatEta = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};
const timeOf = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' }) : '';

export const onTheWayLink = (code: string) => `${window.location.origin}/?en-camino=${encodeURIComponent(code)}`;

/** Línea de "Voy en camino" para una llegada de hoy en el panel. */
export const TripStatus: React.FC<{ r: Reservation }> = ({ r }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick(x => x + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  const updated = r.trip_updated_at ? Date.parse(r.trip_updated_at) : 0;
  const ago = updated ? Math.max(0, Math.round((Date.now() - updated) / 60000)) : 0;
  const stale = !updated || Date.now() - updated > STALE_MS;

  if (r.trip_status === 'llego') {
    return <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />Llegó al glamping</p>;
  }

  if (r.trip_status === 'en_camino') {
    const map = r.trip_lat != null && r.trip_lng != null ? `https://www.google.com/maps?q=${r.trip_lat},${r.trip_lng}` : '';
    const close = (r.trip_eta_min ?? 999) <= 30;
    return (
      <div className={`mt-1 rounded-lg px-2.5 py-1.5 text-xs ${stale ? 'bg-slate-100 text-slate-600' : close ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
        <p className="font-semibold flex items-center gap-1">
          <Navigation className="w-3.5 h-3.5" />
          {r.trip_eta_min != null && !stale
            ? <>En camino · llega en ~{formatEta(r.trip_eta_min)}{r.trip_distance_km != null ? ` (${r.trip_distance_km} km)` : ''}</>
            : stale ? <>En camino · sin actualizar desde las {timeOf(r.trip_updated_at)}</> : <>En camino</>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2">
          {!stale && <span>Actualizado {ago === 0 ? 'hace un momento' : `hace ${ago} min`}</span>}
          {r.trip_eta_source === 'estimado' && !stale && <span>· tiempo aproximado</span>}
          {map && <a href={map} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Ver en el mapa</a>}
        </p>
        {stale && <p className="mt-0.5">Puede haber cerrado la página: escríbele por WhatsApp.</p>}
      </div>
    );
  }

  // Aún no lo activa: enviarle el enlace por WhatsApp.
  const wa = whatsappLink(r.customer_whatsapp || r.customer_phone,
    `Hola ${r.customer_name}, te esperamos hoy en Eco Glamping Chinauta. Cuando salgas, abre este enlace y toca "Voy en camino" para saber a qué hora llegas: ${onTheWayLink(r.reservation_code)} (deja la página abierta durante el viaje).`);
  return wa ? (
    <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
      <Send className="w-3.5 h-3.5" />Enviar enlace "Voy en camino"
    </a>
  ) : null;
};

/** Dónde queda el glamping: necesario para calcular cuánto le falta a cada huésped. */
export const GlampingLocationCard: React.FC<{ notify?: (msg: string, kind?: 'error') => void }> = ({ notify }) => {
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    fetch('/api/trip/destination').then(r => (r.ok ? r.json() : null)).then(setLoc).catch(() => setLoc(null));
  }, []);

  const save = async (lat: number, lng: number) => {
    setBusy(true);
    try {
      const res = await fetch('/api/trip/destination', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lng }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar.');
      setLoc({ lat: data.lat, lng: data.lng });
      notify?.('Ubicación del glamping guardada');
    } catch (err: any) {
      notify?.(err.message || 'No se pudo guardar la ubicación', 'error');
    } finally {
      setBusy(false);
    }
  };

  const useHere = () => {
    if (!navigator.geolocation) return notify?.('Este navegador no permite leer la ubicación', 'error');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      p => save(Number(p.coords.latitude.toFixed(6)), Number(p.coords.longitude.toFixed(6))),
      () => { setBusy(false); notify?.('No se pudo leer la ubicación. Revisa el permiso del navegador.', 'error'); },
      { enableHighAccuracy: true, timeout: 20000 },
    );
  };

  const saveManual = () => {
    const m = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(manual);
    if (!m) return notify?.('Pega las coordenadas así: 4.28123, -74.40123', 'error');
    save(Number(m[1]), Number(m[2]));
  };

  if (loc === undefined || loc) {
    return loc ? (
      <p className="text-xs text-slate-500">
        "Voy en camino" calcula los tiempos hasta el glamping ({loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}).{' '}
        <button type="button" onClick={() => setLoc(null)} className="underline font-semibold">Cambiar</button>
      </p>
    ) : null;
  }

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
      <p className="text-sm font-bold text-amber-900">Falta la ubicación del glamping para "Voy en camino"</p>
      <p className="text-sm text-amber-900">
        Sin ella el panel ve que el huésped va en camino, pero no cuánto le falta. Hazlo una sola vez: estando en el glamping toca
        "Usar mi ubicación actual", o pega las coordenadas de Google Maps (clic derecho sobre el glamping, copiar coordenadas).
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" onClick={useHere} disabled={busy}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center justify-center gap-2 cursor-pointer">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}Usar mi ubicación actual
        </button>
        <input value={manual} onChange={e => setManual(e.target.value)} placeholder="4.28123, -74.40123"
          className="flex-1 px-3 py-2.5 rounded-xl border border-amber-300 bg-white text-sm" aria-label="Coordenadas del glamping" />
        <button type="button" onClick={saveManual} disabled={busy}
          className="px-4 py-2.5 rounded-xl border border-amber-400 bg-white text-amber-900 text-sm font-semibold hover:bg-amber-100 disabled:opacity-60 cursor-pointer">
          Guardar coordenadas
        </button>
      </div>
    </div>
  );
};

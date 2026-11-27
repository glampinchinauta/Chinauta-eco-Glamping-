import React, { useEffect, useRef, useState } from 'react';
import { X, Navigation, MapPin, CheckCircle2, AlertTriangle, MessageCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { readJson } from '../utils/api';
import { whatsappLink } from '../config/business';

/**
 * "Voy en camino": el día de llegada el huésped comparte su ubicación mientras esta página
 * está abierta, y el equipo ve en el panel cuánto le falta. Solo se guarda la última ubicación
 * y se borra al llegar. Una página web no puede seguir la ubicación con el navegador cerrado,
 * por eso se pide dejarla abierta y se mantiene la pantalla encendida cuando el teléfono lo permite.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  initialContact?: string;
}

type Phase = 'form' | 'starting' | 'tracking' | 'arrived' | 'stopped';
interface TripInfo { status: string; eta_min: number | null; distance_km: number | null; eta_source: string; dome_name?: string }

/** Cada cuánto se envía la ubicación (y antes si se movió bastante). */
const SEND_EVERY_MS = 3 * 60 * 1000;
const SEND_IF_MOVED_KM = 2;

const kmBetween = (a: GeolocationCoordinates, b: GeolocationCoordinates) => {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const formatEta = (min: number | null | undefined, en = false) => {
  if (min == null) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

export const OnTheWayModal: React.FC<Props> = ({ isOpen, onClose, initialCode = '', initialContact = '' }) => {
  const { language } = useLanguage();
  const en = language === 'en';
  const [code, setCode] = useState(initialCode);
  const [contact, setContact] = useState(initialContact);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState('');
  const [info, setInfo] = useState<TripInfo | null>(null);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const watchId = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const wakeLock = useRef<any>(null);
  const lastPos = useRef<GeolocationCoordinates | null>(null);
  const lastSentPos = useRef<GeolocationCoordinates | null>(null);
  const sending = useRef(false);
  const started = useRef(false);

  useEffect(() => { setCode(initialCode); }, [initialCode]);
  useEffect(() => { setContact(initialContact); }, [initialContact]);
  // Cada vez que se abre, empieza en el formulario (salvo que siga compartiendo).
  useEffect(() => {
    if (!isOpen) return;
    setCode(initialCode);
    setContact(initialContact);
    if (phase === 'stopped' || phase === 'arrived') { setPhase('form'); setInfo(null); setConsent(false); setError(''); }
  }, [isOpen]);

  // Refresca "hace X min" cada 30 s.
  useEffect(() => {
    if (phase !== 'tracking') return;
    const t = window.setInterval(() => setTick(x => x + 1), 30000);
    return () => window.clearInterval(t);
  }, [phase]);

  const releaseAll = () => {
    if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
    watchId.current = null;
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = null;
    try { wakeLock.current?.release?.(); } catch { /* ya liberado */ }
    wakeLock.current = null;
  };
  useEffect(() => () => releaseAll(), []);

  const keepScreenOn = async () => {
    try {
      const nav: any = navigator;
      if (nav.wakeLock?.request && !wakeLock.current) wakeLock.current = await nav.wakeLock.request('screen');
    } catch { /* el teléfono no lo permite: se pide dejar la página abierta */ }
  };

  const send = async (action: 'start' | 'update', pos: GeolocationCoordinates) => {
    if (sending.current) return;
    sending.current = true;
    try {
      const res = await fetch('/api/trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(), contact: contact.trim(), action, consent: action === 'start' ? true : undefined,
          lat: pos.latitude, lng: pos.longitude, accuracy: pos.accuracy,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || (en ? 'Could not send your location.' : 'No se pudo enviar tu ubicación.'));
      lastSentPos.current = pos;
      setLastSent(Date.now());
      setInfo(data);
      setError('');
      if (data.status === 'llego') {
        releaseAll();
        setPhase('arrived');
      } else if (action === 'start') {
        setPhase('tracking');
      }
    } catch (err: any) {
      setError(err.message);
      if (action === 'start') { releaseAll(); started.current = false; setPhase('form'); }
    } finally {
      sending.current = false;
    }
  };

  // Al volver a la página (por ejemplo tras contestar una llamada), envía de inmediato.
  useEffect(() => {
    if (phase !== 'tracking') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        keepScreenOn();
        if (lastPos.current) send('update', lastPos.current);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [phase]);

  if (!isOpen) return null;

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!code.trim() || !contact.trim()) {
      setError(en ? 'Enter your booking code and the email or phone you booked with.' : 'Escribe tu código de reserva y el correo o teléfono con el que reservaste.');
      return;
    }
    if (!consent) {
      setError(en ? 'Please authorize sharing your location to continue.' : 'Para continuar, autoriza compartir tu ubicación.');
      return;
    }
    if (!('geolocation' in navigator)) {
      setError(en ? 'This phone or browser cannot share location. Use WhatsApp live location instead.' : 'Este teléfono o navegador no permite compartir la ubicación. Usa la ubicación en tiempo real de WhatsApp.');
      return;
    }
    setPhase('starting');
    started.current = false;
    keepScreenOn();
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        lastPos.current = pos.coords;
        if (!started.current) {
          started.current = true;
          send('start', pos.coords);
          timer.current = window.setInterval(() => { if (lastPos.current) send('update', lastPos.current); }, SEND_EVERY_MS);
        } else if (lastSentPos.current && kmBetween(lastSentPos.current, pos.coords) >= SEND_IF_MOVED_KM) {
          send('update', pos.coords);
        }
      },
      err => {
        releaseAll();
        started.current = false;
        setPhase('form');
        setError(err.code === err.PERMISSION_DENIED
          ? (en ? 'Location permission was denied. Allow location for this site in your browser settings and try again.'
                : 'No diste permiso de ubicación. Actívalo para esta página en la configuración del navegador e inténtalo de nuevo.')
          : (en ? 'We could not get your location. Check that GPS is on and try again.'
                : 'No pudimos obtener tu ubicación. Revisa que el GPS esté encendido e inténtalo de nuevo.'));
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 },
    );
  };

  const stop = async () => {
    releaseAll();
    setPhase('stopped');
    try {
      await fetch('/api/trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), contact: contact.trim(), action: 'stop' }),
      });
    } catch { /* si falla, la ubicación igual se borra sola a las 12 horas */ }
  };

  const close = () => {
    if (phase === 'tracking' && !window.confirm(en ? 'If you close this, we stop seeing your location. Close anyway?' : 'Si cierras, dejamos de ver tu ubicación. ¿Cerrar de todos modos?')) return;
    if (phase === 'tracking' || phase === 'starting') stop();
    onClose();
  };

  const minutesAgo = lastSent ? Math.max(0, Math.round((Date.now() - lastSent) / 60000)) : null;
  const waFallback = whatsappLink(en
    ? `Hi, I'm on my way to Eco Glamping Chinauta (booking ${code.trim().toUpperCase()}). I'll share my live location here.`
    : `Hola, voy en camino a Eco Glamping Chinauta (reserva ${code.trim().toUpperCase()}). Les comparto mi ubicación en tiempo real por aquí.`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="otw-title">
      <div className="m-auto w-full max-w-lg rounded-3xl shadow-2xl bg-white overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Navigation className="w-5 h-5" /></div>
            <div>
              <h3 id="otw-title" className="text-lg font-bold">{en ? "I'm on my way" : 'Voy en camino'}</h3>
              <p className="text-xs text-emerald-200">{en ? 'So our team can welcome you on time' : 'Para recibirte a tiempo'}</p>
            </div>
          </div>
          <button onClick={close} aria-label={en ? 'Close' : 'Cerrar'} className="p-2 rounded-xl hover:bg-white/10 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex gap-2" role="alert">
              <AlertTriangle className="w-5 h-5 shrink-0" /><span>{error}</span>
            </div>
          )}

          {(phase === 'form' || phase === 'starting') && (
            <form onSubmit={start} className="space-y-4">
              <p className="text-sm text-slate-600">
                {en
                  ? 'On your arrival day, share your location while you travel. Our team will see how long until you arrive.'
                  : 'El día de tu llegada, comparte tu ubicación mientras viajas. Nuestro equipo verá cuánto te falta para llegar.'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-700 uppercase space-y-1">
                  <span>{en ? 'Booking code' : 'Código de reserva'}</span>
                  <input value={code} onChange={e => setCode(e.target.value)} placeholder="EGC-1234" autoCapitalize="characters"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium normal-case" />
                </label>
                <label className="text-xs font-semibold text-slate-700 uppercase space-y-1">
                  <span>{en ? 'Email or phone' : 'Correo o teléfono'}</span>
                  <input value={contact} onChange={e => setContact(e.target.value)} placeholder={en ? 'The one you booked with' : 'El que usaste al reservar'}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium normal-case" />
                </label>
              </div>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {en
                    ? 'I authorize Eco Glamping Chinauta to receive my location only while this page is open today, to know my arrival time. Only the latest location is kept and it is deleted when I arrive or stop sharing.'
                    : 'Autorizo a Eco Glamping Chinauta a recibir mi ubicación solo mientras esta página esté abierta hoy, para saber a qué hora llego. Se guarda solo la última ubicación y se borra al llegar o al detener.'}
                </span>
              </label>
              <button type="submit" disabled={phase === 'starting'}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
                {phase === 'starting' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
                {phase === 'starting' ? (en ? 'Getting your location…' : 'Buscando tu ubicación…') : (en ? "Start: I'm on my way" : 'Empezar: voy en camino')}
              </button>
              <p className="text-xs text-slate-500 text-center">
                {en ? 'Your phone will ask for permission to use your location.' : 'Tu teléfono te pedirá permiso para usar la ubicación.'}
              </p>
            </form>
          )}

          {phase === 'tracking' && info && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center" aria-live="polite">
                <p className="text-sm font-semibold text-emerald-800">{en ? 'Sharing your location' : 'Compartiendo tu ubicación'}</p>
                {info.eta_min != null ? (
                  <>
                    <p className="text-4xl font-black text-emerald-900 mt-1">{formatEta(info.eta_min, en)}</p>
                    <p className="text-sm text-emerald-800">
                      {en ? 'to arrive' : 'para llegar'}{info.distance_km != null ? ` · ${info.distance_km} km` : ''}
                      {info.eta_source === 'estimado' ? (en ? ' (approx.)' : ' (aprox.)') : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-bold text-emerald-900 mt-1">{en ? 'Our team can see you are on your way' : 'El equipo ya ve que vas en camino'}</p>
                )}
                <p className="text-xs text-emerald-700 mt-2">
                  {minutesAgo === null ? '' : minutesAgo === 0 ? (en ? 'Updated just now' : 'Actualizado hace un momento') : (en ? `Updated ${minutesAgo} min ago` : `Actualizado hace ${minutesAgo} min`)}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-1">
                <p className="font-bold">{en ? 'Keep this page open' : 'Deja esta página abierta'}</p>
                <p>{en
                  ? 'If you close the browser or lock your phone, we stop receiving your location. Keeping the phone charging helps.'
                  : 'Si cierras el navegador o bloqueas el teléfono, dejamos de recibir tu ubicación. Ayuda dejar el teléfono cargando.'}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <a href={waFallback} target="_blank" rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-emerald-200 bg-white text-emerald-700 text-sm font-semibold hover:bg-emerald-50">
                  <MessageCircle className="w-4 h-4" />{en ? 'Share on WhatsApp instead' : 'Compartir por WhatsApp'}
                </a>
                <button type="button" onClick={stop}
                  className="flex-1 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 cursor-pointer">
                  {en ? 'Stop sharing' : 'Dejar de compartir'}
                </button>
              </div>
            </div>
          )}

          {phase === 'arrived' && (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
              <p className="text-2xl font-bold text-slate-900">{en ? 'You have arrived!' : '¡Llegaste!'}</p>
              <p className="text-sm text-slate-600">{en ? 'Welcome to Eco Glamping Chinauta. We stopped sharing your location.' : 'Bienvenido a Eco Glamping Chinauta. Ya dejamos de recibir tu ubicación.'}</p>
              <button onClick={onClose} className="px-6 py-3 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer">{en ? 'Close' : 'Cerrar'}</button>
            </div>
          )}

          {phase === 'stopped' && (
            <div className="text-center space-y-3 py-4">
              <MapPin className="w-12 h-12 text-slate-400 mx-auto" />
              <p className="text-lg font-bold text-slate-900">{en ? 'You stopped sharing your location' : 'Dejaste de compartir tu ubicación'}</p>
              <p className="text-sm text-slate-600">{en ? 'We deleted it. You can start again anytime today.' : 'La borramos. Puedes volver a activarlo cuando quieras hoy.'}</p>
              <div className="flex justify-center gap-2">
                <button onClick={() => { setPhase('form'); setInfo(null); }} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold cursor-pointer">{en ? 'Start again' : 'Volver a activar'}</button>
                <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-300 font-semibold cursor-pointer">{en ? 'Close' : 'Cerrar'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

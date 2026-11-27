import React, { useState, useEffect } from 'react';
import { X, Calendar, Compass, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, CreditCard, Sparkles, Heart, Sun, Clock, Dog, Wine } from 'lucide-react';
import { Dome } from '../types';
import { ImageCarousel } from './ImageCarousel';
import { getDomeImages, DEFAULT_DOMES } from '../utils/domeImages';
import { useLanguage } from '../context/LanguageContext';
import { readJson } from '../utils/api';
import { CHINAUTA_MENU_ITEMS } from './FoodMenuSection';
import { isColombianHoliday } from '../utils/colombiaHolidays';
import { auth } from '../lib/firebase';
import {
  whatsappLink, MASSAGE_PRICES, MASSAGE_TYPE_LABELS, MASSAGE_THERAPIST_LABELS, MASSAGE_PHOTOS, DEPOSIT_PERCENT,
  type MassageType, type MassageTherapist,
} from '../config/business';

// Pasos del asistente: 7 masajes, 8 comida, 9 datos y pago, 10 confirmación.
const MASSAGE_STEP = 7;
const FOOD_STEP = 8;
const CONTACT_STEP = 9;
const DONE_STEP = 10;

// Países para el número de WhatsApp (el código se guarda junto con el número).
const PHONE_COUNTRIES = [
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴' },
  { code: 'US', name: 'Estados Unidos', dial: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá', dial: '+1', flag: '🇨🇦' },
  { code: 'MX', name: 'México', dial: '+52', flag: '🇲🇽' },
  { code: 'VE', name: 'Venezuela', dial: '+58', flag: '🇻🇪' },
  { code: 'EC', name: 'Ecuador', dial: '+593', flag: '🇪🇨' },
  { code: 'PE', name: 'Perú', dial: '+51', flag: '🇵🇪' },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
  { code: 'BR', name: 'Brasil', dial: '+55', flag: '🇧🇷' },
  { code: 'PA', name: 'Panamá', dial: '+507', flag: '🇵🇦' },
  { code: 'ES', name: 'España', dial: '+34', flag: '🇪🇸' },
  { code: 'FR', name: 'Francia', dial: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Alemania', dial: '+49', flag: '🇩🇪' },
  { code: 'IT', name: 'Italia', dial: '+39', flag: '🇮🇹' },
  { code: 'GB', name: 'Reino Unido', dial: '+44', flag: '🇬🇧' },
];
// Separa un número guardado ("+57 300…") en código de país y número.
const splitPhone = (full: string): { dial: string; digits: string } => {
  const clean = (full || '').trim();
  if (clean.startsWith('+')) {
    const match = [...PHONE_COUNTRIES].map(c => c.dial).sort((a, b) => b.length - a.length)
      .find(dial => clean.replace(/\s/g, '').startsWith(dial));
    if (match) return { dial: match, digits: clean.replace(/\D/g, '').slice(match.length - 1) };
  }
  return { dial: '+57', digits: clean.replace(/\D/g, '') };
};

const SAVED_CUSTOMER_KEY = 'egc_datos_cliente';
const readSavedCustomer = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(SAVED_CUSTOMER_KEY) || '{}'); } catch { return {}; }
};

interface BookingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDomeId?: number;
  initialCheckIn?: string;
  initialCheckOut?: string;
  onSuccess: (code: string) => void;
}

export const BookingWizardModal: React.FC<BookingWizardModalProps> = ({
  isOpen,
  onClose,
  initialDomeId,
  initialCheckIn,
  initialCheckOut,
  onSuccess
}) => {
  const { t, language } = useLanguage();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 3);

  const [step, setStep] = useState(1);
  const [bookingType, setBookingType] = useState<'estadia' | 'pasadia'>('estadia');
  const toLocalYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [checkIn, setCheckIn] = useState(initialCheckIn || toLocalYMD(tomorrow));
  const [checkOut, setCheckOut] = useState(initialCheckOut || toLocalYMD(dayAfter));
  const [guests, setGuests] = useState(2);
  const [domes, setDomes] = useState<any[]>([]);
  const [selectedDomeId, setSelectedDomeId] = useState<number | null>(initialDomeId || null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Pets & Addons
  const [hasPet, setHasPet] = useState(false);
  const [petCount, setPetCount] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<{
    bonoTime: boolean;
    decorVip: boolean;
    decorBasic: boolean;
  }>({
    bonoTime: false,
    decorVip: false,
    decorBasic: false,
  });
  // Masaje: paso propio. Sin tipo = sin masaje.
  const [massage, setMassage] = useState<{ type: MassageType | ''; therapist: MassageTherapist }>({ type: '', therapist: 'indiferente' });
  const [customMessage, setCustomMessage] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState('');
  const [promoChecking, setPromoChecking] = useState(false);

  const applyPromoCode = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoChecking(true);
    setPromoMsg('');
    try {
      const res = await fetch(`/api/promo-codes/validate?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedPromo({ code: data.code, percent: data.percent });
        setPromoMsg(language === 'en' ? `Code applied: ${data.percent}% off` : `Código aplicado: ${data.percent}% de descuento`);
      } else {
        setAppliedPromo(null);
        setPromoMsg(language === 'en' ? 'Invalid code' : 'El código no es válido');
      }
    } catch {
      setPromoMsg(language === 'en' ? 'Could not check the code' : 'No se pudo verificar el código');
    } finally {
      setPromoChecking(false);
    }
  };

  // Food choices (from the menu)
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [foodChoices, setFoodChoices] = useState<Record<string, { preparation: string; meat: string; side: string; qty: number }>>({});
  const [bbqOnly, setBbqOnly] = useState(false); // Guest brings food and cooks at the BBQ zone
  const setFoodChoice = (id: string, patch: { preparation?: string; meat?: string; side?: string; qty?: number }) =>
    setFoodChoices(prev => ({ ...prev, [id]: { ...(prev[id] ?? { preparation: '', meat: '', side: '', qty: 0 }), ...patch } }));
  // Cada plato pedido tiene su propia carne y preparación (ej. 2 cerdo gratinado + 1 res a la parrilla).
  // En pantalla hay una fila por plato (qty 1); para el pedido se agrupan los iguales.
  type FoodSplit = { meat: string; preparation: string; qty: number };
  const [foodSplits, setFoodSplits] = useState<Record<string, FoodSplit[]>>({});
  const splitActive = (id: string, qty: number) => foodSplits[id] !== undefined && qty > 0;
  const splitRows = (id: string, c: { meat: string; preparation: string; qty: number }): FoodSplit[] => {
    if (!splitActive(id, c.qty)) return [{ meat: c.meat, preparation: c.preparation, qty: c.qty }];
    const grouped: FoodSplit[] = [];
    for (const r of foodSplits[id]) {
      const same = grouped.find(g => g.meat === r.meat && g.preparation === r.preparation);
      if (same) same.qty += r.qty; else grouped.push({ ...r });
    }
    return grouped;
  };
  const updateSplits = (id: string, rows: FoodSplit[]) => setFoodSplits(prev => ({ ...prev, [id]: rows }));
  // Cambia cuántos platos de este tipo se piden: agrega o quita platos al final.
  // Si un plato tiene una sola opción de carne o preparación, queda elegida sola.
  const setDishQty = (item: any, q: number) => {
    const id = String(item.id);
    const qty = Math.max(0, Math.min(20, q));
    const g = getPrepGroups(item);
    const blank: FoodSplit = {
      meat: g.meats.length === 1 ? g.meats[0].value : '',
      preparation: g.styles.length === 1 ? g.styles[0].value : '',
      qty: 1,
    };
    const rows = (foodSplits[id] ?? []).slice(0, qty);
    while (rows.length < qty) rows.push({ ...blank });
    setFoodChoice(id, { qty });
    updateSplits(id, rows);
    setErrorMsg('');
  };
  // Botones de opción (en vez de listas desplegables), más fáciles de tocar en el celular.
  const renderChoiceChips = (
    label: string,
    options: { value: string; label: string }[],
    value: string,
    onChange: (v: string) => void,
  ) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(o => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`min-h-10 px-3.5 py-2 rounded-full border-2 text-sm font-semibold transition-colors cursor-pointer ${
                active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
  // Meat options are the meat-type entries of the dish; the rest are cooking styles.
  const isMeatOption = (p: string) => /^(carne de res|cerdo|pechuga)$/i.test(p.trim());
  // Meat types offered for any dish whose name mentions "carne", even if the saved menu lacks them.
  const DEFAULT_MEATS = [
    { value: 'Carne de res', label_en: 'Beef' },
    { value: 'Cerdo', label_en: 'Pork' },
    { value: 'Pechuga', label_en: 'Chicken breast' },
  ];
  const getPrepGroups = (item: any) => {
    const preps: string[] = item.preparations || [];
    const preps_en: string[] = item.preparations_en || [];
    const toOpt = (p: string) => ({ value: p, label: language === 'en' ? (preps_en[preps.indexOf(p)] || p) : p });
    let meats = preps.filter(isMeatOption).map(toOpt);
    if (meats.length === 0 && /carne/i.test(String(item.title || ''))) {
      meats = DEFAULT_MEATS.map(m => ({ value: m.value, label: language === 'en' ? m.label_en : m.value }));
    }
    return {
      meats,
      styles: preps.filter(p => !isMeatOption(p)).map(toOpt),
      sides: (item.sides || []) as string[],
      sides_en: (item.sides_en || []) as string[],
    };
  };

  useEffect(() => {
    if (!isOpen) return;
    // Use the menu from the server when available; otherwise fall back to the built-in menu.
    const fallback = CHINAUTA_MENU_ITEMS.filter(d => !String(d.category || '').toLowerCase().includes('bebida'));
    const useFallback = () => setMenuItems(fallback);
    fetch('/api/menu')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) return useFallback();
        const items = data
          .filter((d: any) => !String(d.category || '').toLowerCase().includes('bebida'))
          .map((d: any) => ({
            ...d,
            preparations: typeof d.preparations === 'string' ? JSON.parse(d.preparations || '[]') : (d.preparations || []),
            preparations_en: typeof d.preparations_en === 'string' ? JSON.parse(d.preparations_en || '[]') : (d.preparations_en || []),
            sides: typeof d.sides === 'string' ? JSON.parse(d.sides || '[]') : (d.sides || []),
            sides_en: typeof d.sides_en === 'string' ? JSON.parse(d.sides_en || '[]') : (d.sides_en || []),
          }));
        setMenuItems(items.length > 0 ? items : fallback);
      })
      .catch(err => {
        console.error(err);
        useFallback();
      });
  }, [isOpen]);

  // Customer form
  // Autorrellenado: usa los datos de la última reserva de este dispositivo o de la cuenta con sesión.
  const savedCustomer = readSavedCustomer();
  const [name, setName] = useState(savedCustomer.name || auth.currentUser?.displayName || '');
  const savedPhone = splitPhone(savedCustomer.phone || '');
  const [phoneCountry, setPhoneCountry] = useState(savedCustomer.phoneCountry || savedPhone.dial);
  const [phone, setPhone] = useState(savedCustomer.phone ? savedPhone.digits : '');
  const [whatsapp, setWhatsapp] = useState(savedCustomer.whatsapp || '');
  const [email, setEmail] = useState(savedCustomer.email || auth.currentUser?.email || '');
  const [documentId, setDocumentId] = useState(savedCustomer.documentId || '');
  const [notes, setNotes] = useState('');

  // Con sesión verificada, trae los datos guardados en la cuenta del cliente (solo rellena campos vacíos).
  useEffect(() => {
    const user = auth.currentUser;
    if (!isOpen || !user || !user.emailVerified) return;
    let cancelled = false;
    user.getIdToken().then(token => fetch('/api/my/profile', { headers: { Authorization: `Bearer ${token}` } }))
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.found) return;
        setName(prev => prev || data.name || '');
        setEmail(prev => prev || data.email || '');
        if (data.phone && !phone) {
          const parts = splitPhone(data.phone);
          setPhoneCountry(parts.dial);
          setPhone(parts.digits);
        }
        setWhatsapp(prev => prev || data.whatsapp || '');
        setDocumentId(prev => prev || data.document_id || '');
      })
      .catch(() => { /* sin datos: el cliente los escribe */ });
    return () => { cancelled = true; };
  }, [isOpen]);

  // Guarda los datos mientras se escriben para que la próxima reserva ya vengan llenos.
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_CUSTOMER_KEY, JSON.stringify({ name, phone: `${phoneCountry}${phone.replace(/\D/g, '')}`, phoneCountry, whatsapp, email, documentId }));
    } catch { /* almacenamiento bloqueado: no pasa nada */ }
  }, [name, phone, phoneCountry, whatsapp, email, documentId]);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<'Nequi' | 'Daviplata'>('Nequi');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedCode, setConfirmedCode] = useState('');
  const [confirmedSummary, setConfirmedSummary] = useState('');

  // Consent boxes. Always unchecked when the wizard opens: the guest must choose each of them.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isAdult, setIsAdult] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Reset the wizard only when it opens. (Before, this also ran on every date change and sent the guest back to step 1.)
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setConfirmedCode('');
      setConfirmedSummary('');
      setErrorMsg('');
      setAcceptTerms(false);
      setIsAdult(false);
      setMarketingOptIn(false);
      if (initialDomeId) setSelectedDomeId(initialDomeId);
      if (initialCheckIn) setCheckIn(initialCheckIn);
      if (initialCheckOut) setCheckOut(initialCheckOut);
    }
  }, [isOpen]);

  // Refresh availability when the dates or the stay type change, without moving the guest's step.
  useEffect(() => {
    if (isOpen) fetchAvailability();
  }, [isOpen, checkIn, checkOut, bookingType]);

  const fetchAvailability = async () => {
    setLoadingAvailability(true);
    try {
      const effectiveCheckOut = bookingType === 'pasadia' ? checkIn : checkOut;
      const res = await fetch(`/api/availability?checkIn=${checkIn}&checkOut=${effectiveCheckOut}`);
      const data = await readJson(res);
      if (Array.isArray(data)) {
        setDomes(data);
      } else {
        throw new Error('Respuesta de disponibilidad no válida');
      }
    } catch (err) {
      // Si no se puede consultar la disponibilidad, se muestran los domos igual.
      // El servidor vuelve a revisar las fechas al confirmar la reserva (evita doble reserva).
      console.error(err);
      setDomes(DEFAULT_DOMES.map((d: any) => ({
        ...d,
        isAvailable: true,
        reason: 'Disponible'
      })));
      setErrorMsg(language === 'en'
        ? 'Availability will be confirmed when you send the booking.'
        : 'La disponibilidad se confirmará al enviar tu reserva.');
    } finally {
      setLoadingAvailability(false);
    }
  };

  if (!isOpen) return null;

  const foodSummary = bbqOnly ? [] : menuItems
    .filter(i => (foodChoices[String(i.id)]?.qty || 0) > 0)
    .flatMap(i => {
      const c = foodChoices[String(i.id)];
      return splitRows(String(i.id), c).map(r =>
        `${i.title}${r.meat ? ` - ${r.meat}` : ''}${r.preparation ? ` (${r.preparation})` : ''} x${r.qty}`);
    });
  // Resumen corto para la pantalla: solo carne/plato y preparación (ej. "Carne de res gratinada, Pechuga asada a la parrilla").
  const foodShortLabels: string[] = bbqOnly ? [] : menuItems
    .filter(i => (foodChoices[String(i.id)]?.qty || 0) > 0)
    .flatMap(i => {
      const c = foodChoices[String(i.id)];
      return splitRows(String(i.id), c).map(r => {
        const prep = (r.preparation || '').toLowerCase();
        const base = r.meat || (prep ? i.title.split(' ')[0] : i.title);
        return [base, prep].filter(Boolean).join(' ');
      });
    });
  const foodMissingNames: string[] = bbqOnly ? [] : menuItems
    .filter(i => {
      const c = foodChoices[String(i.id)];
      if (!c || c.qty <= 0) return false;
      const g = getPrepGroups(i);
      if (splitActive(String(i.id), c.qty)) {
        const rows = foodSplits[String(i.id)];
        const assigned = rows.reduce((s, r) => s + r.qty, 0);
        return assigned !== c.qty || rows.some(r => (g.meats.length > 0 && !r.meat) || (g.styles.length > 0 && !r.preparation));
      }
      return (g.meats.length > 0 && !c.meat) || (g.styles.length > 0 && !c.preparation);
    })
    .map(i => (language === 'en' ? (i.title_en || i.title) : i.title));
  const foodIncomplete = foodMissingNames.length > 0;

  const selectedDome = domes.find(d => Number(d.id) === Number(selectedDomeId));
  // Si el número de personas no cabe en el domo elegido, se ofrecen ahí mismo los domos libres que sí lo reciben.
  // Máximo de personas del domo (lo manda el servidor; si no viene, hasta 3 como en api/app.ts).
  const maxGuestsOf = (d: any) => Math.max(Number(d?.capacity) || 2, Number(d?.max_guests) || 3);
  const domeMaxGuests = maxGuestsOf(selectedDome);
  const tooManyGuests = !!selectedDome && guests > domeMaxGuests;
  const domesThatFit = domes.filter(d =>
    d.isAvailable && maxGuestsOf(d) >= guests && Number(d.id) !== Number(selectedDomeId));

  // Calculate nights & pricing
  const start = new Date(checkIn);
  const end = new Date(bookingType === 'pasadia' ? checkIn : checkOut);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const nights = bookingType === 'pasadia' ? 1 : Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const baseRate = bookingType === 'pasadia' ? 250000 : (selectedDome ? selectedDome.price_per_night : 350000);
  const baseTotal = bookingType === 'pasadia' ? baseRate : nights * baseRate;

  // Extra persons ($70,000 per extra person per night)
  const baseCapacity = selectedDome ? (selectedDome.capacity || 2) : 2;
  const extraPersons = Math.max(0, guests - baseCapacity);
  const extraPersonsFee = extraPersons * 70000 * (bookingType === 'pasadia' ? 1 : nights);

  // Pets ($30,000 per pet)
  const petsFee = hasPet ? petCount * 30000 : 0;

  // Addons fees
  const bonoTimeFee = selectedAddons.bonoTime ? 50000 : 0;
  const decorFee = selectedAddons.decorVip ? 150000 : (selectedAddons.decorBasic ? 75000 : 0);
  const massageFee = massage.type ? MASSAGE_PRICES[massage.type] : 0;
  const massageLabel = massage.type
    ? `${MASSAGE_TYPE_LABELS[massage.type][language === 'en' ? 'en' : 'es']} · ${MASSAGE_THERAPIST_LABELS[massage.therapist][language === 'en' ? 'en' : 'es']}`
    : '';
  const addonsTotal = bonoTimeFee + decorFee + massageFee;

  // Todo lo que el huésped eligió, en texto, para administración y para el WhatsApp de confirmación.
  const servicesList: string[] = [
    ...(selectedAddons.bonoTime ? ['Bono de tiempo'] : []),
    ...(selectedAddons.decorVip ? ['Decoración VIP'] : []),
    ...(selectedAddons.decorBasic ? ['Decoración básica'] : []),
    ...(massageLabel ? [massageLabel] : []),
    ...(hasPet && petCount > 0 ? [`Mascotas: ${petCount}`] : []),
    ...(extraPersons > 0 ? [`Personas extra: ${extraPersons}`] : []),
    ...(bbqOnly ? ['Zona BBQ con comida propia'] : []),
    ...foodSummary.map(f => `Comida: ${f}`),
  ];

  const subtotal = baseTotal + extraPersonsFee + petsFee + addonsTotal;

  // Weekday check
  // Parse as local date so the weekday is not shifted by the timezone
  const checkInDayOfWeek = new Date(`${checkIn}T00:00:00`).getDay();
  // Festivos de Colombia se cobran como fin de semana (sin descuento entre semana).
  const isWeekday = checkInDayOfWeek >= 1 && checkInDayOfWeek <= 4 && !isColombianHoliday(checkIn);

  // Mon–Thu: 10% fixed. A valid promo code gives 5/10/15%. The higher of the two applies (same rule as the server).
  const weekdayDiscountPercent = isWeekday ? 10 : 0;
  const effectiveDiscountPercent = Math.max(weekdayDiscountPercent, appliedPromo?.percent || 0);

  const discountAmount = (subtotal * effectiveDiscountPercent) / 100;
  // Food is charged separately: it is added after the discount and is not discounted.
  const foodTotal = menuItems.reduce(
    (sum, i) => sum + (Number(i.price) || 0) * (foodChoices[String(i.id)]?.qty || 0),
    0
  );
  // BBQ zone fee (for guests who bring no food from the menu). Not discounted, like food.
  const BBQ_ZONE_FEE = 20000;
  const bbqFee = bbqOnly ? BBQ_ZONE_FEE : 0;
  const totalAmount = Math.max(0, subtotal - discountAmount) + foodTotal + bbqFee;
  // Abono mínimo para apartar (mismo cálculo que el servidor: depositFor en api/app.ts).
  const depositAmount = Math.ceil(totalAmount * DEPOSIT_PERCENT / 100);

  const validateStep2 = () => {
    if (bookingType === 'pasadia') {
      const dayOfWeek = new Date(`${checkIn}T00:00:00`).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
        setErrorMsg(t('wizard.daypass_restriction_err'));
        return false;
      }
    }
    setErrorMsg('');
    return true;
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDome || !name || !phone || !email) {
      setErrorMsg(t('wizard.required_fields_err'));
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 6) {
      setErrorMsg('Escribe un número de WhatsApp válido, sin el código de país.');
      return;
    }
    const fullPhone = `${phoneCountry}${digits}`;
    if (!acceptTerms || !isAdult) {
      setErrorMsg(language === 'en'
        ? 'Please accept the terms and confirm you are over 18 to continue.'
        : 'Debes aceptar los términos y confirmar que eres mayor de 18 años para continuar.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const effectiveCheckOut = bookingType === 'pasadia' ? checkIn : checkOut;
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dome_id: selectedDome.id,
          check_in: checkIn,
          check_out: effectiveCheckOut,
          guests,
          total_amount: totalAmount,
          promo_code: appliedPromo?.code || null,
          bbq_zone: bbqOnly,
          decor_message: (selectedAddons.decorVip || selectedAddons.decorBasic) ? customMessage : '',
          booking_type: bookingType,
          pets: hasPet ? petCount : 0,
          addons: { ...selectedAddons, massage: massage.type ? massage : null },
          payment_method: paymentMethod,
          services: servicesList,
          // One entry per meat/preparation group: a dish split between several choices sends each part with its own choices.
          food_items: (Object.entries(foodChoices) as [string, { qty: number; meat: string; preparation: string; side: string }][])
            .filter(([, c]) => (c?.qty || 0) > 0)
            .flatMap(([id, c]) => splitRows(id, c)
              .filter(r => r.qty > 0)
              .map(r => ({ id: Number(id), qty: r.qty, meat: r.meat || '', preparation: r.preparation || '', side: c.side || '' }))),
          // Solo lo que escribió el huésped: extras, comida y mensaje de decoración ya van en el resumen de la reserva.
          notes: notes.trim(),
          consent: {
            terms: acceptTerms,
            age: isAdult,
            marketing: marketingOptIn
          },
          customer: {
            name,
            phone: fullPhone,
            whatsapp: fullPhone,
            email,
            document_id: documentId,
            notes
          }
        })
      });

      const data = await readJson(res);
      if (!res.ok) {
        throw new Error(data.error || t('wizard.booking_process_err'));
      }

      setConfirmedCode(data.reservation_code);
      setConfirmedSummary(data.summary || '');
      setStep(DONE_STEP);
      onSuccess(data.reservation_code);
    } catch (err: any) {
      setErrorMsg(err.message || t('wizard.booking_process_err'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="glass-card w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden bg-white my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Compass className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t('wizard.title')}</h3>
              <p className="text-xs text-emerald-200">{t('wizard.step_counter').replace('{step}', String(step))}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Wizard Content */}
        <div className="p-6 sm:p-8 max-h-[75vh] overflow-y-auto space-y-6">
          {errorMsg && step !== FOOD_STEP && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          {/* STEP 1: Choose Booking Type */}
          {step === 1 && (
            <div className="space-y-6">
              <h4 className="text-xl font-bold text-slate-900">{t('wizard.step1_title')}</h4>
              <p className="text-sm text-slate-600">{t('wizard.step1_desc')}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setBookingType('estadia')}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-4 ${
                    bookingType === 'estadia' ? 'border-emerald-600 bg-emerald-50/50 shadow-md' : 'border-slate-200 hover:border-emerald-300 bg-white'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Compass className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-base">{t('wizard.stay_title')}</h5>
                    <p className="text-xs text-slate-500 mt-1">{t('wizard.stay_desc')}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">{t('wizard.stay_badge')}</span>
                </div>

                <div
                  onClick={() => setBookingType('pasadia')}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-4 ${
                    bookingType === 'pasadia' ? 'border-emerald-600 bg-emerald-50/50 shadow-md' : 'border-slate-200 hover:border-emerald-300 bg-white'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                    <Sun className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-base">{t('wizard.daypass_title')}</h5>
                    <p className="text-xs text-slate-500 mt-1">{t('wizard.daypass_desc')}</p>
                  </div>
                  <span className="text-xs font-bold text-teal-700">{t('wizard.daypass_badge')}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Select Date & Guests */}
          {step === 2 && (
            <div className="space-y-6">
              <h4 className="text-xl font-bold text-slate-900">
                {bookingType === 'pasadia' ? t('wizard.step2_daypass_title') : t('wizard.step2_stay_title')}
              </h4>
              <p className="text-sm text-slate-600">
                {bookingType === 'pasadia' ? t('wizard.step2_daypass_sub') : t('wizard.step2_stay_sub')}
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                    {bookingType === 'pasadia' ? t('wizard.daypass_date_label') : t('wizard.checkin_label')}
                  </label>
                  <input
                    type="date"
                    value={checkIn}
                    min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })()}
                    onChange={e => {
                      setCheckIn(e.target.value);
                      if (bookingType === 'pasadia') setCheckOut(e.target.value);
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 font-medium focus:outline-hidden focus:border-emerald-500 bg-white"
                  />
                </div>
                {bookingType === 'estadia' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">{t('wizard.checkout_label')}</label>
                    <input
                      type="date"
                      value={checkOut}
                      min={checkIn}
                      onChange={e => setCheckOut(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 font-medium focus:outline-hidden focus:border-emerald-500 bg-white"
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!validateStep2()) return;
                  setErrorMsg('');
                  setStep(3);
                }}
                className="w-full px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 flex items-center justify-center space-x-2 text-sm shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <span>{language === 'en' ? 'Continue' : 'Continuar'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 3: Select Dome */}
          {step === 3 && (
            <div className="space-y-6">
              <h4 className="text-xl font-bold text-slate-900">{t('wizard.step3_title')}</h4>
              <p className="text-sm text-slate-600">{t('wizard.step3_sub')}</p>

              {loadingAvailability ? (
                <div className="text-center py-8 text-slate-500">{t('wizard.loading_avail')}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {domes.map(dome => (
                    <div
                      key={dome.id}
                      onClick={() => dome.isAvailable && setSelectedDomeId(dome.id)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                        selectedDomeId === dome.id
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-md'
                          : dome.isAvailable
                          ? 'border-slate-200 hover:border-emerald-400 bg-white'
                          : 'border-slate-200 opacity-50 bg-slate-100 cursor-not-allowed'
                      }`}
                    >
                      <div className="rounded-xl overflow-hidden mb-3">
                        <ImageCarousel
                          images={getDomeImages(dome)}
                          alt={dome.name}
                          className="h-36 sm:h-40"
                          showCounter={true}
                          overlayBadge={
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-xs ${
                              dome.isAvailable ? 'bg-emerald-100/95 text-emerald-800' : 'bg-rose-100/95 text-rose-800'
                            }`}>
                              {dome.isAvailable ? t('wizard.available') : dome.reason}
                            </span>
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-slate-900 text-sm">{dome.name}</h5>
                          <span className="text-xs text-slate-500 font-medium">{dome.code}</span>
                        </div>
                        <p className="text-xs text-emerald-700 font-bold mt-1">
                          ${(bookingType === 'pasadia' ? 250000 : dome.price_per_night).toLocaleString('es-CO')} {bookingType === 'pasadia' ? (language === 'en' ? 'day pass' : 'pasadía') : t('domes.night')}
                        </p>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{dome.description}</p>
                      </div>
                      <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                        {t('wizard.capacity_desc').replace('{count}', String(maxGuestsOf(dome)))} {dome.id === 1 ? t('wizard.small_jacuzzi') : dome.id === 2 ? t('wizard.extra_bed') : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Guests & Extra Persons */}
          {step === 4 && (
            <div className="space-y-6">
              <h4 className="text-xl font-bold text-slate-900">{t('wizard.step4_title')}</h4>
              <p className="text-sm text-slate-600">
                {t('wizard.step4_sub').replace('{cap}', String(selectedDome?.capacity || 2))}{' '}
                <strong>{language === 'en' ? `Takes up to ${domeMaxGuests} guests.` : `Recibe hasta ${domeMaxGuests} personas.`}</strong>
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">{t('wizard.guests_label')}</label>
                <select
                  value={guests}
                  onChange={e => { setGuests(Number(e.target.value)); setErrorMsg(''); }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 font-medium focus:outline-hidden focus:border-emerald-500 bg-white text-sm"
                >
                  <option value={1}>{t('wizard.guest_1')}</option>
                  <option value={2}>{t('wizard.guest_2')}</option>
                  <option value={3}>{t('wizard.guest_3')} {selectedDome?.id === 2 ? t('wizard.extra_bed') : ''}</option>
                  <option value={4}>{t('wizard.guest_4')}</option>
                </select>
              </div>

              {/* No cabe en el domo elegido: cambiar de domo aquí mismo, sin devolverse paso por paso */}
              {tooManyGuests && selectedDome && (
                <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50 space-y-3">
                  <p className="text-sm font-bold text-amber-900">
                    {language === 'en'
                      ? `${selectedDome.name} takes up to ${domeMaxGuests} guests.`
                      : `El ${selectedDome.name} recibe máximo ${domeMaxGuests} personas.`}
                  </p>
                  {domesThatFit.length > 0 ? (
                    <>
                      <p className="text-sm text-amber-900">
                        {language === 'en'
                          ? `These domes are free on your dates and take ${guests} guests. Tap one to switch:`
                          : `Estos domos están libres en tus fechas y reciben ${guests} personas. Toca uno para cambiarlo aquí mismo:`}
                      </p>
                      <div className="space-y-2">
                        {domesThatFit.map(d => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => { setSelectedDomeId(d.id); setErrorMsg(''); }}
                            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-slate-200 bg-white hover:border-emerald-500 text-left cursor-pointer"
                          >
                            <span>
                              <span className="block font-bold text-slate-900 text-sm">{d.name}</span>
                              <span className="block text-xs text-slate-600">
                                {language === 'en' ? `Up to ${maxGuestsOf(d)} guests` : `Hasta ${maxGuestsOf(d)} personas`}
                                {bookingType !== 'pasadia' && ` · $${Number(d.price_per_night || 0).toLocaleString('es-CO')} ${language === 'en' ? '/ night' : '/ noche'}`}
                              </span>
                            </span>
                            <span className="shrink-0 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold">
                              {language === 'en' ? 'Switch' : 'Cambiar'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-amber-900">
                      {language === 'en'
                        ? `No dome for ${guests} guests is free on your dates. Try other dates or fewer guests.`
                        : `No hay domos libres para ${guests} personas en tus fechas. Prueba otras fechas o menos personas.`}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { setGuests(domeMaxGuests); setErrorMsg(''); }}
                      className="px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                    >
                      {language === 'en'
                        ? `Keep ${selectedDome.name} for ${domeMaxGuests} guests`
                        : `Seguir con el ${selectedDome.name} para ${domeMaxGuests} personas`}
                    </button>
                    {domesThatFit.length === 0 && (
                      <button
                        type="button"
                        onClick={() => { setErrorMsg(''); setStep(2); }}
                        className="px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                      >
                        {language === 'en' ? 'Change dates' : 'Cambiar fechas'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {extraPersons > 0 && !tooManyGuests && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                  {t('wizard.extra_persons_added').replace('{count}', String(extraPersons)).replace('{fee}', extraPersonsFee.toLocaleString('es-CO'))}
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Pets */}
          {step === 5 && (
            <div className="space-y-6">
              <h4 className="text-xl font-bold text-slate-900">{t('wizard.step5_title')}</h4>
              <p className="text-sm text-slate-600">{t('wizard.step5_sub')}</p>

              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => setHasPet(false)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer text-center font-bold text-sm transition-all ${
                    !hasPet ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700 bg-white'
                  }`}
                >
                  {t('wizard.no_pets')}
                </div>
                <div
                  onClick={() => setHasPet(true)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer text-center font-bold text-sm transition-all ${
                    hasPet ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700 bg-white'
                  }`}
                >
                  {t('wizard.yes_pets')}
                </div>
              </div>

              {hasPet && (
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">{t('wizard.pet_count_label')}</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={petCount}
                    onChange={e => setPetCount(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium"
                  />
                  <p className="text-xs text-slate-500">{t('wizard.pet_fee_notice')}</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Addons */}
          {step === 6 && (
            <div className="space-y-6">
              <h4 className="text-xl font-bold text-slate-900">{t('wizard.step6_title')}</h4>
              <p className="text-sm text-slate-600">{t('wizard.step6_sub')}</p>

              <div className="space-y-3">
                {/* Bono Time */}
                <div
                  onClick={() => setSelectedAddons({...selectedAddons, bonoTime: !selectedAddons.bonoTime})}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    selectedAddons.bonoTime ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-sm">{t('wizard.bono_time_title')}</h5>
                      <p className="text-xs text-slate-500">{t('wizard.bono_time_desc')}</p>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-700 text-sm">+$50.000 COP</span>
                </div>

                {/* Decoración VIP */}
                <div
                  onClick={() => setSelectedAddons({...selectedAddons, decorVip: !selectedAddons.decorVip, decorBasic: false})}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    selectedAddons.decorVip ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                      <Wine className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-sm">{t('wizard.decor_vip_title')}</h5>
                      <p className="text-xs text-slate-500">{t('wizard.decor_vip_desc')}</p>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-700 text-sm">+$150.000 COP</span>
                </div>

                {/* Decoración Básica */}
                <div
                  onClick={() => setSelectedAddons({...selectedAddons, decorBasic: !selectedAddons.decorBasic, decorVip: false})}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    selectedAddons.decorBasic ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-sm">{t('wizard.decor_basic_title')}</h5>
                      <p className="text-xs text-slate-500">{t('wizard.decor_basic_desc')}</p>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-700 text-sm">+$75.000 COP</span>
                </div>
              </div>

              {(selectedAddons.decorVip || selectedAddons.decorBasic) && (
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">{t('wizard.custom_msg_label')}</label>
                  <input
                    type="text"
                    value={customMessage}
                    onChange={e => setCustomMessage(e.target.value)}
                    placeholder={t('wizard.custom_msg_ph')}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 7: Masajes (paso propio) */}
          {step === MASSAGE_STEP && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xl font-bold text-slate-900">{language === 'en' ? 'Massages' : 'Masajes'}</h4>
                <p className="text-sm text-slate-600 mt-1">
                  {language === 'en'
                    ? 'Professional couples relaxation massage (60 min) in your dome. Choose your therapist preference.'
                    : 'Masaje profesional de relajación en pareja (60 min) en tu domo. Elige qué masajista prefieres.'}
                </p>
              </div>

              {MASSAGE_PHOTOS.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MASSAGE_PHOTOS.map((src, i) => (
                    <img
                      key={src}
                      src={src}
                      alt={language === 'en' ? `Couples massage at Eco Glamping Chinauta, photo ${i + 1}` : `Masaje en pareja en Eco Glamping Chinauta, foto ${i + 1}`}
                      loading="lazy"
                      className="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200"
                    />
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 uppercase">{language === 'en' ? 'Do you want a massage?' : '¿Quieres masaje?'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={language === 'en' ? 'Massage' : 'Masaje'}>
                  {([
                    { value: '' as const, title: language === 'en' ? 'No massage' : 'Sin masaje', price: 0 },
                    { value: 'pareja' as const, title: MASSAGE_TYPE_LABELS.pareja[language === 'en' ? 'en' : 'es'], price: MASSAGE_PRICES.pareja },
                  ]).map(opt => {
                    const active = massage.type === opt.value;
                    return (
                      <button
                        key={opt.value || 'none'}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setMassage({ ...massage, type: opt.value })}
                        className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${active ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      >
                        <div className="flex items-center gap-2">
                          <Heart className={`w-4 h-4 ${opt.value ? 'text-purple-600' : 'text-slate-400'}`} />
                          <span className="font-bold text-slate-900 text-sm">{opt.title}</span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-emerald-700">
                          {opt.price ? `+$${opt.price.toLocaleString('es-CO')} COP` : (language === 'en' ? 'No extra cost' : 'Sin costo')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {massage.type && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700 uppercase">{language === 'en' ? 'Therapist preference' : 'Preferencia de masajista'}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label={language === 'en' ? 'Therapist preference' : 'Preferencia de masajista'}>
                    {(['mujer', 'hombre', 'indiferente'] as MassageTherapist[]).map(value => {
                      const active = massage.therapist === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setMassage({ ...massage, therapist: value })}
                          className={`px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all cursor-pointer ${active ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                        >
                          {MASSAGE_THERAPIST_LABELS[value][language === 'en' ? 'en' : 'es']}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500">
                    {language === 'en'
                      ? 'We will do our best to match your preference; we confirm it by WhatsApp.'
                      : 'Haremos lo posible por respetar tu preferencia; te la confirmamos por WhatsApp.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 8: Food Choices */}
          {step === FOOD_STEP && (
            <div className="space-y-5">
              <div>
                <h4 className="text-xl font-bold text-slate-900">{language === 'en' ? 'Your meals' : 'Tu comida'}</h4>
                <p className="text-sm text-slate-600 mt-1">
                  {language === 'en' ? 'First, tell us how you want to eat.' : 'Primero cuéntanos cómo quieres comer.'}
                </p>
              </div>

              {/* 1. Cómo quiere comer: del menú o comida propia en la zona BBQ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={language === 'en' ? 'How do you want to eat?' : '¿Cómo quieres comer?'}>
                {([
                  {
                    bbq: false,
                    title: language === 'en' ? 'Order from our menu' : 'Pedir comida del menú',
                    desc: language === 'en' ? 'Dishes prepared by our kitchen.' : 'Platos preparados por nuestra cocina.',
                  },
                  {
                    bbq: true,
                    title: language === 'en' ? 'Bring my own food' : 'Traer mi propia comida',
                    desc: language === 'en'
                      ? `You cook it at the BBQ zone. Fee: $${BBQ_ZONE_FEE.toLocaleString('es-CO')} COP`
                      : `La preparas tú en la zona BBQ. Costo: $${BBQ_ZONE_FEE.toLocaleString('es-CO')} COP`,
                  },
                ]).map(opt => {
                  const active = bbqOnly === opt.bbq;
                  return (
                    <button
                      key={String(opt.bbq)}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setBbqOnly(opt.bbq);
                        if (opt.bbq) { setFoodChoices({}); setFoodSplits({}); }
                        setErrorMsg('');
                      }}
                      className={`p-4 rounded-2xl border-2 text-left transition-colors cursor-pointer ${
                        active ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                        <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${active ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`} aria-hidden="true" />
                        {opt.title}
                      </span>
                      <span className="block text-xs text-slate-600 mt-1 pl-6">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* 2. Platos del menú: Agregar, luego − / + y por cada plato su carne y preparación */}
              {!bbqOnly && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {language === 'en'
                      ? 'Tap "Add" on the dishes you want. For each dish, choose the meat and how you want it.'
                      : 'Toca "Agregar" en los platos que quieras. Por cada plato eliges la carne y cómo la quieres.'}
                  </p>

                  {menuItems.length === 0 && (
                    <p className="text-sm text-slate-500">{language === 'en' ? 'Loading menu...' : 'Cargando menú...'}</p>
                  )}

                  {menuItems.map(item => {
                    const id = String(item.id);
                    const qty = foodChoices[id]?.qty || 0;
                    const rows = foodSplits[id] ?? [];
                    const groups = getPrepGroups(item);
                    const title = language === 'en' ? (item.title_en || item.title) : item.title;
                    const img = item.image || (Array.isArray(item.images) ? item.images[0] : '');
                    const included = [
                      ...groups.sides.map((s: string, idx: number) => (language === 'en' ? (groups.sides_en[idx] || s) : s)),
                      language === 'en' ? (item.beverage_en || item.beverage) : item.beverage,
                    ].filter(Boolean).join(', ');
                    const hasChoices = groups.meats.length > 1 || groups.styles.length > 1;
                    return (
                      <div
                        key={id}
                        className={`rounded-2xl border-2 p-3 sm:p-4 space-y-3 transition-colors ${
                          qty > 0 ? 'border-emerald-600 bg-emerald-50/40' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {img && (
                            <img src={img} alt="" loading="lazy" className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 bg-slate-100" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-slate-900 text-sm leading-snug">{title}</h5>
                            <p className="text-sm font-bold text-emerald-700">
                              ${Number(item.price || 0).toLocaleString('es-CO')}{' '}
                              <span className="text-xs font-medium text-slate-500">{language === 'en' ? 'per dish' : 'por plato'}</span>
                            </p>
                            {included && (
                              <p className="text-xs text-slate-500">{language === 'en' ? 'Includes: ' : 'Incluye: '}{included}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {qty > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setDishQty(item, qty - 1)}
                                  aria-label={language === 'en' ? `Remove one ${title}` : `Quitar un plato de ${title}`}
                                  className="w-10 h-10 rounded-full border-2 border-slate-300 bg-white text-lg font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >−</button>
                                <span className="w-6 text-center font-black text-slate-900" aria-live="polite">{qty}</span>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setDishQty(item, qty + 1)}
                              aria-label={language === 'en' ? `Add one ${title}` : `Agregar un plato de ${title}`}
                              className={qty > 0
                                ? 'w-10 h-10 rounded-full bg-emerald-600 text-white text-lg font-bold hover:bg-emerald-700 cursor-pointer'
                                : 'h-10 px-4 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 cursor-pointer'}
                            >{qty > 0 ? '+' : (language === 'en' ? 'Add' : 'Agregar')}</button>
                          </div>
                        </div>

                        {qty > 0 && hasChoices && (
                          <div className="space-y-2">
                            {rows.map((r, idx) => {
                              const missing = (groups.meats.length > 0 && !r.meat) || (groups.styles.length > 0 && !r.preparation);
                              const setRow = (patch: Partial<FoodSplit>) => {
                                updateSplits(id, rows.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
                                setErrorMsg('');
                              };
                              return (
                                <div key={idx} className={`rounded-xl bg-white border p-3 space-y-2.5 ${missing ? 'border-amber-300' : 'border-slate-200'}`}>
                                  <p className="text-xs font-bold text-slate-800">
                                    {rows.length > 1
                                      ? (language === 'en' ? `Dish ${idx + 1}` : `Plato ${idx + 1}`)
                                      : (language === 'en' ? 'Your dish' : 'Tu plato')}
                                    {missing && (
                                      <span className="ml-2 font-semibold text-amber-700">
                                        {language === 'en' ? '· choose below' : '· elige abajo'}
                                      </span>
                                    )}
                                  </p>
                                  {groups.meats.length > 1 && renderChoiceChips(
                                    language === 'en' ? 'Meat' : 'Carne', groups.meats, r.meat, v => setRow({ meat: v }))}
                                  {groups.styles.length > 1 && renderChoiceChips(
                                    language === 'en' ? 'How do you want it?' : '¿Cómo la quieres?', groups.styles, r.preparation, v => setRow({ preparation: v }))}
                                </div>
                              );
                            })}
                            {rows.length > 1 && (rows[0].meat || rows[0].preparation) && (
                              <button
                                type="button"
                                onClick={() => updateSplits(id, rows.map(() => ({ ...rows[0], qty: 1 })))}
                                className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                              >
                                {language === 'en' ? 'Use the same as dish 1 for all' : 'Usar lo mismo del plato 1 para todos'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 9: Guest Details & Payment */}
          {step === CONTACT_STEP && (
            <div className="space-y-6">
              <h4 className="text-xl font-bold text-slate-900">{t('wizard.step7_title')}</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('wizard.full_name')}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('wizard.full_name_ph')}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('wizard.email')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('wizard.email_ph')}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('wizard.phone')}</label>
                  <div className="flex gap-2">
                    <select
                      aria-label="Código de país"
                      value={phoneCountry}
                      onChange={e => setPhoneCountry(e.target.value)}
                      className="w-40 px-2 py-3 rounded-xl border border-slate-200 text-sm font-medium bg-white"
                    >
                      {PHONE_COUNTRIES.map(c => (
                        <option key={c.code} value={c.dial}>{c.flag} {c.name} ({c.dial})</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      autoComplete="tel-national"
                      inputMode="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/[^\d\s()-]/g, ''))}
                      placeholder={t('wizard.phone_ph')}
                      className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Este número se usa para WhatsApp. Elige el país antes de escribir el número.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('wizard.doc_id')}</label>
                  <input
                    type="text"
                    value={documentId}
                    onChange={e => setDocumentId(e.target.value)}
                    placeholder={t('wizard.doc_id_ph')}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium"
                  />
                </div>
              </div>

              {/* Automatic Weekday Discount Notice */}
              {isWeekday && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium space-y-1">
                  <div className="font-bold flex items-center space-x-1.5 text-emerald-800">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>{t('wizard.weekday_discount_title').replace('{percent}', String(weekdayDiscountPercent))}</span>
                  </div>
                  <p>{t('wizard.weekday_discount_desc').replace('{percent}', String(weekdayDiscountPercent)).replace('{amount}', ((subtotal * weekdayDiscountPercent) / 100).toLocaleString('es-CO'))}</p>
                </div>
              )}

              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  {language === 'en' ? 'Promo code' : 'Código de promoción'}
                </label>
                <div className="flex space-x-2">
                  <input
                    value={promoInput}
                    onChange={e => { setPromoInput(e.target.value.toUpperCase()); setAppliedPromo(null); setPromoMsg(''); }}
                    placeholder={language === 'en' ? 'Enter your code' : 'Escribe tu código'}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium bg-white uppercase"
                  />
                  <button
                    type="button"
                    onClick={applyPromoCode}
                    disabled={promoChecking || !promoInput.trim()}
                    className="px-4 py-3 rounded-xl bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {language === 'en' ? 'Apply' : 'Aplicar'}
                  </button>
                </div>
                {promoMsg && (
                  <p className={`mt-1 text-xs font-medium ${appliedPromo ? 'text-emerald-700' : 'text-red-600'}`}>{promoMsg}</p>
                )}
              </div>

              {/* Payment Methods */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase">{t('wizard.payment_method')}</label>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 space-y-1">
                  <p className="font-bold">
                    {language === 'en' ? 'Minimum deposit to hold your dome' : 'Abono mínimo para apartar tu domo'} ({DEPOSIT_PERCENT}%):{' '}
                    ${depositAmount.toLocaleString('es-CO')} COP
                  </p>
                  <p className="text-xs">
                    {language === 'en'
                      ? 'Your dome is held only when our team confirms your deposit. Until then the dates stay open to other guests. We send you the payment details by WhatsApp.'
                      : 'Tu domo queda apartado solo cuando administración confirma el abono. Mientras tanto las fechas siguen disponibles para otros. Te enviamos los datos de pago por WhatsApp.'}
                  </p>
                </div>
                {([
                  { id: 'Nequi', title: 'Nequi' },
                  { id: 'Daviplata', title: 'Daviplata' },
                ] as const).map(method => (
                  <div
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center space-x-3 ${
                      paymentMethod === method.id ? 'border-emerald-600 bg-emerald-50/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <CreditCard className={`w-5 h-5 ${paymentMethod === method.id ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="font-bold text-slate-900 text-xs">{method.title}</span>
                  </div>
                ))}
              </div>

              {/* Consent: every box starts unchecked. Terms and age are required; marketing is optional. */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-start gap-3 text-sm text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={e => setAcceptTerms(e.target.checked)}
                    required
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    {language === 'en' ? 'I accept the ' : 'Acepto los '}
                    <a href="/?legal=terminos" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 underline">
                      {language === 'en' ? 'terms and conditions' : 'términos y condiciones'}
                    </a>
                    {language === 'en' ? ' and the ' : ', la '}
                    <a href="/?legal=privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 underline">
                      {language === 'en' ? 'privacy policy' : 'política de privacidad'}
                    </a>
                    {language === 'en' ? ' and the ' : ' y la '}
                    <a href="/?legal=reembolsos" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 underline">
                      {language === 'en' ? 'refund and cancellation policy' : 'política de reembolsos y cancelaciones'}
                    </a>
                    .
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAdult}
                    onChange={e => setIsAdult(e.target.checked)}
                    required
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>{language === 'en' ? 'I am over 18 years old and I make this booking for myself or for an adult group.' : 'Soy mayor de 18 años y hago esta reserva para mí o para un grupo de adultos responsables.'}</span>
                </label>
                <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={e => setMarketingOptIn(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>{language === 'en' ? 'Optional: I want to receive offers and news by email or WhatsApp. I can withdraw this at any time.' : 'Opcional: quiero recibir ofertas y novedades por correo o WhatsApp. Puedo retirar este permiso en cualquier momento.'}</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 8: Full Summary & Confirmation */}
          {step === DONE_STEP && (
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-2xl font-bold text-slate-900">{t('wizard.step8_title')}</h4>
                <p className="text-slate-600 text-xs">
                  {t('wizard.step8_code_label')} <strong className="text-emerald-700 font-mono text-base">{confirmedCode}</strong>.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">{t('wizard.summary_type')}</span><span className="font-bold uppercase text-slate-900">{bookingType}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t('wizard.summary_dome')}</span><span className="font-bold text-slate-900">{selectedDome?.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t('wizard.summary_date')}</span><span className="font-bold text-slate-900">{checkIn} {bookingType === 'estadia' ? `${language === 'en' ? 'to' : 'al'} ${checkOut}` : '(8am - 4pm)'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t('wizard.summary_guests')}</span><span className="font-bold text-slate-900">{guests} {t('domes.people')}</span></div>
                {extraPersons > 0 && <div className="flex justify-between"><span className="text-slate-500">{t('wizard.summary_extra_persons')}</span><span className="font-bold text-slate-900">+{extraPersons} (${extraPersonsFee.toLocaleString('es-CO')})</span></div>}
                {hasPet && <div className="flex justify-between"><span className="text-slate-500">{t('wizard.summary_pets')}</span><span className="font-bold text-slate-900">+{petCount} (${petsFee.toLocaleString('es-CO')})</span></div>}
                {addonsTotal > 0 && <div className="flex justify-between"><span className="text-slate-500">{t('wizard.summary_addons')}</span><span className="font-bold text-slate-900">+${addonsTotal.toLocaleString('es-CO')}</span></div>}
                {bbqOnly && <div className="flex justify-between gap-4"><span className="text-slate-500">{language === 'en' ? 'Meals' : 'Comida'}</span><span className="font-bold text-slate-900 text-right">{language === 'en' ? 'Own food - BBQ zone' : 'Comida propia - zona BBQ'}</span></div>}
                {bbqOnly && <div className="flex justify-between"><span className="text-slate-500">{language === 'en' ? 'BBQ zone fee' : 'Zona BBQ'}</span><span className="font-bold text-slate-900">+${BBQ_ZONE_FEE.toLocaleString('es-CO')}</span></div>}
                {foodSummary.length > 0 && <div className="flex justify-between gap-4"><span className="text-slate-500">{language === 'en' ? 'Meals' : 'Comida'}</span><span className="font-bold text-slate-900 text-right">{foodSummary.join(', ')}</span></div>}
                {foodTotal > 0 && <div className="flex justify-between"><span className="text-slate-500">{language === 'en' ? 'Meals total (included)' : 'Total comida (incluido)'}</span><span className="font-bold text-slate-900">+${foodTotal.toLocaleString('es-CO')}</span></div>}
                {effectiveDiscountPercent > 0 && <div className="flex justify-between text-emerald-700"><span className="font-medium">{t('wizard.summary_discount')} ({effectiveDiscountPercent}%):</span><span className="font-bold">-${discountAmount.toLocaleString('es-CO')}</span></div>}
                <div className="flex justify-between pt-3 border-t border-slate-200 text-sm font-black text-slate-900">
                  <span>{t('wizard.summary_total')}</span>
                  <span className="text-emerald-700">${totalAmount.toLocaleString('es-CO')} COP</span>
                </div>
              </div>
              {confirmedSummary && (
                <div className="p-5 rounded-2xl bg-white border border-slate-200 text-left space-y-2">
                  <p className="text-xs font-bold text-slate-900">{language === 'en' ? 'Booking detail (what you ordered and the price of each item)' : 'Detalle de tu reserva (lo que pediste y el valor de cada cosa)'}</p>
                  <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed font-mono text-slate-700">{confirmedSummary}</pre>
                </div>
              )}
              <a
                href={whatsappLink(confirmedSummary
                  ? `${language === 'en' ? 'Hi, I just made a booking. Here are the details:' : 'Hola, acabo de hacer una reserva. Este es el detalle:'}\n\n${confirmedSummary}`
                  : `Hola, acabo de hacer la reserva ${confirmedCode} en Eco Glamping Chinauta (${selectedDome?.name || ''}, ${checkIn} al ${checkOut}). Quedo atento(a) a la confirmación.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-semibold text-sm shadow-lg hover:bg-emerald-700 transition-colors"
              >
                {language === 'en' ? 'Confirm on WhatsApp' : 'Confirmar por WhatsApp'}
              </a>
            </div>
          )}

        </div>

        {/* Food-step message sits right above the buttons so it is always visible */}
        {errorMsg && step === FOOD_STEP && (
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-bold">
            {errorMsg}
          </div>
        )}

        {/* While choosing food, the price is always visible right above the buttons */}
        {step === FOOD_STEP && (
          <div
            className="mx-4 sm:mx-6 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm space-y-0.5"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-emerald-900">
                {bbqOnly
                  ? (language === 'en' ? 'BBQ zone (own food)' : 'Zona BBQ (comida propia)')
                  : (() => {
                      const dishes = Object.values(foodChoices).reduce((s, c) => s + (c?.qty || 0), 0);
                      return language === 'en'
                        ? `Meals: ${dishes} ${dishes === 1 ? 'dish' : 'dishes'}`
                        : `Comida: ${dishes} ${dishes === 1 ? 'plato' : 'platos'}`;
                    })()}
              </span>
              <span className="font-black text-emerald-800">
                ${(bbqOnly ? BBQ_ZONE_FEE : foodTotal).toLocaleString('es-CO')} COP
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-emerald-900">
              <span>{language === 'en' ? 'Booking total so far' : 'Total de la reserva hasta ahora'}</span>
              <span className="font-bold">${totalAmount.toLocaleString('es-CO')} COP</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {step > 1 && step < DONE_STEP ? (
            <button
              onClick={() => setStep(prev => prev - 1)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-700 hover:bg-slate-100 flex items-center justify-center space-x-2 text-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('wizard.prev_btn')}</span>
            </button>
          ) : <div />}

          <div className="w-full sm:w-auto flex justify-end">
            {step < CONTACT_STEP && (
              <button
                onClick={() => {
                  if (step === 2 && !validateStep2()) return;
                  if (step === FOOD_STEP && !bbqOnly) {
                    if (foodSummary.length === 0) {
                      setErrorMsg(language === 'en'
                        ? 'Add at least one dish, or choose "Bring my own food".'
                        : 'Agrega al menos un plato, o elige "Traer mi propia comida".');
                      return;
                    }
                    if (foodIncomplete) {
                      setErrorMsg(language === 'en'
                        ? `Choose the meat and how you want it for: ${foodMissingNames.join(', ')} (marked in yellow).`
                        : `Elige la carne y cómo la quieres en: ${foodMissingNames.join(', ')} (marcado en amarillo).`);
                      return;
                    }
                  }
                  if (step === 4 && tooManyGuests) {
                    setErrorMsg(language === 'en'
                      ? `${selectedDome?.name} takes up to ${domeMaxGuests} guests. Choose another dome below or change the number of guests.`
                      : `El ${selectedDome?.name} recibe máximo ${domeMaxGuests} personas. Elige otro domo abajo o cambia el número de personas.`);
                    return;
                  }
                  if (step === 3 && !selectedDomeId) {
                    setErrorMsg(t('wizard.select_dome_err'));
                    return;
                  }
                  setErrorMsg('');
                  setStep(prev => prev + 1);
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 flex items-center justify-center space-x-2 text-sm shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <span>{t('wizard.next_btn')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === CONTACT_STEP && (
              <button
                onClick={handleConfirmBooking}
                disabled={submitting || !acceptTerms || !isAdult}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold hover:from-emerald-700 hover:to-teal-800 shadow-lg shadow-emerald-700/30 flex items-center justify-center space-x-2 text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
              >
                <span>{submitting ? t('wizard.confirming_btn') : `${t('wizard.confirm_btn')} ($${totalAmount.toLocaleString('es-CO')} COP)`}</span>
                <ShieldCheck className="w-5 h-5 shrink-0" />
              </button>
            )}

            {step === DONE_STEP && (
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 text-sm cursor-pointer"
              >
                {t('wizard.close_btn')}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

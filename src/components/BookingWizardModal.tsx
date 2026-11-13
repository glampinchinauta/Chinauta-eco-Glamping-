import React, { useState, useEffect } from 'react';
import { X, Calendar, Compass, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, CreditCard, Sparkles, Heart, Sun, Clock, Dog, Wine } from 'lucide-react';
import { Dome } from '../types';
import { ImageCarousel } from './ImageCarousel';
import { getDomeImages, DEFAULT_DOMES } from '../utils/domeImages';
import { useLanguage } from '../context/LanguageContext';
import { CHINAUTA_MENU_ITEMS } from './FoodMenuSection';
import { isColombianHoliday } from '../utils/colombiaHolidays';

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
    coupleMassage: boolean;
  }>({
    bonoTime: false,
    decorVip: false,
    decorBasic: false,
    coupleMassage: false
  });
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
    setFoodChoices(prev => ({ ...prev, [id]: { preparation: '', meat: '', side: '', qty: 0, ...prev[id], ...patch } }));
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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [notes, setNotes] = useState('');

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState('Transferencia Bancaria');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedCode, setConfirmedCode] = useState('');

  // Consent boxes. Always unchecked when the wizard opens: the guest must choose each of them.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isAdult, setIsAdult] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Reset the wizard only when it opens. (Before, this also ran on every date change and sent the guest back to step 1.)
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setConfirmedCode('');
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
      const data = await res.json();
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
    .map(i => {
      const c = foodChoices[String(i.id)];
      return `${i.title}${c.meat ? ` - ${c.meat}` : ''}${c.preparation ? ` (${c.preparation})` : ''} x${c.qty}`;
    });
  const foodMissingNames: string[] = bbqOnly ? [] : menuItems
    .filter(i => {
      const c = foodChoices[String(i.id)];
      if (!c || c.qty <= 0) return false;
      const g = getPrepGroups(i);
      return (g.meats.length > 0 && !c.meat) || (g.styles.length > 0 && !c.preparation);
    })
    .map(i => (language === 'en' ? (i.title_en || i.title) : i.title));
  const foodIncomplete = foodMissingNames.length > 0;

  const selectedDome = domes.find(d => Number(d.id) === Number(selectedDomeId));

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
  const massageFee = selectedAddons.coupleMassage ? 250000 : 0;
  const addonsTotal = bonoTimeFee + decorFee + massageFee;

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
          booking_type: bookingType,
          pets: hasPet ? petCount : 0,
          addons: selectedAddons,
          food_items: (Object.entries(foodChoices) as [string, { qty: number }][])
            .filter(([, c]) => (c?.qty || 0) > 0)
            .map(([id, c]) => ({ id: Number(id), qty: c.qty })),
          notes:`[${bookingType.toUpperCase()}] Mascotas: ${hasPet ? petCount : 0}. Addons: ${Object.entries(selectedAddons).filter(([_,v]) => v).map(([k]) => k).join(', ')}. Mensaje decorativo: ${customMessage}. Comida: ${bbqOnly ? 'No (usará zona BBQ con comida propia)' : (foodSummary.join('; ') || 'No seleccionada')}. Notas: ${notes}`,
          consent: {
            terms: acceptTerms,
            age: isAdult,
            marketing: marketingOptIn
          },
          customer: {
            name,
            phone,
            whatsapp: whatsapp || phone,
            email,
            document_id: documentId,
            notes
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('wizard.booking_process_err'));
      }

      setConfirmedCode(data.reservation_code);
      setStep(9);
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
          {errorMsg && step !== 7 && (
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
                        {t('wizard.capacity_desc').replace('{count}', String(dome.capacity || 2))} {dome.id === 1 ? t('wizard.small_jacuzzi') : dome.id === 2 ? t('wizard.extra_bed') : ''}
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
                {t('wizard.step4_sub').replace('{cap}', String(selectedDome?.capacity || 2))}
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">{t('wizard.guests_label')}</label>
                <select
                  value={guests}
                  onChange={e => setGuests(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 font-medium focus:outline-hidden focus:border-emerald-500 bg-white text-sm"
                >
                  <option value={1}>{t('wizard.guest_1')}</option>
                  <option value={2}>{t('wizard.guest_2')}</option>
                  <option value={3}>{t('wizard.guest_3')} {selectedDome?.id === 2 ? t('wizard.extra_bed') : ''}</option>
                  <option value={4}>{t('wizard.guest_4')}</option>
                </select>
              </div>

              {extraPersons > 0 && (
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

                {/* Masaje en Pareja */}
                <div
                  onClick={() => setSelectedAddons({...selectedAddons, coupleMassage: !selectedAddons.coupleMassage})}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    selectedAddons.coupleMassage ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                      <Heart className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-sm">{t('wizard.massage_title')}</h5>
                      <p className="text-xs text-slate-500">{t('wizard.massage_desc')}</p>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-700 text-sm">+$250.000 COP</span>
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

          {/* STEP 7: Food Choices */}
          {step === 7 && (
            <div className="space-y-6">
              <h4 className="text-xl font-bold text-slate-900">{language === 'en' ? 'Choose your meals' : 'Elige tu comida'}</h4>
              <p className="text-sm text-slate-600">
                {language === 'en'
                  ? 'Select the dishes and how many portions you want (at least one).'
                  : 'Selecciona los platos y cuántas porciones quieres (al menos uno).'}
              </p>

              {/* Live running total, updated with every choice */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  {language === 'en' ? 'Your meal order' : 'Tu pedido de comida'}
                </h5>
                {bbqOnly ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">{language === 'en' ? 'BBQ zone (own food)' : 'Zona BBQ (comida propia)'}</span>
                    <span className="font-bold text-slate-900">${BBQ_ZONE_FEE.toLocaleString('es-CO')}</span>
                  </div>
                ) : menuItems.filter(i => (foodChoices[String(i.id)]?.qty || 0) > 0).length === 0 ? (
                  <p className="text-sm text-slate-500">{language === 'en' ? 'No dishes selected yet.' : 'Todavía no has elegido platos.'}</p>
                ) : (
                  menuItems
                    .filter(i => (foodChoices[String(i.id)]?.qty || 0) > 0)
                    .map(i => {
                      const qty = foodChoices[String(i.id)]?.qty || 0;
                      const line = (Number(i.price) || 0) * qty;
                      return (
                        <div key={String(i.id)} className="flex justify-between text-sm gap-3">
                          <span className="text-slate-700">{language === 'en' ? (i.title_en || i.title) : i.title} x{qty}</span>
                          <span className="font-bold text-slate-900 shrink-0">${line.toLocaleString('es-CO')}</span>
                        </div>
                      );
                    })
                )}
                <div className="flex justify-between text-base border-t border-emerald-200 pt-2">
                  <span className="font-bold text-emerald-900">{language === 'en' ? 'Meals total' : 'Total de comida'}</span>
                  <span className="font-black text-emerald-800">${(bbqOnly ? BBQ_ZONE_FEE : foodTotal).toLocaleString('es-CO')} COP</span>
                </div>
              </div>

              {/* BBQ zone option: guest brings their own food */}
              <div
                onClick={() => {
                  const next = !bbqOnly;
                  setBbqOnly(next);
                  if (next) setFoodChoices({});
                }}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  bbqOnly ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  <h5 className="font-bold text-slate-900 text-sm">
                    {language === 'en' ? 'No food: I will use the BBQ zone' : 'No quiero comida: usaré la zona BBQ'}
                  </h5>
                  <p className="text-xs text-slate-500">
                    {language === 'en'
                      ? 'Bring your own food and cook it at the BBQ area of the property.'
                      : 'Llevo mi propia comida y la preparo en la zona de barbacoa del lugar.'}
                  </p>
                  <p className="text-xs font-bold text-emerald-700 mt-1">
                    {language === 'en' ? 'BBQ zone fee' : 'Costo zona BBQ'}: ${BBQ_ZONE_FEE.toLocaleString('es-CO')} COP
                  </p>
                </div>
                <span className="font-bold text-emerald-700 text-sm shrink-0">{bbqOnly ? '✓' : ''}</span>
              </div>

              {menuItems.length === 0 && !bbqOnly && (
                <p className="text-sm text-slate-500">{language === 'en' ? 'Loading menu...' : 'Cargando menú...'}</p>
              )}

              {!bbqOnly && <div className="space-y-3">
                {menuItems.map(item => {
                  const choice = foodChoices[String(item.id)] || { preparation: '', meat: '', side: '', qty: 0 };
                  const active = choice.qty > 0;
                  const title = language === 'en' ? (item.title_en || item.title) : item.title;
                  const groups = getPrepGroups(item);
                  const sideLabel = (i: number) => (language === 'en' ? (groups.sides_en[i] || groups.sides[i]) : groups.sides[i]);
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
                        active ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h5 className="font-bold text-slate-900 text-sm">{title}</h5>
                          <p className="text-xs text-emerald-700 font-bold">${Number(item.price || 0).toLocaleString('es-CO')} COP / {language === 'en' ? 'portion' : 'porción'}</p>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <label className="text-xs text-slate-500">{language === 'en' ? 'Portions' : 'Porciones'}</label>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={choice.qty}
                            onChange={e => setFoodChoice(String(item.id), { qty: Math.max(0, Number(e.target.value) || 0) })}
                            className="w-20 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium"
                          />
                        </div>
                      </div>
                      {active && groups.meats.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">{language === 'en' ? 'Type of meat' : 'Tipo de carne'}</label>
                          <select
                            value={choice.meat}
                            onChange={e => setFoodChoice(String(item.id), { meat: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-white"
                          >
                            <option value="">{language === 'en' ? 'Choose meat' : 'Elige la carne'}</option>
                            {groups.meats.map(p => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {active && groups.styles.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">{language === 'en' ? 'Preparation' : 'Preparación'}</label>
                          <select
                            value={choice.preparation}
                            onChange={e => setFoodChoice(String(item.id), { preparation: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-white"
                          >
                            <option value="">{language === 'en' ? 'Choose preparation' : 'Elige la preparación'}</option>
                            {groups.styles.map(p => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {(groups.sides.length > 0 || item.beverage) && (
                        <p className="text-xs font-semibold text-emerald-800">
                          {language === 'en' ? 'Included in the price: ' : 'Incluido en el precio: '}
                          {[
                            ...groups.sides.map((_: string, idx: number) => sideLabel(idx)),
                            language === 'en' ? (item.beverage_en || item.beverage) : item.beverage,
                          ].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>}

              <p className="text-xs text-slate-500">
                {language === 'en' ? 'Selected dishes: ' : 'Platos seleccionados: '}
                {foodSummary.length > 0 ? foodSummary.join(', ') : (language === 'en' ? 'none' : 'ninguno')}
              </p>
              <p className="text-sm font-bold text-slate-900">
                {language === 'en' ? 'Meals (included in the total): ' : 'Comida (incluida en el total): '}
                ${foodTotal.toLocaleString('es-CO')} COP
              </p>
            </div>
          )}

          {/* STEP 8: Guest Details & Payment */}
          {step === 8 && (
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
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={t('wizard.phone_ph')}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium"
                    required
                  />
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
                {[
                  { id: 'Transferencia Bancaria', title: t('wizard.pay_transfer') },
                  { id: 'Wompi', title: t('wizard.pay_wompi') },
                  { id: 'Mercado Pago', title: t('wizard.pay_mercadopago') }
                ].map(method => (
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
          {step === 9 && (
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
            </div>
          )}

        </div>

        {/* Food-step message sits right above the buttons so it is always visible */}
        {errorMsg && step === 7 && (
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-bold">
            {errorMsg}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {step > 1 && step < 9 ? (
            <button
              onClick={() => setStep(prev => prev - 1)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-700 hover:bg-slate-100 flex items-center justify-center space-x-2 text-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('wizard.prev_btn')}</span>
            </button>
          ) : <div />}

          <div className="w-full sm:w-auto flex justify-end">
            {step < 8 && (
              <button
                onClick={() => {
                  if (step === 2 && !validateStep2()) return;
                  if (step === 7 && !bbqOnly) {
                    if (foodSummary.length === 0) {
                      setErrorMsg(language === 'en'
                        ? 'Please choose at least one dish, or select the BBQ zone option.'
                        : 'Elige al menos un plato, o marca la opción de zona BBQ.');
                      return;
                    }
                    if (foodIncomplete) {
                      setErrorMsg(language === 'en'
                        ? `Please finish the choices for: ${foodMissingNames.join(', ')}.`
                        : `Falta completar: ${foodMissingNames.join(', ')}.`);
                      return;
                    }
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

            {step === 8 && (
              <button
                onClick={handleConfirmBooking}
                disabled={submitting || !acceptTerms || !isAdult}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold hover:from-emerald-700 hover:to-teal-800 shadow-lg shadow-emerald-700/30 flex items-center justify-center space-x-2 text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
              >
                <span>{submitting ? t('wizard.confirming_btn') : `${t('wizard.confirm_btn')} ($${totalAmount.toLocaleString('es-CO')} COP)`}</span>
                <ShieldCheck className="w-5 h-5 shrink-0" />
              </button>
            )}

            {step === 9 && (
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

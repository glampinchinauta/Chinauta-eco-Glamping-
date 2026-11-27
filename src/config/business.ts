// WhatsApp number that receives booking details (country code + number, no spaces or +).
// Provisional: same number used across the site (+57 324 296 9426). Confirm before publishing.
export const BUSINESS_WHATSAPP = '573242969426';

// Masajes (60 min). El servidor tiene los mismos valores en api/app.ts (MASSAGE_PRICES): cambiar ambos juntos.
export const MASSAGE_PRICES = { individual: 150000, pareja: 250000 } as const;
export type MassageType = keyof typeof MASSAGE_PRICES;
export type MassageTherapist = 'indiferente' | 'mujer' | 'hombre';
export const MASSAGE_TYPE_LABELS: Record<MassageType, { es: string; en: string }> = {
  individual: { es: 'Masaje individual (1 persona)', en: 'Individual massage (1 person)' },
  pareja: { es: 'Masaje en pareja (2 personas)', en: 'Couples massage (2 people)' },
};
export const MASSAGE_THERAPIST_LABELS: Record<MassageTherapist, { es: string; en: string }> = {
  indiferente: { es: 'Sin preferencia', en: 'No preference' },
  mujer: { es: 'Masajista mujer', en: 'Female therapist' },
  hombre: { es: 'Masajista hombre', en: 'Male therapist' },
};

export function whatsappLink(text: string, number: string = BUSINESS_WHATSAPP): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

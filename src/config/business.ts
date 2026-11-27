// WhatsApp number that receives booking details (country code + number, no spaces or +).
// Provisional: same number used across the site (+57 324 296 9426). Confirm before publishing.
export const BUSINESS_WHATSAPP = '573242969426';

// Masajes (60 min). Solo en pareja. El servidor tiene el mismo valor en api/app.ts (MASSAGE_PRICES): cambiar ambos juntos.
export const MASSAGE_PRICES = { pareja: 280000 } as const;
export type MassageType = keyof typeof MASSAGE_PRICES;
export type MassageTherapist = 'indiferente' | 'mujer' | 'hombre';
export const MASSAGE_TYPE_LABELS: Record<MassageType, { es: string; en: string }> = {
  pareja: { es: 'Masaje en pareja (2 personas)', en: 'Couples massage (2 people)' },
};
// Fotos del paso de masajes (rutas dentro de /public, por ejemplo '/assets/images/masaje-1.webp').
// Si la lista está vacía, el paso se muestra sin fotos.
export const MASSAGE_PHOTOS: string[] = [];
export const MASSAGE_THERAPIST_LABELS: Record<MassageTherapist, { es: string; en: string }> = {
  indiferente: { es: 'Sin preferencia', en: 'No preference' },
  mujer: { es: 'Masajista mujer', en: 'Female therapist' },
  hombre: { es: 'Masajista hombre', en: 'Male therapist' },
};

export function whatsappLink(text: string, number: string = BUSINESS_WHATSAPP): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

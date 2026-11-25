// WhatsApp number that receives booking details (country code + number, no spaces or +).
// Provisional: same number used across the site (+57 324 296 9426). Confirm before publishing.
export const BUSINESS_WHATSAPP = '573242969426';

export function whatsappLink(text: string, number: string = BUSINESS_WHATSAPP): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

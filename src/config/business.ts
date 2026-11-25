// WhatsApp number that receives booking details (country code + number, no spaces or +).
export const BUSINESS_WHATSAPP = '573213109331';

export function whatsappLink(text: string, number: string = BUSINESS_WHATSAPP): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

// Colombian mobiles have 10 digits; add the country code. Other numbers are used as they are.
export function toWhatsappNumber(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `57${digits}` : digits;
}

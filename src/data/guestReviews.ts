// Opiniones reales de huéspedes (calificación 10 sobre 10). Se muestran siempre, de la más nueva a la más antigua.
// Para agregar otra: copia un bloque, cambia los datos y pon la foto en public/assets/images/reviews/ (sin foto se muestra la inicial).
export interface GuestReview {
  id: string;
  name: string;
  country: string;
  /** Calificación sobre 10. */
  score: number;
  /** AAAA-MM-DD */
  date: string;
  title: string;
  comment: string;
  avatar?: string;
}

export const GUEST_REVIEWS: GuestReview[] = [
  {
    id: 'rev-serrano',
    name: 'Serrano',
    country: 'Colombia',
    score: 10,
    date: '2026-11-24',
    title: 'Excelente lugar para conectar con la naturaleza',
    comment: 'La atención muy buena, muy gentiles, las bebidas estaban bastante frías, la comida estaba deliciosa y la llevan hasta el glamping, todo muy bonito, muy bien equipado.',
    avatar: '/assets/images/reviews/serrano.png',
  },
  {
    id: 'rev-jairo',
    name: 'Jairo',
    country: 'Colombia',
    score: 10,
    date: '2026-10-05',
    title: 'Pienso volver a hospedarme en este sitio, ojalá con familia',
    comment: 'El servicio de don Jorge y su familia, muy buenos anfitriones, estaban pendientes del huésped, si necesitaba algo respondían muy pronto.',
    avatar: '/assets/images/reviews/jairo.png',
  },
  {
    id: 'rev-michael',
    name: 'Michael',
    country: 'Colombia',
    score: 10,
    date: '2026-09-08',
    title: 'Glamping Eco Chinauta',
    comment: 'Muy buena calidad de los servicios, excelente limpieza, muy buena calidad de atención, el clima es perfecto, recomiendo mucho el lugar...',
  },
  {
    id: 'rev-cruz',
    name: 'Cruz',
    country: 'Colombia',
    score: 10,
    date: '2026-03-22',
    title: 'Excepcional',
    comment: '¡Superó mis expectativas! 🌿✨ El concepto eco está muy bien logrado sin perder la comodidad. La atención fue de primera y el paisaje es simplemente inmejorable. ⛰️ El sitio perfecto para desconectar de la ciudad y recargar energías. 🔋🙌 ¡Totalmente recomendado!',
    avatar: '/assets/images/reviews/cruz.png',
  },
];

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11-24" → "24 de noviembre de 2026" / "November 24, 2026" */
export function formatReviewDate(date: string, language: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const [, y, mo, d] = m;
  const month = Number(mo) - 1;
  return language === 'en' ? `${MONTHS_EN[month]} ${Number(d)}, ${y}` : `${Number(d)} de ${MONTHS_ES[month]} de ${y}`;
}

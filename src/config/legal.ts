/**
 * Datos legales de la empresa y textos de cumplimiento.
 *
 * IMPORTANTE: los valores que dicen "PENDIENTE" deben completarlos el propietario antes de publicar el sitio.
 * Se muestran resaltados en las páginas legales para que no se publiquen por error.
 * Cualquier cambio en los textos legales debe ir acompañado de un cambio en LEGAL_VERSION
 * (el servidor guarda esa versión junto a cada aceptación de términos).
 */

export const LEGAL_VERSION = '2026-11-12';

export const COMPANY = {
  brandName: 'Eco Glamping Chinauta',
  legalName: 'PENDIENTE: razón social de la empresa',
  nit: 'PENDIENTE: NIT',
  rnt: 'PENDIENTE: número de Registro Nacional de Turismo (RNT)',
  address: 'Vía Principal Chinauta Km 4.5, Fusagasugá, Cundinamarca, Colombia',
  email: 'contacto@ecoglampingchinauta.com',
  phone: '+57 321 310 9331',
  // Responsable del tratamiento de datos personales y canal para ejercer derechos (Ley 1581 de 2012).
  dataControllerEmail: 'contacto@ecoglampingchinauta.com',
  // Canal para reclamos por derechos de autor (contenido del sitio: fotos, videos, textos).
  copyrightEmail: 'contacto@ecoglampingchinauta.com',
};

/**
 * Plazos de conservación propuestos. Confirmarlos con el contador y el abogado antes de publicar.
 */
export const RETENTION_PERIODS: { data: string; period: string; basis: string }[] = [
  {
    data: 'Reservas, pagos y facturación',
    period: '10 años desde la última transacción',
    basis: 'Obligación de conservar libros y documentos contables y tributarios.',
  },
  {
    data: 'Registro de aceptación de términos y de la edad del huésped',
    period: 'Mismo plazo que las reservas (10 años)',
    basis: 'Prueba de que el titular aceptó las condiciones.',
  },
  {
    data: 'Datos de contacto de huéspedes sin reservas activas',
    period: '2 años desde su última reserva; después se eliminan o anonimizan',
    basis: 'Finalidad de la reserva ya cumplida.',
  },
  {
    data: 'Autorización de marketing (ofertas por correo o WhatsApp)',
    period: 'Hasta que el titular la revoque. Se revisa cada 2 años.',
    basis: 'Consentimiento previo, expreso e informado.',
  },
  {
    data: 'Datos de analítica y publicidad (Google Analytics, Meta), solo con tu consentimiento',
    period: 'Hasta 14 meses en las cookies; luego lo gestiona cada proveedor según su configuración',
    basis: 'Consentimiento expreso para medir visitas y campañas.',
  },
  {
    data: 'Registros de auditoría del panel administrativo',
    period: '5 años',
    basis: 'Seguridad y control interno.',
  },
  {
    data: 'Mensajes del asistente virtual con IA',
    period: 'No se guardan en el servidor. El proveedor de IA los procesa según sus condiciones (ver política).',
    basis: 'Atención en línea.',
  },
];

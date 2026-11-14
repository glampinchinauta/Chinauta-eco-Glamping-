import { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export type SEOPageContext = 
  | 'home'
  | 'domes'
  | 'availability'
  | 'menu'
  | 'map'
  | 'contact'
  | 'faq'
  | 'admin';

export interface SEOMetadata {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType?: 'website' | 'article' | 'place';
  twitterCard?: 'summary_large_image' | 'summary';
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonicalPath?: string;
  structuredData?: Record<string, any>;
}

const DEFAULT_SHARE_IMAGE = '/assets/images/og-chinauta.jpg';

export const SEO_CONFIGS: Record<'es' | 'en', Record<SEOPageContext, SEOMetadata>> = {
  es: {
    home: {
      title: 'Eco Glamping Chinauta | Domos de Lujo con Jacuzzi Privado',
      description: 'Vive una experiencia única en Eco Glamping Chinauta, Fusagasugá. Domos geodésicos de lujo con jacuzzi privado, malla catamarán, fogata y clima templado.',
      keywords: 'glamping chinauta, domos fusagasuga, glamping cundinamarca, jacuzzi privado, escapada romantica bogota, hotel campestre',
      ogTitle: 'Eco Glamping Chinauta | Domos Exclusivos con Jacuzzi Privado',
      ogDescription: 'Desconexión total a solo 90 min de Bogotá. Domos bioclimáticos de lujo, jacuzzi con hidromasaje, cenas románticas y noches bajo las estrellas.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'website',
      canonicalPath: '/',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'LodgingBusiness',
        'name': 'Eco Glamping Chinauta',
        'description': 'Glamping exclusivo con domos geodésicos de lujo, jacuzzis privados y vistas panorámicas a las montañas.',
        'url': '/',
        'telephone': '+573213109331',
        'email': 'ecoglampingventas@gmail.com',
        'priceRange': '$$$',
        'address': {
          '@type': 'PostalAddress',
          'streetAddress': 'Vía Principal Chinauta Km 4.5',
          'addressLocality': 'Fusagasugá',
          'addressRegion': 'Cundinamarca',
          'postalCode': '252211',
          'addressCountry': 'CO'
        },
        'geo': {
          '@type': 'GeoCoordinates',
          'latitude': 4.3167,
          'longitude': -74.4333
        },
        'amenityFeature': [
          { '@type': 'LocationFeatureSpecification', 'name': 'Jacuzzi Privado con Hidromasaje', 'value': true },
          { '@type': 'LocationFeatureSpecification', 'name': 'Malla Catamarán Panorámica', 'value': true },
          { '@type': 'LocationFeatureSpecification', 'name': 'Parqueadero Privado Gratuito', 'value': true },
          { '@type': 'LocationFeatureSpecification', 'name': 'Pet Friendly', 'value': true },
          { '@type': 'LocationFeatureSpecification', 'name': 'Restaurante y Cenas Románticas', 'value': true }
        ]
      }
    },
    domes: {
      title: 'Domos Ancestrales de Lujo | Eco Glamping Chinauta',
      description: 'Conoce nuestros 6 domos geodésicos: Huitaca, Bochica, Bachué, Luna Chía, Chiminichagua y Xue Sol. Todos con jacuzzi privado y vistas a la montaña.',
      keywords: 'domos glamping, domo huitaca, domo bochica, domo bachue, cabañas con jacuzzi, glamping parejas chinauta',
      ogTitle: 'Nuestros 6 Domos Ancestrales | Eco Glamping Chinauta',
      ogDescription: 'Elige tu domo geodésico preferido con hidromasaje, cama king, asoleadoras y arquitectura bioclimática.',
      ogImage: '/assets/images/og-chinauta.jpg',
      ogType: 'website',
      canonicalPath: '/'
    },
    availability: {
      title: 'Consultar Disponibilidad y Tarifas en Tiempo Real | Eco Glamping Chinauta',
      description: 'Revisa las fechas disponibles y tarifas garantizadas para tu estadía en Eco Glamping Chinauta. Reserva directa sin intermediarios.',
      keywords: 'tarifas glamping chinauta, disponibilidad domos, reservar glamping fusagasuga, precios glamping colombia',
      ogTitle: 'Disponibilidad y Tarifas en Tiempo Real | Eco Glamping Chinauta',
      ogDescription: 'Selecciona tus fechas de check-in y salida para reservar tu domo con tarifa preferencial.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'website',
      canonicalPath: '/'
    },
    menu: {
      title: 'Menú Gastronómico y Restaurante | Eco Glamping Chinauta',
      description: 'Disfruta de nuestra cocina artesanal: trucha gratinada, lomo de res madurado, costillitas BBQ, pechuga a las finas hierbas y postres típicos.',
      keywords: 'restaurante glamping chinauta, cenas romanticas fusagasuga, menu campestre chinauta, trucha gratinada',
      ogTitle: 'Menú Gastronómico Artesanal | Eco Glamping Chinauta',
      ogDescription: 'Almuerzos campestres, cenas gourmet para parejas, tabla de quesos y bebidas naturales.',
      ogImage: '/assets/images/og-chinauta.jpg',
      ogType: 'website',
      canonicalPath: '/'
    },
    map: {
      title: 'Mapa Interactivo y Rutas de Acceso | Eco Glamping Chinauta',
      description: 'Ubica nuestro eco glamping en Chinauta, Fusagasugá. Consulta puntos de interés turísticos, senderos y la mejor ruta desde Bogotá.',
      keywords: 'como llegar chinauta glamping, mapa fusagasuga, atractivos turisticos chinauta, ruta bogota chinauta',
      ogTitle: 'Mapa Interactivo y Ubicación | Eco Glamping Chinauta',
      ogDescription: 'Ruta pavimentada y segura hasta nuestras instalaciones en el kilómetro 4.5 de la vía a Chinauta.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'place',
      canonicalPath: '/'
    },
    contact: {
      title: 'Contacto y Ubicación | Eco Glamping Chinauta',
      description: 'Comunícate con nuestro equipo de atención por WhatsApp, llamada o correo. Te asesoramos con tu reserva y requerimientos especiales.',
      keywords: 'contacto glamping chinauta, whatsapp eco glamping, reservas chinauta telefono',
      ogTitle: 'Atención y Contacto Directo | Eco Glamping Chinauta',
      ogDescription: 'Estamos disponibles 24/7 para asistirte con reservas, celebraciones de aniversario y peticiones personalizadas.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'website',
      canonicalPath: '/'
    },
    faq: {
      title: 'Preguntas Frecuentes (FAQ) | Eco Glamping Chinauta',
      description: 'Respuestas a dudas comunes: horarios de check-in/out, política pet friendly, servicios incluidos, clima y formas de pago en Eco Glamping Chinauta.',
      keywords: 'preguntas frecuentes glamping chinauta, check in glamping, se aceptan mascotas glamping, clima chinauta',
      ogTitle: 'Preguntas Frecuentes | Eco Glamping Chinauta',
      ogDescription: 'Todo lo que necesitas saber antes de tu visita: horarios, mascotas, jacuzzi privado, alimentación y parqueadero.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'website',
      canonicalPath: '/',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': [
          {
            '@type': 'Question',
            'name': '¿Cuáles son los horarios de Check-in y Check-out?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'El Check-in es a partir de las 3:00 p.m. y el Check-out es hasta las 11:00 a.m. Contamos con Bono Time para extender tu estancia.'
            }
          },
          {
            '@type': 'Question',
            'name': '¿El glamping es Pet Friendly?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'Sí, aceptamos mascotas de todas las razas con una tarifa de $30.000 COP por mascota por estadía.'
            }
          },
          {
            '@type': 'Question',
            'name': '¿Cada domo cuenta con jacuzzi privado?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'Sí, todos nuestros domos cuentan con jacuzzi privado de hidromasaje exclusivo para tu estadía.'
            }
          }
        ]
      }
    },
    admin: {
      title: 'Panel de Administración | Eco Glamping Chinauta',
      description: 'Módulo interno seguro de gestión de reservas, ocupación de domos, clientes, finanzas y auditoría operativa.',
      keywords: 'portal administracion glamping chinauta',
      ogTitle: 'Panel Administrativo | Eco Glamping Chinauta',
      ogDescription: 'Gestión y control de reservas y operaciones.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'website',
      canonicalPath: '/admin'
    }
  },
  en: {
    home: {
      title: 'Eco Glamping Chinauta | Luxury Domes with Private Jacuzzi',
      description: 'Experience an unforgettable nature getaway at Eco Glamping Chinauta, Colombia. Geodesic luxury domes with private jacuzzi, catamaran net, firepit, and warm weather.',
      keywords: 'glamping colombia, luxury domes chinauta, glamping with jacuzzi, romantic getaway bogota, nature retreat',
      ogTitle: 'Eco Glamping Chinauta | Exclusive Domes with Private Hot Tub',
      ogDescription: 'Peaceful retreat only 90 minutes from Bogotá. Bioclimatic domes, private jacuzzi hydrotherapy, romantic dinners, and starry night skies.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'website',
      canonicalPath: '/',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'LodgingBusiness',
        'name': 'Eco Glamping Chinauta',
        'description': 'Exclusive eco glamping featuring luxury geodesic domes, private hydromassage jacuzzis, and sweeping mountain panoramas.',
        'url': '/',
        'telephone': '+573213109331',
        'email': 'ecoglampingventas@gmail.com',
        'priceRange': '$$$',
        'address': {
          '@type': 'PostalAddress',
          'streetAddress': 'Vía Principal Chinauta Km 4.5',
          'addressLocality': 'Fusagasugá',
          'addressRegion': 'Cundinamarca',
          'postalCode': '252211',
          'addressCountry': 'CO'
        },
        'geo': {
          '@type': 'GeoCoordinates',
          'latitude': 4.3167,
          'longitude': -74.4333
        },
        'amenityFeature': [
          { '@type': 'LocationFeatureSpecification', 'name': 'Private Hydromassage Jacuzzi', 'value': true },
          { '@type': 'LocationFeatureSpecification', 'name': 'Panoramic Catamaran Lounging Mesh', 'value': true },
          { '@type': 'LocationFeatureSpecification', 'name': 'Free Private Parking', 'value': true },
          { '@type': 'LocationFeatureSpecification', 'name': 'Pet Friendly Accommodation', 'value': true },
          { '@type': 'LocationFeatureSpecification', 'name': 'Restaurant & Romantic Dinners', 'value': true }
        ]
      }
    },
    domes: {
      title: 'Ancestral Luxury Domes | Eco Glamping Chinauta',
      description: 'Discover our 6 geodesic domes: Huitaca, Bochica, Bachué, Luna Chía, Chiminichagua, and Xue Sol. Each equipped with a private jacuzzi and scenic vistas.',
      keywords: 'geodesic domes glamping, private jacuzzi glamping, huitaca dome, couples retreat chinauta',
      ogTitle: 'Our 6 Ancestral Domes | Eco Glamping Chinauta',
      ogDescription: 'Select your preferred geodesic dome with hot tub, king bed, sun loungers, and bioclimatic architecture.',
      ogImage: '/assets/images/og-chinauta.jpg',
      ogType: 'website',
      canonicalPath: '/'
    },
    availability: {
      title: 'Check Real-Time Availability & Rates | Eco Glamping Chinauta',
      description: 'Verify live availability and guaranteed best direct booking rates for your stay at Eco Glamping Chinauta.',
      keywords: 'glamping chinauta rates, dome availability, book glamping colombia, direct booking glamping',
      ogTitle: 'Live Dome Availability & Rates | Eco Glamping Chinauta',
      ogDescription: 'Select your arrival and departure dates to lock in your luxury dome at guaranteed direct rates.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'website',
      canonicalPath: '/'
    },
    menu: {
      title: 'Artisan Dining & Restaurant Menu | Eco Glamping Chinauta',
      description: 'Enjoy delicious artisan meals: gratin rainbow trout, aged beef tenderloin, BBQ ribs, roasted chicken breast, and craft beverages.',
      keywords: 'glamping restaurant chinauta, romantic dinners colombia, rustic dining menu, artisan rainbow trout',
      ogTitle: 'Artisan Culinary Menu | Eco Glamping Chinauta',
      ogDescription: 'Fresh country lunches, romantic dinners for couples, cheese boards, and natural fruit beverages.',
      ogImage: '/assets/images/og-chinauta.jpg',
      ogType: 'website',
      canonicalPath: '/'
    },
    map: {
      title: 'Interactive Map & Scenic Grounds | Eco Glamping Chinauta',
      description: 'Find our glamping retreat in Chinauta, Fusagasugá. Discover nearby nature landmarks, hiking trails, and driving directions from Bogotá.',
      keywords: 'how to get to chinauta, glamping chinauta map, fusagasuga tourism, driving directions chinauta',
      ogTitle: 'Interactive Map & Grounds | Eco Glamping Chinauta',
      ogDescription: 'Safe, fully paved access road straight to our entrance at Km 4.5 along the main Chinauta road.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'place',
      canonicalPath: '/'
    },
    contact: {
      title: 'Contact & Location | Eco Glamping Chinauta',
      description: 'Reach our concierge team via WhatsApp, phone, or email. We will guide you with reservations and special romantic surprises.',
      keywords: 'contact eco glamping chinauta, whatsapp booking glamping, chinauta customer service',
      ogTitle: 'Direct Concierge & Contact | Eco Glamping Chinauta',
      ogDescription: 'We are available 24/7 to assist you with bookings, special celebrations, and custom trip requests.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'website',
      canonicalPath: '/'
    },
    faq: {
      title: 'Frequently Asked Questions (FAQ) | Eco Glamping Chinauta',
      description: 'Find answers about check-in/out schedules, pet friendly policy, included amenities, weather, and payment methods at Eco Glamping Chinauta.',
      keywords: 'glamping faq chinauta, check in time glamping, pet friendly glamping colombia, weather chinauta',
      ogTitle: 'Frequently Asked Questions | Eco Glamping Chinauta',
      ogDescription: 'Everything you need to know before visiting: schedules, pets, private jacuzzi, on-site food, and parking.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'website',
      canonicalPath: '/',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': [
          {
            '@type': 'Question',
            'name': 'What are the check-in and check-out hours?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'Check-in begins at 3:00 PM and check-out is at 11:00 AM. Bono Time passes are available to extend your stay.'
            }
          },
          {
            '@type': 'Question',
            'name': 'Is the glamping pet friendly?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'Yes, all well-behaved pets are welcome with a fee of $30,000 COP per pet for the entire stay.'
            }
          },
          {
            '@type': 'Question',
            'name': 'Does every dome have a private hot tub?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'Yes, each dome features an exclusive hydromassage jacuzzi on its private deck.'
            }
          }
        ]
      }
    },
    admin: {
      title: 'Admin Management Portal | Eco Glamping Chinauta',
      description: 'Internal operations dashboard for real-time bookings, occupancy, guest directory, financial audits, and dome maintenance.',
      keywords: 'admin portal eco glamping chinauta',
      ogTitle: 'Admin Portal | Eco Glamping Chinauta',
      ogDescription: 'Operations, reservations, and management system.',
      ogImage: DEFAULT_SHARE_IMAGE,
      ogType: 'website',
      canonicalPath: '/admin'
    }
  }
};

export function updateSEOTags(metadata: SEOMetadata, language: 'es' | 'en'): void {
  if (typeof document === 'undefined') return;

  document.title = metadata.title;

  const setMeta = (attrName: 'name' | 'property', attrValue: string, content: string) => {
    let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('name', 'description', metadata.description);
  setMeta('name', 'keywords', metadata.keywords);
  setMeta('name', 'author', 'Eco Glamping Chinauta');
  setMeta('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://www.ecoglamping.app';
  const canonicalUrl = `${currentOrigin}${metadata.canonicalPath || window.location.pathname}`;

  setMeta('property', 'og:title', metadata.ogTitle || metadata.title);
  setMeta('property', 'og:description', metadata.ogDescription || metadata.description);
  const abs = (u: string) => (u.startsWith('/') ? `${currentOrigin}${u}` : u);
  setMeta('property', 'og:image', abs(metadata.ogImage || DEFAULT_SHARE_IMAGE));
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:type', metadata.ogType || 'website');
  setMeta('property', 'og:site_name', 'Eco Glamping Chinauta');
  setMeta('property', 'og:locale', language === 'en' ? 'en_US' : 'es_CO');

  setMeta('name', 'twitter:card', metadata.twitterCard || 'summary_large_image');
  setMeta('name', 'twitter:title', metadata.twitterTitle || metadata.ogTitle || metadata.title);
  setMeta('name', 'twitter:description', metadata.twitterDescription || metadata.ogDescription || metadata.description);
  setMeta('name', 'twitter:image', abs(metadata.twitterImage || metadata.ogImage || DEFAULT_SHARE_IMAGE));

  let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonicalUrl);

  let scriptEl = document.getElementById('seo-structured-data') as HTMLScriptElement | null;
  if (metadata.structuredData) {
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = 'seo-structured-data';
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(withSiteUrl(metadata.structuredData, currentOrigin), null, 2);
  } else if (scriptEl) {
    const baseStructuredData = SEO_CONFIGS[language].home.structuredData;
    if (baseStructuredData) {
      scriptEl.textContent = JSON.stringify(withSiteUrl(baseStructuredData, currentOrigin), null, 2);
    }
  }
}

/** Usa la dirección real del sitio (la que el visitante está viendo) en los datos estructurados y agrega la foto principal. */
function withSiteUrl(data: Record<string, any>, origin: string): Record<string, any> {
  return { ...data, url: data.url === '/' || !data.url ? `${origin}/` : data.url, image: data.image || `${origin}/assets/images/og-chinauta.jpg` };
}

export function useDynamicSEO(
  context: SEOPageContext | string,
  overrides?: Partial<SEOMetadata>
): void {
  const { language } = useLanguage();

  useEffect(() => {
    const langKey = language === 'en' ? 'en' : 'es';
    const configBucket = SEO_CONFIGS[langKey];
    const resolvedContext = (context in configBucket ? context : 'home') as SEOPageContext;
    const baseConfig = configBucket[resolvedContext];

    const finalConfig: SEOMetadata = {
      ...baseConfig,
      ...overrides
    };

    updateSEOTags(finalConfig, langKey);
  }, [context, language, overrides]);
}

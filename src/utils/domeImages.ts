import regeneratedDome2Image from '../assets/images/regenerated_image_1790617455020.jpg';
import bochicaRomanticDecor from '../assets/images/bochica_romantic_decor_1790618007934.jpg';
import bochicaJacuzziDeck from '../assets/images/bochica_jacuzzi_deck_1790618019311.jpg';
import bochicaSunsetView from '../assets/images/bochica_sunset_view_1790617981274.jpg';
import huitacaDeckJacuzzi from '../assets/images/huitaca_deck_jacuzzi_1790621224807.jpg';
import huitacaCatamaranMesh from '../assets/images/huitaca_catamaran_mesh_1790621260604.jpg';
import huitacaEntranceSteps from '../assets/images/huitaca_entrance_steps_1790621247333.jpg';
import chinautaDeckAsoleadoras from '../assets/images/chinauta_deck_asoleadoras_1790624838157.jpg';
import chinautaRomanticDomeNight from '../assets/images/chinauta_romantic_dome_night_1790624852355.jpg';

import { Dome } from '../types';

export const DEFAULT_DOMES: Dome[] = [
  {
    id: 1,
    name: "Domo Huitaca",
    code: "DOMO-01",
    description: "Romántico domo geodésico con jacuzzi privado de hidromasaje al aire libre, baño privado, zona BBQ, cocina pequeña y vista privilegiada sobre las montañas de Chinauta.",
    capacity: 2,
    price_per_night: 350000,
    image_url: "/assets/images/dome_1_1791403584294.jpg",
    images: [
      "/assets/images/dome_1_1791403584294.jpg",
      "/assets/images/dome_1_1791403455449.jpg",
      "/assets/images/dome_1_1791403422738.jpg",
      "/assets/images/dome_1_1790625768325.jpg",
      huitacaDeckJacuzzi,
      huitacaCatamaranMesh,
      huitacaEntranceSteps
    ],
    status: "Disponible",
    features: "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona BBQ, Cocina pequeña, Desayuno campesino incluido",
    policies: "No se admiten mascotas. Check-in: 3:00 PM. Check-out: 12:00 PM."
  },
  {
    id: 2,
    name: "Domo Bochica",
    code: "DOMO-02",
    description: "Domo espacioso equipado con 1 cama King size y 1 cama pequeña (único domo con 2 camas), jacuzzi privado de hidromasaje, zona barbacoa (BBQ), cocina pequeña y vista premium.",
    capacity: 3,
    price_per_night: 400000,
    image_url: "/assets/images/dome_2_1791404907620.jpg",
    images: [
      "/assets/images/dome_2_1791404907620.jpg",
      "/assets/images/dome_2_1791404871963.jpg",
      "/assets/images/dome_2_1791404839607.jpg",
      "/assets/images/dome_2_1791404802997.jpg",
      bochicaRomanticDecor,
      bochicaJacuzziDeck,
      bochicaSunsetView
    ],
    status: "Disponible",
    features: "1 Cama King + 1 Cama Pequeña, Jacuzzi privado de hidromasaje, Zona BBQ, Cocina pequeña, Vista premium, Desayuno campesino incluido, Baño privado",
    policies: "Ambiente familiar y de descanso. Check-in: 3:00 PM."
  },
  {
    id: 3,
    name: "Domo Bachué",
    code: "DOMO-03",
    description: "Acogedor domo inmerso en la naturaleza con jacuzzi privado de hidromasaje, zona barbacoa (BBQ), cocina pequeña, 1 cama King, baño privado y vista al bosque nativo.",
    capacity: 2,
    price_per_night: 400000,
    image_url: chinautaRomanticDomeNight,
    images: [
      chinautaRomanticDomeNight,
      chinautaDeckAsoleadoras,
      huitacaDeckJacuzzi,
      bochicaJacuzziDeck
    ],
    status: "Disponible",
    features: "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona BBQ, Cocina pequeña, Desayuno campesino incluido, Vista al bosque",
    policies: "Ideal para parejas en desconexión total. Check-in: 3:00 PM."
  },
  {
    id: 4,
    name: "Domo Luna Chía",
    code: "DOMO-04",
    description: "Luminoso domo con jacuzzi privado de hidromasaje, zona BBQ, cocina pequeña, 1 cama King, baño privado y vista panorámica al valle de Chinauta.",
    capacity: 2,
    price_per_night: 420000,
    image_url: "/assets/images/dome_4_1791404275513.jpg",
    images: [
      "/assets/images/dome_4_1791404275513.jpg",
      "/assets/images/dome_4_1791404266017.jpg",
      "/assets/images/dome_4_1791404251064.jpg",
      "/assets/images/dome_4_1791404236234.jpg",
      "/assets/images/dome_4_1791404217055.jpg",
      chinautaRomanticDomeNight
    ],
    status: "Disponible",
    features: "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona BBQ, Cocina pequeña, Desayuno campesino incluido, Vista panorámica",
    policies: "Ambiente romántico y de descanso. Check-in: 3:00 PM."
  },
  {
    id: 5,
    name: "Domo Chiminichagua",
    code: "DOMO-05",
    description: "Domo de descanso con jacuzzi privado de hidromasaje, balcón privado, zona BBQ, cocina pequeña, 1 cama King, baño privado y la mejor vista del glamping.",
    capacity: 2,
    price_per_night: 450000,
    image_url: "/assets/images/dome_5_1791404612181.jpg",
    images: [
      "/assets/images/dome_5_1791404612181.jpg",
      "/assets/images/dome_5_1791404605043.jpg",
      "/assets/images/dome_5_1791404596425.jpg",
      chinautaRomanticDomeNight,
      huitacaCatamaranMesh,
      bochicaRomanticDecor
    ],
    status: "Disponible",
    features: "Jacuzzi privado de hidromasaje, Balcón privado, Baño privado, 1 Cama King, Zona BBQ, Cocina pequeña, Mejor vista del glamping, Desayuno campesino incluido",
    policies: "Prohibido fiestas o música a alto volumen. Check-in: 3:00 PM."
  },
  {
    id: 6,
    name: "Domo Xue Sol",
    code: "DOMO-06",
    description: "Domo con jacuzzi privado de hidromasaje al aire libre, vista panorámica a la montaña, hamaca, zona BBQ, cocina pequeña, 1 cama King, baño privado y desayuno campesino incluido.",
    capacity: 2,
    price_per_night: 450000,
    image_url: bochicaJacuzziDeck,
    images: [
      bochicaJacuzziDeck,
      chinautaRomanticDomeNight,
      chinautaDeckAsoleadoras,
      huitacaDeckJacuzzi
    ],
    status: "Disponible",
    features: "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona BBQ, Cocina pequeña, Vista premium, Hamaca (único domo con hamaca), Desayuno campesino incluido",
    policies: "Experiencia exclusiva de descanso y naturaleza. Check-in: 3:00 PM."
  }
];

export const DEFAULT_DOME_GALLERIES: Record<number, string[]> = {
  1: [
    "/assets/images/dome_1_1791403584294.jpg",
    "/assets/images/dome_1_1791403455449.jpg",
    "/assets/images/dome_1_1791403422738.jpg",
    "/assets/images/dome_1_1790625768325.jpg",
    huitacaDeckJacuzzi,
    huitacaCatamaranMesh,
    huitacaEntranceSteps
  ],
  2: [
    "/assets/images/dome_2_1791404907620.jpg",
    "/assets/images/dome_2_1791404871963.jpg",
    "/assets/images/dome_2_1791404839607.jpg",
    "/assets/images/dome_2_1791404802997.jpg",
    bochicaRomanticDecor,
    bochicaJacuzziDeck,
    bochicaSunsetView
  ],
  3: [
    chinautaRomanticDomeNight,
    chinautaDeckAsoleadoras,
    huitacaDeckJacuzzi,
    bochicaJacuzziDeck
  ],
  4: [
    "/assets/images/dome_4_1791404275513.jpg",
    "/assets/images/dome_4_1791404266017.jpg",
    "/assets/images/dome_4_1791404251064.jpg",
    "/assets/images/dome_4_1791404236234.jpg",
    "/assets/images/dome_4_1791404217055.jpg",
    chinautaRomanticDomeNight
  ],
  5: [
    "/assets/images/dome_5_1791404612181.jpg",
    "/assets/images/dome_5_1791404605043.jpg",
    "/assets/images/dome_5_1791404596425.jpg",
    chinautaRomanticDomeNight,
    huitacaCatamaranMesh,
    bochicaRomanticDecor
  ],
  6: [
    bochicaJacuzziDeck,
    chinautaRomanticDomeNight,
    chinautaDeckAsoleadoras,
    huitacaDeckJacuzzi
  ]
};

export function getDomeImages(dome: { id?: number; image_url?: string; images?: string[] }): string[] {
  const id = Number(dome.id);
  const defaults = DEFAULT_DOME_GALLERIES[id] || [
    chinautaRomanticDomeNight,
    chinautaDeckAsoleadoras
  ];

  if (Array.isArray(dome.images) && dome.images.length > 0) {
    // Filter out generic unsplash fallback if local images exist
    const nonUnsplash = dome.images.filter(img => !img.includes('unsplash.com'));
    if (nonUnsplash.length > 0) {
      return nonUnsplash;
    }
    return dome.images;
  }

  if (dome.image_url && !dome.image_url.includes('unsplash.com') && !defaults.includes(dome.image_url)) {
    return [dome.image_url, ...defaults];
  }

  return defaults;
}

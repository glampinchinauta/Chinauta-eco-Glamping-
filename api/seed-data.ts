// Datos iniciales de Eco Glamping Chinauta: domos, menú, galería y ajustes.
// Se cargan en Firestore solo la primera vez, cuando las colecciones están vacías.
// Generado a partir de la base de datos anterior (con los precios y el menú ya actualizados).

export const SEED = {
  "domes": [
    {
      "id": 1,
      "name": "Domo Huitaca",
      "code": "DOMO-01",
      "description": "Romántico domo geodésico con jacuzzi privado de hidromasaje al aire libre, malla de descanso tipo catamarán, baño privado y vista privilegiada sobre las montañas de Chinauta.",
      "capacity": 2,
      "price_per_night": 350000,
      "image_url": "/assets/images/dome_1_1791403584294.jpg",
      "status": "Disponible",
      "features": "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Desayuno campesino incluido, Zona de fogata, Malla de descanso, Nevera tipo bar con bebidas, Canastas de snacks (costo adicional), Zona BBQ a gas, Parqueadero gratis",
      "policies": "No se admiten mascotas. Check-in: 3:00 PM. Check-out: 12:00 PM.",
      "images": "[\"/assets/images/dome_1_1791403584294.jpg\",\"/assets/images/dome_1_1791403455449.jpg\",\"/assets/images/dome_1_1791403422738.jpg\",\"/assets/images/dome_1_1790625768325.jpg\",\"/assets/images/huitaca_deck_jacuzzi_1790621224807.jpg\",\"/assets/images/huitaca_catamaran_mesh_1790621260604.jpg\",\"/assets/images/huitaca_entrance_steps_1790621247333.jpg\"]",
      "video_url": "/assets/videos/domo_1_user_video.mp4"
    },
    {
      "id": 2,
      "name": "Domo Bochica",
      "code": "DOMO-02",
      "description": "Domo espacioso equipado con 1 cama King size y 1 cama pequeña (único domo con 2 camas), jacuzzi privado de hidromasaje, zona barbacoa (BBQ), malla flotante y zona de fogata.",
      "capacity": 3,
      "price_per_night": 400000,
      "image_url": "/assets/images/dome_2_1791404907620.jpg",
      "status": "Disponible",
      "features": "1 Cama King + 1 Cama Pequeña, Jacuzzi privado de hidromasaje, Zona Barbacoa (BBQ), Malla flotante, Zona de fogata, Desayuno campesino incluido, Baño privado, Nevera tipo bar con bebidas, Canastas de snacks (costo adicional), Zona BBQ a gas, Parqueadero gratis",
      "policies": "Ambiente familiar. Prohibido fumar dentro del domo. Check-in: 3:00 PM.",
      "images": "[\"/assets/images/dome_2_1791404907620.jpg\",\"/assets/images/dome_2_1791404871963.jpg\",\"/assets/images/dome_2_1791404839607.jpg\",\"/assets/images/dome_2_1791404802997.jpg\",\"/assets/images/bochica_romantic_decor_1790618007934.jpg\",\"/assets/images/bochica_jacuzzi_deck_1790618019311.jpg\",\"/assets/images/bochica_sunset_view_1790617981274.jpg\"]",
      "video_url": null
    },
    {
      "id": 3,
      "name": "Domo Bachué",
      "code": "DOMO-03",
      "description": "Acogedor domo inmerso en la naturaleza con jacuzzi privado de hidromasaje, zona barbacoa (BBQ), 1 cama King, baño privado, zona de fogata y vista al bosque nativo.",
      "capacity": 2,
      "price_per_night": 400000,
      "image_url": "/assets/images/chinauta_romantic_dome_night.jpg",
      "status": "Disponible",
      "features": "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona Barbacoa (BBQ), Zona de fogata, Desayuno campesino incluido, Vista al bosque, Nevera tipo bar con bebidas, Canastas de snacks (costo adicional), Zona BBQ a gas, Parqueadero gratis",
      "policies": "Ideal para parejas en desconexión total. Check-in: 3:00 PM.",
      "images": "[\"/assets/images/chinauta_romantic_dome_night.jpg\",\"/assets/images/chinauta_deck_asoleadoras.jpg\",\"/assets/images/huitaca_deck_jacuzzi_1790621224807.jpg\",\"/assets/images/bochica_jacuzzi_deck_1790618019311.jpg\"]",
      "video_url": "/assets/videos/domo_3_user_video.mp4"
    },
    {
      "id": 4,
      "name": "Domo Luna Chía",
      "code": "DOMO-04",
      "description": "Luminoso domo con jacuzzi privado de hidromasaje, zona de fogata privada, 1 cama King, baño privado y vista panorámica al valle de Chinauta.",
      "capacity": 2,
      "price_per_night": 420000,
      "image_url": "/assets/images/dome_4_1791404275513.jpg",
      "status": "Disponible",
      "features": "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona de fogata privada, Desayuno campesino incluido, Vista panorámica, Nevera tipo bar con bebidas, Canastas de snacks (costo adicional), Zona BBQ a gas, Parqueadero gratis",
      "policies": "Pet-friendly (bajo solicitud). Check-in: 3:00 PM.",
      "images": "[\"/assets/images/dome_4_1791404275513.jpg\",\"/assets/images/dome_4_1791404266017.jpg\",\"/assets/images/dome_4_1791404251064.jpg\",\"/assets/images/dome_4_1791404236234.jpg\",\"/assets/images/dome_4_1791404217055.jpg\",\"/assets/images/chinauta_romantic_dome_night.jpg\"]",
      "video_url": null
    },
    {
      "id": 5,
      "name": "Domo Chiminichagua",
      "code": "DOMO-05",
      "description": "Domo de descanso con jacuzzi privado de hidromasaje, balcón privado, 1 cama King, baño privado, zona de fogata y desayuno campesino.",
      "capacity": 2,
      "price_per_night": 450000,
      "image_url": "/assets/images/dome_5_1791404612181.jpg",
      "status": "Disponible",
      "features": "Jacuzzi privado de hidromasaje, Balcón privado, Baño privado, 1 Cama King, Zona de fogata, Desayuno campesino incluido, Nevera tipo bar con bebidas, Canastas de snacks (costo adicional), Zona BBQ a gas, Parqueadero gratis",
      "policies": "Prohibido fiestas o música a alto volumen. Check-in: 3:00 PM.",
      "images": "[\"/assets/images/dome_5_1791404612181.jpg\",\"/assets/images/dome_5_1791404605043.jpg\",\"/assets/images/dome_5_1791404596425.jpg\",\"/assets/images/chinauta_romantic_dome_night.jpg\",\"/assets/images/huitaca_catamaran_mesh_1790621260604.jpg\",\"/assets/images/bochica_romantic_decor_1790618007934.jpg\"]",
      "video_url": "/assets/videos/domo_5_user_video.mp4"
    },
    {
      "id": 6,
      "name": "Domo Xue Sol",
      "code": "DOMO-06",
      "description": "Domo con jacuzzi privado de hidromasaje al aire libre, vista panorámica a la montaña, 1 cama King, baño privado, zona de fogata y desayuno campesino incluido.",
      "capacity": 2,
      "price_per_night": 450000,
      "image_url": "/assets/images/bochica_jacuzzi_deck_1790618019311.jpg",
      "status": "Disponible",
      "features": "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona de fogata privada, Malla de descanso, Desayuno campesino incluido, Nevera tipo bar con bebidas, Canastas de snacks (costo adicional), Zona BBQ a gas, Parqueadero gratis",
      "policies": "Experiencia exclusiva para adultos y familias. Check-in: 3:00 PM.",
      "images": "[\"/assets/images/bochica_jacuzzi_deck_1790618019311.jpg\",\"/assets/images/chinauta_romantic_dome_night.jpg\",\"/assets/images/chinauta_deck_asoleadoras.jpg\",\"/assets/images/huitaca_deck_jacuzzi_1790621224807.jpg\"]",
      "video_url": null
    }
  ],
  "menu_items": [
    {
      "id": 1,
      "item_number": 1,
      "title": "Trucha Gratinada o en Salsa de Champiñones",
      "title_en": "Gratin / Mushroom Sauce Rainbow Trout",
      "category": "Almuerzos y Comidas",
      "description": "Trucha fresca marinada en hierbas nativas y preparada a tu preferencia (gratinada al horno, en cremosa salsa de champiñones o asada a la parrilla).",
      "description_en": "Fresh Andean trout seasoned with local herbs, cooked to your preference (baked au gratin, creamy mushroom sauce, or charbroiled).",
      "preparations": "[\"Gratinada\",\"En salsa de champiñones\",\"Asada a la parrilla\"]",
      "sides": "[\"Papas fritas\",\"Ensalada\"]",
      "beverage": "Jugo natural",
      "price": 60000,
      "image": "/assets/images/trucha-gratinada.webp",
      "images": "[\"/assets/images/trucha-gratinada.webp\",\"/assets/images/trucha-salsa-champinones.webp\"]",
      "video_url": null,
      "badge": "Plato Especialidad"
    },
    {
      "id": 2,
      "item_number": 2,
      "title": "Carnes Gratinadas, en Salsa de Champiñones o a la Parrilla (Res, Cerdo o Pechuga)",
      "title_en": "Au Gratin, Mushroom Sauce or Grilled Meats (Beef, Pork or Chicken Breast)",
      "category": "Almuerzos y Comidas",
      "description": "Carne de res, cerdo o pechuga, sazonada al estilo campestre y preparada a tu preferencia: gratinada con queso, en salsa de champiñones o asada a la parrilla. Incluye papas fritas, ensalada y jugo natural.",
      "description_en": "Beef, pork or chicken breast, seasoned in rustic style and prepared to your liking: au gratin with cheese, in mushroom sauce or grilled. Includes french fries, salad and natural juice.",
      "preparations": "[\"Carne de res\",\"Cerdo\",\"Pechuga\",\"Gratinada con queso\",\"En salsa de champiñones\",\"Asada a la parrilla\"]",
      "sides": "[\"Papas fritas\",\"Ensalada\"]",
      "beverage": "Jugo natural",
      "price": 50000,
      "image": "/assets/images/carne-res-gratinada.webp",
      "images": "[\"/assets/images/carne-res-gratinada.webp\",\"/assets/images/carne-cerdo-gratinada.webp\",\"/assets/images/carne-pechuga-gratinada.webp\",\"/assets/images/carne-cerdo-champinones.webp\",\"/assets/images/carne-pechuga-champinones.webp\"]",
      "video_url": null,
      "badge": "Favorito del Huésped"
    },
    {
      "id": 3,
      "item_number": 3,
      "title": "Combo Hamburguesa Artesanal",
      "title_en": "Artisan Burger Meal Combo",
      "category": "Snacks",
      "description": "Hamburguesa gourmet artesanal con carne selecta 100% de res, queso fundido, vegetales frescos y pan artesanal dorado.",
      "description_en": "Gourmet artisan 100% beef burger with melted artisan cheese, bacon, and crisp vegetables on a brioche bun.",
      "preparations": "[\"Término Medio\",\"Bien Asada\",\"Con Queso Extra\"]",
      "sides": "[\"Papas fritas\"]",
      "beverage": "Gaseosa",
      "price": 40000,
      "image": "/assets/images/hamburguesa-papas.webp",
      "images": "[\"/assets/images/hamburguesa-papas.webp\"]",
      "video_url": null,
      "badge": "Combo Rápido"
    }
  ],
  "gallery_items": [
    {
      "id": 30,
      "title": "Domo 1 Huitaca — Video Tour y Jacuzzi Privado",
      "category": "Videos",
      "media_type": "video",
      "media_url": "/assets/videos/domo_1_user_video.mp4",
      "description": "Recorrido completo en video de alta calidad por las instalaciones, jacuzzi del Domo Huitaca."
    },
    {
      "id": 31,
      "title": "Domo 3 Bachué — Experiencia de Descanso y Naturaleza",
      "category": "Videos",
      "media_type": "video",
      "media_url": "/assets/videos/domo_3_user_video.mp4",
      "description": "Video experiencia real en el Domo Bachué rodeado de vegetación y clima cálido en Chinauta."
    },
    {
      "id": 32,
      "title": "Domo 5 Chiminichagua — Vista Panorámica y Balcón",
      "category": "Videos",
      "media_type": "video",
      "media_url": "/assets/videos/domo_5_user_video.mp4",
      "description": "Video tour por el balcón del Domo Chiminichagua."
    },
    {
      "id": 33,
      "title": "Domo 1 Huitaca — Habitación y Jacuzzi Fotos Reales",
      "category": "Domos",
      "media_type": "image",
      "media_url": "/assets/images/dome_1_1791403584294.jpg",
      "description": "Fotografía real del Domo Huitaca con jacuzzi privado de hidromasaje y cama King."
    },
    {
      "id": 34,
      "title": "Domo 2 Bochica — Suite con Doble Cama",
      "category": "Domos",
      "media_type": "image",
      "media_url": "/assets/images/dome_2_1791404907620.jpg",
      "description": "Fotografía real del Domo Bochica equipado con 1 cama King y 1 cama adicional."
    },
    {
      "id": 35,
      "title": "Domo 4 Luna Chía — Vista Espectacular al Valle",
      "category": "Domos",
      "media_type": "image",
      "media_url": "/assets/images/dome_4_1791404275513.jpg",
      "description": "Fotografía real del Domo Luna Chía con amplia panorámica de las montañas de Chinauta."
    },
    {
      "id": 36,
      "title": "Domo 5 Chiminichagua — Suite y Balcón Campestre",
      "category": "Domos",
      "media_type": "image",
      "media_url": "/assets/images/dome_5_1791404612181.jpg",
      "description": "Fotografía real del Domo Chiminichagua con balcón privado y jacuzzi de hidromasaje."
    },
    {
      "id": 37,
      "title": "Deck Solárium con Asoleadoras & Sombrilla",
      "category": "Jacuzzis & Vistas",
      "media_type": "image",
      "media_url": "/assets/images/chinauta_deck_asoleadoras.jpg",
      "description": "Deck privado en madera con asoleadoras, sombrilla verde y jacuzzi de hidromasaje."
    },
    {
      "id": 38,
      "title": "Noche Mágica Bajo las Estrellas — Pareja en Domo",
      "category": "Domos",
      "media_type": "image",
      "media_url": "/assets/images/chinauta_romantic_dome_night.jpg",
      "description": "Cena romántica para parejas en bata blanca con vino tinto y vista estelar."
    },
    {
      "id": 39,
      "title": "Domo Bochica — Decoración Romántica Interior",
      "category": "Domos",
      "media_type": "image",
      "media_url": "/assets/images/bochica_romantic_decor_1790618007934.jpg",
      "description": "Cama decorada para ocasiones especiales con rosas, globos y ambiente cálido."
    },
    {
      "id": 40,
      "title": "Domo Bochica — Jacuzzi en Deck al Atardecer",
      "category": "Jacuzzis & Vistas",
      "media_type": "image",
      "media_url": "/assets/images/bochica_jacuzzi_deck_1790618019311.jpg",
      "description": "Jacuzzi privado exterior en plataforma de madera rodeado de naturaleza."
    },
    {
      "id": 41,
      "title": "Domo Bochica — Vista Panorámica al Ocaso",
      "category": "Domos",
      "media_type": "image",
      "media_url": "/assets/images/bochica_sunset_view_1790617981274.jpg",
      "description": "Vista privilegiada del atardecer a través de los ventanales geodésicos."
    }
  ],
  "settings": {
    "glamping_name": "Eco Glamping Chinauta",
    "whatsapp": "+57 321 310 9331",
    "email": "ecoglampingventas@gmail.com",
    "address": "Vía Principal Chinauta Km 4.5, Fusagasugá, Cundinamarca",
    "currency": "COP",
    "timezone": "America/Bogota"
  }
} as const;

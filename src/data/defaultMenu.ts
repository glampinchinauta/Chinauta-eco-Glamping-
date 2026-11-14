/**
 * Menú aprobado de Eco Glamping Chinauta (fuente única).
 * Lo usa el sitio cuando no hay menú guardado y lo carga el servidor la primera vez en Firestore
 * (api/seed-data.ts debe coincidir; lo verifica la prueba "el menú inicial del servidor coincide con el menú aprobado").
 */
export interface FoodMenuItem {
  id: number;
  item_number: number;
  title: string;
  title_en: string;
  category: 'Almuerzos y Comidas' | 'Almuerzos y Cenas' | 'Bebidas' | 'Snacks' | 'Snacks & Picadas';
  category_en: string;
  description: string;
  description_en: string;
  preparations: string[];
  preparations_en: string[];
  sides: string[];
  sides_en: string[];
  beverage: string;
  beverage_en: string;
  price: number;
  image: string;
  images: string[];
  video_url?: string | null;
  badge?: string;
  badge_en?: string;
}

export const DEFAULT_MENU_ITEMS: FoodMenuItem[] = [
  {
    id: 1,
    item_number: 1,
    title: "Trucha Gratinada o en Salsa de Champiñones",
    title_en: "Gratin / Mushroom Sauce Rainbow Trout",
    category: "Almuerzos y Cenas",
    category_en: "Lunch & Dinner",
    description: "Trucha fresca marinada en hierbas nativas y preparada a tu preferencia (gratinada al horno, en cremosa salsa de champiñones o asada a la parrilla).",
    description_en: "Fresh Andean trout seasoned with local herbs, cooked to your preference (baked au gratin, creamy mushroom sauce, or charbroiled).",
    preparations: ["Gratinada", "En salsa de champiñones", "Asada a la parrilla"],
    preparations_en: ["Au Gratin", "Mushroom Sauce", "Grilled"],
    sides: ["Papas fritas", "Ensalada"],
    sides_en: ["French fries", "Salad"],
    beverage: "Jugo natural",
    beverage_en: "Natural juice",
    price: 60000,
    image: "/assets/images/trucha-gratinada.webp",
    images: [
      "/assets/images/trucha-gratinada.webp",
      "/assets/images/trucha-salsa-champinones.webp"
    ],
    badge: "Plato Especialidad",
    badge_en: "House Specialty"
  },
  {
    id: 2,
    item_number: 2,
    title: "Carnes Gratinadas, en Salsa de Champiñones o a la Parrilla (Res, Cerdo o Pechuga)",
    title_en: "Au Gratin, Mushroom Sauce or Grilled Meats (Beef, Pork or Chicken Breast)",
    category: "Almuerzos y Cenas",
    category_en: "Lunch & Dinner",
    description: "Carne de res, cerdo o pechuga, sazonada al estilo campestre y preparada a tu preferencia: gratinada con queso, en salsa de champiñones o asada a la parrilla. Incluye papas fritas, ensalada y jugo natural.",
    description_en: "Beef, pork or chicken breast, seasoned in rustic style and prepared to your liking: au gratin with cheese, in mushroom sauce or grilled. Includes french fries, salad and natural juice.",
    preparations: ["Carne de res", "Cerdo", "Pechuga", "Gratinada con queso", "En salsa de champiñones", "Asada a la parrilla"],
    preparations_en: ["Beef", "Pork", "Chicken Breast", "Au Gratin Cheese", "Mushroom Sauce", "Grilled"],
    sides: ["Papas fritas", "Ensalada"],
    sides_en: ["French fries", "Salad"],
    beverage: "Jugo natural",
    beverage_en: "Natural juice",
    price: 50000,
    image: "/assets/images/carne-res-gratinada.webp",
    images: [
      "/assets/images/carne-res-gratinada.webp",
      "/assets/images/carne-cerdo-gratinada.webp",
      "/assets/images/carne-pechuga-gratinada.webp",
      "/assets/images/carne-cerdo-champinones.webp",
      "/assets/images/carne-pechuga-champinones.webp"
    ],
    badge: "Favorito del Huésped",
    badge_en: "Guest Favorite"
  },
  {
    id: 5,
    item_number: 5,
    title: "Combo Hamburguesa Artesanal",
    title_en: "Artisan Burger Meal Combo",
    category: "Snacks & Picadas",
    category_en: "Snacks & Platters",
    description: "Hamburguesa gourmet artesanal con carne selecta 100% de res, queso fundido, vegetales frescos y pan artesanal dorado.",
    description_en: "Gourmet artisan 100% beef burger with melted artisan cheese, bacon, and crisp vegetables on a brioche bun.",
    preparations: ["Término Medio", "Bien Asada", "Con Queso Extra"],
    preparations_en: ["Medium Rare", "Well Done", "Extra Cheese"],
    sides: ["Papas fritas"],
    sides_en: ["French fries"],
    beverage: "Gaseosa",
    beverage_en: "Soda",
    price: 40000,
    image: "/assets/images/hamburguesa-papas.webp",
    images: [
      "/assets/images/hamburguesa-papas.webp"
    ],
    badge: "Combo Rápido",
    badge_en: "Quick Combo"
  },
];

export const CHINAUTA_MENU_ITEMS = DEFAULT_MENU_ITEMS;

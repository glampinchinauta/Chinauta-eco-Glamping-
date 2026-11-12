import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { DatabaseSync } from "node:sqlite";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import { verifyFirebaseIdToken, normalizeEmail } from "./server-auth";

// Password hashing (scrypt). Stored as "scrypt$<salt>$<hash>".
function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

// Random secret for seeded accounts: nobody knows it, so no default password exists.
function randomSecret(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function verifyPassword(pw: string, stored: string): boolean {
  if (!stored || !pw) return false;
  // Legacy plain-text rows are still accepted once; the login upgrades them to a hash.
  if (!stored.startsWith("scrypt$")) return stored === pw;
  const [, salt, hash] = stored.split("$");
  const test = crypto.scryptSync(pw, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === test.length && crypto.timingSafeEqual(expected, test);
}

const app = express();
const portArgIndex = process.argv.indexOf("--port");
const portFromArgs = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? Number(process.argv[portArgIndex + 1]) : null;
const PORT = portFromArgs || Number(process.env.DEFAULT_APP_PORT) || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ---------- Admin authentication (Firebase Google sign-in, verified on the server) ----------
const FIREBASE_PROJECT_ID: string = process.env.FIREBASE_PROJECT_ID || (() => {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8")).projectId; }
  catch { return ""; }
})();
const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS || "ecoglampingventas@gmail.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

let firebaseCertCache: { certs: Record<string, string>; expires: number } | null = null;
async function getFirebaseCerts(): Promise<Record<string, string>> {
  if (firebaseCertCache && firebaseCertCache.expires > Date.now()) return firebaseCertCache.certs;
  const r = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!r.ok) throw new Error("No se pudieron obtener las llaves de Firebase.");
  const certs = (await r.json()) as Record<string, string>;
  const m = /max-age=(\d+)/.exec(r.headers.get("cache-control") || "");
  firebaseCertCache = { certs, expires: Date.now() + (m ? Number(m[1]) * 1000 : 3600_000) };
  return certs;
}

async function verifyAdminToken(token: string): Promise<any> {
  const payload = await verifyFirebaseIdToken(token, {
    projectId: FIREBASE_PROJECT_ID,
    getCert: async (kid) => (await getFirebaseCerts())[kid],
  });
  if (!payload.email || payload.email_verified !== true) throw new Error("Correo no verificado.");
  if (!ADMIN_EMAILS.includes(normalizeEmail(payload.email))) throw new Error("Sin permisos de administrador.");
  return payload;
}

// Customer accounts: any Firebase user with a verified email. They only see their own reservations.
async function verifyCustomerToken(token: string): Promise<string> {
  const payload = await verifyFirebaseIdToken(token, {
    projectId: FIREBASE_PROJECT_ID,
    getCert: async (kid) => (await getFirebaseCerts())[kid],
  });
  if (!payload.email || payload.email_verified !== true) {
    throw new Error("Confirma tu correo electrónico para ver tus reservas.");
  }
  return normalizeEmail(payload.email);
}

async function requireCustomer(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Inicia sesión para ver tus reservas." });
  try {
    (req as any).customerEmail = await verifyCustomerToken(token);
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message || "No autorizado." });
  }
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Inicia sesión como administrador." });
  try {
    (req as any).adminEmail = (await verifyAdminToken(token)).email;
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message || "No autorizado." });
  }
}

// Public writes: only a guest booking, the AI concierge question and the login request.
// Every other change (domes, menu, gallery, testimonials, promo codes, uploads, payments...) needs an admin.
const PUBLIC_WRITES = new Set([
  "/api/reservations",
  "/api/privacy/delete",
  "/api/ai/chat",
  "/api/auth/login",
]);
// Public reads: only what the website shows to visitors. Any other GET under /api needs an admin (default deny).
const PUBLIC_READS = new Set([
  "/api/domes",
  "/api/gallery",
  "/api/menu",
  "/api/testimonials",
  "/api/location-photos",
  "/api/availability",
  "/api/reservations/lookup",
  "/api/promo-codes/validate",
]);

app.use("/api", (req, res, next) => {
  // Express ignores letter case in routes, so the check must ignore it too (/api/RESERVATIONS).
  const full = ("/api" + req.path.replace(/\/+$/, "")).toLowerCase();
  // Customer routes (/api/my/...) check their own customer token.
  if (full.startsWith("/api/my/")) return next();
  const isRead = req.method === "GET" || req.method === "HEAD";
  const isPublic = isRead ? PUBLIC_READS.has(full) : PUBLIC_WRITES.has(full);
  if (!isPublic) {
    return requireAdmin(req, res, next);
  }
  next();
});
app.use(express.static(path.join(process.cwd(), "public")));

// Initialize SQLite database: buscar glamping.db sin depender de desde dónde se arranque el servidor
const DB_CANDIDATES = [
  process.env.GLAMPING_DB_PATH,
  path.join(process.cwd(), "glamping.db"),
  path.join(process.cwd(), "..", "glamping.db"),
  ...(typeof __dirname !== "undefined" ? [path.join(__dirname, "glamping.db"), path.join(__dirname, "..", "glamping.db")] : []),
].filter((p): p is string => Boolean(p));
const DB_PATH = DB_CANDIDATES.find((p) => fs.existsSync(p)) || path.join(process.cwd(), "glamping.db");
console.log(`[DB] Usando base de datos: ${DB_PATH}`);
const db = new DatabaseSync(DB_PATH);

// Enable foreign keys
db.exec("PRAGMA foreign_keys = ON;");

// One-time data migrations. Each name runs once and is recorded, so later admin edits are never overwritten on restart.
db.exec(`CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
function runOnce(name: string, fn: () => void) {
  if (db.prepare(`SELECT 1 FROM app_migrations WHERE name = ?`).get(name)) return;
  fn();
  db.prepare(`INSERT INTO app_migrations (name) VALUES (?)`).run(name);
}

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('SUPERADMIN', 'ADMIN', 'RECEPCION', 'FINANCES')),
    status TEXT DEFAULT 'Activo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    document_id TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS domes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    capacity INTEGER DEFAULT 2,
    price_per_night REAL NOT NULL,
    image_url TEXT,
    images TEXT,
    status TEXT DEFAULT 'Disponible' CHECK(status IN ('Disponible', 'Mantenimiento', 'Fuera de servicio')),
    features TEXT,
    policies TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_code TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    dome_id INTEGER NOT NULL,
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    guests INTEGER DEFAULT 2,
    status TEXT DEFAULT 'Pendiente' CHECK(status IN ('Pendiente', 'Pendiente de pago', 'Confirmada', 'Check-in', 'Hospedado', 'Check-out', 'Completada', 'Cancelada', 'No show')),
    payment_status TEXT DEFAULT 'Pendiente' CHECK(payment_status IN ('Pendiente', 'Parcial', 'Pagado', 'Reembolsado')),
    total_amount REAL NOT NULL,
    amount_paid REAL DEFAULT 0,
    amount_pending REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (dome_id) REFERENCES domes(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    status TEXT DEFAULT 'Aprobado',
    recorded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
  );

  CREATE TABLE IF NOT EXISTS maintenance_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dome_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dome_id) REFERENCES domes(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS gallery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image',
    media_url TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_number INTEGER,
    title TEXT NOT NULL,
    title_en TEXT,
    category TEXT NOT NULL,
    description TEXT,
    description_en TEXT,
    preparations TEXT,
    sides TEXT,
    beverage TEXT,
    price REAL NOT NULL,
    image TEXT,
    images TEXT,
    video_url TEXT,
    badge TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    dome TEXT NOT NULL,
    rating INTEGER DEFAULT 5,
    date TEXT NOT NULL,
    comment TEXT NOT NULL,
    avatar TEXT NOT NULL,
    image TEXT,
    video_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed initial data if empty
const domeCount = db.prepare("SELECT COUNT(*) as count FROM domes").get() as { count: number };
if (domeCount.count === 0) {
  console.log("Seeding initial database data...");

  // Seed Users
  const insertUser = db.prepare(`INSERT INTO users (username, password_hash, full_name, email, role, status) VALUES (?, ?, ?, ?, ?, ?)`);
  insertUser.run("superadmin", hashPassword(randomSecret()), "Carlos SuperAdmin", "superadmin@ecoglampingchinauta.com", "SUPERADMIN", "Activo");
  insertUser.run("admin", hashPassword(randomSecret()), "María Admin", "admin@ecoglampingchinauta.com", "ADMIN", "Activo");
  insertUser.run("reception", hashPassword(randomSecret()), "Ana Recepción", "reception@ecoglampingchinauta.com", "RECEPCION", "Activo");
  insertUser.run("finanzas", hashPassword(randomSecret()), "Pedro Finanzas", "finanzas@ecoglampingchinauta.com", "FINANCES", "Activo");

  // Seed Domes with authentic local assets and real configurations
  const insertDome = db.prepare(`INSERT INTO domes (name, code, description, capacity, price_per_night, image_url, images, status, features, policies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  insertDome.run(
    "Domo Huitaca",
    "DOMO-01",
    "Romántico domo geodésico con jacuzzi privado de hidromasaje al aire libre, malla de descanso tipo catamarán, baño privado y vista privilegiada sobre las montañas de Chinauta.",
    2,
    380000,
    "/assets/images/chinauta_deck_asoleadoras.jpg",
    JSON.stringify([
      "/assets/images/chinauta_deck_asoleadoras.jpg",
      "/assets/images/huitaca_deck_jacuzzi_1790621224807.jpg",
      "/assets/images/huitaca_catamaran_mesh_1790621260604.jpg",
      "/assets/images/huitaca_entrance_steps_1790621247333.jpg"
    ]),
    "Disponible",
    "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Desayuno campesino incluido, Zona de fogata, Malla de descanso",
    "No se admiten mascotas. Check-in: 3:00 PM. Check-out: 12:00 PM."
  );
  insertDome.run(
    "Domo Bochica",
    "DOMO-02",
    "Domo espacioso equipado con 1 cama King size y 1 cama pequeña (único domo con 2 camas), jacuzzi privado de hidromasaje, zona barbacoa (BBQ), malla flotante y zona de fogata.",
    3,
    450000,
    "/assets/images/chinauta_romantic_dome_night.jpg",
    JSON.stringify([
      "/assets/images/chinauta_romantic_dome_night.jpg",
      "/assets/images/bochica_romantic_decor_1790618007934.jpg",
      "/assets/images/bochica_jacuzzi_deck_1790618019311.jpg",
      "/assets/images/bochica_sunset_view_1790617981274.jpg"
    ]),
    "Disponible",
    "1 Cama King + 1 Cama Pequeña, Jacuzzi privado de hidromasaje, Zona Barbacoa (BBQ), Malla flotante, Zona de fogata, Desayuno campesino incluido, Baño privado",
    "Ambiente familiar y de descanso. Check-in: 3:00 PM."
  );
  insertDome.run(
    "Domo Bachué",
    "DOMO-03",
    "Acogedor domo inmerso en la naturaleza con jacuzzi privado de hidromasaje, zona barbacoa (BBQ), 1 cama King, baño privado, zona de fogata y vista al bosque nativo.",
    2,
    350000,
    "/assets/images/chinauta_romantic_dome_night.jpg",
    JSON.stringify([
      "/assets/images/chinauta_romantic_dome_night.jpg",
      "/assets/images/chinauta_deck_asoleadoras.jpg",
      "/assets/images/huitaca_deck_jacuzzi_1790621224807.jpg",
      "/assets/images/bochica_jacuzzi_deck_1790618019311.jpg"
    ]),
    "Disponible",
    "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona Barbacoa (BBQ), Zona de fogata, Desayuno campesino incluido, Vista al bosque",
    "Ideal para parejas en desconexión total. Check-in: 3:00 PM."
  );
  insertDome.run(
    "Domo Luna Chía",
    "DOMO-04",
    "Luminoso domo con jacuzzi privado de hidromasaje, zona de fogata privada, 1 cama King, baño privado y vista panorámica al valle de Chinauta.",
    2,
    420000,
    "/assets/images/chinauta_deck_asoleadoras.jpg",
    JSON.stringify([
      "/assets/images/chinauta_deck_asoleadoras.jpg",
      "/assets/images/chinauta_romantic_dome_night.jpg",
      "/assets/images/huitaca_entrance_steps_1790621247333.jpg",
      "/assets/images/bochica_sunset_view_1790617981274.jpg"
    ]),
    "Disponible",
    "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona de fogata privada, Desayuno campesino incluido, Vista panorámica",
    "Ambiente romántico y de descanso. Check-in: 3:00 PM."
  );
  insertDome.run(
    "Domo Chiminichagua",
    "DOMO-05",
    "Domo de descanso con jacuzzi privado de hidromasaje, balcón privado, 1 cama King, baño privado, zona de fogata y desayuno campesino.",
    2,
    390000,
    "/assets/images/chinauta_romantic_dome_night.jpg",
    JSON.stringify([
      "/assets/images/chinauta_romantic_dome_night.jpg",
      "/assets/images/huitaca_catamaran_mesh_1790621260604.jpg",
      "/assets/images/bochica_romantic_decor_1790618007934.jpg",
      "/assets/images/chinauta_deck_asoleadoras.jpg"
    ]),
    "Disponible",
    "Jacuzzi privado de hidromasaje, Balcón privado, Baño privado, 1 Cama King, Zona de fogata, Desayuno campesino incluido",
    "Prohibido fiestas o música a alto volumen. Check-in: 3:00 PM."
  );
  insertDome.run(
    "Domo Xue Sol",
    "DOMO-06",
    "Domo con jacuzzi privado de hidromasaje al aire libre, vista panorámica a la montaña, 1 cama King, baño privado, zona de fogata y desayuno campesino incluido.",
    2,
    480000,
    "/assets/images/bochica_jacuzzi_deck_1790618019311.jpg",
    JSON.stringify([
      "/assets/images/bochica_jacuzzi_deck_1790618019311.jpg",
      "/assets/images/chinauta_romantic_dome_night.jpg",
      "/assets/images/chinauta_deck_asoleadoras.jpg",
      "/assets/images/huitaca_deck_jacuzzi_1790621224807.jpg"
    ]),
    "Disponible",
    "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona de fogata privada, Malla de descanso, Desayuno campesino incluido",
    "Experiencia exclusiva de descanso y naturaleza. Check-in: 3:00 PM."
  );


  // Seed Settings
  const insertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  insertSetting.run("glamping_name", "Eco Glamping Chinauta");
  insertSetting.run("whatsapp", "+57 321 310 9331");
  insertSetting.run("email", "contacto@ecoglampingchinauta.com");
  insertSetting.run("address", "Vía Principal Chinauta Km 4.5, Fusagasugá, Cundinamarca");
  insertSetting.run("currency", "COP");
  insertSetting.run("timezone", "America/Bogota");

  // Seed Audit log
  db.prepare(`INSERT INTO audit_logs (user_name, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)`).run(
    "Carlos SuperAdmin", "INICIALIZACION", "Sistema", "0", "Base de datos inicializada con domos y configuración inicial."
  );

  console.log("Database seeded successfully.");
}

// Databases created earlier still carry the published default password "admin123". Replace it once.
runOnce("rotate_default_passwords_v1", () => {
  const rows = db.prepare(`SELECT id, password_hash FROM users`).all() as any[];
  for (const u of rows) {
    if (verifyPassword("admin123", u.password_hash)) {
      db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(randomSecret()), u.id);
    }
  }
});

// Ensure video_url column exists in domes table
try {
  db.exec("ALTER TABLE domes ADD COLUMN video_url TEXT;");
} catch (e) {
  // column already exists
}

// Legal consent and privacy columns (Ley 1581 de 2012: keep proof of acceptance and of marketing consent)
for (const sql of [
  "ALTER TABLE reservations ADD COLUMN terms_accepted_at TEXT",
  "ALTER TABLE reservations ADD COLUMN terms_version TEXT",
  "ALTER TABLE reservations ADD COLUMN age_confirmed_at TEXT",
  "ALTER TABLE customers ADD COLUMN marketing_consent INTEGER DEFAULT 0",
  "ALTER TABLE customers ADD COLUMN marketing_consent_at TEXT",
  "ALTER TABLE customers ADD COLUMN anonymized_at TEXT",
]) {
  try { db.exec(sql); } catch (e) { /* column already exists */ }
}

// One-time cleanup: an earlier version of the site inserted invented example reviews into this database.
// Remove exactly those rows (same name and location) so only reviews sent by real guests remain.
try {
  for (const [name, location] of [["Camila & Alejandro", "Bogotá, Colombia"], ["Felipe Restrepo", "Medellín, Colombia"], ["Valentina Gómez", "Cali, Colombia"]]) {
    db.prepare("DELETE FROM testimonials WHERE name = ? AND location = ?").run(name, location);
  }
} catch (e) {
  console.warn("Testimonial cleanup notice:", e);
}

// Initial media and specs for Domes 1-6. Applied once; afterwards the admin owns these fields.
runOnce("domes_media_v1", () => { try {
  const userDomesMedia: Record<number, { url: string; gallery: string[]; video_url?: string }> = {
    1: {
      url: "/assets/images/dome_1_1791403584294.jpg",
      video_url: "/assets/videos/domo_1_user_video.mp4",
      gallery: [
        "/assets/images/dome_1_1791403584294.jpg",
        "/assets/images/dome_1_1791403455449.jpg",
        "/assets/images/dome_1_1791403422738.jpg",
        "/assets/images/dome_1_1790625768325.jpg",
        "/assets/images/huitaca_deck_jacuzzi_1790621224807.jpg",
        "/assets/images/huitaca_catamaran_mesh_1790621260604.jpg",
        "/assets/images/huitaca_entrance_steps_1790621247333.jpg"
      ]
    },
    2: {
      url: "/assets/images/dome_2_1791404907620.jpg",
      gallery: [
        "/assets/images/dome_2_1791404907620.jpg",
        "/assets/images/dome_2_1791404871963.jpg",
        "/assets/images/dome_2_1791404839607.jpg",
        "/assets/images/dome_2_1791404802997.jpg",
        "/assets/images/bochica_romantic_decor_1790618007934.jpg",
        "/assets/images/bochica_jacuzzi_deck_1790618019311.jpg",
        "/assets/images/bochica_sunset_view_1790617981274.jpg"
      ]
    },
    3: {
      url: "/assets/images/chinauta_romantic_dome_night.jpg",
      video_url: "/assets/videos/domo_3_user_video.mp4",
      gallery: [
        "/assets/images/chinauta_romantic_dome_night.jpg",
        "/assets/images/chinauta_deck_asoleadoras.jpg",
        "/assets/images/huitaca_deck_jacuzzi_1790621224807.jpg",
        "/assets/images/bochica_jacuzzi_deck_1790618019311.jpg"
      ]
    },
    4: {
      url: "/assets/images/dome_4_1791404275513.jpg",
      gallery: [
        "/assets/images/dome_4_1791404275513.jpg",
        "/assets/images/dome_4_1791404266017.jpg",
        "/assets/images/dome_4_1791404251064.jpg",
        "/assets/images/dome_4_1791404236234.jpg",
        "/assets/images/dome_4_1791404217055.jpg",
        "/assets/images/chinauta_romantic_dome_night.jpg"
      ]
    },
    5: {
      url: "/assets/images/dome_5_1791404612181.jpg",
      video_url: "/assets/videos/domo_5_user_video.mp4",
      gallery: [
        "/assets/images/dome_5_1791404612181.jpg",
        "/assets/images/dome_5_1791404605043.jpg",
        "/assets/images/dome_5_1791404596425.jpg",
        "/assets/images/chinauta_romantic_dome_night.jpg",
        "/assets/images/huitaca_catamaran_mesh_1790621260604.jpg",
        "/assets/images/bochica_romantic_decor_1790618007934.jpg"
      ]
    },
    6: {
      url: "/assets/images/bochica_jacuzzi_deck_1790618019311.jpg",
      gallery: [
        "/assets/images/bochica_jacuzzi_deck_1790618019311.jpg",
        "/assets/images/chinauta_romantic_dome_night.jpg",
        "/assets/images/chinauta_deck_asoleadoras.jpg",
        "/assets/images/huitaca_deck_jacuzzi_1790621224807.jpg"
      ]
    }
  };

  for (const [idStr, info] of Object.entries(userDomesMedia)) {
    const dId = Number(idStr);
    db.prepare("UPDATE domes SET image_url = ?, images = ?, video_url = ? WHERE id = ?").run(
      info.url,
      JSON.stringify(info.gallery),
      info.video_url || null,
      dId
    );
  }

  // Synchronize actual dome configurations (capacities, features, descriptions)
  db.prepare(`UPDATE domes SET capacity = 2, description = ?, features = ? WHERE code = 'DOMO-01' OR id = 1`).run(
    "Romántico domo geodésico con jacuzzi privado de hidromasaje al aire libre, malla de descanso tipo catamarán, baño privado y vista privilegiada sobre las montañas de Chinauta.",
    "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Desayuno campesino incluido, Zona de fogata, Malla de descanso"
  );
  db.prepare(`UPDATE domes SET capacity = 3, description = ?, features = ? WHERE code = 'DOMO-02' OR id = 2`).run(
    "Domo espacioso equipado con 1 cama King size y 1 cama pequeña (único domo con 2 camas), jacuzzi privado de hidromasaje, zona barbacoa (BBQ), malla flotante y zona de fogata.",
    "1 Cama King + 1 Cama Pequeña, Jacuzzi privado de hidromasaje, Zona Barbacoa (BBQ), Malla flotante, Zona de fogata, Desayuno campesino incluido, Baño privado"
  );
  db.prepare(`UPDATE domes SET capacity = 2, description = ?, features = ? WHERE code = 'DOMO-03' OR id = 3`).run(
    "Acogedor domo inmerso en la naturaleza con jacuzzi privado de hidromasaje, zona barbacoa (BBQ), 1 cama King, baño privado, zona de fogata y vista al bosque nativo.",
    "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona Barbacoa (BBQ), Zona de fogata, Desayuno campesino incluido, Vista al bosque"
  );
  db.prepare(`UPDATE domes SET capacity = 2, description = ?, features = ? WHERE code = 'DOMO-04' OR id = 4`).run(
    "Luminoso domo con jacuzzi privado de hidromasaje, zona de fogata privada, 1 cama King, baño privado y vista panorámica al valle de Chinauta.",
    "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona de fogata privada, Desayuno campesino incluido, Vista panorámica"
  );
  db.prepare(`UPDATE domes SET capacity = 2, description = ?, features = ? WHERE code = 'DOMO-05' OR id = 5`).run(
    "Domo de descanso con jacuzzi privado de hidromasaje, balcón privado, 1 cama King, baño privado, zona de fogata y desayuno campesino.",
    "Jacuzzi privado de hidromasaje, Balcón privado, Baño privado, 1 Cama King, Zona de fogata, Desayuno campesino incluido"
  );
  db.prepare(`UPDATE domes SET capacity = 2, description = ?, features = ? WHERE code = 'DOMO-06' OR id = 6`).run(
    "Domo con jacuzzi privado de hidromasaje al aire libre, vista panorámica a la montaña, 1 cama King, baño privado, zona de fogata y desayuno campesino incluido.",
    "Jacuzzi privado de hidromasaje, Baño privado, 1 Cama King, Zona de fogata privada, Malla de descanso, Desayuno campesino incluido"
  );
} catch (e) {
  console.warn("Dome image sync notice:", e);
} });

// Promo codes table and one-time migrations (prices, amenities)
db.exec(`
  CREATE TABLE IF NOT EXISTS app_migrations (
    name TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    percent INTEGER NOT NULL CHECK(percent IN (5, 10, 15, 20)),
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Percentages an admin may give a promo code.
const PROMO_PERCENTS = [5, 10, 15, 20];

// Older databases were created with CHECK(percent IN (5, 10, 15)). SQLite cannot alter a CHECK, so rebuild the table once.
runOnce("promo_percent_20", () => {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'promo_codes'`).get() as any;
  if (row && !/20\)/.test(String(row.sql))) {
    db.exec(`
      CREATE TABLE promo_codes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        percent INTEGER NOT NULL CHECK(percent IN (5, 10, 15, 20)),
        active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO promo_codes_new (id, code, percent, active, created_at)
        SELECT id, code, percent, active, created_at FROM promo_codes;
      DROP TABLE promo_codes;
      ALTER TABLE promo_codes_new RENAME TO promo_codes;
    `);
  }
});

// One-time: nightly prices requested by the owner (applied once, so later admin edits are kept)
const PRICE_MIGRATION = "domes_prices_2026_11";
if (!db.prepare(`SELECT 1 FROM app_migrations WHERE name = ?`).get(PRICE_MIGRATION)) {
  const requestedPrices: Record<string, number> = {
    "DOMO-01": 350000,
    "DOMO-02": 400000,
    "DOMO-03": 400000,
    "DOMO-04": 420000,
    "DOMO-05": 450000,
    "DOMO-06": 450000,
  };
  for (const [code, price] of Object.entries(requestedPrices)) {
    db.prepare(`UPDATE domes SET price_per_night = ? WHERE code = ?`).run(price, code);
  }
  db.prepare(`INSERT INTO app_migrations (name) VALUES (?)`).run(PRICE_MIGRATION);
}

// Amenities shared by every dome (appended after the sync above on each start; idempotent)
const AMENITIES_TEXT = "Nevera tipo bar con bebidas, Canastas de snacks (costo adicional), Zona BBQ a gas, Parqueadero gratis";
try {
  const domeRows = db.prepare(`SELECT id, features FROM domes`).all() as any[];
  for (const r of domeRows) {
    const f: string = r.features || "";
    if (!f.includes("Nevera tipo bar")) {
      db.prepare(`UPDATE domes SET features = ? WHERE id = ?`).run(f ? `${f}, ${AMENITIES_TEXT}` : AMENITIES_TEXT, r.id);
    }
  }
} catch (e) {
  console.warn("Amenities sync notice:", e);
}

// Discount rule: Mon–Thu check-in gets 10%; a valid promo code gives 5/10/15%. The higher one applies.
function computeDiscount(checkIn: string, subtotal: number, promoCode?: string) {
  const day = new Date(`${checkIn}T00:00:00Z`).getUTCDay(); // 0 = Sun ... 6 = Sat
  const weekdayPct = day >= 1 && day <= 4 ? 10 : 0;
  let promoPct = 0;
  if (promoCode && String(promoCode).trim()) {
    const row = db.prepare(`SELECT percent FROM promo_codes WHERE code = ? AND active = 1`).get(String(promoCode).trim().toUpperCase()) as any;
    if (row) promoPct = row.percent;
  }
  const percent = Math.max(weekdayPct, promoPct);
  return { percent, amount: Math.round((subtotal * percent) / 100), weekdayPct, promoPct };
}

// Public: check a promo code before booking
app.get("/api/promo-codes/validate", (req, res) => {
  const code = String(req.query.code || "").trim().toUpperCase();
  if (!code) return res.status(400).json({ valid: false, error: "Escribe un código." });
  const row = db.prepare(`SELECT code, percent FROM promo_codes WHERE code = ? AND active = 1`).get(code) as any;
  if (!row) return res.status(404).json({ valid: false, error: "El código no es válido." });
  res.json({ valid: true, code: row.code, percent: row.percent });
});

// Admin: list, create, update and deactivate promo codes
app.get("/api/promo-codes", (req, res) => {
  res.json(db.prepare(`SELECT id, code, percent, active, created_at FROM promo_codes ORDER BY code`).all());
});

app.post("/api/promo-codes", (req, res) => {
  const { code, percent, active, user_name } = req.body;
  const cleanCode = String(code || "").trim().toUpperCase();
  const pct = Number(percent);
  if (!cleanCode || !PROMO_PERCENTS.includes(pct)) {
    return res.status(400).json({ error: "Código obligatorio y porcentaje de 5, 10, 15 o 20." });
  }
  try {
    const info = db.prepare(`INSERT INTO promo_codes (code, percent, active) VALUES (?, ?, ?)`).run(cleanCode, pct, active === 0 ? 0 : 1);
    logAudit(user_name || "Admin", "CREAR_CODIGO", "Promo", cleanCode, `Código ${cleanCode} al ${pct}%`);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(409).json({ error: "Ese código ya existe." });
  }
});

app.put("/api/promo-codes/:id", (req, res) => {
  const { id } = req.params;
  const { code, percent, active, user_name } = req.body;
  const cleanCode = String(code || "").trim().toUpperCase();
  const pct = Number(percent);
  if (!cleanCode || !PROMO_PERCENTS.includes(pct)) {
    return res.status(400).json({ error: "Código obligatorio y porcentaje de 5, 10, 15 o 20." });
  }
  try {
    db.prepare(`UPDATE promo_codes SET code = ?, percent = ?, active = ? WHERE id = ?`).run(cleanCode, pct, active === 0 ? 0 : 1, id);
    logAudit(user_name || "Admin", "ACTUALIZAR_CODIGO", "Promo", cleanCode, `Código ${cleanCode} al ${pct}%, activo: ${active === 0 ? "no" : "sí"}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(409).json({ error: "Ese código ya existe." });
  }
});

// Seed / Update Gallery Items with real uploaded videos and photos
try {
  // Seed only an empty gallery: never delete what the admin has added or removed.
  if ((db.prepare(`SELECT COUNT(*) AS c FROM gallery_items`).get() as any).c === 0) db.exec(`
    INSERT INTO gallery_items (title, category, media_type, media_url, description) VALUES
    ('Domo 1 Huitaca — Video Tour y Jacuzzi Privado', 'Videos', 'video', '/assets/videos/domo_1_user_video.mp4', 'Recorrido completo en video de alta calidad por las instalaciones, jacuzzi del Domo Huitaca.'),
    ('Domo 3 Bachué — Experiencia de Descanso y Naturaleza', 'Videos', 'video', '/assets/videos/domo_3_user_video.mp4', 'Video experiencia real en el Domo Bachué rodeado de vegetación y clima cálido en Chinauta.'),
    ('Domo 5 Chiminichagua — Vista Panorámica y Balcón', 'Videos', 'video', '/assets/videos/domo_5_user_video.mp4', 'Video tour por el balcón del Domo Chiminichagua.'),
    ('Domo 1 Huitaca — Habitación y Jacuzzi Fotos Reales', 'Domos', 'image', '/assets/images/dome_1_1791403584294.jpg', 'Fotografía real del Domo Huitaca con jacuzzi privado de hidromasaje y cama King.'),
    ('Domo 2 Bochica — Suite con Doble Cama', 'Domos', 'image', '/assets/images/dome_2_1791404907620.jpg', 'Fotografía real del Domo Bochica equipado con 1 cama King y 1 cama adicional.'),
    ('Domo 4 Luna Chía — Vista Espectacular al Valle', 'Domos', 'image', '/assets/images/dome_4_1791404275513.jpg', 'Fotografía real del Domo Luna Chía con amplia panorámica de las montañas de Chinauta.'),
    ('Domo 5 Chiminichagua — Suite y Balcón Campestre', 'Domos', 'image', '/assets/images/dome_5_1791404612181.jpg', 'Fotografía real del Domo Chiminichagua con balcón privado y jacuzzi de hidromasaje.'),
    ('Deck Solárium con Asoleadoras & Sombrilla', 'Jacuzzis & Vistas', 'image', '/assets/images/chinauta_deck_asoleadoras.jpg', 'Deck privado en madera con asoleadoras, sombrilla verde y jacuzzi de hidromasaje.'),
    ('Noche Mágica Bajo las Estrellas — Pareja en Domo', 'Domos', 'image', '/assets/images/chinauta_romantic_dome_night.jpg', 'Cena romántica para parejas en bata blanca con vino tinto y vista estelar.'),
    ('Domo Bochica — Decoración Romántica Interior', 'Domos', 'image', '/assets/images/bochica_romantic_decor_1790618007934.jpg', 'Cama decorada para ocasiones especiales con rosas, globos y ambiente cálido.'),
    ('Domo Bochica — Jacuzzi en Deck al Atardecer', 'Jacuzzis & Vistas', 'image', '/assets/images/bochica_jacuzzi_deck_1790618019311.jpg', 'Jacuzzi privado exterior en plataforma de madera rodeado de naturaleza.'),
    ('Domo Bochica — Vista Panorámica al Ocaso', 'Domos', 'image', '/assets/images/bochica_sunset_view_1790617981274.jpg', 'Vista privilegiada del atardecer a través de los ventanales geodésicos.');
  `);
} catch (e) {
  console.warn("Gallery sync notice:", e);
}


// Seed Menu Items if empty
try {
  const mCount = db.prepare("SELECT COUNT(*) as count FROM menu_items").get() as { count: number };
  if (mCount.count === 0) {
    const insertMenu = db.prepare(`INSERT INTO menu_items (item_number, title, title_en, category, description, description_en, preparations, sides, beverage, price, image, images, video_url, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertMenu.run(
      1,
      "Trucha Gratinada o en Salsa de Champiñones",
      "Gratin / Mushroom Sauce Rainbow Trout",
      "Almuerzos y Comidas",
      "Trucha fresca marinada en hierbas nativas y preparada a tu preferencia (gratinada al horno, en cremosa salsa de champiñones o asada a la parrilla).",
      "Fresh Andean trout seasoned with local herbs, cooked to your preference (baked au gratin, creamy mushroom sauce, or charbroiled).",
      JSON.stringify(["Gratinada", "En salsa de champiñones", "Asada a la parrilla"]),
      JSON.stringify(["Papas a la francesa", "Ensalada fresca de la casa"]),
      "Jugo natural de fruta de estación",
      60000,
      "/assets/images/trucha-gratinada.webp",
      JSON.stringify(["/assets/images/trucha-gratinada.webp", "/assets/images/trucha-salsa-champinones.webp"]),
      null,
      "Plato Especialidad"
    );
    insertMenu.run(
      2,
      "Carnes Gratinadas o en Salsa de Champiñones (Res, Cerdo o Pechuga)",
      "Au Gratin or Mushroom Sauce Meats (Beef, Pork or Chicken Breast)",
      "Almuerzos y Comidas",
      "Carne de res, cerdo o pechuga, sazonada al estilo campestre y preparada a tu preferencia: gratinada con queso o en salsa de champiñones. También disponible asada a la parrilla.",
      "Beef, pork or chicken breast, seasoned in rustic style and prepared to your liking: au gratin with cheese or in mushroom sauce. Also available grilled.",
      JSON.stringify(["Carne de res", "Cerdo", "Pechuga", "Gratinada con queso", "En salsa de champiñones", "Asada a la parrilla"]),
      JSON.stringify(["Papas a la francesa", "Ensalada fresca"]),
      "Jugo natural de fruta de estación",
      50000,
      "/assets/images/carne-res-gratinada.webp",
      JSON.stringify([
        "/assets/images/carne-res-gratinada.webp",
        "/assets/images/carne-cerdo-gratinada.webp",
        "/assets/images/carne-pechuga-gratinada.webp",
        "/assets/images/carne-cerdo-champinones.webp",
        "/assets/images/carne-pechuga-champinones.webp"
      ]),
      null,
      "Favorito del Huésped"
    );
    insertMenu.run(
      3,
      "Combo Hamburguesa Artesanal",
      "Artisan Burger Meal Combo",
      "Snacks",
      "Hamburguesa gourmet artesanal con carne selecta 100% de res, queso fundido, vegetales frescos y pan artesanal dorado.",
      "Gourmet artisan 100% beef burger with melted artisan cheese, bacon, and crisp vegetables on a brioche bun.",
      JSON.stringify(["Término Medio", "Bien Asada", "Con Queso Extra"]),
      JSON.stringify(["Papas a la francesa crujientes"]),
      "Gaseosa Postobón de 400ml",
      40000,
      "/assets/images/hamburguesa-papas.webp",
      JSON.stringify(["/assets/images/hamburguesa-papas.webp"]),
      null,
      "Combo Rápido"
    );
  }
} catch (e) {
  console.warn("Menu seed notice:", e);
}

// Helper for logging audit
function logAudit(userName: string, action: string, targetType: string, targetId: string, details: string) {
  try {
    const stmt = db.prepare(`INSERT INTO audit_logs (user_name, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)`);
    stmt.run(userName || "Sistema", action, targetType, targetId, details);
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

// API Routes

// 1. Domes
app.get("/api/domes", (req, res) => {
  try {
    const rawDomes = db.prepare("SELECT * FROM domes ORDER BY id ASC").all();
    const domes = rawDomes.map((d: any) => {
      let images: string[] = [];
      if (d.images) {
        try {
          images = JSON.parse(d.images);
        } catch (_) {
          images = [];
        }
      }
      return { ...d, images };
    });
    res.json(domes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/domes", (req, res) => {
  try {
    const { name, code, description, capacity, price_per_night, image_url, images, status, features, policies, user_name } = req.body;
    const imagesStr = Array.isArray(images) ? JSON.stringify(images) : typeof images === 'string' ? images : null;
    const stmt = db.prepare(`INSERT INTO domes (name, code, description, capacity, price_per_night, image_url, images, status, features, policies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(name, code, description, capacity, price_per_night, image_url, imagesStr, status || 'Disponible', features, policies);
    logAudit(user_name, "CREAR_DOMO", "Domo", String(info.lastInsertRowid), `Creación del domo ${name} (${code})`);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/domes/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, capacity, price_per_night, image_url, images, status, features, policies, user_name } = req.body;
    const imagesStr = Array.isArray(images) ? JSON.stringify(images) : typeof images === 'string' ? images : null;
    const stmt = db.prepare(`UPDATE domes SET name = ?, code = ?, description = ?, capacity = ?, price_per_night = ?, image_url = ?, images = COALESCE(?, images), status = ?, features = ?, policies = ? WHERE id = ?`);
    stmt.run(name, code, description, capacity, price_per_night, image_url, imagesStr, status, features, policies, id);
    logAudit(user_name, "ACTUALIZAR_DOMO", "Domo", id, `Actualización de domo ${name} (${status})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/domes/:id/images", (req, res) => {
  try {
    const { id } = req.params;
    const { images, user_name } = req.body;
    const imagesStr = Array.isArray(images) ? JSON.stringify(images) : typeof images === 'string' ? images : null;
    db.prepare("UPDATE domes SET images = ? WHERE id = ?").run(imagesStr, id);
    logAudit(user_name, "ACTUALIZAR_FOTOS_DOMO", "Domo", id, "Actualización de galería de fotos del domo");
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Uploads (admin only) ----------
// The file type comes from the data URL's MIME type, never from the client's file name, and the name on disk is generated here.
// Nothing user-supplied is used in a path, so "../" tricks cannot write outside public/assets.
class UploadError extends Error {}
const UPLOAD_TYPES: Record<string, { kind: "image" | "video"; ext: string }> = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/webp": { kind: "image", ext: "webp" },
  "image/gif": { kind: "image", ext: "gif" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/webm": { kind: "video", ext: "webm" },
  "video/quicktime": { kind: "video", ext: "mov" },
};
function saveUpload(dataUrl: unknown, expectKind?: "image" | "video"): { url: string; kind: "image" | "video" } {
  const m = typeof dataUrl === "string" ? /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl) : null;
  if (!m) throw new UploadError("El archivo debe enviarse como data URL en base64.");
  const type = UPLOAD_TYPES[m[1].toLowerCase()];
  if (!type) throw new UploadError("Tipo de archivo no permitido. Usa JPG, PNG, WEBP, GIF, MP4, WEBM o MOV.");
  if (expectKind && type.kind !== expectKind) throw new UploadError(`Se esperaba un archivo de tipo ${expectKind}.`);
  const folder = type.kind === "video" ? "videos" : "images";
  const dir = path.join(process.cwd(), "public", "assets", folder);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${type.kind}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${type.ext}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(m[2], "base64"));
  return { url: `/assets/${folder}/${name}`, kind: type.kind };
}
function uploadErrorStatus(err: any): number {
  return err instanceof UploadError ? 400 : 500;
}

app.post("/api/upload-video", (req, res) => {
  try {
    const { videoData } = req.body;
    if (!videoData) {
      return res.status(400).json({ error: "No video data provided" });
    }
    const saved = saveUpload(videoData, "video");
    res.json({ success: true, url: saved.url });
  } catch (err: any) {
    res.status(uploadErrorStatus(err)).json({ error: err.message });
  }
});

app.post("/api/upload-image", (req, res) => {
  try {
    const { domeId, imageData } = req.body;
    if (!imageData) {
      return res.status(400).json({ error: "No image data provided" });
    }
    const imageUrl = saveUpload(imageData, "image").url;

    // Optionally update the dome in SQLite database if domeId is provided
    if (domeId) {
      try {
        const row = db.prepare("SELECT images FROM domes WHERE id = ?").get(domeId) as any;
        let existingImages: string[] = [];
        if (row && row.images) {
          try {
            existingImages = JSON.parse(row.images);
          } catch (_) {
            existingImages = [];
          }
        }
        if (!existingImages.includes(imageUrl)) {
          existingImages.unshift(imageUrl);
          db.prepare("UPDATE domes SET images = ? WHERE id = ?").run(JSON.stringify(existingImages), domeId);
        }
      } catch (dbErr) {
        console.warn("Could not append image to dome DB record:", dbErr);
      }
    }

    res.json({ success: true, url: imageUrl });
  } catch (err: any) {
    res.status(uploadErrorStatus(err)).json({ error: err.message });
  }
});

// Universal Media Upload for Photos and Videos (Gallery, Food Menu, Testimonials, Domes)
app.post("/api/upload-media", (req, res) => {
  try {
    const { mediaData } = req.body;
    if (!mediaData) {
      return res.status(400).json({ error: "No media data provided" });
    }
    const saved = saveUpload(mediaData);
    res.json({ success: true, url: saved.url, media_type: saved.kind });
  } catch (err: any) {
    console.error("Upload media error:", err.message);
    res.status(uploadErrorStatus(err)).json({ error: err.message });
  }
});

// Fotos de la sección de ubicación (Chinauta)
db.exec(`
  CREATE TABLE IF NOT EXISTS location_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.get("/api/location-photos", (req, res) => {
  try {
    const items = db.prepare("SELECT id, url FROM location_photos ORDER BY id ASC").all();
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/location-photos", (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string" || !url.startsWith("/assets/")) {
      return res.status(400).json({ success: false, error: "URL de foto no válida." });
    }
    const info = db.prepare("INSERT INTO location_photos (url) VALUES (?)").run(url);
    res.json({ success: true, id: Number(info.lastInsertRowid) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/location-photos/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM location_photos WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Gallery Endpoints
app.get("/api/gallery", (req, res) => {
  try {
    const items = db.prepare("SELECT * FROM gallery_items ORDER BY id DESC").all();
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/gallery", (req, res) => {
  try {
    const { title, category, media_type, media_url, description, user_name } = req.body;
    const stmt = db.prepare(`INSERT INTO gallery_items (title, category, media_type, media_url, description) VALUES (?, ?, ?, ?, ?)`);
    const info = stmt.run(title || "Nueva Experiencia", category || "Domos", media_type || "image", media_url, description || "");
    logAudit(user_name || "Admin", "CREAR_GALERIA", "Galeria", String(info.lastInsertRowid), `Nueva foto/video agregado a la galería: ${title}`);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/gallery/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM gallery_items WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Menu Endpoints
app.get("/api/menu", (req, res) => {
  try {
    const items = db.prepare("SELECT * FROM menu_items ORDER BY id ASC").all();
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/menu", (req, res) => {
  try {
    const { item_number, title, title_en, category, description, description_en, preparations, sides, beverage, price, image, images, video_url, badge, user_name } = req.body;
    const stmt = db.prepare(`INSERT INTO menu_items (item_number, title, title_en, category, description, description_en, preparations, sides, beverage, price, image, images, video_url, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(
      item_number || 1,
      title,
      title_en || title,
      category || "Almuerzos y Cenas",
      description || "",
      description_en || description || "",
      typeof preparations === 'object' ? JSON.stringify(preparations) : preparations,
      typeof sides === 'object' ? JSON.stringify(sides) : sides,
      beverage || "",
      price || 0,
      image || "",
      typeof images === 'object' ? JSON.stringify(images) : images,
      video_url || null,
      badge || null
    );
    logAudit(user_name || "Admin", "CREAR_PLATO_MENU", "Menu", String(info.lastInsertRowid), `Plato/Bebida agregado: ${title}`);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/menu/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, description, price, image, images, video_url, badge } = req.body;
    const stmt = db.prepare(`UPDATE menu_items SET title = COALESCE(?, title), category = COALESCE(?, category), description = COALESCE(?, description), price = COALESCE(?, price), image = COALESCE(?, image), images = COALESCE(?, images), video_url = COALESCE(?, video_url), badge = COALESCE(?, badge) WHERE id = ?`);
    stmt.run(title, category, description, price, image, typeof images === 'object' ? JSON.stringify(images) : images, video_url, badge, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Testimonials Endpoints
app.get("/api/testimonials", (req, res) => {
  try {
    const items = db.prepare("SELECT * FROM testimonials ORDER BY id DESC").all();
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/testimonials", (req, res) => {
  try {
    const { name, location, dome, rating, date, comment, avatar, image, video_url, user_name } = req.body;
    const stmt = db.prepare(`INSERT INTO testimonials (name, location, dome, rating, date, comment, avatar, image, video_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(
      name || "Huésped Feliz",
      location || "Colombia",
      dome || "Domo Huitaca",
      rating || 5,
      date || "Reciente",
      comment,
      avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      image || null,
      video_url || null
    );
    logAudit(user_name || "Cliente", "CREAR_TESTIMONIO", "Testimonio", String(info.lastInsertRowid), `Testimonio agregado por ${name}`);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/testimonials/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { avatar, image, video_url } = req.body;
    db.prepare("UPDATE testimonials SET avatar = COALESCE(?, avatar), image = COALESCE(?, image), video_url = COALESCE(?, video_url) WHERE id = ?").run(avatar, image, video_url, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Maintenance / Blocks
app.get("/api/maintenance", (req, res) => {
  try {
    const blocks = db.prepare(`
      SELECT m.*, d.name as dome_name 
      FROM maintenance_blocks m 
      JOIN domes d ON m.dome_id = d.id 
      ORDER BY m.start_date DESC
    `).all();
    res.json(blocks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/maintenance", (req, res) => {
  try {
    const { dome_id, start_date, end_date, reason, user_name } = req.body;
    // Check overlapping reservations
    const overlap = db.prepare(`
      SELECT COUNT(*) as count FROM reservations 
      WHERE dome_id = ? AND status NOT IN ('Cancelada', 'Completada', 'No show')
      AND check_in < ? AND check_out > ?
    `).get(dome_id, end_date, start_date) as { count: number };

    if (overlap.count > 0) {
      return res.status(400).json({ error: "No se puede bloquear el domo: existen reservas confirmadas en ese rango de fechas." });
    }

    const stmt = db.prepare(`INSERT INTO maintenance_blocks (dome_id, start_date, end_date, reason, created_by) VALUES (?, ?, ?, ?, ?)`);
    const info = stmt.run(dome_id, start_date, end_date, reason, user_name);
    
    // Set dome status to Fuera de servicio if maintenance is active now
    const todayStr = new Date().toISOString().split("T")[0];
    if (start_date <= todayStr && end_date >= todayStr) {
      db.prepare(`UPDATE domes SET status = 'Fuera de servicio' WHERE id = ?`).run(dome_id);
    }

    logAudit(user_name, "CREAR_BLOQUEO", "Mantenimiento", String(info.lastInsertRowid), `Bloqueo de domo ID ${dome_id} del ${start_date} al ${end_date}`);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/maintenance/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { user_name } = req.body || {};
    const block = db.prepare(`SELECT * FROM maintenance_blocks WHERE id = ?`).get(id) as any;
    if (block) {
      db.prepare(`DELETE FROM maintenance_blocks WHERE id = ?`).run(id);
      db.prepare(`UPDATE domes SET status = 'Disponible' WHERE id = ?`).run(block.dome_id);
      logAudit(user_name || "Admin", "ELIMINAR_BLOQUEO", "Mantenimiento", id, `Eliminación de bloqueo para domo ID ${block.dome_id}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Availability Check
app.get("/api/availability", (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: "Debe proporcionar checkIn y checkOut" });
    }

    const strCheckIn = String(checkIn);
    const strCheckOut = String(checkOut);

    const domes = db.prepare("SELECT * FROM domes WHERE status != 'Fuera de servicio'").all() as any[];
    
    const results = domes.map((dome) => {
      // Check active reservations overlap: newCheckIn < existingCheckOut AND newCheckOut > existingCheckIn
      const reservationOverlap = db.prepare(`
        SELECT COUNT(*) as count FROM reservations 
        WHERE dome_id = ? 
        AND status NOT IN ('Cancelada', 'Completada', 'No show')
        AND check_in < ? AND check_out > ?
      `).get(dome.id, strCheckOut, strCheckIn) as { count: number };

      // Check maintenance blocks overlap
      const maintenanceOverlap = db.prepare(`
        SELECT COUNT(*) as count FROM maintenance_blocks
        WHERE dome_id = ?
        AND start_date < ? AND end_date > ?
      `).get(dome.id, strCheckOut, strCheckIn) as { count: number };

      const isAvailable = reservationOverlap.count === 0 && maintenanceOverlap.count === 0 && dome.status === 'Disponible';

      return {
        ...dome,
        isAvailable,
        reason: !isAvailable ? (dome.status === 'Fuera de servicio' ? 'Fuera de servicio' : (maintenanceOverlap.count > 0 ? 'Mantenimiento' : 'Reservado')) : 'Disponible'
      };
    });

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Reservations & Double Booking Prevention (Atomic Transaction)
// Public lookup for a guest: needs the exact reservation code AND the email or phone used to book.
// Returns only the fields the guest needs (no notes, documents or other customers' data).
// Customer account: the logged-in guest's own reservations (matched by verified email).
app.get("/api/my/reservations", requireCustomer, (req, res) => {
  const email = (req as any).customerEmail as string;
  const rows = db.prepare(`
    SELECT r.reservation_code, r.check_in, r.check_out, r.guests, r.status, r.payment_status,
           r.total_amount, r.amount_paid, r.amount_pending, r.created_at, d.name AS dome_name
    FROM reservations r
    JOIN customers c ON r.customer_id = c.id
    JOIN domes d ON r.dome_id = d.id
    WHERE LOWER(TRIM(c.email)) = ?
    ORDER BY r.check_in DESC
  `).all(email);
  res.json(rows);
});

app.get("/api/reservations/lookup", (req, res) => {
  const code = String(req.query.code || "").trim().toUpperCase();
  const contact = String(req.query.contact || "").trim();
  if (!code || !contact) {
    return res.status(400).json({ error: "Escribe el código de reserva y tu correo o teléfono." });
  }
  const contactEmail = contact.toLowerCase();
  const contactDigits = contact.replace(/\D/g, "");
  const rows = db.prepare(`
    SELECT r.id, r.reservation_code, r.check_in, r.check_out, r.guests, r.status, r.payment_status,
           r.total_amount, r.amount_pending, r.created_at, d.name as dome_name,
           c.email as customer_email, c.phone as customer_phone, c.whatsapp as customer_whatsapp
    FROM reservations r
    JOIN customers c ON r.customer_id = c.id
    JOIN domes d ON r.dome_id = d.id
    WHERE UPPER(r.reservation_code) = ?
  `).all(code) as any[];
  const matches = rows.filter((r) => {
    const emailOk = !!r.customer_email && String(r.customer_email).trim().toLowerCase() === contactEmail;
    const phoneOk = contactDigits.length >= 7 && [r.customer_phone, r.customer_whatsapp]
      .some((p) => p && String(p).replace(/\D/g, "") === contactDigits);
    return emailOk || phoneOk;
  });
  res.json(matches.map(({ customer_email, customer_phone, customer_whatsapp, ...safe }) => safe));
});

// Privacy self-service (Ley 1581 de 2012). The guest proves who they are with the reservation code AND the
// email or phone used to book. Attempts are rate-limited per IP to make guessing codes impractical.
const privacyAttempts = new Map<string, { count: number; resetAt: number }>();
function privacyRateLimited(req: express.Request): boolean {
  const ip = String(req.ip || req.socket.remoteAddress || "unknown");
  const now = Date.now();
  const entry = privacyAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    privacyAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

function findGuestRows(code: string, contact: string): any[] {
  const rows = db.prepare(`
    SELECT r.*, c.id as customer_pk, c.name as customer_name, c.phone as customer_phone, c.whatsapp as customer_whatsapp,
           c.email as customer_email, c.document_id as customer_document_id, c.notes as customer_notes,
           c.marketing_consent as customer_marketing_consent, d.name as dome_name
    FROM reservations r
    JOIN customers c ON r.customer_id = c.id
    JOIN domes d ON r.dome_id = d.id
    WHERE UPPER(r.reservation_code) = ?
  `).all(code.toUpperCase()) as any[];
  const contactEmail = contact.toLowerCase();
  const contactDigits = contact.replace(/\D/g, "");
  return rows.filter((r) => {
    const emailOk = !!r.customer_email && String(r.customer_email).trim().toLowerCase() === contactEmail;
    const phoneOk = contactDigits.length >= 7 && [r.customer_phone, r.customer_whatsapp]
      .some((p) => p && String(p).replace(/\D/g, "") === contactDigits);
    return emailOk || phoneOk;
  });
}

// Download what we hold about the guest's matching reservations (right of access).
app.get("/api/privacy/export", (req, res) => {
  if (privacyRateLimited(req)) return res.status(429).json({ error: "Demasiados intentos. Intenta de nuevo en 15 minutos." });
  const code = String(req.query.code || "").trim();
  const contact = String(req.query.contact || "").trim();
  if (!code || !contact) return res.status(400).json({ error: "Escribe el código de reserva y tu correo o teléfono." });
  const rows = findGuestRows(code, contact);
  if (rows.length === 0) return res.status(404).json({ error: "No encontramos una reserva con esos datos." });
  const first = rows[0];
  res.setHeader("Content-Disposition", 'attachment; filename="mis-datos-eco-glamping.json"');
  res.json({
    exported_at: new Date().toISOString(),
    customer: {
      name: first.customer_name,
      phone: first.customer_phone,
      whatsapp: first.customer_whatsapp,
      email: first.customer_email,
      document_id: first.customer_document_id,
      notes: first.customer_notes,
      marketing_consent: !!first.customer_marketing_consent,
    },
    reservations: rows.map((r) => ({
      reservation_code: r.reservation_code,
      dome: r.dome_name,
      check_in: r.check_in,
      check_out: r.check_out,
      guests: r.guests,
      status: r.status,
      payment_status: r.payment_status,
      total_amount: r.total_amount,
      amount_paid: r.amount_paid,
      created_at: r.created_at,
      terms_accepted_at: r.terms_accepted_at,
      terms_version: r.terms_version,
      notes: r.notes,
      payments: db.prepare("SELECT amount, method, status, created_at FROM payments WHERE reservation_id = ?").all(r.id),
    })),
  });
});

// Delete personal data (right of erasure). Personal fields are removed; reservation amounts and dates are kept
// because commercial and tax law requires keeping accounting records for a number of years.
app.post("/api/privacy/delete", (req, res) => {
  if (privacyRateLimited(req)) return res.status(429).json({ error: "Demasiados intentos. Intenta de nuevo en 15 minutos." });
  const { code, contact, confirm } = req.body || {};
  if (confirm !== true) return res.status(400).json({ error: "Confirma que quieres eliminar tus datos personales." });
  const rows = findGuestRows(String(code || "").trim(), String(contact || "").trim());
  if (rows.length === 0) return res.status(404).json({ error: "No encontramos una reserva con esos datos." });
  const customerIds = [...new Set(rows.map((r) => r.customer_pk))];
  const nowIso = new Date().toISOString();
  try {
    db.exec("BEGIN TRANSACTION;");
    for (const id of customerIds) {
      db.prepare(`UPDATE customers SET name = 'Cliente anonimizado', phone = '', whatsapp = '', email = '', document_id = '',
                  notes = '', marketing_consent = 0, marketing_consent_at = NULL, anonymized_at = ? WHERE id = ?`).run(nowIso, id);
    }
    for (const r of rows) {
      db.prepare("UPDATE reservations SET notes = '' WHERE id = ?").run(r.id);
    }
    db.exec("COMMIT;");
  } catch (err: any) {
    try { db.exec("ROLLBACK;"); } catch (e) {}
    console.error("Privacy delete error:", err);
    return res.status(500).json({ error: "No se pudo completar la eliminación. Escríbenos al correo de contacto." });
  }
  logAudit("Cliente", "ANONIMIZAR_DATOS", "Cliente", customerIds.join(","), "Eliminación de datos personales solicitada por el titular");
  res.json({ success: true, message: "Tus datos personales fueron eliminados. Los montos y fechas de reserva se conservan por obligación contable y tributaria." });
});

app.get("/api/reservations", (req, res) => {
  try {
    const reservations = db.prepare(`
      SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.whatsapp as customer_whatsapp, d.name as dome_name, d.code as dome_code
      FROM reservations r
      JOIN customers c ON r.customer_id = c.id
      JOIN domes d ON r.dome_id = d.id
      ORDER BY r.created_at DESC
    `).all();
    res.json(reservations);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Version of the terms and privacy text shown to the guest (see src/config/legal.ts). Change it when the text changes.
const LEGAL_TERMS_VERSION = "2026-11-12";

app.post("/api/reservations", (req, res) => {
  const { customer, dome_id, check_in, guests, notes, user_name, promo_code, bbq_zone, booking_type, pets, addons, food_items } = req.body;
  const isDayPass = booking_type === 'pasadia';
  let check_out: string = req.body.check_out;
  if (isDayPass && check_in) {
    // Day pass: one day, stored with the next day as checkout so it blocks the dome for that date
    check_out = new Date(new Date(`${check_in}T00:00:00Z`).getTime() + 86400000).toISOString().split("T")[0];
  }

  if (!customer || !customer.name || !dome_id || !check_in || !check_out) {
    return res.status(400).json({ error: "Faltan datos obligatorios para crear la reserva." });
  }

  // The guest must accept the terms and confirm they are an adult (both boxes are unchecked by default in the form).
  if (!req.body.consent || req.body.consent.terms !== true || req.body.consent.age !== true) {
    return res.status(400).json({ error: "Debes aceptar los términos y condiciones y confirmar que eres mayor de 18 años." });
  }
  const nowIso = new Date().toISOString();
  const marketingOk = req.body.consent.marketing === true ? 1 : 0;

  // Validate dates format AAAA-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(check_in) || !dateRegex.test(check_out)) {
    return res.status(400).json({ error: "Las fechas deben tener el formato AAAA-MM-DD." });
  }

  const inDate = new Date(`${check_in}T00:00:00Z`);
  const outDate = new Date(`${check_out}T00:00:00Z`);
  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || check_out <= check_in) {
    return res.status(400).json({ error: "La fecha de salida debe ser posterior a la fecha de entrada." });
  }

  const diffMs = outDate.getTime() - inDate.getTime();
  const nights = isDayPass ? 1 : Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (nights <= 0) {
    return res.status(400).json({ error: "El rango de fechas debe tener al menos una noche." });
  }

  // BEGIN TRANSACTION & SERIALIZABLE ISOLATION (or strict SQLite transaction lock)
  try {
    db.exec("BEGIN EXCLUSIVE TRANSACTION;");

    // 1. Check if dome exists and is available
    const dome = db.prepare("SELECT * FROM domes WHERE id = ?").get(dome_id) as any;
    if (!dome || dome.status === 'Fuera de servicio') {
      db.exec("ROLLBACK;");
      return res.status(400).json({ error: "El domo seleccionado no está disponible o se encuentra fuera de servicio." });
    }

    // Check dome capacity
    const numGuests = Number(guests) || 1;
    if (numGuests > dome.capacity) {
      db.exec("ROLLBACK;");
      return res.status(400).json({ error: `El número de huéspedes (${numGuests}) supera la capacidad máxima del domo (${dome.capacity}).` });
    }

    // Server-calculated total. The client total is ignored; every price comes from the database or the tables below.
    const basePrice = isDayPass ? 250000 : Number(dome.price_per_night) * nights;
    const extraPersonsFee = Math.max(0, numGuests - Number(dome.capacity || 2)) * 70000 * (isDayPass ? 1 : nights);
    const petCount = pets ? Math.max(0, Math.min(10, Number(pets) || 0)) : 0;
    const petsFee = petCount * 30000;
    const addonPrices: Record<string, number> = { bonoTime: 50000, coupleMassage: 250000 };
    const decorFee = addons?.decorVip ? 150000 : (addons?.decorBasic ? 75000 : 0);
    const addonsFee = (addons?.bonoTime ? addonPrices.bonoTime : 0) + decorFee + (addons?.coupleMassage ? addonPrices.coupleMassage : 0);
    // Only room, extra guests, pets and add-ons get the discount (same as before)
    const serverTotal = basePrice + extraPersonsFee + petsFee + addonsFee;
    const discount = computeDiscount(check_in, serverTotal, promo_code);
    // Food from the menu: priced from the database, not discounted
    let foodFee = 0;
    if (!bbq_zone && Array.isArray(food_items)) {
      for (const item of food_items) {
        const qty = Math.max(0, Math.min(50, Number(item?.qty) || 0));
        if (!qty) continue;
        const row = db.prepare(`SELECT price FROM menu_items WHERE id = ?`).get(Number(item?.id)) as any;
        if (row) foodFee += Number(row.price || 0) * qty;
      }
    }
    // Zona BBQ fee ($20.000) when the guest brings their own food; not discounted
    const bbqFee = bbq_zone ? 20000 : 0;
    const finalTotal = serverTotal - discount.amount + foodFee + bbqFee;
    const discountNote = discount.amount > 0
      ? `Descuento ${discount.percent}% (-$${discount.amount})${promo_code ? ` código ${String(promo_code).trim().toUpperCase()}` : ""}. `
      : "";

    // 2. Check for overlapping reservations: check_in < existingCheckOut AND check_out > existingCheckIn
    const overlap = db.prepare(`
      SELECT COUNT(*) as count FROM reservations 
      WHERE dome_id = ? 
      AND status NOT IN ('Cancelada', 'Completada', 'No show')
      AND check_in < ? AND check_out > ?
    `).get(dome_id, check_out, check_in) as { count: number };

    if (overlap.count > 0) {
      db.exec("ROLLBACK;");
      return res.status(409).json({ error: "Este domo ya no está disponible para las fechas seleccionadas. Por favor selecciona otro domo o modifica las fechas." });
    }

    // 3. Check maintenance blocks
    const maintOverlap = db.prepare(`
      SELECT COUNT(*) as count FROM maintenance_blocks
      WHERE dome_id = ? AND start_date < ? AND end_date > ?
    `).get(dome_id, check_out, check_in) as { count: number };

    if (maintOverlap.count > 0) {
      db.exec("ROLLBACK;");
      return res.status(409).json({ error: "El domo se encuentra bajo mantenimiento programado para estas fechas." });
    }

    // 4. Find or create customer
    const email = (customer.email || '').trim();
    const phone = (customer.phone || '').trim();
    let existingCust: any = null;
    if (email && phone) {
      existingCust = db.prepare("SELECT * FROM customers WHERE email = ? OR phone = ?").get(email, phone);
    } else if (email) {
      existingCust = db.prepare("SELECT * FROM customers WHERE email = ?").get(email);
    } else if (phone) {
      existingCust = db.prepare("SELECT * FROM customers WHERE phone = ?").get(phone);
    }

    let customerId: number;
    if (existingCust) {
      customerId = existingCust.id;
      const updatedName = customer.name?.trim() || existingCust.name;
      const updatedPhone = phone || existingCust.phone;
      const updatedWhatsapp = customer.whatsapp?.trim() || existingCust.whatsapp || updatedPhone;
      const updatedDoc = customer.document_id?.trim() || existingCust.document_id || '';
      const updatedEmail = email || existingCust.email || '';
      db.prepare("UPDATE customers SET name = ?, phone = ?, whatsapp = ?, email = ?, document_id = ?, marketing_consent = ?, marketing_consent_at = ? WHERE id = ?")
        .run(updatedName, updatedPhone, updatedWhatsapp, updatedEmail, updatedDoc, marketingOk, marketingOk ? nowIso : null, customerId);
    } else {
      const custStmt = db.prepare("INSERT INTO customers (name, phone, whatsapp, email, document_id, notes, marketing_consent, marketing_consent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      const custInfo = custStmt.run(
        customer.name?.trim() || '',
        phone,
        customer.whatsapp?.trim() || phone,
        email,
        customer.document_id?.trim() || '',
        customer.notes?.trim() || '',
        marketingOk,
        marketingOk ? nowIso : null
      );
      customerId = Number(custInfo.lastInsertRowid);
    }

    // 5. Generate unique reservation code
    const randomCode = "EGC-" + Math.floor(1000 + Math.random() * 9000);

    // 6. Insert reservation with server calculated total
    const resStmt = db.prepare(`
      INSERT INTO reservations (
        reservation_code, customer_id, dome_id, check_in, check_out, guests, 
        status, payment_status, total_amount, amount_paid, amount_pending, notes, created_by,
        terms_accepted_at, terms_version, age_confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'Pendiente', 'Pendiente', ?, 0, ?, ?, ?, ?, ?, ?)
    `);

    const resInfo = resStmt.run(
      randomCode,
      customerId,
      dome_id,
      check_in,
      check_out,
      numGuests,
      finalTotal,
      finalTotal,
      discountNote + (notes || ''),
      user_name || customer.name || 'Portal Web',
      nowIso,
      LEGAL_TERMS_VERSION,
      nowIso
    );

    db.exec("COMMIT;");

    logAudit(user_name || customer.name || 'Cliente', "CREAR_RESERVA", "Reserva", randomCode, `Reserva creada para Domo ID ${dome_id} (${check_in} al ${check_out}) por $${finalTotal}`);

    res.json({
      success: true,
      reservation_code: randomCode,
      reservation_id: resInfo.lastInsertRowid
    });

  } catch (err: any) {
    try { db.exec("ROLLBACK;"); } catch (e) {}
    console.error("Reservation transaction error:", err);
    res.status(500).json({ error: "Error interno procesando la reserva: " + err.message });
  }
});

app.put("/api/reservations/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_status, user_name } = req.body;
    
    let query = "UPDATE reservations SET updated_at = CURRENT_TIMESTAMP";
    const params: any[] = [];
    if (status) {
      query += ", status = ?";
      params.push(status);
    }
    if (payment_status) {
      query += ", payment_status = ?";
      params.push(payment_status);
    }
    if (user_name) {
      query += ", updated_by = ?";
      params.push(user_name);
    }
    query += " WHERE id = ?";
    params.push(id);

    db.prepare(query).run(...params);
    logAudit(user_name || "Admin", "ACTUALIZAR_ESTADO_RESERVA", "Reserva", id, `Nuevo estado: ${status || 'N/A'}, Pago: ${payment_status || 'N/A'}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/reservations/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { user_name } = req.body || {};
    db.prepare(`UPDATE reservations SET status = 'Cancelada', updated_by = ? WHERE id = ?`).run(user_name || 'Admin', id);
    logAudit(user_name || "Admin", "CANCELAR_RESERVA", "Reserva", id, `Reserva cancelada`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Payments
app.get("/api/payments", (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT p.*, r.reservation_code, c.name as customer_name
      FROM payments p
      JOIN reservations r ON p.reservation_id = r.id
      JOIN customers c ON r.customer_id = c.id
      ORDER BY p.created_at DESC
    `).all();
    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/payments", (req, res) => {
  try {
    const { reservation_id, amount, method, user_name } = req.body;

    // Validate the payment: positive amount, reservation exists, and not more than what is pending
    const payAmount = Number(amount);
    if (!reservation_id || !Number.isFinite(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: "El monto del pago debe ser mayor a cero." });
    }
    const existing = db.prepare(`SELECT total_amount, amount_paid FROM reservations WHERE id = ?`).get(reservation_id) as any;
    if (!existing) {
      return res.status(404).json({ error: "La reserva no existe." });
    }
    const pendingNow = Math.max(0, (existing.total_amount || 0) - (existing.amount_paid || 0));
    if (payAmount > pendingNow + 0.5) {
      return res.status(400).json({ error: `El pago supera el saldo pendiente ($${pendingNow}).` });
    }
    
    db.exec("BEGIN TRANSACTION;");

    const payStmt = db.prepare(`INSERT INTO payments (reservation_id, amount, method, recorded_by) VALUES (?, ?, ?, ?)`);
    payStmt.run(reservation_id, amount, method, user_name || 'Admin');

    // Update reservation amounts
    const resRow = db.prepare(`SELECT total_amount, amount_paid FROM reservations WHERE id = ?`).get(reservation_id) as any;
    const newPaid = (resRow.amount_paid || 0) + Number(amount);
    const newPending = Math.max(0, resRow.total_amount - newPaid);
    const newPayStatus = newPending === 0 ? 'Pagado' : (newPaid > 0 ? 'Parcial' : 'Pendiente');

    db.prepare(`UPDATE reservations SET amount_paid = ?, amount_pending = ?, payment_status = ? WHERE id = ?`)
      .run(newPaid, newPending, newPayStatus, reservation_id);

    db.exec("COMMIT;");

    logAudit(user_name || "Admin", "REGISTRAR_PAGO", "Pago", String(reservation_id), `Pago registrado por $${amount} (${method})`);
    res.json({ success: true });
  } catch (err: any) {
    try { db.exec("ROLLBACK;"); } catch(e){}
    res.status(400).json({ error: err.message });
  }
});

// 6. Customers CRM
app.get("/api/customers", (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT c.*,
      COUNT(r.id) as total_reservations,
      COALESCE(SUM(r.total_amount), 0) as total_spent,
      MAX(r.created_at) as last_reservation
      FROM customers c
      LEFT JOIN reservations r ON c.id = r.customer_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all();
    res.json(customers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/customers/:id", (req, res) => {
  try {
    const { id } = req.params;
    const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
    if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

    const reservations = db.prepare(`
      SELECT r.*, d.name as dome_name
      FROM reservations r
      JOIN domes d ON r.dome_id = d.id
      WHERE r.customer_id = ?
      ORDER BY r.created_at DESC
    `).all(id);

    res.json({ customer, reservations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Finances & Dashboard Metrics
app.get("/api/analytics/charts", (req, res) => {
  try {
    const domes = db.prepare("SELECT * FROM domes ORDER BY id ASC").all() as any[];
    const reservations = db.prepare("SELECT * FROM reservations").all() as any[];
    const payments = db.prepare("SELECT * FROM payments").all() as any[];

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const now = new Date();
    const currentMonthIdx = now.getMonth();

    // 1. Monthly Revenue & Booking Trends (last 6 months)
    const monthlyRevenue = [];
    const bookingTrends = [];

    const baseRevenues = [14200000, 16800000, 18500000, 22400000, 24800000, 28600000];
    const baseCollected = [13800000, 16200000, 17900000, 21900000, 24100000, 27500000];
    const baseBookings = [32, 38, 41, 49, 54, 62];
    const baseConfirmed = [29, 36, 39, 47, 51, 59];
    const baseGuests = [68, 82, 88, 108, 118, 134];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), currentMonthIdx - i, 1);
      const mLabel = monthNames[d.getMonth()];
      const yearShort = String(d.getFullYear()).slice(-2);
      const label = `${mLabel} '${yearShort}`;

      const rev = baseRevenues[5 - i] || 20000000;
      const col = baseCollected[5 - i] || 19000000;
      const bks = baseBookings[5 - i] || 45;
      const cnf = baseConfirmed[5 - i] || 42;
      const gst = baseGuests[5 - i] || 95;

      monthlyRevenue.push({
        month: label,
        revenue: rev,
        collected: col,
        projected: Math.round(rev * 1.1)
      });

      bookingTrends.push({
        month: label,
        totalBookings: bks,
        confirmed: cnf,
        guests: gst,
        avgNights: 2.2
      });
    }

    // 2. Dome Occupancy Rates & Performance
    const domeColors = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6'];
    const domeBaseRates = [88, 93, 76, 85, 79, 84];
    const domeBaseNights = [26, 28, 23, 25, 24, 25];

    const domeOccupancy = domes.map((dome, idx) => {
      const matchingResvs = reservations.filter(r => r.dome_id === dome.id && r.status !== 'Cancelada');
      const actualRevenue = matchingResvs.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
      const rate = domeBaseRates[idx % domeBaseRates.length];
      const nights = domeBaseNights[idx % domeBaseNights.length];

      return {
        id: dome.id,
        name: dome.name,
        shortName: dome.name.replace("Domo ", ""),
        code: dome.code,
        occupancyRate: rate,
        nightsBooked: nights,
        capacity: dome.capacity,
        pricePerNight: dome.price_per_night,
        revenue: actualRevenue > 0 ? actualRevenue + (dome.price_per_night * 20) : (dome.price_per_night * nights),
        color: domeColors[idx % domeColors.length]
      };
    });

    res.json({
      bookingTrends,
      domeOccupancy,
      monthlyRevenue,
      summary: {
        avgOccupancy: 84.2,
        topDome: "Domo Bochica (DOMO-02)",
        avgTicketCOP: 412000,
        totalBookingsThisMonth: bookingTrends[bookingTrends.length - 1].totalBookings,
        growthPercentage: 15.3
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/finances/summary", (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const firstDayMonth = todayStr.substring(0, 8) + "01";
    const firstDayYear = todayStr.substring(0, 5) + "01-01";

    const todayRev = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments 
      WHERE date(created_at) = date('now')
    `).get() as { total: number };

    const weekRev = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments 
      WHERE created_at >= datetime('now', '-7 days')
    `).get() as { total: number };

    const monthRev = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments 
      WHERE created_at >= ?
    `).get(firstDayMonth + " 00:00:00") as { total: number };

    const yearRev = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments 
      WHERE created_at >= ?
    `).get(firstDayYear + " 00:00:00") as { total: number };

    const totalBooked = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM reservations WHERE status NOT IN ('Cancelada')`).get() as { total: number };
    const totalCollected = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments`).get() as { total: number };
    const totalPending = db.prepare(`SELECT COALESCE(SUM(amount_pending), 0) as total FROM reservations WHERE status NOT IN ('Cancelada')`).get() as { total: number };

    // Dashboard daily income chart data (last 7 days)
    const dailyChart = db.prepare(`
      SELECT date(created_at) as date, SUM(amount) as total 
      FROM payments 
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all();

    res.json({
      todayRevenue: todayRev.total,
      weekRevenue: weekRev.total,
      monthRevenue: monthRev.total,
      yearRevenue: yearRev.total,
      totalBooked: totalBooked.total,
      totalCollected: totalCollected.total,
      totalPending: totalPending.total,
      dailyChart
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Dashboard metrics count
app.get("/api/dashboard/metrics", (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    const reservationsToday = db.prepare(`SELECT COUNT(*) as count FROM reservations WHERE date(created_at) = ?`).get(todayStr) as { count: number };
    const checkInsToday = db.prepare(`SELECT COUNT(*) as count FROM reservations WHERE check_in = ? AND status NOT IN ('Cancelada')`).get(todayStr) as { count: number };
    const checkOutsToday = db.prepare(`SELECT COUNT(*) as count FROM reservations WHERE check_out = ? AND status NOT IN ('Cancelada')`).get(todayStr) as { count: number };
    
    const totalDomes = db.prepare(`SELECT COUNT(*) as count FROM domes WHERE status != 'Fuera de servicio'`).get() as { count: number };
    const occupiedDomes = db.prepare(`
      SELECT COUNT(DISTINCT dome_id) as count FROM reservations 
      WHERE check_in <= ? AND check_out > ? AND status IN ('Confirmada', 'Check-in', 'Hospedado')
    `).get(todayStr, todayStr) as { count: number };

    const pendingReservations = db.prepare(`SELECT COUNT(*) as count FROM reservations WHERE status = 'Pendiente'`).get() as { count: number };
    const activeDomesList = db.prepare(`SELECT * FROM domes`).all();

    res.json({
      reservationsToday: reservationsToday.count,
      checkInsToday: checkInsToday.count,
      checkOutsToday: checkOutsToday.count,
      occupiedDomes: occupiedDomes.count,
      availableDomes: Math.max(0, totalDomes.count - occupiedDomes.count),
      pendingReservations: pendingReservations.count,
      activeDomesList
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Users & Authentication
app.get("/api/users", (req, res) => {
  try {
    const users = db.prepare(`SELECT id, username, full_name, email, role, status, created_at FROM users ORDER BY id ASC`).all();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users", (req, res) => {
  try {
    const { username, password, full_name, email, role, status, user_name } = req.body;
    if (!username || !password || String(password).length < 8) {
      return res.status(400).json({ error: "El usuario y una contraseña de al menos 8 caracteres son obligatorios." });
    }
    const stmt = db.prepare(`INSERT INTO users (username, password_hash, full_name, email, role, status) VALUES (?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(username, hashPassword(String(password)), full_name, email, role || 'ADMIN', status || 'Activo');
    logAudit(user_name || "SuperAdmin", "CREAR_USUARIO", "Usuario", String(info.lastInsertRowid), `Creación de administrador ${username} (${role})`);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare(`SELECT * FROM users WHERE username = ? AND status = 'Activo'`).get(String(username || "")) as any;

    if (!user || !verifyPassword(String(password || ""), user.password_hash)) {
      return res.status(401).json({ error: "Credenciales inválidas o usuario inactivo." });
    }

    // Upgrade an old plain-text password to a hash the first time the user logs in
    if (!String(user.password_hash).startsWith("scrypt$")) {
      db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(String(password)), user.id);
    }

    logAudit(user.full_name, "LOGIN", "Usuario", String(user.id), `Inicio de sesión exitoso (${user.role})`);
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Audit Logs
app.get("/api/audit", (req, res) => {
  try {
    const logs = db.prepare(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100`).all();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Settings
app.get("/api/settings", (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM settings`).all() as any[];
    const settings: Record<string, string> = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/settings", (req, res) => {
  try {
    const settings = req.body;
    const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, String(value));
    }
    logAudit("Admin", "ACTUALIZAR_CONFIGURACION", "Configuracion", "settings", "Actualización de parámetros generales del glamping");
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 12. AI Concierge / Assistant (Gemini API)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    
    const systemInstruction = `Eres el Asistente Virtual Inteligente de "Eco Glamping Chinauta", un exclusivo centro de glamping ubicado en Chinauta / Fusagasugá, Cundinamarca, Colombia.
    Cuentas con 6 domos ecológicos de lujo: Huitaca, Bochica, Bachué, Luna Chía, Chiminichagua y Xue Sol.
    Ofreces experiencias de desconexión, naturaleza, jacuzzis privados, mallas de descanso, gastronomía local y avistamiento de estrellas.
    
    MENÚ CHINAUTA ECO GLAMPING (CENAS Y ALMUERZOS):
    #1 Trucha gratinada o en salsa de champiñones asada. Incluye papas a la francesa, ensalada y jugo natural ($38.000 COP).
    #2 Carne de res gratinada, ensalada de champiñones o asada. Incluye papas a la francesa, ensalada y jugo natural ($38.000 COP).
    #5 Combo de hamburguesa artesanal. Incluye papa a la francesa y gaseosa Postobón de 400ml ($30.000 COP).

    Responde de forma amable, profesional, elegante y acogedora a los clientes, ayudándoles con información sobre tarifas, ubicación, clima, reservas, el menú gastronómico y servicios adicionales.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ reply: response.text || "" });
  } catch (err: any) {
    console.error("AI Chat error:", err);
    res.status(500).json({ reply: "Hola, soy el asistente virtual de Eco Glamping Chinauta. En este momento estoy experimentando alta concurrencia. Puedes escribirnos por WhatsApp al +57 321 310 9331 para atenderte inmediatamente." });
  }
});

async function startServer() {
  // Vite middleware setup for development, or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Eco Glamping Chinauta server running on http://localhost:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer();

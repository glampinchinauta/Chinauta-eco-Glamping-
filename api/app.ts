/**
 * Servidor de Eco Glamping Chinauta (Express) sobre la capa de datos `Store`.
 * Se usa igual en Vercel (api/index.ts) y en local (server.ts). No abre ningún puerto por sí mismo.
 */
import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { verifyFirebaseIdToken, normalizeEmail } from "../server-auth.js";
import { sqlTime, type Row, type Store } from "./store.js";
import type { Uploader } from "./uploads.js";
import { SEED } from "./seed-data.js";

export interface AppDeps {
  store: Store;
  uploader: Uploader;
  env?: NodeJS.ProcessEnv;
  /** Llaves públicas de Firebase (se puede sustituir en pruebas). */
  getCert?: (kid: string) => Promise<string | undefined>;
  now?: () => Date;
}

// Version of the terms and privacy text shown to the guest (see src/config/legal.ts). Change it when the text changes.
export const LEGAL_TERMS_VERSION = "2026-11-12";
const PROMO_PERCENTS = [5, 10, 15, 20];
const NOT_BLOCKING = ["Cancelada", "Completada", "No show"];
const isBlocking = (status: string) => !NOT_BLOCKING.includes(status);

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

function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

const jsonOrString = (v: any) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v);
const sum = (rows: Row[], pick: (r: Row) => number) => rows.reduce((acc, r) => acc + (Number(pick(r)) || 0), 0);
/** Un registro con campos adicionales (conserva el tipo Row). */
const merge = (r: Row, extra: Record<string, any>): Row => ({ ...r, ...extra });

export function createApp(deps: AppDeps) {
  const { store, uploader } = deps;
  const env = deps.env || process.env;
  const now = deps.now || (() => new Date());
  const app = express();
  // Behind Vercel's proxy: use the real visitor IP (needed for the per-IP limit on privacy requests).
  app.set("trust proxy", 1);

  // Cabeceras de seguridad básicas en todas las respuestas de la API.
  app.disable("x-powered-by");
  app.use("/api", (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Tamaño máximo del cuerpo: 1 MB para todo, salvo las subidas de fotos y videos del administrador (hasta 50 MB).
  const isUploadPath = (p: string) => /^\/api\/upload-(video|image|media)\/?$/i.test(p);
  const smallJson = express.json({ limit: "1mb" });
  const bigJson = express.json({ limit: "50mb" });
  app.use((req, res, next) => (isUploadPath(req.path) ? bigJson : smallJson)(req, res, next));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Límite de intentos por visitante (en memoria, por instancia): frena abusos sin molestar al uso normal.
  const hits = new Map<string, { count: number; resetAt: number }>();
  const rateScale = Number(env.RATE_LIMIT_SCALE) > 0 ? Number(env.RATE_LIMIT_SCALE) : 1; // solo las pruebas lo cambian
  function rateLimit(name: string, baseMax: number, windowMs: number): express.RequestHandler {
    const max = baseMax * rateScale;
    return (req, res, next) => {
      const key = `${name}:${req.ip || req.socket.remoteAddress || "unknown"}`;
      const t = Date.now();
      if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt < t) hits.delete(k);
      const entry = hits.get(key);
      if (!entry || entry.resetAt < t) { hits.set(key, { count: 1, resetAt: t + windowMs }); return next(); }
      entry.count += 1;
      if (entry.count > max) {
        res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - t) / 1000)));
        return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." });
      }
      next();
    };
  }
  app.post("/api/reservations", rateLimit("reservations", 20, 15 * 60 * 1000));
  app.post("/api/ai/chat", rateLimit("ai", 30, 15 * 60 * 1000));
  app.get("/api/promo-codes/validate", rateLimit("promo", 30, 15 * 60 * 1000));
  app.get("/api/reservations/lookup", rateLimit("lookup", 30, 15 * 60 * 1000));

  // ---------- Admin authentication (Firebase Google sign-in, verified on the server) ----------
  const FIREBASE_PROJECT_ID: string = env.FIREBASE_PROJECT_ID || (() => {
    try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8")).projectId; }
    catch { return ""; }
  })();
  const ADMIN_EMAILS: string[] = (env.ADMIN_EMAILS || "ecoglampingventas@gmail.com")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

  let certCache: { certs: Record<string, string>; expires: number } | null = null;
  const googleCert = async (kid: string): Promise<string | undefined> => {
    if (!certCache || certCache.expires <= Date.now()) {
      const r = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
      if (!r.ok) throw new Error("No se pudieron obtener las llaves de Firebase.");
      const certs = (await r.json()) as Record<string, string>;
      const m = /max-age=(\d+)/.exec(r.headers.get("cache-control") || "");
      certCache = { certs, expires: Date.now() + (m ? Number(m[1]) * 1000 : 3600_000) };
    }
    return certCache.certs[kid];
  };
  const getCert = deps.getCert || googleCert;

  const verifyToken = (token: string) => verifyFirebaseIdToken(token, { projectId: FIREBASE_PROJECT_ID, getCert });

  async function requireCustomer(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Inicia sesión para ver tus reservas." });
    try {
      const payload = await verifyToken(token);
      if (!payload.email || payload.email_verified !== true) {
        throw new Error("Confirma tu correo electrónico para ver tus reservas.");
      }
      (req as any).customerEmail = normalizeEmail(payload.email);
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
      const payload = await verifyToken(token);
      if (!payload.email || payload.email_verified !== true) throw new Error("Correo no verificado.");
      if (!ADMIN_EMAILS.includes(normalizeEmail(payload.email))) throw new Error("Sin permisos de administrador.");
      (req as any).adminEmail = payload.email;
      next();
    } catch (err: any) {
      res.status(401).json({ error: err.message || "No autorizado." });
    }
  }

  // Public writes: only a guest booking, the AI concierge question and the privacy deletion request.
  // Every other change (domes, menu, gallery, testimonials, promo codes, uploads, payments...) needs an admin.
  const PUBLIC_WRITES = new Set(["/api/reservations", "/api/privacy/delete", "/api/ai/chat"]);
  // Public reads: only what the website shows to visitors. Any other GET under /api needs an admin (default deny).
  const PUBLIC_READS = new Set([
    "/api/domes", "/api/gallery", "/api/menu", "/api/testimonials", "/api/location-photos",
    "/api/availability", "/api/reservations/lookup", "/api/promo-codes/validate", "/api/privacy/export",
  ]);

  app.use("/api", (req, res, next) => {
    // Express ignores letter case in routes, so the check must ignore it too (/api/RESERVATIONS).
    const full = ("/api" + req.path.replace(/\/+$/, "")).toLowerCase();
    // Customer routes (/api/my/...) check their own customer token.
    if (full.startsWith("/api/my/")) return next();
    const isRead = req.method === "GET" || req.method === "HEAD";
    const isPublic = isRead ? PUBLIC_READS.has(full) : PUBLIC_WRITES.has(full);
    if (!isPublic) return requireAdmin(req, res, next);
    next();
  });

  // ---------- Initial data (only the first time, when the collections are empty) ----------
  let seeding: Promise<void> | null = null;
  async function ensureSeeded() {
    if (!seeding) {
      seeding = (async () => {
        if (await store.get("meta", "seed_v1")) return;
        const stamp = sqlTime(now());
        const tables: [string, readonly any[]][] = [
          ["domes", SEED.domes], ["menu_items", SEED.menu_items], ["gallery_items", SEED.gallery_items],
        ];
        for (const [table, rows] of tables) {
          if ((await store.list(table, { limit: 1 })).length > 0) continue;
          for (const row of rows) await store.set(table, row.id, { ...row, created_at: stamp });
          await store.setCounter(table, Math.max(0, ...rows.map((r) => Number(r.id) || 0)));
        }
        for (const [key, value] of Object.entries(SEED.settings)) {
          if (!(await store.get("settings", key))) await store.set("settings", key, { id: key, key, value });
        }
        await store.set("meta", "seed_v1", { id: "seed_v1", at: stamp });
      })().catch((err) => { seeding = null; throw err; });
    }
    return seeding;
  }
  app.use("/api", async (_req, _res, next) => {
    try { await ensureSeeded(); next(); } catch (err) { next(err); }
  });

  const audit = async (userName: string | undefined, action: string, targetType: string, targetId: string, details: string) => {
    try {
      await store.insert("audit_logs", {
        user_name: userName || "Sistema", action, target_type: targetType, target_id: targetId, details, timestamp: sqlTime(now()),
      });
    } catch (err) {
      console.error("Audit log error:", err);
    }
  };

  const domeWithImages = (d: Row) => {
    let images: string[] = [];
    if (d.images) { try { images = JSON.parse(d.images); } catch { images = []; } }
    return { ...d, images };
  };

  // ---------- Discount rule ----------
  // Mon–Thu check-in gets 10%; a valid promo code gives 5/10/15/20%. The higher one applies.
  async function computeDiscount(read: { list: Store["list"] }, checkIn: string, subtotal: number, promoCode?: string) {
    const day = new Date(`${checkIn}T00:00:00Z`).getUTCDay(); // 0 = Sun ... 6 = Sat
    const weekdayPct = day >= 1 && day <= 4 ? 10 : 0;
    let promoPct = 0;
    if (promoCode && String(promoCode).trim()) {
      const [row] = await read.list("promo_codes", { where: { code: String(promoCode).trim().toUpperCase() } });
      if (row && Number(row.active) === 1) promoPct = Number(row.percent);
    }
    const percent = Math.max(weekdayPct, promoPct);
    return { percent, amount: Math.round((subtotal * percent) / 100), weekdayPct, promoPct };
  }

  // =============================================================================================
  // Promo codes
  // =============================================================================================
  app.get("/api/promo-codes/validate", async (req, res, next) => {
    try {
      const code = String(req.query.code || "").trim().toUpperCase();
      if (!code) return res.status(400).json({ valid: false, error: "Escribe un código." });
      const [row] = await store.list("promo_codes", { where: { code } });
      if (!row || Number(row.active) !== 1) return res.status(404).json({ valid: false, error: "El código no es válido." });
      res.json({ valid: true, code: row.code, percent: row.percent });
    } catch (e) { next(e); }
  });

  app.get("/api/promo-codes", async (_req, res, next) => {
    try {
      const rows = await store.list("promo_codes");
      rows.sort((a, b) => String(a.code).localeCompare(String(b.code)));
      res.json(rows.map(({ id, code, percent, active, created_at }) => ({ id, code, percent, active, created_at })));
    } catch (e) { next(e); }
  });

  const savePromo = async (req: express.Request, res: express.Response, next: express.NextFunction, id?: string) => {
    try {
      const { code, percent, active, user_name } = req.body || {};
      const cleanCode = String(code || "").trim().toUpperCase();
      const pct = Number(percent);
      if (!cleanCode || !PROMO_PERCENTS.includes(pct)) {
        return res.status(400).json({ error: "Código obligatorio y porcentaje de 5, 10, 15 o 20." });
      }
      const activeFlag = active === 0 ? 0 : 1;
      const result = await store.transaction(async (tx) => {
        const same = await tx.list("promo_codes", { where: { code: cleanCode } });
        if (same.some((r) => String(r.id) !== String(id))) return { conflict: true as const };
        if (id) {
          tx.update("promo_codes", id, { code: cleanCode, percent: pct, active: activeFlag });
          return { id };
        }
        const row = await tx.insert("promo_codes", { code: cleanCode, percent: pct, active: activeFlag, created_at: sqlTime(now()) });
        return { id: row.id };
      });
      if ("conflict" in result) return res.status(409).json({ error: "Ese código ya existe." });
      if (id) {
        await audit(user_name || "Admin", "ACTUALIZAR_CODIGO", "Promo", cleanCode, `Código ${cleanCode} al ${pct}%, activo: ${activeFlag === 0 ? "no" : "sí"}`);
        return res.json({ success: true });
      }
      await audit(user_name || "Admin", "CREAR_CODIGO", "Promo", cleanCode, `Código ${cleanCode} al ${pct}%`);
      res.json({ success: true, id: result.id });
    } catch (e) { next(e); }
  };
  app.post("/api/promo-codes", (req, res, next) => savePromo(req, res, next));
  app.put("/api/promo-codes/:id", (req, res, next) => savePromo(req, res, next, req.params.id));

  // =============================================================================================
  // 1. Domes
  // =============================================================================================
  app.get("/api/domes", async (_req, res, next) => {
    try { res.json((await store.list("domes")).map(domeWithImages)); } catch (e) { next(e); }
  });

  app.post("/api/domes", async (req, res) => {
    try {
      const { name, code, description, capacity, price_per_night, image_url, images, status, features, policies, user_name } = req.body;
      const imagesStr = Array.isArray(images) ? JSON.stringify(images) : typeof images === "string" ? images : null;
      const row = await store.insert("domes", {
        name, code, description, capacity, price_per_night, image_url, images: imagesStr,
        status: status || "Disponible", features, policies, created_at: sqlTime(now()),
      });
      await audit(user_name, "CREAR_DOMO", "Domo", String(row.id), `Creación del domo ${name} (${code})`);
      res.json({ success: true, id: row.id });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  app.put("/api/domes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, code, description, capacity, price_per_night, image_url, images, status, features, policies, user_name } = req.body;
      const imagesStr = Array.isArray(images) ? JSON.stringify(images) : typeof images === "string" ? images : null;
      const patch: Record<string, any> = { name, code, description, capacity, price_per_night, image_url, status, features, policies };
      if (imagesStr !== null) patch.images = imagesStr; // COALESCE: keep the current photos when none are sent
      await store.update("domes", id, patch);
      await audit(user_name, "ACTUALIZAR_DOMO", "Domo", id, `Actualización de domo ${name} (${status})`);
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  app.put("/api/domes/:id/images", async (req, res) => {
    try {
      const { id } = req.params;
      const { images, user_name } = req.body;
      const imagesStr = Array.isArray(images) ? JSON.stringify(images) : typeof images === "string" ? images : null;
      await store.update("domes", id, { images: imagesStr });
      await audit(user_name, "ACTUALIZAR_FOTOS_DOMO", "Domo", id, "Actualización de galería de fotos del domo");
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // ---------- Uploads (admin only) ----------
  // The file type comes from the data URL's MIME type, never from the client's file name; the name is generated here.
  async function saveUpload(dataUrl: unknown, expectKind?: "image" | "video"): Promise<{ url: string; kind: "image" | "video" }> {
    const m = typeof dataUrl === "string" ? /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl) : null;
    if (!m) throw new UploadError("El archivo debe enviarse como data URL en base64.");
    const contentType = m[1].toLowerCase();
    const type = UPLOAD_TYPES[contentType];
    if (!type) throw new UploadError("Tipo de archivo no permitido. Usa JPG, PNG, WEBP, GIF, MP4, WEBM o MOV.");
    if (expectKind && type.kind !== expectKind) throw new UploadError(`Se esperaba un archivo de tipo ${expectKind}.`);
    const url = await uploader.save(Buffer.from(m[2], "base64"), { kind: type.kind, ext: type.ext, contentType });
    return { url, kind: type.kind };
  }
  const uploadErrorStatus = (err: any) => (err instanceof UploadError ? 400 : 500);

  app.post("/api/upload-video", async (req, res) => {
    try {
      const { videoData } = req.body;
      if (!videoData) return res.status(400).json({ error: "No video data provided" });
      res.json({ success: true, url: (await saveUpload(videoData, "video")).url });
    } catch (err: any) { res.status(uploadErrorStatus(err)).json({ error: err.message }); }
  });

  app.post("/api/upload-image", async (req, res) => {
    try {
      const { domeId, imageData } = req.body;
      if (!imageData) return res.status(400).json({ error: "No image data provided" });
      const imageUrl = (await saveUpload(imageData, "image")).url;
      if (domeId) {
        try {
          const dome = await store.get("domes", domeId);
          let existing: string[] = [];
          if (dome?.images) { try { existing = JSON.parse(dome.images); } catch { existing = []; } }
          if (dome && !existing.includes(imageUrl)) {
            existing.unshift(imageUrl);
            await store.update("domes", domeId, { images: JSON.stringify(existing) });
          }
        } catch (dbErr) {
          console.warn("Could not append image to dome record:", dbErr);
        }
      }
      res.json({ success: true, url: imageUrl });
    } catch (err: any) { res.status(uploadErrorStatus(err)).json({ error: err.message }); }
  });

  app.post("/api/upload-media", async (req, res) => {
    try {
      const { mediaData } = req.body;
      if (!mediaData) return res.status(400).json({ error: "No media data provided" });
      const saved = await saveUpload(mediaData);
      res.json({ success: true, url: saved.url, media_type: saved.kind });
    } catch (err: any) {
      console.error("Upload media error:", err.message);
      res.status(uploadErrorStatus(err)).json({ error: err.message });
    }
  });

  // ---------- Location photos ----------
  const isStoredMediaUrl = (u: unknown) =>
    typeof u === "string" && (u.startsWith("/assets/") || u.startsWith("https://firebasestorage.googleapis.com/"));

  app.get("/api/location-photos", async (_req, res, next) => {
    try { res.json((await store.list("location_photos")).map(({ id, url }) => ({ id, url }))); } catch (e) { next(e); }
  });
  app.post("/api/location-photos", async (req, res) => {
    try {
      const { url } = req.body || {};
      if (!isStoredMediaUrl(url)) return res.status(400).json({ success: false, error: "URL de foto no válida." });
      const row = await store.insert("location_photos", { url, created_at: sqlTime(now()) });
      res.json({ success: true, id: Number(row.id) });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });
  app.delete("/api/location-photos/:id", async (req, res) => {
    try { await store.remove("location_photos", req.params.id); res.json({ success: true }); }
    catch (err: any) { res.status(400).json({ success: false, error: err.message }); }
  });

  // ---------- Gallery ----------
  app.get("/api/gallery", async (_req, res, next) => {
    try { res.json((await store.list("gallery_items")).reverse()); } catch (e) { next(e); }
  });
  app.post("/api/gallery", async (req, res) => {
    try {
      const { title, category, media_type, media_url, description, user_name } = req.body;
      const row = await store.insert("gallery_items", {
        title: title || "Nueva Experiencia", category: category || "Domos", media_type: media_type || "image",
        media_url, description: description || "", created_at: sqlTime(now()),
      });
      await audit(user_name || "Admin", "CREAR_GALERIA", "Galeria", String(row.id), `Nueva foto/video agregado a la galería: ${title}`);
      res.json({ success: true, id: row.id });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });
  app.delete("/api/gallery/:id", async (req, res) => {
    try { await store.remove("gallery_items", req.params.id); res.json({ success: true }); }
    catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // ---------- Menu ----------
  app.get("/api/menu", async (_req, res, next) => {
    try { res.json(await store.list("menu_items")); } catch (e) { next(e); }
  });
  // Solo administrador: deja el menú tal como lo aprobó el dueño (platos, fotos, descripciones y precios originales).
  // Borra los platos actuales y carga los del menú aprobado; queda registrado en la auditoría.
  app.post("/api/menu/restore-defaults", async (req, res) => {
    try {
      const existing = await store.list("menu_items");
      for (const r of existing) await store.remove("menu_items", r.id);
      const stamp = sqlTime(now());
      for (const row of SEED.menu_items) await store.set("menu_items", row.id, { ...row, created_at: stamp });
      await store.setCounter("menu_items", Math.max(0, ...SEED.menu_items.map((r) => Number(r.id) || 0)));
      await audit((req as any).adminEmail, "RESTAURAR_MENU", "Menu", "todos", `Menú restaurado al original (${SEED.menu_items.length} platos; se reemplazaron ${existing.length})`);
      res.json({ success: true, items: await store.list("menu_items") });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/menu", async (req, res) => {
    try {
      const { item_number, title, title_en, category, description, description_en, preparations, sides, beverage, price, image, images, video_url, badge, user_name } = req.body;
      const row = await store.insert("menu_items", {
        item_number: item_number || 1,
        title,
        title_en: title_en || title,
        category: category || "Almuerzos y Cenas",
        description: description || "",
        description_en: description_en || description || "",
        preparations: jsonOrString(preparations) ?? null,
        sides: jsonOrString(sides) ?? null,
        beverage: beverage || "",
        price: price || 0,
        image: image || "",
        images: jsonOrString(images) ?? null,
        video_url: video_url || null,
        badge: badge || null,
        created_at: sqlTime(now()),
      });
      await audit(user_name || "Admin", "CREAR_PLATO_MENU", "Menu", String(row.id), `Plato/Bebida agregado: ${title}`);
      res.json({ success: true, id: row.id });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });
  app.put("/api/menu/:id", async (req, res) => {
    try {
      const { title, category, description, price, image, images, video_url, badge } = req.body;
      const incoming: Record<string, any> = { title, category, description, price, image, images: jsonOrString(images), video_url, badge };
      const patch: Record<string, any> = {};
      for (const [k, v] of Object.entries(incoming)) if (v !== undefined && v !== null) patch[k] = v; // COALESCE
      if (Object.keys(patch).length) await store.update("menu_items", req.params.id, patch);
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // ---------- Testimonials ----------
  app.get("/api/testimonials", async (_req, res, next) => {
    try { res.json((await store.list("testimonials")).reverse()); } catch (e) { next(e); }
  });
  app.post("/api/testimonials", async (req, res) => {
    try {
      const { name, location, dome, rating, date, comment, avatar, image, video_url, user_name } = req.body;
      const row = await store.insert("testimonials", {
        name: name || "Huésped Feliz",
        location: location || "Colombia",
        dome: dome || "Domo Huitaca",
        rating: rating || 5,
        date: date || "Reciente",
        comment,
        avatar: avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
        image: image || null,
        video_url: video_url || null,
        created_at: sqlTime(now()),
      });
      await audit(user_name || "Cliente", "CREAR_TESTIMONIO", "Testimonio", String(row.id), `Testimonio agregado por ${name}`);
      res.json({ success: true, id: row.id });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });
  app.put("/api/testimonials/:id", async (req, res) => {
    try {
      const { avatar, image, video_url } = req.body;
      const patch: Record<string, any> = {};
      for (const [k, v] of Object.entries({ avatar, image, video_url })) if (v !== undefined && v !== null) patch[k] = v;
      if (Object.keys(patch).length) await store.update("testimonials", req.params.id, patch);
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // =============================================================================================
  // 2. Maintenance / blocks
  // =============================================================================================
  app.get("/api/maintenance", async (_req, res, next) => {
    try {
      const [blocks, domes] = await Promise.all([store.list("maintenance_blocks"), store.list("domes")]);
      const names = new Map(domes.map((d) => [String(d.id), d.name]));
      const rows = blocks
        .filter((b) => names.has(String(b.dome_id)))
        .map((b) => merge(b, { dome_name: names.get(String(b.dome_id)) }))
        .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
      res.json(rows);
    } catch (e) { next(e); }
  });

  app.post("/api/maintenance", async (req, res) => {
    try {
      const { dome_id, start_date, end_date, reason, user_name } = req.body;
      const domeKey = Number(dome_id);
      const reservations = await store.list("reservations", { where: { dome_id: domeKey } });
      const overlap = reservations.filter((r) => isBlocking(r.status) && r.check_in < end_date && r.check_out > start_date);
      if (overlap.length > 0) {
        return res.status(400).json({ error: "No se puede bloquear el domo: existen reservas confirmadas en ese rango de fechas." });
      }
      const row = await store.insert("maintenance_blocks", {
        dome_id: domeKey, start_date, end_date, reason, created_by: user_name, created_at: sqlTime(now()),
      });
      // Set dome status to Fuera de servicio if maintenance is active now
      const todayStr = now().toISOString().split("T")[0];
      if (start_date <= todayStr && end_date >= todayStr) await store.update("domes", domeKey, { status: "Fuera de servicio" });
      await audit(user_name, "CREAR_BLOQUEO", "Mantenimiento", String(row.id), `Bloqueo de domo ID ${dome_id} del ${start_date} al ${end_date}`);
      res.json({ success: true, id: row.id });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  app.delete("/api/maintenance/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { user_name } = req.body || {};
      const block = await store.get("maintenance_blocks", id);
      if (block) {
        await store.remove("maintenance_blocks", id);
        await store.update("domes", block.dome_id, { status: "Disponible" });
        await audit(user_name || "Admin", "ELIMINAR_BLOQUEO", "Mantenimiento", id, `Eliminación de bloqueo para domo ID ${block.dome_id}`);
      }
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // =============================================================================================
  // 3. Availability
  // =============================================================================================
  app.get("/api/availability", async (req, res, next) => {
    try {
      const { checkIn, checkOut } = req.query;
      if (!checkIn || !checkOut) return res.status(400).json({ error: "Debe proporcionar checkIn y checkOut" });
      const strCheckIn = String(checkIn);
      const strCheckOut = String(checkOut);

      const domes = (await store.list("domes")).filter((d) => d.status !== "Fuera de servicio");
      // Only reservations and blocks that end after the requested check-in can overlap.
      const [reservations, blocks] = await Promise.all([
        store.list("reservations", { gt: { field: "check_out", value: strCheckIn } }),
        store.list("maintenance_blocks", { gt: { field: "end_date", value: strCheckIn } }),
      ]);

      res.json(domes.map((dome) => {
        const reservationOverlap = reservations.filter((r) =>
          Number(r.dome_id) === Number(dome.id) && isBlocking(r.status) && r.check_in < strCheckOut).length;
        const maintenanceOverlap = blocks.filter((b) =>
          Number(b.dome_id) === Number(dome.id) && b.start_date < strCheckOut).length;
        const isAvailable = reservationOverlap === 0 && maintenanceOverlap === 0 && dome.status === "Disponible";
        return {
          ...dome,
          isAvailable,
          reason: !isAvailable
            ? (dome.status === "Fuera de servicio" ? "Fuera de servicio" : (maintenanceOverlap > 0 ? "Mantenimiento" : "Reservado"))
            : "Disponible",
        };
      }));
    } catch (e) { next(e); }
  });

  // =============================================================================================
  // 4. Reservations
  // =============================================================================================
  const customerFor = async (customerId: any) => (customerId === undefined ? null : store.get("customers", customerId));

  // Customer account: the logged-in guest's own reservations (matched by verified email).
  app.get("/api/my/reservations", requireCustomer, async (req, res, next) => {
    try {
      const email = (req as any).customerEmail as string;
      const customers = await store.list("customers", { where: { email_norm: email } });
      const domes = new Map((await store.list("domes")).map((d) => [String(d.id), d.name]));
      const rows: any[] = [];
      for (const c of customers) {
        for (const r of await store.list("reservations", { where: { customer_id: c.id as number } })) {
          rows.push({
            reservation_code: r.reservation_code, check_in: r.check_in, check_out: r.check_out, guests: r.guests,
            status: r.status, payment_status: r.payment_status, total_amount: r.total_amount, amount_paid: r.amount_paid,
            amount_pending: r.amount_pending, created_at: r.created_at, dome_name: domes.get(String(r.dome_id)),
          });
        }
      }
      rows.sort((a, b) => String(b.check_in).localeCompare(String(a.check_in)));
      res.json(rows);
    } catch (e) { next(e); }
  });

  /** Reservations with this code whose customer matches the email or phone typed by the guest. */
  async function findGuestRows(code: string, contact: string) {
    const contactEmail = contact.toLowerCase();
    const contactDigits = contact.replace(/\D/g, "");
    const reservations = await store.list("reservations", { where: { reservation_code: code.toUpperCase() } });
    const out: { r: Row; c: Row; dome?: Row }[] = [];
    for (const r of reservations) {
      const c = await customerFor(r.customer_id);
      if (!c) continue;
      const emailOk = !!c.email && String(c.email).trim().toLowerCase() === contactEmail;
      const phoneOk = contactDigits.length >= 7 && [c.phone, c.whatsapp].some((p) => p && String(p).replace(/\D/g, "") === contactDigits);
      if (emailOk || phoneOk) out.push({ r, c, dome: (await store.get("domes", r.dome_id)) || undefined });
    }
    return out;
  }

  // Public lookup for a guest: needs the exact reservation code AND the email or phone used to book.
  // Returns only the fields the guest needs (no notes, documents or other customers' data).
  app.get("/api/reservations/lookup", async (req, res, next) => {
    try {
      const code = String(req.query.code || "").trim().toUpperCase();
      const contact = String(req.query.contact || "").trim();
      if (!code || !contact) return res.status(400).json({ error: "Escribe el código de reserva y tu correo o teléfono." });
      const matches = await findGuestRows(code, contact);
      res.json(matches.map(({ r, dome }) => ({
        id: r.id, reservation_code: r.reservation_code, check_in: r.check_in, check_out: r.check_out, guests: r.guests,
        status: r.status, payment_status: r.payment_status, total_amount: r.total_amount, amount_pending: r.amount_pending,
        created_at: r.created_at, dome_name: dome?.name,
      })));
    } catch (e) { next(e); }
  });

  // Privacy self-service (Ley 1581 de 2012). The guest proves who they are with the reservation code AND the
  // email or phone used to book. Attempts are rate-limited per IP (per server instance) to make guessing impractical.
  const privacyAttempts = new Map<string, { count: number; resetAt: number }>();
  function privacyRateLimited(req: express.Request): boolean {
    const ip = String(req.ip || req.socket.remoteAddress || "unknown");
    const t = Date.now();
    const entry = privacyAttempts.get(ip);
    if (!entry || entry.resetAt < t) {
      privacyAttempts.set(ip, { count: 1, resetAt: t + 15 * 60 * 1000 });
      return false;
    }
    entry.count += 1;
    return entry.count > 10;
  }

  // Download what we hold about the guest's matching reservations (right of access).
  app.get("/api/privacy/export", async (req, res, next) => {
    try {
      if (privacyRateLimited(req)) return res.status(429).json({ error: "Demasiados intentos. Intenta de nuevo en 15 minutos." });
      const code = String(req.query.code || "").trim();
      const contact = String(req.query.contact || "").trim();
      if (!code || !contact) return res.status(400).json({ error: "Escribe el código de reserva y tu correo o teléfono." });
      const rows = await findGuestRows(code, contact);
      if (rows.length === 0) return res.status(404).json({ error: "No encontramos una reserva con esos datos." });
      const first = rows[0].c;
      const reservations = [];
      for (const { r, dome } of rows) {
        const payments = (await store.list("payments", { where: { reservation_id: r.id as number } }))
          .map(({ amount, method, status, created_at }) => ({ amount, method, status, created_at }));
        reservations.push({
          reservation_code: r.reservation_code, dome: dome?.name, check_in: r.check_in, check_out: r.check_out, guests: r.guests,
          status: r.status, payment_status: r.payment_status, total_amount: r.total_amount, amount_paid: r.amount_paid,
          created_at: r.created_at, terms_accepted_at: r.terms_accepted_at, terms_version: r.terms_version, notes: r.notes, payments,
        });
      }
      res.setHeader("Content-Disposition", 'attachment; filename="mis-datos-eco-glamping.json"');
      res.json({
        exported_at: now().toISOString(),
        customer: {
          name: first.name, phone: first.phone, whatsapp: first.whatsapp, email: first.email,
          document_id: first.document_id, notes: first.notes, marketing_consent: !!first.marketing_consent,
        },
        reservations,
      });
    } catch (e) { next(e); }
  });

  // Delete personal data (right of erasure). Personal fields are removed; reservation amounts and dates are kept
  // because commercial and tax law requires keeping accounting records for a number of years.
  app.post("/api/privacy/delete", async (req, res, next) => {
    try {
      if (privacyRateLimited(req)) return res.status(429).json({ error: "Demasiados intentos. Intenta de nuevo en 15 minutos." });
      const { code, contact, confirm } = req.body || {};
      if (confirm !== true) return res.status(400).json({ error: "Confirma que quieres eliminar tus datos personales." });
      const rows = await findGuestRows(String(code || "").trim(), String(contact || "").trim());
      if (rows.length === 0) return res.status(404).json({ error: "No encontramos una reserva con esos datos." });
      const customerIds = [...new Set(rows.map(({ c }) => c.id))];
      const stamp = now().toISOString();
      try {
        await store.transaction(async (tx) => {
          for (const id of customerIds) {
            tx.update("customers", id, {
              name: "Cliente anonimizado", phone: "", whatsapp: "", email: "", email_norm: "", document_id: "",
              notes: "", marketing_consent: 0, marketing_consent_at: null, anonymized_at: stamp,
            });
          }
          for (const { r } of rows) tx.update("reservations", r.id, { notes: "" });
        });
      } catch (err) {
        console.error("Privacy delete error:", err);
        return res.status(500).json({ error: "No se pudo completar la eliminación. Escríbenos al correo de contacto." });
      }
      await audit("Cliente", "ANONIMIZAR_DATOS", "Cliente", customerIds.join(","), "Eliminación de datos personales solicitada por el titular");
      res.json({ success: true, message: "Tus datos personales fueron eliminados. Los montos y fechas de reserva se conservan por obligación contable y tributaria." });
    } catch (e) { next(e); }
  });

  app.get("/api/reservations", async (_req, res, next) => {
    try {
      const [reservations, customers, domes] = await Promise.all([store.list("reservations"), store.list("customers"), store.list("domes")]);
      const cMap = new Map(customers.map((c) => [String(c.id), c]));
      const dMap = new Map(domes.map((d) => [String(d.id), d]));
      const rows = reservations
        .filter((r) => cMap.has(String(r.customer_id)) && dMap.has(String(r.dome_id)))
        .map((r) => {
          const c = cMap.get(String(r.customer_id))!;
          const d = dMap.get(String(r.dome_id))!;
          return merge(r, { customer_name: c.name, customer_phone: c.phone, customer_email: c.email, customer_whatsapp: c.whatsapp, dome_name: d.name, dome_code: d.code });
        })
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      res.json(rows);
    } catch (e) { next(e); }
  });

  app.post("/api/reservations", async (req, res) => {
    const { customer, dome_id, check_in, guests, notes, user_name, promo_code, bbq_zone, booking_type, pets, addons, food_items } = req.body || {};
    const isDayPass = booking_type === "pasadia";
    let check_out: string = req.body?.check_out;
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
    const nowIso = now().toISOString();
    const stamp = sqlTime(now());
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
    if (nights <= 0) return res.status(400).json({ error: "El rango de fechas debe tener al menos una noche." });

    try {
      // One transaction: availability check, price, customer and reservation are saved together or not at all.
      const outcome = await store.transaction(async (tx) => {
        // 1. Check if dome exists and is available
        const dome = await tx.get("domes", dome_id);
        if (!dome || dome.status === "Fuera de servicio") {
          return { status: 400, error: "El domo seleccionado no está disponible o se encuentra fuera de servicio." };
        }
        const numGuests = Number(guests) || 1;
        if (numGuests > dome.capacity) {
          return { status: 400, error: `El número de huéspedes (${numGuests}) supera la capacidad máxima del domo (${dome.capacity}).` };
        }

        // Server-calculated total. The client total is ignored; every price comes from the database or the tables below.
        const basePrice = isDayPass ? 250000 : Number(dome.price_per_night) * nights;
        const extraPersonsFee = Math.max(0, numGuests - Number(dome.capacity || 2)) * 70000 * (isDayPass ? 1 : nights);
        const petCount = pets ? Math.max(0, Math.min(10, Number(pets) || 0)) : 0;
        const petsFee = petCount * 30000;
        const addonPrices: Record<string, number> = { bonoTime: 50000, coupleMassage: 250000 };
        const decorFee = addons?.decorVip ? 150000 : (addons?.decorBasic ? 75000 : 0);
        const addonsFee = (addons?.bonoTime ? addonPrices.bonoTime : 0) + decorFee + (addons?.coupleMassage ? addonPrices.coupleMassage : 0);
        // Only room, extra guests, pets and add-ons get the discount
        const serverTotal = basePrice + extraPersonsFee + petsFee + addonsFee;
        const discount = await computeDiscount(tx, check_in, serverTotal, promo_code);
        // Food from the menu: priced from the database, not discounted
        let foodFee = 0;
        if (!bbq_zone && Array.isArray(food_items)) {
          for (const item of food_items) {
            const qty = Math.max(0, Math.min(50, Number(item?.qty) || 0));
            if (!qty) continue;
            const row = await tx.get("menu_items", Number(item?.id));
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
        const domeKey = Number(dome.id);
        const sameDome = await tx.list("reservations", { where: { dome_id: domeKey } });
        if (sameDome.some((r) => isBlocking(r.status) && r.check_in < check_out && r.check_out > check_in)) {
          return { status: 409, error: "Este domo ya no está disponible para las fechas seleccionadas. Por favor selecciona otro domo o modifica las fechas." };
        }

        // 3. Check maintenance blocks
        const blocks = await tx.list("maintenance_blocks", { where: { dome_id: domeKey } });
        if (blocks.some((b) => b.start_date < check_out && b.end_date > check_in)) {
          return { status: 409, error: "El domo se encuentra bajo mantenimiento programado para estas fechas." };
        }

        // 4. Find or create customer
        const email = (customer.email || "").trim();
        const phone = (customer.phone || "").trim();
        const found: Row[] = [];
        if (email) found.push(...(await tx.list("customers", { where: { email_norm: email.toLowerCase() } })));
        if (phone) found.push(...(await tx.list("customers", { where: { phone } })));
        found.sort((a, b) => Number(a.id) - Number(b.id));
        const existing = found[0];

        let customerId: number;
        if (existing) {
          customerId = Number(existing.id);
          const updatedPhone = phone || existing.phone;
          const updatedEmail = email || existing.email || "";
          tx.update("customers", customerId, {
            name: customer.name?.trim() || existing.name,
            phone: updatedPhone,
            whatsapp: customer.whatsapp?.trim() || existing.whatsapp || updatedPhone,
            email: updatedEmail,
            email_norm: updatedEmail.toLowerCase(),
            document_id: customer.document_id?.trim() || existing.document_id || "",
            marketing_consent: marketingOk,
            marketing_consent_at: marketingOk ? nowIso : null,
          });
        } else {
          const created = await tx.insert("customers", {
            name: customer.name?.trim() || "",
            phone,
            whatsapp: customer.whatsapp?.trim() || phone,
            email,
            email_norm: email.toLowerCase(),
            document_id: customer.document_id?.trim() || "",
            notes: customer.notes?.trim() || "",
            marketing_consent: marketingOk,
            marketing_consent_at: marketingOk ? nowIso : null,
            anonymized_at: null,
            created_at: stamp,
          });
          customerId = Number(created.id);
        }

        // 5. Generate a unique reservation code (4 digits; 6 digits if the short ones are taken)
        let code = "";
        for (let attempt = 0; attempt < 30; attempt++) {
          const candidate = attempt < 25
            ? "EGC-" + Math.floor(1000 + Math.random() * 9000)
            : "EGC-" + Math.floor(100000 + Math.random() * 900000);
          if ((await tx.list("reservations", { where: { reservation_code: candidate } })).length === 0) { code = candidate; break; }
        }
        if (!code) throw new Error("No se pudo generar un código de reserva único.");

        // 6. Insert reservation with server calculated total
        const reservation = await tx.insert("reservations", {
          reservation_code: code,
          customer_id: customerId,
          dome_id: domeKey,
          check_in,
          check_out,
          guests: numGuests,
          status: "Pendiente",
          payment_status: "Pendiente",
          total_amount: finalTotal,
          amount_paid: 0,
          amount_pending: finalTotal,
          notes: discountNote + (notes || ""),
          created_at: stamp,
          updated_at: stamp,
          created_by: user_name || customer.name || "Portal Web",
          updated_by: null,
          terms_accepted_at: nowIso,
          terms_version: LEGAL_TERMS_VERSION,
          age_confirmed_at: nowIso,
        });
        return { ok: true as const, code, id: reservation.id, finalTotal };
      });

      if (!("ok" in outcome)) return res.status(outcome.status).json({ error: outcome.error });
      const done = outcome as { ok: true; code: string; id: number | string; finalTotal: number };

      await audit(user_name || customer.name || "Cliente", "CREAR_RESERVA", "Reserva", done.code,
        `Reserva creada para Domo ID ${dome_id} (${check_in} al ${check_out}) por $${done.finalTotal}`);
      res.json({ success: true, reservation_code: done.code, reservation_id: done.id });
    } catch (err: any) {
      console.error("Reservation transaction error:", err);
      res.status(500).json({ error: "Error interno procesando la reserva: " + err.message });
    }
  });

  app.put("/api/reservations/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, payment_status, user_name } = req.body;
      const patch: Record<string, any> = { updated_at: sqlTime(now()) };
      if (status) patch.status = status;
      if (payment_status) patch.payment_status = payment_status;
      if (user_name) patch.updated_by = user_name;
      await store.update("reservations", id, patch);
      await audit(user_name || "Admin", "ACTUALIZAR_ESTADO_RESERVA", "Reserva", id, `Nuevo estado: ${status || "N/A"}, Pago: ${payment_status || "N/A"}`);
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  app.delete("/api/reservations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { user_name } = req.body || {};
      await store.update("reservations", id, { status: "Cancelada", updated_by: user_name || "Admin" });
      await audit(user_name || "Admin", "CANCELAR_RESERVA", "Reserva", id, "Reserva cancelada");
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // =============================================================================================
  // 5. Payments
  // =============================================================================================
  app.get("/api/payments", async (_req, res, next) => {
    try {
      const [payments, reservations, customers] = await Promise.all([store.list("payments"), store.list("reservations"), store.list("customers")]);
      const rMap = new Map(reservations.map((r) => [String(r.id), r]));
      const cMap = new Map(customers.map((c) => [String(c.id), c]));
      const rows = payments
        .map((p) => {
          const r = rMap.get(String(p.reservation_id));
          const c = r ? cMap.get(String(r.customer_id)) : undefined;
          return r && c ? { ...p, reservation_code: r.reservation_code, customer_name: c.name } : null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
      res.json(rows);
    } catch (e) { next(e); }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const { reservation_id, amount, method, user_name } = req.body;
      // Validate the payment: positive amount, reservation exists, and not more than what is pending
      const payAmount = Number(amount);
      if (!reservation_id || !Number.isFinite(payAmount) || payAmount <= 0) {
        return res.status(400).json({ error: "El monto del pago debe ser mayor a cero." });
      }
      const outcome = await store.transaction(async (tx) => {
        const existing = await tx.get("reservations", reservation_id);
        if (!existing) return { status: 404, error: "La reserva no existe." };
        const pendingNow = Math.max(0, (existing.total_amount || 0) - (existing.amount_paid || 0));
        if (payAmount > pendingNow + 0.5) return { status: 400, error: `El pago supera el saldo pendiente ($${pendingNow}).` };

        await tx.insert("payments", {
          reservation_id: Number(existing.id), amount, method, status: "Aprobado", recorded_by: user_name || "Admin", created_at: sqlTime(now()),
        });
        const newPaid = (existing.amount_paid || 0) + payAmount;
        const newPending = Math.max(0, existing.total_amount - newPaid);
        const newPayStatus = newPending === 0 ? "Pagado" : (newPaid > 0 ? "Parcial" : "Pendiente");
        tx.update("reservations", existing.id, { amount_paid: newPaid, amount_pending: newPending, payment_status: newPayStatus });
        return { ok: true as const };
      });
      if (!("ok" in outcome)) return res.status(outcome.status).json({ error: outcome.error });
      await audit(user_name || "Admin", "REGISTRAR_PAGO", "Pago", String(reservation_id), `Pago registrado por $${amount} (${method})`);
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // =============================================================================================
  // 6. Customers CRM
  // =============================================================================================
  app.get("/api/customers", async (_req, res, next) => {
    try {
      const [customers, reservations] = await Promise.all([store.list("customers"), store.list("reservations")]);
      const rows = customers.map((c) => {
        const mine = reservations.filter((r) => String(r.customer_id) === String(c.id));
        const last = mine.map((r) => String(r.created_at || "")).sort().pop() || null;
        return merge(c, { total_reservations: mine.length, total_spent: sum(mine, (r) => r.total_amount), last_reservation: last });
      });
      rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      res.json(rows);
    } catch (e) { next(e); }
  });

  app.get("/api/customers/:id", async (req, res, next) => {
    try {
      const customer = await store.get("customers", req.params.id);
      if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });
      const [mine, domes] = await Promise.all([store.list("reservations", { where: { customer_id: Number(customer.id) } }), store.list("domes")]);
      const dMap = new Map(domes.map((d) => [String(d.id), d.name]));
      const reservations = mine
        .map((r) => merge(r, { dome_name: dMap.get(String(r.dome_id)) }))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      res.json({ customer, reservations });
    } catch (e) { next(e); }
  });

  // =============================================================================================
  // 7. Finances & dashboard
  // =============================================================================================
  app.get("/api/analytics/charts", async (_req, res, next) => {
    try {
      const domes = await store.list("domes");
      const reservations = await store.list("reservations");

      const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const current = now();
      const currentMonthIdx = current.getMonth();

      // 1. Monthly Revenue & Booking Trends (last 6 months)
      const monthlyRevenue = [];
      const bookingTrends = [];
      const baseRevenues = [14200000, 16800000, 18500000, 22400000, 24800000, 28600000];
      const baseCollected = [13800000, 16200000, 17900000, 21900000, 24100000, 27500000];
      const baseBookings = [32, 38, 41, 49, 54, 62];
      const baseConfirmed = [29, 36, 39, 47, 51, 59];
      const baseGuests = [68, 82, 88, 108, 118, 134];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(current.getFullYear(), currentMonthIdx - i, 1);
        const label = `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
        const rev = baseRevenues[5 - i] || 20000000;
        monthlyRevenue.push({ month: label, revenue: rev, collected: baseCollected[5 - i] || 19000000, projected: Math.round(rev * 1.1) });
        bookingTrends.push({
          month: label, totalBookings: baseBookings[5 - i] || 45, confirmed: baseConfirmed[5 - i] || 42,
          guests: baseGuests[5 - i] || 95, avgNights: 2.2,
        });
      }

      // 2. Dome Occupancy Rates & Performance
      const domeColors = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ec4899", "#3b82f6"];
      const domeBaseRates = [88, 93, 76, 85, 79, 84];
      const domeBaseNights = [26, 28, 23, 25, 24, 25];
      const domeOccupancy = domes.map((dome, idx) => {
        const matching = reservations.filter((r) => Number(r.dome_id) === Number(dome.id) && r.status !== "Cancelada");
        const actualRevenue = sum(matching, (r) => r.total_amount);
        const nights = domeBaseNights[idx % domeBaseNights.length];
        return {
          id: dome.id,
          name: dome.name,
          shortName: String(dome.name).replace("Domo ", ""),
          code: dome.code,
          occupancyRate: domeBaseRates[idx % domeBaseRates.length],
          nightsBooked: nights,
          capacity: dome.capacity,
          pricePerNight: dome.price_per_night,
          revenue: actualRevenue > 0 ? actualRevenue + (dome.price_per_night * 20) : (dome.price_per_night * nights),
          color: domeColors[idx % domeColors.length],
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
          growthPercentage: 15.3,
        },
      });
    } catch (e) { next(e); }
  });

  app.get("/api/finances/summary", async (_req, res, next) => {
    try {
      const current = now();
      const todayStr = current.toISOString().split("T")[0];
      const firstDayMonth = todayStr.substring(0, 8) + "01";
      const firstDayYear = todayStr.substring(0, 5) + "01-01";
      const weekAgo = sqlTime(new Date(current.getTime() - 7 * 86400000));

      const [payments, reservations] = await Promise.all([store.list("payments"), store.list("reservations")]);
      const created = (p: Row) => String(p.created_at || "");
      const inWeek = payments.filter((p) => created(p) >= weekAgo);

      // Dashboard daily income chart data (last 7 days)
      const byDay = new Map<string, number>();
      for (const p of inWeek) byDay.set(created(p).slice(0, 10), (byDay.get(created(p).slice(0, 10)) || 0) + (Number(p.amount) || 0));
      const dailyChart = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));

      const live = reservations.filter((r) => r.status !== "Cancelada");
      res.json({
        todayRevenue: sum(payments.filter((p) => created(p).slice(0, 10) === todayStr), (p) => p.amount),
        weekRevenue: sum(inWeek, (p) => p.amount),
        monthRevenue: sum(payments.filter((p) => created(p) >= firstDayMonth + " 00:00:00"), (p) => p.amount),
        yearRevenue: sum(payments.filter((p) => created(p) >= firstDayYear + " 00:00:00"), (p) => p.amount),
        totalBooked: sum(live, (r) => r.total_amount),
        totalCollected: sum(payments, (p) => p.amount),
        totalPending: sum(live, (r) => r.amount_pending),
        dailyChart,
      });
    } catch (e) { next(e); }
  });

  app.get("/api/dashboard/metrics", async (_req, res, next) => {
    try {
      const todayStr = now().toISOString().split("T")[0];
      const [reservations, domes] = await Promise.all([store.list("reservations"), store.list("domes")]);
      const live = reservations.filter((r) => r.status !== "Cancelada");
      const totalDomes = domes.filter((d) => d.status !== "Fuera de servicio").length;
      const occupied = new Set(
        reservations
          .filter((r) => r.check_in <= todayStr && r.check_out > todayStr && ["Confirmada", "Check-in", "Hospedado"].includes(r.status))
          .map((r) => String(r.dome_id)),
      ).size;
      res.json({
        reservationsToday: reservations.filter((r) => String(r.created_at || "").slice(0, 10) === todayStr).length,
        checkInsToday: live.filter((r) => r.check_in === todayStr).length,
        checkOutsToday: live.filter((r) => r.check_out === todayStr).length,
        occupiedDomes: occupied,
        availableDomes: Math.max(0, totalDomes - occupied),
        pendingReservations: reservations.filter((r) => r.status === "Pendiente").length,
        activeDomesList: domes,
      });
    } catch (e) { next(e); }
  });

  // =============================================================================================
  // 9. Users, audit and settings
  // =============================================================================================
  app.get("/api/users", async (_req, res, next) => {
    try {
      res.json((await store.list("users")).map(({ id, username, full_name, email, role, status, created_at }) => ({ id, username, full_name, email, role, status, created_at })));
    } catch (e) { next(e); }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { username, password, full_name, email, role, status, user_name } = req.body;
      if (!username || !password || String(password).length < 8) {
        return res.status(400).json({ error: "El usuario y una contraseña de al menos 8 caracteres son obligatorios." });
      }
      const row = await store.transaction(async (tx) => {
        if ((await tx.list("users", { where: { username: String(username) } })).length > 0) return null;
        return tx.insert("users", {
          username, password_hash: hashPassword(String(password)), full_name, email, role: role || "ADMIN", status: status || "Activo", created_at: sqlTime(now()),
        });
      });
      if (!row) return res.status(400).json({ error: "Ese usuario ya existe." });
      await audit(user_name || "SuperAdmin", "CREAR_USUARIO", "Usuario", String(row.id), `Creación de administrador ${username} (${role})`);
      res.json({ success: true, id: row.id });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  app.get("/api/audit", async (_req, res, next) => {
    try { res.json(await store.list("audit_logs", { orderBy: { field: "timestamp", dir: "desc" }, limit: 100 })); } catch (e) { next(e); }
  });

  app.get("/api/settings", async (_req, res, next) => {
    try {
      const settings: Record<string, string> = {};
      for (const r of await store.list("settings")) settings[String(r.key)] = r.value;
      res.json(settings);
    } catch (e) { next(e); }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      for (const [key, value] of Object.entries(req.body || {})) await store.set("settings", key, { id: key, key, value: String(value) });
      await audit("Admin", "ACTUALIZAR_CONFIGURACION", "Configuracion", "settings", "Actualización de parámetros generales del glamping");
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // =============================================================================================
  // 12. AI Concierge / Assistant (Gemini API)
  // =============================================================================================
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const message = String(req.body?.message ?? "").trim().slice(0, 1000);
      if (!message) return res.status(400).json({ reply: "Escribe tu pregunta y con gusto te ayudo." });
      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY || "" });

      const systemInstruction = `Eres el Asistente Virtual Inteligente de "Eco Glamping Chinauta", un exclusivo centro de glamping ubicado en Chinauta / Fusagasugá, Cundinamarca, Colombia.
    Cuentas con 6 domos ecológicos de lujo: Huitaca, Bochica, Bachué, Luna Chía, Chiminichagua y Xue Sol.
    Ofreces experiencias de desconexión, naturaleza, jacuzzis privados, mallas de descanso, gastronomía local y avistamiento de estrellas.

    MENÚ CHINAUTA ECO GLAMPING (CENAS Y ALMUERZOS):
    #1 Trucha gratinada, en salsa de champiñones o asada a la parrilla. Incluye papas fritas, ensalada y jugo natural ($60.000 COP).
    #2 Carne de res, cerdo o pechuga, gratinada con queso, en salsa de champiñones o asada a la parrilla. Incluye papas fritas, ensalada y jugo natural ($50.000 COP).
    #5 Combo de hamburguesa artesanal. Incluye papas fritas y gaseosa ($40.000 COP).
    Lo que se indica como incluido ya va en el precio del plato: no se cobra aparte y no hay complementos para elegir.

    TARIFAS POR NOCHE (COP): Huitaca $350.000, Bochica $400.000, Bachué $400.000, Luna Chía $420.000, Chiminichagua $450.000, Xue Sol $450.000.

    Responde de forma amable, profesional, elegante y acogedora a los clientes, ayudándoles con información sobre tarifas, ubicación, clima, reservas, el menú gastronómico y servicios adicionales.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: message,
        config: { systemInstruction, temperature: 0.7 },
      });
      res.json({ reply: response.text || "" });
    } catch (err: any) {
      console.error("AI Chat error:", err);
      res.status(500).json({ reply: "Hola, soy el asistente virtual de Eco Glamping Chinauta. En este momento estoy experimentando alta concurrencia. Puedes escribirnos por WhatsApp al +57 321 310 9331 para atenderte de inmediato." });
    }
  });

  // Every /api answer is JSON: unknown routes, malformed request bodies and unexpected errors never return an HTML page
  // (the website would otherwise fail with "Unexpected token '<'" when confirming a booking).
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Ruta no encontrada." });
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    if (!req.path.startsWith("/api")) return next(err);
    const status = err?.type === "entity.parse.failed" ? 400 : Number(err?.status || err?.statusCode) || 500;
    if (status >= 500) console.error("[api] error no controlado:", err);
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: status === 400
        ? "La solicitud no es válida: el cuerpo no es un JSON correcto."
        : status === 413
          ? "La solicitud es demasiado grande."
          : "Ocurrió un error inesperado. Inténtalo de nuevo.",
    });
  });

  return app;
}

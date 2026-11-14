import fs from "fs";
import path from "path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { DiskUploader, StorageUploader, type Uploader } from "./uploads.js";
import { FirestoreStore, MemoryStore, type Store } from "./store.js";

/**
 * Credenciales de Firebase para el servidor. Se leen de una variable de entorno:
 *   FIREBASE_SERVICE_ACCOUNT          el JSON de la cuenta de servicio (una sola línea o con saltos)
 *   FIREBASE_SERVICE_ACCOUNT_BASE64   el mismo JSON codificado en base64 (más fácil de pegar en Vercel)
 */
export function readServiceAccount(env: NodeJS.ProcessEnv = process.env): Record<string, any> | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_BASE64
    ? Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")
    : env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !raw.trim()) return null;
  let account: Record<string, any>;
  try {
    account = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT no es un JSON válido. Pega el archivo completo de la cuenta de servicio.");
  }
  // En algunas plataformas los saltos de línea de la llave llegan como "\\n" literales.
  if (typeof account.private_key === "string") account.private_key = account.private_key.replace(/\\n/g, "\n");
  return account;
}

function readAppletConfig(): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
  } catch {
    return {};
  }
}

let cached: { store: Store; uploader: Uploader; kind: "firestore" | "memory" } | null = null;

/** Firestore si hay credenciales; si no, memoria (los datos se pierden al reiniciar: solo para desarrollo). */
export function createBackendFromEnv(env: NodeJS.ProcessEnv = process.env, opts: { allowMemory?: boolean } = {}) {
  if (cached) return cached;
  const account = readServiceAccount(env);
  if (!account && opts.allowMemory === false) {
    // En un servidor sin disco ni memoria compartida (Vercel) los datos en memoria se perderían: mejor no atender.
    throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_BASE64: la base de datos no está configurada.");
  }
  if (!account) {
    console.warn("[datos] Sin FIREBASE_SERVICE_ACCOUNT: se usa una base de datos en memoria (los datos se pierden al reiniciar).");
    cached = { store: new MemoryStore(), uploader: new DiskUploader(), kind: "memory" };
    return cached;
  }

  const applet = readAppletConfig();
  const projectId = env.FIREBASE_PROJECT_ID || account.project_id || applet.projectId;
  const databaseId = env.FIRESTORE_DATABASE_ID || applet.firestoreDatabaseId || "(default)";
  const storageBucket = env.FIREBASE_STORAGE_BUCKET || applet.storageBucket || `${projectId}.firebasestorage.app`;

  const app = getApps()[0] || initializeApp({ credential: cert(account), projectId, storageBucket });
  const db = getFirestore(app, databaseId);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Ya estaba inicializado (recarga en caliente): los valores undefined se quitan igualmente en FirestoreStore.
  }
  console.log(`[datos] Firestore: proyecto ${projectId}, base ${databaseId}`);

  cached = {
    store: new FirestoreStore(db),
    uploader: new StorageUploader(getStorage(app).bucket()),
    kind: "firestore",
  };
  return cached;
}

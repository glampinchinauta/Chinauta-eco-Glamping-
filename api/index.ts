/**
 * Función de Vercel: toda la API (/api/...) corre aquí, con los datos en Firestore.
 * Variables de entorno necesarias en Vercel: ver docs/FIRESTORE.md
 */
import express from "express";
import { createApp } from "./app.js";
import { createBackendFromEnv } from "./factory.js";

let app: express.Express;
try {
  // En Vercel no se admite la base en memoria: sin credenciales de Firestore, la API avisa en lugar de perder reservas.
  const { store, uploader } = createBackendFromEnv(process.env, { allowMemory: false });
  app = createApp({ store, uploader });
} catch (err) {
  console.error("[api] No se pudo iniciar la base de datos:", err);
  app = express();
  app.use((_req, res) => {
    res.status(503).json({
      error: "El servicio de reservas no está disponible en este momento. Escríbenos por WhatsApp al +57 321 310 9331 y te atendemos.",
    });
  });
}

export default app;

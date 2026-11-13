/**
 * Servidor local de Eco Glamping Chinauta (desarrollo y prueba de producción en tu computador).
 *
 * En Vercel NO se usa este archivo: allí la API corre como función (api/index.ts) y Vercel sirve la parte visual.
 * Los datos van a Firestore cuando hay FIREBASE_SERVICE_ACCOUNT; si no, se usa memoria (se pierden al reiniciar).
 */
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createApp } from "./api/app";
import { createBackendFromEnv } from "./api/factory";

const portArgIndex = process.argv.indexOf("--port");
const portFromArgs = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? Number(process.argv[portArgIndex + 1]) : null;
const PORT = portFromArgs || Number(process.env.DEFAULT_APP_PORT) || 3000;

const { store, uploader, kind } = createBackendFromEnv();
const app = createApp({ store, uploader });

async function startServer() {
  app.use(express.static(path.join(process.cwd(), "public")));

  if (process.env.NODE_ENV !== "production") {
    // Development: Vite serves the website with live reload.
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Any other page of the site opens the app (works the same in Express 4 and 5).
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Eco Glamping Chinauta server running on http://localhost:${PORT} (datos: ${kind})`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer();

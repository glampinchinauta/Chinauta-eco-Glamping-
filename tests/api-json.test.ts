// Comprueba que la API siempre contesta JSON (nunca una página HTML de error), en desarrollo y en producción.
// Ejecutar con: npm run build && npx tsx tests/api-json.test.ts
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();

async function startServer(mode: "dev" | "prod", port: number): Promise<{ base: string; stop: () => void }> {
  const db = path.join(os.tmpdir(), `egc-api-json-${mode}-${Date.now()}.db`);
  fs.copyFileSync(path.join(root, "glamping.db"), db);
  const env = { ...process.env, GLAMPING_DB_PATH: db, DEFAULT_APP_PORT: String(port) } as NodeJS.ProcessEnv;
  let child: ChildProcess;
  if (mode === "prod") {
    env.NODE_ENV = "production";
    child = spawn(process.execPath, ["dist/server.cjs"], { cwd: root, env, stdio: "ignore" });
  } else {
    child = spawn(process.execPath, [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "server.ts"], { cwd: root, env, stdio: "ignore" });
  }
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${base}/api/domes`); if (r.ok) break; } catch { /* aún no arranca */ }
    await new Promise((r) => setTimeout(r, 1000));
    if (i === 59) throw new Error(`el servidor (${mode}) no arrancó`);
  }
  return { base, stop: () => { child.kill(); try { fs.unlinkSync(db); } catch { /* en uso */ } } };
}

const isJson = (r: Response) => (r.headers.get("content-type") || "").includes("application/json");
const post = (base: string, body: string, contentType = "application/json") =>
  fetch(`${base}/api/reservations`, { method: "POST", headers: { "Content-Type": contentType }, body });

async function suite(mode: "dev" | "prod", port: number, results: string[]) {
  const { base, stop } = await startServer(mode, port);
  const check = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); results.push(`ok   [${mode}] ${name}`); }
    catch (e: any) { results.push(`FAIL [${mode}] ${name}: ${e.message}`); }
  };
  try {
    await check("JSON mal formado responde 400 en JSON, no HTML", async () => {
      const r = await post(base, "{esto no es json");
      assert.equal(r.status, 400);
      assert.ok(isJson(r), `content-type: ${r.headers.get("content-type")}`);
      assert.match((await r.json()).error, /JSON/);
    });
    await check("cuerpo de texto plano responde 400 en JSON", async () => {
      const r = await post(base, "hola", "text/plain");
      assert.equal(r.status, 400);
      assert.ok(isJson(r));
    });
    await check("cuerpo vacío {} responde 400 en JSON con el aviso de datos obligatorios", async () => {
      const r = await post(base, "{}");
      assert.equal(r.status, 400);
      assert.ok(isJson(r));
      assert.match((await r.json()).error, /obligatorios/);
    });
    await check("ruta de la API que no existe responde JSON", async () => {
      for (const m of ["GET", "POST", "PUT", "DELETE"]) {
        const r = await fetch(`${base}/api/esta-ruta-no-existe`, { method: m, headers: { "Content-Type": "application/json" }, body: m === "GET" ? undefined : "{}" });
        assert.ok(isJson(r), `${m} → ${r.headers.get("content-type")}`);
        assert.ok(r.status >= 400);
      }
    });
    await check("una reserva válida responde 200 en JSON con su código", async () => {
      const d = new Date(Date.now() + (60 + Math.floor(Math.random() * 600)) * 86400000); // fecha al azar para no chocar con otra reserva
      const day = (n: number) => new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
      const r = await post(base, JSON.stringify({
        dome_id: 1, check_in: day(0), check_out: day(1), guests: 2,
        consent: { terms: true, age: true, marketing: false },
        customer: { name: "Prueba JSON", email: "json@test.invalid", phone: "3001234567" },
      }));
      assert.equal(r.status, 200);
      assert.ok(isJson(r));
      assert.match((await r.json()).reservation_code, /^EGC-\d+$/);
    });
    if (mode === "prod") {
      await check("la página principal y las rutas del sitio siguen devolviendo HTML", async () => {
        for (const p of ["/", "/alguna-pagina-del-sitio"]) {
          const r = await fetch(`${base}${p}`);
          assert.equal(r.status, 200, p);
          assert.match(r.headers.get("content-type") || "", /text\/html/, p);
        }
      });
    }
  } finally { stop(); }
}

(async () => {
  const results: string[] = [];
  await suite("dev", 3150, results);
  if (fs.existsSync(path.join(root, "dist", "server.cjs"))) await suite("prod", 3151, results);
  else results.push("SKIP [prod] falta dist/server.cjs (ejecuta npm run build)");
  console.log(results.join("\n"));
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n${results.filter((r) => r.startsWith("ok")).length} correctas, ${failed} fallidas`);
  process.exit(failed ? 1 : 0);
})();

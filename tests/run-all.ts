// Ejecuta todas las pruebas que no necesitan compilar: npm test
import { spawnSync } from "node:child_process";
import path from "node:path";

const tsx = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const runs: { name: string; file: string; env?: Record<string, string> }[] = [
  { name: "Servidor con datos en memoria", file: "tests/backend.test.ts" },
  { name: "Servidor con Firestore (falso)", file: "tests/backend.test.ts", env: { STORE: "firestore" } },
  { name: "Verificación de sesiones", file: "tests/auth.test.ts" },
];

let failed = 0;
for (const run of runs) {
  console.log(`\n=== ${run.name} ===`);
  const result = spawnSync(process.execPath, [tsx, run.file], { stdio: "inherit", env: { ...process.env, ...run.env } });
  if (result.status !== 0) failed++;
}
console.log(failed ? `\n${failed} conjunto(s) con fallos` : "\nTodas las pruebas pasaron");
process.exit(failed ? 1 : 0);

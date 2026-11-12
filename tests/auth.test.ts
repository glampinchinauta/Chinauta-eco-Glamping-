// Pruebas de verificación de tokens de Firebase con llaves locales.
// Ejecutar con: npx tsx tests/auth.test.ts
import crypto from "crypto";
import assert from "node:assert/strict";
import { verifyFirebaseIdToken } from "../server-auth";

const PROJECT = "proyecto-prueba";
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const otherKeys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

function makeToken(opts: {
  header?: object;
  payload?: Record<string, unknown>;
  signWith?: crypto.KeyObject;
} = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = opts.header ?? { alg: "RS256", kid: "k1" };
  const payload = {
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    sub: "uid-123",
    iat: now,
    exp: now + 3600,
    email: "cliente@ejemplo.com",
    email_verified: true,
    ...opts.payload,
  };
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(opts.signWith ?? privateKey).toString("base64url");
  return `${unsigned}.${sig}`;
}

const getCert = async (kid: string) => (kid === "k1" ? publicPem : undefined);
const verify = (token: string) => verifyFirebaseIdToken(token, { projectId: PROJECT, getCert });

const cases: [string, () => Promise<void>][] = [
  ["token válido se acepta y devuelve el correo", async () => {
    const claims = await verify(makeToken());
    assert.equal(claims.email, "cliente@ejemplo.com");
    assert.equal(claims.sub, "uid-123");
  }],
  ["firma de otra llave se rechaza", async () => {
    await assert.rejects(verify(makeToken({ signWith: otherKeys.privateKey })), /Token inválido/);
  }],
  ["payload alterado después de firmar se rechaza", async () => {
    const t = makeToken();
    const [h, , s] = t.split(".");
    const forged = `${h}.${b64({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: "otro", iat: 1, exp: 9999999999, email: "admin@ejemplo.com", email_verified: true })}.${s}`;
    await assert.rejects(verify(forged), /Token inválido/);
  }],
  ["proyecto distinto se rechaza", async () => {
    await assert.rejects(verifyFirebaseIdToken(makeToken(), { projectId: "otro-proyecto", getCert }), /Token inválido/);
  }],
  ["token vencido se rechaza", async () => {
    const past = Math.floor(Date.now() / 1000) - 7200;
    await assert.rejects(verify(makeToken({ payload: { iat: past, exp: past + 60 } })), /venció/);
  }],
  ["fecha de emisión en el futuro se rechaza", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    await assert.rejects(verify(makeToken({ payload: { iat: future, exp: future + 3600 } })), /venció/);
  }],
  ["llave desconocida (kid) se rechaza", async () => {
    await assert.rejects(verify(makeToken({ header: { alg: "RS256", kid: "desconocida" } })), /Token inválido/);
  }],
  ["algoritmo none se rechaza", async () => {
    const t = makeToken();
    const [, p, s] = t.split(".");
    await assert.rejects(verify(`${b64({ alg: "none", kid: "k1" })}.${p}.${s}`), /Token inválido/);
  }],
  ["cadena que no es un token se rechaza", async () => {
    await assert.rejects(verify("no-es-un-token"), /Token inválido/);
  }],
  ["token sin sujeto se rechaza", async () => {
    await assert.rejects(verify(makeToken({ payload: { sub: "" } })), /Token inválido/);
  }],
];

(async () => {
  let failed = 0;
  for (const [name, fn] of cases) {
    try {
      await fn();
      console.log(`ok   ${name}`);
    } catch (err: any) {
      failed++;
      console.log(`FAIL ${name}: ${err.message}`);
    }
  }
  console.log(`\n${cases.length - failed}/${cases.length} pruebas correctas`);
  process.exit(failed ? 1 : 0);
})();

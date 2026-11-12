import crypto from "crypto";

/**
 * Verifies a Firebase Auth ID token (RS256, signed by Google's securetoken service).
 * It does not decide who is an administrator or a customer: callers apply their own rules.
 *
 * `getCert` returns the PEM certificate for a key id (kid), taken from Google's public key list.
 * It is injected so the verification can be tested with local keys.
 */
export interface FirebaseClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  [claim: string]: any;
}

export async function verifyFirebaseIdToken(
  token: string,
  opts: { projectId: string; getCert: (kid: string) => Promise<string | undefined>; now?: number }
): Promise<FirebaseClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token inválido.");
  const [h, p, s] = parts;
  let header: any;
  let payload: any;
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  } catch {
    throw new Error("Token inválido.");
  }
  if (header.alg !== "RS256" || !header.kid) throw new Error("Token inválido.");
  if (!opts.projectId) throw new Error("Token inválido.");

  const cert = await opts.getCert(String(header.kid));
  if (!cert) throw new Error("Token inválido.");
  const valid = crypto.createVerify("RSA-SHA256").update(`${h}.${p}`).verify(cert, Buffer.from(s, "base64url"));
  if (!valid) throw new Error("Token inválido.");

  if (payload.aud !== opts.projectId || payload.iss !== `https://securetoken.google.com/${opts.projectId}`) {
    throw new Error("Token inválido.");
  }
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (!(payload.exp > now) || payload.iat > now + 300) throw new Error("La sesión venció. Inicia sesión de nuevo.");
  if (!payload.sub || typeof payload.sub !== "string") throw new Error("Token inválido.");
  return payload as FirebaseClaims;
}

/** Normalizes an email for comparisons (case and surrounding spaces). */
export function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

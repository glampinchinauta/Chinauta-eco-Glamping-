/**
 * Avisos de reserva por correo (opcional). Solo se envían si existe RESEND_API_KEY en Vercel.
 * Sin esa llave no hace nada y la reserva funciona igual. Nunca bloquea ni rompe una reserva.
 */
export interface ReservationNotice {
  code: string;
  domeName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO") + " COP";
const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

async function send(env: NodeJS.ProcessEnv, to: string[], subject: string, html: string) {
  const key = env.RESEND_API_KEY;
  if (!key || to.length === 0) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.NOTIFY_FROM || "Eco Glamping Chinauta <onboarding@resend.dev>", to, subject, html }),
  });
  if (!res.ok) console.error("[notify] El proveedor de correo respondió", res.status, await res.text().catch(() => ""));
}

export async function notifyReservation(env: NodeJS.ProcessEnv, n: ReservationNotice): Promise<void> {
  try {
    if (!env.RESEND_API_KEY) return;
    const details = `<ul>
      <li><b>Código:</b> ${esc(n.code)}</li><li><b>Domo:</b> ${esc(n.domeName)}</li>
      <li><b>Llegada:</b> ${esc(n.checkIn)} · <b>Salida:</b> ${esc(n.checkOut)}</li>
      <li><b>Huéspedes:</b> ${n.guests}</li><li><b>Total:</b> ${money(n.total)}</li></ul>`;
    const admins = (env.NOTIFY_EMAILS || env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
    await send(env, admins, `Nueva reserva ${n.code} - ${n.customerName}`,
      `<p>Entró una reserva nueva (pendiente de confirmar).</p>${details}<p>Cliente: ${esc(n.customerName)} ${esc(n.customerPhone || "")} ${esc(n.customerEmail || "")}</p>`);
    if (n.customerEmail) {
      await send(env, [n.customerEmail], `Recibimos tu reserva ${n.code} - Eco Glamping Chinauta`,
        `<p>Hola ${esc(n.customerName)}, recibimos tu solicitud de reserva. Te confirmaremos por WhatsApp (+57 324 296 9426).</p>${details}`);
    }
  } catch (err) {
    console.error("[notify] No se pudo enviar el aviso:", err);
  }
}

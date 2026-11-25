// Resumen de una reserva en texto. Es la misma fuente para el mensaje de WhatsApp y para el panel de administración.
// Las reservas anteriores (sin detalle guardado) muestran sus notas originales.

type Row = Record<string, any>;

export interface BookingDetails {
  booking_type?: string;
  nights?: number;
  pets?: number;
  pets_fee?: number;
  base_price?: number;
  extra_guests_fee?: number;
  addons?: { name: string; price: number }[];
  addons_fee?: number;
  decor_message?: string;
  bbq_zone?: boolean;
  bbq_fee?: number;
  food?: { name: string; qty: number; subtotal: number; meat?: string; preparation?: string; side?: string }[];
  food_fee?: number;
  promo_code?: string;
  discount_percent?: number;
  discount_amount?: number;
  customer_notes?: string;
  customer?: { name?: string; document_id?: string; phone?: string; whatsapp?: string; email?: string };
}

export function clipText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export function formatCOP(n: unknown): string {
  return "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");
}

// Database timestamps are UTC ("2026-11-25 21:02:00"). Show them in Colombia time.
export function formatBogota(sqlUtc: unknown): string {
  const d = new Date(String(sqlUtc || "").replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return String(sqlUtc || "-");
  return d.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

// Parses the stored JSON; returns null for reservations created before the detail was saved.
export function parseDetails(raw: unknown): BookingDetails | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as BookingDetails;
  try { return JSON.parse(String(raw)) as BookingDetails; } catch { return null; }
}

export function buildBookingSummary(input: {
  reservation: Row;
  details: BookingDetails | null;
  customer?: Row | null;
  dome?: Row | null;
}): string {
  const { reservation: r, details: det, customer: c, dome } = input;
  const lines: string[] = [];
  lines.push(`RESERVA ${r.reservation_code}`);
  lines.push(`Hora de la reserva: ${formatBogota(r.created_at)} (hora Colombia)`);
  lines.push(`Estado: ${r.status} · Pago: ${r.payment_status}`);
  lines.push("");
  lines.push("HUÉSPED");
  lines.push(`Nombre: ${det?.customer?.name || c?.name || "-"}`);
  lines.push(`Documento: ${det?.customer?.document_id || c?.document_id || "-"}`);
  lines.push(`Teléfono: ${det?.customer?.phone || c?.phone || "-"}`);
  lines.push(`WhatsApp: ${det?.customer?.whatsapp || c?.whatsapp || "-"}`);
  lines.push(`Correo: ${det?.customer?.email || c?.email || "-"}`);
  lines.push("");
  lines.push("ESTADÍA");
  lines.push(`Tipo: ${det?.booking_type || "Hospedaje"}`);
  lines.push(`Domo: ${dome?.name || `Domo ${r.dome_id}`}`);
  lines.push(`Entrada: ${r.check_in}   Salida: ${r.check_out}${det?.nights ? `   Noches: ${det.nights}` : ""}`);
  lines.push(`Huéspedes: ${r.guests} (capacidad del domo: ${dome?.capacity ?? "-"})`);
  lines.push(`Mascotas: ${det?.pets ?? 0}`);
  lines.push("");
  lines.push("EXTRAS");
  const addonList = det?.addons || [];
  if (addonList.length === 0) lines.push("- Ninguno");
  for (const a of addonList) lines.push(`- ${a.name}: ${formatCOP(a.price)}`);
  if (det?.decor_message) lines.push(`Mensaje para la decoración: "${det.decor_message}"`);
  lines.push("");
  lines.push("COMIDA Y ZONA BBQ");
  if (det?.bbq_zone) lines.push(`- Zona BBQ con comida propia: ${formatCOP(det.bbq_fee)}`);
  const foodList = det?.food || [];
  if (foodList.length === 0 && !det?.bbq_zone) lines.push("- Ninguna");
  for (const f of foodList) {
    const choices = [f.meat, f.preparation, f.side ? `acompañamiento: ${f.side}` : ""].filter(Boolean).join(" · ");
    lines.push(`- ${f.qty} x ${f.name}${choices ? ` (${choices})` : ""}: ${formatCOP(f.subtotal)}`);
  }
  lines.push("");
  lines.push("VALORES");
  if (det) {
    lines.push(`Hospedaje: ${formatCOP(det.base_price)}`);
    if (det.extra_guests_fee) lines.push(`Huéspedes adicionales: ${formatCOP(det.extra_guests_fee)}`);
    if (det.pets_fee) lines.push(`Mascotas: ${formatCOP(det.pets_fee)}`);
    if (det.addons_fee) lines.push(`Extras: ${formatCOP(det.addons_fee)}`);
    if (det.food_fee) lines.push(`Comida: ${formatCOP(det.food_fee)}`);
    if (det.bbq_fee) lines.push(`Zona BBQ: ${formatCOP(det.bbq_fee)}`);
    if ((det.discount_amount || 0) > 0) {
      lines.push(`Descuento ${det.discount_percent}%${det.promo_code ? ` (código ${det.promo_code})` : ""}: -${formatCOP(det.discount_amount)}`);
    }
  }
  lines.push(`TOTAL: ${formatCOP(r.total_amount)}`);
  lines.push(`Pagado: ${formatCOP(r.amount_paid)} · Saldo pendiente: ${formatCOP(r.amount_pending)}`);
  lines.push("");
  lines.push(`NOTAS DEL HUÉSPED: ${det ? (det.customer_notes || "-") : (r.notes || "-")}`);
  if (!det) lines.push("(Reserva anterior: sin detalle estructurado. Notas originales arriba.)");
  return lines.join("\n");
}

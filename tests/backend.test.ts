// Pruebas del servidor completo (rutas + datos) con la base en memoria y tokens firmados localmente.
// Ejecutar con: npx tsx tests/backend.test.ts
import assert from "node:assert/strict";
import crypto from "crypto";
import http from "http";
import { createApp } from "../api/app";
import { FirestoreStore, MemoryStore } from "../api/store";
import { FakeFirestore } from "./fake-firestore";
import { FakeUploader } from "../api/uploads";
import { DEFAULT_MENU_ITEMS } from "../src/data/defaultMenu";

const PROJECT = "proyecto-prueba";
const ADMIN = "admin@test.invalid";
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

function token(email: string, verified = true): string {
  const t = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", kid: "k1" })}.${b64({
    aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: "uid-" + email, iat: t, exp: t + 3600, email, email_verified: verified,
  })}`;
  return `${unsigned}.${crypto.createSign("RSA-SHA256").update(unsigned).sign(privateKey).toString("base64url")}`;
}

// STORE=firestore ejecuta las mismas pruebas sobre FirestoreStore con un Firestore falso (con sus reglas de lecturas y escrituras).
const useFirestore = process.env.STORE === "firestore";
const store = useFirestore ? new FirestoreStore(new FakeFirestore() as any) : new MemoryStore();
const uploader = new FakeUploader();
const app = createApp({
  store, uploader,
  env: { FIREBASE_PROJECT_ID: PROJECT, ADMIN_EMAILS: ADMIN, RATE_LIMIT_SCALE: "1000" } as NodeJS.ProcessEnv,
  getCert: async (kid) => (kid === "k1" ? publicPem : undefined),
});

let base = "";
async function call(method: string, path: string, opts: { body?: any; auth?: string; raw?: string; type?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.auth) headers.Authorization = `Bearer ${opts.auth}`;
  let body: string | undefined;
  if (opts.raw !== undefined) { body = opts.raw; headers["Content-Type"] = opts.type || "application/json"; }
  else if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers["Content-Type"] = "application/json"; }
  const res = await fetch(base + path, { method, headers, body: method === "GET" || method === "HEAD" ? undefined : body });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* no es JSON */ }
  return { status: res.status, data, text, type: res.headers.get("content-type") || "" };
}
const admin = () => token(ADMIN);

// Fechas: el siguiente día de la semana (0 = domingo ... 6 = sábado) al menos `min` días en el futuro.
function nextDay(dow: number, min: number, extraWeeks = 0): string {
  const d = new Date(Date.now() + min * 86400000);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7 * extraWeeks);
  return d.toISOString().slice(0, 10);
}
const plus = (date: string, days: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

const consent = { terms: true, age: true, marketing: false };
const guest = (n: number) => ({ name: `Huésped ${n}`, email: `huesped${n}@test.invalid`, phone: `300000${String(n).padStart(4, "0")}` });
const book = (dome: number, inDate: string, outDate: string, extra: Record<string, any> = {}, n = Math.floor(Math.random() * 1e6)) =>
  call("POST", "/api/reservations", { body: { dome_id: dome, check_in: inDate, check_out: outDate, guests: 2, consent, customer: guest(n), ...extra } });

const cases: [string, () => Promise<void>][] = [];
const test = (name: string, fn: () => Promise<void>) => cases.push([name, fn]);

// ---------------------------------------------------------------- datos iniciales y permisos
test("la primera vez se cargan 6 domos con los precios pedidos y sus fotos", async () => {
  const r = await call("GET", "/api/domes");
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.map((d: any) => d.price_per_night), [350000, 400000, 400000, 420000, 450000, 450000]);
  assert.deepEqual(r.data.map((d: any) => d.code), ["DOMO-01", "DOMO-02", "DOMO-03", "DOMO-04", "DOMO-05", "DOMO-06"]);
  assert.ok(Array.isArray(r.data[0].images) && r.data[0].images.length > 0);
});
test("el menú trae trucha $60.000, carnes $50.000 y combo $40.000 con lo incluido", async () => {
  const r = await call("GET", "/api/menu");
  assert.equal(r.status, 200);
  const byTitle = (re: RegExp) => r.data.find((m: any) => re.test(m.title));
  const trucha = byTitle(/^Trucha/), carnes = byTitle(/^Carnes/), combo = byTitle(/^Combo/);
  assert.equal(trucha.price, 60000);
  assert.equal(carnes.price, 50000);
  assert.equal(combo.price, 40000);
  assert.deepEqual(JSON.parse(trucha.sides), ["Papas fritas", "Ensalada"]);
  assert.equal(trucha.beverage, "Jugo natural");
  assert.equal(combo.beverage, "Gaseosa");
  assert.ok(JSON.parse(carnes.preparations).includes("Asada a la parrilla"));
});
test("la galería está cargada y las rutas públicas no piden sesión", async () => {
  assert.equal((await call("GET", "/api/gallery")).data.length, 12);
  for (const p of ["/api/testimonials", "/api/location-photos", "/api/availability?checkIn=2030-01-01&checkOut=2030-01-02"]) {
    assert.equal((await call("GET", p)).status, 200, p);
  }
});
test("las rutas de administración exigen un administrador", async () => {
  for (const [m, p] of [["GET", "/api/reservations"], ["GET", "/api/customers"], ["GET", "/api/payments"], ["GET", "/api/settings"], ["GET", "/api/users"], ["GET", "/api/audit"], ["POST", "/api/domes"], ["POST", "/api/menu"], ["POST", "/api/upload-image"], ["PUT", "/api/settings"]]) {
    const r = await call(m, p, { body: {} });
    assert.equal(r.status, 401, `${m} ${p}`);
    assert.ok(r.type.includes("application/json"));
  }
  // una cuenta de cliente (no administradora) tampoco entra
  assert.equal((await call("GET", "/api/reservations", { auth: token("cliente@test.invalid") })).status, 401);
  assert.equal((await call("GET", "/api/reservations", { auth: admin() })).status, 200);
  assert.equal((await call("GET", "/api/reservations", { auth: token(ADMIN, false) })).status, 401);
});
test("los ajustes iniciales usan el WhatsApp real", async () => {
  const r = await call("GET", "/api/settings", { auth: admin() });
  assert.equal(r.data.whatsapp, "+57 321 310 9331");
});

// ---------------------------------------------------------------- reservas y precios
test("domo 5 un sábado con trucha, carne y 2 combos (platos 1, 2 y 5) = $640.000", async () => {
  const sat = nextDay(6, 100);
  const r = await book(5, sat, plus(sat, 1), { food_items: [{ id: 1, qty: 1 }, { id: 2, qty: 1 }, { id: 5, qty: 2 }] });
  assert.equal(r.status, 200, r.text);
  assert.match(r.data.reservation_code, /^EGC-\d{4,6}$/);
  const list = await call("GET", "/api/reservations", { auth: admin() });
  const mine = list.data.find((x: any) => x.reservation_code === r.data.reservation_code);
  assert.equal(mine.total_amount, 640000);
  assert.equal(mine.amount_pending, 640000);
  assert.equal(mine.status, "Pendiente");
  assert.equal(mine.dome_name, "Domo Chiminichagua");
  assert.ok(mine.terms_accepted_at && mine.terms_version);
});
test("los 6 domos cobran su precio por noche", async () => {
  const expected = [350000, 400000, 400000, 420000, 450000, 450000];
  for (let i = 0; i < 6; i++) {
    const sat = nextDay(6, 130, i); // un sábado distinto para cada domo
    const r = await book(i + 1, sat, plus(sat, 1));
    assert.equal(r.status, 200, r.text);
    const rows = (await call("GET", "/api/reservations", { auth: admin() })).data;
    assert.equal(rows.find((x: any) => x.reservation_code === r.data.reservation_code).total_amount, expected[i], `domo ${i + 1}`);
  }
});
test("dos noches cobran el doble y de lunes a jueves hay 10% de descuento", async () => {
  const sat = nextDay(6, 200);
  const two = await book(6, sat, plus(sat, 2));
  const mon = nextDay(1, 220);
  const weekday = await book(1, mon, plus(mon, 1));
  const rows = (await call("GET", "/api/reservations", { auth: admin() })).data;
  assert.equal(rows.find((x: any) => x.reservation_code === two.data.reservation_code).total_amount, 900000);
  const w = rows.find((x: any) => x.reservation_code === weekday.data.reservation_code);
  assert.equal(w.total_amount, 315000);
  assert.match(w.notes, /Descuento 10%/);
});
test("los códigos promocionales se crean, validan y aplican (gana el mayor descuento)", async () => {
  const create = await call("POST", "/api/promo-codes", { auth: admin(), body: { code: "amigo15", percent: 15 } });
  assert.equal(create.status, 200);
  assert.equal((await call("POST", "/api/promo-codes", { auth: admin(), body: { code: "AMIGO15", percent: 15 } })).status, 409, "duplicado");
  assert.equal((await call("POST", "/api/promo-codes", { auth: admin(), body: { code: "X", percent: 7 } })).status, 400, "porcentaje no permitido");
  assert.deepEqual((await call("GET", "/api/promo-codes/validate?code=AMIGO15")).data, { valid: true, code: "AMIGO15", percent: 15 });
  assert.equal((await call("GET", "/api/promo-codes/validate?code=NOEXISTE")).status, 404);
  const sat = nextDay(6, 250);
  const r = await book(2, sat, plus(sat, 1), { promo_code: "amigo15" });
  const rows = (await call("GET", "/api/reservations", { auth: admin() })).data;
  assert.equal(rows.find((x: any) => x.reservation_code === r.data.reservation_code).total_amount, 340000);
  const mon = nextDay(1, 260);
  const r2 = await book(2, mon, plus(mon, 1), { promo_code: "AMIGO15" }); // lunes 10% < código 15%
  assert.equal((await call("GET", "/api/reservations", { auth: admin() })).data.find((x: any) => x.reservation_code === r2.data.reservation_code).total_amount, 340000);
  // desactivar el código
  const id = (await call("GET", "/api/promo-codes", { auth: admin() })).data[0].id;
  assert.equal((await call("PUT", `/api/promo-codes/${id}`, { auth: admin(), body: { code: "AMIGO15", percent: 15, active: 0 } })).status, 200);
  assert.equal((await call("GET", "/api/promo-codes/validate?code=AMIGO15")).status, 404);
});
test("validaciones: sin aceptar términos, fechas, capacidad y domo inexistente", async () => {
  const sat = nextDay(6, 300);
  assert.equal((await call("POST", "/api/reservations", { body: { dome_id: 1, check_in: sat, check_out: plus(sat, 1), customer: guest(1) } })).status, 400);
  assert.equal((await book(1, "2030-1-1", "2030-1-2")).status, 400);
  assert.equal((await book(1, sat, sat)).status, 400);
  assert.equal((await book(1, sat, plus(sat, 1), { guests: 9 })).status, 400);
  assert.equal((await book(99, sat, plus(sat, 1))).status, 400);
  assert.equal((await call("POST", "/api/reservations", { body: {} })).status, 400);
});
test("el pasadía cuesta $250.000 y bloquea ese día", async () => {
  const thu = nextDay(4, 320);
  const r = await book(3, thu, thu, { booking_type: "pasadia" });
  assert.equal(r.status, 200, r.text);
  const row = (await call("GET", "/api/reservations", { auth: admin() })).data.find((x: any) => x.reservation_code === r.data.reservation_code);
  assert.equal(row.check_out, plus(thu, 1));
  assert.equal(row.total_amount, 225000); // $250.000 con 10% de jueves
});
test("no se puede reservar dos veces el mismo domo: de 5 solicitudes simultáneas gana una", async () => {
  const sat = nextDay(6, 340);
  const results = await Promise.all([1, 2, 3, 4, 5].map((n) => book(4, sat, plus(sat, 1), {}, 1000 + n)));
  const codes = results.filter((r) => r.status === 200).map((r) => r.data.reservation_code);
  assert.equal(codes.length, 1, results.map((r) => r.status).join(","));
  assert.equal(results.filter((r) => r.status === 409).length, 4);
  // fechas que se montan parcialmente también chocan; las contiguas no
  assert.equal((await book(4, plus(sat, 0), plus(sat, 3))).status, 409);
  assert.equal((await book(4, plus(sat, 1), plus(sat, 2))).status, 200);
});
test("el mismo huésped no se duplica y los códigos son únicos", async () => {
  const a = nextDay(6, 360), b = nextDay(6, 360, 1);
  const first = await book(1, a, plus(a, 1), {}, 7777);
  const second = await book(1, b, plus(b, 1), {}, 7777);
  assert.notEqual(first.data.reservation_code, second.data.reservation_code);
  const customers = (await call("GET", "/api/customers", { auth: admin() })).data.filter((c: any) => c.email === "huesped7777@test.invalid");
  assert.equal(customers.length, 1);
  assert.equal(customers[0].total_reservations, 2);
  assert.equal(customers[0].total_spent, 700000);
  const detail = await call("GET", `/api/customers/${customers[0].id}`, { auth: admin() });
  assert.equal(detail.data.reservations.length, 2);
  assert.equal((await call("GET", "/api/customers/99999", { auth: admin() })).status, 404);
});

// ---------------------------------------------------------------- disponibilidad, mantenimiento y cancelaciones
test("la disponibilidad marca lo reservado, el mantenimiento y se libera al cancelar", async () => {
  const sat = nextDay(6, 400);
  const out = plus(sat, 1);
  const free = (await call("GET", `/api/availability?checkIn=${sat}&checkOut=${out}`)).data;
  assert.equal(free.filter((d: any) => d.isAvailable).length, 6);
  const r = await book(2, sat, out);
  let list = (await call("GET", `/api/availability?checkIn=${sat}&checkOut=${out}`)).data;
  const d2 = list.find((d: any) => d.id === 2);
  assert.equal(d2.isAvailable, false);
  assert.equal(d2.reason, "Reservado");
  // bloqueo por mantenimiento en otro domo
  assert.equal((await call("POST", "/api/maintenance", { auth: admin(), body: { dome_id: 1, start_date: sat, end_date: out, reason: "Limpieza", user_name: "Prueba" } })).status, 200);
  list = (await call("GET", `/api/availability?checkIn=${sat}&checkOut=${out}`)).data;
  assert.equal(list.find((d: any) => d.id === 1).reason, "Mantenimiento");
  assert.equal((await book(1, sat, out)).status, 409);
  // no se puede bloquear un domo con reservas en esas fechas
  assert.equal((await call("POST", "/api/maintenance", { auth: admin(), body: { dome_id: 2, start_date: sat, end_date: out, reason: "x" } })).status, 400);
  const blocks = await call("GET", "/api/maintenance", { auth: admin() });
  assert.equal(blocks.data[0].dome_name, "Domo Huitaca");
  assert.equal((await call("DELETE", `/api/maintenance/${blocks.data[0].id}`, { auth: admin(), body: {} })).status, 200);
  assert.equal((await book(1, sat, out)).status, 200);
  // cancelar libera el domo 2
  const id = (await call("GET", "/api/reservations", { auth: admin() })).data.find((x: any) => x.reservation_code === r.data.reservation_code).id;
  assert.equal((await call("DELETE", `/api/reservations/${id}`, { auth: admin(), body: { user_name: "Prueba" } })).status, 200);
  assert.equal((await call("GET", `/api/availability?checkIn=${sat}&checkOut=${out}`)).data.find((d: any) => d.id === 2).isAvailable, true);
  assert.equal((await book(2, sat, out)).status, 200);
});

// ---------------------------------------------------------------- consulta del huésped, cuenta y privacidad
test("el huésped consulta por código con su correo o teléfono, y en su cuenta ve solo lo suyo", async () => {
  const sat = nextDay(6, 440);
  const r = await book(3, sat, plus(sat, 1), {}, 4242);
  const code = r.data.reservation_code;
  const ok = await call("GET", `/api/reservations/lookup?code=${code}&contact=${encodeURIComponent("HUESPED4242@test.invalid")}`);
  assert.equal(ok.data.length, 1);
  assert.equal(ok.data[0].dome_name, "Domo Bachué");
  assert.equal(ok.data[0].customer_email, undefined);
  assert.equal((await call("GET", `/api/reservations/lookup?code=${code}&contact=3000004242`)).data.length, 1);
  assert.equal((await call("GET", `/api/reservations/lookup?code=${code}&contact=otro@test.invalid`)).data.length, 0);
  assert.equal((await call("GET", "/api/reservations/lookup?code=")).status, 400);
  const mine = await call("GET", "/api/my/reservations", { auth: token("Huesped4242@test.invalid") });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.length, 1);
  assert.equal(mine.data[0].reservation_code, code);
  assert.equal(mine.data[0].notes, undefined);
  assert.equal((await call("GET", "/api/my/reservations", { auth: token("otra@test.invalid") })).data.length, 0);
  assert.equal((await call("GET", "/api/my/reservations")).status, 401);
  assert.equal((await call("GET", "/api/my/reservations", { auth: token("huesped4242@test.invalid", false) })).status, 401);
});
test("el huésped descarga y borra sus datos (se conservan montos y fechas)", async () => {
  const sat = nextDay(6, 480);
  const r = await book(5, sat, plus(sat, 1), { notes: "Alergia a los frutos secos", customer: { name: "Ana Prueba", email: "ana.priv@test.invalid", phone: "3011234567", document_id: "123456" } });
  const code = r.data.reservation_code;
  const exp = await call("GET", `/api/privacy/export?code=${code}&contact=ana.priv@test.invalid`);
  assert.equal(exp.status, 200);
  assert.equal(exp.data.customer.document_id, "123456");
  assert.match(exp.data.reservations[0].notes, /Alergia/);
  assert.equal((await call("POST", "/api/privacy/delete", { body: { code, contact: "ana.priv@test.invalid" } })).status, 400, "falta confirmar");
  const del = await call("POST", "/api/privacy/delete", { body: { code, contact: "ana.priv@test.invalid", confirm: true } });
  assert.equal(del.status, 200);
  assert.equal((await call("GET", `/api/privacy/export?code=${code}&contact=ana.priv@test.invalid`)).status, 404);
  const rows = (await call("GET", "/api/reservations", { auth: admin() })).data;
  const row = rows.find((x: any) => x.reservation_code === code);
  assert.equal(row.customer_name, "Cliente anonimizado");
  assert.equal(row.customer_email, "");
  assert.equal(row.notes, "");
  assert.equal(row.total_amount, 450000);
});
test("los intentos de la consulta de privacidad tienen límite", async () => {
  let last = 0;
  for (let i = 0; i < 14; i++) last = (await call("GET", "/api/privacy/export?code=EGC-0001&contact=a@b.co")).status;
  assert.equal(last, 429);
});

// ---------------------------------------------------------------- pagos y finanzas
test("los pagos actualizan el saldo, no pueden pasarse y alimentan las finanzas", async () => {
  const sat = nextDay(6, 520);
  const r = await book(1, sat, plus(sat, 1));
  const row = (await call("GET", "/api/reservations", { auth: admin() })).data.find((x: any) => x.reservation_code === r.data.reservation_code);
  const pay = (amount: number) => call("POST", "/api/payments", { auth: admin(), body: { reservation_id: row.id, amount, method: "Transferencia Bancaria", user_name: "Prueba" } });
  assert.equal((await pay(0)).status, 400);
  assert.equal((await pay(100000)).status, 200);
  let cur = (await call("GET", "/api/reservations", { auth: admin() })).data.find((x: any) => x.id === row.id);
  assert.equal(cur.payment_status, "Parcial");
  assert.equal(cur.amount_pending, 250000);
  assert.equal((await pay(999999)).status, 400);
  assert.equal((await call("POST", "/api/payments", { auth: admin(), body: { reservation_id: 99999, amount: 1000, method: "x" } })).status, 404);
  assert.equal((await pay(250000)).status, 200);
  cur = (await call("GET", "/api/reservations", { auth: admin() })).data.find((x: any) => x.id === row.id);
  assert.equal(cur.payment_status, "Pagado");
  assert.equal(cur.amount_pending, 0);
  const payments = (await call("GET", "/api/payments", { auth: admin() })).data;
  assert.ok(payments.some((p: any) => p.reservation_code === r.data.reservation_code && p.amount === 250000 && p.customer_name));
  const fin = (await call("GET", "/api/finances/summary", { auth: admin() })).data;
  assert.equal(fin.todayRevenue, 350000);
  assert.equal(fin.totalCollected, 350000);
  assert.ok(fin.totalBooked > 0 && Array.isArray(fin.dailyChart) && fin.dailyChart[0].total === 350000);
  const dash = (await call("GET", "/api/dashboard/metrics", { auth: admin() })).data;
  assert.equal(dash.activeDomesList.length, 6);
  assert.ok(dash.pendingReservations > 0 && dash.reservationsToday > 0);
  assert.equal((await call("GET", "/api/analytics/charts", { auth: admin() })).data.domeOccupancy.length, 6);
});
test("cambiar el estado de una reserva queda registrado", async () => {
  const row = (await call("GET", "/api/reservations", { auth: admin() })).data[0];
  assert.equal((await call("PUT", `/api/reservations/${row.id}/status`, { auth: admin(), body: { status: "Confirmada", user_name: "Prueba" } })).status, 200);
  assert.equal((await call("GET", "/api/reservations", { auth: admin() })).data.find((x: any) => x.id === row.id).status, "Confirmada");
  const audit = (await call("GET", "/api/audit", { auth: admin() })).data;
  assert.ok(audit.length > 3 && audit.length <= 100);
  assert.ok(audit.some((a: any) => a.action === "ACTUALIZAR_ESTADO_RESERVA"));
  assert.ok(audit[0].timestamp >= audit[audit.length - 1].timestamp, "más recientes primero");
});

// ---------------------------------------------------------------- contenido editable por administración
test("domos: crear, editar precio y fotos", async () => {
  const created = await call("POST", "/api/domes", { auth: admin(), body: { name: "Domo 7", code: "DOMO-07", description: "Nuevo", capacity: 2, price_per_night: 500000, image_url: "/a.jpg", images: ["/a.jpg"], features: "x", policies: "y" } });
  assert.equal(created.status, 200);
  assert.equal(created.data.id, 7);
  assert.equal((await call("PUT", "/api/domes/7", { auth: admin(), body: { name: "Domo 7", code: "DOMO-07", description: "Nuevo", capacity: 2, price_per_night: 510000, image_url: "/a.jpg", status: "Disponible", features: "x", policies: "y" } })).status, 200);
  assert.equal((await call("PUT", "/api/domes/7/images", { auth: admin(), body: { images: ["/b.jpg", "/c.jpg"] } })).status, 200);
  const d7 = (await call("GET", "/api/domes")).data.find((d: any) => d.id === 7);
  assert.equal(d7.price_per_night, 510000);
  assert.deepEqual(d7.images, ["/b.jpg", "/c.jpg"]);
  // editar sin enviar fotos conserva las anteriores
  await call("PUT", "/api/domes/7", { auth: admin(), body: { name: "Domo 7", code: "DOMO-07", description: "Nuevo", capacity: 2, price_per_night: 520000, image_url: "/a.jpg", status: "Disponible", features: "x", policies: "y" } });
  assert.deepEqual((await call("GET", "/api/domes")).data.find((d: any) => d.id === 7).images, ["/b.jpg", "/c.jpg"]);
});
test("menú, galería, testimonios y fotos de ubicación", async () => {
  const dish = await call("POST", "/api/menu", { auth: admin(), body: { title: "Limonada", category: "Bebidas", price: 8000, sides: ["Hielo"] } });
  assert.equal(dish.status, 200);
  assert.equal((await call("PUT", `/api/menu/${dish.data.id}`, { auth: admin(), body: { price: 9000 } })).status, 200);
  const menu = (await call("GET", "/api/menu")).data.find((m: any) => m.id === dish.data.id);
  assert.equal(menu.price, 9000);
  assert.equal(menu.title, "Limonada", "los campos que no se envían se conservan");
  assert.equal(menu.sides, '["Hielo"]');

  const g = await call("POST", "/api/gallery", { auth: admin(), body: { title: "Foto nueva", media_url: "/assets/images/x.jpg" } });
  assert.equal((await call("GET", "/api/gallery")).data[0].id, g.data.id, "lo más nuevo primero");
  assert.equal((await call("DELETE", `/api/gallery/${g.data.id}`, { auth: admin() })).status, 200);
  assert.equal((await call("GET", "/api/gallery")).data.length, 12);

  const t = await call("POST", "/api/testimonials", { auth: admin(), body: { name: "Carla", comment: "Hermoso lugar", rating: 5 } });
  assert.equal(t.status, 200);
  assert.equal((await call("PUT", `/api/testimonials/${t.data.id}`, { auth: admin(), body: { image: "/assets/images/t.jpg" } })).status, 200);
  assert.equal((await call("GET", "/api/testimonials")).data[0].image, "/assets/images/t.jpg");

  assert.equal((await call("POST", "/api/location-photos", { auth: admin(), body: { url: "https://evil.example/x.jpg" } })).status, 400);
  const lp = await call("POST", "/api/location-photos", { auth: admin(), body: { url: "https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media" } });
  assert.equal(lp.status, 200);
  assert.equal((await call("GET", "/api/location-photos")).data.length, 1);
  assert.equal((await call("DELETE", `/api/location-photos/${lp.data.id}`, { auth: admin() })).status, 200);
});
test("subir archivos: solo imágenes y videos permitidos, desde un data URL", async () => {
  const png = "data:image/png;base64," + Buffer.from("png-de-prueba").toString("base64");
  const up = await call("POST", "/api/upload-image", { auth: admin(), body: { domeId: 1, imageData: png } });
  assert.equal(up.status, 200);
  assert.match(up.data.url, /^\/assets\/images\/image_/);
  assert.equal(uploader.saved.length, 1);
  assert.equal((await call("GET", "/api/domes")).data[0].images[0], up.data.url, "se agrega a las fotos del domo");
  const media = await call("POST", "/api/upload-media", { auth: admin(), body: { mediaData: "data:video/mp4;base64," + Buffer.from("v").toString("base64") } });
  assert.equal(media.data.media_type, "video");
  assert.equal((await call("POST", "/api/upload-image", { auth: admin(), body: { imageData: "data:application/pdf;base64,AAAA" } })).status, 400);
  assert.equal((await call("POST", "/api/upload-image", { auth: admin(), body: { imageData: "no-es-un-data-url" } })).status, 400);
  assert.equal((await call("POST", "/api/upload-video", { auth: admin(), body: { videoData: png } })).status, 400, "una imagen no es un video");
});
test("ajustes y usuarios", async () => {
  assert.equal((await call("PUT", "/api/settings", { auth: admin(), body: { glamping_name: "Eco Glamping Chinauta", extra: "valor" } })).status, 200);
  const s = (await call("GET", "/api/settings", { auth: admin() })).data;
  assert.equal(s.extra, "valor");
  assert.equal(s.currency, "COP");
  assert.equal((await call("POST", "/api/users", { auth: admin(), body: { username: "ana", password: "corta" } })).status, 400);
  assert.equal((await call("POST", "/api/users", { auth: admin(), body: { username: "ana", password: "una-clave-larga", full_name: "Ana", email: "ana@x.co", role: "ADMIN" } })).status, 200);
  assert.equal((await call("POST", "/api/users", { auth: admin(), body: { username: "ana", password: "una-clave-larga" } })).status, 400, "usuario repetido");
  const users = (await call("GET", "/api/users", { auth: admin() })).data;
  assert.equal(users.length, 1);
  assert.equal(users[0].password_hash, undefined);
});

// ---------------------------------------------------------------- respuestas siempre en JSON
test("JSON mal formado, rutas inexistentes y cuerpos vacíos responden JSON", async () => {
  const bad = await call("POST", "/api/reservations", { raw: "{no es json" });
  assert.equal(bad.status, 400);
  assert.ok(bad.type.includes("application/json"));
  const plain = await call("POST", "/api/reservations", { raw: "hola", type: "text/plain" });
  assert.equal(plain.status, 400);
  assert.ok(plain.type.includes("application/json"));
  const nope = await call("GET", "/api/ruta-que-no-existe", { auth: admin() });
  assert.equal(nope.status, 404);
  assert.ok(nope.type.includes("application/json"));
});

// ---------------------------------------------------------------- menú aprobado
const parseList = (v: any) => (typeof v === "string" ? JSON.parse(v || "[]") : v || []);
test("el menú inicial del servidor coincide con el menú aprobado (platos, fotos, descripciones y precios)", async () => {
  const api = (await call("GET", "/api/menu")).data;
  const want = DEFAULT_MENU_ITEMS;
  assert.equal(api.length >= want.length, true);
  for (const w of want) {
    const a = api.find((x: any) => x.id === w.id);
    assert.ok(a, `falta el plato ${w.id}`);
    for (const k of ["item_number", "title", "title_en", "category", "category_en", "description", "description_en", "beverage", "beverage_en", "price", "image", "badge", "badge_en"] as const)
      assert.equal(a[k], (w as any)[k], `plato ${w.id}: ${k}`);
    for (const k of ["preparations", "preparations_en", "sides", "sides_en", "images"] as const)
      assert.deepEqual(parseList(a[k]), (w as any)[k], `plato ${w.id}: ${k}`);
    assert.ok(!/unsplash/.test(String(a.image)), "sin fotos de stock");
  }
});
test("restaurar el menú original: solo administrador, reemplaza los platos y queda en la auditoría", async () => {
  assert.equal((await call("POST", "/api/menu/restore-defaults", { body: {} })).status, 401);
  assert.equal((await call("POST", "/api/menu/restore-defaults", { auth: token("otro@test.invalid"), body: {} })).status, 401);
  // el dueño cambia un plato y agrega otro
  await call("PUT", "/api/menu/1", { auth: admin(), body: { title: "Plato cambiado", price: 1, image: "https://images.unsplash.com/x" } });
  await call("POST", "/api/menu", { auth: admin(), body: { title: "Plato extra", category: "Bebidas", price: 5000 } });
  const r = await call("POST", "/api/menu/restore-defaults", { auth: admin(), body: {} });
  assert.equal(r.status, 200);
  const menu = (await call("GET", "/api/menu")).data;
  assert.deepEqual(menu.map((m: any) => m.id).sort(), DEFAULT_MENU_ITEMS.map((m) => m.id).sort());
  const one = menu.find((m: any) => m.id === 1);
  assert.equal(one.title, DEFAULT_MENU_ITEMS[0].title);
  assert.equal(one.price, 60000);
  assert.ok(String(one.image).startsWith("/assets/images/"));
  const log = (await call("GET", "/api/audit", { auth: admin() })).data;
  assert.ok(log.some((l: any) => l.action === "RESTAURAR_MENU"));
  // un plato nuevo después de restaurar recibe un id nuevo (sin chocar con los restaurados)
  const nuevo = await call("POST", "/api/menu", { auth: admin(), body: { title: "Limonada 2", category: "Bebidas", price: 8000 } });
  assert.equal(nuevo.status, 200);
  assert.ok(Number(nuevo.data.id) > 5);
});

// ---------------------------------------------------------------- seguridad
test("límite de intentos: la validación de códigos promo frena el abuso (429 con Retry-After)", async () => {
  const strict = createApp({
    store: new MemoryStore(), uploader,
    env: { FIREBASE_PROJECT_ID: PROJECT, ADMIN_EMAILS: ADMIN } as NodeJS.ProcessEnv,
    getCert: async () => undefined,
  });
  const srv = http.createServer(strict);
  await new Promise<void>((r) => srv.listen(0, r));
  const url = `http://127.0.0.1:${(srv.address() as any).port}/api/promo-codes/validate?code=X&check_in=2030-01-01`;
  let last: Response | undefined;
  for (let i = 0; i < 32; i++) last = await fetch(url);
  srv.close();
  assert.equal(last!.status, 429);
  assert.ok(last!.headers.get("retry-after"));
  assert.ok((last!.headers.get("content-type") || "").includes("application/json"));
});
test("cuerpos de más de 1 MB se rechazan (413) fuera de las subidas del administrador", async () => {
  const big = JSON.stringify({ customer: { name: "x".repeat(1_500_000) } });
  const r = await call("POST", "/api/reservations", { raw: big });
  assert.equal(r.status, 413);
  assert.ok(r.type.includes("application/json"));
});
test("las respuestas de la API llevan cabeceras de seguridad y no revelan Express", async () => {
  const res = await fetch(base + "/api/domes");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-powered-by"), null);
});

(async () => {
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  let failed = 0;
  for (const [name, fn] of cases) {
    try { await fn(); console.log(`ok   ${name}`); }
    catch (e: any) { failed++; console.log(`FAIL ${name}\n     ${String(e.message).split("\n").slice(0, 4).join("\n     ")}`); }
  }
  server.close();
  console.log(`\n${cases.length - failed}/${cases.length} pruebas correctas (${useFirestore ? "Firestore falso" : "memoria"})`);
  process.exit(failed ? 1 : 0);
})();

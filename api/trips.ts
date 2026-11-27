/**
 * "Voy en camino": el huésped comparte su ubicación el día de llegada y el equipo ve cuánto le falta.
 *
 * - Solo se guarda la ÚLTIMA ubicación (no el recorrido) y se borra al llegar, al hacer check-in,
 *   al detener el seguimiento o a las 12 horas.
 * - Tiempo de llegada: con GOOGLE_MAPS_API_KEY (Routes API) se usa la ruta real con tráfico;
 *   sin esa llave se estima por distancia (aproximado).
 */

export interface LatLng { lat: number; lng: number }

export type EtaSource = "google" | "estimado" | "sin_destino";
export interface Eta { minutes: number | null; distance_km: number | null; source: EtaSource }

/** Llegó: a menos de esta distancia del glamping. */
export const ARRIVAL_KM = 0.3;
/** Después de este tiempo sin datos, la ubicación se borra. */
export const TRIP_EXPIRE_MS = 12 * 60 * 60 * 1000;
/** Para no gastar consultas de Google: como mucho una cada 2 minutos por reserva. */
export const GOOGLE_MIN_INTERVAL_MS = 2 * 60 * 1000;

export function validLatLng(lat: unknown, lng: unknown): LatLng | null {
  const a = Number(lat), b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}

/** Distancia en línea recta (km). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Estimación sin servicio de mapas: las carreteras de montaña son ~1,6 veces la línea recta
 * (Bogotá–Chinauta: ~55 km en línea recta, ~90 km por carretera) a unos 40 km/h de promedio;
 * cerca del destino, más despacio.
 */
export function estimateEta(from: LatLng, to: LatLng): Eta {
  const straight = haversineKm(from, to);
  const road = straight * 1.6;
  const speed = road < 5 ? 25 : 40;
  return { minutes: Math.max(1, Math.round((road / speed) * 60)), distance_km: round1(road), source: "estimado" };
}

/** Ruta real con tráfico (Google Routes API). Devuelve null si falla, para usar la estimación. */
export async function googleEta(from: LatLng, to: LatLng, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<Eta | null> {
  try {
    const res = await fetchImpl("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    });
    if (!res.ok) {
      console.error("[trip] Google Routes respondió", res.status);
      return null;
    }
    const data: any = await res.json();
    const route = data?.routes?.[0];
    const seconds = parseInt(String(route?.duration || "").replace(/s$/, ""), 10);
    if (!route || !Number.isFinite(seconds)) return null;
    return {
      minutes: Math.max(1, Math.round(seconds / 60)),
      distance_km: round1(Number(route.distanceMeters || 0) / 1000),
      source: "google",
    };
  } catch (err) {
    console.error("[trip] No se pudo consultar Google Routes:", err);
    return null;
  }
}

/** Los campos de seguimiento que se borran (privacidad). */
export const CLEARED_TRIP_LOCATION = { trip_lat: null, trip_lng: null, trip_accuracy: null } as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

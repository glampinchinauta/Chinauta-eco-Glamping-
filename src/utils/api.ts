import { COMPANY } from '../config/legal';

/**
 * Reads the JSON body of a response from our own API.
 * If the server answered with something that is not JSON (for example an HTML error page or a plain "NOT_FOUND"),
 * it throws a clear message instead of the confusing "Unexpected token '<'" error.
 */
export async function readJson<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `El servicio no respondió correctamente (código ${res.status}). ` +
      `Inténtalo de nuevo en unos minutos o escríbenos por WhatsApp al ${COMPANY.phone}.`
    );
  }
}

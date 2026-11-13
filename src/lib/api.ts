// Reads an API response safely. If the server answers with plain text or HTML (for example a hosting 404 page),
// the guest gets a clear message instead of a technical JSON error.
export async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: 'El servidor no respondió correctamente. Intenta de nuevo en unos minutos o escríbenos por WhatsApp.',
    };
  }
}

# Eco Glamping Chinauta

Sitio web de reservas y panel de administración de **Eco Glamping Chinauta** (Chinauta / Fusagasugá, Cundinamarca, Colombia).

## Qué incluye
- Sitio público: domos, galería, menú, testimonios, clima, mapa, preguntas frecuentes y asistente virtual (Gemini).
- Reservas por noche o pasadía, con disponibilidad, descuentos, códigos promocionales y comida.
- Cuentas de cliente ("Mis reservas") y consulta de reserva por código.
- Panel de administración (inicio de sesión con Google): reservas, pagos, domos, precios, menú, galería, usuarios y finanzas.
- Privacidad (Ley 1581 de 2012): descarga y borrado de datos por el propio huésped, banner de cookies y analítica solo con consentimiento.

## Tecnologías
React 19 + Vite + Tailwind 4 (sitio) · Express (API) · Firestore y Firebase Storage (datos) · Firebase Auth (sesiones) · Vercel (hosting).

## Estructura
| Carpeta / archivo | Contenido |
|---|---|
| `src/` | Sitio (componentes React, estilos, idiomas) |
| `api/` | API: `app.ts` (rutas), `store.ts` (datos), `uploads.ts` (fotos y videos), `index.ts` (función de Vercel) |
| `server.ts` | Servidor local (desarrollo) |
| `tests/` | Pruebas automáticas |
| `docs/` | `FIRESTORE.md` (puesta en marcha en Vercel), `requerimientos.md` |
| `firestore.rules` | Reglas de Firestore: el navegador no accede a los datos, solo el servidor |

## Instalación y uso local
```bash
bun install        # o: npm install --legacy-peer-deps
cp .env.example .env.local   # completar las variables
npm run dev        # http://localhost:3000
```
Sin credenciales de Firestore, el servidor local usa memoria (los datos se pierden al reiniciar).

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | Revisión de tipos (TypeScript) |
| `npm test` | Pruebas automáticas (memoria, Firestore falso y sesiones) |
| `npm run build` | Genera el sitio en `dist/` |

## Variables de entorno
Ver `.env.example` y `docs/FIRESTORE.md`. Las principales: `FIREBASE_SERVICE_ACCOUNT_BASE64` (secreta), `ADMIN_EMAILS`, `GEMINI_API_KEY` (secreta), `VITE_GA_MEASUREMENT_ID`. **Nunca se suben llaves ni contraseñas al repositorio.**

## Seguridad
- Todo lo que no es público exige ser administrador (se verifica el token de Google en el servidor).
- Los datos solo se leen y escriben desde el servidor; `firestore.rules` bloquea el acceso directo desde el navegador.
- Cuerpos de petición limitados a 1 MB (50 MB solo en subidas del administrador), límite de intentos en reservas, asistente, códigos promo y consultas, y cabeceras de seguridad (`vercel.json`).

## Despliegue
Vercel despliega automáticamente. Cambiar producción o el dominio requiere autorización del propietario.

## Pendiente
Pasarela de pagos en línea y confirmaciones automáticas por WhatsApp o correo (se evalúan costos antes de contratar).

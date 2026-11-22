# Datos en Firestore: cómo dejarlo funcionando en Vercel

La API (reservas, disponibilidad, menú, galería, pagos…) ahora corre como **función de Vercel** (`api/index.ts`)
y guarda todo en **Firestore**. Antes usaba un archivo SQLite, que en Vercel no se puede guardar.

## Lo que tienes que hacer tú (una sola vez)

### 1. Confirmar que Firestore existe
Firebase Console → proyecto `eco-glampin-chinauta` → **Firestore Database**. Debe existir la base indicada en
`firebase-applet-config.json` (`firestoreDatabaseId`). Si no existe, créala en modo **Nativo**.

### 1b. Activar el inicio de sesión (Firebase → Authentication)
- **Método de acceso**: activa **Google** (panel de administración) y **Correo y contraseña** (clientes).
- **Configuración → Dominios autorizados**: agrega el dominio de Vercel (`tu-proyecto.vercel.app`) y el dominio propio: `www.ecoglamping.app` y `ecoglamping.app` (sin esto, el inicio de sesión con Google falla en ese dominio).
- No pongas `FIREBASE_PROJECT_ID` en Vercel con el proyecto anterior: se toma de `firebase-applet-config.json` (`eco-glampin-chinauta`) y debe coincidir con el de la llave del servidor.
- El secreto del cliente OAuth se pega solo en la consola de Firebase; nunca va en el código ni en el chat.

### 2. Crear la llave del servidor
Firebase Console → ⚙ Configuración del proyecto → **Cuentas de servicio** → **Generar nueva clave privada**.
Se descarga un archivo `.json`. **No lo subas a GitHub ni lo compartas por chat.**

Conviértelo a base64 (en PowerShell, cambia la ruta):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\mi-llave.json")) | Set-Clipboard
```

### 3. Variables en Vercel (Settings → Environment Variables, para Production y Preview)

| Variable | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | lo que copiaste en el paso 2 (márcala como **Sensitive**) |
| `ADMIN_EMAILS` | correos con permiso de administrador, separados por coma (hoy `ecoglampingventas@gmail.com`) |
| `GEMINI_API_KEY` | llave de Gemini para el asistente virtual (de la cuenta del cliente) |
| `VITE_GA_MEASUREMENT_ID` | opcional, el ID `G-…` de Google Analytics (solo carga si el visitante acepta cookies) |
| `SUBADMIN_EMAILS` | opcional, correos de recepción (subadministradores), separados por coma |
| `RESEND_API_KEY` | opcional, llave de Resend para enviar avisos de reserva por correo (marcar **Sensitive**) |
| `NOTIFY_EMAILS` | opcional, correos que reciben el aviso de cada reserva (si no, usa `ADMIN_EMAILS`) |
| `NOTIFY_FROM` | opcional, remitente verificado en Resend, p. ej. `Eco Glamping <reservas@ecoglamping.app>` |

Opcionales, solo si cambian: `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `FIREBASE_STORAGE_BUCKET`.
Después de guardar las variables, haz un **Redeploy**.

### 4. Para subir fotos desde el panel
Activa **Storage** en Firebase Console (el bucket suele ser `eco-glampin-chinauta.firebasestorage.app`).
Las fotos se guardan ahí con un enlace público.

## Cómo comprobar que quedó bien
1. Abre `https://TU-SITIO/api/domes`: debe mostrar un JSON con 6 domos y sus precios.
   La primera vez, el servidor carga los datos iniciales (domos, menú, galería y ajustes) en Firestore.
2. Haz una reserva de prueba en el sitio. En Firebase Console → Firestore debe aparecer la colección `egc_reservations`.
3. Si ves "El servicio de reservas no está disponible", falta la variable `FIREBASE_SERVICE_ACCOUNT_BASE64` (o es inválida).
   Mira el detalle en Vercel → Logs.

## Qué guarda y dónde
Las colecciones empiezan con `egc_`: `egc_domes`, `egc_menu_items`, `egc_gallery_items`, `egc_reservations`,
`egc_customers`, `egc_payments`, `egc_maintenance_blocks`, `egc_promo_codes`, `egc_testimonials`,
`egc_location_photos`, `egc_settings`, `egc_users`, `egc_audit_logs`.
El navegador **no** lee ni escribe estas colecciones: solo el servidor (con la llave de cuenta de servicio).
No hace falta crear índices.

## Desarrollo en tu computador
`npm run dev` usa una base **en memoria** (los datos se pierden al cerrar) a menos que definas
`FIREBASE_SERVICE_ACCOUNT_BASE64` en un archivo `.env.local`. Con credenciales reales, apunta a Firestore de verdad:
úsalo con cuidado.

## Pruebas
- `npm test`: servidor completo con datos en memoria y con un Firestore simulado (reservas, precios, pagos, privacidad…).
- `npm run test:http`: compila y prueba el servidor real en desarrollo y producción.

## Límites y cosas que debes saber
- **Tamaño de archivos:** Vercel acepta solicitudes de hasta ~4,5 MB. Las fotos del panel deben pesar menos de ~3 MB;
  los videos grandes no se pueden subir por esta vía (usa un enlace).
- **Límite de intentos de la consulta de privacidad:** cuenta por instancia del servidor, no es global.
- **Gráficas del panel de administración** (`/api/analytics/charts`): se calculan con las reservas reales (por mes de llegada; ocupación de los últimos 30 días). Sin reservas muestran ceros.
- **Mascotas:** se aceptan en todos los domos, bien comportadas, con $30.000 por mascota por estadía (texto de domos, formulario y SEO coinciden).
- **Roles:** `ADMIN_EMAILS` = administrador total. Recepción (ve todo; solo cambia reservas, pagos, clientes y bloqueos; no ve accesos, auditoría ni ajustes) se maneja **desde el panel, en Equipo → Accesos**: el administrador escribe el correo de la persona y listo, sin tocar Vercel. Esa lista se guarda en Firestore (colección `staff`). `SUBADMIN_EMAILS` sigue funcionando como lista fija opcional. El servidor lo verifica en cada solicitud y exige correo verificado.
- **Entrada al panel:** con Google o con correo y contraseña. La persona crea su propia contraseña en el modal («Crear mi contraseña (primera vez)») y confirma su correo; para entrar, su correo debe estar autorizado. Requiere el método «Correo electrónico/contraseña» activado en Firebase → Authentication → Método de acceso.
- **Reservas manuales:** el botón «Nueva reserva» del panel usa la misma ruta que el sitio (el valor lo calcula el servidor) y exige confirmar que el huésped aceptó los términos y es mayor de edad.
- **Avisos de reserva:** el cliente ve un botón "Confirmar por WhatsApp" al terminar. Si defines `RESEND_API_KEY`, también salen correos al administrador y al cliente.
- **Inicio de sesión por usuario y contraseña propio** (`/api/auth/login`) se eliminó. Las contraseñas las maneja Firebase Authentication (nunca se guardan en este proyecto).
- El archivo `glamping.db` (SQLite) ya no se usa y se quitó del repositorio.

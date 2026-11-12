import React, { useState } from 'react';
import { COMPANY, LEGAL_VERSION, RETENTION_PERIODS } from '../config/legal';

type LegalSection = 'privacidad' | 'terminos' | 'reembolsos' | 'cookies' | 'derechos' | 'mis-datos';

const SECTIONS: { id: LegalSection; label: string }[] = [
  { id: 'privacidad', label: 'Privacidad' },
  { id: 'terminos', label: 'Términos y condiciones' },
  { id: 'reembolsos', label: 'Reembolsos y cancelaciones' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'derechos', label: 'Derechos de autor' },
  { id: 'mis-datos', label: 'Mis datos' },
];

/** Resalta cualquier texto marcado como [PENDIENTE: ...] para que no se publique sin completarlo. */
const Rich: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\[PENDIENTE[^\]]*\])/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('[PENDIENTE') ? (
          <mark key={i} className="bg-amber-100 text-amber-900 font-semibold rounded px-1">{part}</mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

const pendingIfEmpty = (value: string) => (value.includes('PENDIENTE') ? `[${value}]` : value);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-bold text-slate-900 mt-8">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
  </section>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => <p>{children}</p>;

const Notice: React.FC = () => (
  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
    Texto preparado como punto de partida para el propietario. Antes de publicarlo, completa los datos marcados como
    [PENDIENTE] y revísalo con un abogado en Colombia.
  </div>
);

const PrivacyContent: React.FC = () => (
  <>
    <Section title="1. Quién es el responsable de tus datos">
      <P><Rich text={`${pendingIfEmpty(COMPANY.legalName)} · NIT ${pendingIfEmpty(COMPANY.nit)} · RNT ${pendingIfEmpty(COMPANY.rnt)}`} /></P>
      <P>Dirección: {COMPANY.address}. Correo para tus derechos: {COMPANY.dataControllerEmail}. WhatsApp: {COMPANY.phone}.</P>
    </Section>

    <Section title="2. Qué datos recogemos">
      <ul className="list-disc pl-5 space-y-1">
        <li>Para reservar: nombre, correo electrónico y teléfono o WhatsApp.</li>
        <li>Documento de identidad: <Rich text="[PENDIENTE: confirmar si es obligatorio por el registro de huéspedes; hoy es opcional]" />.</li>
        <li>Datos de la reserva: fechas, domo, número de huéspedes, mascotas, complementos, comidas y notas que escribas.</li>
        <li>Tu aceptación de estos términos, la fecha y la versión aceptada, y tu confirmación de ser mayor de edad.</li>
        <li>Tu autorización para ofertas, solo si la marcas (es una casilla aparte y sin marcar).</li>
      </ul>
      <P>No pedimos datos sensibles (salud, creencias, orientación sexual, biométricos) ni datos financieros de tarjetas en este sitio.</P>
    </Section>

    <Section title="3. Para qué usamos tus datos">
      <ul className="list-disc pl-5 space-y-1">
        <li>Gestionar tu reserva, confirmarla, enviarte información de tu estadía y atenderte.</li>
        <li>Emitir facturas y cumplir obligaciones contables, tributarias y de registro de huéspedes.</li>
        <li>Enviarte ofertas y novedades solo si nos diste autorización. Puedes retirarla en cualquier momento desde "Mis datos" o escribiéndonos.</li>
        <li>Proteger el sitio y prevenir fraude.</li>
      </ul>
    </Section>

    <Section title="4. Menores de edad">
      <P>
        Las reservas solo las puede hacer una persona mayor de 18 años, que debe confirmarlo al reservar. No recogemos
        a sabiendas datos de menores de edad. Si un menor se hospeda con un adulto, el adulto responsable es quien
        reserva y da sus datos. Si detectamos que hemos recogido datos de un menor, los eliminaremos.
      </P>
    </Section>

    <Section title="5. Asistente virtual con inteligencia artificial">
      <P>
        Las preguntas que escribes en el asistente se envían a Google (Gemini API) solo para generar la respuesta. El sitio
        no guarda esas conversaciones. No usamos tus datos para entrenar modelos de IA. Las respuestas son orientativas:
        la reserva solo queda confirmada cuando la confirmamos por nuestros canales.
      </P>
      <P>
        <Rich text="[PENDIENTE: verificar en las condiciones de la API contratada que Google no usa estos datos para entrenar modelos]" />
      </P>
    </Section>

    <Section title="6. Con quién compartimos tus datos">
      <P>Usamos proveedores que tratan datos por cuenta nuestra. Los publicamos para que sepas quién los procesa:</P>
      <ul className="list-disc pl-5 space-y-1">
        <li>Google (Firebase): autenticación del personal administrativo. Acuerdo de tratamiento: <Rich text="[PENDIENTE: firmar o aceptar el acuerdo de tratamiento de datos]" />.</li>
        <li>Google (Gemini API): procesa los mensajes del asistente virtual. Acuerdo de tratamiento: <Rich text="[PENDIENTE]" />.</li>
        <li>Meta (WhatsApp): solo si tú nos escribes o abres un enlace de WhatsApp desde el sitio.</li>
        <li>Pasarelas de pago (Wompi, Mercado Pago): <Rich text="[PENDIENTE: el sitio ofrece estos métodos pero aún no están integrados; eliminarlos o integrarlos y publicar el proveedor]" />.</li>
      </ul>
      <P>No vendemos tus datos.</P>
    </Section>

    <Section title="7. Cuánto tiempo guardamos tus datos">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border border-slate-200">
          <thead className="bg-slate-100 text-slate-900">
            <tr>
              <th className="p-2 border-b border-slate-200">Dato</th>
              <th className="p-2 border-b border-slate-200">Plazo</th>
              <th className="p-2 border-b border-slate-200">Razón</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION_PERIODS.map((row) => (
              <tr key={row.data} className="align-top">
                <td className="p-2 border-b border-slate-100">{row.data}</td>
                <td className="p-2 border-b border-slate-100">{row.period}</td>
                <td className="p-2 border-b border-slate-100">{row.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>Al vencer el plazo, eliminamos o anonimizamos los datos. Los plazos propuestos deben confirmarse con el contador.</P>
    </Section>

    <Section title="8. Tus derechos">
      <P>
        Como titular de tus datos (Ley 1581 de 2012) puedes conocerlos, actualizarlos, corregirlos, pedir su supresión,
        revocar tu autorización y presentar quejas ante la Superintendencia de Industria y Comercio (SIC).
      </P>
      <P>
        Puedes descargar y eliminar tus datos tú mismo en la pestaña "Mis datos", con tu código de reserva y tu correo o
        teléfono. También puedes escribirnos a {COMPANY.dataControllerEmail}. Responderemos las consultas en un plazo de 10
        días hábiles y los reclamos en un plazo de 15 días hábiles (Ley 1581 de 2012).
      </P>
    </Section>

    <Section title="9. Seguridad">
      <P>
        Las contraseñas del personal se guardan cifradas y el acceso al panel administrativo requiere una sesión verificada.
        Ningún sistema es totalmente seguro; si detectamos una brecha que afecte tus datos, te informaremos.
      </P>
    </Section>

    <Section title="10. Cambios en esta política">
      <P>Versión vigente: {LEGAL_VERSION}. Si cambiamos cómo usamos tus datos, te pediremos de nuevo tu autorización cuando sea necesario.</P>
    </Section>
  </>
);

const TermsContent: React.FC = () => (
  <>
    <Section title="1. Aceptación">
      <P>
        Al reservar y marcar la casilla "Acepto los términos y condiciones, la política de privacidad y la política de
        reembolsos y cancelaciones", aceptas estas condiciones. Guardamos la fecha y la versión que aceptaste ({LEGAL_VERSION}).
      </P>
    </Section>

    <Section title="2. La reserva">
      <P>
        La reserva queda confirmada cuando recibimos el anticipo o el pago acordado y lo verificamos. Te enviaremos tu código
        de reserva. Las tarifas se muestran en pesos colombianos (COP) por noche, por domo, o por pasadía.
      </P>
      <P>
        <Rich text="[PENDIENTE: indicar si los precios incluyen IVA y el porcentaje del anticipo]" />
      </P>
    </Section>

    <Section title="3. Cargos y descuentos">
      <P>
        Los cargos adicionales (huéspedes extra, mascotas, decoración, masajes, zona BBQ, comidas del menú) se muestran
        desglosados en el resumen antes de confirmar. Lo que aparece en el resumen es lo que pagas.
      </P>
      <P>
        Descuento automático del 10% de lunes a jueves (no aplica en festivos). Los códigos promocionales tienen su propio
        porcentaje y no se acumulan con el descuento automático: se aplica el mayor.
      </P>
    </Section>

    <Section title="4. Llegada y salida">
      <P>
        Check-in: <Rich text="[PENDIENTE: hora de check-in; el sitio indica 3:00 p. m.]" />. Check-out:{' '}
        <Rich text="[PENDIENTE: hora de check-out]" />. Pasadía: de 8:00 a. m. a 4:00 p. m., de lunes a jueves.
      </P>
    </Section>

    <Section title="5. Huéspedes, mascotas y capacidad">
      <P>
        La capacidad de cada domo es la indicada en la reserva. Los huéspedes adicionales deben informarse al reservar.
        Las mascotas deben reportarse al reservar y se aceptan con las condiciones del domo.
      </P>
      <P>
        Las reservas las hace una persona mayor de 18 años. Usa las zonas comunes con cuidado; el fuego y la zona BBQ
        requieren supervisión de los adultos.
      </P>
    </Section>

    <Section title="6. Cancelaciones y reembolsos">
      <P>Las condiciones están en la pestaña "Reembolsos y cancelaciones".</P>
    </Section>

    <Section title="7. Disponibilidad de servicios">
      <P>
        Hacemos lo posible por mantener disponibles el jacuzzi, la zona de fogata, la zona BBQ y las demás áreas. Pueden
        existir interrupciones por mantenimiento, clima o falta de suministros; en ese caso te avisaremos lo antes posible
        y buscaremos una alternativa razonable.
      </P>
      <P>
        El clima, la lluvia, la niebla o el frío son parte del entorno natural. Por sí solos no dan derecho a reembolso,
        sin perjuicio de los derechos que te reconozca la ley.
      </P>
    </Section>

    <Section title="8. Opiniones de huéspedes">
      <P>
        Las opiniones publicadas en el sitio son de quienes las envían. Indicamos cuando una opinión no ha sido verificada.
        No publicamos calificaciones ni reseñas de terceros que no podamos comprobar.
      </P>
    </Section>

    <Section title="9. Contenido del sitio">
      <P>
        Las fotos, videos y textos del sitio pertenecen a la empresa o se usan con permiso. Algunas imágenes son
        ilustrativas: <Rich text="[PENDIENTE: indicar cuáles imágenes son generadas o recreadas con IA]" />. No las copies
        sin autorización.
      </P>
    </Section>

    <Section title="10. Asistente virtual">
      <P>El asistente con IA da información orientativa. Para tu reserva, lo que vale es la confirmación que te enviamos.</P>
    </Section>

    <Section title="11. Ley aplicable y quejas">
      <P>
        Estos términos se rigen por las leyes de Colombia. Como consumidor puedes acudir a la Superintendencia de Industria
        y Comercio (SIC) y tienes los derechos del Estatuto del Consumidor (Ley 1480 de 2011).
      </P>
    </Section>

    <Section title="12. Contacto">
      <P>{COMPANY.email} · {COMPANY.phone} · {COMPANY.address}</P>
    </Section>
  </>
);

const RefundsContent: React.FC = () => (
  <>
    <Notice />
    <Section title="1. Política de cancelación">
      <P>Estas son las condiciones propuestas. Quedan vigentes solo cuando el propietario las confirme.</P>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border border-slate-200">
          <thead className="bg-slate-100 text-slate-900">
            <tr>
              <th className="p-2 border-b border-slate-200">Cuándo cancelas</th>
              <th className="p-2 border-b border-slate-200">Reembolso</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="p-2 border-b border-slate-100">15 días o más antes del check-in</td><td className="p-2 border-b border-slate-100"><Rich text="[PENDIENTE: 100% menos X% de gastos administrativos]" /></td></tr>
            <tr><td className="p-2 border-b border-slate-100">Entre 7 y 14 días antes</td><td className="p-2 border-b border-slate-100"><Rich text="[PENDIENTE: porcentaje, por ejemplo 50%]" /></td></tr>
            <tr><td className="p-2 border-b border-slate-100">Menos de 7 días o no llegas (no show)</td><td className="p-2 border-b border-slate-100"><Rich text="[PENDIENTE: sin reembolso o porcentaje]" /></td></tr>
            <tr><td className="p-2 border-b border-slate-100">Pasadía</td><td className="p-2 border-b border-slate-100"><Rich text="[PENDIENTE]" /></td></tr>
          </tbody>
        </table>
      </div>
    </Section>

    <Section title="2. Cómo cancelar">
      <P>
        Cancelar es tan sencillo como reservar: escríbenos con tu código de reserva y la palabra "cancelar" y confirmamos
        tu solicitud por el mismo medio. Puedes hacerlo por correo, por WhatsApp o con el botón de abajo.
      </P>
      <P>
        <a
          href={`mailto:${COMPANY.email}?subject=${encodeURIComponent('Solicitud de cancelación de reserva')}&body=${encodeURIComponent('Código de reserva: \nNombre: \n')}`}
          className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
        >
          Solicitar cancelación por correo
        </a>
      </P>
    </Section>

    <Section title="3. Cambios de fecha">
      <P><Rich text="[PENDIENTE: condiciones para cambiar fechas, sujeto a disponibilidad]" /></P>
    </Section>

    <Section title="4. Derecho de retracto">
      <P>
        <Rich text="[PENDIENTE: revisión legal del derecho de retracto (Ley 1480 de 2011) y cómo aplica a reservas de hospedaje]" />
      </P>
    </Section>

    <Section title="5. Cuándo devolvemos el dinero">
      <P><Rich text="[PENDIENTE: plazo de devolución, por ejemplo 15 días hábiles, y medio de devolución]" /></P>
    </Section>
  </>
);

const CookiesContent: React.FC = () => (
  <>
    <Section title="1. Qué guardamos en tu navegador">
      <P>
        Este sitio no usa cookies de publicidad ni de analítica de terceros, ni píxeles de redes sociales.
        Solo guardamos en tu navegador lo necesario para el funcionamiento:
      </P>
      <ul className="list-disc pl-5 space-y-1">
        <li>Preferencias de la galería (fotos y videos que el personal sube a cada domo). Son de uso esencial.</li>
        <li>Sesión del panel administrativo, solo para el personal. Es esencial.</li>
        <li>Tu elección sobre este aviso de cookies (clave "egc_cookie_consent").</li>
      </ul>
    </Section>
    <Section title="2. Si cambiamos esto">
      <P>
        Si en el futuro usamos analítica o publicidad, esas herramientas no se activarán hasta que aceptes en este aviso,
        y podrás cambiar tu elección en cualquier momento desde esta página.
      </P>
    </Section>
  </>
);

const CopyrightContent: React.FC = () => (
  <>
    <Section title="Reclamos por derechos de autor">
      <P>
        Si crees que algo publicado en este sitio usa una obra tuya sin tu permiso, escríbenos a{' '}
        <a className="text-emerald-800 underline" href={`mailto:${COMPANY.copyrightEmail}`}>{COMPANY.copyrightEmail}</a> con:
      </P>
      <ul className="list-disc pl-5 space-y-1">
        <li>Descripción de la obra y prueba de que es tuya.</li>
        <li>Dónde aparece en el sitio (dirección o sección).</li>
        <li>Tu nombre, correo y teléfono.</li>
        <li>Una declaración de buena fe de que el uso no está autorizado.</li>
        <li>Tu firma (física o electrónica).</li>
      </ul>
      <P>Revisaremos la solicitud y, si procede, retiraremos el contenido. <Rich text="[PENDIENTE: plazo de respuesta]" /></P>
    </Section>
  </>
);

const MyDataContent: React.FC = () => {
  const [code, setCode] = useState('');
  const [contact, setContact] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const canSubmit = code.trim() !== '' && contact.trim() !== '';

  const download = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/privacy/export?code=${encodeURIComponent(code.trim())}&contact=${encodeURIComponent(contact.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo descargar tus datos.');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mis-datos-eco-glamping.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setIsError(false);
      setMessage('Tus datos se descargaron en un archivo JSON.');
    } catch (err: any) {
      setIsError(true);
      setMessage(err.message || 'No se pudo descargar tus datos.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setIsError(true);
      setMessage('Marca la casilla para confirmar la eliminación.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/privacy/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), contact: contact.trim(), confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar tus datos.');
      setIsError(false);
      setMessage(data.message || 'Tus datos personales fueron eliminados.');
      setConfirmDelete(false);
    } catch (err: any) {
      setIsError(true);
      setMessage(err.message || 'No se pudo eliminar tus datos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Descarga o elimina tus datos">
      <P>
        Para verificar que eres tú, escribe el código de reserva y el correo o teléfono que usaste al reservar.
      </P>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-800">
          Código de reserva
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            placeholder="EGC-0000"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-800">
          Correo o teléfono usado al reservar
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={download}
          disabled={!canSubmit || busy}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
        >
          Descargar mis datos
        </button>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3">
        <label className="flex items-start gap-2 text-xs text-rose-900">
          <input
            type="checkbox"
            checked={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            Entiendo que eliminaré mis datos personales (nombre, correo, teléfono, documento y notas). Los montos y fechas
            de mis reservas se conservan por obligación contable y tributaria, y no podré deshacer esta acción.
          </span>
        </label>
        <button
          type="button"
          onClick={remove}
          disabled={!canSubmit || busy}
          className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
        >
          Eliminar mis datos personales
        </button>
      </div>

      {message && (
        <p role="status" aria-live="polite" className={`text-sm font-semibold ${isError ? 'text-rose-800' : 'text-emerald-800'}`}>
          {message}
        </p>
      )}
    </Section>
  );
};

export const LegalView: React.FC<{ initialSection?: LegalSection }> = ({ initialSection = 'privacidad' }) => {
  const [section, setSection] = useState<LegalSection>(initialSection);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Información legal</h1>
        <p className="text-sm text-slate-700">Versión {LEGAL_VERSION}. Empresa responsable: {COMPANY.brandName}.</p>
      </header>

      <nav aria-label="Secciones legales" className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            aria-current={section === s.id ? 'page' : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              section === s.id
                ? 'border-emerald-800 bg-emerald-800 text-white'
                : 'border-slate-300 bg-white text-slate-800 hover:border-emerald-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <article>
        {section === 'privacidad' && <PrivacyContent />}
        {section === 'terminos' && <TermsContent />}
        {section === 'reembolsos' && <RefundsContent />}
        {section === 'cookies' && <CookiesContent />}
        {section === 'derechos' && <CopyrightContent />}
        {section === 'mis-datos' && <MyDataContent />}
      </article>
    </main>
  );
};

export type { LegalSection };

const SECTION_IDS: LegalSection[] = ['privacidad', 'terminos', 'reembolsos', 'cookies', 'derechos', 'mis-datos'];

/** Reads ?legal=<section> from the URL, so legal pages can be linked directly. */
export function readLegalParam(): LegalSection | null {
  try {
    const value = new URLSearchParams(window.location.search).get('legal');
    return SECTION_IDS.includes(value as LegalSection) ? (value as LegalSection) : null;
  } catch {
    return null;
  }
}

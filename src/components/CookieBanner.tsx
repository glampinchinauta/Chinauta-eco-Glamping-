import React, { useState } from 'react';

const CONSENT_KEY = 'egc_cookie_consent';

export type CookieConsent = 'essential' | 'all';

/** Read the visitor's choice. Returns null if they have not chosen yet. */
export function getCookieConsent(): CookieConsent | null {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === 'essential' || v === 'all' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Use this before loading any non-essential script (analytics, ads, pixels).
 * Today the site loads none, so this only protects future additions.
 */
export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'all';
}

function saveConsent(value: CookieConsent) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Private mode or blocked storage: the banner will show again next visit.
  }
}

export const CookieBanner: React.FC<{ onOpenCookiePolicy: () => void }> = ({ onOpenCookiePolicy }) => {
  const [visible, setVisible] = useState(() => getCookieConsent() === null);

  if (!visible) return null;

  const choose = (value: CookieConsent) => {
    saveConsent(value);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-300 bg-white p-5 shadow-2xl space-y-4">
        <h2 id="cookie-banner-title" className="text-base font-bold text-slate-900">Usamos cookies y datos de terceros</h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          Usamos cookies esenciales para que el sitio funcione. Además, con tu permiso, usamos herramientas de analítica
          (como Google Analytics) y de publicidad (como Meta) para medir las visitas y mejorar el sitio. Esos datos se
          envían a proveedores de terceros, algunos fuera de Colombia. Si eliges "Solo esenciales", no se cargan.
          Puedes cambiar tu elección cuando quieras en la política de cookies.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onOpenCookiePolicy}
            className="text-left text-sm font-semibold text-emerald-800 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
          >
            Ver política de cookies
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => choose('essential')}
              className="rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Solo esenciales
            </button>
            <button
              type="button"
              onClick={() => choose('all')}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
            >
              Aceptar analítica y publicidad
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

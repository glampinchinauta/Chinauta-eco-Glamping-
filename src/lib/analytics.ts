
/**
 * Google Analytics (GA4), loaded only when the visitor accepted analytics in the cookie banner.
 * The Measurement ID comes from the build variable VITE_GA_MEASUREMENT_ID (format G-XXXXXXXXXX).
 * Without that variable nothing is loaded.
 */
const MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim();
const VALID_ID = /^G-[A-Z0-9]{4,20}$/i;

let loaded = false;

// Same storage key as the cookie banner (src/components/CookieBanner.tsx).
function hasAnalyticsChoice(): boolean {
  try {
    return window.localStorage.getItem('egc_cookie_consent') === 'all';
  } catch {
    return false;
  }
}

export function loadAnalyticsIfConsented(): void {
  if (loaded) return;
  if (!hasAnalyticsChoice()) return;
  if (!VALID_ID.test(MEASUREMENT_ID)) return;

  try {
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag(...args: unknown[]) { w.dataLayer.push(args); };
    w.gtag('js', new Date());
    w.gtag('config', MEASUREMENT_ID, { anonymize_ip: true });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    document.head.appendChild(script);
    loaded = true;
  } catch {
    // If the script cannot load, the site keeps working without analytics.
  }
}

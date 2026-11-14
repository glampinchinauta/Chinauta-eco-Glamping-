import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// Dirección pública del sitio, tomada del entorno (SITE_URL, o el dominio de producción que Vercel entrega).
// Sirve para las vistas previas en redes, el mapa del sitio (sitemap.xml) y robots.txt sin escribir el dominio a mano.
const siteUrl = (() => {
  const raw = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return raw.replace(/\/+$/, '');
})();

function seoFiles(): Plugin {
  const pages = ['/', '/?legal=terminos', '/?legal=privacidad', '/?legal=reembolsos', '/?legal=cookies'];
  return {
    name: 'seo-files',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', 'Disallow: /api/', ...(siteUrl ? [`Sitemap: ${siteUrl}/sitemap.xml`] : [])].join('\n') + '\n';
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
      if (siteUrl) {
        const urls = pages.map((p) => `  <url><loc>${siteUrl}${p.replace(/&/g, '&amp;')}</loc></url>`).join('\n');
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), seoFiles()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

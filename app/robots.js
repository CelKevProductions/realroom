import { MARQUE } from '@/lib/config.js';

export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/fr/app', '/en/app', '/fr/connexion', '/en/connexion'] },
    sitemap: `${MARQUE.site}/sitemap.xml`
  };
}

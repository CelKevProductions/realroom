import { MARQUE, LANGUES } from '@/lib/config.js';

// pages publiques, dans les deux langues (hreflang)
export default function sitemap() {
  const pages = ['', '/legal/mentions', '/legal/cgv', '/legal/confidentialite'];
  return pages.flatMap(p => LANGUES.map(l => ({
    url: `${MARQUE.site}/${l}${p}`,
    changeFrequency: p ? 'yearly' : 'weekly',
    priority: p ? .3 : 1,
    alternates: { languages: Object.fromEntries(LANGUES.map(x => [x, `${MARQUE.site}/${x}${p}`])) }
  })));
}

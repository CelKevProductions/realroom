import Experience from '@/components/maison/Experience.js';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  return { title: { absolute: (lang === 'en' ? 'Demo · At home' : 'Démo · Chez vous') + ' · Maison Corleone' } };
}

// démo sans compte : tout se passe dans le navigateur (analyse et rendus simulés)
export default async function Page({ params, searchParams }) {
  const { lang } = await params;
  const sp = await searchParams;
  const pieceId = typeof sp.piece === 'string' && /^r_[A-Za-z0-9_-]{4,40}$/.test(sp.piece) ? sp.piece : null;
  return <Experience lang={lang} demo connexion pieceId={pieceId} />;
}

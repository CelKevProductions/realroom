import { notFound } from 'next/navigation';
import { pageLegale } from '@/lib/legal.js';

const PAGES = ['mentions', 'cgv', 'confidentialite'];
export function generateStaticParams() {
  return PAGES.map(page => ({ page }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }) {
  const { lang, page } = await params;
  const p = pageLegale(page, lang);
  return p ? { title: p.titre, alternates: { canonical: `/${lang}/legal/${page}` } } : {};
}

// [[…]] : à compléter par l'éditeur, surligné pour qu'on ne l'oublie pas
const paragraphe = t => t.split(/(\[\[[^\]]+\]\])/).map((m, i) => (m.startsWith('[[') ? <span key={i} className="a-completer">{m.slice(2, -2)}</span> : m));

export default async function PageLegale({ params }) {
  const { lang, page } = await params;
  const p = pageLegale(page, lang);
  if (!p) notFound();
  return (
    <article className="page-texte">
      <h1>{p.titre}</h1>
      {p.sections.map(([titre, paras]) => (
        <section key={titre}>
          <h2>{titre}</h2>
          {paras.map((t, i) => <p key={i}>{paragraphe(t)}</p>)}
        </section>
      ))}
    </article>
  );
}

import Projets from '@/components/Projets.js';
import { connecteOuConnexion } from '@/lib/session.js';
import { listerProjets } from '@/lib/projets.js';
import { texte } from '@/lib/i18n.js';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  return { title: texte(lang).projets.titre };
}

export default async function PageProjets({ params }) {
  const { lang } = await params;
  const u = await connecteOuConnexion(lang);
  const projets = (await listerProjets(u.id)).map(p => ({ id: p.id, nom: p.nom, nb: p.nb, apercu: p.apercu ? p.apercu.url : null }));
  return <Projets lang={lang} t={texte(lang)} initiaux={projets} />;
}

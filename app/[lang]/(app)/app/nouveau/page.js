import { notFound } from 'next/navigation';
import Nouveau from '@/components/nouveau/Nouveau.js';
import { connecteOuConnexion } from '@/lib/session.js';
import { projet } from '@/lib/projets.js';
import { texte } from '@/lib/i18n.js';

export const metadata = { robots: { index: false, follow: false } };

// nouveau projet guidé ; « ?projet=… » ajoute une pièce à un projet existant
export default async function PageNouveau({ params, searchParams }) {
  const { lang } = await params;
  const { projet: id } = await searchParams;
  const u = await connecteOuConnexion(lang);
  let initial = null;
  if (typeof id === 'string' && id) {
    try { const p = await projet(u.id, id); initial = { id: p.id, nom: p.nom }; } catch (e) { if (e && e.statut === 404) notFound(); throw e; }
  }
  return <Nouveau lang={lang} t={texte(lang)} projetInitial={initial} />;
}

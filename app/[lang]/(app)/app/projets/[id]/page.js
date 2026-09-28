import { notFound } from 'next/navigation';
import Projet from '@/components/Projet.js';
import { utilisateur } from '@/lib/session.js';
import { projet } from '@/lib/projets.js';
import { texte } from '@/lib/i18n.js';

export default async function PageProjet({ params }) {
  const { lang, id } = await params;
  const u = await utilisateur();
  let p;
  try { p = await projet(u.id, id); } catch (e) { if (e && e.statut === 404) notFound(); throw e; }
  p.pieces = p.pieces.map(x => ({ ...x, photos: (x.photos || []).map(f => ({ url: f.url, role: f.role })) }));
  return <Projet lang={lang} t={texte(lang)} initial={JSON.parse(JSON.stringify(p))} />;
}

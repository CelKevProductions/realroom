import { notFound } from 'next/navigation';
import Piece from '@/components/Piece.js';
import { utilisateur } from '@/lib/session.js';
import { piece, publique, rendusDe } from '@/lib/projets.js';
import { texte } from '@/lib/i18n.js';
import { CREDITS, SIMULATION } from '@/lib/config.js';

export default async function PagePiece({ params }) {
  const { lang, id } = await params;
  const u = await utilisateur();
  let p;
  try { p = await piece(u.id, id); } catch (_) { notFound(); }
  const rendus = (await rendusDe(u.id, id)).map(r => ({ ...r, resultat: r.resultat && { ...r.resultat, fichier: undefined } }));
  const services = {
    analyse: SIMULATION || !!process.env.ANTHROPIC_API_KEY,
    rendu: SIMULATION || !!process.env.FAL_KEY,
    monde: SIMULATION || !!process.env.WLT_API_KEY,
    simulation: SIMULATION
  };
  return (
    <Piece lang={lang} t={texte(lang)} initiale={JSON.parse(JSON.stringify(publique(p)))} rendusInitiaux={JSON.parse(JSON.stringify(rendus))}
      credits={u.credits} couts={CREDITS} services={services} />
  );
}

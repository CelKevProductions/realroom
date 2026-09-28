import { notFound } from 'next/navigation';
import Piece from '@/components/Piece.js';
import { connecteOuConnexion } from '@/lib/session.js';
import { piece, publique, rendusDe, renduPublic } from '@/lib/projets.js';
import { texte } from '@/lib/i18n.js';
import { CREDITS, SIMULATION } from '@/lib/config.js';

export default async function PagePiece({ params }) {
  const { lang, id } = await params;
  const u = await connecteOuConnexion(lang);
  let p;
  try { p = await piece(u.id, id); } catch (e) { if (e && e.statut === 404) notFound(); throw e; }
  const rendus = (await rendusDe(u.id, id)).map(renduPublic);
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

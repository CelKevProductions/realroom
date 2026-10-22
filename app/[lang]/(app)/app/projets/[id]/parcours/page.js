import { notFound } from 'next/navigation';
import Parcours from '@/components/parcours/Parcours.js';
import { connecteOuConnexion } from '@/lib/session.js';
import { texte } from '@/lib/i18n.js';
import { PRODUITS } from '@/lib/catalogue.js';
import { piecesDuParcours, lireParcours } from '@/lib/parcours-serveur.js';
import { projet } from '@/lib/projets.js';
import { configSceneWeaver } from '@/lib/moteurs/sceneweaver.js';
import { CREDITS } from '@/lib/config.js';

export const metadata = { robots: { index: false, follow: false } };

export default async function PageParcours({ params }) {
  const { lang, id } = await params;
  const u = await connecteOuConnexion(lang);
  let pr;
  try { pr = await projet(u.id, id); } catch (e) { if (e && e.statut === 404) notFound(); throw e; }
  const pieces = await piecesDuParcours(u.id, id);
  const { etat, revision } = await lireParcours(u.id, id, pieces);
  // dimensions et familles des meubles du catalogue présents, pour les plans
  const skus = new Set(pieces.flatMap(p => (p.agencement || []).map(it => it.sku)).filter(Boolean));
  const produits = Object.fromEntries([...skus].filter(s => PRODUITS[s]).map(s => [s, { fam: PRODUITS[s].fam, dim: PRODUITS[s].dim, nom: PRODUITS[s].nom }]));
  return <Parcours lang={lang} t={texte(lang)} projetId={id} projetNom={pr.nom} initial={JSON.parse(JSON.stringify({ etat, revision, pieces }))}
    produits={produits} approfondissement={{ actif: configSceneWeaver().actif, simulation: configSceneWeaver().simulation, credits: CREDITS.approfondissement }} />;
}

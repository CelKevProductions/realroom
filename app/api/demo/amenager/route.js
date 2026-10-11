import { route, json, verifierOrigine, lireJSON, ErreurHTTP, ip } from '@/lib/http.js';
import { compter, adresseBase } from '@/lib/db.js';
import { empreinte } from '@/lib/session.js';
import { LIMITES, MODELES } from '@/lib/config.js';
import { proposerAmenagement } from '@/lib/claude.js';
import { PRODUITS, candidats } from '@/lib/catalogue.js';
import { versClaude } from '@/lib/piece.js';
import { preparerAmenagement, appliquerProposition } from '@/lib/amenagement.js';
import { validerDemoIA, ErreurDemoIA } from '@/lib/demo-ia.js';
import { disponibiliteDemoIA } from '@/lib/demo-disponibilite.js';

export const maxDuration = 300;
const disponibilite = () => disponibiliteDemoIA({ env: process.env, base: adresseBase(), limites: LIMITES });
const indisponible = reference => {
  console.error('Aménagement IA démo indisponible', reference);
  return json({ erreur: 'ia-indisponible', reference }, 503);
};

export const GET = route(async () => json(disponibilite()));

// Anonyme, plafonné dans Postgres ; aucune pièce ni aucun crédit de compte n'est modifié.
export const POST = route(async request => {
  verifierOrigine(request);
  let b;
  try { b = validerDemoIA(await lireJSON(request, 1.3e6), PRODUITS); }
  catch (e) { if (e instanceof ErreurDemoIA) throw new ErreurHTTP(400, e.code); throw e; }
  const etat = disponibilite();
  if (!etat.disponible) return indisponible(etat.reference);
  let quota;
  try {
    quota = await compter('demo-amenager:' + empreinte('demo-amenager', ip(request)).slice(0, 40), LIMITES.demoAmenagementsParJour, 864e5)
      && await compter('demo-amenagements-du-jour', LIMITES.demoAmenagementsGlobauxParJour, 864e5);
  } catch (_) { return indisponible('D-06'); }
  if (!quota) throw new ErreurHTTP(429, 'limite-demo');
  const { piece: p, choix, inspirations, langue } = b;
  const prep = preparerAmenagement(p.agencement, { ...choix, langue });
  const cands = candidats({ dims: p.modele.dims, fonction: p.fonction, envies: prep.envies, budget: prep.budget });
  let r;
  try {
    r = await proposerAmenagement({ piece: { ...versClaude(p.modele, prep.base, PRODUITS), notes_client: p.notes }, fonction: p.fonction, mode: prep.mode, envies: prep.envies, budget: prep.budget, garder: prep.garder, aRemplacer: prep.aRemplacer, candidats: cands, inspirations, langue }, { reel: true, maxTokens: 12000 });
  } catch (e) {
    if (e?.code === 'cle') return indisponible('D-07');
    console.error('Aménagement IA démo indisponible', e?.code || 'modele');
    throw new ErreurHTTP(502, 'amenagement-ia');
  }
  const resultat = appliquerProposition({ modele: p.modele, fonction: p.fonction, prep, proposition: r.proposition, produits: PRODUITS, candidats: cands });
  resultat.proposition.moteur = { type: 'ia', modele: r.usage?.modele || MODELES.claude };
  return json(resultat);
});

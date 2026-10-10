import { route, json, verifierOrigine, lireJSON, ErreurHTTP, ip } from '@/lib/http.js';
import { compter, adresseBase } from '@/lib/db.js';
import { empreinte } from '@/lib/session.js';
import { LIMITES, MODELES } from '@/lib/config.js';
import { iaDisponible, proposerAmenagement } from '@/lib/claude.js';
import { PRODUITS, candidats } from '@/lib/catalogue.js';
import { versClaude } from '@/lib/piece.js';
import { preparerAmenagement, appliquerProposition } from '@/lib/amenagement.js';
import { validerDemoIA, ErreurDemoIA } from '@/lib/demo-ia.js';

export const maxDuration = 300;
const disponible = () => process.env.DEMO_AMENAGEMENT_IA !== '0' && iaDisponible()
  && LIMITES.demoAmenagementsParJour > 0 && LIMITES.demoAmenagementsGlobauxParJour > 0
  && (!process.env.VERCEL || (!!adresseBase() && (process.env.SESSION_SECRET || '').length >= 32));

export const GET = route(async () => json({ disponible: disponible(), simulation: false }));

// Anonyme, plafonné dans Postgres ; aucune pièce ni aucun crédit de compte n'est modifié.
export const POST = route(async request => {
  verifierOrigine(request);
  let b;
  try { b = validerDemoIA(await lireJSON(request, 1.3e6), PRODUITS); }
  catch (e) { if (e instanceof ErreurDemoIA) throw new ErreurHTTP(400, e.code); throw e; }
  if (!disponible()) throw new ErreurHTTP(503, 'ia-indisponible');
  if (!await compter('demo-amenager:' + empreinte('demo-amenager', ip(request)).slice(0, 40), LIMITES.demoAmenagementsParJour, 864e5)) throw new ErreurHTTP(429, 'limite-demo');
  if (!await compter('demo-amenagements-du-jour', LIMITES.demoAmenagementsGlobauxParJour, 864e5)) throw new ErreurHTTP(429, 'limite-demo');
  const { piece: p, choix, inspirations, langue } = b;
  const prep = preparerAmenagement(p.agencement, { ...choix, langue });
  const cands = candidats({ dims: p.modele.dims, fonction: p.fonction, envies: prep.envies, budget: prep.budget });
  let r;
  try {
    r = await proposerAmenagement({ piece: { ...versClaude(p.modele, prep.base, PRODUITS), notes_client: p.notes }, fonction: p.fonction, mode: prep.mode, envies: prep.envies, budget: prep.budget, garder: prep.garder, aRemplacer: prep.aRemplacer, candidats: cands, inspirations, langue }, { reel: true, maxTokens: 12000 });
  } catch (e) {
    console.error('Aménagement IA démo indisponible', e?.code || 'modele');
    throw new ErreurHTTP(e?.code === 'cle' ? 503 : 502, e?.code === 'cle' ? 'ia-indisponible' : 'amenagement-ia');
  }
  const resultat = appliquerProposition({ modele: p.modele, prep, proposition: r.proposition, produits: PRODUITS, candidats: cands });
  resultat.proposition.moteur = { type: 'ia', modele: r.usage?.modele || MODELES.claude };
  return json(resultat);
});

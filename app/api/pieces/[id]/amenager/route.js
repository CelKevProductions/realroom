import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece, majPiece, publique } from '@/lib/projets.js';
import { compter } from '@/lib/db.js';
import { LIMITES } from '@/lib/config.js';
import { proposerAmenagement } from '@/lib/claude.js';
import { versClaude, depuisProposition } from '@/lib/piece.js';
import { resoudre } from '@/lib/agencement.js';
import { PRODUITS, candidats, tient } from '@/lib/catalogue.js';

export const maxDuration = 300;

// POST { mode: 'tout' | 'partiel', envies, budget, garder: [ids], aRemplacer: [ids], langue }
export const POST = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const b = await lireJSON(request, 20000);
  const p = await piece(u.id, id);
  if (!p.modele) throw new ErreurHTTP(409, 'pas-de-modele');
  if (!(await compter('amenager:' + u.id, LIMITES.amenagementsParJour, 864e5))) throw new ErreurHTTP(429, 'limite');
  if (!(await compter('amenagements-du-jour', LIMITES.amenagementsGlobauxParJour, 864e5))) throw new ErreurHTTP(429, 'limite');
  const mode = b.mode === 'partiel' ? 'partiel' : 'tout';
  const envies = String(b.envies || '').slice(0, 1200);
  const budget = Math.max(0, Math.min(1e6, Math.round(+b.budget || 0)));
  const actuels = p.agencement || [];
  const ids = new Set(actuels.map(it => it.id));
  const garder = (Array.isArray(b.garder) ? b.garder : []).filter(x => ids.has(x));
  const aRemplacer = (Array.isArray(b.aRemplacer) ? b.aRemplacer : []).filter(x => ids.has(x));
  // en « tout », on repart des meubles relevés sur les photos ; en « partiel », de la pièce telle qu'elle est
  const base = mode === 'tout' ? actuels.filter(it => it.origine === 'existant').map(it => ({ ...it, garde: true })) : actuels.filter(it => it.garde !== false);
  const cands = candidats({ dims: p.modele.dims, fonction: p.fonction, envies, budget });
  const { proposition } = await proposerAmenagement({
    piece: versClaude(p.modele, base, PRODUITS), fonction: p.fonction, mode, envies, budget, garder, aRemplacer, candidats: cands, langue: b.langue === 'en' ? 'en' : 'fr'
  });
  const retirer = new Set((proposition.retirer || []).filter(x => ids.has(x) && !garder.includes(x)));
  if (mode === 'partiel') { for (const x of [...retirer]) if (!aRemplacer.includes(x)) retirer.delete(x); aRemplacer.forEach(x => retirer.add(x)); }
  const items = base.map(it => (retirer.has(it.id) ? { ...it, garde: false } : { ...it, fixe: true }));
  const nouveaux = (proposition.meubles || []).filter(m => PRODUITS[m.produit] && tient(PRODUITS[m.produit], p.modele.dims)).slice(0, 24)
    .map((m, i) => depuisProposition(m, p.modele, i));
  const { items: finaux, alertes } = resoudre(p.modele, [...items, ...nouveaux], PRODUITS);
  const agencement = finaux.map(({ fixe, ...it }) => it);
  const prop = { mode, envies, budget, concept: String(proposition.concept || '').slice(0, 800), conseils: (proposition.conseils || []).slice(0, 4).map(s => String(s).slice(0, 300)), alertes: alertes.map(a => a.texte), date: new Date().toISOString() };
  const n = await majPiece(u.id, id, { agencement, proposition: prop });
  return json({ piece: publique(n) });
});

// Claude « architecte » côté serveur : trois partis pour « Aménager » et Shuffle (lib/architecte.js).
// Ne lève pas d'erreur : sans clé, hors délai ou sans réponse utilisable, le moteur actuel aménage
// seul et la réponse dit pourquoi dans architecte.erreur.
import { preparerAmenagement } from '../amenagement.js';
import { programmeComposition, TYPES_PROGRAMME } from '../programme.js';
import { moteurGuideActif } from '../moteur-guide.js';
import { decrirePiece, schemaPartis, normaliserPartis, resumePartis } from '../architecte.js';
import { proposerPartis } from '../claude.js';

// Actif dès que la clé existe, sauf sur le site en production (CLAUDE_ARCHITECTE=1 pour l'y ouvrir) ;
// CLAUDE_ARCHITECTE=0 le coupe partout.
export function architecteActif(env = process.env) {
  if (env.CLAUDE_ARCHITECTE === '0' || !(env.ANTHROPIC_API_KEY || '').trim()) return false;
  return env.VERCEL_ENV !== 'production' || env.CLAUDE_ARCHITECTE === '1';
}

// Les espaces du programme sont ceux que le moteur posera (même préparation que l'assistant).
function programmeDe(piece, demande) {
  const source = piece.agencement || [];
  const conserves = source.filter(it => it.contraintes?.conserver === true).map(it => it.id);
  const choix = preparerAmenagement(source, { ...demande, garder: [...(Array.isArray(demande.garder) ? demande.garder : []), ...conserves] });
  const garder = choix.mode === 'partiel' ? source.filter(it => !choix.aRemplacer.includes(it.id)).map(it => it.id) : choix.garder;
  const prep = preparerAmenagement(source, { ...choix, mode: 'tout', garder, moteurGuide: true });
  const programme = moteurGuideActif(prep.moteurGuide) ? programmeComposition({ modele: piece.modele, fonction: piece.fonction, envies: prep.envies,
    espaces: prep.espaces, placesRepas: prep.placesRepas, langue: prep.langue, details: prep.compositionDetails, compositionSurface: prep.compositionSurface,
    staging: prep.staging, encyclopedie: prep.encyclopedie, profilUsage: prep.profilUsage, referencesSpatiales: prep.referencesSpatiales }) : null;
  return { prep, programme, fixes: prep.base.filter(it => prep.garder.includes(it.id)) };
}

export async function partisArchitecte({ piece, demande = {}, produits, deja = [], signal }) {
  if (!architecteActif()) return { erreur: 'architecte-inactif' };
  if (!piece?.modele || !TYPES_PROGRAMME.includes(piece.fonction)) return { erreur: 'architecte-piece' };
  const { prep, programme, fixes } = programmeDe(piece, demande);
  if (!programme?.zones?.length) return { erreur: 'architecte-piece' };
  const description = decrirePiece({ modele: piece.modele, fonction: piece.fonction, programme, fixes, produits, langue: prep.langue });
  try {
    const { json, usage } = await proposerPartis({ description, schema: schemaPartis(piece.modele, programme), envies: prep.envies,
      deja: resumePartis(deja), langue: prep.langue, signal });
    const partis = normaliserPartis(json, piece.modele, programme);
    // suivi du coût : quelques centimes par appel
    console.log('Architecte :', partis.length, 'partis,', usage.modele, usage.input_tokens, '+', usage.output_tokens, 'jetons');
    return partis.length ? { partis } : { erreur: 'architecte-vide' };
  } catch (e) {
    if (signal?.aborted) throw e;
    console.error('Architecte indisponible :', e?.status || e?.code || e?.message);
    return { erreur: e?.status === 401 || e?.code === 'cle' ? 'architecte-cle' : e?.status === 429 ? 'architecte-limite' : 'architecte-indisponible' };
  }
}

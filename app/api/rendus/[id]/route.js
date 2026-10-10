import { route, json, exiger } from '@/lib/http.js';
import { une, sql } from '@/lib/db.js';
import { echouerGeneration } from '@/lib/credits.js';
import { renduPublic } from '@/lib/projets.js';
import { suivreRendu, suivreMonde, copierRendu } from '@/lib/generation.js';

export const maxDuration = 60;

// GET : où en est la génération ; une fois finie, l'image est copiée dans nos fichiers.
// Tout échec (prestataire, délai, soumission interrompue) rembourse, une seule fois.
export const GET = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const r = await une('SELECT * FROM rendus WHERE id = $1 AND utilisateur_id = $2', [id, u.id]);
  if (!r) return json({ erreur: 'introuvable' }, 404);
  if (r.etat === 'en_cours') {
    const age = Date.now() - new Date(r.cree_le).getTime();
    const encore = extra => json({ id, type: r.type, etat: 'en_cours', ...extra });
    const soumis = r.suivi && (r.suivi.simulation || r.suivi.op || r.suivi.statut);
    if (!soumis) {
      // la demande n'est jamais partie (fonction arrêtée pendant l'envoi)
      if (age < 3 * 60e3) return encore({});
      await echouerGeneration(id, 'envoi interrompu');
    } else {
      let s = r.type === 'monde' ? await suivreMonde(r.suivi) : await suivreRendu(r.suivi);
      if (s.etat === 'en_cours' && age > (r.type === 'monde' ? 40 : 10) * 60e3) s = { etat: 'erreur', erreur: 'délai dépassé' };
      if (s.etat === 'fini') {
        let resultat;
        if (r.type === 'monde') resultat = { monde: s.monde };
        else if (s.simulation) resultat = { image: r.suivi.capture.url, fichier: r.suivi.capture, simulation: true };
        else {
          const copie = await copierRendu(u.id, id, s.image);
          if (copie && copie.refus) { await echouerGeneration(id, copie.refus); s = null; }
          else if (!copie) {
            // image pas encore lisible : on réessaie au prochain passage, dans la limite de 15 minutes
            if (age < 15 * 60e3) return encore({});
            await echouerGeneration(id, 'image illisible');
            s = null;
          } else resultat = { image: copie.url, fichier: copie, source: s.image, largeur: s.largeur, hauteur: s.hauteur };
        }
        if (resultat) await sql(`UPDATE rendus SET etat = 'fini', resultat = $2::jsonb, fini_le = now() WHERE id = $1 AND etat = 'en_cours'`, [id, JSON.stringify(resultat)]);
      } else if (s.etat === 'erreur') {
        await echouerGeneration(id, s.erreur);
      } else return encore({ progres: s.progres || null, position: s.position ?? null });
    }
  }
  const f = await une("SELECT id, type, etat, credits, resultat, erreur, cree_le, fini_le, suivi->>'source' AS source, COALESCE(suivi->>'angle', 'entree') AS angle, suivi->'vue' AS vue, COALESCE(suivi->>'ambiance','jour') AS ambiance, suivi->'reference'->>'url' AS reference, (suivi->'reference'->>'largeur')::int AS \"referenceLargeur\", (suivi->'reference'->>'hauteur')::int AS \"referenceHauteur\" FROM rendus WHERE id = $1", [id]);
  return json(renduPublic(f));
});

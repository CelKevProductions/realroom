import { route, json, exiger } from '@/lib/http.js';
import { une, sql } from '@/lib/db.js';
import { crediter } from '@/lib/credits.js';
import { enregistrer, typeReel } from '@/lib/stockage.js';
import { suivreRendu, suivreMonde } from '@/lib/generation.js';

export const maxDuration = 60;

// GET : où en est la génération ; une fois finie, l'image est copiée dans nos fichiers
export const GET = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const r = await une('SELECT * FROM rendus WHERE id = $1 AND utilisateur_id = $2', [id, u.id]);
  if (!r) return json({ erreur: 'introuvable' }, 404);
  if (r.etat === 'en_cours') {
    const age = Date.now() - new Date(r.cree_le).getTime();
    let s = r.type === 'monde' ? await suivreMonde(r.suivi) : await suivreRendu(r.suivi);
    if (s.etat === 'en_cours' && age > (r.type === 'monde' ? 40 : 10) * 60e3) s = { etat: 'erreur', erreur: 'délai dépassé' };
    if (s.etat === 'fini') {
      let resultat;
      if (r.type === 'monde') resultat = { monde: s.monde };
      else if (s.simulation) resultat = { image: r.suivi.capture.url, fichier: r.suivi.capture, source: 'simulation', simulation: true };
      else {
        const rep = await fetch(s.image);
        const octets = Buffer.from(await rep.arrayBuffer());
        const type = typeReel(octets) || 'image/jpeg';
        const fichier = await enregistrer(u.id, 'rendus', octets, type);
        resultat = { image: fichier.url, fichier, source: s.image, largeur: s.largeur, hauteur: s.hauteur };
      }
      await sql(`UPDATE rendus SET etat = 'fini', resultat = $2::jsonb, fini_le = now() WHERE id = $1 AND etat = 'en_cours'`, [id, JSON.stringify(resultat)]);
    } else if (s.etat === 'erreur') {
      const ok = await une(`UPDATE rendus SET etat = 'erreur', erreur = $2, fini_le = now() WHERE id = $1 AND etat = 'en_cours' RETURNING credits`, [id, String(s.erreur || '').slice(0, 300)]);
      if (ok && ok.credits) await crediter(u.id, ok.credits, 'remboursement', 'remb:' + id);
    } else return json({ id, type: r.type, etat: 'en_cours', progres: s.progres || null, position: s.position ?? null });
  }
  const f = await une("SELECT id, type, etat, credits, resultat, erreur, cree_le, fini_le, suivi->>'source' AS source FROM rendus WHERE id = $1", [id]);
  if (f.resultat) f.resultat = { ...f.resultat, fichier: undefined };
  return json(f);
});

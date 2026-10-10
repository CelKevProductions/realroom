import { api } from '@/components/api.js';
import { demandeDemoIA } from '@/lib/demo-ia.js';
import { reduireImage } from '@/components/piece/image.js';

const dataUri = blob => new Promise((ok, ko) => {
  const lecteur = new FileReader();
  lecteur.onload = () => ok(lecteur.result);
  lecteur.onerror = () => ko(new Error('inspiration-demo'));
  lecteur.readAsDataURL(blob);
});

async function appelBorne(options, delai) {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), delai);
  try {
    const r = await api('/api/demo/amenager', { ...options, signal: controle.signal });
    return r.erreur === 'annule' ? { ...r, erreur: 'delai-amenagement' } : r;
  } finally { clearTimeout(minuteur); }
}

export async function amenagerParIA(piece, choix, langue) {
  // Refuser immédiatement une démo non configurée, avant de traiter les inspirations.
  const etat = await appelBorne({}, 15000);
  if (!etat.ok) return etat;
  if (!etat.disponible) return { ok: false, erreur: 'ia-indisponible', statut: 503, reference: etat.reference };
  let inspirations;
  try {
    inspirations = await Promise.all((piece.photos || []).filter(p => p.role === 'inspiration').slice(0, 3).map(async p => {
      if (!/^data:image\//.test(p.url || '')) throw new Error('inspiration-demo');
      const fichier = await (await fetch(p.url)).blob();
      const { blob } = await reduireImage(fichier, 640, .72);
      if (blob.size > 290000) throw new Error('inspiration-demo');
      return { dataUri: await dataUri(blob) };
    }));
  } catch (_) { return { ok: false, erreur: 'inspiration-demo', statut: 400 }; }
  // La fonction Vercel dispose de 300 s ; le navigateur attend au plus 15 s de plus.
  return appelBorne({ method: 'POST', corps: demandeDemoIA(piece, choix, langue, inspirations) }, 315000);
}

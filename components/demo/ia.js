import { api } from '@/components/api.js';
import { demandeDemoIA } from '@/lib/demo-ia.js';
import { reduireImage } from '@/components/piece/image.js';

const dataUri = blob => new Promise((ok, ko) => {
  const lecteur = new FileReader();
  lecteur.onload = () => ok(lecteur.result);
  lecteur.onerror = () => ko(new Error('inspiration-demo'));
  lecteur.readAsDataURL(blob);
});

export async function amenagerParIA(piece, choix, langue) {
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
  return api('/api/demo/amenager', { method: 'POST', corps: demandeDemoIA(piece, choix, langue, inspirations) });
}

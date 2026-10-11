import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { piece, importerScan, publique } from '@/lib/projets.js';
import { champsDepuisScan, ErreurScan, MAX_SCAN_OCTETS } from '@/lib/scan.js';
import { analyseMaisonPermise, compterAnalyseMaison } from '@/lib/maison.js';

// Données métriques seulement. Le serveur refait toute la validation du navigateur.
export const POST = route(async (request, { params }) => {
  const u = await exiger(request);
  const { id } = await params;
  const b = await lireJSON(request, MAX_SCAN_OCTETS);
  const p = await piece(u.id, id);
  if (p.etat === 'analyse') throw new ErreurHTTP(409, 'en-cours');
  if (p.modele && b.remplacer !== true) throw new ErreurHTTP(409, 'scan-remplacement');
  if (p.modele && (!b.revision || new Date(b.revision).getTime() !== new Date(p.maj_le).getTime())) throw new ErreurHTTP(409, 'scan-conflit');
  let champs;
  try { champs = champsDepuisScan(b.scan); }
  catch (e) { if (e instanceof ErreurScan) throw new ErreurHTTP(400, e.code); throw e; }
  if (!(await analyseMaisonPermise(u))) throw new ErreurHTTP(429, 'limite-mc');
  const n = await importerScan(u.id, id, champs, p);
  await compterAnalyseMaison(u);
  return json({ piece: publique(n) });
});

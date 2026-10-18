// Maquette 3D sur un serveur isolé (après npm run build) : mesures de rendu exposées, perte puis
// retour du contexte WebGL sans erreur, image encore rendue après le retour.
import assert from 'node:assert/strict';
import { demarrerServeur, navigateur, connecter, surveiller, json } from './outils/banc.mjs';
import { scanApple } from './fixtures/scans.js';

const s = await demarrerServeur({ port: 3158 });
const nav = await navigateur();
try {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  await connecter(ctx, s.base, 'maquette@example.com');
  const projet = (await json(await ctx.request.post(s.base + '/api/projets', { data: { nom: 'Maquette' } }))).projet;
  const piece = (await json(await ctx.request.post(`${s.base}/api/projets/${projet.id}/pieces`, { data: { nom: 'Chambre', fonction: 'chambre' } }))).piece;
  await json(await ctx.request.post(`${s.base}/api/pieces/${piece.id}/scan`, { data: { scan: scanApple() } }));
  const page = await ctx.newPage(), erreurs = surveiller(page);
  await page.goto(`${s.base}/fr/app/pieces/${piece.id}`);
  await page.waitForFunction(() => typeof window.realroomMesures === 'function' && window.realroomMesures()?.images > 5, null, { timeout: 30000 });
  const m = await page.evaluate(() => window.realroomMesures());
  console.log('mesures', JSON.stringify(m));
  assert.ok(['haute', 'moyenne', 'basse'].includes(m.qualite));
  if (process.env.CAPTURE) await page.locator('canvas').first().screenshot({ path: process.env.CAPTURE });
  // perte du contexte, puis retour : la maquette se redessine
  await page.evaluate(() => { window.__perte = document.querySelector('canvas[data-qualite]').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__perte.loseContext(); });
  await page.waitForFunction(() => document.querySelector('canvas[data-qualite]').dataset.contexte === 'perdu');
  await page.evaluate(() => window.__perte.restoreContext());
  await page.waitForFunction(() => document.querySelector('canvas[data-qualite]').dataset.contexte === 'retabli');
  const avant = (await page.evaluate(() => window.realroomMesures())).images;
  await page.mouse.move(640, 450); await page.mouse.down(); await page.mouse.move(760, 470, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(n => window.realroomMesures().images > n, avant);
  assert.equal((await page.evaluate(() => window.realroomMesures())).contextePerdu, false);
  await page.goto(`${s.base}/fr/app/projets/${projet.id}`);
  assert.deepEqual(erreurs, []);
  console.log('maquette 3D : OK');
} finally { await nav.close(); await s.arreter(); }

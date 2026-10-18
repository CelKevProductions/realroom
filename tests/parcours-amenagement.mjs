// Parcours guidé de bout en bout sur un serveur isolé (après npm run build) : dix étapes,
// retour, reprise après rechargement, focus sur le titre de l'étape, contraintes enregistrées,
// première proposition et approfondissement simulé (crédits débités puis tâche finie).
import assert from 'node:assert/strict';
import { demarrerServeur, navigateur, connecter, surveiller, json } from './outils/banc.mjs';
import { scanApple } from './fixtures/scans.js';

const s = await demarrerServeur({ port: 3157 });
const nav = await navigateur();
try {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  await connecter(ctx, s.base, 'parcours@example.com');
  const projet = (await json(await ctx.request.post(s.base + '/api/projets', { data: { nom: 'Appartement' } }))).projet;
  const piece = (await json(await ctx.request.post(`${s.base}/api/projets/${projet.id}/pieces`, { data: { nom: 'Chambre', fonction: 'chambre' } }))).piece;
  await json(await ctx.request.post(`${s.base}/api/pieces/${piece.id}/scan`, { data: { scan: scanApple() } }));
  const page = await ctx.newPage(), erreurs = surveiller(page);
  await page.goto(`${s.base}/fr/app/projets/${projet.id}/parcours`);
  const titre = async () => (await page.locator('[data-titre-etape]').innerText()).trim();
  const continuer = () => page.getByRole('button', { name: 'Continuer' }).click();
  const focusTitre = async () => assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-titre-etape')), true, 'focus sur le titre');

  assert.equal(await titre(), 'Quelles pièces aménager ?');
  assert.equal(await page.getByRole('button', { name: 'Continuer' }).isDisabled(), true, 'rien de choisi');
  await page.getByRole('checkbox', { name: /Chambre/ }).check();
  await continuer(); await focusTitre();
  assert.equal(await titre(), 'Que se passe-t-il dans chaque pièce ?');
  await page.getByRole('checkbox', { name: 'Lecture' }).check();
  await page.getByRole('checkbox', { name: 'C’est bon pour cette pièce' }).check();
  await continuer();
  assert.equal(await titre(), 'Relever chaque pièce');
  // retour, puis reprise après rechargement sur l'étape enregistrée
  await page.getByRole('button', { name: 'Retour' }).click();
  assert.equal(await titre(), 'Que se passe-t-il dans chaque pièce ?');
  await continuer();
  await page.waitForFunction(() => document.querySelector('.parcours__sauvegarde')?.textContent === 'Enregistré');
  await page.reload();
  assert.equal(await titre(), 'Relever chaque pièce', 'reprise');
  assert.equal(await page.getByRole('checkbox', { name: 'Lecture' }).count(), 0);
  await continuer();
  await page.getByRole('button', { name: 'Le plan est juste' }).click();
  await page.getByText('Plan validé').waitFor();
  await continuer();
  assert.equal(await titre(), 'Que faire des meubles actuels ?');
  await page.getByRole('radio', { name: /Conserver certains meubles/ }).check();
  await continuer();
  assert.equal(await titre(), 'Quels meubles conserver ?');
  const choix = page.getByRole('combobox', { name: /Devenir du meuble 2/ });
  await choix.selectOption('deplacable');
  await continuer();
  // les contraintes sont écrites sur la pièce avant de passer à l'étape suivante
  await page.getByRole('heading', { name: 'Photographier les meubles conservés' }).waitFor({ timeout: 15000 })
    .catch(async e => { console.error(await page.locator('.parcours__etape .avis').allInnerTexts()); throw e; });
  const apres = (await json(await ctx.request.get(`${s.base}/api/pieces/${piece.id}`))).piece;
  const garde = apres.agencement.find(it => it.contraintes?.conserver);
  assert.deepEqual(garde.contraintes, { conserver: true, dimensionsFixes: true, positionFixe: false, rotationFixe: false }, 'contraintes enregistrées');
  await continuer();
  await page.getByRole('checkbox', { name: 'Mes préférences sont prêtes' }).check();
  await continuer();
  assert.equal(await titre(), 'Première proposition');
  await page.getByRole('button', { name: 'Lancer la première proposition' }).click();
  await page.getByRole('link', { name: /comparer d’autres variantes/ }).waitFor({ timeout: 60000 })
    .catch(async e => { console.error(await page.locator('.parcours__etape').innerText(), s.logs().slice(-3000)); throw e; });
  await continuer();
  assert.equal(await titre(), 'Affiner mon aménagement');
  const avant = (await json(await ctx.request.get(s.base + '/api/moi'))).credits;
  await page.getByRole('button', { name: /Affiner mon aménagement/ }).click();
  await page.locator('.parcours__etape').getByText('Terminé.', { exact: false }).waitFor({ timeout: 30000 });
  const apresCredits = (await json(await ctx.request.get(s.base + '/api/moi'))).credits;
  if (Number.isFinite(avant)) assert.equal(apresCredits, avant - 2, 'débit de l’approfondissement');
  // toutes les étapes faites sauf les photos, passées sans photo
  const recap = await page.locator('.parcours__lien.is-fait').count();
  assert.ok(recap >= 9, 'avancement réel : ' + recap);
  assert.deepEqual(erreurs, []);
  console.log('parcours guidé : OK');
} finally { await nav.close(); s.arreter(); }

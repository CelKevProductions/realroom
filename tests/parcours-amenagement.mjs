// Parcours guidé de bout en bout sur un serveur isolé (après npm run build) : quatre écrans,
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

  // 1. vos pièces : le relevé se dévoile une fois la pièce choisie
  assert.equal(await titre(), 'Vos pièces et leur plan');
  assert.equal(await page.getByRole('button', { name: 'Continuer' }).isDisabled(), true, 'rien de choisi');
  await page.getByRole('checkbox', { name: /Chambre/ }).check();
  await page.getByRole('heading', { name: 'Relever chaque pièce' }).waitFor();
  await continuer(); await focusTitre();
  assert.equal(await titre(), 'On vérifie ensemble');
  // retour, puis reprise après rechargement sur l'écran enregistré
  await page.getByRole('button', { name: 'Retour' }).click();
  assert.equal(await titre(), 'Vos pièces et leur plan');
  await continuer();
  await page.waitForFunction(() => document.querySelector('.parcours__sauvegarde')?.textContent === 'Enregistré');
  await page.reload();
  assert.equal(await titre(), 'On vérifie ensemble', 'reprise');
  // 2. vérification : plan, puis choix, sélection et photos facultatives
  await page.getByRole('button', { name: 'Le plan est juste' }).click();
  await page.getByText('Plan validé').waitFor();
  await page.getByRole('radio', { name: /Conserver certains meubles/ }).check();
  const choix = page.getByRole('combobox', { name: /Devenir du meuble 2/ });
  await choix.selectOption('deplacable');
  await page.getByRole('heading', { name: /Photographier les meubles conservés/ }).waitFor();
  await continuer();
  // les contraintes sont écrites sur la pièce avant de passer à l'écran suivant
  await page.getByRole('heading', { name: 'Vos envies', level: 2 }).waitFor({ timeout: 15000 })
    .catch(async e => { console.error(await page.locator('.parcours__etape .avis').allInnerTexts()); throw e; });
  const apres = (await json(await ctx.request.get(`${s.base}/api/pieces/${piece.id}`))).piece;
  const garde = apres.agencement.find(it => it.contraintes?.conserver);
  assert.deepEqual(garde.contraintes, { conserver: true, dimensionsFixes: true, positionFixe: false, rotationFixe: false }, 'contraintes enregistrées');
  // 3. envies : usages puis préférences
  await page.getByRole('checkbox', { name: 'Lecture' }).check();
  await page.getByRole('checkbox', { name: 'C’est bon pour cette pièce' }).check();
  await page.getByRole('checkbox', { name: 'Mes préférences sont prêtes' }).check();
  await continuer();
  // 4. aménagement : première proposition, puis l'approfondissement se dévoile
  assert.equal(await titre(), 'Votre aménagement');
  await page.getByRole('button', { name: 'Lancer la première proposition' }).click();
  await page.getByRole('link', { name: /comparer d’autres variantes/ }).waitFor({ timeout: 60000 })
    .catch(async e => { console.error(await page.locator('.parcours__etape').innerText(), s.logs().slice(-3000)); throw e; });
  await page.getByRole('heading', { name: /Affiner mon aménagement/ }).waitFor();
  const avant = (await json(await ctx.request.get(s.base + '/api/moi'))).credits;
  await page.getByRole('button', { name: /Affiner mon aménagement/ }).click();
  await page.locator('.parcours__etape').getByText('Terminé.', { exact: false }).waitFor({ timeout: 30000 });
  const apresCredits = (await json(await ctx.request.get(s.base + '/api/moi'))).credits;
  if (Number.isFinite(avant)) assert.equal(apresCredits, avant - 2, 'débit de l’approfondissement');
  // les quatre écrans faits (les photos sont facultatives)
  const recap = await page.locator('.parcours__ecrans li.is-fait').count();
  assert.equal(recap, 4, 'avancement réel : ' + recap);
  assert.deepEqual(erreurs, []);
  console.log('parcours guidé : OK');
} finally { await nav.close(); s.arreter(); }

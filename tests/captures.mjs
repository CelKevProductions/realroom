// À appeler depuis tests/plan.mjs, sur son serveur et sa base isolés.
// Les fixtures sont synthétiques : elles ne prouvent pas la précision d'un capteur physique.
import assert from 'node:assert/strict';
import path from 'node:path';
import { scanApple, scanAndroid } from './fixtures/scans.js';

export async function verifierCaptures({ browser, ctx, base, racine }) {
  const premiere = ['api', 'realroom', 'permission', 'maison'].indexOf(process.env.CAPTURES_DEPUIS || 'api');
  assert.ok(premiere >= 0, 'Étape de reprise des tests inconnue');
  const json = async r => { assert.ok(r.ok(), `HTTP ${r.status()}: ${await r.text()}`); return r.json(); };
  const catalogue = await json(await ctx.request.get(base + '/catalogue.json'));
  const projet = (await json(await ctx.request.post(base + '/api/projets', { data: { nom: 'Relevés métriques' } }))).projet;
  const creer = async nom => (await json(await ctx.request.post(`${base}/api/projets/${projet.id}/pieces`, { data: { fonction: 'chambre', nom } }))).piece;
  if (premiere <= 0) {
  const p = await creer('RoomPlan API'), url = `${base}/api/pieces/${p.id}`;
  const avantCredits = (await json(await ctx.request.get(base + '/api/moi'))).credits;
  const avant = (await json(await ctx.request.get(url))).piece;
  assert.equal((await ctx.request.post(url + '/scan', { data: { scan: { source: 'photo' } } })).status(), 400);
  assert.equal((await json(await ctx.request.get(url))).piece.modele, null);
  const r = (await json(await ctx.request.post(url + '/scan', { data: { scan: scanApple() } }))).piece;
  assert.equal(r.modele.capture.source, 'apple-roomplan');
  assert.equal(r.photos.length, 0); assert.deepEqual(r.agencement[0].p.dim, [1.4, 1.6, 1]);
  assert.equal(r.modele.murs.fond.ouvertures[0].allege, .9);
  assert.equal(r.modele.dims.sources.largeur, 'scan');
  assert.equal((await ctx.request.post(url + '/analyse', { data: { langue: 'fr' } })).status(), 400);
  const lu = (await json(await ctx.request.get(url))).piece;
  assert.deepEqual(lu.modele, r.modele); assert.deepEqual(lu.agencement, r.agencement);
  assert.equal((await ctx.request.post(url + '/scan', { data: { scan: scanAndroid() } })).status(), 409);
  assert.equal((await ctx.request.post(url + '/scan', { data: { scan: scanAndroid(), remplacer: true, revision: avant.maj_le } })).status(), 409);
  const bad = scanApple(); bad.unit = 'cm';
  assert.equal((await ctx.request.post(url + '/scan', { data: { scan: bad, remplacer: true, revision: lu.maj_le } })).status(), 400);
  assert.deepEqual((await json(await ctx.request.get(url))).piece.modele, lu.modele);
  const simultanes = await Promise.all([2.7, 2.8].map(ceilingHeight => ctx.request.post(url + '/scan', {
    data: { scan: { ...scanAndroid(), ceilingHeight }, remplacer: true, revision: lu.maj_le }
  })));
  assert.deepEqual(simultanes.map(r => r.status()).sort(), [200, 409], 'un scan ne peut écraser un import concurrent');
  const actuel = (await json(await ctx.request.get(url))).piece;
  const remet = (await json(await ctx.request.post(url + '/scan', { data: { scan: scanApple(), remplacer: true, revision: actuel.maj_le } }))).piece;
  const amenagee = (await json(await ctx.request.post(url + '/amenager', { data: {
    mode: 'partiel', garder: remet.agencement.map(it => it.id), envies: 'Conserver le lit de 140 × 160 et le rangement, ajouter une lampe simple', budget: 2000, langue: 'fr'
  } }))).piece;
  assert.equal(amenagee.modele.capture.source, 'apple-roomplan');
  assert.deepEqual(amenagee.agencement.find(it => it.id === remet.agencement[0].id).p.dim, [1.4, 1.6, 1]);
  assert.equal(amenagee.proposition.confort.score.criteres.length, 10);
  assert.equal(amenagee.proposition.placement.source, 'solveur');
  assert.ok(amenagee.proposition.selectionBudget);
  const sansCompte = await browser.newContext();
  assert.equal((await sansCompte.request.post(url + '/scan', { data: { scan: scanApple() } })).status(), 401);
  await sansCompte.close();
  assert.equal((await json(await ctx.request.get(base + '/api/moi'))).credits, avantCredits);
  console.log('Scan API → base : métrique sans photos, validation, compte propriétaire, conflits concurrents et proposition vérifiés.');
  }

  if (premiere <= 1) {
  const u = await creer('RoomPlan interface'), pg = await ctx.newPage(), erreurs = [];
  let analyses = 0;
  pg.on('pageerror', e => erreurs.push(String(e)));
  pg.on('request', r => { if (r.url().endsWith('/analyse')) analyses++; });
  await pg.addInitScript(() => { localStorage.setItem('rr-tuto-atelier', '1'); });
  await pg.goto(`${base}/fr/app/pieces/${u.id}`);
  const acquisition = pg.getByRole('region', { name: 'Comment relever votre pièce ?' });
  await acquisition.getByRole('button', { name: /^Scan Android/ }).click();
  await acquisition.getByText(/AR indisponible ici/).waitFor();
  assert.ok(await acquisition.getByRole('button', { name: 'Démarrer le relevé AR' }).isDisabled());
  await acquisition.getByRole('button', { name: /^Scan Apple/ }).click();
  await acquisition.getByText(/Avec Lagarsoft LiDAR Scanner/).waitFor();
  await acquisition.getByRole('button', { name: /^Téléverser des photos/ }).click();
  assert.equal(await acquisition.getByRole('button', { name: /^Téléverser des photos/ }).getAttribute('aria-pressed'), 'true');
  await acquisition.getByRole('button', { name: /^Scan Apple/ }).click();
  const prudent = scanApple(); prudent.openings[1].confidence = 'medium';
  await acquisition.getByLabel('Importer un relevé métrique').setInputFiles(fichier(prudent));
  await acquisition.getByText(/Certains éléments du scan ont une confiance/).waitFor();
  assert.equal(await pg.evaluate(() => document.activeElement?.textContent), 'Vérifier avant d’importer');
  await acquisition.getByRole('button', { name: 'Utiliser ce plan' }).click();
  const dialogue = pg.getByRole('dialog');
  await dialogue.waitFor();
  assert.equal(await dialogue.getByLabel('Largeur (m)', { exact: true }).first().inputValue(), '4');
  assert.equal(await dialogue.getByRole('checkbox', { checked: true }).count(), 0, 'pas de mesure humaine inventée');
  await dialogue.getByRole('button', { name: 'Enregistrer le plan' }).click();
  await dialogue.waitFor({ state: 'hidden' });
  await pg.locator('.atelier canvas').waitFor();
  const ui = (await json(await ctx.request.get(`${base}/api/pieces/${u.id}`))).piece;
  assert.equal(ui.modele.dims.sources.profondeur, 'scan'); assert.equal(ui.photos.length, 0);
  await pg.getByRole('tab', { name: /Rendu IA/ }).click();
  assert.ok(await pg.getByRole('button', { name: /Générer le rendu/ }).isDisabled());
  await pg.getByRole('button', { name: 'Ajouter la photo du rendu' }).click();
  await pg.getByLabel('Depuis l’entrée', { exact: true }).setInputFiles(path.join(racine, 'tests/fixtures/salon-entree.jpg'));
  await pg.locator('.case-photo[data-role="entree"] img').waitFor();
  await pg.getByRole('button', { name: 'Revenir au plan métrique' }).click();
  await pg.locator('.atelier canvas').waitFor();
  const apresPhoto = (await json(await ctx.request.get(`${base}/api/pieces/${u.id}`))).piece;
  assert.equal(apresPhoto.modele.capture.source, 'apple-roomplan');
  assert.deepEqual(apresPhoto.agencement[0].p.dim, [1.4, 1.6, 1]);
  assert.equal(apresPhoto.photos[0].role, 'entree'); assert.equal(analyses, 0);
  const creditsAvantRendu = (await json(await ctx.request.get(base + '/api/moi'))).credits;
  await pg.getByRole('tab', { name: /Rendu IA/ }).click();
  await pg.getByRole('button', { name: /Générer le rendu/ }).click();
  await pg.locator('.avant-apres__apres img').waitFor({ timeout: 30000 });
  const avecRendu = await json(await ctx.request.get(`${base}/api/pieces/${u.id}`));
  assert.equal(avecRendu.rendus.length, 1); assert.equal(avecRendu.rendus[0].etat, 'fini');
  const creditsApresRendu = (await json(await ctx.request.get(base + '/api/moi'))).credits;
  assert.equal(creditsApresRendu, creditsAvantRendu - 1);
  await json(await ctx.request.post(`${base}/api/pieces/${u.id}/scan`, { data: {
    scan: scanApple(), remplacer: true, revision: avecRendu.piece.maj_le
  } }));
  const conserve = await json(await ctx.request.get(`${base}/api/pieces/${u.id}`));
  assert.deepEqual(conserve.piece.photos, avecRendu.piece.photos);
  assert.deepEqual(conserve.rendus, avecRendu.rendus, 'un remplacement métrique ne supprime pas les rendus');
  assert.equal((await json(await ctx.request.get(base + '/api/moi'))).credits, creditsApresRendu);
  const autre = await browser.newContext();
  const email = 'autre-scan@example.net';
  const code = await json(await autre.request.post(base + '/api/auth/code', { data: { email, langue: 'fr' } }));
  const connexion = await autre.request.post(base + '/api/auth/verifier', { data: { email, code: code.code, langue: 'fr' } });
  await json(connexion);
  const cookie = connexion.headers()['set-cookie']?.match(/rr_session=([^;]+)/)?.[1]; assert.ok(cookie);
  await autre.addCookies([{ name: 'rr_session', value: cookie, url: base, httpOnly: true, sameSite: 'Lax' }]);
  assert.equal((await autre.request.post(`${base}/api/pieces/${u.id}/scan`, { data: {
    scan: scanApple(), remplacer: true, revision: conserve.piece.maj_le
  } })).status(), 404, 'un autre compte ne peut pas remplacer le plan');
  await autre.close();
  await pg.reload(); await pg.locator('.atelier canvas').waitFor();
  await pg.screenshot({ path: path.join(racine, '.essais/capture-realroom.png'), fullPage: true });
  assert.deepEqual(erreurs, []); await pg.close();
  console.log('RealRoom : import → plan → photo → rendu simulé ; remplacement conserve photos, rendus et crédits ; autre propriétaire refusé.');
  }

  // Refus de permission : aucun scan fictif et aucune mutation.
  if (premiere <= 2) {
  const deny = await browser.newContext({ reducedMotion: 'reduce' });
  await deny.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', { configurable: true, value: {
      isSessionSupported: async () => true,
      requestSession: async () => { throw new DOMException('Permission refusée pour le test', 'NotAllowedError'); }
    } });
  });
  const refus = await deny.newPage();
  await refus.goto(base + '/fr/demo/pieces/r_demo_chambre');
  await refus.getByRole('button', { name: /^Scan Android/ }).click();
  await refus.getByRole('button', { name: 'Démarrer le relevé AR' }).click();
  await refus.getByRole('alert').filter({ hasText: 'La session AR n’a pas démarré' }).waitFor();
  assert.equal(await refus.getByRole('button', { name: 'Utiliser ce plan' }).count(), 0);
  assert.equal(await refus.evaluate(() => sessionStorage.getItem('realroom-demo-1')), null, 'le refus ne persiste aucune mutation');
  await deny.close();
  console.log('Permission caméra refusée : message explicite, aucun scan ni sauvegarde inventés.');
  }

  for (const mobile of [false, true]) {
    const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 1000 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const page = await c.newPage(), fautes = [];
    page.on('pageerror', e => fautes.push(String(e)));
    const etat = { langue: 'fr', edition: 'mc', credits: 2, mouvements: [], projets: [{ id: 'p_mc', nom: 'Maison Corleone' }], rendus: [],
      pieces: [{ id: 'r_scan_android', projet_id: 'p_mc', nom: 'Chambre', fonction: 'chambre', etat: 'photos', dims: null, photos: [], notes: '', modele: null, agencement: [], proposition: null, erreur: null, cree_le: new Date().toISOString(), maj_le: new Date().toISOString() }] };
    await c.addInitScript(({ etat }) => {
      if (!sessionStorage.getItem('mc-demo-1')) sessionStorage.setItem('mc-demo-1', JSON.stringify(etat));
      sessionStorage.setItem('mc-demo-connecte', 'true');
      sessionStorage.setItem('mc-demo-choix', JSON.stringify({ fonction: 'chambre', budget: 3000, styles: ['contemporain'], texte: 'Conserver mon lit 140 × 160 et améliorer la lumière', coups: [], priorites: ['eclairage'] }));
    }, { etat });
    await page.goto(base + '/fr/maison-corleone/demo?piece=r_scan_android');
    await page.locator('.mc-etape--photos').waitFor();
    await page.getByRole('button', { name: /^Scan Apple/ }).click();
    const prudent = scanApple(); prudent.objects[0].confidence = 'low';
    await page.getByLabel('Importer un relevé métrique').setInputFiles(fichier(prudent));
    await page.getByText(/Certains éléments du scan ont une confiance/).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Vérifier avant d’importer');
    await page.screenshot({ path: path.join(racine, `.essais/capture-apple-maison-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true });
    await page.getByRole('region', { name: 'Comment relever votre pièce ?' }).getByRole('button', { name: 'Annuler', exact: true }).click();
    await page.getByRole('button', { name: /^Scan Android/ }).click();
    await page.getByLabel('Importer un relevé métrique').setInputFiles(fichier(scanAndroid()));
    await page.getByRole('button', { name: 'Utiliser ce plan' }).click();
    const plan = page.getByRole('dialog'); await plan.waitFor();
    await plan.getByRole('button', { name: 'Ajouter une ouverture' }).click();
    await plan.getByLabel('Centre depuis le début du mur (m)').fill('.6');
    await plan.getByRole('button', { name: 'Noter un meuble existant', exact: true }).click();
    const groupe = plan.getByRole('group', { name: 'Noter un meuble existant', exact: true });
    await groupe.getByLabel('Nom', { exact: true }).fill('Mon lit 140 × 160');
    for (const [label, valeur] of [['Largeur (m)', '1.4'], ['Profondeur (m)', '1.6'], ['Hauteur (m)', '1']]) await groupe.getByLabel(label, { exact: true }).fill(valeur);
    await groupe.getByLabel('Centre depuis le mur d’entrée (m)', { exact: true }).fill('4');
    await groupe.getByRole('button', { name: 'Ajouter au relevé' }).click();
    await plan.getByRole('button', { name: 'Enregistrer le plan' }).click();
    await plan.waitFor({ state: 'hidden' });
    const lire = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('mc-demo-1')).pieces.find(p => p.id === 'r_scan_android'));
    const note = await lire();
    assert.equal(note.modele.capture.source, 'android-arcore-webxr');
    assert.equal(note.photos.length, 0); assert.deepEqual(note.agencement[0].p.dim, [1.4, 1.6, 1]);
    assert.equal(note.modele.dims.sources.largeur, 'scan');
    assert.equal(note.modele.murs.entree.ouvertures[0].position, -1.4);
    await page.getByRole('button', { name: 'Lancer l’aménagement', exact: true }).click();
    await page.locator('.mc-piece canvas').waitFor({ timeout: 30000 });
    await page.locator('summary').filter({ hasText: 'Score de disposition' }).waitFor();
    const composee = await lire();
    assert.equal(composee.modele.capture.source, 'android-arcore-webxr');
    assert.deepEqual(composee.agencement.find(it => it.id === note.agencement[0].id).p.dim, [1.4, 1.6, 1]);
    assert.equal(composee.agencement.filter(it => it.garde !== false && (it.sku ? catalogue.produits[it.sku]?.fam : it.p?.fam) === 'lit').length, 1, 'le lit conservé ne doit pas être doublé');
    assert.equal(composee.proposition.confort.score.criteres.length, 10);
    assert.equal(composee.proposition.placement.source, 'solveur');
    const date = composee.proposition.date;
    await page.getByRole('button', { name: /Rendu réaliste/ }).first().click();
    await page.getByRole('button', { name: 'Ajouter la photo du rendu' }).click();
    await page.locator('.mc-etape--photos').waitFor();
    await page.getByLabel('Prendre la photo', { exact: true }).setInputFiles(path.join(racine, 'tests/fixtures/salon-entree.jpg'));
    await page.locator('.mc-photo-principale img').waitFor();
    await page.getByRole('button', { name: 'Revenir à ma pièce' }).click();
    await page.locator('.mc-piece canvas').waitFor();
    const final = await lire();
    assert.equal(final.modele.capture.source, 'android-arcore-webxr');
    assert.equal(final.proposition.date, date, 'ajouter une photo ne relance pas la proposition');
    assert.equal(final.photos[0].role, 'entree');
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('mc-demo-1')).credits), 2);
    await page.reload(); await page.locator('.mc-piece canvas').waitFor();
    const relue = await lire(); assert.deepEqual(relue.modele, final.modele);
    await page.screenshot({ path: path.join(racine, `.essais/capture-maison-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true });
    assert.deepEqual(fautes, []); await c.close();
    console.log(`Maison Corleone ${mobile ? 'mobile' : 'desktop'} : import Android → porte et lit manuels → proposition sans photo → photo du rendu → reprise intacte.`);
  }
}

function fichier(scan) { return { name: 'releve-realroom.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scan)) }; }

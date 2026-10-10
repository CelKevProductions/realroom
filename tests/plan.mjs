// Parcours du plan : API réelle avec services simulés, persistance, puis interface et démo mobile.
// Après npm run build : node tests/plan.mjs (Playwright et Chromium installés).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { verifierCaptures } from './captures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '.', process.cwd()] }));
const racine = path.resolve(import.meta.dirname, '..'), port = Number(process.env.PORT || 3137);
const base = `http://127.0.0.1:${port}`;
fs.mkdirSync(path.join(racine, '.data'), { recursive: true });
const donnees = fs.mkdtempSync(path.join(racine, '.data', 'essais-plan-'));
fs.mkdirSync(path.join(racine, '.essais'), { recursive: true });
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/DATABASE_URL|POSTGRES|BLOB_READ_WRITE|STRIPE_|FAL_|WLT_|ANTHROPIC_|RESEND_|SESSION_SECRET|MC_CLIENT_|^VERCEL/.test(k)));
Object.assign(env, { REALROOM_ESSAIS: '1', REALROOM_SIMULATION: '1', SITE_URL: base,
  PGLITE_DIR: path.join(donnees, 'pglite'), FICHIERS_DIR: path.join(donnees, 'fichiers'), PORT: String(port) });
const serveur = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { cwd: racine, env, detached: true, stdio: 'pipe' });
let logs = '';
serveur.stdout.on('data', d => { logs = (logs + d).slice(-6000); });
serveur.stderr.on('data', d => { logs = (logs + d).slice(-6000); });
let browser;
try {
  const fin = Date.now() + 60000;
  while (true) {
    try { if ((await fetch(base + '/api/etat', { signal: AbortSignal.timeout(2000) })).ok) break; } catch (_) {}
    if (Date.now() > fin) throw new Error('Serveur indisponible : ' + logs);
    await new Promise(r => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      ...(process.env.CHROMIUM_EXECUTABLE_PATH ? ['--no-zygote', '--in-process-gpu'] : [])] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
  const json = async r => { assert.ok(r.ok(), `HTTP ${r.status()}: ${await r.text()}`); return r.json(); };
  const email = 'plan@example.com';
  const code = await json(await ctx.request.post(base + '/api/auth/code', { data: { email, langue: 'fr' } }));
  const connexion = await ctx.request.post(base + '/api/auth/verifier', { data: { email, code: code.code, langue: 'fr' } });
  await json(connexion);
  // Le build de production émet un cookie Secure ; ce serveur d’essai utilise HTTP local.
  const session = connexion.headers()['set-cookie']?.match(/rr_session=([^;]+)/)?.[1];
  assert.ok(session, 'Cookie de session absent');
  await ctx.addCookies([{ name: 'rr_session', value: session, url: base, httpOnly: true, sameSite: 'Lax' }]);
  if (process.env.CAPTURES_SEULES === '1') {
    await verifierCaptures({ browser, ctx, base, racine });
    await ctx.close();
  } else {
  if (process.env.PLAN_DEPUIS !== 'demo') {
  const projet = (await json(await ctx.request.post(base + '/api/projets', { data: { nom: 'Plan de chambre' } }))).projet;
  const p = (await json(await ctx.request.post(`${base}/api/projets/${projet.id}/pieces`, { data: { fonction: 'chambre', nom: 'Chambre' } }))).piece;
  const fichier = fs.readFileSync(path.join(racine, 'tests/fixtures/salon-entree.jpg'));
  const posterPhoto = role => ctx.request.post(`${base}/api/pieces/${p.id}/photos`, { multipart: {
    photo: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: fichier }, role, largeur: '1200', hauteur: '800'
  } });
  await json(await posterPhoto('inspiration'));
  const paralleles = await Promise.all([posterPhoto('inspiration'), posterPhoto('inspiration'), posterPhoto('inspiration')]);
  assert.deepEqual(paralleles.map(r => r.status()).sort(), [200, 200, 409], 'quota atomique de trois inspirations');
  assert.equal((await ctx.request.post(`${base}/api/pieces/${p.id}/analyse`, { data: { langue: 'fr' } })).status(), 400, 'une inspiration ne remplace pas la photo de la pièce');
  const refs = (await json(await ctx.request.get(`${base}/api/pieces/${p.id}`))).piece.photos;
  assert.equal(refs.length, 3);
  const projets = (await json(await ctx.request.get(`${base}/api/projets`))).projets;
  assert.equal(projets.find(pr => pr.id === projet.id).apercu, null, 'une inspiration ne devient pas la photo de la pièce');
  await json(await ctx.request.delete(`${base}/api/pieces/${p.id}/photos?url=${encodeURIComponent(refs[2].url)}`));
  await json(await ctx.request.post(`${base}/api/pieces/${p.id}/photos`, { multipart: {
    photo: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(racine, 'tests/fixtures/salon-entree.jpg')) }, role: 'entree', largeur: '1200', hauteur: '800'
  } }));
  for (let i = 0; i < 7; i++) await json(await posterPhoto('detail'));
  assert.equal((await posterPhoto('detail')).status(), 409);
  await json(await posterPhoto('entree')); // remplacement toujours permis lorsque les quotas sont pleins
  console.log('API inspirations : quota concurrent, suppression, huit vues distinctes et photo de pièce obligatoire validés.');
  const analyse = (await json(await ctx.request.post(`${base}/api/pieces/${p.id}/analyse`, { data: { langue: 'fr' } }))).piece;
  const lit = analyse.agencement.find(it => it.p.fam === 'lit');
  assert.ok(lit);
  const correction = { dims: { largeur: 4.4 }, murs: { entree: { ouvertures: [{ type: 'porte', position: -1.4, largeur: .9, hauteur: 2.04, allege: 0 }] } }, meubles: [{ id: lit.id, dim: [1.4, 1.6, 1] }] };
  const corrigee = (await json(await ctx.request.patch(`${base}/api/pieces/${p.id}`, { data: { geometrie: correction, agencement: analyse.agencement } }))).piece;
  assert.equal(corrigee.agencement.length, analyse.agencement.length);
  assert.deepEqual(corrigee.agencement.find(it => it.id === lit.id).p.dim, [1.4, 1.6, 1]);
  assert.equal(corrigee.modele.dims.sources.profondeur, 'photo');
  assert.equal(corrigee.dims.profondeur, null);
  const lu = (await json(await ctx.request.get(`${base}/api/pieces/${p.id}`))).piece;
  assert.deepEqual(lu.modele, corrigee.modele);
  console.log('API et base : mesures, ouverture et lit 140 × 160 cm conservés après relecture.');

  const page = await ctx.newPage(), erreurs = [];
  page.on('pageerror', e => erreurs.push(String(e)));
  await page.addInitScript(() => { localStorage.setItem('rr-tuto-atelier', '1'); });
  await page.goto(`${base}/fr/app/pieces/${p.id}`);
  await page.locator('.atelier canvas').waitFor({ timeout: 30000 });
  await verifierPlan(page, 'serveur', '4.6');
  const apres = (await json(await ctx.request.get(`${base}/api/pieces/${p.id}`))).piece;
  assert.equal(apres.modele.dims.largeur, 4.6);
  assert.equal(apres.modele.dims.sources.profondeur, 'photo');
  assert.ok(apres.modele.murs.droite.ouvertures.some(o => o.type === 'fenetre'));
  assert.deepEqual(apres.agencement.find(it => it.id === lit.id).p.dim, [1.4, 1.6, 1]);
  await page.reload();
  await page.getByRole('button', { name: 'Vérifier le plan et les mesures' }).click();
  assert.equal(await page.getByRole('dialog').getByLabel('Largeur (m)', { exact: true }).first().inputValue(), '4.6');
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).last().click();
  await verifierInspiration(page, racine, 3);
  await page.locator('.panneau__corps textarea').first().fill('Une chambre classique, avec une composition symétrique');
  await page.getByRole('button', { name: 'Proposer un aménagement', exact: true }).click();
  await page.locator('.concept').waitFor({ timeout: 30000 });
  const proposee = (await json(await ctx.request.get(`${base}/api/pieces/${p.id}`))).piece;
  assert.equal(proposee.proposition.preferences.style, 'classique');
  assert.equal(proposee.proposition.preferences.composition, 'symetrie');
  assert.equal(proposee.proposition.confort.score.criteres.length, 10);
  assert.equal(proposee.proposition.placement.source, 'solveur');
  assert.equal(proposee.proposition.selectionBudget.methode, 'sac-a-dos-emplacements');
  await verifierScore(page);
  await page.reload();
  await verifierScore(page);
  assert.equal((await json(await ctx.request.get(`${base}/api/pieces/${p.id}`))).piece.photos.filter(p => p.role === 'inspiration').length, 3);
  assert.deepEqual(erreurs, []);
  console.log('Interface → API → base → rechargement : plan corrigé retrouvé.');
  await verifierCaptures({ browser, ctx, base, racine });
  }
  await ctx.close();

  for (const mobile of [false, true]) {
    const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 1000 },
      isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const pg = await c.newPage(), fautes = [];
    pg.on('pageerror', e => fautes.push(String(e)));
    await pg.addInitScript(() => { localStorage.setItem('rr-tuto-atelier', '1'); });
    await pg.goto(`${base}/fr/demo/pieces/r_demo_salon`);
    await pg.locator('.atelier canvas').waitFor({ timeout: 30000 });
    await verifierPlan(pg, mobile ? 'mobile' : 'desktop', '4.4');
    const e = await pg.evaluate(() => JSON.parse(sessionStorage.getItem('realroom-demo-1')).pieces.find(p => p.id === 'r_demo_salon'));
    assert.equal(e.modele.dims.largeur, 4.4);
    assert.ok(e.modele.murs.droite.ouvertures.some(o => o.type === 'fenetre'));
    await verifierInspiration(pg, racine, 1);
    await pg.getByRole('button', { name: 'Proposer un aménagement', exact: true }).click();
    await pg.locator('.concept').waitFor({ timeout: 30000 });
    await verifierScore(pg);
    await pg.getByRole('button', { name: 'Comparer les dispositions', exact: true }).click();
    await pg.getByRole('button', { name: /^Disposition \d+$/ }).first().waitFor({ timeout: 30000 });
    await pg.screenshot({ path: path.join(racine, `.essais/plan-${mobile ? 'mobile' : 'desktop'}-comparaison.png`) });
    const avant = await pg.evaluate(() => JSON.parse(sessionStorage.getItem('realroom-demo-1')).credits);
    await pg.getByRole('button', { name: /^Disposition \d+$/ }).first().click();
    await pg.getByRole('button', { name: 'Annuler l’ajustement', exact: true }).click();
    assert.equal(await pg.evaluate(() => JSON.parse(sessionStorage.getItem('realroom-demo-1')).credits), avant);
    await pg.screenshot({ path: path.join(racine, `.essais/plan-${mobile ? 'mobile' : 'desktop'}-dispositions.png`) });
    assert.deepEqual(fautes, []);
    assert.ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log(`Démo ${mobile ? 'mobile' : 'desktop'} : plan, variantes, annulation et crédits inchangés validés.`);

    // Les deux démos gardent des jeux de données distincts ; on prépare le même scénario Maison.
    await pg.evaluate(() => {
      sessionStorage.setItem('mc-demo-1', sessionStorage.getItem('realroom-demo-1'));
      sessionStorage.setItem('mc-demo-connecte', 'true');
    });
    await pg.goto(`${base}/fr/maison-corleone/demo?piece=r_demo_salon`);
    await pg.locator('.mc-piece canvas').waitFor({ timeout: 30000 });
    await verifierScore(pg);
    await verifierPlan(pg, mobile ? 'maison-mobile' : 'maison-desktop', '4.7');
    const maison = await pg.evaluate(() => JSON.parse(sessionStorage.getItem('mc-demo-1')).pieces.find(p => p.id === 'r_demo_salon'));
    assert.equal(maison.modele.dims.largeur, 4.7);
    const texteMaquette = await pg.locator('.mc-station__donnees').innerText();
    await pg.screenshot({ path: path.join(racine, `.essais/plan-maison-${mobile ? 'mobile' : 'desktop'}-enregistre.png`) });
    assert.ok(texteMaquette.includes('4,7'), texteMaquette);
    await pg.reload();
    await pg.getByRole('button', { name: 'Vérifier le plan et les mesures', exact: true }).click();
    assert.equal(await pg.getByRole('dialog').getByLabel('Largeur (m)', { exact: true }).first().inputValue(), '4.7');
    await pg.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).last().click();
    assert.deepEqual(fautes, []);
    assert.ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log(`Maison Corleone ${mobile ? 'mobile' : 'desktop'} : plan, scène et rechargement validés.`);
    // Nouveau parcours : l'inspiration peut être ajoutée avant les photos de la vraie pièce.
    await pg.getByRole('button', { name: 'Nouvelle pièce', exact: true }).click();
    await pg.locator('.mc-etape--piece').waitFor({ timeout: 20000 });
    await pg.locator('.mc-choix__btn').filter({ has: pg.getByText('Salon', { exact: true }) }).click();
    await pg.locator('.mc-etape--budget').waitFor({ timeout: 20000 });
    await pg.getByRole('button', { name: 'Continuer', exact: true }).click();
    await pg.locator('.mc-etape--style').waitFor({ timeout: 20000 });
    await verifierInspiration(pg, racine, 1);
    await pg.screenshot({ path: path.join(racine, `.essais/inspirations-maison-${mobile ? 'mobile' : 'desktop'}.png`) });
    await pg.getByRole('button', { name: 'Continuer', exact: true }).click();
    await pg.locator('.mc-etape--priorite').waitFor({ timeout: 20000 });
    const preparatif = await pg.evaluate(() => JSON.parse(sessionStorage.getItem('mc-demo-1')).pieces.find(p => p.photos.some(f => f.role === 'inspiration') && !p.modele));
    assert.equal(preparatif.photos.filter(p => p.role === 'inspiration').length, 1);
    assert.ok(!preparatif.photos.some(p => p.role === 'entree'));
    assert.deepEqual(fautes, []);
    await c.close();
  }
  }
} catch (e) {
  if (browser) for (const c of browser.contexts()) for (const p of c.pages()) {
    try {
      console.error('Écran au premier échec :', p.url(), (await p.locator('body').innerText()).slice(-5000));
      await p.screenshot({ path: path.join(racine, '.essais/plan-premier-echec.png'), fullPage: true });
    } catch (_) {}
  }
  console.error(logs);
  throw e;
} finally {
  if (browser) await browser.close();
  try { process.kill(-serveur.pid, 'SIGTERM'); } catch (_) {}
  serveur.kill('SIGTERM');
}

async function verifierInspiration(page, racine, nombre) {
  const zone = page.getByRole('region', { name: 'Photos d’inspiration', exact: true });
  await zone.getByLabel('Ajouter une inspiration', { exact: true }).setInputFiles(path.join(racine, 'tests/fixtures/salon-entree.jpg'));
  await zone.getByRole('button', { name: `Retirer l’inspiration ${nombre}`, exact: true }).waitFor({ timeout: 20000 });
  await page.waitForFunction(n => Array.from(document.querySelectorAll('section[aria-label="Photos d’inspiration"] button')).length === n
    && Array.from(document.querySelectorAll('section[aria-label="Photos d’inspiration"] button')).every(b => !b.disabled), nombre);
  assert.equal(await zone.locator('img').count(), nombre);
}

async function verifierScore(page) {
  const score = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Score de disposition' }) });
  await score.locator('summary').waitFor({ timeout: 20000 });
  if (!await score.evaluate(el => el.open)) await score.locator('summary').click();
  assert.equal(await score.locator('dt').count(), 10);
  assert.ok((await score.innerText()).includes('Chemins depuis les portes'));
}

async function verifierPlan(page, nom, largeur) {
  await page.getByRole('button', { name: 'Vérifier le plan et les mesures', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Largeur (m)', { exact: true }).first().fill(largeur);
  await d.getByLabel('Portes et fenêtres', { exact: true }).selectOption('droite');
  await d.getByRole('button', { name: 'Ce mur est sans ouverture', exact: true }).click();
  await d.getByRole('button', { name: 'Ajouter une ouverture', exact: true }).click();
  await d.getByLabel('Type', { exact: true }).selectOption('fenetre');
  await d.getByLabel('Hauteur d’allège (m)', { exact: true }).fill('.9');
  await d.getByLabel('Hauteur (m)', { exact: true }).last().fill('1.2');
  await page.screenshot({ path: path.join(racine, `.essais/plan-${nom}.png`) });
  await d.getByRole('button', { name: 'Enregistrer le plan', exact: true }).click();
  await d.waitFor({ state: 'hidden', timeout: 20000 });
}

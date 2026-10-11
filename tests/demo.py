#!/usr/bin/env python3
"""Démo sans compte (/fr/demo) : stockage local et aménagement serveur, fournisseur IA remplacé.
Captures dans .essais/.

  npm run build && python3 tests/demo.py [desktop|mobile]
"""
import asyncio, os, pathlib, re, shutil, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright, expect

RACINE = pathlib.Path(__file__).resolve().parent.parent
OUT = RACINE / '.essais'
OUT.mkdir(exist_ok=True)
PORT = int(os.environ.get('PORT', '3127'))
BASE = f'http://127.0.0.1:{PORT}'
PHOTO = RACINE / 'tests' / 'fixtures' / 'salon-entree.jpg'
FORMAT = sys.argv[1] if len(sys.argv) > 1 else 'desktop'


def serveur():
    donnees = RACINE / '.data' / 'essais-demo'
    shutil.rmtree(donnees, ignore_errors=True)
    # Clé fictive et double chargé dans Node : aucun appel externe, comptes toujours locaux.
    env = dict(os.environ, REALROOM_ESSAIS='1', PGLITE_DIR=str(donnees / 'pglite'), FICHIERS_DIR=str(donnees / 'fichiers'), PORT=str(PORT), SITE_URL=BASE)
    for k in list(env):
        if re.search(r'DATABASE_URL|POSTGRES|FAL_|ANTHROPIC_|SESSION_SECRET|^VERCEL', k):
            env.pop(k, None)
    env.update(FAL_KEY='test-sans-reseau', DEMO_AMENAGEMENT_IA='1', DEMO_FAL_AUDIT=str(donnees / 'fal.jsonl'))
    env.pop('REALROOM_SIMULATION', None)
    p = subprocess.Popen(['node', '--import', str(RACINE / 'tests/fixtures/serveur-ia.mjs'), 'node_modules/next/dist/bin/next', 'start', '-p', str(PORT)], cwd=RACINE, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + '/api/etat', timeout=2)
            return p
        except Exception:
            time.sleep(.5)
    raise SystemExit('le serveur ne démarre pas')


n = 0
DEBORDS = []
async def capture(page, nom):
    global n
    n += 1
    await page.screenshot(path=str(OUT / f'demo-{FORMAT}-{n:02d}-{nom}.png'))
    d = await page.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
    if d > 1:
        DEBORDS.append(f'{nom} : +{d}px')


async def parcours(page, appels_api):
    await page.goto(BASE + '/fr')
    await page.click('.acc-hero a:has-text("Voir la démo")')   # attend la fin de l'écran d'ouverture
    await page.wait_for_url('**/fr/demo')
    await expect(page.locator('.carte-projet').first).to_contain_text('Appartement témoin')
    await expect(page.locator('.app-entete [data-solde]')).to_have_attribute('data-solde', '3')
    await page.wait_for_timeout(1400)   # entrée de la page
    await capture(page, 'projets')

    await page.click('.carte-projet a:has-text("Appartement témoin")')
    await page.wait_for_url('**/fr/demo/projets/**')
    await expect(page.locator('.carte-projet')).to_have_count(2)
    await page.wait_for_timeout(1400)
    await capture(page, 'projet')

    # salon d'exemple : proposition, rendu
    await page.click('.carte-projet:has-text("Salon")')
    await page.wait_for_url('**/fr/demo/pieces/**')
    await page.wait_for_selector('.atelier canvas', timeout=30000)
    await page.wait_for_timeout(1500)
    await capture(page, 'maquette')
    # un meuble actuel retiré disparaît de la maquette (il reste dans la liste pour être remis)
    await page.click('.onglets button:has-text("Meubles")')
    await page.locator('.liste-meubles .ligne-meuble:has-text("Canapé")').first.click()
    await page.locator('button:has-text("Retirer de la pièce")').first.click()
    await expect(page.locator('.liste-meubles .ligne-meuble:has-text("Canapé")').first).to_have_class(re.compile('is-retire'))
    await page.wait_for_timeout(800)
    await capture(page, 'meuble-retire')
    await page.locator('.bloc button:has-text("Garder"), .atelier__panneau button:has-text("Garder")').first.click()
    await expect(page.locator('.liste-meubles .ligne-meuble:has-text("Canapé")').first).not_to_have_class(re.compile('is-retire'))
    await page.click('.onglets button:has-text("Aménager")')
    await page.click('button:has-text("Proposer un aménagement")')
    await page.wait_for_selector('.concept', timeout=30000)
    nb = await page.locator('.liste-meubles').first.locator('.ligne-meuble').count()
    print('meubles dans la pièce :', nb)
    assert nb >= 4, 'proposition trop maigre : %d' % nb
    await page.wait_for_timeout(1200)
    await capture(page, 'amenagement')
    await page.click('.onglets button:has-text("Rendu IA")')
    await page.click('button:has-text("Générer le rendu")')
    await page.wait_for_selector('.avant-apres', timeout=30000)
    await expect(page.locator('.app-entete [data-solde]')).to_have_attribute('data-solde', '2')
    await capture(page, 'rendu')

    # crédits : achat de démonstration, sans quitter la page
    await page.click('.app-entete [data-solde]')
    await page.wait_for_url('**/fr/demo/compte')
    await page.check('input[name=consentement]')
    await page.click('[data-pack=essai]')
    await expect(page.locator('.bloc [data-solde]')).to_have_attribute('data-solde', '12')
    await expect(page.locator('.app-entete [data-solde]')).to_have_attribute('data-solde', '12')
    await capture(page, 'compte')

    # chambre : photo du visiteur, maquette simulée
    await page.click('.app-entete a:has-text("Mes projets")') if FORMAT == 'desktop' else await page.goto(BASE + '/fr/demo')
    await page.click('.carte-projet a:has-text("Appartement témoin")')
    await page.click('.carte-projet:has-text("Chambre")')
    await page.wait_for_url('**/fr/demo/pieces/**')
    await page.wait_for_timeout(1400)
    await capture(page, 'photos')
    await page.set_input_files('.case-photo--principale input[type=file]', str(PHOTO))
    await expect(page.locator('.case-photo--principale img')).to_be_visible(timeout=20000)
    await page.fill('input[name=largeur]', '3,6')
    await page.fill('input[name=profondeur]', '4,2')
    await page.locator('input[name=profondeur]').blur()
    await page.click('button:has-text("Créer la maquette 3D")')
    await page.wait_for_selector('.atelier canvas', timeout=30000)
    await page.wait_for_timeout(1500)
    lit = await page.locator('.liste-meubles').first.locator('.ligne-meuble:has-text("Lit")').count() if await page.locator('.liste-meubles').count() else None
    await capture(page, 'chambre')

    # rechargement : la démo reprend où elle en était (même onglet)
    await page.reload()
    await page.wait_for_selector('.atelier canvas', timeout=30000)
    await page.wait_for_load_state('networkidle')
    await expect(page.locator('.app-entete [data-solde]')).to_have_attribute('data-solde', '12')

    # l'application réelle reste protégée
    r = await page.goto(BASE + '/fr/app')
    assert '/fr/connexion' in page.url, 'l’application est accessible sans compte : ' + page.url
    print('appels à l’API serveur pendant la démo :', appels_api)
    assert '/api/demo/amenager' in appels_api, appels_api
    assert not [a for a in appels_api if a.startswith('/api/') and a not in ('/api/etat', '/api/demo/amenager')], appels_api


async def main():
    srv = serveur()
    erreurs, appels_api = [], []
    try:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            vp = {'width': 390, 'height': 844} if FORMAT == 'mobile' else {'width': 1400, 'height': 900}
            ctx = await b.new_context(viewport=vp, locale='fr-FR', is_mobile=FORMAT == 'mobile', has_touch=FORMAT == 'mobile', device_scale_factor=1)
            # guides des nouveaux venus déjà vus (sinon leur dialogue couvre la page)
            await ctx.add_init_script("try { localStorage.setItem('rr-tuto-accueil', '1'); localStorage.setItem('rr-tuto-atelier', '1'); } catch (e) {}")
            await ctx.route('https://cdn.shopify.com/**', lambda r: r.fulfill(path=str(PHOTO), content_type='image/jpeg'))
            page = await ctx.new_page()
            page.on('pageerror', lambda e: erreurs.append(str(e)))
            page.on('console', lambda m: erreurs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
            page.on('request', lambda r: appels_api.append(r.url.replace(BASE, '')) if r.url.startswith(BASE + '/api/') and '/fr/demo' in (page.url or '') else None)
            try:
                await parcours(page, appels_api)
            except Exception:
                await page.screenshot(path=str(OUT / f'demo-{FORMAT}-echec.png'))
                print('page en échec :', page.url)
                raise
            await b.close()
    finally:
        os.killpg(srv.pid, 15)
    print('erreurs de page :', erreurs or 'aucune')
    assert not erreurs, erreurs
    assert not DEBORDS, 'pages trop larges : ' + ', '.join(DEBORDS)
    print('OK')


asyncio.run(main())

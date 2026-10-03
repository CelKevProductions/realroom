#!/usr/bin/env python3
"""Parcours complet de RealRoom, services simulés (REALROOM_SIMULATION=1) :
connexion par code, projet, pièce, photos, maquette 3D, aménagement, catalogue,
rendu, visite 3D, achat de crédits. Captures dans .essais/.

  npm run build && python3 tests/e2e.py [desktop|mobile]
"""
import asyncio, os, pathlib, shutil, signal, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright, expect

RACINE = pathlib.Path(__file__).resolve().parent.parent
OUT = RACINE / '.essais'
OUT.mkdir(exist_ok=True)
PORT = int(os.environ.get('PORT', '3107'))
BASE = f'http://127.0.0.1:{PORT}'
PHOTO = RACINE / 'tests' / 'fixtures' / 'salon-entree.jpg'
FORMAT = sys.argv[1] if len(sys.argv) > 1 else 'desktop'


def serveur():
    donnees = RACINE / '.data' / 'e2e'
    shutil.rmtree(donnees, ignore_errors=True)
    env = dict(os.environ, REALROOM_SIMULATION='1', REALROOM_ESSAIS='1', PGLITE_DIR=str(donnees / 'pglite'), FICHIERS_DIR=str(donnees / 'fichiers'), PORT=str(PORT), SITE_URL=BASE)
    p = subprocess.Popen(['npx', 'next', 'start', '-p', str(PORT)], cwd=RACINE, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
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
    await page.screenshot(path=str(OUT / f'e2e-{FORMAT}-{n:02d}-{nom}.png'))
    # aucune page ne doit déborder en largeur (sur téléphone, cela décale tout l'affichage)
    d = await page.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
    if d > 1:
        DEBORDS.append(f'{nom} : +{d}px')


async def main():
    srv = serveur()
    erreurs = []
    page = None
    try:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            vp = {'width': 390, 'height': 844} if FORMAT == 'mobile' else {'width': 1400, 'height': 900}
            ctx = await b.new_context(viewport=vp, locale='fr-FR', is_mobile=FORMAT == 'mobile', has_touch=FORMAT == 'mobile', device_scale_factor=1)
            # images Shopify inaccessibles hors ligne : on sert une vignette neutre
            await ctx.route('https://cdn.shopify.com/**', lambda r: r.fulfill(path=str(PHOTO), content_type='image/jpeg'))
            page = await ctx.new_page()
            page.on('pageerror', lambda e: erreurs.append(str(e)))
            page.on('console', lambda m: erreurs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)

            try:
                await parcours(page, erreurs)
            except Exception:
                await page.screenshot(path=str(OUT / f'e2e-{FORMAT}-echec.png'))
                print('page en échec :', page.url)
                print((await page.inner_text('body'))[:1500])
                raise
            await b.close()
    finally:
        os.killpg(os.getpgid(srv.pid), signal.SIGTERM)
    utiles = [e for e in erreurs if 'status of 404' not in e and 'status of 402' not in e]
    print('erreurs de page :', utiles[:8] if utiles else 'aucune')
    print('OK')


async def parcours(page, erreurs):
    if True:
        if True:
            # accueil (redirection vers /fr), puis connexion
            await page.goto(BASE + '/')
            await expect(page).to_have_url(BASE + '/fr')
            await expect(page.locator('h1')).to_contain_text('vrais meubles')
            await page.wait_for_selector('[data-ouverture]', state='hidden', timeout=10000)
            await page.wait_for_timeout(1500)
            await capture(page, 'accueil')
            await page.goto(BASE + '/fr/connexion')
            await page.fill('input[name=email]', 'essai@example.com')
            await page.click('button:has-text("Recevoir un code")')
            code = await page.locator('[data-code-essai]').get_attribute('data-code-essai')
            await page.fill('input[name=code]', code)
            await page.click('button:has-text("Se connecter")')
            await page.wait_for_url('**/fr/app')
            await expect(page.locator('.app-entete [data-solde]')).to_have_attribute('data-solde', '3')
            await capture(page, 'projets')

            # projet, pièce
            await page.click('button:has-text("Nouveau projet")')
            await page.wait_for_url('**/fr/app/projets/**')
            await page.click('.app-page__tete button:has-text("Ajouter une pièce")')
            await page.click('label:has-text("Salon")')
            await page.fill('dialog input.saisie', 'Salon')
            await page.click('dialog button:has-text("Ajouter")')
            await page.wait_for_url('**/fr/app/pieces/**')

            # photo principale, mesures
            await page.set_input_files('.case-photo--principale input[type=file]', str(PHOTO))
            await expect(page.locator('.case-photo--principale img')).to_be_visible(timeout=20000)
            await page.fill('input[name=largeur]', '4,2')
            await page.fill('input[name=profondeur]', '5,2')
            await page.fill('input[name=hauteur]', '2,6')
            await page.locator('input[name=hauteur]').blur()
            await capture(page, 'photos')
            await page.click('button:has-text("Créer la maquette 3D")')
            await page.wait_for_selector('.atelier canvas', timeout=60000)
            await page.wait_for_timeout(2500)
            await capture(page, 'maquette')

            # aménagement proposé
            await page.click('.onglets button:has-text("Aménager")')
            await page.click('button.puce-bouton:has-text("Tons chauds")')
            await page.click('button:has-text("Proposer un aménagement")')
            await page.wait_for_selector('.concept', timeout=60000)
            await page.wait_for_timeout(1500)
            nb = await page.locator('.liste-meubles').first.locator('.ligne-meuble').count()
            print('meubles proposés :', nb)
            assert nb >= 1, 'aucun meuble proposé'
            await capture(page, 'amenagement')

            # choisir un meuble, le tourner, puis ajouter une pièce du catalogue
            await page.locator('.liste-meubles .ligne-meuble').first.click()
            await page.wait_for_selector('.outils-meuble', timeout=5000)
            await page.click('.outils-meuble button >> nth=1')
            await page.click('button:has-text("Ajouter un meuble")')
            await page.wait_for_selector('dialog.catalogue[open] .produit', timeout=10000)
            await capture(page, 'catalogue')
            # un meuble choisi ouvre sa fiche (maquette 3D qui tourne), puis on l'ajoute à la pièce
            await page.locator('dialog.catalogue .produit').first.click()
            await page.wait_for_selector('dialog.catalogue .detail canvas', timeout=5000)
            await page.wait_for_timeout(1800)
            await capture(page, 'fiche-produit')
            await page.click('dialog.catalogue .detail__pied button:has-text("Ajouter à la pièce")')
            await page.wait_for_timeout(1200)
            nb2 = await page.locator('.liste-meubles').first.locator('.ligne-meuble').count()
            assert nb2 == nb + 1, f'le meuble du catalogue n’a pas été ajouté ({nb} -> {nb2})'
            await page.wait_for_timeout(1200)  # enregistrement différé
            await capture(page, 'meubles')

            # vue de la photo
            await page.click('.segment button:has-text("Vue de la photo")')
            await page.wait_for_timeout(1500)
            await capture(page, 'vue-photo')

            # rendu (1 crédit), puis visite 3D (5 crédits : pas assez -> message)
            await page.click('.onglets button:has-text("Résultat")')
            await page.click('button:has-text("Générer le rendu")')
            await page.wait_for_selector('.avant-apres', timeout=40000)
            await expect(page.locator('.app-entete [data-solde]')).to_have_attribute('data-solde', '2')
            await capture(page, 'rendu')
            await page.click('button:has-text("Créer la visite 3D")')
            await expect(page.locator('.avis--alerte')).to_contain_text('Crédits insuffisants')

            # achat simulé de crédits, avec la case de renonciation
            await page.goto(BASE + '/fr/app/compte')
            await page.click('[data-pack=essai]')
            await expect(page.locator('.avis')).to_contain_text('rétractation')
            await page.check('input[name=consentement]')
            await page.click('[data-pack=essai]')
            await page.wait_for_url('**/fr/app/compte?paiement=ok**')
            solde = await page.locator('.bloc [data-solde]').get_attribute('data-solde')
            print('solde après achat :', solde)
            assert solde == '12', 'solde attendu 12 (3 - 1 + 10), lu ' + str(solde)
            await capture(page, 'compte')

            # visite 3D (simulée) depuis la pièce
            await page.go_back()
            await page.go_back()
            await page.wait_for_selector('.atelier canvas', timeout=30000)
            await page.click('.onglets button:has-text("Résultat")')
            await page.click('button:has-text("Créer la visite 3D")')
            await page.wait_for_selector('text=visite 3D (simulation)', timeout=40000)
            await capture(page, 'visite')

            # pages légales et 404
            r = await page.goto(BASE + '/en/legal/cgv')
            assert r.status == 200
            r = await page.goto(BASE + '/de')
            print('langue inconnue ->', r.status, page.url)
            assert not DEBORDS, 'pages trop larges : ' + ', '.join(DEBORDS)


asyncio.run(main())

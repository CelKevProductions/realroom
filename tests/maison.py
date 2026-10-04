#!/usr/bin/env python3
"""Édition Maison Corleone (« Chez vous ») : parcours complet.

  npm run build && python3 tests/maison.py [demo-desktop|demo-mobile|compte] [--mouvement]

- demo-desktop / demo-mobile : /fr/maison-corleone/demo, tout dans le navigateur (aucun appel à /api)
- compte : /fr/maison-corleone avec la connexion simulée (essais locaux, sans client Shopify),
  analyse, aménagement et rendu simulés côté serveur ; rechargement, redirection de /fr/app, déconnexion.
Par défaut les animations sont réduites (plus rapide) ; --mouvement joue tout (préchargement, rideaux…).
Captures dans .essais/.
"""
import asyncio, os, pathlib, shutil, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright, expect

RACINE = pathlib.Path(__file__).resolve().parent.parent
OUT = RACINE / '.essais'
OUT.mkdir(exist_ok=True)
PORT = int(os.environ.get('PORT', '3129'))
BASE = f'http://127.0.0.1:{PORT}'
PHOTO = RACINE / 'tests' / 'fixtures' / 'salon-entree.jpg'
LOGO = RACINE / 'tests' / 'fixtures' / 'logo-essai.png'
MODE = next((a for a in sys.argv[1:] if not a.startswith('--')), 'demo-desktop')
MOUVEMENT = '--mouvement' in sys.argv
MOBILE = MODE.endswith('mobile')


def serveur():
    donnees = RACINE / '.data' / 'essais-maison'
    shutil.rmtree(donnees, ignore_errors=True)
    env = dict(os.environ, REALROOM_ESSAIS='1', REALROOM_SIMULATION='1', PGLITE_DIR=str(donnees / 'pglite'), FICHIERS_DIR=str(donnees / 'fichiers'), PORT=str(PORT), SITE_URL=BASE)
    for k in ('MC_CLIENT_ID', 'MC_CLIENT_SECRET'):
        env.pop(k, None)
    p = subprocess.Popen(['npx', 'next', 'start', '-p', str(PORT)], cwd=RACINE, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + '/api/etat', timeout=2)
            return p
        except Exception:
            time.sleep(.5)
    raise SystemExit('le serveur ne démarre pas')


n = 0
DEBORDS = []
async def capture(page, nom, attente=0):
    global n
    n += 1
    if attente:
        await page.wait_for_timeout(attente)
    await page.screenshot(path=str(OUT / f'maison-{MODE}-{n:02d}-{nom}.png'))
    d = await page.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
    if d > 1:
        DEBORDS.append(f'{nom} : +{d}px')


async def clic(page, selecteur):
    # les écrans entrent en animation : on attend l'élément, puis on clique directement dessus
    await page.wait_for_selector(selecteur, state='visible', timeout=60000 if MOUVEMENT else 20000)
    await page.wait_for_timeout(250 if not MOUVEMENT else 1200)
    await page.dispatch_event(selecteur, 'click')


async def jusquau_parcours(page, url):
    await page.goto(BASE + url)
    await page.wait_for_selector('.mc-pre', state='detached', timeout=60000)
    await expect(page.locator('.mc-intro')).to_be_visible()
    await expect(page.locator('.mc-recit__bloc.is-actif .mc-recit__titre')).to_contain_text('Votre pièce')
    await capture(page, 'intro', 600)
    await clic(page, '.mc-hud--haut button')            # « Passer l'intro »
    await page.wait_for_selector('.mc-guide', timeout=20000)


async def etapes(page, connexion_demo):
    await expect(page.locator('.mc-question__titre')).to_contain_text('Votre compte')
    await capture(page, 'compte')
    if connexion_demo:
        await clic(page, '.mc-compte button')
    else:
        await clic(page, '.mc-compte a')                   # connexion simulée -> retour ?bienvenue=1
        await page.wait_for_url('**/fr/maison-corleone', timeout=20000)
        await expect(page.locator('.mc-guide__compte')).to_contain_text('Bonjour Camille')
    await page.wait_for_selector('.mc-etape--piece', timeout=20000)
    await capture(page, 'piece')
    await clic(page, '.mc-choix__btn:has-text("Salon")')    # avance seule
    await page.wait_for_selector('.mc-etape--budget', timeout=20000)
    await clic(page, '.mc-puce:has-text("Sans limite")')
    await expect(page.locator('.mc-budget__valeur')).to_contain_text('Sans limite')
    await clic(page, '.mc-puce:has-text("6")')
    await expect(page.locator('.mc-budget__valeur')).to_contain_text('6')
    await capture(page, 'budget', 800)
    await clic(page, '.mc-guide__pied .mc-btn')
    await page.wait_for_selector('.mc-etape--style', timeout=20000)
    for s in ('Chaleureux', 'Art déco', 'Japandi'):
        await clic(page, f'.mc-puce:has-text("{s}")')
    await clic(page, '.mc-puce:has-text("Bohème")')         # une quatrième : refusée, avis affiché
    await expect(page.locator('.mc-avis--leger')).to_be_visible()
    await expect(page.locator('.mc-puce[aria-pressed="true"]')).to_have_count(3)
    await page.fill('.mc-champ-libre', 'des tons terracotta')
    await expect(page.locator('.mc-produit-mini').first).to_be_visible()
    await clic(page, '.mc-produit-mini >> nth=0')
    await expect(page.locator('.mc-produit-mini[aria-pressed="true"]')).to_have_count(1)
    await capture(page, 'style', 600)
    await clic(page, '.mc-guide__pied .mc-btn')
    await page.wait_for_selector('.mc-etape--priorite', timeout=20000)
    await expect(page.locator('.mc-guide__pied .mc-btn')).to_be_disabled()
    await clic(page, '.mc-choix__btn:has-text("Le canapé")')
    await clic(page, '.mc-choix__btn:has-text("La lumière")')
    await clic(page, '.mc-choix__btn:has-text("Tout repenser")')   # exclusif
    await expect(page.locator('.mc-choix__btn[aria-pressed="true"]')).to_have_count(1)
    await clic(page, '.mc-choix__btn:has-text("Le canapé")')
    await clic(page, '.mc-choix__btn:has-text("La lumière")')
    await expect(page.locator('.mc-choix__btn[aria-pressed="true"]')).to_have_count(2)
    await capture(page, 'priorite', 600)
    await clic(page, '.mc-guide__pied .mc-btn')
    await page.wait_for_selector('.mc-etape--photos', timeout=20000)
    await expect(page.locator('.mc-guide__pied .mc-btn')).to_be_disabled()
    await page.set_input_files('.mc-photo-principale input[type=file]', str(PHOTO))
    await page.wait_for_selector('.mc-photo-principale img', timeout=30000)
    await page.set_input_files('.mc-photo-mini >> nth=0 >> input[type=file]', str(PHOTO))
    await page.wait_for_selector('.mc-photo-mini.is-pleine', timeout=30000)
    await capture(page, 'photos', 600)
    await expect(page.locator('.mc-guide__pied .mc-btn')).to_be_enabled()
    await clic(page, '.mc-guide__pied .mc-btn')
    await page.wait_for_selector('.mc-charge', timeout=20000)
    await capture(page, 'chargement', 1200)


async def piece(page):
    await page.wait_for_selector('.mc-piece canvas', timeout=120000)
    await expect(page.locator('.mc-station__titre')).to_contain_text('Votre salon', timeout=30000)
    lignes = page.locator('.mc-ligne-piece')
    await expect(lignes.first).to_be_visible()
    nb = await lignes.count()
    assert nb >= 2, f'proposition trop courte ({nb} pièces)'
    await expect(page.locator('.mc-station__pill')).to_contain_text(f'{nb} pièces')
    await expect(page.locator('.mc-rendu-btn')).to_contain_text('2 offerts')
    await capture(page, 'piece-3d', 2500)
    nom = (await lignes.first.locator('b').inner_text()).strip()
    await clic(page, '.mc-ligne-piece >> nth=0')
    await expect(page.locator('.mc-station__titre')).to_contain_text(nom, ignore_case=True)
    await expect(page.locator('.mc-station__pill')).to_contain_text(f'1 sur {nb}')
    await clic(page, '.mc-station__nav button >> nth=2')         # pièce suivante
    await expect(page.locator('.mc-station__pill')).to_contain_text(f'2 sur {nb}')
    await clic(page, '.mc-station__actions .mc-btn--plein')       # 360°
    await page.wait_for_selector('.mc-fiche canvas', timeout=20000)
    await capture(page, 'fiche', 1500)
    await clic(page, '.mc-fiche__fermer')
    await expect(page.locator('.mc-fiche')).to_have_count(0)
    # retirer la pièce choisie, puis revenir à l'ensemble
    await clic(page, '.mc-station__actions button:has-text("Retirer")')
    await expect(page.locator('.mc-toast')).to_contain_text('retiré')
    await expect(page.locator('.mc-ligne-piece')).to_have_count(nb - 1)
    await clic(page, '.mc-segment button:has-text("Soir")')
    await page.wait_for_selector('.mc-piece.is-soir')
    await capture(page, 'soir', 1500)
    await clic(page, '.mc-segment button:has-text("Jour")')
    await clic(page, '.mc-rendu-btn')
    await page.wait_for_selector('.mc-rendu', timeout=10000)
    await page.wait_for_selector('.mc-aa', timeout=60000)
    await expect(page.locator('.mc-rendu__actions')).to_contain_text('restants : 1')
    await capture(page, 'rendu', 2000)
    await clic(page, '.mc-rendu__tete button')
    await expect(page.locator('.mc-rendu-btn')).to_contain_text('1 offert')
    return nb - 1


async def main():
    srv = serveur()
    erreurs, appels = [], []
    try:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            vp = {'width': 390, 'height': 844} if MOBILE else {'width': 1440, 'height': 900}
            ctx = await b.new_context(viewport=vp, locale='fr-FR', is_mobile=MOBILE, has_touch=MOBILE, reduced_motion='no-preference' if MOUVEMENT else 'reduce')
            await ctx.route('https://cdn.shopify.com/**', lambda r: r.fulfill(path=str(PHOTO), content_type='image/jpeg'))
            # le logo MC : une image de remplacement transparente (la vraie est sur le CDN Shopify)
            await ctx.route('**/Maison_Corleone_Logo.png*', lambda r: r.fulfill(path=str(LOGO), content_type='image/png'))
            page = await ctx.new_page()
            page.on('pageerror', lambda e: erreurs.append(f'pageerror {e}'))
            page.on('console', lambda m: erreurs.append(m.text) if m.type == 'error' else None)
            page.on('request', lambda r: appels.append(r.url) if '/api/' in r.url else None)
            if MODE.startswith('demo'):
                await jusquau_parcours(page, '/fr/maison-corleone/demo')
                await etapes(page, connexion_demo=True)
                await piece(page)
                assert not appels, f'la démo a appelé le serveur : {appels[:5]}'
            else:
                await jusquau_parcours(page, '/fr/maison-corleone')
                await etapes(page, connexion_demo=False)
                restantes = await piece(page)
                # rechargement : la pièce revient telle quelle (modifications enregistrées)
                await page.wait_for_timeout(1500)
                await page.reload()
                await page.wait_for_selector('.mc-piece canvas', timeout=60000)
                await expect(page.locator('.mc-ligne-piece')).to_have_count(restantes, timeout=30000)
                await expect(page.locator('.mc-rendu-btn')).to_contain_text('1 offert')
                await capture(page, 'recharge', 1500)
                # un compte Maison Corleone n'entre pas dans l'application RealRoom
                await page.goto(BASE + '/fr/app')
                await page.wait_for_url('**/fr/maison-corleone', timeout=20000)
                # « Mes pièces » après une nouvelle visite : reprise
                await page.wait_for_selector('.mc-pre', state='detached', timeout=60000)
                await clic(page, '.mc-hud--haut button')
                await page.wait_for_selector('.mc-etape--reprise', timeout=20000)
                await expect(page.locator('.mc-reprise__piece')).to_have_count(1)
                await capture(page, 'reprise')
                await clic(page, '.mc-reprise__piece')
                await page.wait_for_selector('.mc-piece canvas', timeout=60000)
                await expect(page.locator('.mc-ligne-piece')).to_have_count(restantes, timeout=30000)
                # déconnexion
                await clic(page, '.mc-piece__menu button:has-text("Se déconnecter")')
                await page.wait_for_url('**/fr/maison-corleone', timeout=20000)
                await page.wait_for_selector('.mc-pre', state='detached', timeout=60000)
                await clic(page, '.mc-hud--haut button')
                await expect(page.locator('.mc-question__titre')).to_contain_text('Votre compte')
            await b.close()
    finally:
        os.killpg(srv.pid, 15)
    # erreurs attendues : aucune
    erreurs = [e for e in erreurs if 'favicon' not in e]
    if DEBORDS:
        print('Débordements horizontaux :', *DEBORDS, sep='\n  ')
    if erreurs:
        print('Erreurs :', *erreurs[:20], sep='\n  ')
    if erreurs or DEBORDS:
        raise SystemExit(1)
    print(f'maison {MODE} : OK ({n} captures dans .essais/)')

asyncio.run(main())

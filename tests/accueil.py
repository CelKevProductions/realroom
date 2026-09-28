#!/usr/bin/env python3
"""Page d'accueil animée (/fr, /en) : écran d'ouverture, révélations au défilement, images épinglées,
ancres, vitrine à glisser, horloge, et les cas sans animation (réduire les animations, sans JavaScript).
Captures dans .essais/.

  npm run build && python3 tests/accueil.py [desktop|mobile]
"""
import asyncio, os, pathlib, re, shutil, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright, expect

RACINE = pathlib.Path(__file__).resolve().parent.parent
OUT = RACINE / '.essais'
OUT.mkdir(exist_ok=True)
PORT = int(os.environ.get('PORT', '3137'))
BASE = f'http://127.0.0.1:{PORT}'
PHOTO = RACINE / 'tests' / 'fixtures' / 'salon-entree.jpg'
FORMAT = sys.argv[1] if len(sys.argv) > 1 else 'desktop'
VP = {'width': 390, 'height': 844} if FORMAT == 'mobile' else {'width': 1400, 'height': 900}


def serveur():
    donnees = RACINE / '.data' / 'essais-accueil'
    shutil.rmtree(donnees, ignore_errors=True)
    env = dict(os.environ, REALROOM_ESSAIS='1', PGLITE_DIR=str(donnees / 'pglite'), FICHIERS_DIR=str(donnees / 'fichiers'), PORT=str(PORT), SITE_URL=BASE)
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
async def capture(page, nom):
    global n
    n += 1
    await page.screenshot(path=str(OUT / f'accueil-{FORMAT}-{n:02d}-{nom}.png'))
    d = await page.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
    if d > 1:
        DEBORDS.append(f'{nom} : +{d}px')


async def contexte(b, **kw):
    ctx = await b.new_context(viewport=VP, locale='fr-FR', is_mobile=FORMAT == 'mobile', has_touch=FORMAT == 'mobile', device_scale_factor=1, **kw)
    await ctx.route('https://cdn.shopify.com/**', lambda r: r.fulfill(path=str(PHOTO), content_type='image/jpeg'))
    return ctx


def suivre(page, erreurs):
    page.on('pageerror', lambda e: erreurs.append(f'{e} [{page.url}] ' + (getattr(e, 'stack', '') or '')[:600]))
    page.on('console', lambda m: erreurs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)


async def jetons(page):
    return (await page.evaluate("() => document.documentElement.getAttribute('data-acc') || ''")).split()


async def defiler_jusqu_en_bas(page, pas):
    """Défile comme un visiteur (molette ou doigt), en vérifiant la largeur de page à chaque arrêt."""
    for i in range(400):
        avant = await page.evaluate('() => scrollY')
        if FORMAT == 'mobile':
            await page.evaluate(f'() => window.scrollBy(0, {pas})')
        else:
            await page.mouse.wheel(0, pas)
        await page.wait_for_timeout(260)
        if i % 6 == 0:
            d = await page.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
            if d > 1:
                DEBORDS.append(f'défilement {i} : +{d}px')
        apres = await page.evaluate('() => scrollY')
        bas = await page.evaluate('() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2')
        if bas and apres == avant:
            return i
    raise AssertionError('le bas de page n’est jamais atteint')


async def visite(b):
    erreurs = []
    ctx = await contexte(b)
    page = await ctx.new_page()
    suivre(page, erreurs)
    popups = []
    page.on('popup', lambda p: popups.append(p.url))

    # 1. écran d'ouverture (première visite de la session), puis le héros
    await page.goto(BASE + '/fr')
    assert 'ouverture' in await jetons(page), await jetons(page)
    await expect(page.locator('[data-ouverture]')).to_be_visible()
    await page.wait_for_timeout(700)
    await capture(page, 'ouverture')
    await page.wait_for_selector('[data-ouverture]', state='hidden', timeout=10000)
    assert 'anime' in await jetons(page)
    await expect(page.locator('h1')).to_contain_text('vrais meubles')
    await page.wait_for_timeout(1800)
    op = await page.evaluate("() => [...document.querySelectorAll('.acc-hero [data-anim]')].map(e => +getComputedStyle(e).opacity)")
    assert min(op) > .99, ('héros encore caché', op)
    heure = await page.locator('[data-horloge]').first.text_content()
    assert re.fullmatch(r'\d\d:\d\d', heure), heure
    await capture(page, 'hero')

    # 2. tout le défilement : captures aux moments clés
    hauteur = await page.evaluate('() => innerHeight')
    reperes = [('trou-milieu', '[data-trou]', .5), ('trou-ouvert', '[data-trou]', .97), ('avant-apres', '[data-aa]', .45), ('methode', '#methode', 0), ('defile', '[data-defile]', 0),
               ('catalogue', '#catalogue', 0), ('tarifs', '#tarifs', 0), ('faq', '#faq', 0), ('fin', '.acc-fin', 0), ('pied', '.acc-pied', 0)]
    for nom, sel, part in reperes:
        # position cible : le haut de l'élément (ou une fraction de sa zone épinglée), atteinte à la molette
        cible = await page.evaluate("""([sel, part]) => {
            const el = document.querySelector(sel); const sp = el.closest('.pin-spacer') || el.parentElement.closest('.pin-spacer');
            const boite = (sp || el).getBoundingClientRect();
            const y = scrollY + boite.top + (sp ? (boite.height - innerHeight) * part : 0);
            return Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight));
        }""", [sel, part])
        for _ in range(80):
            reste = cible - await page.evaluate('() => scrollY')
            if abs(reste) < 40:
                break
            pas = max(-500, min(500, reste))
            if FORMAT == 'mobile':
                await page.evaluate(f'() => window.scrollBy(0, {pas})')
            else:
                await page.mouse.wheel(0, pas)
            await page.wait_for_timeout(180)
        await page.wait_for_timeout(1300)
        await capture(page, nom)
    await defiler_jusqu_en_bas(page, 420 if FORMAT == 'desktop' else 380)
    await page.wait_for_timeout(1800)
    await capture(page, 'bas')

    # tout est révélé une fois la page parcourue
    etat = await page.evaluate("""() => ({
        caches: [...document.querySelectorAll('[data-anim], [data-rangee] > *, [data-mots] > span')].filter(e => +getComputedStyle(e).opacity < .99).map(e => e.className || e.tagName),
        coupe: getComputedStyle(document.querySelector('[data-aa]')).getPropertyValue('--coupe').trim(),
        trou: getComputedStyle(document.querySelector('[data-trou-cadre]')).getPropertyValue('--trou-x').trim(),
        lettres: [...document.querySelectorAll('[data-lettres] > span')].map(e => new DOMMatrix(getComputedStyle(e).transform).m42),
        geant: (() => { const g = document.querySelector('.acc-pied__geant'); const s = [...g.children]; return { plein: g.clientWidth, lettres: s.at(-1).getBoundingClientRect().right - s[0].getBoundingClientRect().left, deborde: g.scrollWidth > g.clientWidth + 1 }; })()
    })""")
    print('état final :', etat)
    assert not etat['caches'], ('éléments jamais révélés', etat['caches'])
    assert etat['coupe'] in ('0%', '0'), etat['coupe']
    assert etat['trou'] in ('0%', '0'), etat['trou']
    assert max(abs(v) for v in etat['lettres']) < 1, etat['lettres']
    assert not etat['geant']['deborde'], etat['geant']

    # 3. ancres : l'en-tête mène aux sections (menu visible dès 1024 px ; sinon le pied de page)
    lien = page.locator('.acc-menu a[href="#tarifs"]') if FORMAT == 'desktop' else page.locator('.acc-pied__nav a[href="#tarifs"]')
    if FORMAT == 'desktop':
        await page.mouse.wheel(0, -300)
        await page.wait_for_timeout(600)
    await lien.click()
    await page.wait_for_timeout(2400)
    haut = await page.evaluate("() => document.querySelector('#tarifs').getBoundingClientRect().top")
    assert abs(haut) < 90, ('ancre #tarifs mal placée', haut)
    assert page.url.endswith('#tarifs'), page.url
    await capture(page, 'ancre-tarifs')

    # 4. vitrine : glisser à la souris fait défiler, sans ouvrir la fiche produit
    if FORMAT == 'desktop':
        await page.locator('#catalogue').scroll_into_view_if_needed()
        await page.wait_for_timeout(1500)
        v = page.locator('[data-vitrine]')
        await v.scroll_into_view_if_needed()
        await page.wait_for_timeout(1200)
        boite = await v.bounding_box()
        avant = await v.evaluate('e => e.scrollLeft')
        x, y = boite['x'] + boite['width'] * .7, boite['y'] + boite['height'] * .35
        await page.mouse.move(x, y)
        await page.mouse.down()
        for k in range(12):
            await page.mouse.move(x - 40 * (k + 1), y, steps=2)
        await page.mouse.up()
        await page.wait_for_timeout(1500)
        apres = await v.evaluate('e => e.scrollLeft')
        print('vitrine : scrollLeft', avant, '→', apres)
        assert apres > avant + 200, (avant, apres)
        assert not popups, ('un glisser a ouvert une fiche', popups)
        await capture(page, 'vitrine-glissee')

    # 5. rechargement : pas de second écran d'ouverture dans la même session
    await page.reload()
    assert 'ouverture' not in await jetons(page), await jetons(page)
    await page.wait_for_timeout(2500)

    # 6. lien interne vers la démo, puis retour : la page se remonte proprement
    await page.evaluate('() => window.scrollTo(0, 0)')
    await page.wait_for_timeout(600)
    await page.click('.acc-hero a:has-text("Voir la démo")')
    await page.wait_for_url('**/fr/demo')
    await expect(page.locator('.carte-projet').first).to_contain_text('Appartement témoin')
    assert await page.evaluate("() => document.documentElement.getAttribute('data-acc')") is None
    await page.go_back()
    await page.wait_for_url(re.compile(r'/fr/?(#.*)?$'))
    await page.wait_for_timeout(2600)
    assert 'anime' in await jetons(page), await jetons(page)
    op = await page.evaluate("() => [...document.querySelectorAll('.acc-hero [data-anim]')].map(e => +getComputedStyle(e).opacity)")
    assert min(op) > .99, ('héros caché après retour', op)
    await capture(page, 'retour')

    # 7. version anglaise
    await page.goto(BASE + '/en')
    await expect(page.locator('h1')).to_contain_text('real furniture')
    await page.wait_for_timeout(2600)
    await capture(page, 'en')
    await ctx.close()
    return erreurs


async def sans_animation(b):
    erreurs = []
    # « réduire les animations » : rien de caché, pas d'écran d'ouverture, rien d'épinglé
    ctx = await contexte(b, reduced_motion='reduce')
    page = await ctx.new_page()
    suivre(page, erreurs)
    await page.goto(BASE + '/fr')
    await page.wait_for_timeout(800)
    j = await jetons(page)
    assert 'mouvement' not in j and 'ouverture' not in j, j
    assert not await page.locator('[data-ouverture]').is_visible()
    caches = await page.evaluate("() => [...document.querySelectorAll('[data-anim], [data-note]')].filter(e => +getComputedStyle(e).opacity < .99).length")
    assert caches == 0, caches
    assert await page.evaluate("() => !document.querySelector('.pin-spacer')"), 'épinglage malgré réduire les animations'
    await capture(page, 'reduit')
    await ctx.close()

    # sans JavaScript : la page est complète
    ctx = await contexte(b, java_script_enabled=False)
    page = await ctx.new_page()
    await page.goto(BASE + '/fr')
    await expect(page.locator('h1')).to_contain_text('vrais meubles')
    assert not await page.locator('[data-ouverture]').is_visible()
    caches = await page.evaluate("() => [...document.querySelectorAll('[data-anim], [data-note], [data-mots] > span')].filter(e => +getComputedStyle(e).opacity < .99).length")
    assert caches == 0, ('contenu caché sans JavaScript', caches)
    await capture(page, 'sans-js')
    await ctx.close()
    return erreurs


async def main():
    srv = serveur()
    try:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            erreurs = await visite(b) + await sans_animation(b)
            await b.close()
    finally:
        os.killpg(srv.pid, 15)
    print('erreurs de page :', erreurs or 'aucune')
    assert not erreurs, erreurs
    assert not DEBORDS, 'pages trop larges : ' + ', '.join(DEBORDS)
    print('OK')


asyncio.run(main())

#!/usr/bin/env python3
"""Captures de l'éditeur 3D (banc d'essai hors Next.js) : vue de dessus, vue photo,
sélection, déplacement à la souris, capture pour le rendu. Sorties dans OUT."""
import asyncio, base64, functools, http.server, os, pathlib, threading
from playwright.async_api import async_playwright

ICI = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path(os.environ.get('OUT') or ICI.parent.parent / '.essais')
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8791

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ICI))
    class Q(http.server.ThreadingHTTPServer): allow_reuse_address = True
    srv = Q(('127.0.0.1', PORT), h)
    srv.RequestHandlerClass.log_message = lambda *a, **k: None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def main():
    srv = serve()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        page = await b.new_page(viewport={'width': 1200, 'height': 800})
        logs = []
        page.on('console', lambda m: logs.append((m.type, m.text)))
        page.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
        await page.goto(f'http://127.0.0.1:{PORT}/editeur.html')
        await page.wait_for_function('window.__pret === true', timeout=60000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(OUT / 'editeur-1-dessus.png'))
        # clic sur le fauteuil (projeté à l'écran), puis glisser
        p = await page.evaluate("() => __editeur.projeter('c1')")
        print('fauteuil à l’écran :', p)
        await page.mouse.move(p['x'], p['y'] + 25)
        await page.mouse.down()
        for s in range(1, 9):
            await page.mouse.move(p['x'] - 12 * s, p['y'] + 25 + 6 * s)
            await page.wait_for_timeout(30)
        await page.mouse.up()
        await page.wait_for_timeout(600)
        print('sélection :', await page.evaluate('window.__sel'), '· déplacement :', await page.evaluate('window.__depl'))
        await page.screenshot(path=str(OUT / 'editeur-2-selection.png'))
        await page.evaluate("() => __editeur.vue('photo', false)")
        await page.wait_for_timeout(1200)
        await page.screenshot(path=str(OUT / 'editeur-3-photo.png'))
        url = await page.evaluate("() => __editeur.capture({ largeur: 1200, hauteur: 800 })")
        (OUT / 'editeur-4-capture.jpg').write_bytes(base64.b64decode(url.split(',', 1)[1]))
        print('capture :', len(url) // 1024, 'Ko')
        erreurs = [l for l in logs if l[0] in ('error', 'pageerror')]
        print('erreurs :', erreurs[:5] if erreurs else 'aucune')
        await b.close()
    srv.shutdown()

asyncio.run(main())

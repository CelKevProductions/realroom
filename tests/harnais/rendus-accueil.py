#!/usr/bin/env python3
"""Rend les images de la page d'accueil (public/images/accueil-*.jpg) avec le moteur 3D."""
import asyncio, base64, functools, http.server, pathlib, threading
from playwright.async_api import async_playwright

ICI = pathlib.Path(__file__).resolve().parent
SORTIE = ICI.parent.parent / 'public' / 'images'
PORT = 8793

def servir():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ICI))
    class Q(http.server.ThreadingHTTPServer): allow_reuse_address = True
    srv = Q(('127.0.0.1', PORT), h)
    srv.RequestHandlerClass.log_message = lambda *a, **k: None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def main():
    srv = servir()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        page = await b.new_page(viewport={'width': 1600, 'height': 1000}, device_scale_factor=1.5)
        erreurs = []
        page.on('pageerror', lambda e: erreurs.append(str(e)))
        await page.goto(f'http://127.0.0.1:{PORT}/accueil.html')
        await page.wait_for_function('window.__pret === true', timeout=90000)
        await page.wait_for_timeout(2500)
        # vue de dessus (maquette), meubles Maison Corleone
        await page.screenshot(path=str(SORTIE / 'accueil-maquette.png'))
        for etat in ['apres', 'avant']:
            await page.evaluate(f"() => __poser('{etat}')")
            await page.wait_for_timeout(1500)
            url = await page.evaluate("() => __ed.capture({ largeur: 2000, hauteur: 1250, qualite: .9 })")
            (SORTIE / f'accueil-photo-{etat}.jpg').write_bytes(base64.b64decode(url.split(',', 1)[1]))
        print('erreurs :', erreurs or 'aucune')
        await b.close()
    srv.shutdown()

asyncio.run(main())

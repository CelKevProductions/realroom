#!/usr/bin/env python3
"""Planches des maquettes 3D du catalogue : chaque produit rendu seul (vue de trois quarts),
et, si ses photos ont été fournies (dossier de photos-produits-*.zip dézippés), côte à côte avec
elles. Sert à juger la ressemblance famille par famille. Sorties dans .essais/galerie/.

  python3 tests/galerie.py                          # tout le catalogue
  python3 tests/galerie.py fauteuil lit             # quelques familles
  python3 tests/galerie.py --ids terracotta rce-05  # quelques produits
  python3 tests/galerie.py --photos ~/photos        # avec les photos (dossiers <id>/1.jpg…)
"""
import argparse, asyncio, base64, functools, http.server, io, pathlib, subprocess, threading
from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright

RACINE = pathlib.Path(__file__).resolve().parent.parent
HARNAIS = RACINE / 'tests' / 'harnais'
SORTIE = RACINE / '.essais' / 'galerie'
PORT = 8794
CASE = 320


def construire():
    subprocess.run(['npx', 'esbuild', str(HARNAIS / 'galerie.js'), '--bundle', '--format=iife', '--loader:.json=json',
                    '--log-level=warning', '--outfile=' + str(HARNAIS / 'galerie.bundle.js')], cwd=RACINE, check=True)
    (HARNAIS / 'galerie.html').write_text('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#EFEBE3}canvas{display:block}</style></head>'
                                          '<body><canvas id="c"></canvas><script src="galerie.bundle.js"></script></body></html>')


def servir():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(HARNAIS))
    class Q(http.server.ThreadingHTTPServer): allow_reuse_address = True
    srv = Q(('127.0.0.1', PORT), h)
    srv.RequestHandlerClass.log_message = lambda *a, **k: None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def police(t):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/System/Library/Fonts/Helvetica.ttc'):
        try:
            return ImageFont.truetype(f, t)
        except OSError:
            pass
    return ImageFont.load_default()


def carre(im, cote, fond=(239, 235, 227)):
    im = im.convert('RGB')
    im.thumbnail((cote, cote), Image.LANCZOS)
    c = Image.new('RGB', (cote, cote), fond)
    c.paste(im, ((cote - im.width) // 2, (cote - im.height) // 2))
    return c


def planche(entrees, titre, chemin, photos):
    """entrees : [(produit, rendu PIL)] ; une rangée par produit si photos, sinon une grille."""
    f, fp = police(15), police(12)
    if photos:
        # photo(s) | maquette, une ligne par produit
        cols = 3
        lignes = []
        for p, rendu in entrees:
            dossier = photos / p['id']
            imgs = [Image.open(x) for x in sorted(dossier.glob('*.jpg'))[:2]] if dossier.exists() else []
            cases = [carre(i, CASE) for i in imgs] + [Image.new('RGB', (CASE, CASE), (230, 226, 218))] * (2 - len(imgs)) + [carre(rendu, CASE)]
            lignes.append((p, cases))
        W, H = cols * CASE + 4 * 8, len(lignes) * (CASE + 30) + 40
        out = Image.new('RGB', (W, H), 'white')
        d = ImageDraw.Draw(out)
        d.text((8, 10), titre + '   (photo 1 · photo 2 · maquette)', fill='black', font=f)
        for i, (p, cases) in enumerate(lignes):
            y = 40 + i * (CASE + 30)
            d.text((8, y), f"{p['id']} — {p['nom']} · {p['st']} · {p['titre'][:70]}", fill='black', font=fp)
            for k, c in enumerate(cases):
                out.paste(c, (8 + k * (CASE + 8), y + 18))
    else:
        cols = 5
        rangs = (len(entrees) + cols - 1) // cols
        out = Image.new('RGB', (cols * (CASE + 8) + 8, rangs * (CASE + 26) + 40), 'white')
        d = ImageDraw.Draw(out)
        d.text((8, 10), titre, fill='black', font=f)
        for i, (p, rendu) in enumerate(entrees):
            x, y = 8 + (i % cols) * (CASE + 8), 40 + (i // cols) * (CASE + 26)
            out.paste(carre(rendu, CASE), (x, y))
            d.text((x, y + CASE + 4), f"{p['id'][:34]} · {p['st']}", fill='black', font=fp)
    out.save(chemin, quality=86)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('familles', nargs='*')
    ap.add_argument('--ids', nargs='*')
    ap.add_argument('--photos', type=pathlib.Path, help='dossier des photos (un sous-dossier par produit)')
    ap.add_argument('--par-planche', type=int, default=12)
    a = ap.parse_args()
    construire()
    srv = servir()
    SORTIE.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        page = await b.new_page(viewport={'width': 640, 'height': 640})
        erreurs = []
        page.on('pageerror', lambda e: erreurs.append(str(e)))
        await page.goto(f'http://127.0.0.1:{PORT}/galerie.html')
        await page.wait_for_function('window.__pret === true', timeout=90000)
        produits = await page.evaluate('() => __ids()')
        choisis = [p for p in produits if (not a.familles or p['fam'] in a.familles) and (not a.ids or p['id'] in a.ids)]
        par_fam = {}
        for p in choisis:
            url = await page.evaluate('id => __rendre(id)', p['id'])
            if not url:
                continue
            im = Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1])))
            (SORTIE / p['fam']).mkdir(exist_ok=True)
            im.save(SORTIE / p['fam'] / f"{p['id']}.jpg", quality=88)
            par_fam.setdefault(p['fam'], []).append((p, im))
        for fam, entrees in par_fam.items():
            for k in range(0, len(entrees), a.par_planche):
                lot = entrees[k:k + a.par_planche]
                chemin = SORTIE / f'planche-{fam}-{k // a.par_planche + 1}.jpg'
                planche(lot, f'{fam} ({k + 1}–{k + len(lot)} sur {len(entrees)})', chemin, a.photos)
                print(chemin.relative_to(RACINE))
        print('erreurs :', erreurs or 'aucune')
        await b.close()
    srv.shutdown()


if __name__ == '__main__':
    asyncio.run(main())

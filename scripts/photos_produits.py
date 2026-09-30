#!/usr/bin/env python3
"""Rassemble les photos des produits du catalogue RealRoom (boutique Maison Corleone) dans un
ou plusieurs zips, à envoyer à Claude pour refaire les meubles en 3D d'après les vraies photos.

Aucune clé ni dépendance : Python 3 seul. Lit le catalogue publié par le site, télécharge
2 photos par produit (réduites, ~40 Ko chacune) et range tout par identifiant de produit.

  python3 photos_produits.py                  # tout le catalogue -> photos-produits-1.zip, -2.zip…
  python3 photos_produits.py --familles lit fauteuil
  python3 photos_produits.py --ids terracotta rce-05 --par-produit 4
"""
import argparse, concurrent.futures as cf, io, json, re, sys, time, urllib.request, zipfile

CATALOGUE = 'https://realroom-sepia.vercel.app/catalogue.json'
TAILLE_ZIP = 18 * 1024 * 1024   # sous la limite des pièces jointes


def lire(url, essais=3):
    for i in range(essais):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'RealRoom-photos/1.0'})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except Exception as e:
            if i == essais - 1:
                raise
            time.sleep(1.5 * (i + 1))


def a_la_largeur(url, largeur):
    # le CDN de Shopify redimensionne selon le paramètre « width »
    if re.search(r'[?&]width=\d+', url):
        return re.sub(r'([?&])width=\d+', r'\g<1>width=%d' % largeur, url)
    return url + ('&' if '?' in url else '?') + 'width=%d' % largeur


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--catalogue', default=CATALOGUE, help='adresse ou chemin du catalogue.json')
    ap.add_argument('--par-produit', type=int, default=2, help='photos par produit (défaut 2)')
    ap.add_argument('--largeur', type=int, default=560, help='largeur des photos en pixels (défaut 560)')
    ap.add_argument('--familles', nargs='*', help='seulement ces familles (lit, fauteuil, canape…)')
    ap.add_argument('--ids', nargs='*', help='seulement ces produits (identifiants du catalogue)')
    ap.add_argument('--sortie', default='photos-produits', help='préfixe des zips')
    a = ap.parse_args()

    brut = lire(a.catalogue) if a.catalogue.startswith('http') else open(a.catalogue, 'rb').read()
    produits = json.loads(brut)['produits']
    choisis = [p for p in produits.values()
               if (not a.familles or p.get('fam') in a.familles) and (not a.ids or p['id'] in a.ids)]
    print(f'{len(choisis)} produits, {a.par_produit} photo(s) chacun')

    taches = []
    for p in choisis:
        urls = [u for u in [p.get('img')] + list(p.get('imgs') or []) if u][:a.par_produit]
        for i, u in enumerate(urls, 1):
            taches.append((p['id'], i, a_la_largeur(u, a.largeur)))

    photos, erreurs = {}, []
    def telecharger(t):
        pid, i, url = t
        try:
            return t, lire(url)
        except Exception as e:
            return t, e
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        for n, (t, res) in enumerate(ex.map(telecharger, taches), 1):
            if isinstance(res, Exception):
                erreurs.append(f'{t[0]} photo {t[1]} : {res}')
            else:
                photos[(t[0], t[1])] = res
            if n % 50 == 0 or n == len(taches):
                print(f'  {n}/{len(taches)} photos')

    # répartition en zips de moins de ~18 Mo, un produit n'est jamais coupé en deux
    index = {p['id']: {'nom': p.get('nom'), 'titre': p.get('titre'), 'famille': p.get('fam'), 'style': p.get('st'),
                       'dimensions_m': p.get('dim'), 'couleurs': p.get('cols'), 'fiche': p.get('url')} for p in choisis}
    lots, lot, taille = [], [], 0
    for p in choisis:
        fichiers = [(k, v) for k, v in photos.items() if k[0] == p['id']]
        poids = sum(len(v) for _, v in fichiers)
        if lot and taille + poids > TAILLE_ZIP:
            lots.append(lot); lot, taille = [], 0
        lot.append((p['id'], sorted(fichiers)))
        taille += poids
    if lot:
        lots.append(lot)

    for n, lot in enumerate(lots, 1):
        nom = f'{a.sortie}-{n}.zip'
        with zipfile.ZipFile(nom, 'w', zipfile.ZIP_STORED) as z:
            for pid, fichiers in lot:
                for (_, i), data in fichiers:
                    z.writestr(f'{pid}/{i}.jpg', data)
            z.writestr('index.json', json.dumps({pid: index[pid] for pid, _ in lot}, ensure_ascii=False, indent=1))
        print(f'{nom} : {len(lot)} produits')
    if erreurs:
        print(f'{len(erreurs)} photo(s) non téléchargée(s) :', *erreurs[:10], sep='\n  ')
    print('Envoie le ou les zips à Claude dans la conversation.')


if __name__ == '__main__':
    main()

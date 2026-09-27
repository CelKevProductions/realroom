#!/usr/bin/env python3
"""Export des produits actifs de la boutique (API Admin GraphQL de Shopify)
vers build/shopify-brut.json, que lit ensuite outils/catalogue.py.

Variables d'environnement :
  SHOPIFY_BOUTIQUE  domaine de la boutique, ex. maison-corleone.myshopify.com
  SHOPIFY_JETON     jeton d'accès Admin API (droit read_products)

Enchaînement pour mettre le catalogue à jour :
  python3 outils/export_shopify.py && python3 outils/catalogue.py && python3 build.py
"""
import json
import os
import pathlib
import sys
import time
import urllib.request

RACINE = pathlib.Path(__file__).resolve().parent.parent
SORTIE = RACINE / 'build' / 'shopify-brut.json'
VERSION = '2025-07'

REQUETE = """
query ($apres: String) {
  products(first: 50, after: $apres, query: "status:active") {
    pageInfo { hasNextPage endCursor }
    nodes {
      id handle title productType tags vendor onlineStoreUrl
      priceRangeV2 { minVariantPrice { amount } maxVariantPrice { amount } }
      featuredMedia { preview { image { url width height } } }
      media(first: 4) { edges { node { preview { image { url } } } } }
      description(truncateAt: 1400)
      descTag: metafield(namespace: "global", key: "description_tag") { value }
      options { name values }
    }
  }
}
"""


def main():
    boutique, jeton = os.environ.get('SHOPIFY_BOUTIQUE'), os.environ.get('SHOPIFY_JETON')
    if not boutique or not jeton:
        sys.exit('Renseigner SHOPIFY_BOUTIQUE et SHOPIFY_JETON.')
    url = f'https://{boutique}/admin/api/{VERSION}/graphql.json'
    produits, apres = [], None
    while True:
        corps = json.dumps({'query': REQUETE, 'variables': {'apres': apres}}).encode()
        req = urllib.request.Request(url, data=corps, headers={'Content-Type': 'application/json', 'X-Shopify-Access-Token': jeton})
        with urllib.request.urlopen(req) as r:
            j = json.loads(r.read())
        if j.get('errors'):
            sys.exit('Erreur Shopify : ' + json.dumps(j['errors'], ensure_ascii=False))
        page = j['data']['products']
        produits += page['nodes']
        print(len(produits), 'produits…')
        if not page['pageInfo']['hasNextPage']:
            break
        apres = page['pageInfo']['endCursor']
        time.sleep(.5)
    SORTIE.parent.mkdir(exist_ok=True)
    SORTIE.write_text(json.dumps(produits, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(produits), 'produits actifs ->', SORTIE)


if __name__ == '__main__':
    main()

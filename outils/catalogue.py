#!/usr/bin/env python3
"""Catalogue complet : produits Shopify actifs -> src/catalogue.js

Pour chaque produit : famille (lit, fauteuil, suspension...), style de la
maquette 3D, dimensions en mètres, couleurs et matière principales, prix,
photos, texte court. Tout est déduit du titre, des tags et de la description.

Entrée : build/shopify-brut.json (export GraphQL Admin des produits actifs)
Sortie : outils/sources/catalogue.js (puis npm run catalogue -> data/catalogue.json)  (window.MC_CATALOGUE = { base, p: {...} })

Clés courtes par produit (le fichier est intégré à la page) :
  n nom court · t titre · f famille · s style · x prix (0 = sur devis) · xm prix max
  d [largeur, profondeur, hauteur] en m · dt 1 si lues dans la fiche (sinon estimées)
  c couleurs (hex) · cn noms des couleurs · fc famille de couleur · m matière
  me métal · b bois · v verre (luminaires) · i photo · g autres photos
  tx texte court · cou couchage [l, L] en m · led, ch (chevets intégrés), ext (extérieur), pm (prix par module)
"""
import html
import json
import pathlib
import re
import unicodedata

RACINE = pathlib.Path(__file__).resolve().parent.parent
BRUT = RACINE / 'build' / 'shopify-brut.json'
SORTIE = RACINE / 'outils' / 'sources' / 'catalogue.js'
BASE_IMG = 'https://cdn.shopify.com/s/files/1/0938/1055/7195/files/'


def sans_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()


def a(txt, *mots):
    """Vrai si l'un des mots (sans accents, préfixes acceptés) apparaît dans le texte."""
    t = sans_accents(txt)
    return any(re.search(r'\b' + sans_accents(m), t) for m in mots)


# ---------------------------------------------------------------------
# Couleurs : expressions du titre (les plus précises d'abord), puis tags
# ---------------------------------------------------------------------
COULEURS = [
    ('rose poudre', '#E3B5BC'), ('bleu roi', '#27408F'), ('bleu marine', '#1F2D4D'), ('bleu nuit', '#1B2440'),
    ('bleu ciel', '#9EC4E0'), ('bleu paon', '#1D5A71'), ('bleu electrique', '#2448C9'), ('bleu cobalt', '#1F48A8'),
    ('bleu-gris', '#7C8C9E'), ('bleu-violet', '#5A4F9A'), ('vert sauge', '#9AAC8C'), ('vert olive', '#6F7A3E'),
    ('vert emeraude', '#1F6B4F'), ('vert sapin', '#244A37'), ('vert anis', '#A9C24B'), ("vert d'eau", '#A8CFC2'),
    ('vert menthe', '#9FD6BD'), ('vert mousse', '#6B7F3A'), ('vert profond', '#1E4A3A'), ('vert fluo', '#7BE04A'),
    ('gris perle', '#C8C8C6'), ('gris anthracite', '#46464B'), ('jaune moutarde', '#C99E2E'), ('orange rouille', '#A9532E'),
    ('brun chocolat', '#4B2F21'), ('blanc ecru', '#ECE4D3'), ('beige sable', '#D5C19C'), ('rose corail', '#E9796B'),
    ('orange terracotta', '#B5603A'),
    ('terracotta', '#B5603A'), ('emeraude', '#1F6B4F'), ('moutarde', '#C99E2E'), ('cognac', '#97582C'),
    ('camel', '#B8864F'), ('caramel', '#B07A45'), ('bordeaux', '#6C1F2B'), ('fuchsia', '#C3317B'),
    ('magenta', '#B2307D'), ('turquoise', '#2EA2A5'), ('safran', '#E2A12B'), ('ocre', '#C2893A'),
    ('rouille', '#A9532E'), ('corail', '#E9796B'), ('lilas', '#B6A2CD'), ('violet', '#6A4A8C'),
    ('anthracite', '#46464B'), ('taupe', '#877768'), ('sable', '#D5C19C'), ('ecru', '#ECE4D3'),
    ('ivoire', '#EEE6D2'), ('creme', '#E9DFC8'), ('beige', '#D8C6A6'), ('perle', '#C8C8C6'),
    ('chocolat', '#4B2F21'), ('marron', '#6B4A33'), ('brun', '#5E4030'), ('noyer', '#5E3F2B'),
    ('rose', '#E0A2B1'), ('rouge', '#A6272D'), ('orange', '#D7732E'), ('jaune', '#E0B53B'),
    ('vert', '#4E7A4A'), ('bleu', '#3E5C8A'), ('gris', '#9A9A9A'), ('noir', '#1F1E22'), ('noire', '#1F1E22'),
    ('ecrue', '#ECE4D3'), ('grise', '#9A9A9A'), ('verte', '#4E7A4A'), ('bleue', '#3E5C8A'), ('brune', '#5E4030'),
    ('blanc', '#F1EEE7'), ('blanche', '#F1EEE7'), ('dore', '#C8A15A'), ('doree', '#C8A15A'), ('or', '#C8A15A'),
    ('laiton', '#C8A15A'), ('argent', '#D0D2D6'), ('chrome', '#D0D2D6'), ('bronze', '#7A5530'), ('multicolore', '#C84B31'),
]
NOMS_COULEURS = {  # libellé affiché pour le nom trouvé dans le titre
    'rose poudre': 'rose poudré', 'bleu electrique': 'bleu électrique', 'vert emeraude': 'vert émeraude',
    'blanc ecru': 'blanc écru', 'emeraude': 'émeraude', 'ecru': 'écru', 'creme': 'crème', 'noire': 'noir',
    'blanche': 'blanc', 'orange terracotta': 'terracotta', 'ecrue': 'écru', 'grise': 'gris', 'verte': 'vert',
    'bleue': 'bleu', 'brune': 'brun',
}
COULEURS_TAGS = {'Noir': '#1F1E22', 'Blanc': '#F1EEE7', 'Beige': '#D8C6A6', 'Gris': '#9A9A9A', 'Marron': '#6B4A33',
                 'Rouge': '#A6272D', 'Rose': '#E0A2B1', 'Orange': '#D7732E', 'Jaune': '#E0B53B', 'Vert': '#4E7A4A',
                 'Bleu': '#3E5C8A', 'Violet': '#6A4A8C', 'Terracotta': '#B5603A', 'Écru': '#ECE4D3',
                 'Crème': '#E9DFC8', 'Taupe': '#877768', 'Cognac': '#97582C', 'Camel': '#B8864F', 'Bordeaux': '#6C1F2B',
                 'Multicolore': '#C84B31', 'Turquoise': '#2EA2A5', 'Moutarde': '#C99E2E', 'Kaki': '#7A7A4A'}
METAUX = {'dore', 'doree', 'or', 'laiton', 'argent', 'chrome', 'bronze'}


def couleurs(titre, tags):
    """Couleurs du revêtement dans l'ordre du titre (hors métaux), puis celles des tags."""
    t = sans_accents(titre)
    # « chaise longue », « pieds griffe dorés »... : les métaux ne comptent pas comme revêtement
    trouvees, occupe = [], []
    for mot, hexa in COULEURS:
        for m in re.finditer(r'\b' + re.escape(mot) + r'\b', t):
            if any(m.start() < f and m.end() > d for d, f in occupe):
                continue
            occupe.append((m.start(), m.end()))
            if mot not in METAUX:
                trouvees.append((m.start(), hexa, NOMS_COULEURS.get(mot, mot)))
    trouvees.sort()
    res, noms = [], []
    for _, h, n in trouvees:
        if h not in res:
            res.append(h)
            noms.append(n)
    if not res:
        for tg in tags:
            h = COULEURS_TAGS.get(tg)
            if h and h not in res:
                res.append(h)
                noms.append(tg.lower())
    return res[:3], noms[:3]


def famille_couleur(hexa, noms):
    """clair, chaud, froid, sombre ou multi : pour les filtres."""
    if not hexa:
        return ''
    if noms and noms[0] in ('multicolore',):
        return 'multi'
    r, g, b = (int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5))
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    s = 0 if mx == mn else (mx - mn) / (1 - abs(2 * l - 1))
    if l < .3:
        return 'sombre'
    if s < .22 or (l > .78 and s < .5):
        return 'clair'
    if mx == r:
        h = (60 * ((g - b) / (mx - mn)) + 360) % 360
    elif mx == g:
        h = 60 * ((b - r) / (mx - mn)) + 120
    else:
        h = 60 * ((r - g) / (mx - mn)) + 240
    return 'chaud' if (h < 65 or h > 300) else 'froid'


def metal(titre):
    t = sans_accents(titre)
    if re.search(r'\b(dore|doree|dores|dorees|or|laiton|bronze)\b', t):
        return 'laiton'
    if re.search(r'\b(chrom|argent|inox|alumin|acier brosse|metal brosse)', t):
        return 'chrome'
    return 'noir'


def matiere(titre, tags, famille):
    t = sans_accents(titre)
    if famille in ('suspension', 'lustre', 'applique', 'lampadaire', 'plafonnier', 'lampe'):
        if 'cristal' in t:
            return 'cristal'
        if 'albatre' in t:
            return 'albatre'
        if re.search(r'acrylique|pvc', t):
            return 'acrylique'
        if re.search(r'soie|tissu|plisse|plumes', t):
            return 'tissu'
        if re.search(r'verre|opalin|globe', t):
            return 'verre'
        return 'metal'
    if famille == 'baignoire':
        return 'acrylique'
    if re.search(r'fourrure|mouton|peluche|poils', t):
        return 'fourrure'
    if re.search(r'bouclet|boucle', t):
        return 'boucle'
    if re.search(r'velours|chenille|cotele|suedine|daim', t):
        return 'velours'
    if re.search(r'cuir|simili|croco|python|vache', t):
        return 'cuir'
    if re.search(r'corde|tress|tricot|rotin|osier|fibre', t):
        return 'corde'
    if re.search(r'resine|fibre de verre|laque', t) and famille in ('fauteuil', 'sculpture', 'banc', 'meuble', 'jardiniere', 'miroir'):
        return 'laque'
    if re.search(r'teck|bois|noyer|chene', t) and famille in ('table', 'meuble'):
        return 'bois'
    tg = ' '.join(tags)
    if 'Cuir' in tg:
        return 'cuir'
    if 'Velours' in tg:
        return 'velours'
    if 'Bouclé' in tg:
        return 'boucle'
    return 'tissu'


def verre(titre):
    t = sans_accents(titre)
    for mot, v in (('fume', 'fume'), ('ambre', 'ambre'), ('givre', 'givre'), ('cristal', 'cristal'), ('transparent', 'clair'),
                   ('opalin', 'opale'), ('albatre', 'albatre'), ('souffle', 'clair')):
        if mot in t:
            return v
    return ''


def bois(titre):
    t = sans_accents(titre)
    if 'teck' in t:
        return 'teck'
    if 'chene' in t or 'naturel' in t or 'clair' in t:
        return 'chene'
    return 'noyer'


# ---------------------------------------------------------------------
# Familles et styles de maquette
# ---------------------------------------------------------------------
def famille(p):
    t, typ = p['title'], p['productType']
    if a(t, 'tabouret') and not a(t, 'fauteuil'):
        return 'tabouret'
    if typ == 'Lit' or typ == 'Lit de repos':
        return 'lit' if typ == 'Lit' else 'meridienne'
    if typ in ('Fauteuil', 'Mobilier Enfant'):
        if a(t, 'chaise longue') and not a(t, 'fauteuil'):
            return 'meridienne'
        return 'fauteuil'
    if typ == 'Canapé':
        return 'canape'
    if typ == 'Luminaire':
        if a(t, 'lampadaire'):
            return 'lampadaire'
        if a(t, 'applique'):
            return 'applique'
        if a(t, 'lustre'):
            return 'lustre'
        if a(t, 'plafonnier'):
            return 'plafonnier'
        if a(t, 'lampe'):
            return 'lampe'
        if a(t, 'monumental', 'xxl'):
            return 'lustre'
        return 'suspension'
    if typ == 'Baignoire':
        return 'baignoire'
    if typ == 'Tabouret de bar':
        return 'tabouret'
    if typ == 'Banc':
        return 'banc'
    if typ == 'Pouf':
        return 'pouf'
    if typ in ('Buffet', 'Console'):
        return 'meuble'
    if typ == 'Table':
        if a(t, 'ensemble') and a(t, 'outdoor', 'jardin'):
            return 'salon-jardin'
        return 'table'
    if typ == 'Tapis':
        return 'tapis'
    if typ == 'Décoration':
        if a(t, 'miroir'):
            return 'miroir'
        return 'sculpture'
    if typ == 'Extérieur & bien-être':
        if a(t, 'balancelle'):
            return 'balancelle'
        if a(t, 'jardiniere'):
            return 'jardiniere'
        if a(t, 'meridienne', 'bain de soleil', 'transat', 'daybed'):
            return 'meridienne'
        if a(t, 'bistrot'):
            return 'table'
        return 'salon-jardin'
    return 'deco'


def style(fam, t, d):
    """Style de maquette d'après le titre (t) et la description (d)."""
    td = t + ' ' + d[:400]
    if fam == 'lit':
        if a(t, 'rond'):
            return 'rond'
        if a(t, 'chesterfield'):
            return 'chesterfield'
        if a(t, 'bulle', 'tubulaire', 'boudin'):
            return 'tubes'
        if a(t, 'nuage', 'cloud', 'arche', 'asymetrique', 'papillon'):
            return 'nuage'
        if a(t, 'ailes', 'aileron', 'enveloppant', 'panoramique', 'wing'):
            return 'ailes'
        if a(t, 'arrondi', 'galbe', 'courbe'):
            return 'galbe'
        if a(t, 'cotele', 'cannel', 'rayure'):
            return 'cannele'
        if a(t, 'xxl', 'matelasse', 'hotel', 'executive', 'caissons', 'modulaire'):
            return 'matelasse'
        if a(t, 'capitonne'):
            return 'capitonne'
        if a(t, 'bois'):
            return 'bois'
        return 'panneau'
    if fam == 'fauteuil':
        if a(t, 'suspendu'):
            return 'suspendu'
        if a(t, 'bascule'):
            return 'bascule'
        if a(t, 'repose-pieds', 'chaise longue', 'relax'):
            return 'relax'
        if a(t, 'pouf'):
            return 'pouf'
        if a(t, 'petale', 'fleur', 'rose ', 'hortensia', 'bloom', 'coquill'):
            return 'petales'
        if a(t, 'pivotant', 'swivel', 'tonneau'):
            return 'pivotant'
        if a(t, 'bergere', 'baroque', 'trone', 'heritage', 'papillon'):
            return 'bergere'
        if a(t, 'chesterfield', 'club', 'chester'):
            return 'club'
        if a(t, 'dossier haut', 'extra-haut', 'dossier extra'):
            return 'haut'
        if a(t, 'tubulaire', 'cage', 'pietement croise', 'p40', 'acier laque', 'structure laiton', 'structure tubulaire'):
            return 'tubulaire'
        if a(t, 'bois', 'noyer', 'compas', 'scandi', 'teck'):
            return 'bois'
        if a(t, 'coque', 'coquille', 'shell', 'oeuf'):
            return 'coque'
        if a(t, 'pouf', 'torique', 'anneau', 'boa', 'ours', 'bunny', 'lapin', 'blob'):
            return 'pouf'
        if a(t, 'cocon', 'rond', 'boule', 'globe', 'goutte', 'drop', 'nest', 'bulbeuse', 'loveuse', 'enveloppant', 'bubble'):
            return 'cocon'
        if a(t, 'fourrure', 'mouton', 'peluche', 'tigre'):
            return 'fourrure'
        if a(t, 'corde', 'tricot', 'tress'):
            return 'corde'
        if a(t, 'sculptural', 'sculpt', 'resine', 'visage', 'column'):
            return 'sculptural'
        if a(td, 'sans pietement', 'directement au sol'):
            return 'cocon'
        return 'lounge'
    if fam == 'canape':
        if a(t, 'circulaire'):
            return 'cercle'
        if a(t, 'courbe', 'organique', 'arrondi', 'asymetrique', 'vagues', 'onda'):
            return 'courbe'
        if a(t, "d'angle", 'angle', ' en u', 'meridienne'):
            return 'angle'
        if a(t, 'galet', 'cloud', 'nuage', 'modulaire', 'modulable', 'module'):
            return 'modules'
        return 'droit'
    if fam == 'suspension':
        if a(t, 'spheri') and a(t, 'tress'):
            return 'tresse'
        if a(t, 'lineaire', 'etagere', 'ruban', 'barre', 'lignes'):
            return 'lineaire'
        if a(t, 'sputnik', 'radial', 'atomic', 'tiges'):
            return 'sputnik'
        if a(t, 'anneau', 'halo', 'orbit', 'circulaire', 'double anneau'):
            return 'anneau'
        if a(t, 'cylindr', 'soie', 'plisse', 'arc silk'):
            return 'cylindre'
        if a(t, 'cluster', 'globes', 'boules', 'bulles', 'nuage', 'bubble', 'perles', 'beads'):
            return 'grappe'
        if a(t, 'spirale', 'cristal', 'corail', 'lotus', 'feuilles', 'petales'):
            return 'cristal'
        if a(t, 'albatre', 'diffuseurs empiles', 'stack', 'luna'):
            return 'empile'
        if a(t, 'tress', 'fibres', 'tubes'):
            return 'tresse'
        return 'globe'
    if fam == 'lustre':
        if a(t, 'cube', 'matrice', 'matrix', 'geometrique', 'modules'):
            return 'matrice'
        if a(t, 'floral', 'fleur'):
            return 'floral'
        if a(t, 'spirale', 'spiral') and a(t, 'anneaux', 'rings'):
            return 'infini'
        if a(t, 'spirale', 'spiral'):
            return 'spirale'
        if a(t, 'cascade', 'rectangulaire', 'plafonnier'):
            return 'cascade'
        if a(t, 'ondes'):
            return 'ondes'
        return 'anneaux'
    if fam == 'applique':
        if a(t, 'modulaire', 'grid', 'grille'):
            return 'grille'
        if a(t, 'vasques', 'stack', 'layers', 'empile'):
            return 'vasques'
        if a(t, 'tube', 'capsule', 'faisceau', 'beam'):
            return 'tube'
        if a(t, 'cadre', 'lames', 'blade'):
            return 'cadre'
        return 'globe'
    if fam == 'baignoire':
        if a(t, "d'angle", 'angle'):
            return 'angle'
        if a(t, 'balneo', 'balneotherapie', 'jets', 'hydromass'):
            return 'balneo'
        if a(t, 'griffe'):
            return 'griffe'
        if a(t, 'slipper', 'sabot'):
            return 'slipper'
        if a(t, 'cannel', 'strie', 'stripe'):
            return 'cannelee'
        if a(t, 'rectangulaire', 'lignes rectangulaires'):
            return 'rect'
        return 'ovale'
    if fam == 'table':
        if a(t, 'ronde', 'champignon', 'appoint'):
            return 'ronde'
        return 'rect'
    if fam == 'salon-jardin':
        if a(t, 'feu', 'fire'):
            return 'feu'
        if a(t, 'organique', 'arrondi', 'sculpt', 'curve'):
            return 'rond'
        return 'lounge'
    if fam == 'sculpture':
        if a(t, 'jardin zen', 'arbre'):
            return 'arbre'
        if a(t, 'cactus'):
            return 'cactus'
        return 'silhouette'
    if fam == 'meridienne':
        return 'daybed' if a(t, 'daybed', 'teck') else 'courbe'
    return ''


# ---------------------------------------------------------------------
# Dimensions (en cm) : largeur l, profondeur p, hauteur h, diamètre d
# ---------------------------------------------------------------------
NB = r'(\d{1,4}(?:[.,]\d+)?)'


def nombre(s):
    return float(s.replace(',', '.'))


def dimensions(fam, t, d, dt):
    txt = html.unescape(dt + ' || ' + d).replace(' ', ' ').replace('×', 'x').replace('X', 'x')
    res = {}
    # « Ø 40 x H 55 cm »
    m = re.search(r'Ø\s*' + NB + r'\s*(?:cm)?\s*x\s*H\s*' + NB + r'\s*cm', txt, re.I)
    if m:
        res = {'d': nombre(m.group(1)), 'h': nombre(m.group(2))}
    # « Dimensions : 130 x 8 x 90 cm (L x l x H) » : l'ordre annoncé fait foi
    m = None if res else re.search(NB + r'\s*(?:cm)?\s*x\s*' + NB + r'\s*(?:cm)?\s*x\s*' + NB + r'\s*cm\s*(\(([^)]{3,60})\))?', txt, re.I)
    if m:
        v = [nombre(m.group(i)) for i in (1, 2, 3)]
        ordre = sans_accents(m.group(5) or '')
        cles = re.findall(r'\b(l|p|h|w|d|longueur|largeur|profondeur|hauteur)\b', ordre)
        if len(cles) >= 3:
            carte = {'l': 'l', 'w': 'l', 'longueur': 'l', 'largeur': 'l', 'p': 'p', 'd': 'p', 'profondeur': 'p', 'h': 'h', 'hauteur': 'h'}
            vus = []
            for c in cles[:3]:
                k = carte.get(c, 'l')
                if k in vus:     # « L x l x H » : le second l est la profondeur
                    k = 'p' if 'p' not in vus else 'h'
                vus.append(k)
            for k, val in zip(vus, v):
                res[k] = val
        else:
            res = {'l': v[0], 'p': v[1], 'h': v[2]}
    elif not res:
        m = re.search(NB + r'\s*(?:cm)?\s*x\s*' + NB + r'\s*cm', txt, re.I)
        if m:
            v = [nombre(m.group(1)), nombre(m.group(2))]
            if fam == 'lit':
                res['couchage'] = sorted(v)
            elif fam in ('fauteuil', 'lampadaire', 'suspension', 'lustre', 'applique', 'sculpture', 'miroir', 'jardiniere', 'tapis'):
                res = {'l': v[0], 'h': v[1]}
            else:
                res = {'l': max(v), 'p': min(v)}
    # couchage des lits
    m = re.search(r'couchage[^0-9]{0,20}' + NB + r'\s*(?:cm)?\s*x\s*' + NB, txt, re.I)
    if m:
        res['couchage'] = sorted([nombre(m.group(1)), nombre(m.group(2))])
    # diamètre (le plus grand d'une liste : « diamètre des sphères 35, 50 et 70 cm »)
    if 'd' not in res:
        m = re.search(r'(?:Ø|diam(?:etre|ètre)?)[^0-9]{0,28}((?:\d{1,4}(?:[.,]\d+)?\s*(?:,|et|à|-)\s*)*\d{1,4}(?:[.,]\d+)?)\s*(cm|m)\b', txt, re.I) \
            or re.search(NB + r'\s*(cm|m)\s*de\s*diam', txt, re.I)
        if m:
            nums = [nombre(x) for x in re.findall(r'\d{1,4}(?:[.,]\d+)?', m.group(1))]
            dv = max(nums) * (100 if m.group(2).lower() == 'm' else 1)
            if 10 <= dv <= 1500:
                res['d'] = dv
    # hauteur, largeur, longueur isolées
    for cle, motif in (('h', r'hauteur(?:\s+totale)?[^0-9]{0,24}' + NB + r'\s*(cm|m)\b'),
                       ('h', NB + r'\s*(cm|m)\s*de\s*haut'),
                       ('l', r'largeur[^0-9]{0,24}' + NB + r'\s*(cm|m)\b'),
                       ('l', NB + r'\s*(cm|m)\s*de\s*large'),
                       ('l', r'longueur[^0-9]{0,24}' + NB + r'\s*(cm|m)\b')):
        if cle in res:
            continue
        m = re.search(motif, txt, re.I)
        if m:
            val = nombre(m.group(1)) * (100 if m.group(2).lower() == 'm' else 1)
            if 5 <= val <= 800:
                res[cle] = val
    # « canapé d'angle courbe 260 cm »
    if fam == 'canape' and 'l' not in res:
        m = re.search(r'\b' + NB + r'\s*cm\b', dt, re.I)
        if m and 120 <= nombre(m.group(1)) <= 500:
            res['l'] = nombre(m.group(1))
    return {k: (v if isinstance(v, list) else round(v, 1)) for k, v in res.items()}


# gabarits par défaut (cm) : l, p, h
DEFAUTS = {
    'lit': (200, 220, 120), 'fauteuil': (82, 80, 82), 'canape': (230, 100, 80), 'suspension': (40, 40, 40),
    'lustre': (100, 100, 90), 'applique': (20, 15, 35), 'lampadaire': (45, 45, 165), 'lampe': (30, 30, 50),
    'plafonnier': (45, 45, 20), 'baignoire': (170, 80, 60), 'tabouret': (48, 48, 100), 'banc': (140, 45, 45),
    'pouf': (60, 60, 42), 'meuble': (180, 45, 80), 'table': (160, 90, 75), 'tapis': (200, 300, 1),
    'miroir': (90, 5, 150), 'sculpture': (60, 40, 120), 'deco': (40, 40, 60), 'balancelle': (300, 220, 220),
    'jardiniere': (80, 80, 70), 'meridienne': (200, 75, 40), 'salon-jardin': (320, 260, 80),
}
# suspensions sans cote : taille selon la forme
DEFAUTS_SUSP = {'sputnik': (80, 80, 70), 'grappe': (70, 70, 60), 'lineaire': (100, 25, 30), 'anneau': (60, 60, 30),
                'tresse': (60, 60, 60), 'cylindre': (40, 40, 55), 'cristal': (60, 60, 50), 'empile': (20, 20, 40), 'globe': (40, 40, 40)}
BORNES = {  # l, p, h plausibles (cm) : hors bornes, on revient au défaut
    'lit': ((140, 360), (180, 280), (60, 200)), 'fauteuil': ((40, 160), (40, 170), (40, 200)),
    'canape': ((120, 520), (60, 320), (40, 130)), 'baignoire': ((90, 220), (60, 190), (40, 90)),
    'suspension': ((8, 260), (5, 260), (5, 300)), 'lustre': ((30, 400), (10, 400), (20, 500)),
    'applique': ((5, 120), (3, 60), (8, 140)), 'lampadaire': ((20, 200), (20, 200), (90, 260)),
    'tabouret': ((30, 70), (30, 70), (35, 125)), 'meuble': ((60, 260), (25, 70), (40, 140)),
    'table': ((40, 320), (40, 200), (35, 110)),
}


def gabarit(fam, dims, sty):
    l0, p0, h0 = DEFAUTS_SUSP.get(sty, DEFAUTS['suspension']) if fam == 'suspension' else DEFAUTS.get(fam, (60, 60, 60))
    l, p, h = dims.get('l'), dims.get('p'), dims.get('h')
    dia = dims.get('d')
    if fam == 'lit':
        cou = dims.get('couchage')
        vals = [x for x in (l, p) if x]
        # largeur hors tout et longueur : la longueur est la plus proche de 215 cm
        if len(vals) == 2:
            lo = min(vals, key=lambda x: abs(x - 215))
            la = vals[0] if vals[1] == lo else vals[1]
            l, p = la, lo
        if cou and not l:
            l = cou[0] + 30
        if cou and not p:
            p = cou[1] + 20
        if sty == 'rond' and dia:
            l = p = dia
    if dia and fam in ('suspension', 'lustre', 'plafonnier', 'jardiniere', 'table', 'pouf', 'lampe', 'tabouret') and not l:
        l = p = dia
    if dia and fam == 'canape' and sty == 'cercle':
        l = p = dia
    if fam in ('suspension', 'lustre', 'plafonnier', 'jardiniere', 'lampe', 'pouf') and l and not p:
        p = l
    b = BORNES.get(fam)
    l = l or l0
    p = p or p0
    h = h or h0
    if b:
        if not b[0][0] <= l <= b[0][1]:
            l = l0
        if not b[1][0] <= p <= b[1][1]:
            p = min(max(p, b[1][0]), b[1][1]) if fam != 'lit' else p0
        if not b[2][0] <= h <= b[2][1]:
            h = h0
    # suspensions : la hauteur annoncée comprend souvent la descente réglable
    if fam == 'suspension' and h > 1.6 * max(l, 25):
        h = round(min(h, max(l, 25) * 1.4), 1)
    return [round(l / 100, 3), round(p / 100, 3), round(h / 100, 3)]


# ---------------------------------------------------------------------
# Nom court, texte, photos
# ---------------------------------------------------------------------
LIBELLE = {'lit': 'Lit', 'fauteuil': 'Fauteuil', 'canape': 'Canapé', 'suspension': 'Suspension', 'lustre': 'Lustre',
           'applique': 'Applique', 'lampadaire': 'Lampadaire', 'plafonnier': 'Plafonnier', 'baignoire': 'Baignoire',
           'tabouret': 'Tabouret', 'banc': 'Banc', 'pouf': 'Pouf', 'meuble': 'Buffet', 'table': 'Table', 'tapis': 'Tapisserie',
           'miroir': 'Miroir', 'sculpture': 'Sculpture', 'balancelle': 'Balancelles', 'jardiniere': 'Jardinière',
           'meridienne': 'Méridienne', 'salon-jardin': 'Salon', 'deco': 'Décoration', 'lampe': 'Lampe'}
REF = re.compile(r'^(?:mod[eè]le\s+)?([A-Z]{1,4}\d{2,5}[A-Z]?(?:-\d+)?)((?:\s+[A-Za-z]+)?)$', re.I)
PETITS = {'de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'à', 'au', 'aux', "d'", 'a'}


def propre(s):
    """PRUSSE -> Prusse ; CIGAR 1919 -> Cigar 1919 (les noms en capitales)."""
    if s.upper() == s and re.search(r'[A-Z]{3}', s):
        mots = s.split()
        return ' '.join(m if (m.isdigit() or len(m) <= 1) else (m.lower() if i and m.lower() in PETITS else m.capitalize()) for i, m in enumerate(mots))
    return s


def nom_court(titre, fam, handle, couleur=''):
    t = html.unescape(titre).strip()
    t = re.sub(r'\s*/\s*Par [Mm]odule\s*$', '', t)
    tete, queue = t, ''
    for sep in (' – ', ' - ', ' — '):
        if sep in t:
            tete, queue = t.rsplit(sep, 1)
            break
    if queue:
        q = re.sub(r'^Collection\s+', '', queue.strip().strip('"«» '))
        m = REF.match(q)
        if m:
            return (LIBELLE.get(fam, '') + ' ' + m.group(1).upper() + m.group(2)).strip()
        if re.match(r'^\d{3,5}$', q):
            return LIBELLE.get(fam, '') + ' ' + q
        if q[:1].isupper() and len(q) <= 34 and not re.match(r'^\d+\s*x\s*\d+', q):
            return propre(q)
    # un nom en capitales dans le titre : « Fauteuil COEUR en laine... »
    for w in re.findall(r'\b(?:[A-ZÉÈ]{3,}|[A-Z]+\d+)\b', t):
        if w not in ('LED', 'XXL', 'XL', 'PVC', 'WA'):
            return propre(w) if not re.search(r'\d', w) else LIBELLE.get(fam, '') + ' ' + w
    # un nom propre au milieu d'un titre en minuscules : « Suspension Arc Silk en tissu... »
    mots = t.split()
    titre_casse = len(mots) >= 5 and sum(1 for w in mots[1:] if w[:1].isupper()) > len(mots[1:]) * .5
    if not titre_casse:
        m = re.search(r'(?<=\s)((?:[A-Z][\wéèà-]+)(?:\s+[A-Z][\wéèà-]+)+)', t) or re.search(r'\s([A-Z][a-zéèà]{3,})$', t)
        if m:
            return m.group(1)
    # une baignoire de la gamme WA : sa référence
    if re.match(r'^wa\d{3,5}[a-z]?$', handle):
        return LIBELLE.get(fam, '') + ' ' + handle.upper()
    # sinon : le début du titre, jusqu'au premier « en », « avec » ou virgule
    court = re.split(r'\s+(?:en|avec)\s+|,', tete)[0]
    mots = court.split()[:5]
    while len(mots) > 2 and mots[-1].lower() in PETITS:
        mots.pop()
    court = ' '.join([mots[0]] + [w if re.match(r'^[A-Z0-9-]+$', w) and len(w) > 2 else w.lower() for w in mots[1:]])
    if len(court) > 40:
        court = court[:38].rsplit(' ', 1)[0]
        while court.split()[-1].lower() in PETITS:
            court = court.rsplit(' ', 1)[0]
    # « Fauteuil lounge » seul ne distingue rien : on précise la couleur
    if len(court.split()) <= 2 and couleur:
        court += ' ' + couleur
    return court


def texte_court(desc, n=460):
    d = re.sub(r'\s+', ' ', html.unescape(desc or '')).strip()
    # la description Shopify se termine souvent par la fiche technique : on garde le récit
    d = re.split(r'Caractéristiques techniques|Idéal pour\s*:|À considérer\s*:', d)[0].strip()
    if len(d) <= n:
        return d
    coupe = d[:n]
    fin = max(coupe.rfind('. '), coupe.rfind('! '))
    return (coupe[:fin + 1] if fin > 120 else coupe.rsplit(' ', 1)[0] + '…').strip()


def chemin_img(u):
    if not u:
        return None
    return u[len(BASE_IMG):] if u.startswith(BASE_IMG) else u


def main():
    brut = json.loads(BRUT.read_text(encoding='utf-8'))
    produits = {}
    stats = {}
    for n in brut:
        fam = famille(n)
        titre = html.unescape(n['title'])
        desc = n.get('description') or ''
        dt = (n.get('descTag') or {}).get('value') or ''
        sty = style(fam, titre, desc)
        dims = dimensions(fam, titre, desc, dt)
        lph = gabarit(fam, dims, sty)
        pmin = float(n['priceRangeV2']['minVariantPrice']['amount'])
        pmax = float(n['priceRangeV2']['maxVariantPrice']['amount'])
        media = [e['node']['preview']['image']['url'] for e in (n.get('media') or {}).get('edges', [])
                 if e['node'].get('preview') and e['node']['preview'].get('image')]
        une = ((n.get('featuredMedia') or {}).get('preview') or {}).get('image') or {}
        photo = une.get('url') or (media[0] if media else None)
        cols, noms = couleurs(titre, n.get('tags') or [])
        mat = matiere(titre, n.get('tags') or [], fam)
        p = {'n': nom_court(titre, fam, n['handle'], noms[0] if noms else ''), 't': titre, 'f': fam, 's': sty,
             'x': round(pmin, 2) if pmin > 1 else 0, 'd': lph}
        if dims:
            p['dt'] = 1
        if pmax > pmin + .5:
            p['xm'] = round(pmax, 2)
        if cols:
            p['c'] = cols
            p['cn'] = noms
            fc = famille_couleur(cols[0], noms)
            if fc:
                p['fc'] = fc
        p['m'] = mat
        me = metal(titre)
        if me != 'noir':
            p['me'] = me
        if fam in ('lit', 'fauteuil', 'table', 'meuble', 'meridienne', 'salon-jardin', 'canape') and re.search(r'bois|noyer|teck|chene|chêne', titre, re.I):
            p['b'] = bois(titre)
        if fam in ('suspension', 'lustre', 'applique', 'lampadaire', 'plafonnier'):
            v = verre(titre)
            if v:
                p['v'] = v
        if photo:
            p['i'] = chemin_img(photo)
        autres = [chemin_img(u) for u in media if u and u != photo][:3]
        if autres:
            p['g'] = autres
        p['tx'] = texte_court(desc)
        if a(titre, 'par module') or a(titre, '/ par module'):
            p['pm'] = 1
        if a(titre + ' ' + desc[:300], 'led'):
            p['led'] = 1
        if fam == 'lit':
            if dims.get('couchage'):
                p['cou'] = [round(x / 100, 2) for x in dims['couchage']]
            if a(titre + ' ' + dt, 'chevets integres', 'chevets suspendus', 'chevets flottants', 'consoles suspendues', 'chevets en bois'):
                p['ch'] = 1
        if n['productType'] == 'Extérieur & bien-être' or (
                fam in ('canape', 'fauteuil', 'table', 'meridienne', 'salon-jardin', 'jardiniere', 'balancelle')
                and a(titre, 'outdoor', "d'exterieur", 'exterieur', 'jardin', 'teck') and not a(titre, "d'interieur")):
            p['ext'] = 1
        produits[n['handle']] = p
        stats[fam] = stats.get(fam, 0) + 1
    SORTIE.write_text('/* Catalogue Maison Corleone (généré par outils/catalogue.py depuis Shopify : ne pas modifier à la main) */\n'
                      'window.MC_CATALOGUE = ' + json.dumps({'base': BASE_IMG, 'p': produits}, ensure_ascii=False, separators=(',', ':')) + ';\n',
                      encoding='utf-8')
    print(len(produits), 'produits ->', SORTIE, round(SORTIE.stat().st_size / 1024), 'Ko')
    print(sorted(stats.items(), key=lambda x: -x[1]))


if __name__ == '__main__':
    main()

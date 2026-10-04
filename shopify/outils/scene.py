# Section Shopify « Chez vous » (Maison Corleone) : la pièce dessinée au trait, en axonométrie.
# Produit le SVG (plan → murs → meubles) et la position des étiquettes, en unités du viewBox.
import math

K, OX, OY = 240.0, 300.0, 120.0
H = 130.0              # hauteur des murs (unités écran)
VM = 3.6 / 4.2         # mur de droite : 3,60 m quand le mur de gauche fait 4,20 m (= 1)
EP = 0.03              # épaisseur des murs
D = 0.075              # recul des lignes de cote
VB = (25.0, -60.0, 530.0, 444.0)    # viewBox : x, y, largeur, hauteur

# vue de dessus : la même transformation que le CSS (rotation -45°, étirement vertical) autour du centre du sol
PLAN_S, PLAN_DY = 0.78, -12.0


def P(u, v, h=0.0):
    return (OX - K * u + K * v, OY + K / 2 * u + K / 2 * v - h)


CENTRE = P(0.5, VM / 2)


def vers_plan(p):
    """Position à l'écran d'un point du sol en vue de dessus (pour les textes de cote du plan)."""
    x, y = p[0] - CENTRE[0], p[1] - CENTRE[1]
    x, y = x * PLAN_S, y * PLAN_S * 2
    c = s = math.sqrt(0.5)
    # rotate(-45deg) en CSS (y vers le bas) : x' = x cos + y sin ; y' = -x sin + y cos
    return (CENTRE[0] + x * c + y * s, CENTRE[1] - x * s + y * c + PLAN_DY)


def n(x):
    s = f'{x:.1f}'
    return '0' if s in ('-0.0', '0.0') else (s[:-2] if s.endswith('.0') else s)


def poly(pts, ferme=True):
    out = []
    for p in pts:
        if not out or abs(out[-1][0] - p[0]) > 0.05 or abs(out[-1][1] - p[1]) > 0.05:
            out.append(p)
    return 'M' + 'L'.join(f'{n(x)} {n(y)}' for x, y in out) + ('Z' if ferme else '')


def contour(u0, u1, v0, v1, r, pas=6):
    """Rectangle arrondi au sol : points (angle de la normale en degrés, u, v), de 0 à 360°."""
    r = min(r, (u1 - u0) / 2, (v1 - v0) / 2)
    coins = [(u1 - r, v1 - r), (u0 + r, v1 - r), (u0 + r, v0 + r), (u1 - r, v0 + r)]
    pts = []
    for k, (cu, cv) in enumerate(coins):
        for i in range(pas + 1):
            a = k * 90 + i * 90 / pas
            t = math.radians(a)
            pts.append((a, cu + r * math.cos(t), cv + r * math.sin(t)))
    return pts


def visibles(pts):
    # normales tournées vers l'observateur (direction +u +v) : de -45° à 135°
    return [p for p in pts if p[0] >= 315] + [p for p in pts if p[0] <= 135]


def bloc(u0, u1, v0, v1, h0, h1, r=0.0, pas=6):
    """Volume (rectangle arrondi extrudé) : (côtés visibles, dessus)."""
    pts = contour(u0, u1, v0, v1, r, pas)
    vis = visibles(pts)
    cote = poly([P(u, v, h1) for _, u, v in vis] + [P(u, v, h0) for _, u, v in reversed(vis)])
    if r < 1e-6:
        cote += poly([P(u1, v1, h1), P(u1, v1, h0)], ferme=False)
    dessus = poly([P(u, v, h1) for _, u, v in pts])
    return cote, dessus


def couture(u0, u1, v0, v1, h, r=0.0):
    """Trait horizontal sur la face visible d'un volume (couture, bourrelet)."""
    return poly([P(u, v, h) for _, u, v in visibles(contour(u0, u1, v0, v1, r))], ferme=False)


def cyl(cu, cv, r, h0, h1):
    return bloc(cu - r, cu + r, cv - r, cv + r, h0, h1, r, pas=12)


def vol(b):
    c, d = b
    return f'<path class="mcv__c" d="{c}"/><path class="mcv__d" d="{d}"/>'


def trace(d, cls='mcv__l', delai=None):
    style = f' style="--d:{delai}ms"' if delai is not None else ''
    return f'<path class="{cls} mcv__t" pathLength="1" d="{d}"{style}/>'


# ---------- le plan (sol, murs en coupe, fenêtre, cotes) ----------

def plan():
    o = []
    sol = poly([P(0, 0), P(1, 0), P(1, VM), P(0, VM)])
    o.append(f'<path class="mcv__sol mcv__f" d="{sol}"/>')
    # murs en coupe (poché), avec l'ouverture de la fenêtre
    poche = poly([P(-EP, -EP), P(1, -EP), P(1, 0), P(0, 0), P(0, VM), P(-EP, VM)])
    o.append(f'<path class="mcv__poche mcv__f" style="--d:300ms" d="{poche}"/>')
    baie = poly([P(-EP - .002, .30), P(.002, .30), P(.002, .60), P(-EP - .002, .60)])
    o.append(f'<path class="mcv__baie mcv__f" style="--d:300ms" d="{baie}"/>')
    o.append(f'<path class="mcv__lf mcv__f" style="--d:450ms" d="{poly([P(-EP / 2, .30), P(-EP / 2, .60)], False)}"/>')
    o.append(trace(sol, 'mcv__l', 0))
    # lames du parquet
    for k in range(1, 8):
        v = k * VM / 8
        o.append(trace(poly([P(0.004, v), P(.996, v)], False), 'mcv__lf mcv__lame', 160 + k * 60))
    # cotes : largeur le long du bord avant gauche, longueur le long du bord avant droit
    a, b = 1 + D, VM + D
    o.append(trace(poly([P(a, 0), P(a, VM)], False), 'mcv__lf mcv__cote', 650))
    o.append(trace(poly([P(0, b), P(1, b)], False), 'mcv__lf mcv__cote', 650))
    for d in (poly([P(1.012, 0), P(a + .022, 0)], False), poly([P(1.012, VM), P(a + .022, VM)], False),
              poly([P(0, VM + .012), P(0, b + .022)], False), poly([P(1, VM + .012), P(1, b + .022)], False)):
        o.append(trace(d, 'mcv__lf mcv__cote', 600))
    # petites barres obliques aux extrémités, comme sur un plan d'architecte
    for (u, v) in ((a, 0), (a, VM), (0, b), (1, b)):
        o.append(trace(poly([P(u - .014, v + .014), P(u + .014, v - .014)], False), 'mcv__l mcv__cote', 800))
    return ''.join(o)


def textes_cote():
    """Textes des cotes, en vue de dessus (droits) et en 3D (dans l'axe des bords)."""
    ang = math.degrees(math.atan2(K / 2, K))     # 26,57°
    pa_iso, pb_iso = P(1 + D + .058, VM * .34), P(.25, VM + D + .058)
    pa_plan, pb_plan = vers_plan(P(1 + D + .07, VM / 2)), vers_plan(P(.5, VM + D + .085))
    t = '<text class="mcv__cote-texte" x="{x}" y="{y}" transform="rotate({r} {x} {y})">{txt}</text>'
    plan_ = (t.format(x=n(pa_plan[0]), y=n(pa_plan[1]), r=0, txt='@@LARGEUR@@')
             + t.format(x=n(pb_plan[0]), y=n(pb_plan[1]), r=-90, txt='@@LONGUEUR@@'))
    iso = (t.format(x=n(pa_iso[0]), y=n(pa_iso[1]), r=n(ang), txt='@@LARGEUR@@')
           + t.format(x=n(pb_iso[0]), y=n(pb_iso[1]), r=n(-ang), txt='@@LONGUEUR@@'))
    return plan_, iso


# ---------- les murs ----------

def groupe_mur(cls, base0, base1, contenu):
    """Mur qui se dresse depuis sa ligne de sol : origine de la transformation au milieu de la base."""
    mx, my = (base0[0] + base1[0]) / 2, (base0[1] + base1[1]) / 2
    return (f'<g transform="translate({n(mx)} {n(my)})"><g class="mcv__mur {cls}">'
            f'<g transform="translate({n(-mx)} {n(-my)})">{contenu}</g></g></g>')


def murs():
    # mur de gauche (v = 0) : face, plinthe, arêtes, coupe (dessus et extrémité)
    g = [f'<path class="mcv__mur-a" d="{poly([P(0, 0, 0), P(1, 0, 0), P(1, 0, H), P(0, 0, H)])}"/>',
         f'<path class="mcv__lf" d="{poly([P(0, 0, 6), P(1, 0, 6)], False)}"/>',
         f'<path class="mcv__poche" d="{poly([P(0, 0, H), P(1, 0, H), P(1, -EP, H), P(-EP, -EP, H)])}{poly([P(1, 0, 0), P(1, 0, H), P(1, -EP, H), P(1, -EP, 0)])}"/>',
         f'<path class="mcv__l" d="{poly([P(0, 0, 0), P(0, 0, H)], False)}{poly([P(1, 0, 0), P(1, 0, H)], False)}{poly([P(0, 0, H), P(1, 0, H)], False)}"/>']
    # mur de droite (u = 0) : face, plinthe, fenêtre (dormant, ouvrant, meneau, appui), coupe
    v0, v1, b, t = .30, .60, 42, 112
    d = [f'<path class="mcv__mur-b" d="{poly([P(0, 0, 0), P(0, VM, 0), P(0, VM, H), P(0, 0, H)])}"/>',
         f'<path class="mcv__lf" d="{poly([P(0, 0, 6), P(0, VM, 6)], False)}"/>',
         f'<path class="mcv__vitre mcv__l" d="{poly([P(0, v0, b), P(0, v1, b), P(0, v1, t), P(0, v0, t)])}"/>',
         f'<path class="mcv__lf" d="{poly([P(0, v0 + .016, b + 5), P(0, v1 - .016, b + 5), P(0, v1 - .016, t - 5), P(0, v0 + .016, t - 5)])}{poly([P(0, .45, b + 5), P(0, .45, t - 5)], False)}"/>',
         vol(bloc(0, .03, v0 - .012, v1 + .012, b - 4, b)),
         f'<path class="mcv__poche" d="{poly([P(0, 0, H), P(-EP, -EP, H), P(-EP, VM, H), P(0, VM, H)])}{poly([P(0, VM, 0), P(0, VM, H), P(-EP, VM, H), P(-EP, VM, 0)])}"/>',
         f'<path class="mcv__l" d="{poly([P(0, VM, 0), P(0, VM, H)], False)}{poly([P(0, 0, H), P(0, VM, H)], False)}"/>']
    return (groupe_mur('mcv__mur--d', P(0, 0), P(0, VM), ''.join(d))
            + groupe_mur('mcv__mur--g', P(1, 0), P(0, 0), ''.join(g)))


def tapisserie():
    # tapisserie murale (« Muse Botanique ») au-dessus du canapé, sur le mur de gauche
    def w(x, h):            # x : distance le long du mur (en unités de u), h : hauteur
        return P(x, 0.004, h)
    u0, u1, h0, h1 = .40, .66, 60, 112
    o = [f'<path class="mcv__d" d="{poly([w(u0, h0), w(u1, h0), w(u1, h1), w(u0, h1)])}"/>']
    feuilles = []
    for (cu, ch, a, L, W) in ((.53, 98, 80, .07, 9), (.47, 86, 145, .065, 8), (.59, 84, 30, .065, 8), (.50, 72, 120, .05, 6.5), (.57, 71, 55, .05, 6.5)):
        pts = []
        for i in range(17):
            th = math.radians(i * 360 / 16)
            x, y = L / 2 * math.cos(th), W / 2 * math.sin(th) * (1 if i <= 8 else 1)
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            # x en unités de mur (u), y en hauteur ; on tourne dans le plan du mur (u mis à l'échelle de la hauteur)
            xs, ys = x * 268, y
            xr, yr = xs * ca - ys * sa, xs * sa + ys * ca
            pts.append(w(cu + xr / 268, ch + yr))
        feuilles.append(poly(pts))
    o.append(f'<path class="mcv__lf mcv__feuille" d="{"".join(feuilles)}"/>')
    o.append(f'<path class="mcv__lf" d="{poly([w(.53, 64), w(.53, 92)], False)}"/>')
    return ''.join(o)


# ---------- les meubles ----------

def tapis():
    c, d = bloc(.30, .70, .29, .67, 0, 1.2, r=.015)
    bord = poly([P(u, v, 1.2) for _, u, v in contour(.325, .675, .315, .645, .01)])
    return f'<path class="mcv__tapis" d="{d}"/><path class="mcv__lf" d="{bord}"/>'


def canape():
    # « Bouclé Noyer » : canapé d'angle bouclé, méridienne côté pièce
    o = [vol(bloc(.26, .86, .02, .245, 0, 22, r=.022))]          # assise
    o.append(vol(bloc(.26, .86, .02, .075, 22, 45, r=.02)))      # dossier
    for a, b_ in ((.275, .46), (.47, .655), (.665, .85)):            # coussins de dos
        o.append(vol(bloc(a, b_, .07, .125, 22, 40, r=.022)))
    o.append(vol(bloc(.26, .315, .075, .245, 22, 35, r=.018)))   # accoudoir
    o.append(f'<path class="mcv__lf" d="{poly([P(.46, .08, 22), P(.46, .243, 22)], False)}"/>')
    o.append(vol(bloc(.635, .86, .245, .475, 0, 22, r=.022)))    # méridienne
    o.append(f'<path class="mcv__lf" d="{poly([P(.65, .245, 22), P(.845, .245, 22)], False)}"/>')
    o.append(f'<path class="mcv__lf" d="{couture(.26, .86, .02, .245, 8, .022)}"/>')
    o.append(f'<path class="mcv__lf" d="{couture(.635, .86, .245, .475, 8, .022)}"/>')
    return ''.join(o)


def table():
    # « Nordic » : table d'appoint champignon, effet travertin
    cu, cv = .47, .45
    o = [vol(cyl(cu, cv, .05, 0, 3)), vol(cyl(cu, cv, .026, 3, 24)), vol(cyl(cu, cv, .082, 24, 31))]
    o.append(f'<path class="mcv__lf" d="{couture(cu - .082, cu + .082, cv - .082, cv + .082, 27.5, .082)}"/>')
    return ''.join(o)


def fauteuil():
    # « Terracotta » : fauteuil lounge à bourrelets, dos à la fenêtre
    o = [vol(bloc(.045, .25, .53, .73, 0, 20, r=.06))]
    o.append(f'<path class="mcv__lf" d="{couture(.045, .25, .53, .73, 10, .06)}"/>')
    o.append(vol(bloc(.03, .095, .53, .73, 20, 41, r=.032)))
    o.append(vol(bloc(.095, .25, .53, .578, 20, 31, r=.024)))
    o.append(vol(bloc(.095, .25, .682, .73, 20, 31, r=.024)))
    return ''.join(o)


def lampadaire():
    # « Feather Palm » : pied doré sculpté, plumes en palme
    cu, cv, haut = .12, .12, 98
    o = [vol(cyl(cu, cv, .036, 0, 4))]
    o.append(f'<path class="mcv__l" d="{poly([P(cu, cv, 4), P(cu, cv, haut)], False)}"/>')
    feuilles = []
    for k in range(9):
        phi = math.radians(k * 40 + 12)
        L = .095 + .018 * math.sin(k * 1.7)
        centre, gauche, droite = [], [], []
        for i in range(13):
            t = i / 12
            uu, vv = cu + t * L * math.cos(phi), cv + t * L * math.sin(phi)
            h = haut + 16 * t - 34 * t * t
            w = .02 * math.sin(math.pi * min(t * 1.08, 1)) ** .8
            nu, nv = -math.sin(phi), math.cos(phi)
            centre.append(P(uu, vv, h))
            gauche.append(P(uu + w * nu, vv + w * nv, h))
            droite.append(P(uu - w * nu, vv - w * nv, h))
        prof = math.cos(phi) + math.sin(phi)      # les plumes de devant se dessinent en dernier
        feuilles.append((prof, f'<path class="mcv__d" d="{poly(gauche + droite[::-1])}"/><path class="mcv__lf" d="{poly(centre, False)}"/>'))
    o += [f for _, f in sorted(feuilles)]
    return ''.join(o)


# étiquettes : point d'ancrage sur le meuble, coude, côté du texte
ORDRE_CHUTE = {'canape': 0, 'table': 270, 'fauteuil': 540, 'lampe': 810}
ETIQUETTES = {
    'canape':   {'ancre': P(.80, .40, 22), 'coude': (178, 342), 'cote': 'g'},
    'table':    {'ancre': P(.47, .45, 31), 'coude': (428, 342), 'cote': 'd'},
    'fauteuil': {'ancre': P(.06, .70, 41), 'coude': (500, -22), 'cote': 'g'},
    'lampe':    {'ancre': P(.105, .095, 112), 'coude': (232, -22), 'cote': 'g'},
}
for _c, _e in ETIQUETTES.items():
    _e['delai'] = ORDRE_CHUTE[_c] + 600      # le fil part quand le meuble s'est posé


def reperes():
    o = []
    for cle, e in ETIQUETTES.items():
        ax, ay = e['ancre']
        cx, cy = e['coude']
        fin = (cx - 16, cy) if e['cote'] == 'g' else (cx + 16, cy)
        d = poly([(ax, ay), (cx, cy), fin], False)
        o.append(f'<g class="mcv__repere" style="--d:{e["delai"]}ms">'
                 f'<path class="mcv__fil mcv__t" pathLength="1" d="{d}"/>'
                 f'<circle class="mcv__point" cx="{n(ax)}" cy="{n(ay)}" r="3.2"/></g>')
    return ''.join(o)


def position_etiquette(cle):
    """Position (en %) du bout du fil, là où commence le texte."""
    e = ETIQUETTES[cle]
    cx, cy = e['coude']
    x = cx - 16 - 5 if e['cote'] == 'g' else cx + 16 + 5
    gx = (x - VB[0]) / VB[2] * 100
    gy = (cy - VB[1]) / VB[3] * 100
    return round(gx, 2), round(gy, 2)


def svg():
    cx, cy = CENTRE
    plan_txt, iso_txt = textes_cote()
    meubles = [('tapis', tapis(), -150), ('lampe', lampadaire(), ORDRE_CHUTE['lampe']), ('canape', canape(), ORDRE_CHUTE['canape']),
               ('fauteuil', fauteuil(), ORDRE_CHUTE['fauteuil']), ('table', table(), ORDRE_CHUTE['table'])]
    m = ''.join(f'<g class="mcv__meuble mcv__meuble--{c}" style="--d:{d + 150}ms">{x}</g>' for c, x, d in meubles)
    m = f'<g class="mcv__deco" style="--d:400ms">{tapisserie()}</g>' + m
    vb = ' '.join(n(x) for x in VB)
    return (f'<svg class="mcv__svg" viewBox="{vb}" aria-hidden="true" focusable="false">'
            f'<g transform="translate({n(cx)} {n(cy)})"><g class="mcv__plan"><g transform="translate({n(-cx)} {n(-cy)})">{plan()}</g></g></g>'
            f'<g class="mcv__cotes-plan">{plan_txt}</g>'
            f'<g class="mcv__murs">{murs()}</g>'
            f'<g class="mcv__cotes-iso">{iso_txt}</g>'
            f'<g class="mcv__meubles">{m}</g>'
            f'<g class="mcv__reperes">{reperes()}</g>'
            '</svg>')


if __name__ == '__main__':
    s = svg()
    print(len(s), 'octets de SVG')
    for c in ETIQUETTES:
        print(c, position_etiquette(c))

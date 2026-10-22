// Plan au trait du préchargement de l'accueil : la même pièce que la 3D du héros (piece3d/maquette.js,
// 5 m × 4 m, disposition A), vue de dessus à 70 px le mètre : murs, porte et son arc, fenêtre, cotes, meubles.
// accueil.css le dessine dès le premier affichage, sans attendre le JavaScript : chaque trait connaît sa
// longueur réelle (--long, calculée ici) et son moment (--d, --t, en secondes) ; les meubles se remplissent
// ensuite de leur couleur pastel, le fauteuil corail en dernier. Tout le tracé dure environ 3,8 s.
const TRAITS = [
  // murs (nu intérieur et nu extérieur), ouverts à la porte (mur de gauche) et à la fenêtre (mur du fond)
  ['mur', 'M62 246V42H119', .15, 1.15],
  ['mur', 'M70 246V50H119', .25, 1.1],
  ['mur', 'M217 42H428V338H62V309', .15, 1.25],
  ['mur', 'M217 50H420V330H70V309', .25, 1.2],
  ['tableau', 'M62 246H70M62 309H70M119 42V50M217 42V50', 1.2, .3],
  ['vitre', 'M119 44.7H217M119 47.3H217', 1.3, .45],
  // porte : le vantail, puis son arc d'ouverture
  ['porte', 'M70 309H133', 1.45, .3],
  ['arc', 'M133 309A63 63 0 0 0 70 246', 1.7, .5],
  // cotes : lignes d'attache, ligne coupée là où se pose le chiffre, repères obliques
  ['cote', 'M62 36V8M428 36V8M62 14H215M275 14H428M58 18L66 10M424 18L432 10', 1.9, .55],
  ['cote', 'M56 42H8M56 338H8M14 42V160M14 220V338M10 46L18 38M10 342L18 334', 2, .55],
  // meubles, dans l'ordre d'arrivée de la 3D (le fauteuil corail en dernier) ; leur couleur de remplissage
  ['meuble', 'M231 106H413V239H231Z', 2.35, .45, 'peche'],
  ['meuble', 'M266 50H392V81H266ZM286 60.5H372', 2.5, .4, 'lilas'],
  ['meuble', 'M70 141H94V211H70Z', 2.62, .35, 'beurre'],
  ['meuble', 'M255.5 200.5H402.5V263.5H255.5ZM255.5 249.5H402.5M269.5 200.5V249.5M388.5 200.5V249.5', 2.75, .5, 'menthe'],
  ['meuble', 'M294 132H364V171H294Z', 2.92, .35, 'beurre'],
  ['meuble', 'M140 116.5A10.5 10.5 0 1 0 161 116.5A10.5 10.5 0 1 0 140 116.5Z', 3.05, .3, 'beurre'],
  ['meuble', 'M86.1 78A13.3 13.3 0 1 0 112.7 78A13.3 13.3 0 1 0 86.1 78Z', 3.15, .3, 'menthe'],
  ['repere', 'M168 138.2H224V192.8H168ZM168 150.8H224', 3.3, .4, 'corail', 'rotate(-73.3 196 165.5)']
];

// longueur d'un tracé fait de M, H, V, L, A (arcs de cercle) et Z, en unités du dessin
function longueur(d) {
  let x = 0, y = 0, x0 = 0, y0 = 0, n = 0;
  for (const [, c, args] of d.matchAll(/([MHVLAZ])([^MHVLAZ]*)/g)) {
    const v = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (c === 'M') { [x, y] = v; x0 = x; y0 = y; }
    else if (c === 'H') { n += Math.abs(v[0] - x); x = v[0]; }
    else if (c === 'V') { n += Math.abs(v[0] - y); y = v[0]; }
    else if (c === 'L') { n += Math.hypot(v[0] - x, v[1] - y); [x, y] = v; }
    else if (c === 'A') {
      const [r, , , grand, , xa, ya] = v, corde = Math.hypot(xa - x, ya - y);
      const angle = 2 * Math.asin(Math.min(1, corde / (2 * r)));
      n += r * (grand ? 2 * Math.PI - angle : angle);
      x = xa; y = ya;
    } else if (c === 'Z') { n += Math.hypot(x0 - x, y0 - y); x = x0; y = y0; }
  }
  return Math.ceil(n) + 1;
}

const r1 = v => Math.round(v * 1000) / 1000;

export default function PlanOuverture({ cotes = ['5,00 m', '4,00 m'] }) {
  return (
    <svg className="acc-plan" viewBox="0 0 450 352" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="acc-plan-points" width="17.5" height="17.5" patternUnits="userSpaceOnUse" x="62" y="42">
          <circle cx="0" cy="0" r=".9" />
        </pattern>
      </defs>
      <rect className="acc-plan__trame" x="62" y="42" width="366" height="296" fill="url(#acc-plan-points)" />
      {TRAITS.map(([classe, d, debut, duree, fond, transform], i) => (
        <path key={i} className={'acc-plan__' + classe + (fond ? ' acc-plan--' + fond : '')} d={d} transform={transform}
          style={{ '--long': longueur(d), '--d': r1(debut) + 's', '--t': r1(duree) + 's' }} />
      ))}
      <text className="acc-plan__texte" x="245" y="17.5" textAnchor="middle" style={{ '--d': '2.35s' }}>{cotes[0]}</text>
      <text className="acc-plan__texte" x="14" y="193.5" textAnchor="middle" transform="rotate(-90 14 190)" style={{ '--d': '2.45s' }}>{cotes[1]}</text>
    </svg>
  );
}

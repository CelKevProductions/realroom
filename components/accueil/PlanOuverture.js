// Plan au trait du préchargement de l'accueil : la même pièce que la 3D du héros (piece3d/maquette.js,
// 5 m × 4 m, disposition A), vue de dessus à 70 px le mètre : murs, porte et son arc, fenêtre, cotes, meubles.
// Chaque trait a pathLength="1" : accueil.css le dessine (stroke-dashoffset) dès le premier affichage,
// sans attendre le JavaScript ; --i règle l'ordre du tracé.
const TRAITS = [
  // murs (nu intérieur et nu extérieur), ouverts à la porte (mur de gauche) et à la fenêtre (mur du fond)
  ['mur', 'M62 246V42H119'],
  ['mur', 'M70 246V50H119'],
  ['mur', 'M217 42H428V338H62V309'],
  ['mur', 'M217 50H420V330H70V309'],
  ['tableau', 'M62 246H70M62 309H70M119 42V50M217 42V50'],
  ['vitre', 'M119 44.7H217M119 47.3H217'],
  // porte : le vantail, puis son arc d'ouverture
  ['porte', 'M70 309H133'],
  ['arc', 'M133 309A63 63 0 0 0 70 246'],
  // cotes : lignes d'attache, ligne coupée là où se pose le chiffre, repères obliques
  ['cote', 'M62 36V8M428 36V8M62 14H215M275 14H428M58 18L66 10M424 18L432 10'],
  ['cote', 'M56 42H8M56 338H8M14 42V160M14 220V338M10 46L18 38M10 342L18 334'],
  // meubles, dans l'ordre d'arrivée de la 3D (le fauteuil orange en dernier)
  ['meuble', 'M231 106H413V239H231Z'],
  ['meuble', 'M266 50H392V81H266ZM286 60.5H372'],
  ['meuble', 'M70 141H94V211H70Z'],
  ['meuble', 'M255.5 200.5H402.5V263.5H255.5ZM255.5 249.5H402.5M269.5 200.5V249.5M388.5 200.5V249.5'],
  ['meuble', 'M294 132H364V171H294Z'],
  ['meuble', 'M140 116.5A10.5 10.5 0 1 0 161 116.5A10.5 10.5 0 1 0 140 116.5Z'],
  ['meuble', 'M86.1 78A13.3 13.3 0 1 0 112.7 78A13.3 13.3 0 1 0 86.1 78Z'],
  ['repere', 'M168 138.2H224V192.8H168ZM168 150.8H224', 'rotate(-73.3 196 165.5)']
];

export default function PlanOuverture({ cotes = ['5,00 m', '4,00 m'] }) {
  return (
    <svg className="acc-plan" viewBox="0 0 450 352" aria-hidden="true" focusable="false">
      {TRAITS.map(([classe, d, transform], i) => (
        <path key={i} className={'acc-plan__' + classe} d={d} transform={transform} pathLength="1" style={{ '--i': i }} />
      ))}
      <text className="acc-plan__texte" x="245" y="17.5" textAnchor="middle" style={{ '--i': 8 }}>{cotes[0]}</text>
      <text className="acc-plan__texte" x="14" y="193.5" textAnchor="middle" transform="rotate(-90 14 190)" style={{ '--i': 9 }}>{cotes[1]}</text>
    </svg>
  );
}

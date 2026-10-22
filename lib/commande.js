// Barre de commande de l'atelier : « ajoute un canapé », « retire le tapis », « remplace la table
// basse par une ronde », « déplace le fauteuil près de la fenêtre ». Lecture par règles, sans IA :
// un verbe (ajouter, retirer, remplacer, déplacer), un meuble du catalogue, une quantité, des
// qualificatifs (couleur, matière, forme, taille) et un endroit. Les meubles sont ensuite choisis
// dans le catalogue et posés par le moteur (lib/agencement.js resoudre), comme depuis le catalogue.
import { estMural, estSuspendu } from './agencement.js';
import { segmentsDe, pointOuverture } from './contour.js';

export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’'`-]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// meubles reconnus : expressions (normalisées, du plus précis au plus général) → familles du catalogue
const OBJETS = [
  { mots: ['canape d angle', 'canape angle', 'corner sofa'], fams: ['canape'], qualifs: ['angle'] },
  { mots: ['table basse', 'coffee table'], fams: ['table'], texte: /basse|coffee/ },
  { mots: ['lampe de chevet', 'lampe de bureau', 'bedside lamp', 'desk lamp'], fams: ['lampe'] },
  { mots: ['table de chevet', 'table de nuit', 'chevet', 'bedside table', 'nightstand'], fams: ['table'], st: 'chevet' },
  { mots: ['meuble tv', 'meuble tele', 'meuble television', 'tv unit', 'tv stand'], fams: ['meuble'], st: 'tv' },
  { mots: ['chaise de bureau', 'office chair'], fams: ['chaise'], st: 'bureau' },
  { mots: ['salon de jardin', 'outdoor lounge'], fams: ['salon-jardin'] },
  { mots: ['table a manger', 'table de salle a manger', 'dining table'], fams: ['table'], exclure: /basse|chevet/ },
  { mots: ['etagere murale', 'wall shelf'], fams: ['etagere-murale'] },
  { mots: ['lampe sur pied', 'floor lamp'], fams: ['lampadaire'] },
  { mots: ['canape', 'sofa', 'couch'], fams: ['canape'] },
  { mots: ['fauteuil', 'armchair'], fams: ['fauteuil'] },
  { mots: ['meridienne', 'daybed'], fams: ['meridienne'] },
  { mots: ['lit', 'bed'], fams: ['lit'] },
  { mots: ['table'], fams: ['table'], exclure: /chevet/ },
  { mots: ['chaise', 'chair'], fams: ['chaise'] },
  { mots: ['tabouret', 'stool'], fams: ['tabouret'] },
  { mots: ['banc', 'bench'], fams: ['banc'] },
  { mots: ['pouf', 'ottoman'], fams: ['pouf'] },
  { mots: ['tapis', 'rug', 'carpet'], fams: ['tapis'] },
  { mots: ['lampadaire'], fams: ['lampadaire'] },
  { mots: ['lampe', 'lamp'], fams: ['lampe', 'lampadaire'] },
  { mots: ['suspension', 'pendant'], fams: ['suspension'] },
  { mots: ['lustre', 'chandelier'], fams: ['lustre'] },
  { mots: ['applique', 'wall light'], fams: ['applique'] },
  { mots: ['plafonnier', 'ceiling light'], fams: ['plafonnier'] },
  { mots: ['luminaire', 'lumiere', 'eclairage', 'light', 'lighting'], fams: ['lampadaire', 'lampe', 'suspension'] },
  { mots: ['miroir', 'mirror'], fams: ['miroir'] },
  { mots: ['tableau', 'cadre', 'affiche', 'poster', 'painting', 'artwork'], fams: ['tableau'] },
  { mots: ['sculpture', 'statue'], fams: ['sculpture'] },
  { mots: ['jardiniere', 'planter'], fams: ['jardiniere', 'plante'] },
  { mots: ['plante', 'plant'], fams: ['plante', 'jardiniere'] },
  { mots: ['television', 'tele', 'tv', 'ecran', 'screen'], fams: ['tv', 'tv-murale'] },
  { mots: ['buffet', 'enfilade', 'bahut', 'sideboard'], fams: ['buffet', 'meuble'] },
  { mots: ['commode', 'dresser'], fams: ['commode'] },
  { mots: ['armoire', 'penderie', 'wardrobe'], fams: ['armoire'] },
  { mots: ['bibliotheque', 'etagere', 'shelf', 'bookcase', 'shelving'], fams: ['etagere', 'etagere-murale'] },
  { mots: ['rangement', 'storage'], fams: ['etagere', 'commode', 'buffet', 'armoire'] },
  { mots: ['console'], fams: ['console'] },
  { mots: ['bureau', 'desk'], fams: ['bureau'] },
  { mots: ['baignoire', 'bathtub', 'bath'], fams: ['baignoire'] },
  { mots: ['portemanteau', 'coat rack'], fams: ['portemanteau'] },
  { mots: ['balancelle', 'swing'], fams: ['balancelle'] }
].map(o => ({ ...o, motifs: o.mots.map(m => new RegExp(` ${m.split(' ').map(w => w + '(?:s|x)?').join(' ')}(?= )`)) }));

// qualificatifs : ce que dit la phrase, cherché ensuite dans le nom, les couleurs et la matière des meubles
const QUALIFS = {
  gris: /\b(gris\w*|grey|gray|anthracite)\b/, blanc: /\b(blanc\w*|white|ivoire|ecru|creme)\b/, noir: /\b(noir\w*|black)\b/,
  vert: /\b(vert\w*|green|sauge|olive|kaki)\b/, bleu: /\b(bleu\w*|blue|navy|marine)\b/, rose: /\b(rose\w*|pink|poudre)\b/,
  jaune: /\b(jaune\w*|yellow|moutarde|ocre)\b/, rouge: /\b(rouge\w*|red|bordeaux)\b/, orange: /\b(orange\w*|terracotta|rouille|rust)\b/,
  marron: /\b(marron\w*|brun\w*|brown|cognac|caramel|chocolat)\b/, beige: /\b(beige\w*|sable|taupe|lin|linen|naturel\w*)\b/,
  bois: /\b(bois|chene|noyer|teck|frene|wood\w*|oak|walnut|teak)\b/, laiton: /\b(laiton|dore\w*|brass|gold\w*)\b/,
  cuir: /\b(cuir|leather)\b/, velours: /\b(velours|velvet)\b/, bouclette: /\b(boucl\w*|boucle)\b/, rotin: /\b(rotin|osier|rattan|cann\w*)\b/,
  marbre: /\b(marbre|marble|travertin\w*)\b/, verre: /\b(verre|glass)\b/, metal: /\b(metal\w*|acier|chrome\w*|inox|steel)\b/,
  rond: /\b(rond\w*|round|circulaire|ovale?)\b/, angle: /\b(angle|corner|d angle)\b/, courbe: /\b(courbe\w*|curved|arrondi\w*)\b/,
  modulable: /\b(modul\w*|modular)\b/, compact: /\b(petit\w*|compact\w*|small|mini)\b/, grand: /\b(grand\w*|large|big|xxl)\b/
};
const TAILLES = new Set(['compact', 'grand']);

const NOMBRES = { un: 1, une: 1, a: 1, an: 1, one: 1, deux: 2, two: 2, couple: 2, trois: 3, three: 3, quatre: 4, four: 4, cinq: 5, five: 5 };
const TOUS = /\b(tous|toutes|all|les|des|every)\b/;

const VERBES = [
  { action: 'remplacer', re: /\b(remplace\w*|change\w*|echange\w*|troque\w*|replace\w*|swap\w*)\b/ },
  { action: 'deplacer', re: /\b(deplace\w*|bouge\w*|pousse\w*|decale\w*|move\w*|shift\w*)\b/ },
  { action: 'retirer', re: /\b(retire\w*|enleve\w*|supprime\w*|vire\w*|ote\w*|sors|sortir|remove\w*|delete\w*|take out|get rid)\b|\b(sans|moins de|pas de|ne \w+ plus|n \w+ plus|no more|less|without)\b/ },
  { action: 'ajouter', re: /\b(ajoute\w*|rajoute\w*|mets|met|mettre|place\w*|pose\w*|installe\w*|add\w*|put|insert|veux|voudrais|faut|besoin|want|need)\b|\b(en plus|plus de|un autre|une autre|encore|another|more|extra)\b/ }
];

// endroit : « près de la fenêtre », « devant la porte », « au milieu », « dans le coin », « contre le mur »
const LIEU = /\b(?:pres|a cote|devant|sous|vers|contre|dans|au|a|en face|near|next to|by|in front of|under|against|in|at)\b(?: (?:de|du|des|d|la|le|l|les|the))* (fenetre\w*|baie\w*|porte\w*|entree|centre|milieu|coin|mur|window\w*|door\w*|entrance|center|centre|middle|corner|wall)\b/;
const PREP = /(?:^| )(?:pres|a cote|devant|derriere|contre|sous|sur|au dessus|en face|autour|near|next to|beside|by|in front of|behind|under|on|above|around)(?: (?:de|du|des|d|la|le|l|les|the|of))*$/;
const LIEUX = { fenetre: 'fenetre', baie: 'fenetre', window: 'fenetre', porte: 'porte', door: 'porte', entree: 'porte', entrance: 'porte',
  centre: 'centre', milieu: 'centre', center: 'centre', middle: 'centre', coin: 'coin', corner: 'coin', mur: 'mur', wall: 'mur' };

function objetsDans(t) {
  // chaque meuble trouvé est effacé de la phrase : « chaise de bureau » ne compte pas aussi comme un bureau
  let s = ' ' + t + ' ';
  const trouves = [];
  for (const o of OBJETS) for (const re of o.motifs) {
    let m;
    while ((m = re.exec(s))) {
      const longueur = m[0].length - 1;
      trouves.push({ o, index: m.index, longueur });
      s = s.slice(0, m.index + 1) + ' '.repeat(longueur) + s.slice(m.index + 1 + longueur);
    }
  }
  return trouves.sort((a, b) => a.index - b.index);
}

function quantiteAvant(t, index, action) {
  const avant = t.slice(Math.max(0, index - 24), index).trim().split(' ').slice(-3);
  for (const w of avant.reverse()) {
    if (/^\d+$/.test(w)) return Math.min(6, Math.max(1, +w));
    if (NOMBRES[w]) return NOMBRES[w];
    if (action === 'retirer' && TOUS.test(w)) return 'tous';
    if (action === 'ajouter' && w === 'des') return 2;
  }
  return 1;
}
const qualifsDans = t => Object.entries(QUALIFS).filter(([, re]) => re.test(t)).map(([k]) => k);

// Lit une phrase et rend une liste de commandes, dans l'ordre. Une phrase peut en enchaîner
// plusieurs : « ajoute un fauteuil et retire le tapis ». Rend [] si rien n'est compris.
export function lireCommande(texte) {
  const t = norm(texte);
  if (!t) return [];
  const morceaux = t.split(/ (?:et|puis|ensuite|and|then) |, |; /);
  const commandes = [];
  for (const m of morceaux) {
    const verbe = VERBES.find(v => v.re.test(m));
    const objets = objetsDans(m);
    const lieu = m.match(LIEU);
    const pres = lieu ? LIEUX[lieu[1].replace(/s$/, '')] || LIEUX[lieu[1]] || null : null;
    // sans verbe, le morceau continue la commande précédente : « ajoute un fauteuil et une lampe »
    const action = verbe ? verbe.action : commandes.length ? commandes[commandes.length - 1].action : objets.length ? 'ajouter' : null;
    if (!action || !objets.length) continue;
    if (action === 'remplacer') {
      // « remplace le canapé par un canapé d'angle » : la cible suit « par » ; sinon un autre du même type
      const par = m.search(/ (?:par|pour|avec|with|by|for) /);
      const source = objets.find(o => par < 0 || o.index < par) || objets[0];
      const cible = par >= 0 ? objets.find(o => o.index > par) : null;
      const apres = par >= 0 ? m.slice(par) : m;
      commandes.push({ action, objet: source.o, qualifsSource: par >= 0 ? qualifsDans(m.slice(0, par)) : [], cible: (cible || source).o,
        qualifs: [...new Set([...(cible?.o.qualifs || []), ...qualifsDans(apres).filter(q => par >= 0 || !(source.o.qualifs || []).includes(q))])], quantite: 1, pres });
      continue;
    }
    // un meuble cité après « près du », « devant le »… est un repère, pas un meuble à ajouter
    const repere = objets.find(o => PREP.test(m.slice(0, o.index).trimEnd()));
    const vises = objets.filter(o => o !== repere);
    if (!vises.length) continue;
    const ou = repere ? { meuble: repere.o } : pres;
    // chaque meuble cité est une commande, avec ses qualificatifs
    vises.forEach((o, i) => {
      const fin = i + 1 < vises.length ? vises[i + 1].index : m.length;
      // qualificatifs : ce qui suit le meuble (« un canapé gris ») et les mots juste avant (« un petit fauteuil », « a grey sofa »)
      const apres = m.slice(o.index + o.longueur, fin).replace(LIEU, ' ');
      const avant = m.slice(i ? vises[i - 1].index + vises[i - 1].longueur : 0, o.index).trim().split(' ').slice(-2).join(' ');
      const apresSeul = repere && repere.index > o.index ? apres.slice(0, Math.max(0, repere.index - o.index - o.longueur)) : apres;
      commandes.push({ action, objet: o.o, qualifs: [...new Set([...(o.o.qualifs || []), ...qualifsDans(apresSeul), ...qualifsDans(avant)])], quantite: quantiteAvant(m, o.index, action), pres: ou });
    });
  }
  return commandes;
}

// --- choix des meubles ---
const EXTERIEUR = new Set(['salon-jardin', 'balancelle', 'jardiniere']);
export function tientDansPiece(p, dims) {
  if (!p.dim || !dims) return true;
  const [w, d, h] = p.dim, { largeur: L, profondeur: P, hauteur: H } = dims;
  if (estSuspendu(p.fam)) return h <= Math.max(.3, H - 1.85);
  if (estMural(p.fam)) return w <= Math.max(L, P) - .2;
  return h <= H - .03 && ((w <= L - .15 && d <= P - .15) || (d <= L - .15 && w <= P - .15));
}
const texteProduit = p => norm([p.nom, p.titre, p.cat, p.st, p.mat, ...(p.couleurs || []), p.look].filter(Boolean).join(' '));
const correspond = (o, p) => o.fams.includes(p.fam) && (!o.st || p.st === o.st) && (!o.texte || o.texte.test(texteProduit(p))) && (!o.exclure || !(o.exclure.test(texteProduit(p)) || o.exclure.test(p.st || '')));
const aire = p => (p.dim ? p.dim[0] * p.dim[1] : 1);

// Le meuble du catalogue qui répond le mieux : qualificatifs d'abord, puis un prix proche du
// milieu de gamme (ni le moins cher ni le plus cher). Un meuble déjà posé du même type est repris
// tel quel quand rien n'est précisé (« un fauteuil en plus » : le même que le premier).
export function choisirDansCatalogue(produits, { objet, qualifs = [], dims, exterieur = false, eviter = [], deja = [] }) {
  const tous = Object.values(produits || {}).filter(p => correspond(objet, p) && (exterieur || !(p.ext || EXTERIEUR.has(p.fam))) && tientDansPiece(p, dims) && !eviter.includes(p.id));
  if (!tous.length) return null;
  const voulus = qualifs.filter(q => !TAILLES.has(q));
  if (!voulus.length && !qualifs.length) {
    const meme = deja.map(sku => produits[sku]).find(p => p && tous.includes(p));
    if (meme) return meme;
  }
  const prixTries = tous.map(p => p.prix || 0).filter(v => v > 0).sort((a, b) => a - b);
  const median = prixTries.length ? prixTries[Math.floor(prixTries.length / 2)] : 0;
  const note = p => {
    const tx = texteProduit(p);
    let n = voulus.filter(q => QUALIFS[q].test(tx)).length * 10;
    if (qualifs.includes('compact')) n -= aire(p) * 3;
    if (qualifs.includes('grand')) n += aire(p) * 3;
    if (median && p.prix > 0) n -= Math.abs(Math.log(p.prix / median));
    if (!p.generique) n += .4;
    return n;
  };
  return tous.reduce((m, p) => (note(p) > note(m) ? p : m));
}

// Les meubles de la pièce visés par la commande (« le tapis », « les chaises », « le fauteuil vert »).
export function meublesVises(items, produitDe, { objet, qualifs = [] }) {
  const vises = items.filter(it => it.garde !== false && (p => p && correspond(objet, p))(produitDe(it)));
  const voulus = qualifs.filter(q => !TAILLES.has(q));
  if (!voulus.length) return vises;
  const fins = vises.filter(it => voulus.every(q => QUALIFS[q].test(texteProduit(produitDe(it)))));
  return fins.length ? fins : vises;
}

// Point de départ d'un meuble « près de la fenêtre », « devant la porte », « au milieu », « dans le coin ».
export function pointPres(modele, pres) {
  const { largeur: L, profondeur: P } = modele.dims;
  if (pres === 'centre') return [0, 0];
  if (pres === 'coin') return [L / 2 - .45, -P / 2 + .45];
  if (pres !== 'fenetre' && pres !== 'porte') return null;
  for (const s of segmentsDe(modele)) {
    const o = (modele.murs?.[s.id]?.ouvertures || []).find(v => (pres === 'fenetre' ? v.type === 'fenetre' : v.type === 'porte' || v.type === 'passage'));
    if (!o) continue;
    const p = pointOuverture(s, o.position);
    // un pas vers l'intérieur de la pièce (la normale du mur peut pointer dehors selon le sens du contour)
    const dedans = [p[0] + s.n[0] * .9, p[1] + s.n[1] * .9], dehors = [p[0] - s.n[0] * .9, p[1] - s.n[1] * .9];
    return Math.hypot(...dedans) <= Math.hypot(...dehors) ? dedans : dehors;
  }
  return null;
}

// Nom lisible d'un type de meuble pour les messages (« canapé », « table basse »).
export const nomObjet = objet => objet.mots[0];

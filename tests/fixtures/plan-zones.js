import { rectangle, chambres } from './bench-chambres.js';
import { programmeComposition, composerProduits } from '../../lib/programme.js';
import { planifierZones } from '../../lib/zonage.js';
// Catalogue synthétique pour isoler la géométrie. Ces articles ne sont pas vendus.
export const catalogueZones = Object.fromEntries(Object.entries({
  canape: { fam: 'canape', nom: 'Canapé compact trois places', dim: [2.1, .82, .8], prix: 800 },
  fauteuil: { fam: 'fauteuil', nom: 'Fauteuil de lecture', dim: [.65, .65, .85], prix: 180 },
  basse: { fam: 'table', nom: 'Table basse', dim: [.7, .45, .4], prix: 100 },
  tv: { fam: 'meuble', nom: 'Meuble TV', dim: [1.1, .35, .5], prix: 150 },
  repas: { fam: 'table', nom: 'Table de repas quatre personnes', dim: [1, .7, .75], prix: 220 },
  repas6: { fam: 'table', nom: 'Table de repas six personnes', dim: [1.6, .8, .75], prix: 260 },
  repas8: { fam: 'table', nom: 'Table de repas huit personnes', dim: [2.2, .9, .75], prix: 300 },
  chaise: { fam: 'chaise', nom: 'Chaise de repas', dim: [.42, .42, .8], prix: 55 },
  lampadaire: { fam: 'lampadaire', nom: 'Lampadaire', dim: [.25, .25, 1.6], prix: 90 },
  suspension: { fam: 'suspension', nom: 'Suspension', dim: [.3, .3, .3], prix: 80 },
  lit: { fam: 'lit', nom: 'Lit double', dim: [1.6, 2, 1], prix: 500 },
  chevet: { fam: 'table', nom: 'Chevet', dim: [.45, .4, .5], prix: 60 },
  armoire: { fam: 'armoire', nom: 'Armoire', dim: [1.4, .55, 2], prix: 350 },
  buffet: { fam: 'buffet', nom: 'Buffet', dim: [1.2, .4, .8], prix: 160 },
  bureau: { fam: 'bureau', nom: 'Bureau', dim: [1.2, .6, .75], prix: 180 },
  siege: { fam: 'chaise', nom: 'Chaise de bureau', dim: [.5, .5, .85], prix: 70 },
  lampe: { fam: 'lampe', nom: 'Lampe de table', dim: [.15, .15, .35], prix: 30 },
  baignoire: { fam: 'baignoire', nom: 'Baignoire îlot', dim: [1.6, .7, .6], prix: 500 },
  murale: { fam: 'baignoire', nom: 'Baignoire murale', dim: [1.5, .65, .6], prix: 400 },
  vasque: { fam: 'vasque', nom: 'Double vasque', dim: [1.2, .5, .8], prix: 300 },
  miroir: { fam: 'miroir', nom: 'Miroir', dim: [.6, .06, .8], prix: 50 },
  console: { fam: 'console', nom: 'Console', dim: [.8, .35, .8], prix: 100 },
  banc: { fam: 'banc', nom: 'Banc', dim: [1, .35, .5], prix: 80 },
  jardin: { fam: 'salon-jardin', nom: 'Ensemble salon de jardin avec table', dim: [2.4, 1.8, .8], prix: 650, ext: true },
  tableExt: { fam: 'table', nom: 'Table de repas extérieure', dim: [1.4, .8, .75], prix: 220, ext: true },
  chaiseExt: { fam: 'chaise', nom: 'Chaise extérieure', dim: [.45, .45, .85], prix: 60, ext: true },
  transat: { fam: 'transat', nom: 'Transat', dim: [.65, 1.8, .8], prix: 150, ext: true }
}).map(([id, p]) => [id, { ...p, id, cols: ['beige'], st: 'contemporain' }]));
export const salonReference = () => ({ dims: { largeur: 5, profondeur: 4, hauteur: 2.6, estimees: false }, murs: {
  entree: { ouvertures: [{ type: 'porte', position: -1.65, largeur: .9, hauteur: 2.05, allege: 0 }] },
  fond: { ouvertures: [{ type: 'passage', position: 1.95, largeur: .8, hauteur: 2.05, allege: 0, destination: 'cuisine' }] },
  droite: { ouvertures: [{ type: 'fenetre', position: -.2, largeur: 1.1, hauteur: 1.2, allege: .95 }] }, gauche: { ouvertures: [] }
} });
export const salons = () => [
  { nom: 'Référence 20 m²', modele: salonReference(), envies: 'Salon avec repas et fauteuil' },
  ...[[3.5, 4], [4, 4], [4, 5], [5, 5], [5, 6], [6, 6], [6, 7], [7, 8]].map(([L, P]) => ({ nom: `${L} × ${P}`, modele: rectangle(L, P), envies: 'Salon chaleureux avec repas' })),
  ...chambres().filter(s => /L ·|Oblique|Décroché/.test(s.nom)).map(s => ({ ...s, envies: 'Salon avec repas' }))
];

export function compositionTest(modele, fonction, envies, cat = catalogueZones) {
  const catalogue = Object.fromEntries(Object.entries(cat).map(([id, p]) => [id, { ...p, id }]));
  const programme = programmeComposition({ modele, fonction, envies });
  const composition = composerProduits(programme, { meubles: [] }, catalogue, null, [], { envies });
  const items = composition.meubles.map((m, i) => ({ id: `test_${i}`, sku: m.produit, x: 0, z: 0, rot: 0, zoneId: m.programme.zone, usageProgramme: m.programme.usage, slotProgramme: m.programme.id, prioriteProgramme: m.programme.priorite, obligatoireProgramme: m.programme.obligatoire }));
  return { ...planifierZones(modele, items, catalogue, programme), programme, catalogue, composition, initiaux: items };
}

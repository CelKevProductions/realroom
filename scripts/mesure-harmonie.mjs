import { PRODUITS } from '../lib/catalogue.js';
import { programmeComposition, composerProduits } from '../lib/programme.js';
import { bilanHarmonie } from '../lib/harmonie.js';
import { preferencesDe } from '../lib/references.js';
import { candidats } from '../lib/catalogue.js';
const mur = o => ({ couleur: '#F1EEE7', ouvertures: o });
const modele = (L, P) => ({ dims: { largeur: L, profondeur: P, hauteur: 2.6 }, murs: { fond: mur([{ type: 'fenetre', position: 0, largeur: 1.4, hauteur: 1.5, allege: .9 }]), gauche: mur([]), droite: mur([]), entree: mur([{ type: 'porte', position: L / 2 - .7, largeur: .9, hauteur: 2.04, allege: 0 }]) } });
const cas = [];
for (const fonction of ['salon', 'chambre']) for (const envies of ['salon japandi doux et naturel', 'ambiance art déco, laiton et velours', 'style scandinave lumineux', 'audacieux et coloré', 'chaleureux et cosy', '']) for (const [L, P] of [[4, 4.2], [5.5, 6]]) cas.push({ fonction, envies, L, P });
const lignes = [];
let somA = 0, somB = 0, mieux = 0, pire = 0, egal = 0;
for (const c of cas) {
  const m = modele(c.L, c.P), preferences = preferencesDe(c.envies), prog = programmeComposition({ modele: m, fonction: c.fonction, envies: c.envies });
  const cand = candidats({ dims: m.dims, fonction: c.fonction, envies: c.envies, parFamille: 30, modele: m });
  const run = harmonie => composerProduits(prog, { meubles: [] }, PRODUITS, cand, [], { envies: c.envies, preferences, langue: 'fr', harmonie });
  const sans = run(false), avec = run(true);
  const noter = r => bilanHarmonie(r.meubles.map(x => PRODUITS[x.produit]), { catalogue: PRODUITS, preferences, langue: 'fr' });
  const a = noter(sans), b = noter(avec);
  somA += a.score; somB += b.score; if (b.score > a.score) mieux++; else if (b.score < a.score) pire++; else egal++;
  const diff = avec.meubles.filter((x, i) => sans.meubles[i]?.produit !== x.produit).map(x => `${x.programme.usage}: ${PRODUITS[sans.meubles.find(s => s.programme.id === x.programme.id)?.produit]?.nom || '∅'} → ${PRODUITS[x.produit].nom}`);
  lignes.push({ ...c, surface: Math.round(c.L * c.P), sans: a.score, avec: b.score, aRevoirSans: a.aRevoir, aRevoirAvec: b.aRevoir, changements: diff });
}
console.log(JSON.stringify({ cas: cas.length, moyenneSans: +(somA / cas.length).toFixed(2), moyenneAvec: +(somB / cas.length).toFixed(2), mieux, egal, pire }, null, 0));
for (const l of lignes) console.log(`${l.fonction.padEnd(7)} ${String(l.surface).padStart(2)}m² ${(l.envies || '(sans brief)').padEnd(38)} ${String(l.sans).padStart(6)} → ${String(l.avec).padStart(6)}  ${l.changements.slice(0, 3).join(' ; ')}`);
import { writeFileSync } from 'node:fs';
writeFileSync('docs/harmonie/resultats.json', JSON.stringify(lignes, null, 1));

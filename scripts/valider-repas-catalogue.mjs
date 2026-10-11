// Catalogue partagé, brief vide, pièce en L et deux lampadaires du même modèle.
// BASELINE_REPAS=/archive permet aussi de comparer une version antérieure du moteur.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PRODUITS } from '../lib/catalogue.js';
import { choisirCandidats } from '../lib/selection.js';
import { preparerAmenagement, appliquerProposition } from '../lib/amenagement.js';
import { verifier, boite } from '../lib/agencement.js';
import { verifierHauteurs } from '../lib/hauteurs.js';
import { salonConcave } from '../tests/fixtures/salons-catalogue.js';
import { segmentsDe, pointOuverture } from '../lib/contour.js';

const dossier = path.resolve('docs/repas-catalogue');
await fs.mkdir(dossier, { recursive: true });
const ancienneSelection = process.env.BASELINE_REPAS ? await import(path.join(process.env.BASELINE_REPAS, 'lib/selection.js')) : null;
const ancienMoteur = process.env.BASELINE_REPAS ? await import(path.join(process.env.BASELINE_REPAS, 'lib/amenagement.js')) : null;
const luminaire = Object.values(PRODUITS).find(p => p.fam === 'lampadaire' && !p.generique);
const choix = { envies: '', budget: 0, espaces: ['repas', 'lecture', 'travail', 'rangement'], placesRepas: 8 };
const resultats = [];
function bilan(r, modele) {
  return { objets: r.agencement.length, table: r.agencement.filter(it => it.usageProgramme === 'table-repas').length,
    chaises: r.agencement.filter(it => it.usageProgramme === 'chaise-repas').length,
    lampadairesIdentiques: r.agencement.filter(it => it.sku === luminaire.id).length,
    zonesVie: r.proposition.densite.zonesVie,
    manquantsObligatoires: r.proposition.programme.manquants.filter(s => s.obligatoire).map(s => ({ usage: s.usage, motif: s.motif })),
    auditValide: r.proposition.planZones.audit.valide, passage: r.proposition.planZones.audit.circulation.largeur,
    conflitsSol: verifier(modele, r.agencement, PRODUITS).length, conflitsHauteur: verifierHauteurs(modele, r.agencement, PRODUITS).length,
    cout: r.proposition.selectionBudget.cout, plafond: r.proposition.selectionBudget.plafond };
}
function donnees(r, modele) {
  return { modele, items: r.agencement, catalogue: Object.fromEntries(r.agencement.map(it => [it.sku, PRODUITS[it.sku]])),
    programme: r.proposition.programme, planZones: r.proposition.planZones, densite: r.proposition.densite };
}
const couleurs = { salon: '#AD795F', repas: '#799A84', lecture: '#C9A253', travail: '#7D98B0', rangement: '#9887A7' };
const echapper = t => String(t).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function dessin(data, nom) {
  const { modele, items, catalogue } = data, e = 48;
  const x = v => 210 + (v + 5) * e, y = v => 145 + (7 - v) * e;
  const polygone = modele.contour.map(([a, b]) => `${x(a)},${y(b)}`).join(' ');
  const ouvertures = segmentsDe(modele).flatMap(pan => modele.murs[pan.id].ouvertures.map(o => {
    const a = pointOuverture(pan, o.position - o.largeur / 2), b = pointOuverture(pan, o.position + o.largeur / 2);
    return `<line x1="${x(a[0])}" y1="${y(a[1])}" x2="${x(b[0])}" y2="${y(b[1])}" stroke="${o.type === 'porte' ? '#FAF7F0' : '#91A8AD'}" stroke-width="8"><title>${o.type === 'porte' ? 'Porte' : 'Fenêtre'}</title></line>`;
  })).join('');
  const objets = items.map(it => {
    const p = catalogue[it.sku], col = couleurs[it.zoneId] || '#A99C85', [w, d] = p.dim;
    const hauteur = ['tv', 'tv-murale', 'tableau', 'applique', 'etagere-murale', 'suspension', 'lustre'].includes(p.fam);
    return `<g transform="translate(${x(it.x)},${y(it.z)}) rotate(${(it.rot || 0) * 180 / Math.PI})"><title>${echapper(p.nom)} · ${echapper(it.usageProgramme || '')}</title>${hauteur
      ? `<circle r="7" fill="${col}" stroke="#fff" stroke-width="2"/>`
      : `<rect x="${-w * e / 2}" y="${-d * e / 2}" width="${w * e}" height="${d * e}" rx="3" fill="${col}" fill-opacity="${p.fam === 'tapis' ? '.3' : '.85'}" stroke="#4A433A" stroke-width="1"/>`}</g>`;
  }).join('');
  const zones = data.planZones.zones.map(z => `<rect x="${x(z.x0)}" y="${y(z.z1)}" width="${(z.x1 - z.x0) * e}" height="${(z.z1 - z.z0) * e}" rx="8" fill="${couleurs[z.type] || '#9887A7'}" fill-opacity=".07" stroke="${couleurs[z.type] || '#9887A7'}" stroke-dasharray="5 4"/>`).join('');
  const chemins = (data.planZones.chemins || []).map(c => `<polyline points="${c.points.map(p => `${x(p.x)},${y(p.z)}`).join(' ')}" fill="none" stroke="#C8BCA5" stroke-width="${1.1 * e}" stroke-opacity=".25"/>`).join('');
  const legendes = Object.entries(couleurs).map(([id, col], i) => `<g transform="translate(${80 + i * 154},890)"><circle r="6" fill="${col}"/><text x="14" y="5" font-size="15">${{ salon: 'Salon', repas: 'Repas', lecture: 'Lecture', travail: 'Bureau', rangement: 'Rangement' }[id]}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="990" viewBox="0 0 900 990"><rect width="900" height="990" fill="#FAF7F0"/><g font-family="sans-serif" fill="#3D352D"><text x="48" y="50" font-size="28">${nom} · séjour synthétique en L</text><text x="48" y="82" font-size="17">90 m² · même catalogue réel · sans plafond · huit convives</text><polygon points="${polygone}" fill="#EEE5D6" stroke="#A89B85" stroke-width="3"/>${chemins}${zones}${objets}${ouvertures}${legendes}<text x="48" y="945" font-size="15">Mobilier au sol en emprise ; luminaires et éléments muraux en repères.</text><text x="48" y="969" font-size="15">Fixture indépendante, sans données client. La vue ne remplace pas le rendu 3D du navigateur.</text></g></svg>`;
}
if (process.argv.includes('--dessiner')) {
  for (const nom of ['avant', 'apres']) {
    const data = JSON.parse(await fs.readFile(path.join(dossier, `${nom}.json`), 'utf8'));
    await fs.writeFile(path.join(dossier, `${nom}.svg`), dessin(data, nom === 'avant' ? 'Avant' : 'Après'));
  }
  process.exit(0);
}
for (const doubles of [false, true]) {
  const modele = salonConcave(), original = structuredClone(modele);
  const proposition = { meubles: doubles ? ['salon', 'lecture'].map(zone => ({ produit: luminaire.id, zone })) : [] };
  const prep = preparerAmenagement([], choix), candidats = choisirCandidats(PRODUITS, { modele, fonction: 'salon', ...prep });
  const r = appliquerProposition({ modele, fonction: 'salon', prep, produits: PRODUITS, candidats, proposition });
  const apres = bilan(r, modele);
  assert.equal(apres.table, 1); assert.equal(apres.chaises, 8); assert.equal(apres.zonesVie, 4);
  assert.deepEqual(apres.manquantsObligatoires, []); assert.ok(apres.auditValide);
  assert.equal(apres.conflitsSol, 0); assert.equal(apres.conflitsHauteur, 0); assert.deepEqual(modele, original);
  if (doubles) assert.equal(apres.lampadairesIdentiques, 2);
  let avant = null;
  if (ancienMoteur) {
    const ancienPrep = ancienMoteur.preparerAmenagement([], choix);
    const ancien = ancienMoteur.appliquerProposition({ modele, fonction: 'salon', prep: ancienPrep, produits: PRODUITS, proposition,
      candidats: ancienneSelection.choisirCandidats(PRODUITS, { dims: modele.dims, fonction: 'salon', ...ancienPrep }) });
    avant = bilan(ancien, modele);
    if (doubles) {
      const data = donnees(ancien, modele);
      await fs.writeFile(path.join(dossier, 'avant.json'), JSON.stringify(data, null, 2) + '\n');
      await fs.writeFile(path.join(dossier, 'avant.svg'), dessin(data, 'Avant'));
    }
  }
  if (doubles) {
    const data = donnees(r, modele);
    await fs.writeFile(path.join(dossier, 'apres.json'), JSON.stringify(data, null, 2) + '\n');
    await fs.writeFile(path.join(dossier, 'apres.svg'), dessin(data, 'Après'));
  }
  const resume = { cas: doubles ? 'L-90-deux-lampadaires' : 'L-90-brief-vide', avant, apres };
  resultats.push(resume); console.log(JSON.stringify(resume));
}
await fs.writeFile(path.join(dossier, 'resultats.json'), JSON.stringify(resultats, null, 2) + '\n');

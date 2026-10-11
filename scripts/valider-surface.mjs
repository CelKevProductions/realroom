import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { appliquerProposition, preparerAmenagement } from '../lib/amenagement.js';
import { programmeComposition, TYPES_PROGRAMME } from '../lib/programme.js';
import { verifier } from '../lib/agencement.js';
import { verifierHauteurs } from '../lib/hauteurs.js';
import { catalogueZones } from '../tests/fixtures/plan-zones.js';
import { rectangle } from '../tests/fixtures/bench-chambres.js';
import { OBJETS_GENERIQUES } from '../lib/catalogue-generique.js';

const dossier = path.resolve('docs/composition-surface'); fs.mkdirSync(dossier, { recursive: true });
const catalogue = { ...catalogueZones, ...OBJETS_GENERIQUES }, envies = 'Salon chaleureux';
const avantMoteur = process.env.BASELINE_SURFACE ? await import(pathToFileURL(path.resolve(process.env.BASELINE_SURFACE, 'lib/amenagement.js'))) : null;
const surfaces = [[10, 3.2, 3.125], [18, 4.5, 4], [30, 6, 5], [90, 10, 9]];
const resultats = [];
for (const [surface, L, P] of surfaces) {
  const modele = rectangle(L, P); modele.dims.estimees = false;
  const options = { modele, fonction: 'salon', produits: catalogue, proposition: { meubles: [] } };
  const t = performance.now();
  const r = appliquerProposition({ ...options, prep: preparerAmenagement([], { envies, budget: 15000 }) });
  const b = avantMoteur ? avantMoteur.appliquerProposition({ ...options, prep: avantMoteur.preparerAmenagement([], { envies, budget: 15000 }) })
    : appliquerProposition({ ...options, prep: preparerAmenagement([], { envies, budget: 15000, compositionSurface: false }) });
  for (const [nom, data] of [['avant', b], ['apres', r]]) fs.writeFileSync(path.join(dossier, `${surface}-${nom}.json`), JSON.stringify({ source: 'fixture synthétique', version: nom === 'avant' ? avantMoteur ? '65fd5c8' : 'repli du palier' : 'composition-surface-1', modele, catalogue, items: data.agencement, proposition: data.proposition }, null, 2) + '\n');
  const p = r.proposition, geometrie = verifier(modele, r.agencement, catalogue), hauteurs = verifierHauteurs(modele, r.agencement, catalogue);
  const resume = { surface, dims: [L, P], slots: p.programme.zones.flatMap(z => z.slots).length, objets: r.agencement.length,
    zonesVie: p.densite.zonesVie, focal: !!p.finition.focal, planValide: p.planZones?.audit?.valide || false, geometrie, hauteurs,
    circulation: p.planZones?.audit?.circulation?.largeur, densite: p.densite, manquants: p.programme.manquants,
    composition: p.programme.zones.map(z => ({ id: z.id, referenceM2: z.surfaceMax, slots: z.slots.map(s => s.usage), retenus: r.agencement.filter(it => it.zoneId === z.id).map(it => it.usageProgramme) })), tempsMs: Math.round(performance.now() - t) };
  resultats.push(resume); console.log(JSON.stringify(resume));
  assert.equal(geometrie.length, 0, `${surface}: géométrie`); assert.equal(hauteurs.length, 0, `${surface}: hauteur`);
  assert.ok(resume.focal, `${surface}: point focal`); assert.ok(resume.planValide, `${surface}: plan de zones`);
  assert.deepEqual(resume.manquants.filter(s => s.obligatoire), [], `${surface}: usages obligatoires complets`);
  if (surface === 10) assert.ok(r.agencement.length <= 7, '10 m² surmeublé');
  if (surface === 30) assert.ok(resume.zonesVie >= 2, '30 m² doit recevoir deux activités');
  if (surface === 90) { assert.ok(resume.zonesVie >= 3); assert.ok(resume.objets >= 20); assert.ok(resume.circulation >= 1); }
}
for (let i = 1; i < resultats.length; i++) {
  assert.ok(resultats[i].slots > resultats[i - 1].slots, 'slots croissants');
  assert.ok(resultats[i].objets > resultats[i - 1].objets, 'objets croissants');
}
const paliers = TYPES_PROGRAMME.map(fonction => ({ fonction, paliers: [8, 14, 20, 30, 45, 90].map(surface => {
  const programme = programmeComposition({ modele: rectangle(Math.sqrt(surface), Math.sqrt(surface)), fonction });
  return { surface, focal: programme.focal, zones: programme.zones, compositionSurface: programme.compositionSurface };
}) }));
fs.writeFileSync(path.join(dossier, 'resultats.json'), JSON.stringify({ source: 'surfaces synthétiques, même catalogue et brief', resultats, paliers }, null, 2) + '\n');
console.log(`Séquence validée : ${resultats.map(r => `${r.surface} m² = ${r.objets} objets / ${r.zonesVie} zones de vie`).join('; ')}`);

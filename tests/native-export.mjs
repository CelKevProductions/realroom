// Fichier produit par MetricSurvey.swift : contrat Swift → adaptateur commun du site.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { depuisScan } from '../lib/scan.js';

const scan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.deepEqual(Object.keys(scan).sort(), ['objects', 'openings', 'source', 'unit', 'version', 'walls']);
assert.equal(scan.source, 'apple-roomplan');
assert.equal(scan.unit, 'm');
const { modele, agencement } = depuisScan(scan);
assert.deepEqual([modele.dims.largeur, modele.dims.profondeur, modele.dims.hauteur], [4, 5, 2.6]);
assert.equal(modele.capture.nbOuvertures, 2);
assert.equal(modele.capture.nbMeubles, 1);
assert.deepEqual(modele.dims.sources, { largeur: 'scan', profondeur: 'scan', hauteur: 'scan' });
assert.deepEqual(agencement[0].p.dim, [1.4, 1.6, 1]); // Pas largeur/hauteur/profondeur côté site.
assert.equal(agencement[0].p.fam, 'lit');
assert.equal(agencement[0].garde, true);
assert.ok(!agencement[0].sku);
const window = Object.values(modele.murs).flatMap(m => m.ouvertures).find(o => o.type === 'fenetre');
assert.equal(window.allege, .9);
assert.equal(window.confiance, .6);
assert.ok(modele.remarques.some(r => r.includes('confiance')));
console.log('Export Swift → import RealRoom : mètres, rotation/translation, axes du lit, allège et confiance vérifiés.');

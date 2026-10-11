import test from 'node:test';
import assert from 'node:assert/strict';
import { avancerChargement } from '../../lib/chargement.js';

test('une erreur à 72 % arrête définitivement la progression, même après plusieurs minutes', () => {
  const etat = { phase: 'erreur', t0: 0, aff: .72 };
  for (let t = 1000; t <= 600000; t += 1000) avancerChargement(etat, t, true);
  assert.equal(etat.aff, .72);
});

test('100 % est réservé à la réponse terminée ; un nouvel essai peut avancer après une erreur', () => {
  const etat = { phase: 'amenager', t0: 0, aff: .6 };
  for (let t = 1000; t <= 600000; t += 1000) avancerChargement(etat, t, true);
  assert.ok(etat.aff < .96);
  etat.phase = 'erreur'; const arret = etat.aff;
  assert.equal(avancerChargement(etat, 800000, true), arret);
  etat.phase = 'analyse'; etat.t0 = 800000; etat.aff = .5;
  assert.ok(avancerChargement(etat, 820000, true) > .5);
  etat.phase = 'fin';
  for (let n = 0; n < 100; n++) avancerChargement(etat, 830000 + n, true);
  assert.equal(etat.aff, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { disponibiliteDemoIA } from '../../lib/demo-disponibilite.js';

const configuration = () => ({
  env: { VERCEL: '1', NODE_ENV: 'production', FAL_KEY: 'cle-de-test', SESSION_SECRET: 's'.repeat(32) },
  base: 'postgres://base-de-test',
  limites: { demoAmenagementsParJour: 10, demoAmenagementsGlobauxParJour: 30 }
});

test('la disponibilité exige une vraie IA et les garde-fous de la démo en ligne', () => {
  assert.deepEqual(disponibiliteDemoIA(configuration()), { disponible: true, simulation: false });
  for (const [reference, changer] of [
    ['D-01', c => { c.env.DEMO_AMENAGEMENT_IA = '0'; }],
    ['D-02', c => { c.env.FAL_KEY = ' '; c.env.REALROOM_SIMULATION = '1'; }],
    ['D-03', c => { c.base = ''; }],
    ['D-04', c => { c.env.SESSION_SECRET = 'trop-court'; }],
    ['D-05', c => { c.limites.demoAmenagementsGlobauxParJour = 0; }]
  ]) {
    const c = configuration(); changer(c);
    assert.deepEqual(disponibiliteDemoIA(c), { disponible: false, simulation: false, reference });
  }
});

test('une clé Anthropic fonctionne sans Fal, les essais locaux gardent leurs prérequis locaux', () => {
  const c = configuration();
  delete c.env.FAL_KEY; c.env.ANTHROPIC_API_KEY = 'cle-de-test';
  assert.equal(disponibiliteDemoIA(c).disponible, true);
  delete c.env.VERCEL; delete c.env.SESSION_SECRET; c.base = '';
  assert.equal(disponibiliteDemoIA(c).reference, 'D-04', 'une session de production reste protégée hors de Vercel');
  c.env.REALROOM_ESSAIS = '1';
  assert.equal(disponibiliteDemoIA(c).disponible, true);
});

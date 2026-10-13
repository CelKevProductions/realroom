// Statistiques apprises (essai privé) : pièces synthétiques uniquement, aucune scène de la base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import PRIORS from '../../data/experiment-ssr/priors.json' with { type: 'json' };
import { evaluerPrior, seuilEquilibre, armoireFacultative } from '../../lib/prior-ssr.js';
import { priorSsrActif } from '../../lib/prior-ssr-active.js';
import { evaluerRemplissage } from '../../lib/remplissage.js';
import { rectangle } from '../fixtures/bench-chambres.js';

const CAT = { canape: { fam: 'canape', dim: [2.2, .9, .8] }, meuble: { fam: 'meuble', dim: [1.6, .4, .5] }, table: { fam: 'table', dim: [1.1, .6, .4] } };
const it = (id, sku, usageProgramme, x, z) => ({ id, sku, usageProgramme, x, z, rot: 0 });

test('le fichier de statistiques est agrégé : percentiles ordonnés, aucune scène', () => {
  assert.match(PRIORS.source, /licence non commerciale/);
  for (const t of Object.values(PRIORS.salon)) {
    const c = t.canape_ecran; assert.ok(c.p10 < c.p25 && c.p25 < c.p50 && c.p50 < c.p75 && c.p75 < c.p90);
    assert.ok(t.ecran_adosse > .8);
  }
  assert.ok(!JSON.stringify(PRIORS).includes('jid') && !JSON.stringify(PRIORS).includes('desc'));
  assert.ok(JSON.stringify(PRIORS).length < 8000);
});

test('canapé-écran : plage réelle récompensée, distance aberrante pénalisée', () => {
  const m = rectangle(6, 5);
  const note = d => evaluerPrior(m, [it('c', 'canape', 'canape', 0, 0), it('t', 'meuble', 'meuble-tv', d, 0)], CAT, 'salon');
  const t = PRIORS.salon['30-45'];
  const ok = note((t.canape_ecran.p25 + t.canape_ecran.p75) / 2), trop = note(1), loin = note(5.5);
  assert.ok(ok.score > 0, 'cœur de la plage : bonus');
  assert.ok(trop.score < 0 && loin.score < 0, 'hors plage : pénalité');
  assert.ok(trop.regles[0].id === 'prior-canape-ecran' && trop.score >= -6);
});

test('hors salon, ou sans écran, le terme ne note rien', () => {
  const m = rectangle(4, 3.5);
  assert.equal(evaluerPrior(m, [], CAT, 'chambre').score, 0);
  assert.equal(evaluerPrior(m, [it('c', 'canape', 'canape', 0, 0)], CAT, 'salon').score, 0);
});

test('seuil d\'équilibre : celui des pièces réelles, plus tolérant que .3 et lié à la taille', () => {
  const s = seuilEquilibre(rectangle(6, 5), 'salon');
  assert.ok(s > .4 && s < .7, String(s));
  assert.equal(seuilEquilibre(rectangle(6, 5), 'salon'), PRIORS.salon['30-45'].desequilibre.p75);
  // le seuil par défaut ne change pas sans paramètre
  const m = rectangle(6, 5), items = [it('c', 'canape', 'canape', -2.2, -1.8)];
  const defaut = evaluerRemplissage(m, items, CAT, {}), souple = evaluerRemplissage(m, items, CAT, { seuilEquilibre: s });
  assert.ok(souple.score >= defaut.score);
});

test('armoire facultative seulement en petite chambre', () => {
  assert.equal(armoireFacultative(8), true);
  assert.equal(armoireFacultative(11), true);
  assert.equal(armoireFacultative(14), false);
});

test('drapeau : coupé par défaut, activé par la variable, coupé par 0', () => {
  const avant = [process.env.REALROOM_PRIOR_SSR, process.env.NEXT_PUBLIC_REALROOM_PRIOR_SSR];
  try {
    delete process.env.REALROOM_PRIOR_SSR; delete process.env.NEXT_PUBLIC_REALROOM_PRIOR_SSR;
    assert.equal(priorSsrActif(), false);
    process.env.REALROOM_PRIOR_SSR = '1'; assert.equal(priorSsrActif(), true);
    process.env.NEXT_PUBLIC_REALROOM_PRIOR_SSR = '0'; assert.equal(priorSsrActif(), false);
  } finally {
    [['REALROOM_PRIOR_SSR', avant[0]], ['NEXT_PUBLIC_REALROOM_PRIOR_SSR', avant[1]]].forEach(([k, v]) => v === undefined ? delete process.env[k] : process.env[k] = v);
  }
});

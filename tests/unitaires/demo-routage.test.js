import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { build } from 'esbuild';

test('depuis les deux démos, l’aménagement traverse une seule fois le vrai fetch et les comptes restent locaux', async t => {
  const racine = path.resolve(import.meta.dirname, '../..');
  const b = await build({ entryPoints: [path.join(racine, 'components/api.js')], absWorkingDir: racine, bundle: true, format: 'esm', platform: 'browser', write: false, alias: { '@': racine }, logLevel: 'silent' });
  const { api } = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
  const noms = ['window', 'location', 'sessionStorage'], ancien = noms.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
  for (const k of noms) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k === 'location' ? { pathname: '', origin: 'https://demo.example' } : k === 'sessionStorage' ? { getItem: () => null, setItem: () => {} } : {} });
  t.after(() => noms.forEach((k, i) => { if (ancien[i]) Object.defineProperty(globalThis, k, ancien[i]); else delete globalThis[k]; }));
  const appels = [];
  let echec = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    appels.push({ url, corps: JSON.parse(options.body) });
    if (echec) return Response.json({ erreur: 'ia-indisponible' }, { status: 503 });
    return Response.json({ agencement: [], proposition: { concept: 'IA test', moteur: { type: 'ia' } } });
  });
  for (const chemin of ['/fr/demo/pieces/r_demo_salon', '/fr/maison-corleone/demo']) {
    location.pathname = chemin;
    const avant = appels.length;
    const r = await api('/api/pieces/r_demo_salon/amenager', { method: 'POST', corps: { mode: 'tout', budget: 1234, envies: 'Épuré' } });
    assert.equal(r.ok, true); assert.equal(r.piece.proposition.moteur.type, 'ia');
    assert.equal(appels.length, avant + 1); assert.equal(appels.at(-1).url, '/api/demo/amenager');
    assert.equal(appels.at(-1).corps.choix.budget, 1234);
    const moi = await api('/api/moi');
    assert.equal(moi.email, 'demo@realroom.app'); assert.equal(appels.length, avant + 1);
  }
  const avant = await api('/api/pieces/r_demo_salon');
  echec = true;
  const r = await api('/api/pieces/r_demo_salon/amenager', { method: 'POST', corps: { mode: 'tout', budget: 1234 } });
  assert.equal(r.ok, false); assert.equal(r.erreur, 'ia-indisponible');
  assert.deepEqual((await api('/api/pieces/r_demo_salon')).piece, avant.piece, 'aucune simulation ni mutation après une erreur serveur');
});

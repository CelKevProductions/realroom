import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { build } from 'esbuild';

test('les deux démos vérifient la disponibilité avant l’appel IA ; un refus conserve la pièce', async t => {
  const racine = path.resolve(import.meta.dirname, '../..');
  const b = await build({ entryPoints: [path.join(racine, 'components/api.js')], absWorkingDir: racine, bundle: true, format: 'esm', platform: 'browser', write: false, alias: { '@': racine }, logLevel: 'silent' });
  const { api } = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
  const noms = ['window', 'location', 'sessionStorage'], ancien = noms.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
  for (const k of noms) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k === 'location' ? { pathname: '', origin: 'https://demo.example' } : k === 'sessionStorage' ? { getItem: () => null, setItem: () => {} } : {} });
  t.after(() => noms.forEach((k, i) => { if (ancien[i]) Object.defineProperty(globalThis, k, ancien[i]); else delete globalThis[k]; }));
  const appels = [];
  let echec = false, disponible = true;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    appels.push({ url, method: options.method, corps: options.body && JSON.parse(options.body) });
    if (options.method === 'GET') return Response.json({ disponible, simulation: false, ...(!disponible ? { reference: 'D-02' } : {}) });
    if (echec) return Response.json({ erreur: 'ia-indisponible' }, { status: 503 });
    return Response.json({ agencement: [], proposition: { concept: 'IA test', moteur: { type: 'ia' } } });
  });
  for (const chemin of ['/fr/demo/pieces/r_demo_salon', '/fr/maison-corleone/demo']) {
    location.pathname = chemin;
    const avant = appels.length;
    const r = await api('/api/pieces/r_demo_salon/amenager', { method: 'POST', corps: { mode: 'tout', budget: 1234, envies: 'Épuré' } });
    assert.equal(r.ok, true); assert.equal(r.piece.proposition.moteur.type, 'ia');
    assert.equal(appels.length, avant + 2); assert.deepEqual(appels.slice(avant).map(a => a.method), ['GET', 'POST']);
    assert.ok(appels.slice(avant).every(a => a.url === '/api/demo/amenager'));
    assert.equal(appels.at(-1).corps.choix.budget, 1234);
    const moi = await api('/api/moi');
    assert.equal(moi.email, 'demo@realroom.app'); assert.equal(appels.length, avant + 2);
  }
  const avant = await api('/api/pieces/r_demo_salon');
  echec = true;
  const r = await api('/api/pieces/r_demo_salon/amenager', { method: 'POST', corps: { mode: 'tout', budget: 1234 } });
  assert.equal(r.ok, false); assert.equal(r.erreur, 'ia-indisponible');
  assert.deepEqual((await api('/api/pieces/r_demo_salon')).piece, avant.piece, 'aucune simulation ni mutation après une erreur serveur');
  disponible = false;
  const n = appels.length;
  const refuse = await api('/api/pieces/r_demo_salon/amenager', { method: 'POST', corps: { mode: 'tout', budget: 1234 } });
  assert.equal(refuse.reference, 'D-02'); assert.equal(refuse.statut, 503);
  assert.equal(appels.length, n + 1); assert.equal(appels.at(-1).method, 'GET', 'pas d’appel payant après le diagnostic');
  assert.deepEqual((await api('/api/pieces/r_demo_salon')).piece, avant.piece);
});

test('une requête IA qui ne répond jamais expire et conserve le plan local', async t => {
  const racine = path.resolve(import.meta.dirname, '../..');
  const b = await build({ entryPoints: [path.join(racine, 'components/api.js')], absWorkingDir: racine, bundle: true, format: 'esm', platform: 'browser', write: false, alias: { '@': racine }, logLevel: 'silent' });
  const { api } = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64') + '#timeout');
  const noms = ['window', 'location', 'sessionStorage'], ancien = noms.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
  for (const k of noms) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k === 'location' ? { pathname: '/fr/demo/pieces/r_demo_salon', origin: 'https://demo.example' } : k === 'sessionStorage' ? { getItem: () => null, setItem: () => {} } : {} });
  t.after(() => noms.forEach((k, i) => { if (ancien[i]) Object.defineProperty(globalThis, k, ancien[i]); else delete globalThis[k]; }));
  let signal, aCommence;
  const debut = new Promise(ok => { aCommence = ok; });
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    if (options.method === 'GET') return Response.json({ disponible: true, simulation: false });
    signal = options.signal;
    aCommence();
    return new Promise((_, ko) => signal.addEventListener('abort', () => ko(new DOMException('Délai écoulé', 'AbortError')), { once: true }));
  });
  const avant = (await api('/api/pieces/r_demo_salon')).piece;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const requete = api('/api/pieces/r_demo_salon/amenager', { method: 'POST', corps: { budget: 2000 } });
  await new Promise(ok => setImmediate(ok));
  t.mock.timers.tick(180); // latence de la démo locale, avant le fetch serveur
  await debut;
  assert.ok(signal, 'l’appel IA a commencé');
  t.mock.timers.tick(315000);
  const r = await requete;
  assert.equal(r.erreur, 'delai-amenagement'); assert.equal(r.ok, false);
  t.mock.timers.reset();
  assert.deepEqual((await api('/api/pieces/r_demo_salon')).piece, avant);
});

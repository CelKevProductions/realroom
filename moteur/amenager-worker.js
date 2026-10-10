import { calculerDemo } from '../lib/amenagement-demo.js';

self.addEventListener('message', e => {
  try { self.postMessage({ ok: true, resultat: calculerDemo(e.data) }); }
  catch (_) { self.postMessage({ ok: false }); }
});

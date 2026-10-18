// Banc d'essai partagé : serveur de production isolé (base PGlite et fichiers temporaires,
// services simulés, aucun secret ni base en ligne), navigateur et connexion par code.
// Après npm run build.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
export const racine = path.resolve(import.meta.dirname, '..', '..');
const chercher = [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '.', process.cwd(), '/opt/node22/lib/node_modules'];
export const { chromium } = require(require.resolve('playwright', { paths: chercher }));

export async function demarrerServeur({ port = Number(process.env.PORT || 3151), env: extra = {} } = {}) {
  const base = `http://127.0.0.1:${port}`;
  fs.mkdirSync(path.join(racine, '.data'), { recursive: true });
  const donnees = fs.mkdtempSync(path.join(racine, '.data', 'essais-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/DATABASE_URL|POSTGRES|BLOB_READ_WRITE|STRIPE_|FAL_|WLT_|ANTHROPIC_|RESEND_|SESSION_SECRET|MC_CLIENT_|RESPACE_|SCENEWEAVER_|^VERCEL/.test(k)));
  Object.assign(env, { REALROOM_ESSAIS: '1', REALROOM_SIMULATION: '1', SITE_URL: base,
    PGLITE_DIR: path.join(donnees, 'pglite'), FICHIERS_DIR: path.join(donnees, 'fichiers'), PORT: String(port) }, extra);
  const p = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { cwd: racine, env, detached: true, stdio: 'pipe' });
  let logs = '';
  p.stdout.on('data', d => { logs = (logs + d).slice(-20000); });
  p.stderr.on('data', d => { logs = (logs + d).slice(-20000); });
  const fin = Date.now() + 60000;
  while (true) {
    try { if ((await fetch(base + '/api/etat', { signal: AbortSignal.timeout(2000) })).ok) break; } catch (_) {}
    if (Date.now() > fin) { arreter(); throw new Error('Serveur indisponible : ' + logs); }
    await new Promise(r => setTimeout(r, 250));
  }
  function arreter() { try { process.kill(-p.pid, 'SIGTERM'); } catch (_) {} }
  return { base, donnees, logs: () => logs, arreter };
}

export async function navigateur() {
  return chromium.launch({ headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

export const json = async r => { assert.ok(r.ok(), `HTTP ${r.status()} ${r.url()}: ${await r.text()}`); return r.json(); };

// connexion simulée (code renvoyé par l'API en essai local) et cookie posé sur le contexte
export async function connecter(ctx, base, email = 'essai@example.com') {
  const code = await json(await ctx.request.post(base + '/api/auth/code', { data: { email, langue: 'fr' } }));
  const r = await ctx.request.post(base + '/api/auth/verifier', { data: { email, code: code.code, langue: 'fr' } });
  await json(r);
  const session = r.headers()['set-cookie']?.match(/rr_session=([^;]+)/)?.[1];
  assert.ok(session, 'cookie de session absent');
  await ctx.addCookies([{ name: 'rr_session', value: session, url: base, httpOnly: true, sameSite: 'Lax' }]);
  await ctx.addInitScript(() => { try { localStorage.setItem('rr-tuto-accueil', '1'); localStorage.setItem('rr-tuto-atelier', '1'); } catch (_) {} });
}

// erreurs de la page (exceptions, erreurs console) accumulées pour un contrôle final
export function surveiller(page, erreurs = []) {
  page.on('pageerror', e => erreurs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|cdn\.shopify/.test(m.text())) erreurs.push('console: ' + m.text()); });
  return erreurs;
}

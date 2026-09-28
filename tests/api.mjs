#!/usr/bin/env node
// Essais de l'API sur un serveur local (services simulés) : les cas limites que le parcours
// Playwright ne couvre pas. Après `npm run build` : node tests/api.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const RACINE = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT || 3117);
const BASE = `http://127.0.0.1:${PORT}`;
const DONNEES = path.join(RACINE, '.data', 'essais-api');
const PHOTO = fs.readFileSync(path.join(RACINE, 'tests', 'fixtures', 'salon-entree.jpg'));

fs.rmSync(DONNEES, { recursive: true, force: true });
const serveur = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: RACINE, detached: true, stdio: 'ignore',
  env: { ...process.env, REALROOM_SIMULATION: '1', REALROOM_ESSAIS: '1', PGLITE_DIR: path.join(DONNEES, 'pglite'), FICHIERS_DIR: path.join(DONNEES, 'fichiers'), PORT: String(PORT), SITE_URL: BASE }
});
const arreter = () => { try { process.kill(-serveur.pid, 'SIGTERM'); } catch (_) {} };
process.on('exit', arreter);

async function attendre() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE + '/api/etat')).ok) return; } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('le serveur ne démarre pas');
}

// petit client avec cookie de session
function client() {
  let cookie = '';
  const appel = async (url, { method = 'GET', corps, brut, formulaire } = {}) => {
    const r = await fetch(BASE + url, {
      method, redirect: 'manual',
      headers: { ...(cookie ? { cookie } : {}), ...(corps !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: corps !== undefined ? JSON.stringify(corps) : brut !== undefined ? brut : formulaire
    });
    const c = r.headers.get('set-cookie');
    if (c) cookie = c.split(';')[0];
    const j = await r.json().catch(() => ({}));
    return { statut: r.status, ...j };
  };
  appel.connexion = async email => {
    const d = await appel('/api/auth/code', { method: 'POST', corps: { email, langue: 'fr' } });
    assert.ok(d.code, 'pas de code d’essai : ' + JSON.stringify(d));
    const v = await appel('/api/auth/verifier', { method: 'POST', corps: { email, code: d.code, langue: 'fr' } });
    assert.equal(v.statut, 200, JSON.stringify(v));
    return (await appel('/api/moi'));
  };
  return appel;
}
const uidDe = piece => piece.photos[0].url.split('/')[4];   // /api/fichiers/u/<uid>/photos/…
const fichiersDe = (uid, dossier) => {
  try { return fs.readdirSync(path.join(DONNEES, 'fichiers', 'u', uid, dossier)).length; } catch (_) { return 0; }
};
const envoyerPhoto = (api, pieceId, role = 'detail') => {
  const f = new FormData();
  f.append('photo', new Blob([PHOTO], { type: 'image/jpeg' }), 'photo.jpg');
  f.append('role', role); f.append('largeur', '1600'); f.append('hauteur', '1200');
  return api(`/api/pieces/${pieceId}/photos`, { method: 'POST', formulaire: f });
};

const essais = [];
const essai = (nom, fn) => essais.push({ nom, fn });

essai('un corps JSON qui n’est pas un objet donne 400', async () => {
  const api = client();
  for (const brut of ['null', '[]', '42', '"x"']) {
    const r = await api('/api/auth/code', { method: 'POST', brut, });
    assert.equal(r.statut, 400, brut + ' -> ' + r.statut);
  }
});

essai('crédits offerts une seule fois par adresse (étiquettes, points Gmail, compte supprimé)', async () => {
  const a = client();
  const m1 = await a.connexion('jean.dupont+un@gmail.com');
  assert.equal(m1.credits, 3);
  const b = client();
  assert.equal((await b.connexion('jeandupont+deux@googlemail.com')).credits, 0);
  assert.equal((await a('/api/compte', { method: 'DELETE' })).statut, 200);
  const c = client();
  assert.equal((await c.connexion('jean.dupont+un@gmail.com')).credits, 0);
  const d = client();
  assert.equal((await d.connexion('marie@example.com')).credits, 3);
});

essai('15 codes faux dans la journée bloquent l’adresse, même avec de nouveaux codes', async () => {
  const api = client();
  const email = 'cible@example.com';
  let echecs = 0;
  for (let envoi = 0; envoi < 3; envoi++) {
    const d = await api('/api/auth/code', { method: 'POST', corps: { email, langue: 'fr' } });
    assert.ok(d.code);
    const faux = d.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const v = await api('/api/auth/verifier', { method: 'POST', corps: { email, code: faux } });
      assert.equal(v.statut, 400); echecs++;
    }
  }
  assert.equal(echecs, 15);
  const d = await api('/api/auth/code', { method: 'POST', corps: { email, langue: 'fr' } });
  const v = await api('/api/auth/verifier', { method: 'POST', corps: { email, code: d.code } });
  assert.notEqual(v.statut, 200, 'connexion acceptée malgré 15 échecs');
  assert.equal(v.erreur, 'limite');
});

essai('photos envoyées en parallèle : aucune perdue, plafond de 8 tenu, aucun fichier orphelin', async () => {
  const api = client();
  await api.connexion('photos@example.com');
  const pr = await api('/api/projets', { method: 'POST', corps: { nom: 'Essai' } });
  const pc = await api(`/api/projets/${pr.projet.id}/pieces`, { method: 'POST', corps: { nom: 'Salon', fonction: 'salon' } });
  const id = pc.piece.id;
  const r1 = await Promise.all(Array.from({ length: 6 }, () => envoyerPhoto(api, id)));
  assert.deepEqual(r1.map(r => r.statut), [200, 200, 200, 200, 200, 200]);
  let p = await api(`/api/pieces/${id}`);
  assert.equal(p.piece.photos.length, 6);
  const moi = { id: uidDe(p.piece) };
  assert.equal(fichiersDe(moi.id, 'photos'), 6);
  const r2 = await Promise.all(Array.from({ length: 3 }, () => envoyerPhoto(api, id)));
  assert.equal(r2.filter(r => r.statut === 200).length, 2);
  assert.equal(r2.filter(r => r.statut === 409).length, 1);
  p = await api(`/api/pieces/${id}`);
  assert.equal(p.piece.photos.length, 8);
  assert.equal(fichiersDe(moi.id, 'photos'), 8);
  // la photo principale remplace l'ancienne (deux envois simultanés : une seule reste)
  const r3 = await Promise.all([envoyerPhoto(api, id, 'entree'), envoyerPhoto(api, id, 'entree')]);
  assert.ok(r3.every(r => r.statut === 200 || r.statut === 409), JSON.stringify(r3.map(r => r.statut)));
  p = await api(`/api/pieces/${id}`);
  assert.equal(p.piece.photos.length, 8);
  assert.equal(fichiersDe(moi.id, 'photos'), 8);
});

essai('rendu puis visite 3D : crédits débités, résultat sans lien interne, pièce supprimée = fichiers supprimés', async () => {
  const api = client();
  await api.connexion('rendu@example.com');
  const pr = await api('/api/projets', { method: 'POST', corps: { nom: 'Essai' } });
  const pc = await api(`/api/projets/${pr.projet.id}/pieces`, { method: 'POST', corps: { nom: 'Salon', fonction: 'salon' } });
  const id = pc.piece.id;
  assert.equal((await api(`/api/pieces/${id}/rendus`, { method: 'POST', corps: { type: 'image', capture: 'data:image/jpeg;base64,' + PHOTO.toString('base64') } })).statut, 409);
  const ph = await envoyerPhoto(api, id, 'entree');
  assert.equal(ph.statut, 200);
  const moi = { id: uidDe(ph.piece) };
  // deux analyses lancées ensemble : une seule tourne
  const doubles = await Promise.all([1, 2].map(() => api(`/api/pieces/${id}/analyse`, { method: 'POST', corps: { langue: 'fr' } })));
  assert.deepEqual(doubles.map(a => a.statut).sort(), [200, 409], JSON.stringify(doubles.map(a => [a.statut, a.erreur])));
  const g = await api(`/api/pieces/${id}/rendus`, { method: 'POST', corps: { type: 'image', capture: 'data:image/jpeg;base64,' + PHOTO.toString('base64') } });
  assert.equal(g.statut, 201);
  assert.equal((await api('/api/moi')).credits, 2);
  let s;
  for (let i = 0; i < 20; i++) { s = await api(`/api/rendus/${g.id}`); if (s.etat !== 'en_cours') break; await new Promise(r => setTimeout(r, 700)); }
  assert.equal(s.etat, 'fini');
  assert.ok(s.resultat.image && !('fichier' in s.resultat) && !('source' in s.resultat), JSON.stringify(s.resultat));
  // visite 3D : 5 crédits, il en reste 2 -> refus sans débit ni ligne
  const m = await api(`/api/pieces/${id}/rendus`, { method: 'POST', corps: { type: 'monde', rendu: g.id } });
  assert.equal(m.statut, 402);
  assert.equal((await api('/api/moi')).credits, 2);
  assert.equal((await api(`/api/pieces/${id}/rendus`)).rendus.length, 1);
  const avant = fichiersDe(moi.id, 'photos') + fichiersDe(moi.id, 'captures');
  assert.ok(avant >= 2);
  assert.equal((await api(`/api/pieces/${id}`, { method: 'DELETE' })).statut, 200);
  assert.equal(fichiersDe(moi.id, 'photos') + fichiersDe(moi.id, 'captures'), 0);
});

essai('achat simulé local : crédits ajoutés ; route introuvable sans session', async () => {
  const api = client();
  await api.connexion('achat@example.com');
  const r = await api('/api/credits/achat', { method: 'POST', corps: { pack: 'essai', langue: 'fr', consentement: true } });
  assert.ok(r.url && r.url.includes('/api/credits/simulation'));
  const s = await api(new URL(r.url).pathname + new URL(r.url).search);
  assert.equal(s.statut, 303);
  assert.equal((await api('/api/moi')).credits, 13);
  const anonyme = client();
  assert.equal((await anonyme(new URL(r.url).pathname + new URL(r.url).search)).statut, 401);
});

try {
  await attendre();
  let ko = 0;
  for (const { nom, fn } of essais) {
    try { await fn(); console.log('ok  ', nom); } catch (e) { ko++; console.log('ÉCHEC', nom, '\n     ', e.message); }
  }
  console.log(ko ? `${ko} échec(s)` : 'OK');
  process.exitCode = ko ? 1 : 0;
} finally {
  arreter();
}

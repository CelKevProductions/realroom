#!/usr/bin/env node
// Essais de l'API sur un serveur local (services simulés) : les cas limites que le parcours
// Playwright ne couvre pas. Après `npm run build` : node tests/api.mjs
// Pour un incident précis : ESSAI_API='plan en miroir' node tests/api.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {scanAndroid, scanApple} from './fixtures/scans.js';
import {vuePourPosition} from '../lib/cadrages.js';
import {deplacerVuePhoto} from '../lib/navigation-photo.js';
import {demandeDemoIA} from '../lib/demo-ia.js';
import {champsDepuisScan} from '../lib/scan.js';
import {PRODUITS} from '../lib/catalogue.js';
import {lireDXF} from '../lib/plans.js';
import {segmentsDe,pointOuverture} from '../lib/contour.js';
import { salonConcave } from './fixtures/salons-catalogue.js';
import { sejour89 } from './fixtures/staging.js';
import { posesStaging } from '../lib/staging.js';

const RACINE = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT || 3117);
const BASE = `http://127.0.0.1:${PORT}`;
const DONNEES = path.join(RACINE, '.data', 'essais-api');
const PHOTO = fs.readFileSync(path.join(RACINE, 'tests', 'fixtures', 'salon-entree.jpg'));

fs.rmSync(DONNEES, { recursive: true, force: true });
const envEssais={...process.env};
for(const k of Object.keys(envEssais))if(/DATABASE_URL|POSTGRES|_READ_WRITE_TOKEN$|BLOB_STORE_ID|STRIPE_|FAL_|WLT_|ANTHROPIC_|RESEND_|SESSION_SECRET|MC_CLIENT_|^VERCEL/.test(k))delete envEssais[k];
const serveur = spawn(process.execPath, ['--import', path.join(RACINE, 'tests/fixtures/serveur-ia.mjs'), 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(PORT)], {
  cwd: RACINE, detached: true, stdio: 'inherit',
  env: { ...envEssais, REALROOM_SIMULATION: '1', REALROOM_ESSAIS: '1', PGLITE_DIR: path.join(DONNEES, 'pglite'), FICHIERS_DIR: path.join(DONNEES, 'fichiers'), PORT: String(PORT), SITE_URL: BASE,
    BIENVENUES_PAR_DOMAINE: '4', ANALYSES_ESSAI_PAR_JOUR: '3', FAL_KEY: 'test-sans-reseau', DEMO_FAL_AUDIT: path.join(DONNEES, 'fal.jsonl'), DEMO_AMENAGEMENT_IA: '1', DEMO_AMENAGEMENTS_PAR_JOUR: '2', DEMO_AMENAGEMENTS_GLOBAUX_PAR_JOUR: '3' }
});
const arreter = () => { try { process.kill(-serveur.pid, 'SIGTERM'); } catch (_) {} };
process.on('exit', arreter);

async function attendre() {
  for (let i = 0; i < 120; i++) {
    if(serveur.exitCode!==null)throw new Error('le serveur s’est arrêté : '+serveur.exitCode);
    try { if ((await fetch(BASE + '/api/etat',{signal:AbortSignal.timeout(2000)})).ok) return; } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('le serveur ne démarre pas');
}

// petit client avec cookie de session
function client(base = BASE, reseauEssai) {
  let cookie = '';
  const appel = async (url, { method = 'GET', corps, brut, formulaire, headers = {} } = {}) => {
    const r = await fetch(base + url, {
      method, redirect: 'manual', signal: AbortSignal.timeout(45000),
      headers: { ...(reseauEssai?{'x-forwarded-for':reseauEssai}:{}),...headers, ...(cookie ? { cookie } : {}), ...(corps !== undefined ? { 'content-type': 'application/json' } : {}) },
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

// Le fichier client reste local. Pour reproduire un incident : DXF_REGRESSION=/chemin/plan.dxf.
const pieceRegression = process.env.DXF_REGRESSION
  ? { ...champsDepuisScan(lireDXF(fs.readFileSync(process.env.DXF_REGRESSION, 'utf8')).pieces[0].scan), fonction: 'chambre', notes: '' }
  : { ...champsDepuisScan(scanAndroid()), fonction: 'chambre', notes: '' };

essai('clé, solde et accès IA : refus distincts sans remplacement du plan', async () => {
  const corps = demandeDemoIA(pieceRegression, { budget: 2000 }, 'fr');
  const avant = structuredClone(corps);
  for (const [cle, reference, refus, erreur] of [
    ['', 'D-02', '1', 'ia-indisponible'],
    ['test-refusee', 'D-07', '1', 'ia-indisponible'],
    ['test-sans-solde', 'D-08', 'credits', 'credits-ia'],
    ['test-sans-acces', 'D-09', 'acces', 'ia-indisponible']
  ]) {
    const base = `http://127.0.0.1:${PORT + 1}`, dossier = path.join(DONNEES, reference);
    const diagnostic = spawn(process.execPath, ['--import', path.join(RACINE, 'tests/fixtures/serveur-ia.mjs'), 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(PORT + 1)], {
      cwd: RACINE, stdio: 'inherit',
      env: { ...envEssais, REALROOM_ESSAIS: '1', REALROOM_SIMULATION: '1', DEMO_AMENAGEMENT_IA: '1', FAL_KEY: cle, DEMO_FAL_REFUS: refus, PGLITE_DIR: path.join(dossier, 'pglite'), FICHIERS_DIR: path.join(dossier, 'fichiers'), DEMO_FAL_AUDIT: path.join(dossier, 'fal.jsonl') }
    });
    try {
      let pret = false;
      for (let i = 0; i < 60 && !pret; i++) {
        if (diagnostic.exitCode !== null) throw new Error('serveur de diagnostic arrêté');
        try { pret = (await fetch(base + '/api/etat', { signal: AbortSignal.timeout(2000) })).ok; } catch (_) {}
        if (!pret) await new Promise(ok => setTimeout(ok, 500));
      }
      assert.ok(pret);
      const api = client(base), etat = await api('/api/demo/amenager');
      assert.equal(etat.disponible, !!cle);
      if (!cle) assert.equal(etat.reference, reference);
      const r = await api('/api/demo/amenager', { method: 'POST', corps });
      assert.equal(r.statut, 503, JSON.stringify(r)); assert.equal(r.erreur, erreur); assert.equal(r.reference, reference);
      assert.equal(r.agencement, undefined); assert.equal(r.proposition, undefined);
      assert.deepEqual(corps, avant);
      if (!cle) assert.equal(fs.existsSync(path.join(dossier, 'pglite')), false, 'aucun compteur ni appel IA lorsque la clé manque');
    } finally {
      await new Promise(ok => {
        if (diagnostic.exitCode !== null) return ok();
        const minuteur = setTimeout(() => diagnostic.kill('SIGKILL'), 3000);
        diagnostic.once('exit', () => { clearTimeout(minuteur); ok(); });
        diagnostic.kill('SIGTERM');
      });
    }
  }
});

essai('la démo anonyme appelle le moteur IA, conserve les choix et limite les appels avant le fournisseur', async () => {
  const api = client(), piece = { ...champsDepuisScan(scanApple()), fonction: 'chambre', notes: 'Conserver le lit' };
  const modele = structuredClone(piece.modele);
  const corps = demandeDemoIA(piece, { mode: 'tout', budget: 2000, envies: 'Chambre épurée', espaces: ['lecture'], placesRepas: 4, garder: [piece.agencement[0].id] }, 'fr');
  const envoyer = (ip = '192.0.2.1', b = corps, headers = {}) => api('/api/demo/amenager', { method: 'POST', corps: b, headers: { 'x-forwarded-for': ip, ...headers } });
  assert.equal((await api('/api/moi')).connecte, false);
  assert.deepEqual(await api('/api/demo/amenager'), { statut: 200, disponible: true, simulation: false });
  assert.equal((await envoyer('192.0.2.1', corps, { origin: 'https://autre.example' })).statut, 403);
  assert.equal((await envoyer('192.0.2.1', { ...corps, choix: { ...corps.choix, budget: -1 } })).statut, 400);
  for (let i = 0; i < 2; i++) {
    const r = await envoyer('192.0.2.1', i===1 ? {...corps,choix:{...corps.choix,referencesSpatiales:false}} : corps);
    if(i===1)assert.equal(r.proposition?.referencesSpatiales?.actif,false,'le repli traverse la démo et son serveur');
    assert.equal(r.statut, 200, JSON.stringify(r)); assert.equal(r.proposition.moteur.type, 'ia');
    assert.equal(r.proposition.concept, 'Proposition IA du fournisseur de test.');
    assert.equal(r.proposition.budget, 2000); assert.equal(r.proposition.envies, corps.choix.envies);
    assert.deepEqual(r.proposition.garder, corps.choix.garder);
    assert.deepEqual(r.proposition.espaces, ['lecture']); assert.equal(r.proposition.placesRepas, 4);
    assert.ok(r.agencement.some(it => it.id === piece.agencement[0].id && it.garde !== false));
    const total = r.agencement.filter(it => it.origine === 'catalogue' && it.garde !== false).reduce((n, it) => n + PRODUITS[it.sku].prix, 0);
    assert.ok(total <= 2000); assert.deepEqual(piece.modele, modele); assert.equal(r.piece, undefined);
  }
  assert.equal((await envoyer()).statut, 429);
  const corpsImporte = demandeDemoIA(pieceRegression, { budget: 2000, envies: 'Chambre épurée' }, 'fr');
  const original = structuredClone(corpsImporte);
  const importe = await envoyer('192.0.2.2', corpsImporte);
  assert.equal(importe.statut, 200, JSON.stringify(importe)); assert.equal(importe.proposition.moteur.type, 'ia');
  assert.deepEqual(corpsImporte, original, 'le plan importé reste intact à travers l’aménagement');
  assert.equal((await envoyer('192.0.2.3')).statut, 429);
  const appels = fs.readFileSync(path.join(DONNEES, 'fal.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(appels.length, 3, 'les corps invalides, origines étrangères et quotas ne déclenchent aucun appel IA');
  assert.ok(appels.every(a => a.max_tokens === 12000));
  const prompt = appels[0].messages.at(-1).content[0].text;
  assert.match(prompt, /Chambre épurée/); assert.match(prompt, /Budget for new pieces: 2000/);
  const releve = JSON.parse(prompt.split('Room (JSON):\n')[1].split('\n\n')[0]);
  assert.deepEqual(releve.dimensions, { largeur: 4, profondeur: 5, hauteur: 2.6, estimees: true });
  assert.equal(releve.ouvertures.entree[0].largeur, modele.murs.entree.ouvertures[0].largeur);
  assert.deepEqual(releve.meubles[0].dimensions_cm, piece.agencement[0].p.dim.map(v => Math.round(v * 100)));
  assert.equal((await api('/api/moi')).connecte, false);
});

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

essai('10 codes faux dans la journée, depuis un même réseau, bloquent l’adresse pour ce réseau', async () => {
  const api = client();
  const email = 'cible@example.com';
  let echecs = 0;
  for (let envoi = 0; envoi < 2; envoi++) {
    const d = await api('/api/auth/code', { method: 'POST', corps: { email, langue: 'fr' } });
    assert.ok(d.code);
    const faux = d.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const v = await api('/api/auth/verifier', { method: 'POST', corps: { email, code: faux } });
      assert.equal(v.statut, 400); echecs++;
    }
  }
  assert.equal(echecs, 10);
  const d = await api('/api/auth/code', { method: 'POST', corps: { email, langue: 'fr' } });
  const v = await api('/api/auth/verifier', { method: 'POST', corps: { email, code: d.code } });
  assert.equal(v.statut, 429, 'connexion acceptée malgré 10 échecs');
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
  // deux analyses lancées ensemble : une seule tourne, et seule elle compte dans le plafond (3 pour l'essai)
  const doubles = await Promise.all([1, 2].map(() => api(`/api/pieces/${id}/analyse`, { method: 'POST', corps: { langue: 'fr' } })));
  assert.deepEqual(doubles.map(a => a.statut).sort(), [200, 409], JSON.stringify(doubles.map(a => [a.statut, a.erreur])));
  for (let i = 0; i < 2; i++) assert.equal((await api(`/api/pieces/${id}/analyse`, { method: 'POST', corps: { langue: 'fr' } })).statut, 200);
  assert.equal((await api(`/api/pieces/${id}/analyse`, { method: 'POST', corps: { langue: 'fr' } })).statut, 429);
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

essai('crédits offerts plafonnés par domaine (hors grands fournisseurs), sans toucher aux autres', async () => {
  // example.com : marie, photos, rendu, achat ont déjà reçu les leurs (plafond d'essai : 4 par jour)
  assert.equal((await client().connexion('zoe@example.com')).credits, 0);
  assert.equal((await client().connexion('zoe.martin@gmail.com')).credits, 3);
});

essai('réaménagement relancé : budget, style, meuble gardé et déplacement enregistré conservés', async () => {
  const api = client();
  const moi = await api.connexion('amenagement@meubles.test');
  const projet = await api('/api/projets', { method: 'POST', corps: { nom: 'Meubles' } });
  const creation = await api(`/api/projets/${projet.projet.id}/pieces`, { method: 'POST', corps: { nom: 'Chambre', fonction: 'chambre' } });
  const id = creation.piece.id;
  const scan = await api(`/api/pieces/${id}/scan`, { method: 'POST', corps: { scan: scanApple() } });
  assert.equal(scan.statut, 200);
  const lit = scan.piece.agencement.find(it => it.p?.fam === 'lit');
  assert.ok(lit, 'le relevé contient le lit existant');
  const choix = { mode: 'tout', envies: 'Style scandinave, bois clair. Garder le lit et ajouter du rangement.', budget: 3000, garder: [lit.id], aRemplacer: [], langue: 'fr' };
  const premiere = await api(`/api/pieces/${id}/amenager`, { method: 'POST', corps: choix });
  assert.equal(premiere.statut, 200, JSON.stringify(premiere));
  assert.ok(premiere.piece.agencement.some(it => it.origine === 'catalogue'), 'la proposition fournit des meubles du catalogue');
  const deplace = premiere.piece.agencement.map(it => it.id === lit.id ? { ...it, x: .12 } : it);
  const enregistrement = await api(`/api/pieces/${id}`, { method: 'PATCH', corps: { agencement: deplace } });
  assert.equal(enregistrement.statut, 200);
  const prop = enregistrement.piece.proposition;
  assert.equal(prop.densite, null, 'un déplacement invalide le diagnostic de densité précédent');
  const suivantesEnvies = 'Style scandinave, bois clair. Un coin bureau près de la fenêtre.';
  const suivante = await api(`/api/pieces/${id}/amenager`, { method: 'POST', corps: { mode: 'tout', envies: suivantesEnvies, espaces: ['travail'], placesRepas: 4, budget: prop.budget, garder: prop.garder, aRemplacer: [], langue: 'fr' } });
  assert.equal(suivante.statut, 200, JSON.stringify(suivante));
  assert.equal(suivante.piece.proposition.budget, choix.budget);
  assert.equal(suivante.piece.proposition.envies, suivantesEnvies);
  assert.deepEqual(suivante.piece.proposition.espaces, ['travail']); assert.equal(suivante.piece.proposition.placesRepas, 4);
  assert.ok(suivante.piece.proposition.garder.includes(lit.id));
  assert.ok(suivante.piece.proposition.preferences.styles.includes('scandinave'));
  assert.deepEqual(suivante.piece.modele, scan.piece.modele, 'réaménager ne refait pas le scan');
  const garde = suivante.piece.agencement.find(it => it.id === lit.id && it.garde !== false);
  assert.ok(garde);
  assert.equal(garde.x, enregistrement.piece.agencement.find(it => it.id === lit.id).x);
  assert.equal((await api('/api/moi')).credits, moi.credits, 'aucun rendu image généré ou débité');
  const recharge = await api(`/api/pieces/${id}`);
  assert.deepEqual(recharge.piece.agencement, suivante.piece.agencement, 'le nouvel aménagement est enregistré');
});

essai('salon : les idées modifiées créent une table et quatre chaises, enregistrées après rechargement', async () => {
  const api = client(); await api.connexion('repas@brief.test');
  const pr = await api('/api/projets', { method: 'POST', corps: { nom: 'Espaces de vie' } });
  const pc = await api(`/api/projets/${pr.projet.id}/pieces`, { method: 'POST', corps: { nom: 'Salon', fonction: 'salon' } });
  const scan = scanApple(); scan.objects = [];
  scan.walls.forEach((w, i) => { w.size[0] = i < 2 ? 8 : 6; w.transform[12] *= 2; w.transform[14] *= 1.2; });
  scan.openings.forEach(o => { o.transform[12] *= 2; o.transform[14] *= 1.2; });
  const id = pc.piece.id, releve = await api(`/api/pieces/${id}/scan`, { method: 'POST', corps: { scan } });
  assert.equal(releve.statut, 200);
  const choix = { mode: 'tout', envies: 'Une table à manger près de la fenêtre, bois clair.', espaces: ['repas'], placesRepas: 4, budget: 15000, garder: [], aRemplacer: [], langue: 'fr' };
  const r = await api(`/api/pieces/${id}/amenager`, { method: 'POST', corps: choix });
  assert.equal(r.statut, 200, JSON.stringify(r));
  assert.equal(r.piece.agencement.filter(it => it.usageProgramme === 'table-repas').length, 1);
  assert.equal(r.piece.agencement.filter(it => it.usageProgramme === 'chaise-repas').length, 4);
  assert.deepEqual(r.piece.proposition.espaces, ['repas']); assert.equal(r.piece.proposition.placesRepas, 4);
  assert.ok(!r.piece.proposition.programme.manquants.some(s => ['table-repas', 'chaise-repas'].includes(s.usage)));
  const recharge = await api(`/api/pieces/${id}`);
  assert.deepEqual(recharge.piece.agencement, r.piece.agencement); assert.equal(recharge.piece.proposition.envies, choix.envies);
  assert.deepEqual(recharge.piece.modele, releve.piece.modele);
});

essai('90 m² : zones, densité et passage enregistrés ; le repli retire le nouveau palier', async () => {
  const api = client(); await api.connexion('surface@composition.test');
  const pr = await api('/api/projets', { method: 'POST', corps: { nom: 'Grand séjour synthétique' } });
  const pc = await api(`/api/projets/${pr.projet.id}/pieces`, { method: 'POST', corps: { nom: 'Séjour', fonction: 'salon' } });
  const scan = scanApple(); scan.objects = [];
  scan.walls.forEach((w, i) => { w.size[0] = i < 2 ? 10 : 9; w.transform[12] *= 2.5; w.transform[14] *= 1.8; });
  scan.openings.forEach(o => { o.transform[12] *= 2.5; o.transform[14] *= 1.8; });
  const id = pc.piece.id;
  assert.equal((await api(`/api/pieces/${id}/scan`, { method: 'POST', corps: { scan } })).statut, 200);
  const choix = { mode: 'tout', envies: '', espaces: ['repas', 'lecture', 'travail', 'rangement'], placesRepas: 8, budget: 0, garder: [], aRemplacer: [], langue: 'fr' };
  const r = await api(`/api/pieces/${id}/amenager`, { method: 'POST', corps: choix });
  assert.equal(r.statut, 200, JSON.stringify(r));
  const p = r.piece.proposition;
  assert.equal(p.densite.echelle.surface, 90);
  assert.ok(p.densite.zonesVie >= 3); assert.ok(r.piece.agencement.length >= 20);
  assert.equal(p.planZones.audit.valide, true); assert.equal(p.planZones.audit.circulation.largeur, 1.1);
  assert.equal(r.piece.agencement.filter(it => it.usageProgramme === 'chaise-repas').length, 8);
  assert.equal(r.piece.agencement.filter(it => it.usageProgramme === 'table-repas').length, 1);
  assert.deepEqual(p.programme.manquants.filter(s => s.obligatoire), []);
  const relu = await api(`/api/pieces/${id}`);
  assert.deepEqual(relu.piece.proposition.densite, p.densite);
  assert.deepEqual(relu.piece.agencement, r.piece.agencement);
  const repli = await api(`/api/pieces/${id}/amenager`, { method: 'POST', corps: { ...choix, compositionSurface: false } });
  assert.equal(repli.statut, 200, JSON.stringify(repli));
  assert.equal(repli.piece.proposition.densite, undefined);
  assert.equal(repli.piece.proposition.programme.compositionSurface, undefined);
});

essai('séjour en L : brief vide, sans plafond, huit places et quatre activités sauvegardées', async () => {
  const api = client(); await api.connexion('concave@composition.test');
  const pr = await api('/api/projets', { method: 'POST', corps: { nom: 'Séjour synthétique en L' } });
  const pc = await api(`/api/projets/${pr.projet.id}/pieces`, { method: 'POST', corps: { nom: 'Séjour', fonction: 'salon' } });
  const modele = salonConcave();
  const scan = { version: scanAndroid().version, source: 'plan-dessine', unit: 'm',
    floorCorners: modele.contour.map(([x, z]) => [x, 0, z]), ceilingHeight: modele.dims.hauteur,
    openings: segmentsDe(modele).flatMap(pan => modele.murs[pan.id].ouvertures.map(o => ({ type: o.type,
      a: pan.centre.map((v, i) => v + (o.position - o.largeur / 2) * pan.d[i]),
      b: pan.centre.map((v, i) => v + (o.position + o.largeur / 2) * pan.d[i]) }))) };
  const id = pc.piece.id;
  const releve = await api(`/api/pieces/${id}/scan`, { method: 'POST', corps: { scan } });
  assert.equal(releve.statut, 200, JSON.stringify(releve));
  const choix = { mode: 'tout', envies: '', espaces: ['repas', 'lecture', 'travail', 'rangement'], placesRepas: 8, budget: 0, garder: [], aRemplacer: [], langue: 'fr' };
  const r = await api(`/api/pieces/${id}/amenager`, { method: 'POST', corps: choix });
  assert.equal(r.statut, 200, JSON.stringify(r));
  assert.equal(r.piece.agencement.filter(it => it.usageProgramme === 'table-repas').length, 1);
  assert.equal(r.piece.agencement.filter(it => it.usageProgramme === 'chaise-repas').length, 8);
  assert.equal(r.piece.proposition.densite.zonesVie, 4);
  assert.deepEqual(r.piece.proposition.programme.manquants.filter(s => s.obligatoire), []);
  assert.equal(r.piece.proposition.planZones.audit.valide, true);
  const relu = await api(`/api/pieces/${id}`);
  assert.deepEqual(relu.piece.agencement, r.piece.agencement);
  assert.deepEqual(relu.piece.modele, releve.piece.modele);
});

essai('mission 4 : staging du séjour 89 m² sauvegardé, attaches mobiles, hors budget et repli', async () => {
  const api=client();await api.connexion('mission4@staging.test');
  const pr=await api('/api/projets',{method:'POST',corps:{nom:'Staging synthétique'}});
  const pc=await api(`/api/projets/${pr.projet.id}/pieces`,{method:'POST',corps:{nom:'Séjour',fonction:'salon'}}),id=pc.piece.id;
  const modele=sejour89(),scan={version:scanAndroid().version,source:'plan-dessine',unit:'m',ceilingHeight:modele.dims.hauteur,
    floorCorners:modele.contour.map(([x,z])=>[x,0,z]),openings:segmentsDe(modele).flatMap(pan=>modele.murs[pan.id].ouvertures.map(o=>({type:o.type,
      a:pan.centre.map((v,i)=>v+(o.position-o.largeur/2)*pan.d[i]),b:pan.centre.map((v,i)=>v+(o.position+o.largeur/2)*pan.d[i])})))};
  assert.equal((await api(`/api/pieces/${id}/scan`,{method:'POST',corps:{scan}})).statut,200);
  const choix={mode:'tout',envies:'Salon chaleureux',budget:0,garder:[],aRemplacer:[],langue:'fr'};
  const r=await api(`/api/pieces/${id}/amenager`,{method:'POST',corps:choix});assert.equal(r.statut,200,JSON.stringify(r));
  const p=r.piece.proposition;assert.equal(p.densite.echelle.surface,89);assert.equal(p.densite.zonesVie,5);
  assert.ok(p.staging.items.length>20);assert.deepEqual(p.staging.diagnostic.audit,[]);assert.equal(p.planZones.audit.valide,true);
  assert.ok(p.staging.items.every(it=>it.vendu===false&&!it.sku&&!it.p.prix));
  const cout=xs=>xs.filter(it=>it.origine==='catalogue').reduce((s,it)=>s+(PRODUITS[it.sku]?.prix||0),0);
  assert.equal(cout([...r.piece.agencement,...p.staging.items]),cout(r.piece.agencement));
  const relu=await api(`/api/pieces/${id}`);assert.deepEqual(relu.piece.proposition.staging,p.staging);
  const h=r.piece.agencement.find(it=>p.staging.items.some(q=>q.attach_to?.id===it.id&&q.kind==='surface_item'));
  const avant=posesStaging(r.piece.agencement,p.staging).find(it=>it.attach_to?.id===h.id);
  const deplaces=r.piece.agencement.map(it=>it.id===h.id?{...it,x:it.x+.1,z:it.z+.1}:it);
  assert.equal((await api(`/api/pieces/${id}`,{method:'PATCH',corps:{agencement:deplaces}})).statut,200);
  const relu2=await api(`/api/pieces/${id}`),apres=posesStaging(relu2.piece.agencement,relu2.piece.proposition.staging).find(it=>it.id===avant.id);
  assert.ok(Math.abs(apres.x-avant.x-.1)<.002);assert.ok(Math.abs(apres.z-avant.z-.1)<.002);
  const repli=await api(`/api/pieces/${id}/amenager`,{method:'POST',corps:{...choix,staging:false}});
  assert.equal(repli.statut,200);assert.equal(repli.piece.proposition.staging,undefined);
});

essai('mission 5 : IDs source, staging S et drapeau conservés après enregistrement', async () => {
  const api=client(BASE,'198.51.100.55');await api.connexion('mission5@encyclopedie.test');
  const pr=await api('/api/projets',{method:'POST',corps:{nom:'Encyclopédie synthétique'}});
  const pc=await api(`/api/projets/${pr.projet.id}/pieces`,{method:'POST',corps:{nom:'Séjour',fonction:'salon'}}),id=pc.piece.id;
  const modele=sejour89(),scan={version:scanAndroid().version,source:'plan-dessine',unit:'m',ceilingHeight:modele.dims.hauteur,
    floorCorners:modele.contour.map(([x,z])=>[x,0,z]),openings:segmentsDe(modele).flatMap(pan=>modele.murs[pan.id].ouvertures.map(o=>({type:o.type,
      a:pointOuverture(pan,o.position-o.largeur/2),b:pointOuverture(pan,o.position+o.largeur/2)})))};
  assert.equal((await api(`/api/pieces/${id}/scan`,{method:'POST',corps:{scan}})).statut,200);
  const choix={mode:'tout',envies:'Salon chaleureux',encyclopedie:true,budget:0,garder:[],langue:'fr'};
  const r=await api(`/api/pieces/${id}/amenager`,{method:'POST',corps:choix});assert.equal(r.statut,200,JSON.stringify(r));
  const p=r.piece.proposition;assert.ok(p.encyclopedie);assert.equal(p.encyclopedie.audit.valide,true);assert.equal(p.densite.zonesVie,5);assert.ok(p.planZones.zones.every(z=>z.dispositionUid));
  assert.ok(p.staging.encyclopedie.signatureMoments.length);assert.ok(p.staging.items.every(it=>it.classe==='S'&&!it.sku&&!it.p.prix));
  const relu=await api(`/api/pieces/${id}`);assert.deepEqual(relu.piece.proposition.encyclopedie,p.encyclopedie);
  assert.equal((await api(`/api/pieces/${id}`,{method:'PATCH',corps:{agencement:r.piece.agencement}})).statut,200);
  const relu2=await api(`/api/pieces/${id}`);assert.deepEqual(relu2.piece.agencement.map(it=>it.dispositionUid),r.piece.agencement.map(it=>it.dispositionUid));
  const repli=await api(`/api/pieces/${id}/amenager`,{method:'POST',corps:{...choix,encyclopedie:false}});assert.equal(repli.statut,200);assert.equal(repli.piece.proposition.encyclopedie,undefined);
});

essai('mission 5 : erreur 422 réglementaire sans remplacement du plan sauvegardé', async () => {
  const api=client(BASE,'198.51.100.56');await api.connexion('mission5-strict@encyclopedie.test');
  const pr=await api('/api/projets',{method:'POST',corps:{nom:'Règles synthétiques'}}),pc=await api(`/api/projets/${pr.projet.id}/pieces`,{method:'POST',corps:{nom:'Chambre',fonction:'chambre'}}),id=pc.piece.id;
  assert.equal((await api(`/api/pieces/${id}/scan`,{method:'POST',corps:{scan:scanAndroid()}})).statut,200);
  const avant=await api(`/api/pieces/${id}`),r=await api(`/api/pieces/${id}/amenager`,{method:'POST',corps:{mode:'tout',encyclopedie:true,profilUsage:{ergonomieStricte:true},envies:'Chambre',budget:0}});
  assert.equal(r.statut,422,JSON.stringify(r));assert.equal(r.erreur,'regles-bloquantes');const apres=await api(`/api/pieces/${id}`);assert.deepEqual(apres.piece.agencement,avant.piece.agencement);assert.deepEqual(apres.piece.proposition,avant.piece.proposition);
  const partiel=await api(`/api/pieces/${id}/amenager`,{method:'POST',corps:{mode:'partiel',encyclopedie:true,profilUsage:{ergonomieStricte:true},envies:'Chambre',budget:0}});assert.equal(partiel.statut,422);assert.deepEqual((await api(`/api/pieces/${id}`)).piece.agencement,avant.piece.agencement);
});

essai('rendu guidé : caméra, nuit, photo indépendante, concurrence et référence conservée', async () => {
  const api=client();await api.connexion('camera@angles.test');
  const pr=await api('/api/projets',{method:'POST',corps:{nom:'Caméra'}});
  const pc=await api(`/api/projets/${pr.projet.id}/pieces`,{method:'POST',corps:{nom:'Chambre',fonction:'chambre'}});
  const id=pc.piece.id;
  const sc=await api(`/api/pieces/${id}/scan`,{method:'POST',corps:{scan:scanAndroid()}});
  assert.equal(sc.statut,200);
  const generique={id:'gen-test',origine:'catalogue',sku:'rr-gen-basse-compacte-60',x:0,z:0,rot:0,p:{prix:0,dim:[.01,.01,.01]}};
  const ajout=await api(`/api/pieces/${id}`,{method:'PATCH',corps:{agencement:[generique]}});assert.equal(ajout.statut,200);
  const relu=await api(`/api/pieces/${id}`);assert.equal(relu.piece.agencement[0].sku,generique.sku);assert.equal(relu.piece.agencement[0].p,undefined);
  assert.equal(PRODUITS[generique.sku].generique,true);
  const vue=deplacerVuePhoto(sc.piece.modele,{...vuePourPosition(sc.piece.modele,'fond-gauche'),aspect:1.72},{avant:1,droite:1},.05);
  const capture='data:image/jpeg;base64,'+PHOTO.toString('base64');
  const requete={type:'image',angle:'libre',vue,ambiance:'nuit',capture};
  assert.equal((await api(`/api/pieces/${id}/rendus`,{method:'POST',corps:requete})).erreur,'photo-entree');
  assert.equal((await api(`/api/pieces/${id}/rendus`,{method:'POST',corps:{...requete,sansPhoto:'true'}})).statut,400);
  assert.equal((await api(`/api/pieces/${id}/rendus`,{method:'POST',corps:{...requete,sansPhoto:true,vue:{...vue,x:50}}})).statut,400);
  assert.equal((await api('/api/moi')).credits,3);
  const ph=await envoyerPhoto(api,id,'rendu');assert.equal(ph.statut,200);
  const uid=uidDe(ph.piece);
  const doubles=await Promise.all([1,2].map(()=>api(`/api/pieces/${id}/rendus`,{method:'POST',corps:requete})));
  assert.deepEqual(doubles.map(r=>r.statut).sort(),[201,409]);
  assert.equal((await api('/api/moi')).credits,2);
  const g=doubles.find(r=>r.statut===201);
  let fini;for(let i=0;i<20;i++){fini=await api(`/api/rendus/${g.id}`);if(fini.etat!=='en_cours')break;await new Promise(r=>setTimeout(r,400));}
  assert.equal(fini.etat,'fini');assert.equal(fini.ambiance,'nuit');assert.deepEqual(fini.vue,vue);
  assert.ok(fini.reference.includes('/captures/'));assert.notEqual(fini.reference,ph.piece.photos[0].url);
  assert.equal(fini.referenceLargeur,1600);assert.equal(fini.referenceHauteur,1200);
  assert.equal((await envoyerPhoto(api,id,'rendu')).statut,200);
  assert.equal((await api(fini.reference)).statut,200,'le remplacement ne supprime pas la référence historique');
  const sans=await api(`/api/pieces/${id}/rendus`,{method:'POST',corps:{...requete,ambiance:'jour',sansPhoto:true}});
  assert.equal(sans.statut,201);assert.equal((await api('/api/moi')).credits,1);
  assert.equal((await api(`/api/pieces/${id}/rendus`)).rendus.length,2);
  assert.equal((await api(`/api/pieces/${id}`,{method:'DELETE'})).statut,200);
  assert.equal(fichiersDe(uid,'photos')+fichiersDe(uid,'captures'),0,'les instantanés sont supprimés avec la pièce');
});

essai('hauteurs et attaches : TV et tableau gardent leur pose après sauvegarde et rechargement', async () => {
  const api=client();await api.connexion('pose@composition.test');
  const pr=await api('/api/projets',{method:'POST',corps:{nom:'Composition'}});
  const pc=await api(`/api/projets/${pr.projet.id}/pieces`,{method:'POST',corps:{nom:'Salon',fonction:'salon'}});
  const id=pc.piece.id,sc=await api(`/api/pieces/${id}/scan`,{method:'POST',corps:{scan:scanAndroid()}});
  assert.equal(sc.statut,200);
  const pan=segmentsDe(sc.piece.modele).find(p=>!(sc.piece.modele.murs[p.id]?.ouvertures||[]).length);
  assert.ok(pan);
  const base={id:'support',origine:'catalogue',sku:'rr-gen-tv-100',x:0,z:0,rot:0};
  const tv={id:'ecran',origine:'catalogue',sku:'rr-gen-television-43',x:0,z:0,rot:0,y:.755,height:900,
    kind:'surface_item',attach_to:{type:'furniture',id:'support'},zoneId:'salon',usageProgramme:'television',slotProgramme:'salon:television:1'};
  const art={id:'tableau',origine:'catalogue',sku:'rr-gen-tableau-60',x:pan.centre[0],z:pan.centre[1],rot:Math.atan2(pan.n[0],pan.n[1]),y:1.475,
    kind:'wall_item',mur:pan.id,wall_offset:999,attach_to:{type:'wall',id:'invente'}};
  const patch=await api(`/api/pieces/${id}`,{method:'PATCH',corps:{agencement:[base,tv,art]}});assert.equal(patch.statut,200);
  const r=await api(`/api/pieces/${id}`),ecran=r.piece.agencement.find(it=>it.id==='ecran'),tableau=r.piece.agencement.find(it=>it.id==='tableau');
  assert.equal(ecran.y,.755);assert.equal(ecran.height,.755);assert.equal(ecran.kind,'surface_item');
  assert.deepEqual(ecran.attach_to,{type:'furniture',id:'support'});assert.equal(ecran.usageProgramme,'television');
  assert.equal(tableau.height,1.475);assert.equal(tableau.wall_offset,Math.round(pan.long/2*1000)/1000);
  assert.deepEqual(tableau.attach_to,{type:'wall',id:pan.id});
  assert.equal((await api(`/api/pieces/${id}`,{method:'DELETE'})).statut,200);
});

essai('plan en miroir : contour, ouvertures et mobilier sauvegardés ensemble, symétrie invalide refusée', async () => {
  const api=client();await api.connexion('plan@orientation.test');
  const pr=await api('/api/projets',{method:'POST',corps:{nom:'Orientation'}});
  const pc=await api(`/api/projets/${pr.projet.id}/pieces`,{method:'POST',corps:{nom:'Pièce en L',fonction:'salon'}}),id=pc.piece.id;
  const scan={version:'realroom-scan-v1',source:'plan-dxf',unit:'m',floorCorners:[[0,0,0],[6,0,0],[6,0,2],[2,0,2],[2,0,5],[0,0,5]],ceilingHeight:2.6,
    openings:[{type:'porte',a:[.5,0],b:[1.4,0]},{type:'fenetre',a:[2,3],b:[2,4.2]}]};
  assert.equal((await api(`/api/pieces/${id}/scan`,{method:'POST',corps:{scan}})).statut,200);
  const items=[{id:'existant',origine:'existant',x:-2,z:1,rot:.4,p:{fam:'meuble',nom:'Rangement conservé',dim:[.7,.4,.8]}}];
  assert.equal((await api(`/api/pieces/${id}`,{method:'PATCH',corps:{agencement:items}})).statut,200);
  for (const axe of ['z','x']) {
    const avant=(await api(`/api/pieces/${id}`)).piece;
    const r=await api(`/api/pieces/${id}`,{method:'PATCH',corps:{geometrie:{miroir:{[axe]:true}}}});
    assert.equal(r.statut,200,JSON.stringify(r));
    assert.deepEqual(r.piece.modele.contour,avant.modele.contour.map(([x,z])=>[axe==='x'?-x:x,axe==='z'?-z:z]));
    assert.equal(r.piece.agencement[0][axe],-avant.agencement[0][axe]);
    assert.deepEqual(r.piece.agencement[0].p.dim,items[0].p.dim);
    for(const pan of segmentsDe(avant.modele))for(const [i,o]of avant.modele.murs[pan.id].ouvertures.entries()){
      const a=pointOuverture(pan,o.position),nouveau=segmentsDe(r.piece.modele).find(p=>p.id===pan.id);
      const b=pointOuverture(nouveau,r.piece.modele.murs[pan.id].ouvertures[i].position);
      assert.ok(Math.abs(b[0]-(axe==='x'?-a[0]:a[0]))<.011);assert.ok(Math.abs(b[1]-(axe==='z'?-a[1]:a[1]))<.011);
    }
    const relu=(await api(`/api/pieces/${id}`)).piece;
    assert.deepEqual(relu.modele,r.piece.modele);assert.deepEqual(relu.agencement,r.piece.agencement);
  }
  const avant=(await api(`/api/pieces/${id}`)).piece;
  assert.equal((await api(`/api/pieces/${id}`,{method:'PATCH',corps:{geometrie:{miroir:{x:'oui'}}}})).statut,400);
  assert.deepEqual((await api(`/api/pieces/${id}`)).piece.modele,avant.modele);
  assert.equal((await api(`/api/pieces/${id}`,{method:'DELETE'})).statut,200);
});

essai('les pages RealRoom, Maison Corleone et relevé mobile sont servies', async () => {
  for(const url of ['/fr/demo','/en/demo','/fr/maison-corleone/demo','/en/maison-corleone/demo','/fr/releve','/en/releve']) {
    const r=await fetch(BASE+url);assert.equal(r.status,200,url);
    const html=await r.text();assert.ok(html.includes('</html>'),url);
  }
  const guide=await fetch(BASE+'/api/guides/lagarsoft');assert.equal(guide.status,200);
  const j=await guide.json();assert.ok(j.qr.startsWith('data:image/'),'le QR Apple est disponible');
  const vignette=await fetch(BASE+'/generiques/rr-gen-basse-compacte-60.svg');assert.equal(vignette.status,200);
  assert.match(await vignette.text(),/modèle générique/);
  const ecran=await fetch(BASE+'/generiques/rr-gen-television-43.svg');assert.equal(ecran.status,200);
  const tableau=await fetch(BASE+'/generiques/rr-gen-tableau-120.svg');assert.equal(tableau.status,200);
});

try {
  await attendre();
  let ko = 0;
  const selection=essais.filter(e=>!process.env.ESSAI_API||e.nom.includes(process.env.ESSAI_API));
  assert.ok(selection.length,'Aucun scénario ne correspond à ESSAI_API');
  for (const { nom, fn } of selection) {
    try { await fn(); console.log('ok  ', nom); } catch (e) { ko++; console.log('ÉCHEC', nom, '\n     ', e.message); }
  }
  console.log(ko ? `${ko} échec(s)` : 'OK');
  process.exitCode = ko ? 1 : 0;
} finally {
  arreter();
}

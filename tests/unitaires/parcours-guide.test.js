import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { build } from 'esbuild';
import { PRODUITS } from '../../lib/catalogue.js';
import { normaliserParcours, demandeProposition, etatVide } from '../../lib/parcours.js';
import { bilanConfort } from '../../lib/confort.js';

const piece = { id: 'p1', nom: 'Séjour', fonction: 'salon', agencement: [] };

test('le nouveau projet guidé garde le foyer, trois priorités, deux styles et un budget par pièce', () => {
  const etat = normaliserParcours({
    ...etatVide(), pieces: ['p1'],
    usages: { p1: { espaces: ['repas'], placesRepas: 6, budget: 2500, confirme: true } },
    preferences: {
      foyer: { adultes: 40, enfants: -2, chien: 'oui', chat: true, recevoir: 'tous-les-jours' },
      priorites: ['enfants', 'circulation', 'inconnue', 'lumiere', 'calme'], styles: ['boheme', 'japandi', 'scandinave'], style: 'Bohème, Japandi'
    }
  }, [piece]);
  assert.equal(etat.usages.p1.budget, 2500);
  assert.deepEqual(etat.preferences.foyer, { adultes: 12, enfants: 0, chien: false, chat: true, recevoir: 'parfois' }, 'bornes, vrai seulement si coché');
  assert.deepEqual(etat.preferences.priorites, ['circulation', 'calme', 'lumiere'], 'trois au plus, dans l’ordre des priorités');
  assert.deepEqual(etat.preferences.styles, ['japandi', 'scandinave'], 'deux au plus');
  assert.equal(normaliserParcours({ ...etatVide(), pieces: ['p1'], usages: { p1: { budget: 9e9 } } }, [piece]).usages.p1.budget, 1e6, 'budget borné');
  assert.equal(normaliserParcours({ ...etatVide(), pieces: ['p1'], usages: { p1: { budget: 0 } } }, [piece]).usages.p1.budget, undefined, 'pas de budget : celui du projet');
});

test('la demande de première proposition met le style en premier et dit le foyer en clair', () => {
  const etat = normaliserParcours({
    ...etatVide(), pieces: ['p1'], usages: { p1: { espaces: ['repas'], placesRepas: 6, budget: 2500, envies: 'pas de tapis', confirme: true } },
    preferences: { style: 'Japandi', budget: 9000, foyer: { adultes: 2, enfants: 1, chien: false, chat: false, recevoir: 'souvent' }, priorites: ['recevoir'] }
  }, [piece]);
  const d = demandeProposition(etat, piece, 'fr');
  const lignes = d.envies.split('\n');
  assert.equal(lignes[0], 'Style : Japandi');
  assert.match(d.envies, /1 enfant/);
  assert.match(d.envies, /reçoit souvent des invités/, 'le moteur lit « invités »');
  assert.match(d.envies, /convivial/, 'le moteur lit « convivial »');
  assert.match(d.envies, /pas de tapis/);
  assert.equal(d.budget, 2500, 'le budget de la pièce passe avant celui du projet');
  assert.deepEqual(d.espaces, ['repas']);
  assert.equal(d.placesRepas, 6);
});

test('des éléments de cuisine relevés côte à côte ne comptent pas comme des meubles qui se chevauchent', () => {
  const modele = { dims: { largeur: 4, profondeur: 4, hauteur: 2.6, estimees: false },
    murs: { entree: { ouvertures: [{ type: 'porte', position: 0, largeur: .9, allege: 0 }] }, fond: { ouvertures: [] }, gauche: { ouvertures: [] }, droite: { ouvertures: [] } } };
  const meuble = (id, z, fixe) => ({ id, origine: 'existant', x: 1.7, z, rot: -Math.PI / 2, p: { nom: id, fam: 'cuisine', dim: [.6, .6, .9] },
    ...(fixe ? { contraintes: { conserver: true, dimensionsFixes: true, positionFixe: true, rotationFixe: true } } : {}) });
  const chevauchements = items => bilanConfort(modele, items, {}).alertes.filter(a => a.type === 'chevauchement').length;
  assert.equal(chevauchements([meuble('evier', -1, true), meuble('lave-vaisselle', -.4, true)]), 0, 'la pièce est ainsi : rien à corriger');
  assert.equal(chevauchements([meuble('evier', -1, false), meuble('lave-vaisselle', -.4, false)]), 1, 'des meubles déplaçables doivent toujours s’écarter');
});

test('la pièce d’exemple de la démo se meuble de bout en bout, comme dans le nouveau projet guidé', async t => {
  const racine = path.resolve(import.meta.dirname, '../..');
  const b = await build({ stdin: { contents: "export { api } from '@/components/api.js'; export { scanExemple } from '@/components/demo/scan-exemple.js';", resolveDir: racine, loader: 'js' },
    absWorkingDir: racine, bundle: true, format: 'esm', platform: 'browser', write: false, alias: { '@': racine }, logLevel: 'silent' });
  const noms = ['window', 'location', 'sessionStorage'], anciens = noms.map(k => Object.getOwnPropertyDescriptor(globalThis, k)), stock = new Map();
  for (const k of noms) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k === 'location' ? { pathname: '/fr/demo/nouveau', origin: 'https://demo.example' }
    : k === 'sessionStorage' ? { getItem: c => stock.get(c) || null, setItem: (c, v) => stock.set(c, v), removeItem: c => stock.delete(c) } : {} });
  t.after(() => noms.forEach((k, i) => { if (anciens[i]) Object.defineProperty(globalThis, k, anciens[i]); else delete globalThis[k]; }));
  t.mock.method(globalThis, 'fetch', async url => (url === '/styles-visuels.json' ? Response.json({}) : Response.json({ produits: PRODUITS, libelles: {} })));
  const { api, scanExemple } = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));

  const pr = (await api('/api/projets', { method: 'POST', corps: { nom: 'Appartement' } })).projet;
  const pc = (await api(`/api/projets/${pr.id}/pieces`, { method: 'POST', corps: { nom: 'Salon', fonction: 'salon' } })).piece;
  const sc = await api(`/api/pieces/${pc.id}/scan`, { method: 'POST', corps: { scan: scanExemple() } });
  assert.ok(sc.ok, sc.erreur);
  assert.equal(sc.piece.agencement.filter(it => it.origine === 'existant').length, 14, 'murs, ouvertures et meubles du relevé lus');
  assert.ok((await api(`/api/projets/${pr.id}/parcours`, { method: 'POST', corps: { action: 'valider', piece: pc.id } })).ok);
  const lu = await api(`/api/projets/${pr.id}/parcours`);
  const etat = { ...lu.etat, etape: 'proposition', pieces: [pc.id], usages: { [pc.id]: { espaces: ['cuisine', 'repas'], placesRepas: 4, envies: '', confirme: true, budget: 1500 } },
    choix: { [pc.id]: 'tout' }, selection: { [pc.id]: {} }, photosPassees: { [pc.id]: true },
    preferences: { ...lu.etat.preferences, styles: ['japandi'], style: 'Japandi', foyer: { adultes: 2, enfants: 0, chien: false, chat: false, recevoir: 'parfois' }, priorites: ['circulation'], confirme: true } };
  const enregistre = await api(`/api/projets/${pr.id}/parcours`, { method: 'PUT', corps: { etat, revision: lu.revision } });
  assert.ok(enregistre.ok, enregistre.erreur);
  const c = await api(`/api/projets/${pr.id}/parcours`, { method: 'POST', corps: { action: 'contraintes', piece: pc.id } });
  const avec = c.pieces.find(q => q.id === pc.id);
  const r = await api(`/api/pieces/${pc.id}/variantes`, { method: 'POST', corps: demandeProposition(enregistre.etat, avec, 'fr') });
  assert.ok(r.ok, `proposition refusée : ${r.erreur}`);
  const nouveaux = r.piece.agencement.filter(it => it.origine === 'catalogue' && it.garde !== false);
  assert.ok(nouveaux.length >= 6, `${nouveaux.length} meubles proposés`);
  assert.ok(nouveaux.reduce((s, it) => s + (PRODUITS[it.sku]?.prix || 0), 0) <= 1500, 'budget tenu');
  const cuisine = it => it.origine === 'existant' && it.p?.fam === 'cuisine';
  const places = liste => Object.fromEntries(liste.filter(cuisine).map(it => [it.id, [it.x, it.z]]));
  assert.equal(Object.keys(places(avec.agencement)).length, 4);
  assert.deepEqual(places(r.piece.agencement), places(avec.agencement), 'la cuisine reste à sa place');
});

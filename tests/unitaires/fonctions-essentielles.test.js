import test from 'node:test';
import assert from 'node:assert/strict';
import { preparerAmenagement, appliquerProposition } from '../../lib/amenagement.js';
import { choisirCandidats } from '../../lib/selection.js';
import { programmeComposition } from '../../lib/programme.js';
import { PRODUITS } from '../../lib/catalogue.js';
import { verifier } from '../../lib/agencement.js';
import { verifierHauteurs } from '../../lib/hauteurs.js';
import { posesStaging } from '../../lib/staging.js';
import { rectangle, chambres } from '../fixtures/bench-chambres.js';
import { completerHauteurs } from '../../lib/finition.js';

function amenager(modele, fonction, choix) {
  const avant = structuredClone(modele), catalogue = JSON.stringify(PRODUITS);
  const prep = preparerAmenagement([], { encyclopedie: true, ...choix });
  const candidats = choisirCandidats(PRODUITS, { modele, fonction, ...prep });
  const r = appliquerProposition({ modele, fonction, prep, candidats, produits: PRODUITS,
    proposition: { meubles: [], planVie: [], retirer: [], conseils: [] } });
  assert.deepEqual(modele, avant, 'le mobilier doit s’adapter à la pièce relevée');
  assert.equal(JSON.stringify(PRODUITS), catalogue, 'les cotes et les prix du catalogue restent intacts');
  const actifs = r.agencement.filter(it => it.garde !== false);
  const tous = [...actifs, ...posesStaging(actifs, r.proposition.staging, PRODUITS)];
  const cout = actifs.reduce((s, it) => s + (PRODUITS[it.sku]?.prix || 0), 0);
  if (choix.budget) assert.ok(cout <= choix.budget + .001, 'aucune reprise ne peut dépasser le budget');
  return { ...r, actifs, tous, cout };
}

for (const referencesSpatiales of [false, true]) {
  test(`chambre 16 m² : lit, chevets, rangement et TV demandée ; SSR ${referencesSpatiales}`, () => {
    const modele = rectangle(4, 4);
    const r = amenager(modele, 'chambre', { envies: 'Chambre épurée, télévision et rangement', referencesSpatiales });
    const lit = r.actifs.find(it => it.usageProgramme === 'lit');
    assert.ok(lit, 'ne pas abandonner le couchage après l’échec du premier modèle');
    assert.ok(r.actifs.some(it => it.usageProgramme === 'armoire'));
    if (!PRODUITS[lit.sku].chevets) assert.equal(r.actifs.filter(it => it.usageProgramme === 'chevet').length, 2);
    const tv = r.tous.find(it => it.usageProgramme === 'television');
    assert.ok(tv); assert.equal(tv.attach_to.type, 'wall');
    assert.equal(r.proposition.programme.complet, true);
    assert.equal(r.proposition.planZones.statut, 'compose');
    assert.equal(r.proposition.planZones.audit.valide, true);
    assert.equal(r.proposition.confort.score.contraintes, 0);
    assert.equal(r.proposition.confort.acces, true);
    assert.deepEqual(verifier(modele, r.actifs, PRODUITS), []);
    assert.deepEqual(verifierHauteurs(modele, [...r.actifs, tv], PRODUITS), []);
  });

  test(`salon 30 m², 1 200 € : conserver canapé, TV et repas à quatre ; SSR ${referencesSpatiales}`, () => {
    const modele = rectangle(6, 5);
    const r = amenager(modele, 'salon', { envies: 'Salon épuré avec télévision et repas', espaces: ['repas'], placesRepas: 4, budget: 1200, referencesSpatiales });
    assert.ok(r.actifs.some(it => it.usageProgramme === 'canape'));
    assert.equal(r.actifs.filter(it => it.usageProgramme === 'table-repas').length, 1);
    assert.equal(r.actifs.filter(it => it.usageProgramme === 'chaise-repas').length, 4);
    const tv = r.tous.find(it => it.usageProgramme === 'television');
    assert.ok(tv, 'réserver le support TV avant d’y poser une lampe');
    assert.ok(r.actifs.some(it => it.id === tv.attach_to.id && it.usageProgramme === 'meuble-tv'));
    assert.deepEqual(verifier(modele, r.actifs, PRODUITS), []);
    assert.deepEqual(verifierHauteurs(modele, [...r.actifs, tv], PRODUITS), []);
    assert.equal(r.proposition.confort.acces, true);
    assert.equal(r.proposition.confort.circulation, true);
    const incomplet = r.proposition.programme.manquants.some(s => s.obligatoire && !s.substitut);
    assert.equal(r.proposition.programme.complet, !incomplet);
    assert.equal(r.proposition.planZones.audit.valide, !incomplet);
    assert.equal(r.proposition.planZones.statut, incomplet ? 'a-completer' : 'compose');
    if (incomplet) assert.equal(r.proposition.confort.score.incomplet, true);
  });
}

test('TV de chambre : demande explicite, refus et mode de pose sont respectés', () => {
  for (const [envies, pose] of [['Chambre épurée', null], ['Chambre sans télévision', null], ['Bedroom without TV', null],
    ['Chambre avec télévision', 'mur'], ['Chambre avec télévision sur meuble', 'meuble']]) {
    const p = programmeComposition({ modele: rectangle(4, 4), fonction: 'chambre', envies, encyclopedie: true });
    const tv = p.zones.flatMap(z => z.slots).find(s => s.usage === 'television');
    assert.equal(tv?.pose ?? null, pose, envies);
    assert.equal(p.zones.flatMap(z => z.slots).some(s => s.usage === 'meuble-tv'), pose === 'meuble', envies);
  }
  const modele = rectangle(4, 4);
  const r = amenager(modele, 'chambre', { envies: 'Chambre épurée avec télévision sur meuble et rangement', referencesSpatiales: true });
  const tv = r.tous.find(it => it.usageProgramme === 'television');
  assert.ok(tv); assert.equal(tv.attach_to.type, 'furniture');
  assert.ok(r.actifs.some(it => it.id === tv.attach_to.id && it.usageProgramme === 'meuble-tv'));
  assert.equal(r.proposition.programme.complet, true);
  assert.deepEqual(verifierHauteurs(modele, [...r.actifs, tv], PRODUITS), []);
});

test('un budget insuffisant reste signalé : des passages libres ne valident pas un salon sans canapé', () => {
  const r = amenager(rectangle(6, 5), 'salon', { envies: 'Salon épuré avec télévision et repas', espaces: ['repas'], budget: 150, referencesSpatiales: false });
  assert.equal(r.proposition.programme.complet, false);
  assert.equal(r.proposition.confort.score.incomplet, true);
  assert.notEqual(r.proposition.planZones.statut, 'compose');
  assert.notEqual(r.proposition.planZones.audit?.valide, true);
  assert.ok(r.proposition.programme.manquants.some(s => s.usage === 'canape'));
});

for (const index of [0,2,7]) test(`la chambre ${chambres()[index].nom} conserve le couchage, le rangement et la TV`, () => {
  const modele = chambres()[index].modele;
  const r = amenager(modele, 'chambre', { envies:'Chambre épurée, télévision et rangement', referencesSpatiales:true });
  assert.ok(r.actifs.some(it=>it.usageProgramme==='lit'));
  assert.ok(r.actifs.some(it=>it.usageProgramme==='armoire'));
  assert.ok(r.tous.some(it=>it.usageProgramme==='television'));
  assert.equal(r.proposition.programme.complet,true);
  assert.equal(r.proposition.planZones.audit.valide,true);
  assert.deepEqual(verifier(modele,r.actifs,PRODUITS),[]);
  assert.deepEqual(verifierHauteurs(modele,[...r.actifs,...r.tous.filter(it=>it.usageProgramme==='television'&&!r.actifs.includes(it))],PRODUITS),[]);
});

test('25 m² : un repas à quatre tient avec le salon et une suspension adaptée', () => {
  const modele=rectangle(5,5);
  const r=amenager(modele,'salon',{envies:'Salon épuré avec télévision et repas',espaces:['repas'],placesRepas:4,budget:9000,referencesSpatiales:true});
  assert.ok(r.actifs.some(it=>it.usageProgramme==='canape'));
  assert.equal(r.actifs.filter(it=>it.usageProgramme==='chaise-repas').length,4);
  assert.ok(r.actifs.some(it=>it.usageProgramme==='suspension'));
  assert.equal(r.proposition.programme.complet,true);
  assert.equal(r.proposition.planZones.audit.valide,true);
  assert.deepEqual(verifier(modele,r.actifs,PRODUITS),[]);
});

test('une suspension trop haute est remplacée par une alternative éligible sans déplacer la table', () => {
  const catalogue={table:{id:'table',fam:'table',dim:[1,.7,.75],prix:220},longue:{id:'longue',fam:'suspension',dim:[.4,.4,.8],prix:100},courte:{id:'courte',fam:'suspension',dim:[.3,.3,.3],prix:65},horsBudget:{id:'horsBudget',fam:'suspension',dim:[.2,.2,.2],prix:200}};
  const modele=rectangle(4,4);modele.dims.hauteur=2.3;
  const table={id:'table',sku:'table',x:0,z:0,rot:0,zoneId:'repas',usageProgramme:'table-repas'};
  const detail={id:'lumiere',sku:'longue',x:0,z:0,zoneId:'repas',slotProgramme:'repas:suspension:1',usageProgramme:'suspension'};
  const avant=structuredClone(table);
  const r=completerHauteurs(modele,[table],[detail],catalogue,{programme:{encyclopedie:true},budget:320,candidats:{suspension:[catalogue.longue,catalogue.courte,catalogue.horsBudget]},emplacements:[{programme:{id:detail.slotProgramme,usage:'suspension',fonction:'salon'}}]});
  assert.deepEqual(table,avant);
  assert.equal(r.items.find(it=>it.id==='lumiere').sku,'courte');
  assert.equal(r.items.find(it=>it.id==='lumiere').attach_to.id,'table');
  assert.equal(r.diagnostic.substitutions.length,1);
  assert.deepEqual(verifierHauteurs(modele,r.items,catalogue),[]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { executerAssistant } from '../../lib/assistant-amenagement.js';
import { PRODUITS } from '../../lib/catalogue.js';
import { rectangle } from '../fixtures/bench-chambres.js';
import { ancresDisposition, dispositionsDistinctes, etatVariantes, signatureAgencement } from '../../lib/variation-disposition.js';
import { verifier } from '../../lib/agencement.js';
import { verifierHauteurs } from '../../lib/hauteurs.js';
import { posesStaging } from '../../lib/staging.js';

test('assistant puis Shuffle : trois salons complets distincts, sans réseau, retour exact et état sérialisable', t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Aucun appel externe autorisé'); });
  let piece = { fonction:'salon', modele:rectangle(5,5), agencement:[] };
  const modele = structuredClone(piece.modele), catalogue = JSON.stringify(PRODUITS), propositions = [];
  const brief = { action:'generer', envies:'Salon épuré avec télévision et repas', espaces:['repas'], placesRepas:4, budget:9000, encyclopedie:true };
  for (let i = 0; i < 3; i++) {
    const r = executerAssistant(piece, i ? { action:'shuffle', session:piece.proposition.variantes.session } : brief, PRODUITS);
    assert.equal(r.assistant.message,'proposition');
    assert.equal(r.proposition.programme.complet,true);
    assert.equal(r.proposition.planZones.audit.valide,true);
    assert.equal(r.agencement.filter(it=>it.usageProgramme==='chaise-repas').length,4);
    assert.ok(r.agencement.some(it=>it.usageProgramme==='canape'));
    assert.ok(r.proposition.staging.items.some(it=>it.usageProgramme==='television'));
    assert.deepEqual(verifier(modele,r.agencement,PRODUITS),[]);
    const tv=posesStaging(r.agencement,r.proposition.staging,PRODUITS).filter(it=>it.usageProgramme==='television');
    assert.deepEqual(verifierHauteurs(modele,[...r.agencement,...tv],PRODUITS),[]);
    assert.ok(r.agencement.reduce((s,it)=>s+(PRODUITS[it.sku]?.prix||0),0)<=brief.budget);
    const ancres=ancresDisposition(r.agencement);
    assert.ok(propositions.every(p=>dispositionsDistinctes(ancres,ancresDisposition(p.agencement))));
    propositions.push(JSON.parse(JSON.stringify(r)));
    piece=JSON.parse(JSON.stringify({...piece,agencement:r.agencement,proposition:r.proposition}));
    assert.equal(etatVariantes(piece).obsolete,false);
    assert.ok(piece.proposition.variantes.liste.every(v=>!v.proposition.variantes),'pas d’historique récursif');
  }
  const retour=executerAssistant(piece,{action:'choisir',id:'v0',session:piece.proposition.variantes.session},PRODUITS);
  assert.deepEqual(retour.agencement,propositions[0].agencement);
  assert.deepEqual(retour.proposition.staging,propositions[0].proposition.staging);
  assert.equal(retour.proposition.variantes.liste.length,3);
  assert.deepEqual(piece.modele,modele);
  assert.equal(JSON.stringify(PRODUITS),catalogue);
  const modifiee=structuredClone(piece);modifiee.agencement[0].x+=.3;
  assert.throws(()=>executerAssistant(modifiee,{action:'shuffle'},PRODUITS),{code:'assistant-obsolete'});
  const contour=structuredClone(piece);contour.modele.murs.entree.ouvertures[0].largeur+=.1;
  assert.throws(()=>executerAssistant(contour,{action:'choisir',id:'v0'},PRODUITS),{code:'assistant-obsolete'});
  assert.throws(()=>executerAssistant(piece,{action:'shuffle',session:'ancienne-session'},PRODUITS),{code:'assistant-obsolete'});
  assert.throws(()=>executerAssistant(piece,{action:'choisir',id:'inconnu'},PRODUITS),{code:'assistant-variante'});
});

test('un lit verrouillé reste identique pendant la génération et Shuffle', () => {
  const lit={id:'mon-lit',origine:'existant',x:-1.45,z:0,rot:Math.PI/2,garde:true,p:{nom:'Lit conservé',fam:'lit',dim:[1.6,2.06,.95],cols:['#bbaa99'],mat:'bois'}};
  let piece={fonction:'chambre',modele:rectangle(5,5),agencement:[lit]};
  const r=executerAssistant(piece,{action:'generer',envies:'Chambre épurée avec rangement',garder:[lit.id],encyclopedie:true,budget:1800},PRODUITS);
  assert.equal(r.proposition.programme.complet,true);
  assert.deepEqual(r.agencement.find(it=>it.id===lit.id),{...r.agencement.find(it=>it.id===lit.id),x:lit.x,z:lit.z,rot:lit.rot,p:lit.p});
  piece={...piece,agencement:r.agencement,proposition:r.proposition};
  const suite=executerAssistant(piece,{action:'shuffle'},PRODUITS);
  assert.deepEqual(suite.agencement.find(it=>it.id===lit.id),r.agencement.find(it=>it.id===lit.id));
  assert.equal(suite.proposition.programme.complet,true);
  assert.equal(suite.proposition.planZones.audit.valide,true);
});

test('un budget sans achat possible ne devient pas un programme complet après Shuffle', () => {
  let piece={fonction:'chambre',modele:rectangle(3,3),agencement:[]};
  const r=executerAssistant(piece,{action:'generer',envies:'Chambre épurée sans télévision',budget:1,encyclopedie:true},PRODUITS);
  assert.equal(r.proposition.programme.complet,false);
  piece={...piece,agencement:r.agencement,proposition:r.proposition};
  const suite=executerAssistant(piece,{action:'shuffle'},PRODUITS);
  assert.equal(suite.assistant.message,'aucune-autre-variante');
  assert.deepEqual(suite.agencement,r.agencement);
  assert.deepEqual(suite.proposition.staging,r.proposition.staging);
  assert.equal(suite.proposition.variantes.selection,'v0');
});

test('la diversité ignore de petits déplacements et une table retournée de 180 degrés', () => {
  const a=[{zone:'repas',usage:'table-repas',x:0,z:0,rot:0}];
  assert.equal(dispositionsDistinctes(a,[{...a[0],x:.1,rot:Math.PI}]),false);
  assert.equal(dispositionsDistinctes(a,[{...a[0],x:1}]),true);
  assert.equal(dispositionsDistinctes(a,[{...a[0],rot:Math.PI/2}]),true);
  assert.equal(dispositionsDistinctes(a,[]),false);
  const item={id:'a',origine:'catalogue',sku:'x',x:0,z:0,rot:0};
  assert.equal(signatureAgencement([item]),signatureAgencement([{...item,raison:'Autre commentaire',fixe:true}]));
  for(const usage of ['console','vasque','baignoire-ilot'])assert.equal(ancresDisposition([{...item,usageProgramme:usage}]).length,1);
});

test('une fonction non couverte est refusée sans créer une fausse proposition vide', () => {
  for(const fonction of ['cuisine','chambre_enfant','autre']){
    const piece={fonction,modele:rectangle(4,4),agencement:[]},avant=structuredClone(piece);
    assert.throws(()=>executerAssistant(piece,{action:'generer'},PRODUITS),{code:'assistant-fonction'});
    assert.deepEqual(piece,avant);
  }
});

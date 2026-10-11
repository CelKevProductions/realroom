import {test} from 'node:test';
import assert from 'node:assert/strict';
import {choisirCandidats} from '../../lib/selection.js';
import {simulerAmenagement} from '../../lib/simulation.js';
const dims={largeur:4,profondeur:5,hauteur:2.6};

test('les modèles compacts restent disponibles malgré un classement dominé par de grands meubles',()=>{
  const produits=Object.fromEntries(Array.from({length:12},(_,i)=>['f'+i,{id:'f'+i,nom:'Fauteuil beige',fam:'fauteuil',dim:[1.2,1.2,.8],prix:100+i,st:'style'+i,look:{}}]));
  produits.petit={id:'petit',nom:'Fauteuil compact',fam:'fauteuil',dim:[.55,.55,.7],prix:900};
  const copie=structuredClone(produits);
  for(const budget of [0,2000]){
    const c=choisirCandidats(produits,{dims,fonction:'salon',parFamille:3,budget});
    assert.equal(c.fauteuil.length,3);
    assert.ok(c.fauteuil.some(p=>p.id==='petit'));
    if(budget)assert.ok(c.fauteuil.some(p=>p.id==='f0'),'l’alternative la moins chère reste disponible');
  }
  assert.deepEqual(produits,copie);
});

test('la démo propose les accompagnements disponibles et respecte les chevets intégrés',()=>{
  const lit={id:'lit',fam:'lit',nom:'Lit',dim:[1.6,2.1,1],prix:500,chevets:false};
  const chevet={id:'chevet',fam:'table',nom:'Table de chevet',dim:[.4,.4,.5],prix:80};
  const rangement={id:'rangement',fam:'meuble',nom:'Rangement',dim:[.8,.4,1],prix:200};
  const candidats={lit:[lit],table:[chevet],meuble:[rangement]};
  const calcul=()=>simulerAmenagement({piece:{dimensions:dims,meubles:[]},mode:'tout',candidats,langue:'fr',demo:true}).proposition;
  assert.equal(calcul().meubles.filter(m=>m.produit==='chevet').length,2);
  assert.ok(calcul().meubles.some(m=>m.produit==='rangement'));
  lit.chevets=true;
  assert.equal(calcul().meubles.filter(m=>m.produit==='chevet').length,0);
});

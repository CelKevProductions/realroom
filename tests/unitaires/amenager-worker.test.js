import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {depuisScan} from '../../lib/scan.js';
import {scanAndroid} from '../fixtures/scans.js';

test('le worker reçoit un relevé et renvoie une proposition sans changer les dimensions des produits', {timeout:10000}, async()=>{
  // Adapter uniquement le transport self du navigateur au vrai thread Node.
  const entree=new URL('../../moteur/amenager-worker.js',import.meta.url).href;
  const worker=new Worker(`import {parentPort} from 'node:worker_threads';
    globalThis.self={addEventListener:(nom,fn)=>parentPort.on(nom,data=>fn({data})),postMessage:resultat=>parentPort.postMessage(resultat)};
    await import(${JSON.stringify(entree)});`,{eval:true,type:'module'});
  try{
    const {modele}=depuisScan(scanAndroid());
    const produits={lit:{id:'lit',nom:'Lit',fam:'lit',dim:[1.6,2.1,1],prix:500}};
    const copie=structuredClone(produits);
    const reponse=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
    worker.postMessage({piece:{modele,agencement:[],fonction:'chambre'},choix:{mode:'tout',budget:600,moteurGuide:false},produits,langue:'fr'});
    const r=await reponse;
    assert.equal(r.ok,true);
    assert.ok(r.resultat.agencement.some(it=>it.sku==='lit'&&it.garde!==false));
    assert.equal(r.resultat.proposition.budget,600);
    assert.deepEqual(produits,copie);
  }finally{await worker.terminate();}
});

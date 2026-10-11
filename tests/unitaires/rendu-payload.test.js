import { test } from 'node:test';
import assert from 'node:assert/strict';
// Le fournisseur est remplacé par un double local : aucun appel externe ni clé réelle.
process.env.REALROOM_SIMULATION='0';
process.env.FAL_KEY='cle-locale-fictive';
process.env.FAL_MODELE='fal-ai/nano-banana-pro/edit';
const {consigneRendu,soumettreRendu}=await import('../../lib/generation.js');
const modele={dims:{largeur:4,profondeur:5,hauteur:2.5}};
const produits={table:{nom:'Table Nordic',fam:'table',dim:[.4,.4,.48],img:'produit.jpg'}};
const items=[{origine:'catalogue',sku:'table',x:0,z:0}];
const base={piece:{fonction:'chambre'},modele,produits,items,mode:'tout',angle:'libre',nbProduits:1};

test('les objets génériques sont décrits depuis la maquette sans inventer de photo commerciale',()=>{
  const p={nom:'Table générique',fam:'table',generique:true,dim:[.8,.8,.4],mat:'chêne',img:null};
  const prompt=consigneRendu({...base,produits:{table:p},sansPhoto:true});
  assert.match(prompt,/Generic planning object.*Table générique/);assert.match(prompt,/80 × 80 × 40 cm/);
  assert.match(prompt,/no commercial product reference photo/);assert.doesNotMatch(prompt,/- Image 2:/);
});

test('la consigne suit la caméra choisie, les indices d’images et la lumière',()=>{
  const jour=consigneRendu({...base,nbAutres:3});
  assert.match(jour,/Image 2 defines/);assert.match(jour,/Images 3–5/);assert.match(jour,/- Image 6:.*Table Nordic/);
  assert.match(jour,/Daytime photograph/);
  assert.doesNotMatch(jour,/near the camera|at the back of the room/);
  const nuit=consigneRendu({...base,nbAutres:3,sansPhoto:true,ambiance:'nuit'});
  assert.match(nuit,/Image 1 defines/);assert.match(nuit,/Images 2–4/);assert.match(nuit,/- Image 5:/);
  assert.match(nuit,/Night photograph/);assert.match(nuit,/Do not add fixtures or windows/);
});

test('le payload Fal garde la référence, la capture et les autres angles dans cet ordre, avec une seule sortie',async t=>{
  const appels=[];
  t.mock.method(globalThis,'fetch',async(url,opts)=>{appels.push({url,corps:JSON.parse(opts.body)});return {ok:true,json:async()=>({request_id:'00000000-0000-0000-0000-000000000001'})};});
  await soumettreRendu({photo:'reelle',capture:'vue-3d',autresPhotos:['coin-1','coin-2','coin-3'],produitsImages:['p1','p2'],consigne:'test'});
  assert.deepEqual(appels[0].corps.image_urls,['reelle','vue-3d','coin-1','coin-2','coin-3','p1','p2']);
  assert.equal(appels[0].corps.num_images,1);assert.equal(appels[0].corps.limit_generations,true);
  assert.equal(appels[0].url,'https://queue.fal.run/fal-ai/nano-banana-pro/edit');
  await soumettreRendu({photo:null,capture:'vue-nuit',autresPhotos:['coin-1'],produitsImages:Array.from({length:20},(_,i)=>'p'+i),consigne:'test'});
  assert.equal(appels[1].corps.image_urls[0],'vue-nuit');assert.equal(appels[1].corps.image_urls.length,10);
});

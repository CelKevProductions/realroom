import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSITIONS_PHOTO, vuePourPosition, validerVue } from '../../lib/cadrages.js';
import { contientPoint, lettreMur } from '../../lib/contour.js';
import { optionsRendu } from '../../lib/rendu-options.js';
import { placePhoto, photosPiece } from '../../lib/references.js';
import { appareilCapture } from '../../lib/appareils.js';

const modele = { dims: { largeur: 4.05, profondeur: 3.02, hauteur: 2.6 } };
const piece = { modele, photos: ['entree','fond','gauche','droite','rendu'].map(role => ({ role, url: '/'+role+'.jpg' })) };
const vue = vuePourPosition(modele, 'fond-gauche');
const libre = { angle: 'libre', vue, photoRole: 'rendu', ambiance: 'nuit' };

test('huit positions photo restent dans la pièce, y compris en L', () => {
  const enL = { dims: { largeur: 4, profondeur: 4, hauteur: 2.6 }, contour: [[-2,-2],[2,-2],[2,0],[0,0],[0,2],[-2,2]] };
  for (const m of [modele, enL]) for (const position of POSITIONS_PHOTO) {
    const v = vuePourPosition(m, position);
    assert.ok(contientPoint(m, v.x, v.z, .025));
    assert.deepEqual(validerVue(m, v), v);
  }
  assert.equal(new Set(POSITIONS_PHOTO.map(p => JSON.stringify(vuePourPosition(modele, p)))).size, 8);
});

test('la caméra du rendu garde ses cotes exactes et sa direction libre', () => {
  const v = {...vue, x:-1.602, cz:1.2324, fov:67.1};
  const r = optionsRendu(piece, {...libre, vue:v});
  assert.deepEqual(r.vue, v);
  assert.equal(r.photo.role, 'rendu');
  assert.equal(r.ambiance, 'nuit');
  assert.equal(r.autres.length, 3);
  assert.equal(r.imagesProduitsMax + r.autres.length + 2, 10);
});

test('une caméra invalide ou située hors du polygone est refusée', () => {
  const enL = {...piece, modele:{dims:{largeur:4,profondeur:4,hauteur:2.6},contour:[[-2,-2],[2,-2],[2,0],[0,0],[0,2],[-2,2]]}};
  for (const v of [{...vue,x:9}, {...vue,y:0}, {...vue,fov:180}, {...vue,z:NaN}, {...vue,x:'1'}, {...vue,cx:vue.x,cy:vue.y,cz:vue.z}])
    assert.throws(() => optionsRendu(piece, {...libre,vue:v}), e => e.code==='vue');
  assert.throws(() => optionsRendu(enL,{...libre,vue:{...vue,x:1,z:1}}), e=>e.code==='vue');
  assert.throws(() => optionsRendu(piece,{angle:'libre',sansPhoto:true}), e=>e.code==='vue');
});

test('continuer sans photo exige un choix explicite et booléen', () => {
  const vide = {...piece,photos:[]};
  assert.throws(() => optionsRendu(vide, libre), e=>e.code==='photo-entree');
  assert.throws(() => optionsRendu(vide, {...libre,sansPhoto:'true'}), e=>e.code==='photo-reference');
  const r = optionsRendu(piece, {...libre,sansPhoto:true});
  assert.equal(r.photo, null);
  assert.equal(r.sansPhoto, true);
  assert.equal(r.imagesProduitsMax+r.autres.length+1,10);
  assert.throws(() => optionsRendu(piece,{...libre,ambiance:'crepuscule'}), e=>e.code==='ambiance');
  assert.throws(() => optionsRendu(piece,{...libre,photoRole:'inspiration'}), e=>e.code==='photo-reference');
});

test('les anciennes demandes depuis les quatre photos restent compatibles', () => {
  for (const angle of ['entree','fond','gauche','droite']) {
    const r = optionsRendu(piece,{angle});
    assert.equal(r.photo.role,angle); assert.equal(r.ambiance,'jour');
    assert.equal(r.autres.length,3);
  }
});

test('la photo de rendu a sa place indépendante et ne devient pas une photo de relevé', () => {
  const limites={photosParPiece:8,inspirationsParPiece:3};
  const pleines=[...Array.from({length:8},()=>({role:'detail'})),...Array.from({length:3},()=>({role:'inspiration'}))];
  assert.equal(placePhoto(pleines,'detail',limites).possible,false);
  assert.equal(placePhoto(pleines,'rendu',limites).possible,true);
  const avec=[...pleines,{role:'rendu'}];
  assert.equal(placePhoto(avec,'rendu',limites).remplace,11);
  assert.equal(photosPiece(avec).length,8);
});

test('le parcours téléphone distingue Android, iPhone et iPad sans inventer un modèle LiDAR', () => {
  assert.equal(appareilCapture({userAgent:'Mozilla/5.0 (Linux; Android 15) Chrome/130'}),'android');
  assert.equal(appareilCapture({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari'}),'apple');
  assert.equal(appareilCapture({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}),'apple');
  assert.equal(appareilCapture({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0}),'ordinateur');
  assert.equal(lettreMur(0),'A');assert.equal(lettreMur(3),'D');assert.equal(lettreMur(26),'AA');assert.equal(lettreMur(31),'AF');
});

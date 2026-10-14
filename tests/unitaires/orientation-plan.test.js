import test from 'node:test';
import assert from 'node:assert/strict';
import { retournerPiece, corrigerPiece } from '../../lib/geometrie.js';
import { segmentsDe, pointOuverture, aireSignee } from '../../lib/contour.js';
import { depuisScan, VERSION_SCAN } from '../../lib/scan.js';
import { lireDXF, exporterDXF } from '../../lib/plans.js';

const proche=(a,b)=>assert.ok(Math.abs(a-b)<.011,`${a} ≠ ${b}`);
const modele=()=>({dims:{largeur:6,profondeur:5,hauteur:2.6,estimees:true},
  murs:{fond:{observe:true,couleur:'#AAAAAA',ouvertures:[{type:'fenetre',position:1.2,largeur:1.1,allege:.9,hauteur:1.2,confiance:.5}]},
    entree:{observe:false,ouvertures:[]},gauche:{observe:null,ouvertures:[{type:'porte',position:-.7,largeur:.9,hauteur:2.04,allege:0}]},droite:{observe:false,ouvertures:[]}},
  vue:{x:1.1,z:1.8,cx:-.7,cz:-1.4,y:1.5,fov:48}});
const meubles=()=>[{id:'support',origine:'existant',x:.8,z:.6,rot:.4,p:{fam:'meuble',dim:[1.4,.5,.6]}},
  {id:'tv',origine:'existant',x:.9,z:.65,rot:.4,y:.6,attach_to:{type:'furniture',id:'support'},p:{fam:'tv',dim:[1,.12,.7]}}];
const scan=()=>({version:VERSION_SCAN,source:'plan-dxf',unit:'m',floorCorners:[[0,0,0],[6,0,0],[6,0,2],[2,0,2],[2,0,5],[0,0,5]],ceilingHeight:2.6,
  openings:[{type:'porte',a:[.5,0],b:[1.4,0]},{type:'fenetre',a:[2,3],b:[2,4.2]}]});

for (const axes of [{x:true},{z:true},{x:true,z:true}]) test(`symétrie ${JSON.stringify(axes)} : contours, ouvertures, caméra et mobilier suivent sans mutation`,()=>{
  for (const m of [modele(),depuisScan(scan()).modele]) {
    const its=meubles(),copie=structuredClone({m,its}),r=retournerPiece(m,its,axes),sx=axes.x?-1:1,sz=axes.z?-1:1;
    assert.deepEqual({m,its},copie);assert.deepEqual(r.modele.dims,m.dims);
    if (m.contour) {proche(Math.abs(aireSignee(r.modele.contour)),Math.abs(aireSignee(m.contour)));assert.deepEqual(r.modele.contour,m.contour.map(([x,z])=>[sx*x,sz*z]));}
    for (const pan of segmentsDe(m)) {
      const id=r.correspondanceMurs[pan.id],nouveau=segmentsDe(r.modele).find(p=>p.id===id);
      assert.equal(r.modele.murs[id].observe,m.murs[pan.id].observe);
      for (const [i,o] of m.murs[pan.id].ouvertures.entries()) {
        const avant=pointOuverture(pan,o.position),apres=pointOuverture(nouveau,r.modele.murs[id].ouvertures[i].position);
        proche(apres[0],sx*avant[0]);proche(apres[1],sz*avant[1]);
        assert.equal(r.modele.murs[id].ouvertures[i].largeur,o.largeur);
      }
    }
    for (const [i,it] of its.entries()) {
      const n=r.agencement[i];assert.equal(n.x,sx*it.x);assert.equal(n.z,sz*it.z);
      proche(Math.sin(n.rot),sx*Math.sin(it.rot));proche(Math.cos(n.rot),sz*Math.cos(it.rot));
      assert.deepEqual(n.p.dim,it.p.dim);assert.equal(n.y,it.y);assert.deepEqual(n.attach_to,it.attach_to);
    }
    if(m.vue){assert.equal(r.modele.vue.z,sz*m.vue.z);assert.equal(r.modele.vue.cx,sx*m.vue.cx);assert.equal(r.modele.vue.fov,m.vue.fov);}
    const retour=retournerPiece(r.modele,r.agencement,axes);
    assert.deepEqual(retour.modele,m);retour.agencement.forEach((it,i)=>{proche(it.x,its[i].x);proche(it.z,its[i].z);proche(it.rot,its[i].rot);});
  }
});

test('attache murale : côté et décalage suivent le mur sans changer la hauteur',()=>{
  const it={id:'art',mur:'fond',attach_to:{type:'wall',id:'fond'},wall_offset:4,x:1,z:-2.48,rot:0,y:1.45,height:1.45};
  const r=retournerPiece(modele(),[it],{x:true,z:true}),n=r.agencement[0];
  assert.equal(n.mur,'entree');assert.deepEqual(n.attach_to,{type:'wall',id:'entree'});
  assert.equal(n.wall_offset,4);assert.equal(n.y,1.45);assert.equal(n.height,1.45);
  assert.equal(retournerPiece(modele(),[it],{x:true}).agencement[0].wall_offset,2);
});

test('correction complète : symétrie appliquée une fois, mesures et ajouts dans le repère affiché',()=>{
  const m=depuisScan(scan()).modele;
  const r=corrigerPiece(m,meubles(),{miroir:{z:true},contour:m.contour.map(([x,z])=>[x,-z]),
    ajouts:[{id:'m_ajout',fam:'lit',dim:[1.4,1.6,1],x:-2,z:0,rot:.3}]});
  assert.deepEqual(r.modele.contour,m.contour.map(([x,z])=>[x,-z]));
  assert.equal(r.agencement[0].z,-.6);assert.equal(r.agencement.find(it=>it.id==='m_ajout').x,-2);
  proche(r.agencement[1].z-r.agencement[0].z,-.05);
  for (const invalide of [null,[],true,{x:'oui'},{y:true}]) assert.throws(()=>corrigerPiece(m,[],{miroir:invalide}),/scan-repere/);
});

test('DXF asymétrique : +Y du dessin reste en haut, noms et ouvertures gardent leur côté',()=>{
  const ps=[[0,0],[6,0],[6,2],[2,2],[2,5],[0,5]];
  const entites=[0,'LWPOLYLINE',8,'FLOOR',90,ps.length,70,1,...ps.flatMap(([x,y])=>[10,x,20,y]),
    0,'LINE',8,'WINDOWS',10,2,20,3,11,2,21,4.2,
    0,'TEXT',8,'LABEL',10,1,20,4,1,'Pièce asymétrique'];
  const dxf=[0,'SECTION',2,'HEADER',9,'$INSUNITS',70,6,0,'ENDSEC',0,'SECTION',2,'ENTITIES',...entites,0,'ENDSEC',0,'EOF'].join('\n')+'\n';
  const p=lireDXF(dxf).pieces[0];assert.equal(p.nom,'Pièce asymétrique');
  // Le renfoncement reste en haut à droite, comme sur le dessin vu de dessus.
  assert.deepEqual(p.modele.contour,[[-3,2.5],[3,2.5],[3,.5],[-1,.5],[-1,-2.5],[-3,-2.5]]);
  const pan=segmentsDe(p.modele).find(s=>p.modele.murs[s.id].ouvertures.length),o=p.modele.murs[pan.id].ouvertures[0];
  assert.equal(o.type,'fenetre');proche(pointOuverture(pan,o.position)[1],-1.1);
  const retour=lireDXF(exporterDXF(p.scan)).pieces[0].modele;
  assert.deepEqual(retour.contour,p.modele.contour);
});

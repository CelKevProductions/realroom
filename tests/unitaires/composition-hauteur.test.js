import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBJETS_GENERIQUES } from '../../lib/catalogue-generique.js';
import { appliquerProposition, preparerAmenagement } from '../../lib/amenagement.js';
import { programmeComposition, TYPES_PROGRAMME } from '../../lib/programme.js';
import { completerHauteurs, evaluerFinition, deplacerAvecAttaches } from '../../lib/finition.js';
import { verifierHauteurs, attacheMur, intervalleHauteur } from '../../lib/hauteurs.js';
import { verifier, estMural, porteurDe } from '../../lib/agencement.js';
import { salonReference, catalogueZones } from '../fixtures/plan-zones.js';

const catalogue = { ...catalogueZones, ...OBJETS_GENERIQUES };
const poser = (modele = salonReference(), envies = 'Salon avec repas', budget = 5000, compositionDetails = true) => appliquerProposition({ modele, fonction: 'salon', produits: catalogue,
  prep: preparerAmenagement([], { envies, budget, compositionDetails }), proposition: { meubles: [] } });

test('salon achevé : écran face au canapé, éclairage, deux tableaux et passages intacts', () => {
  const modele = salonReference(), r = poser(modele), es = r.agencement.map(it => ({ it, p: catalogue[it.sku] }));
  const tv = es.find(e => e.it.usageProgramme === 'television'), sofa = es.find(e => e.it.usageProgramme === 'canape');
  assert.ok(tv && sofa); assert.equal(tv.p.fam, 'tv'); assert.ok(porteurDe(tv.it, tv.p, es));
  assert.ok(r.proposition.finition.regles.some(s => s.id === 'tv-face-canape' && s.points === 5));
  assert.ok(!r.proposition.finition.regles.some(s => s.id === 'tv-contre-jour'));
  assert.ok(r.proposition.finition.regles.some(s => s.id === 'focal-visible'));
  assert.ok(r.proposition.finition.tvDistance.rapportDiagonale >= 1.5 && r.proposition.finition.tvDistance.rapportDiagonale <= 3);
  assert.ok(r.agencement.some(it => it.usageProgramme === 'lumiere-salon'));
  assert.ok(r.proposition.finition.nombreMuraux >= 2 && r.proposition.finition.nombreMuraux <= 4);
  const art = es.find(e => e.it.usageProgramme === 'tableau-principal');
  assert.equal(art.it.kind, 'wall_item'); assert.ok(art.p.dim[0] >= sofa.p.dim[0] * .5 && art.p.dim[0] <= sofa.p.dim[0] * .7);
  assert.ok(Math.abs(art.it.y - 1.475) < .001); assert.equal(art.it.attach_to.type, 'wall');
  assert.deepEqual(verifier(modele, r.agencement, catalogue), []); assert.deepEqual(verifierHauteurs(modele, r.agencement, catalogue), []);
  assert.equal(r.proposition.planZones.audit.valide, true); assert.equal(r.proposition.confort.circulation, true);
  const suspension = es.find(e => e.it.usageProgramme === 'suspension'), table = es.find(e => e.it.usageProgramme === 'table-repas');
  assert.equal(suspension.it.kind, 'ceiling_item');
  assert.equal(suspension.it.x, table.it.x); assert.equal(suspension.it.z, table.it.z);
  assert.ok(Math.abs(intervalleHauteur(suspension.it, suspension.p, modele).bas - table.p.dim[2] - .725) < .001);
});

test('muraux : fenêtres, portes, superposition verticale et rangement haut sont refusés', () => {
  const modele = salonReference(), p = OBJETS_GENERIQUES['rr-gen-tableau-60'];
  const surPorte = attacheMur(modele, { id:'art', sku:p.id, x:-1.65, z:2, y:1.475 }, p, 'entree');
  assert.ok(verifierHauteurs(modele, [surPorte], catalogue).some(a => a.type === 'mur-porte'));
  const surFenetre = attacheMur(modele, { id:'art', sku:p.id, x:2.5, z:-.2, y:1.475 }, p, 'droite');
  assert.ok(verifierHauteurs(modele, [surFenetre], catalogue).some(a => a.type === 'mur-fenetre'));
  const a = attacheMur(modele, { id:'a', sku:p.id, x:0, z:-2, y:1.475 }, p, 'fond');
  assert.ok(verifierHauteurs(modele, [a, {...a,id:'b'}], catalogue).some(a => a.type === 'mur-collision'));
  const haut = { id:'arm',sku:'rr-gen-armoire-80',x:0,z:-1.71,rot:0 };
  assert.ok(verifierHauteurs(modele, [a,haut], catalogue).some(a => a.type === 'mur-masque'));
  assert.ok(verifierHauteurs(modele, [{...a,y:2.5}], catalogue).some(a => a.type === 'hauteur'));
});

test('les détails ajoutés ne déplacent pas le mobilier, même si aucun mur libre ne convient', () => {
  const modele = salonReference(), r = poser(modele), bases = r.agencement.filter(it => !estMural(catalogue[it.sku].fam) && it.kind !== 'ceiling_item');
  const details = r.agencement.filter(it => it.kind === 'wall_item');
  const plein = structuredClone(modele);
  for (const [mur, m] of Object.entries(plein.murs)) m.ouvertures = [{ type:'fenetre', position:0, largeur:['fond','entree'].includes(mur)?5:4, hauteur:2.6, allege:0 }];
  const result = completerHauteurs(plein, bases, details, catalogue);
  assert.equal(result.items.length, bases.length); assert.equal(result.diagnostic.manquants.length, details.length);
  for (const it of bases) { const n = result.items.find(q => q.id === it.id); assert.equal(n.x,it.x);assert.equal(n.z,it.z);assert.equal(n.rot,it.rot); }
});

test('un brief sans TV et le drapeau de repli n’ajoutent aucun écran', () => {
  for (const envies of ['Sans télévision, salon avec repas', 'Salon sans TV avec coin repas', 'Living room without TV']) {
    const p = programmeComposition({ modele:salonReference(), fonction:'salon', envies });
    assert.ok(!p.zones.flatMap(z=>z.slots).some(s=>s.usage==='television'));
    assert.equal(p.focal.usage,'tableau-principal');
    const r=poser(salonReference(),envies); assert.ok(!r.agencement.some(it=>['tv','tv-murale'].includes(catalogue[it.sku].fam)));
  }
  const r=poser(salonReference(),'Salon avec repas',5000,false);assert.equal(r.proposition.finition,undefined);
  assert.ok(!r.agencement.some(it=>catalogue[it.sku].fam==='tableau'||catalogue[it.sku].fam==='tv'));
});

test('chaque programme décrit son point focal ; budget et catalogue manquant restent explicites', () => {
  for (const fonction of TYPES_PROGRAMME) {
    const p=programmeComposition({modele:salonReference(),fonction});assert.ok(p.focal.usage,fonction);
    assert.ok(p.zones.length);
  }
  const r=poser(salonReference(),'Salon avec repas',400);
  assert.ok(r.agencement.reduce((s,it)=>s+catalogue[it.sku].prix,0)<=400);
  assert.ok(r.proposition.programme.manquants.some(s=>s.obligatoire));
  const trous=appliquerProposition({modele:salonReference(),fonction:'salon',produits:catalogueZones,prep:preparerAmenagement([],{budget:5000}),proposition:{meubles:[]}});
  assert.ok(trous.proposition.programme.manquants.some(s=>s.usage==='television'&&s.motif==='catalogue'));
});

test('les murs obliques gardent une attache et des contrôles métriques', () => {
  const modele={dims:{largeur:4,profondeur:4,hauteur:2.6},contour:[[-2,-2],[2,-1],[2,2],[-2,2]],murs:{}};
  const p=OBJETS_GENERIQUES['rr-gen-tableau-60'],pan='pan_1';
  const it=attacheMur(modele,{id:'art',sku:p.id,x:0,z:-1.5,y:1.475,rot:0},p,pan);
  assert.equal(it.mur,pan);assert.ok(Number.isFinite(it.wall_offset));assert.deepEqual(verifierHauteurs(modele,[it],catalogue),[]);
});

test('un écran mural ne se pose jamais sur une fenêtre et doit regarder le canapé', () => {
  const modele=salonReference(), bases=[{id:'sofa',sku:'canape',x:0,z:-1.58,rot:0,zoneId:'salon',usageProgramme:'canape'}];
  const detail={id:'ecran',sku:'rr-gen-television-murale-43',x:0,z:0,zoneId:'salon',usageProgramme:'television'};
  const r=completerHauteurs(modele,bases,[detail],catalogue);
  const tv=r.items.find(it=>it.id==='ecran');assert.ok(tv);assert.equal(tv.mur,'entree');assert.equal(tv.rot,Math.PI);
  assert.deepEqual(verifierHauteurs(modele,r.items,catalogue),[]);
  assert.ok(evaluerFinition(modele,r.items,catalogue).regles.some(s=>s.id==='tv-face-canape'));
});

test('la TV et la suspension suivent leur support après un déplacement manuel ou une rotation', () => {
  const modele=salonReference(), r=poser(modele);
  for (const usage of ['meuble-tv','table-repas']) {
    const parent=r.agencement.find(it=>it.usageProgramme===usage), enfant=r.agencement.find(it=>it.attach_to?.id===parent.id);
    assert.ok(enfant,usage);
    const change=deplacerAvecAttaches(modele,r.agencement,catalogue,{id:parent.id,x:parent.x+.2,z:parent.z+.1,rot:parent.rot+Math.PI/2,y:undefined,mur:undefined});
    const pose=change.find(it=>it.id===enfant.id);
    const dx=enfant.x-parent.x,dz=enfant.z-parent.z;
    assert.ok(Math.abs(pose.x-(parent.x+.2+dz))<.001);
    assert.ok(Math.abs(pose.z-(parent.z+.1-dx))<.001);
    assert.equal(pose.y,enfant.y); assert.equal(pose.attach_to.id,parent.id);
    assert.equal(change.find(it=>it.id===parent.id).y,parent.y);
  }
});

test('TV posée et suspension basse : un support réel et un volume libre sont nécessaires', () => {
  const modele=salonReference();
  const meuble={id:'bas',sku:'rr-gen-tv-100',x:0,z:0,rot:0};
  const tv={id:'tv',sku:'rr-gen-television-32',x:0,z:0,rot:0,kind:'surface_item',attach_to:{type:'furniture',id:'bas'},usageProgramme:'television'};
  assert.ok(verifierHauteurs(modele,[tv],catalogue).some(a=>a.type==='support-tv'));
  assert.deepEqual(verifierHauteurs(modele,[meuble,tv],catalogue),[]);
  assert.ok(verifierHauteurs(modele,[meuble,tv,{...tv,id:'tv-2'}],catalogue).some(a=>a.type==='volume-collision'));
  const tropLarge={...tv,sku:'rr-gen-television-55'};
  assert.ok(verifierHauteurs(modele,[meuble,tropLarge],catalogue).some(a=>a.type==='support-tv'));
  const r=poser(modele), suspension=r.agencement.find(it=>it.kind==='ceiling_item');
  assert.ok(verifierHauteurs(modele,[{...suspension,attach_to:{type:'ceiling'}}],catalogue).some(a=>a.type==='suspension-passage'));
});

test('un brief TV murale conserve ce mode de pose jusqu’au choix du produit', () => {
  const r=poser(salonReference(),'Salon avec TV murale, sans repas ni lecture');
  const tv=r.agencement.find(it=>it.usageProgramme==='television');
  assert.ok(tv); assert.equal(catalogue[tv.sku].fam,'tv-murale'); assert.equal(tv.kind,'wall_item');
  assert.deepEqual(verifierHauteurs(salonReference(),r.agencement,catalogue),[]);
});

test('un point focal dans le dégagement de porte reçoit la pénalité dédiée',()=>{
  const modele=salonReference(), p=OBJETS_GENERIQUES['rr-gen-television-murale-43'];
  const tv=attacheMur(modele,{id:'ecran',sku:p.id,x:-1.65,z:2,y:1.2,rot:Math.PI,usageProgramme:'television'},p,'entree');
  const r=evaluerFinition(modele,[tv],catalogue,{focal:{usage:'television'}});
  assert.ok(r.regles.some(s=>s.id==='focal-porte'&&s.points===-100));
});

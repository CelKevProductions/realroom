import { PRODUCTS, CATALOG, ceilingMounted } from './catalog.mjs';
import { bounds } from './geometry.mjs';
import { checkRoom, evaluate, DEFAULT_FINISHES } from './validation.mjs';

export const LAYOUT_ROOM_TYPES = ['salon', 'chambre', 'salle_a_manger'];
export function checkLayoutRoom(room, brief) {
  checkRoom(room);
  if (!LAYOUT_ROOM_TYPES.includes(brief.roomType)) throw Error('Le moteur de placement prend actuellement en charge les salons, chambres et salles à manger. Ce type de pièce nécessite un autre modèle.');
  const b=bounds(room.polygon);
  if(b.maxX-b.minX>11.8+1e-8 || b.maxZ-b.minZ>11.8+1e-8) throw Error('Cette pièce dépasse les 11,80 m par axe acceptés par le modèle. Le plan ne sera pas réduit pour la faire entrer.');
}

const TYPES = {
  kids_bed:['lit'],single_bed:['lit'],double_bed:['lit'],
  corner_side_table:['table','chevet'],round_end_table:['table','chevet'],coffee_table:['table'],
  console_table:['console'],tv_stand:['meuble-tv','meuble'],desk:['bureau'],dressing_table:['coiffeuse','bureau'],
  table:['table'],dining_table:['table'],stool:['tabouret'],dressing_chair:['chaise'],dining_chair:['chaise'],
  chinese_chair:['chaise','fauteuil'],armchair:['fauteuil'],chair:['chaise'],lounge_chair:['fauteuil','meridienne'],
  loveseat_sofa:['canape'],lazy_sofa:['canape','fauteuil'],sofa:['canape'],multi_seat_sofa:['canape'],
  chaise_longue_sofa:['meridienne','canape'],l_shaped_sofa:['canape'],nightstand:['chevet','table'],
  shelf:['etagere','bibliotheque'],bookshelf:['bibliotheque','etagere'],children_cabinet:['commode','meuble'],
  wine_cabinet:['buffet','meuble'],cabinet:['commode','buffet','meuble'],wardrobe:['armoire'],
  pendant_lamp:['suspension','lustre'],ceiling_lamp:['plafonnier'],
};
const text=v=>String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function compatible(object, p) {
  if(!TYPES[object.category]?.includes(p.fam))return false;
  if(object.category==='coffee_table')return p.dim[2]<=.55;
  if(['dining_table','table'].includes(object.category))return p.dim[2]>=.68 && p.dim[2]<=.9;
  if(['nightstand','corner_side_table','round_end_table'].includes(object.category))return p.dim[0]<=1 && p.dim[1]<=.8 && p.dim[2]<=.85;
  if(object.category==='single_bed' || object.category==='kids_bed')return p.dim[0]<=1.25;
  if(object.category==='double_bed')return p.dim[0]>1.25;
  if(object.category==='l_shaped_sofa')return /angle|sectionnel|modulaire/.test(text(p.nom));
  if(object.category==='tv_stand')return /tv|television/.test(text(p.nom));
  return true;
}
function validateOutput(raw) {
  if(raw?.engine!=='semlayoutdiff' || !Array.isArray(raw.layouts) || !raw.layouts.length || raw.layouts.length>12 ||
    raw.layouts.some(l=>typeof l.id!=='string' || !Number.isInteger(l.seed) || !Array.isArray(l.objects) || l.objects.length>60 || l.objects.some(o=>
      typeof o.id!=='string' || !TYPES[o.category] || ![o.x,o.z,o.rotation,...(o.size || [])].every(Number.isFinite) || o.size?.length!==3 || o.size.some(d=>d<=0 || d>12) || ![0,90,180,270].includes(o.rotation))))
    throw Error('Le moteur spatial a renvoyé des placements invalides. Aucun générateur de remplacement n’a été utilisé.');
  if(new Set(raw.layouts.map(l=>l.id)).size!==raw.layouts.length || raw.layouts.some(l=>new Set(l.objects.map(o=>o.id)).size!==l.objects.length))throw Error('Identifiants spatiaux dupliqués.');
}

// Fit real products around learned anchors. This is a bounded catalogue/geometry
// adjustment, never a room-level rule generator and never a mesh scale operation.
export function retrieveLayouts(raw, room, brief, program, previous) {
  checkLayoutRoom(room,brief); validateOutput(raw);
  const preferred=new Map((program.inventory || []).map(i=>[i.sku,i]));
  const words=text([...(program.materials || []),...brief.wishes.split(/\s+/)].join(' ')).split(/\W+/).filter(w=>w.length>3);
  const moves=[[0,0]];
  for(const d of [.1,.2,.3])for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]])moves.push([x*d,z*d]);
  const scenes=[];
  for(const layout of raw.layouts) {
    const items=(previous?.items || []).filter(i=>i.locked).map(i=>({...i})), audit=[], usage=new Map();
    const objects=[...layout.objects].sort((a,b)=>b.size[0]*b.size[1]-a.size[0]*a.size[1]);
    for(const object of objects) {
      if(items.some(i=>i.locked && compatible(object,CATALOG[i.sku]) && Math.hypot(i.x-object.x,i.z-object.z)<1))continue;
      let pool=PRODUCTS.filter(p=>compatible(object,p));
      // The model has no personal text conditioning. The language programme can
      // omit a category, e.g. a TV stand for a brief explicitly asking for no TV.
      if(preferred.size && !pool.some(p=>preferred.has(p.id))) {audit.push({id:object.id,category:object.category,reason:'outside-program'});continue;}
      const score=p=>p.dim.reduce((s,n,i)=>s+Math.abs(Math.log(n/object.size[i]))*(i===2?.3:1),0)
        -(preferred.has(p.id) && (usage.get(p.id)||0)<preferred.get(p.id).quantity ? .5:0)
        -Math.min(.2,words.filter(w=>text(p.nom+' '+p.mat+' '+p.st).includes(w)).length*.03);
      pool=pool.map(p=>({p,cost:score(p)})).sort((a,b)=>a.cost-b.cost).slice(0,8);
      let best=null;
      for(const {p,cost} of pool)for(const [dx,dz] of moves) {
        if(best && cost+Math.hypot(dx,dz)*2>=best.cost)continue;
        const item={id:object.id,sku:p.id,x:object.x+dx,z:object.z+dz,y:ceilingMounted(p)?room.height-p.dim[2]:0,rotation:object.rotation,
          zone:preferred.get(p.id)?.zone || '',note:'',locked:false};
        const report=evaluate(room,{items:[...items,item]},{paths:false,routeWidth:brief.accessible?.9:.7});
        // An unrelated locked-item problem must remain visible, but need not
        // prevent matching every other object in the room.
        if(report.issues.some(i=>i.severity==='error' && i.ids.includes(item.id)))continue;
        const candidateCost=cost+Math.hypot(dx,dz)*2+report.issues.filter(i=>i.ids.includes(item.id)).length*.2;
        if(!best || candidateCost<best.cost)best={item,cost:candidateCost};
      }
      if(best){items.push(best.item);usage.set(best.item.sku,(usage.get(best.item.sku)||0)+1);audit.push({id:object.id,category:object.category,sku:best.item.sku,anchor:{x:object.x,z:object.z,rotation:object.rotation},shift:Math.hypot(best.item.x-object.x,best.item.z-object.z)});}
      else audit.push({id:object.id,category:object.category,reason:'no-fitting-product'});
    }
    if(!items.some(i=>!i.locked))continue;
    const dropped=audit.filter(a=>a.reason);
    scenes.push({id:layout.id,title:'Proposition '+(scenes.length+1),intent:program.concept,
      zones:[],finishes:{...DEFAULT_FINISHES},items,rationale:[],
      limitations:dropped.length?[`${dropped.length} volume(s) initialement proposés n’ont pas été retenus lors de l’adaptation au programme et aux références disponibles.`]:[],
      provenance:{kind:'ai',spatialEngine:'semlayoutdiff',upstreamCommit:raw.upstreamCommit,checkpointRevision:raw.checkpointRevision,
        seed:layout.seed,spatialAnchors:items.filter(i=>!i.locked).map(i=>({...i})),retrieval:audit,spatialDiagnostics:layout.diagnostics}});
  }
  if(!scenes.length)throw Error('Aucun placement appris n’a pu être associé au catalogue dans cette pièce. Aucun aménagement de substitution n’a été fabriqué.');
  return scenes;
}

// During creation/review the VLM enriches a learned composition. It cannot
// silently remove its core or replace it by an unrelated coordinate proposal.
// Chat edits deliberately omit this guard so a client's later request can move it.
export function preserveLayout(raw, seed, radius=.65) {
  const original=new Map(seed.items.map(i=>[i.id,i])), seen=new Set();
  const items=raw.items.map(item=>{
    const old=original.get(item.id); if(!old)return item;
    seen.add(item.id);
    const local=Math.hypot(item.x-old.x,item.z-old.z)<=radius && Math.abs(item.y-old.y)<.03;
    return {...old,zone:item.zone || old.zone,note:item.note || old.note,
      ...(local && !old.locked?{x:item.x,z:item.z,rotation:item.rotation}: {})};
  });
  for(const item of seed.items)if(!seen.has(item.id))items.push({...item});
  return {...raw,id:seed.id,items,provenance:seed.provenance,
    limitations:[...(raw.limitations || []),...seed.limitations].slice(0,8)};
}
export function seedForScene(raw, seeds) {
  return seeds?.find(s=>s.id===raw.id) || seeds?.map(s=>({s,n:raw.items.filter(i=>s.items.some(j=>j.id===i.id)).length})).sort((a,b)=>b.n-a.n)[0]?.s;
}

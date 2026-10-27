import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { build } from 'esbuild';
import { PRODUITS } from '../../lib/catalogue.js';

// Claude « architecte » : la démo RealRoom reçoit trois partis (simulés ici), Maison Corleone aucun (repli moteur).
const PARTIS = [
  { titre: 'Idée A', idee: 'Le salon loin de la porte.', espaces: { salon: { relations: [{ type: 'loin_porte' }] } } },
  { titre: 'Idée B', idee: 'Le salon près de la porte.', espaces: { salon: { relations: [{ type: 'pres_porte' }] } } },
  { titre: 'Idée C', idee: 'Le repas au centre.', espaces: { repas: { relations: [{ type: 'au_centre' }] } } }
];

test('assistant et Shuffle fonctionnent dans les deux démos, sans IA de placement, et leur historique survit au rechargement', async t => {
  const racine=path.resolve(import.meta.dirname,'../..');
  const b=await build({entryPoints:[path.join(racine,'components/api.js')],absWorkingDir:racine,bundle:true,format:'esm',platform:'browser',write:false,alias:{'@':racine},logLevel:'silent'});
  const module='data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64');
  const noms=['window','location','sessionStorage'],anciens=noms.map(k=>Object.getOwnPropertyDescriptor(globalThis,k)),stock=new Map(),appels=[];
  for(const k of noms)Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:k==='location'?{pathname:'',origin:'https://demo.example'}:k==='sessionStorage'?{getItem:k=>stock.get(k)||null,setItem:(k,v)=>stock.set(k,v)}:{}});
  t.after(()=>noms.forEach((k,i)=>{if(anciens[i])Object.defineProperty(globalThis,k,anciens[i]);else delete globalThis[k];}));
  const architecte=[];
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    appels.push(url);
    if(url==='/api/demo/architecte'){architecte.push({chemin:location.pathname,corps:JSON.parse(options.body)});return Response.json(location.pathname.includes('maison-corleone')?{erreur:'architecte-indisponible'}:{partis:PARTIS});}
    assert.ok(['/catalogue.json','/styles-visuels.json'].includes(url),'aucun appel de fournisseur ni serveur de génération');
    if(url==='/styles-visuels.json')return Response.json({});
    return Response.json({produits:PRODUITS,libelles:{}});
  });
  for(const [i,chemin] of ['/fr/demo','/fr/maison-corleone/demo'].entries()){
    location.pathname=chemin;
    const {api}=await import(module+'#assistant-'+i);
    const pr=await api('/api/projets',{method:'POST',corps:{nom:'Assistant'}});
    const c=await api(`/api/projets/${pr.projet.id}/pieces`,{method:'POST',corps:{nom:'Salon',fonction:'salon'}}),id=c.piece.id;
    const scan={version:'realroom-scan-v1',source:'plan-dxf',unit:'m',floorCorners:[[0,0,0],[5,0,0],[5,0,5],[0,0,5]],ceilingHeight:2.6,openings:[{type:'porte',a:[2.05,0],b:[2.95,0]}]};
    assert.equal((await api(`/api/pieces/${id}/scan`,{method:'POST',corps:{scan}})).ok,true);
    const r=await api(`/api/pieces/${id}/variantes`,{method:'POST',corps:{action:'generer',envies:'Salon épuré avec télévision et repas',espaces:['repas'],placesRepas:4,budget:9000,encyclopedie:true}});
    assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.piece.proposition.programme.complet,true);
    const premiere=r.piece.proposition.variantes.selection;
    if(i===0){assert.equal(premiere,'a0','la première proposition suit la première idée');assert.deepEqual(r.architecte,{titre:'Idée A'});assert.equal(r.piece.proposition.concept,'Le salon loin de la porte.');}
    else {assert.equal(premiere,'v0','sans idée, le moteur seul');assert.deepEqual(r.architecte,{erreur:'architecte-indisponible'});}
    const suite=await api(`/api/pieces/${id}/variantes`,{method:'POST',corps:{action:'shuffle',session:r.piece.proposition.variantes.session}});
    assert.equal(suite.ok,true,JSON.stringify(suite));assert.equal(suite.assistant.message,'proposition');
    assert.equal(suite.piece.proposition.variantes.liste.length,2);
    if(i===0)assert.match(suite.piece.proposition.variantes.selection,/^a[12]$/,'Shuffle : idée suivante');
    assert.equal(architecte.filter(a=>a.chemin===chemin).length,1,'Shuffle réutilise les idées reçues');
    const recharge=await import(module+'#assistant-recharge-'+i);
    const relue=await recharge.api(`/api/pieces/${id}`);
    assert.deepEqual(relue.piece.agencement,suite.piece.agencement);
    assert.deepEqual(relue.piece.proposition.variantes,JSON.parse(JSON.stringify(suite.piece.proposition.variantes)));
    const retour=await recharge.api(`/api/pieces/${id}/variantes`,{method:'POST',corps:{action:'choisir',id:premiere}});
    assert.equal(retour.ok,true,JSON.stringify(retour));assert.deepEqual(retour.piece.agencement,r.piece.agencement);
  }
  assert.ok(appels.length>0);assert.ok(appels.every(url=>['/catalogue.json','/styles-visuels.json','/api/demo/architecte'].includes(url)));
  assert.deepEqual(Object.keys(architecte[0].corps).sort(),['choix','deja','inspirations','langue','piece'],'plan et brief, sans photo');
});

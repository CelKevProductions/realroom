import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {registerHooks} from 'node:module';
import {scanAndroid} from '../fixtures/scans.js';
const dossier=fs.mkdtempSync(path.join(os.tmpdir(),'rr-transfert-'));
for(const k of Object.keys(process.env))if(/DATABASE_URL|POSTGRES/.test(k))delete process.env[k];
process.env.PGLITE_DIR=dossier;
const hook=registerHooks({resolve(s,c,next){return next(['next/headers','next/navigation'].includes(s)?s+'.js':s,c);}});
const {creerTransfert,envoyerTransfert,recevoirTransfert,supprimerTransfert,empreinteTransfert}=await import('../../lib/transferts.js');
const {sql,une}=await import('../../lib/db.js');hook.deregister();
after(()=>fs.rmSync(dossier,{recursive:true,force:true}));
test('les secrets de lecture/envoi sont distincts et l’envoi atomique est unique',async()=>{
 const t=await creerTransfert('test');assert.notEqual(t.lecture,t.envoi);assert.equal((await recevoirTransfert(t.lecture)).scan,null);
 await assert.rejects(recevoirTransfert(t.envoi),e=>e.statut===410);
 const r=await Promise.allSettled([envoyerTransfert(t.envoi,scanAndroid()),envoyerTransfert(t.envoi,scanAndroid())]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
 assert.equal((await recevoirTransfert(t.lecture)).scan.source,'android-arcore-webxr');
 const row=await une('SELECT * FROM transferts_scan WHERE lecture=$1',[empreinteTransfert(t.lecture)]);assert.notEqual(row.lecture,t.lecture);assert.notEqual(row.envoi,t.envoi);
 await supprimerTransfert(t.lecture);await assert.rejects(recevoirTransfert(t.lecture),e=>e.statut===410);
});
test('un transfert expiré, un contour invalide et un secret incorrect sont refusés',async()=>{
 const t=await creerTransfert('test');await assert.rejects(envoyerTransfert(t.envoi,{...scanAndroid(),floorCorners:[]}),e=>e.code==='scan-coins');
 assert.equal((await recevoirTransfert(t.lecture)).scan,null);
 await sql("UPDATE transferts_scan SET expire_le=now()-interval '1 second' WHERE lecture=$1",[empreinteTransfert(t.lecture)]);
 await assert.rejects(envoyerTransfert(t.envoi,scanAndroid()),e=>e.statut===410);await assert.rejects(recevoirTransfert(t.lecture),e=>e.statut===410);
 await assert.rejects(recevoirTransfert('bad'),e=>e.statut===404);
});

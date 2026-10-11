// Imports réels, vidéos, QR et crédits sur le serveur isolé de tests/plan.mjs.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
import {exporterDXF,APP_LAGARSOFT} from '../lib/plans.js';
import {VERSION_SCAN} from '../lib/scan.js';
import bilan from '../docs/validation-ameublement.json' with {type:'json'};

export async function verifierGuides({browser,ctx,base,racine}){
 if(process.env.GUIDES_DEPUIS!=='maison'){
 const json=async r=>{assert.ok(r.ok(),`HTTP ${r.status()}: ${await r.text()}`);return r.json();};
 const ticket=await json(await ctx.request.get(base+'/api/guides/lagarsoft'));
 const png=PNG.sync.read(Buffer.from(ticket.qr.split(',')[1],'base64'));
 assert.equal(jsQR(new Uint8ClampedArray(png.data),png.width,png.height).data,APP_LAGARSOFT);
 for(const lang of ['fr','en'])for(const mode of ['apple','android','parcours']){
  const r=await ctx.request.get(base+`/guides/${mode}-${lang}.mp4`);assert.equal(r.status(),200);assert.ok((await r.body()).length>50000);
  assert.equal((await ctx.request.get(base+`/guides/${mode}-${lang}.vtt`)).status(),200);
 }
 const scan={version:VERSION_SCAN,source:'plan-dxf',unit:'m',floorCorners:[[0,0,0],[4,0,0],[4,0,2],[3,0,2],[3,0,3],[2,0,3],[2,0,4],[0,0,4]],ceilingHeight:null,openings:[{type:'porte',a:[.5,0],b:[1.4,0]}]};
 const fixture=process.env.DXF_CLIENT?fs.readFileSync(process.env.DXF_CLIENT):Buffer.from(exporterDXF(scan));
 const nbOuvertures=process.env.DXF_CLIENT?2:1;
 const projet=(await json(await ctx.request.post(base+'/api/projets',{data:{nom:'Parcours guidé'}}))).projet;
 const creer=async nom=>(await json(await ctx.request.post(`${base}/api/projets/${projet.id}/pieces`,{data:{nom,fonction:'chambre'}}))).piece;
 const piece=await creer('DXF Lagarsoft'),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(()=>localStorage.setItem('rr-tuto-atelier','1'));
 await page.goto(base+`/fr/app/pieces/${piece.id}`);
 const acquisition=page.getByRole('region',{name:'Comment relever votre pièce ?'});
 assert.equal(await acquisition.getByRole('group',{name:'Comment relever votre pièce ?'}).getByRole('button').count(),3);
 await acquisition.getByRole('button',{name:/^Scan Apple/}).click();
 await acquisition.getByRole('link',{name:'Installer Lagarsoft · App Store'}).waitFor();
 assert.equal(await acquisition.getByRole('link',{name:'Installer Lagarsoft · App Store'}).getAttribute('href'),APP_LAGARSOFT);
 await acquisition.getByText('Scanner avec Lagarsoft · 35 s',{exact:true}).click();
 const video=acquisition.locator('video');await video.evaluate(v=>{v.load();});await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=1;});
 assert.ok(await video.evaluate(v=>v.duration>=34&&v.duration<=36));
 await acquisition.getByLabel('Déposer un plan DXF').setInputFiles({name:'releve.dxf',mimeType:'application/dxf',buffer:fixture});
 await acquisition.getByRole('button',{name:'Vérifier cette pièce'}).click();
 await acquisition.getByText('Conserver une copie du relevé',{exact:false}).click();
 const dlPromise=page.waitForEvent('download');await acquisition.getByRole('button',{name:'DXF',exact:true}).click();const dl=await dlPromise;assert.ok(dl.suggestedFilename().endsWith('.dxf'));
 await acquisition.getByRole('button',{name:'Utiliser ce plan'}).click();
 const plan=page.getByRole('dialog');await plan.waitFor();assert.equal(await plan.locator('legend').filter({hasText:/^Coin \d+$/}).count(),8);
 await plan.getByRole('button',{name:'Enregistrer le plan'}).click();await plan.waitFor({state:'hidden'});
 const lu=(await json(await ctx.request.get(`${base}/api/pieces/${piece.id}`))).piece;
 assert.equal(lu.modele.contour.length,8);assert.equal(lu.modele.capture.source,'plan-dxf');assert.equal(lu.modele.capture.nbOuvertures,nbOuvertures);
 await page.reload();await page.locator('.atelier canvas').waitFor();
 // Une vue non fournie et un angle invalide échouent avant de consommer un crédit.
 const credits=(await json(await ctx.request.get(base+'/api/moi'))).credits;
 const capture='data:image/jpeg;base64,'+fs.readFileSync(path.join(racine,'tests/fixtures/salon-entree.jpg')).toString('base64');
 assert.equal((await ctx.request.post(`${base}/api/pieces/${piece.id}/rendus`,{data:{type:'image',capture,angle:'plafond'}})).status(),400);
 assert.equal((await ctx.request.post(`${base}/api/pieces/${piece.id}/rendus`,{data:{type:'image',capture,angle:'droite'}})).status(),400);
 assert.equal((await json(await ctx.request.get(base+'/api/moi'))).credits,credits);
 await page.getByRole('tab',{name:/Rendu IA/}).click();await page.getByRole('button',{name:'Depuis la droite',exact:true}).click();
 await page.getByLabel('Photo de cette vue').setInputFiles(path.join(racine,'tests/fixtures/salon-entree.jpg'));
 await page.getByRole('button',{name:/Générer le rendu/}).waitFor({state:'visible'});await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>/Générer le rendu/.test(b.textContent));return b&&!b.disabled;});
 await page.getByRole('button',{name:/Générer le rendu/}).click();await page.locator('.avant-apres__apres img').waitFor({state:'attached',timeout:30000});
 await page.locator('.avant-apres').scrollIntoViewIfNeeded();
 console.log('Images du rendu',await page.locator('.avant-apres img').evaluateAll(els=>els.map(e=>({url:e.getAttribute('src'),w:e.naturalWidth,h:e.naturalHeight,rect:{w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height},display:getComputedStyle(e).display}))));
 for(const src of await page.locator('.avant-apres img').evaluateAll(es=>es.map(e=>e.getAttribute('src'))))assert.equal((await ctx.request.get(base+src)).status(),200,'image privée lisible');
 await page.locator('.avant-apres__apres img').waitFor({timeout:30000});
 const avec=(await json(await ctx.request.get(`${base}/api/pieces/${piece.id}`)));assert.equal(avec.rendus[0].angle,'droite');assert.equal((await json(await ctx.request.get(base+'/api/moi'))).credits,credits-1);
 await page.reload();await page.getByRole('tab',{name:/Rendu IA/}).click();await page.locator('.avant-apres__apres img').waitFor();
 await page.screenshot({path:path.join(racine,'.essais/guide-realroom-angle.png'),fullPage:true});assert.deepEqual(errors,[]);await page.close();
 console.log('DXF → 8 coins → plan sauvegardé ; QR App Store et 6 vidéos ; vue droite et crédit unique persistés.');

 const trace=await creer('Plan PDF'),pg=await ctx.newPage();pg.on('pageerror',e=>errors.push(String(e)));pg.on('console',m=>{if(m.type()==='warning'||m.type()==='error')console.log('Plan PDF navigateur:',m.text());});await pg.addInitScript(()=>localStorage.setItem('rr-tuto-atelier','1'));
 await pg.goto(base+`/fr/app/pieces/${trace.id}`);await pg.getByRole('button',{name:/J’ai déjà un plan/}).click();await pg.getByText('Mon plan est un PDF ou une image',{exact:true}).click();
 await pg.getByLabel('Déposer un PDF ou une image du plan').setInputFiles({name:'plan.pdf',mimeType:'application/pdf',buffer:pdfSynthetique()});
 const svg=pg.getByRole('img',{name:'Plan à tracer : touchez les coins'});await svg.waitFor();
 const clic=async(x,y)=>{await svg.scrollIntoViewIfNeeded();const b=await svg.boundingBox();await pg.mouse.click(b.x+b.width*x,b.y+b.height*y);};
 await clic(.1,.1);await clic(.9,.1);await pg.getByLabel('Longueur réelle (m)').fill('4');await pg.getByRole('button',{name:'Tracer la pièce'}).click();
 for(const [x,y]of [[.1,.1],[.9,.1],[.9,.9],[.1,.9]])await clic(x,y);
 await pg.getByRole('button',{name:'Vérifier ce contour'}).click();await pg.getByRole('button',{name:'Utiliser ce plan'}).click();
 await pg.getByRole('dialog').getByRole('button',{name:'Enregistrer le plan'}).click();await pg.locator('.atelier canvas').waitFor();
 const p=(await json(await ctx.request.get(`${base}/api/pieces/${trace.id}`))).piece;assert.equal(p.modele.capture.source,'plan-dessine');assert.equal(p.modele.dims.largeur,4);assert.equal(p.modele.dims.profondeur,4);
 assert.deepEqual(errors,[]);await pg.close();console.log('PDF chargé par worker local → échelle réelle → contour → plan éditable et persistance validés.');
 }

 for(const mobile of [false,true]){
  const c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:960},reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile}),p=await c.newPage(),fautes=[];
  p.on('pageerror',e=>fautes.push(String(e)));await p.addInitScript(({modele,agencement})=>{
   if(!sessionStorage.getItem('mc-demo-1'))sessionStorage.setItem('mc-demo-1',JSON.stringify({langue:'fr',edition:'mc',credits:2,mouvements:[],projets:[{id:'p_mc',nom:'Maison Corleone'}],rendus:[],pieces:[{id:'r_demo_chambre',projet_id:'p_mc',nom:'Chambre',fonction:'chambre',etat:'prete',photos:[],modele,agencement,proposition:null,notes:'',maj_le:new Date().toISOString()}]}));
   sessionStorage.setItem('mc-demo-connecte','true');
  },bilan.chambres.find(x=>x.nom==='20 m²'));
  await p.goto(base+'/fr/maison-corleone/demo?piece=r_demo_chambre');await p.locator('.mc-piece canvas').waitFor();
  await p.getByRole('button',{name:/Rendu réaliste/}).first().click();
  const creditsAvant=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('mc-demo-1')).credits);
  await p.getByRole('button',{name:'Depuis le fond',exact:true}).click();
  await p.getByLabel('Photo de cette vue').setInputFiles(path.join(racine,'tests/fixtures/salon-entree.jpg'));
  await p.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>/Générer cette vue/.test(b.textContent));return b&&!b.disabled;});
  assert.equal(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('mc-demo-1')).credits),creditsAvant);
  await p.screenshot({path:path.join(racine,`.essais/guide-maison-${mobile?'mobile':'ordinateur'}.png`),fullPage:true});
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const bouton=await p.getByRole('button',{name:/Générer cette vue/}).boundingBox();assert.ok(bouton.y+bouton.height<= (mobile?844:960));
  await p.getByRole('button',{name:/Générer cette vue/}).click();await p.locator('.mc-aa__apres img').waitFor({timeout:30000});
  assert.equal(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('mc-demo-1')).rendus[0].angle),'fond');
  assert.equal(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('mc-demo-1')).credits),creditsAvant-1);
  await p.getByRole('button',{name:'Fermer',exact:true}).click();await p.getByRole('button',{name:'Nouvelle pièce',exact:true}).click();await p.locator('.mc-etape--piece').waitFor();
  await p.locator('.mc-choix__btn').filter({has:p.getByText('Chambre',{exact:true})}).click();await p.locator('.mc-etape--budget').waitFor();
  await p.getByLabel('Mon budget (€)').fill('2123.45');assert.match(await p.locator('.mc-budget__valeur').innerText(),/2\s*123,45/);await p.getByRole('button',{name:'Continuer',exact:true}).click();
  assert.equal(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('mc-demo-choix')).budget),2123.45);assert.deepEqual(fautes,[]);await c.close();
  console.log(`Maison Corleone ${mobile?'mobile':'ordinateur'} : choix d’angle sans débit, génération explicite, budget libre en centimes.`);
 }
 await capturerBanc({browser,base,racine});
}
export async function capturerBanc({browser,base,racine}){
 const exemple=bilan.chambres.find(x=>x.nom==='20 m²');
 for(const [label,items]of [['avant',exemple.mobilier],['apres',exemple.agencement]]){
  const c=await browser.newContext({viewport:{width:1280,height:960},reducedMotion:'reduce'}),p=await c.newPage();
  await p.addInitScript(({modele,items})=>{localStorage.setItem('rr-tuto-atelier','1');sessionStorage.setItem('realroom-demo-1',JSON.stringify({langue:'fr',credits:3,mouvements:[],projets:[{id:'p_vision',nom:'Banc synthétique'}],rendus:[],pieces:[{id:'r_vision',projet_id:'p_vision',nom:'Chambre 20 m²',fonction:'chambre',etat:'prete',photos:[],modele,agencement:items,notes:'',proposition:null,maj_le:new Date().toISOString()}]}));},{modele:exemple.modele,items});
  await p.goto(base+'/fr/demo/pieces/r_vision');const canvas=p.locator('.atelier canvas');await canvas.waitFor();
  await p.getByRole('button',{name:'Optimiser la disposition',exact:true}).waitFor();
  await canvas.screenshot({path:path.join(racine,`.essais/vision-${label}.png`)});await c.close();
 }
 const c=await browser.newContext({viewport:{width:1280,height:750}}),p=await c.newPage();
 const uri=n=>'data:image/png;base64,'+fs.readFileSync(path.join(racine,`.essais/vision-${n}.png`)).toString('base64');
 await p.setContent(`<html lang="fr"><body style="margin:0;background:#eee9e0;font-family:sans-serif"><div style="padding:20px;font-size:24px">Même pièce et même mobilier · disposition avant / après</div><div style="display:flex;gap:12px;padding:12px"><div style="width:50%"><b>A · Avant</b><img src="${uri('avant')}" style="width:100%;height:630px;object-fit:contain"></div><div style="width:50%"><b>B · Après</b><img src="${uri('apres')}" style="width:100%;height:630px;object-fit:contain"></div></div></body></html>`);
 await p.screenshot({path:path.join(racine,'docs/comparaison-ameublement.png')});await c.close();
 console.log('Comparaison 3D avant / après du banc enregistrée, avec les mêmes quatre meubles.');
}
function pdfSynthetique(){
 const contenu='0.4 w 30 30 340 340 re S',objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Resources << >> /Contents 4 0 R >>',`<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`];
 let s='%PDF-1.4\n',offsets=[0];objs.forEach((o,i)=>{offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${o}\nendobj\n`;});const x=Buffer.byteLength(s);s+='xref\n0 5\n0000000000 65535 f \n'+offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;return Buffer.from(s);
}

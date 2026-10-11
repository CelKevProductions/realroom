// Deux navigateurs indépendants ; vrai transfert serveur, vraie persistance du polygone.
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';import jsQR from 'jsqr';
import {depuisScan} from '../lib/scan.js';
import {contientBoite} from '../lib/contour.js';import {boite,produitDe} from '../lib/agencement.js';
export async function verifierTransfertContour({browser,ctx,base}){
 const json=async r=>{assert.ok(r.ok(),`HTTP ${r.status()}: ${await r.text()}`);return r.json();};
 const scan={version:'realroom-scan-v1',source:'android-arcore-webxr',unit:'m',floorCorners:[[0,0,0],[5,0,0],[5,0,2],[2,0,2],[2,0,5],[0,0,5]],ceilingHeight:2.6};
 const index=await json(await ctx.request.get(base+'/styles-visuels.json'));assert.equal(Object.keys(index.produits).length,278);
 console.log('Transfert : validation API et décodage QR…');
 const ticket=await json(await ctx.request.post(base+'/api/transferts',{data:{lang:'fr'}}));
 const png=PNG.sync.read(Buffer.from(ticket.qr.split(',')[1],'base64')),code=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
 assert.ok(code,'Le QR doit être décodable');assert.equal(code.data,base+ticket.lien);
 const envoi=new URLSearchParams(ticket.lien.split('#')[1]).get('t');assert.notEqual(envoi,ticket.lecture);
 const sansCompte=await browser.newContext();
 assert.equal((await sansCompte.request.get(base+'/api/transferts',{headers:{Authorization:`Bearer ${envoi}`}})).status(),410);
 assert.equal((await sansCompte.request.post(base+'/api/transferts',{headers:{Authorization:`Bearer ${ticket.lecture}`},data:{scan}})).status(),410);
 await json(await sansCompte.request.post(base+'/api/transferts',{headers:{Authorization:`Bearer ${envoi}`},data:{scan}}));
 assert.equal((await sansCompte.request.post(base+'/api/transferts',{headers:{Authorization:`Bearer ${envoi}`},data:{scan}})).status(),410);
 assert.deepEqual((await json(await ctx.request.get(base+'/api/transferts',{headers:{Authorization:`Bearer ${ticket.lecture}`}}))).scan,scan);
 await json(await ctx.request.delete(base+'/api/transferts',{headers:{Authorization:`Bearer ${ticket.lecture}`}}));await sansCompte.close();
 const projet=(await json(await ctx.request.post(base+'/api/projets',{data:{nom:'Contour'} }))).projet;
 const p=(await json(await ctx.request.post(`${base}/api/projets/${projet.id}/pieces`,{data:{nom:'Chambre en L',fonction:'chambre'}}))).piece;
 const url=`${base}/api/pieces/${p.id}`;
 await json(await ctx.request.post(url+'/scan',{data:{scan}}));
 const modele=depuisScan(scan).modele;const contour=modele.contour.map((p,i)=>i===3?[p[0]-.1,p[1]]:p);
 await json(await ctx.request.patch(url,{data:{geometrie:{contour,murs:{pan_5:{ouvertures:[{type:'porte',position:0,largeur:.8,hauteur:2.04,allege:0}]}}}}}));
 const relu=(await json(await ctx.request.get(url))).piece;assert.deepEqual(relu.modele.contour,contour);assert.equal(relu.modele.murs.pan_5.ouvertures.length,1);
 const mauvaise=await ctx.request.patch(url,{data:{geometrie:{contour:[[0,0],[2,2],[0,2],[2,0]]}}});assert.equal(mauvaise.status(),400);assert.deepEqual((await json(await ctx.request.get(url))).piece.modele.contour,contour);
 const cat=await json(await ctx.request.get(base+'/catalogue.json'));const catalogue=cat.produits || cat;
 const ame=(await json(await ctx.request.post(url+'/amenager',{data:{mode:'tout',budget:2000,envies:'Une chambre japandi avec lit et rangement',langue:'fr'}}))).piece;
 assert.ok(ame.agencement.some(it=>it.sku&&produitDe(it,catalogue)?.fam==='lit'),'la chambre en L reçoit un lit valide');
 for(const it of ame.agencement.filter(it=>it.garde!==false&&it.sku)){const q=produitDe(it,catalogue);if(q&& !['applique','miroir','tableau','suspension','lustre','plafonnier'].includes(q.fam))assert.ok(contientBoite(ame.modele,boite(it,q.dim)),`hors du contour: ${it.id}`);}
 for(const edition of (process.env.TRANSFERT_EDITION?[process.env.TRANSFERT_EDITION]:['realroom','maison']))for(const mobile of [false,true]){
  const desktop=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:960},reducedMotion:'reduce'}),page=await desktop.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(()=>localStorage.setItem('rr-tuto-atelier','1'));
  if(edition==='maison')await page.addInitScript(()=>{
    if(!sessionStorage.getItem('mc-demo-1'))sessionStorage.setItem('mc-demo-1',JSON.stringify({langue:'fr',edition:'mc',credits:2,mouvements:[],projets:[{id:'p_mc',nom:'Maison Corleone'}],rendus:[],pieces:[{id:'r_qr_scan',projet_id:'p_mc',nom:'Chambre',fonction:'chambre',etat:'photos',dims:null,photos:[],notes:'',modele:null,agencement:[],proposition:null,erreur:null,cree_le:new Date().toISOString(),maj_le:new Date().toISOString()}]}));
    sessionStorage.setItem('mc-demo-connecte','true');sessionStorage.setItem('mc-demo-choix',JSON.stringify({fonction:'chambre',budget:3000,styles:['japandi'],texte:'',coups:[],priorites:[]}));
  });
  await page.goto(base+(edition==='realroom'?'/fr/demo/pieces/r_demo_chambre':'/fr/maison-corleone/demo?piece=r_qr_scan'));
  console.log(`Transfert interface ${edition} ${mobile?'mobile':'ordinateur'}…`);
  const acquisition=page.getByRole('region',{name:'Comment relever votre pièce ?'});
  await acquisition.getByRole('button',{name:/Scanner avec mon téléphone/}).click();
  const link=acquisition.getByRole('link',{name:'Ouvrir le lien sur ce téléphone'});await link.waitFor();const href=await link.getAttribute('href');
  const phoneContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),phone=await phoneContext.newPage();await phone.goto(base+href);
  const controles=await phone.evaluate(()=>{const panneau=document.querySelector('[class*=commandes]'),root=panneau.parentElement;root.hidden=false;const btn=panneau.querySelector('button:last-child'),r=btn.getBoundingClientRect(),bas=innerHeight-r.bottom;root.hidden=true;return {bas,hauteur:r.height};});assert.ok(controles.bas>=95,'les actions AR laissent une réserve sous le panneau');assert.ok(controles.hauteur>=44);
  await phone.getByLabel('Importer un relevé métrique').setInputFiles({name:'piece-l.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scan))});
  assert.equal(await phone.locator('svg polygon').getAttribute('points'),modele.contour.map(p=>p.join(',')).join(' '));
  await phone.getByRole('button',{name:'Envoyer sur mon ordinateur'}).click();await phone.getByText('Relevé envoyé !',{exact:false}).waitFor();
  await acquisition.getByRole('heading',{name:'Vérifier avant d’importer'}).waitFor();
  const remplacer=acquisition.getByRole('checkbox');if(await remplacer.count())await remplacer.check();
  await acquisition.getByRole('button',{name:'Utiliser ce plan'}).click();const d=page.getByRole('dialog');await d.waitFor();
  assert.equal(await d.locator('legend').filter({hasText:/^Coin \d+$/}).count(),6);
  await d.getByLabel('X (m)',{exact:true}).nth(3).fill(String(contour[3][0]));
  await d.getByRole('button',{name:'Enregistrer le plan'}).click();await d.waitFor({state:'hidden'});
  if(edition==='maison')await page.getByRole('button',{name:'Lancer l’aménagement',exact:true}).click();
  await page.locator('canvas').first().waitFor();assert.deepEqual(errors,[]);
  const sauve=await page.evaluate(edition=>JSON.parse(sessionStorage.getItem(edition==='maison'?'mc-demo-1':'realroom-demo-1')).pieces.find(p=>p.modele?.contour),edition);assert.deepEqual(sauve.modele.contour,contour);
  await page.reload();if(edition==='maison')await page.locator('.mc-piece canvas').waitFor();else await page.locator('canvas').first().waitFor();
  const reluUi=await page.evaluate(edition=>JSON.parse(sessionStorage.getItem(edition==='maison'?'mc-demo-1':'realroom-demo-1')).pieces.find(p=>p.modele?.contour),edition);assert.deepEqual(reluUi.modele.contour,contour);await page.screenshot({path:`.essais/transfert-${edition}-${mobile?'mobile':'ordinateur'}.png`,fullPage:true});
  await phoneContext.close();await desktop.close();
 }
 console.log('QR décodé → téléphone sans compte → aperçu ordinateur ; L édité/sauvegardé et placement vérifiés, deux éditions, ordinateur/mobile.');
}

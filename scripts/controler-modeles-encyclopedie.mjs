import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import MODELES from '../data/encyclopedie/modeles.json' with {type:'json'};
import {propDe} from '../lib/staging-catalogue.js';
import {construireProp} from '../moteur/staging.js';
import {verifierCotes} from '../lib/controle-modeles.js';
import {rasteriser} from './maquette.mjs';
const sharp=createRequire(import.meta.url)('sharp'),dossier='docs/encyclopedie/modeles';await fs.mkdir(dossier,{recursive:true});
const controles=[],W=600,H=500,angles=[[-1,1],[1,1],[1,-1]];
for(const m of MODELES.modeles){
 for(const style of Object.keys(MODELES.styles)){
  const mesure=verifierCotes(construireProp(propDe(m.id,style)),m);assert.ok(mesure.valide,m.id+' / '+style);controles.push({...mesure,style});
 }
 const images=[];
 for(const [i,[x,z]]of angles.entries()){
  const p=propDe(m.id),objet=construireProp(p),scene=new THREE.Scene();scene.add(objet);
  const sol=new THREE.Mesh(new THREE.PlaneGeometry(6,6),new THREE.MeshLambertMaterial({color:'#F1EADF'}));sol.rotation.x=-Math.PI/2;sol.position.y=-.001;scene.add(sol);
  const taille=Math.max(...m.dim),zoom=taille*.7,camera=new THREE.OrthographicCamera(-zoom*W/H,zoom*W/H,zoom,-zoom,.01,100);
  camera.position.set(x*taille*2,taille*1.65,z*taille*2);camera.lookAt(0,m.dim[2]/2,0);
  const image=await sharp(rasteriser(scene,camera,W,H)).jpeg({quality:90}).toBuffer();images.push(image);
  await fs.writeFile(`${dossier}/${m.id}-angle-${i+1}.jpg`,image);
 }
 const titre=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="100"><rect width="1800" height="100" fill="#faf8f2"/><g font-family="sans-serif" fill="#3e3930"><text x="25" y="38" font-size="24">${m.nom.replaceAll('&','&amp;')} · ${m.dim.map(v=>Math.round(v*1000)).join(' × ')} mm</text><text x="25" y="76" font-size="18">Prototype S · non vendu · trois angles pour validation utilisateur · matériaux neutres</text></g></svg>`);
 await sharp({create:{width:1800,height:H+100,channels:3,background:'#faf8f2'}}).composite([{input:titre,left:0,top:0},...images.map((input,i)=>({input,left:i*W,top:100}))]).jpeg({quality:90}).toFile(`${dossier}/${m.id}-controle.jpg`);
 await fs.writeFile(`${dossier}/${m.id}-fiche.json`,JSON.stringify({...m,materiauxParStyle:MODELES.styles,controles:controles.filter(c=>c.id===m.id),rendus:angles.map((_,i)=>`${m.id}-angle-${i+1}.jpg`)},null,2)+'\n');
 console.log(JSON.stringify({id:m.id,dim:m.dim,styles:12,angles:3,valide:true}));
}
await fs.writeFile(`${dossier}/controles.json`,JSON.stringify({tolerance:.05,modeles:MODELES.modeles.length,configurations:controles.length,valides:controles.filter(c=>c.valide).length,appelsGeneration3D:0,coutGeneration3DUSD:0,controles},null,2)+'\n');

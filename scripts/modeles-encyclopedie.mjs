// Production bornée : six formes géométriques et deux props de recette.
import fs from 'node:fs/promises';
import {BASE,variantesEncyclopedie} from '../lib/encyclopedie.js';
import {PRODUITS} from '../lib/catalogue.js';
import {PROPS as PREEXISTANTS} from '../lib/staging-catalogue.js';
const originaux=Object.fromEntries(Object.entries(PREEXISTANTS).filter(([id])=>!id.startsWith('enc-')));
const enlever=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const choix=[['console-dos','console dos de canape','console',1],['console-tv-suspendue','console tv suspendue','console',1],['bar-cart','bar cart','chariot',2],['armoire-bar','armoire-bar','armoire',2],['enfilade','buffet / enfilade','buffet',1],['bibliotheque-ouverte','bibliotheque haute','bibliotheque',1]];
const modeles=choix.map(([id,nom,forme,priorite])=>{
 const m=BASE.meubles.find(m=>m.piece==='SL'&&enlever(m.nom)===nom);if(!m?.dim)throw Error('Fiche dimension incomplète : '+nom);
 return{id:'enc-'+id,nom:m.nom,forme:id==='console-tv-suspendue'?'ency-console-suspendue':'ency-'+forme,dim:m.dim,emprise:{largeur:m.dim[0],profondeur:m.dim[1],surface:m.dim[0]*m.dim[1]},types:['salon','open-space'],tagsStyle:[...PREEXISTANTS.vase.styles],venteSource:'B-possible',validationProduit:false,sourceDimension:m.uid,dimensionsSource:m.dimensionsSource,degagements:m.degagements,sourceDisposition:BASE.dispositions.filter(d=>d.meubles.includes(m.uid)).map(d=>d.uid),priorite,fam:'meuble',vendu:false,statut:'produit-a-valider',classe:'S',description:m.nom+' de mise en scène, non vendu.'};
});
modeles.push({id:'enc-carafe',nom:'Carafe de mise en scène',forme:'ency-carafe',dim:[.13,.13,.26],sourceDimension:'hypothese-staging-130x130x260-mm',dimensionsSource:'Cotes de présentation : aucune dimension fournie dans le tome. Hypothèse éditoriale, aucune fiche marchande inventée.',priorite:2,fam:'deco',vendu:false,statut:'prop-S',classe:'S',description:'Carafe de verre sans marque, pour la recette du bar.'},
{id:'enc-bol-citrons',nom:'Bol de citrons',forme:'bol',dim:PREEXISTANTS['bol-fruits'].dim,sourceDimension:'bibliotheque-props:bol-fruits',dimensionsSource:'Enveloppe métrique du bol déjà présent, avec fruits jaunes.',priorite:2,fam:'deco',vendu:false,statut:'prop-S',classe:'S',fruitCouleur:'#DFC24F',description:'Bol bas de citrons, recette de cuisine, jamais vendu.'});
const styles={neutre:['#B69773','#D5C6AE','#6A8559'],epure:['#C9B89D','#EDE9DF','#667460'],chaleureux:['#9A6E48','#D6BB90','#6A8559'],classique:['#73533F','#E3D4BE','#3B5645'],boheme:['#B8885C','#E6C19B','#738B56'],artdeco:['#76513D','#DAC080','#294B42'],japandi:['#9E8A69','#D7D1BB','#718271'],audacieux:['#A75443','#DBB95C','#3C7F71'],mediterraneen:['#B78864','#EADBC8','#6D8B78'],scandinave:['#CEB998','#E8E4DD','#7D9679'],industriel:['#705A49','#586068','#526B56'],contemporain:['#A09078','#CCC8C0','#597A68']};
for(const m of modeles){
 m.emprise??={largeur:m.dim[0],profondeur:m.dim[1],surface:m.dim[0]*m.dim[1]};m.types??=['salon','cuisine','salle_a_manger'];m.tagsStyle=Object.keys(styles);m.degagements??='Accessoire posé dans les limites du plateau, hors zones de travail.';m.validationProduit=false;m.pose=m.id==='enc-console-tv-suspendue'?'mur-ancrage-a-valider':m.fam==='deco'?'surface':'sol';
 if(m.forme==='ency-bibliotheque')m.surfaces=Array.from({length:5},(_,i)=>({id:'niveau-'+i,hauteur:.025+i*(m.dim[2]-.025)/4}));
 if(m.forme==='ency-chariot')m.surfaces=[.17,.72].map((n,i)=>({id:'niveau-'+i,hauteur:(m.dim[2]*n+.026)*m.dim[2]/(m.dim[2]*.98+.018)}));
}
await fs.writeFile('data/encyclopedie/modeles.json',JSON.stringify({plafond:8,appelsGeneration3D:0,coutGeneration3DUSD:0,styles,modeles},null,2)+'\n');
const manques=BASE.meubles.map(m=>{
 const t=enlever(m.nom);const correspondance=Object.values(PRODUITS).filter(p=>enlever(p.nom).includes(t)||t.includes(enlever(p.fam))&&(!m.dim||p.dim.every((v,i)=>Math.abs(v-m.dim[i])/m.dim[i]<.4))).map(p=>({id:p.id,commercial:!p.generique}));
 const produit=modeles.find(x=>x.sourceDimension===m.uid);return{uid:m.uid,nom:m.nom,priorite:/billard|aquarium|claustra|mur vegetal|piano|gaming|sport|meditation/i.test(t)?3:/bar cart|armoire.bar/i.test(t)?2:/lit|chevet|canape|fauteuil|table|armoire|console|buffet|bibliotheque/i.test(t)?1:3,dimensions:m.dim,dimensionsSource:m.dimensionsSource,candidats:correspondance,modeleProduit:produit?.id||null,statut:produit?'modele-non-vendu-produit':correspondance.length?'compatibilite-a-confirmer':'manquant',regles:m.degagements};
});
for(const p of BASE.props)if(!Object.values(originaux).some(m=>enlever(p.nom).includes(enlever(m.nom))||enlever(m.nom).includes(enlever(p.nom))))manques.push({uid:p.uid,nom:p.nom,priorite:2,venteSource:p.venteSource,statut:'recette-a-resoudre',dimensions:null});
await fs.writeFile('docs/encyclopedie/manques.json',JSON.stringify(manques.sort((a,b)=>a.priorite-b.priorite),null,2)+'\n');
await fs.writeFile('docs/encyclopedie/variantes.json',JSON.stringify(Object.fromEntries(['SL','CH','SAM','CU','BU','SDB','EN','BA','AN'].map(p=>[p,variantesEncyclopedie(p)])),null,2)+'\n');
console.log(JSON.stringify({modeles:modeles.length,plafond:8,appels3D:0,cout3D:0,comptes:BASE.comptes,variantes:Object.fromEntries(['SL','CH','SAM','CU','BU','SDB','EN','BA','AN'].map(p=>[p,variantesEncyclopedie(p).length]))}));

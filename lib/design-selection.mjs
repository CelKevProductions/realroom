import {shortlist, CATALOG} from "./catalog.mjs";
const clean = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const GROUPS = {
  conversation:["canape","fauteuil","table","tapis"], lecture:["fauteuil","lampe","lampadaire","etagere","bibliotheque"],
  musique:["piano","instrument","enceinte","banc","meuble"], travail:["bureau","chaise","lampe","bibliotheque"],
  repas:["table","chaise","buffet","suspension"], sommeil:["lit","chevet","table","lampe","armoire"],
  rangement:["bibliotheque","etagere","meuble","buffet","commode","armoire"],
};
const roomActivity={salon:"conversation",chambre:"sommeil",bureau:"travail",salle_a_manger:"repas"};
// Balanced retrieval keeps small and large alternatives in each family. No invented dimensions.
export function selectCatalogue(brief, current, limit=100) {
  const all=shortlist(), wanted=new Set([...(brief.activities || []),roomActivity[brief.roomType]].filter(Boolean));
  const text=clean(brief.wishes), terms=text.split(/\W+/).filter(t=>t.length>3);
  for(const activity of Object.keys(GROUPS)) if(text.includes(activity)) wanted.add(activity);
  if(/piano|guitare|vinyle|musique/.test(text)) wanted.add("musique");
  if(/bureau|travail|teletravail/.test(text)) wanted.add("travail");
  if(/lire|livre|lecture/.test(text)) wanted.add("lecture");
  if(/diner|manger|repas/.test(text)) wanted.add("repas");
  const families=new Set(["tableau","miroir","applique","suspension","plafonnier","tapis","plante","objet","rideau",...Array.from(wanted).flatMap(a=>GROUPS[a]||[])]);
  const selected=new Map();
  for(const item of current?.items || []) {const p=all.find(p=>p.sku===item.sku); if(p)selected.set(p.sku,p);}
  const rank=p=>terms.reduce((s,t)=>s+(clean([p.name,p.type,p.material,p.style].join(" ")).includes(t)?4:0),0)+(p.generic?1:0);
  for(const family of families) {
    const choices=all.filter(p=>p.type===family).sort((a,b)=>rank(b)-rank(a)||a.sku.localeCompare(b.sku));
    for(const p of choices.slice(0,4))selected.set(p.sku,p);
    for(const p of choices.sort((a,b)=>a.dimensions[0]*a.dimensions[1]-b.dimensions[0]*b.dimensions[1]).slice(0,2))selected.set(p.sku,p);
    if(family==="table")for(const p of choices.filter(p=>p.dimensions[2]>.68).slice(0,3))selected.set(p.sku,p);
  }
  // A free-form request can introduce a family beyond the built-in activity labels.
  for(const p of all.filter(p=>rank(p)>=4).sort((a,b)=>rank(b)-rank(a)))if(selected.size<limit)selected.set(p.sku,p);
  for(const p of all)if(selected.size<Math.min(limit,60))selected.set(p.sku,p);
  return [...selected.values()].slice(0,Math.max(limit,current?.items?.length || 0));
}
export function compactCatalogue(catalogue) {
  return catalogue.map(p=>({sku:p.sku,name:p.name,type:p.type,dim:p.dimensions,
    material:p.material,colors:p.colors,mount:p.mount,price:p.price,generic:p.generic}));
}

const text={type:"string"};
const object=properties=>({type:"object",properties,required:Object.keys(properties),additionalProperties:false});
export const PROGRAM_SCHEMA=object({concept:text,palette:{type:"array",items:text},materials:{type:"array",items:text},
  priorities:{type:"array",items:text},zones:{type:"array",items:object({name:text,activity:text,location:text,relations:text})},
  inventory:{type:"array",items:object({sku:{type:"string",enum:Object.keys(CATALOG)},quantity:{type:"integer",minimum:1,maximum:12},zone:text,reason:text})},
  tradeoffs:{type:"array",items:text}});
export function validateProgram(raw,selected) {
  if(!raw || typeof raw.concept!=="string" || !Array.isArray(raw.inventory) || raw.inventory.length>32)
    throw Error("Le programme d’ameublement est invalide.");
  const allowed=new Set(selected.map(p=>p.sku));
  if(raw.inventory.some(p=>!allowed.has(p.sku)||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>12))
    throw Error("Le programme contient une référence ou une quantité invalide.");
  if(raw.inventory.reduce((s,p)=>s+p.quantity,0)>40)throw Error("Le programme contient trop d’objets.");
  return raw;
}

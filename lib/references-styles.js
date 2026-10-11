// Exemples publics consultés le 10 octobre 2026. Descripteurs et affinités RealRoom,
// pas des annotations géométriques extraites des photos, ni un entraînement.
// Les photos restent sur les pages des auteurs : aucune copie de leurs catalogues.
import {descriptionDe} from './usages.js';
export const REFERENCES_STYLES=Object.freeze([
 {id:'ikea-minimal',styles:['epure'],titre:'Minimalisme · IKEA',url:'https://www.ikea.com/nl/en/rooms/living-room/gallery/discover-minimalism-pub152cf970/',mots:['minimaliste','minimalist','sobre','ligne droite','lignes droites','noir','gris'],patrons:['salon-focal','bureau-lateral']},
 {id:'ikea-japandi-salon',styles:['japandi','chaleureux'],titre:'Salon Japandi · IKEA',url:'https://www.ikea.com/gb/en/rooms/living-room/gallery/a-japandi-living-room-with-colours-and-materials-inspired-by-nature-pub5c1a7ed0/',mots:['chene','oak','rotin','rattan','courbe','naturel','natural'],patrons:['salon-conversation','salon-lateral']},
 {id:'ikea-japandi-chambre',styles:['japandi','epure'],titre:'Chambre Japandi · IKEA',url:'https://www.ikea.com/gb/en/rooms/bedroom/gallery/a-soothing-minimal-japandi-bedroom-with-room-for-all-your-clothes-pub0190cfc0/',mots:['lin','linen','bois clair','light wood','ecru','rangement'],patrons:['chambre-axiale','chambre-decalee']},
 {id:'muuto-scandinave',styles:['scandinave','contemporain'],titre:'A Space That Just Feels Right · Muuto',url:'https://www.muuto.com/content/stories/theme-stories/a-space-that-just-feels-right/',mots:['chene','oak','frêne','ash','laque','laquer','textile','scandinave','scandinavian'],patrons:['salon-conversation','salon-lateral','repas-central']},
 {id:'ikea-boheme-salon',styles:['boheme','chaleureux'],titre:'Salon et repas bohèmes · IKEA',url:'https://www.ikea.com/se/en/rooms/dining/gallery/a-warm-and-inviting-dining-room-with-a-bohemian-style-pub00be44f0/',mots:['boheme','bohemian','rotin','rattan','bois massif','solid wood','tresse','naturel'],patrons:['salon-conversation','repas-central']},
 {id:'ikea-boheme-chambre',styles:['boheme'],titre:'Chambre bohème · IKEA',url:'https://www.ikea.com/gb/en/rooms/bedroom/gallery/a-dreamy-tropical-bohemian-style-teenagers-bedroom-pub0ecd6380/',mots:['beige','textile','tropical','tapis','rug','rotin'],patrons:['chambre-laterale','chambre-decalee']},
 {id:'vam-artdeco',styles:['artdeco'],titre:'Art Deco in the home · Victoria and Albert Museum',url:'https://www.vam.ac.uk/articles/art-deco-in-the-home',mots:['art deco','geometrique','geometric','laiton','brass','laque','lacquer','marbre','marble'],patrons:['chambre-axiale','repas-central']},
 {id:'ikea-tradition',styles:['classique'],titre:'Tradition et modernité · IKEA',url:'https://www.ikea.com/us/en/rooms/living-room/gallery/a-living-room-with-traditional-feel-and-modern-glimpses-puba5739240/',mots:['classique','classic','traditionnel','traditional','moulure','capitonne','velours','velvet'],patrons:['chambre-axiale','repas-central','salon-focal']},
 {id:'ikea-industriel',styles:['industriel'],titre:'Industrial style · IKEA',url:'https://www.ikea.com/be/en/ideas/styles/industrial/',mots:['metal','acier','steel','beton','concrete','bois fonce','dark wood','industriel','industrial'],patrons:['salon-lateral','bureau-lateral','repas-longitudinal']},
 {id:'ikea-audacieux',styles:['audacieux','contemporain'],titre:'Salon contemporain et éclectique · IKEA',url:'https://www.ikea.com/gb/en/rooms/living-room/gallery/a-modern-living-room-with-an-element-of-suprise-puba1baa760/',mots:['colore','colorful','orange','bleu','blue','sculptural','graphique','graphic'],patrons:['salon-lateral','salon-conversation']},
 {id:'ikea-mediterranee',styles:['mediterraneen'],titre:'Couleurs du salon · IKEA Espagne',url:'https://www.ikea.com/es/en/ideas/colours-for-your-living-room-ideas-and-inspiration-pub07525701',mots:['blanc','white','terre cuite','terracotta','lin','linen','naturel','natural','ceramique','ceramic'],patrons:['salon-conversation','repas-central']}
].map(r=>Object.freeze({...r,consulteLe:'2026-10-10',source:'editorial',aVerifier:true})));
export function referencesStylesDe(styles=[]){return REFERENCES_STYLES.filter(r=>r.styles.some(s=>styles.includes(s)));}
export function etiquettesStyle(p){
 const t=descriptionDe(p), scores=new Map(),preuves=new Map();
 for(const ref of REFERENCES_STYLES){const cues=ref.mots.filter(m=>t.includes(m.normalize('NFD').replace(/[\u0300-\u036f]/g,'')));if(cues.length<2)continue;
  for(const style of ref.styles){const score=Math.min(1,cues.length/4);if(score>(scores.get(style)||0)){scores.set(style,score);preuves.set(style,{reference:ref.id,indices:cues});}}
 }
 return [...scores].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([style,score])=>({style,score,...preuves.get(style),source:'editorial',aVerifier:true}));
}
export function affiniteReference(id,styles){
 const refs=referencesStylesDe(styles), scores=(styles||[]).filter(s=>s!=='neutre').map(style=>refs.filter(r=>r.styles.includes(style)&&r.patrons.includes(id)).length);
 return scores.length?Math.min(2,scores.reduce((a,b)=>a+b,0)/scores.length):0;
}

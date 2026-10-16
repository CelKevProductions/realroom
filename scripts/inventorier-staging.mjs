// Inventaire documentaire dérivé des données du dépôt, sans appel externe.
import fs from 'node:fs/promises';
import { PRODUITS } from '../lib/catalogue.js';
import { PROPS, RECETTES_STAGING } from '../lib/staging-catalogue.js';
import { POIDS_STAGING } from '../lib/staging.js';

const dossier='docs/staging';await fs.mkdir(dossier,{recursive:true});
const recettesHotes={
  'table-basse':['plateau','livres','vase','bougie'],'table-appoint':['plateau','livres','vase','bougie'],
  chevet:['plateau','livres','vase','bougie'],console:['vase-haut','livres','plante-moyenne','sculpture'],buffet:['vase-haut','livres','plante-moyenne','sculpture'],
  vaisselier:['vase-haut','livres','plante-moyenne','sculpture'],etagere:['livres-debout','sculpture ou vase-haut par niveau'],
  'etagere-murale':['livres-debout','sculpture'],bureau:['ordinateur','carnet','plante-petite'],
  'table-repas':['bol-fruits','vase'],canape:['1 à 3 coussins','plaid hors épuré'],fauteuil:['coussin','plaid hors épuré'],
  lit:['coussins','plaid hors épuré'],vasque:['serviettes','bougie'],banc:[],
  'salon-exterieur':['coussins','plaid hors épuré'],'ilot-cuisine':['planche','bouilloire','bol-fruits'],
  'comptoir-bar':['plateau','bouteilles','verres']
};
const recettes=Object.fromEntries(Object.entries(RECETTES_STAGING).map(([type,styles])=>[type,
  Object.fromEntries(Object.entries(styles).map(([style,r])=>[style,{...r,
    recettesHotes:Object.fromEntries(r.hotes.map(h=>[h,recettesHotes[h]||[]])),
    compact:'À 14 m² ou moins : livres + vase sur petite table, un coussin, aucun mur travaillé ou grand prop automatique.'
  }]))]));
const commerciaux=Object.values(PRODUITS).filter(p=>!p.generique);
const famillesParUsage={television:['tv','tv-murale'],'ilot-cuisine':['ilot'],'comptoir-bar':['comptoir'],ordinateur:['ordinateur']};
const offresParUsage=Object.fromEntries(Object.entries(famillesParUsage).map(([usage,familles])=>[usage,commerciaux.filter(p=>familles.includes(p.fam)).map(p=>p.id)]));
const inventaire={date:'2026-10-11',nombreCommercial:commerciaux.length,nombreGenerique:Object.values(PRODUITS).filter(p=>p.generique).length,
  nombreProps:Object.keys(PROPS).length,nombreRecettes:Object.values(recettes).reduce((s,x)=>s+Object.keys(x).length,0),
  bibliotheque:PROPS,poids:POIDS_STAGING,
  tapisReordonnes:commerciaux.filter(p=>p.dimSource).map(p=>({id:p.id,source:p.dimSource,dim:p.dim})),
  tabouretsCommerciaux:commerciaux.filter(p=>p.fam==='tabouret').map(p=>({id:p.id,nom:p.nom,dim:p.dim,prix:p.prix,hauteurAssise:null})),
  offresParUsage,usagesSansOffreCommerciale:Object.entries(offresParUsage).filter(([,ids])=>!ids.length).map(([usage])=>usage),
  limites:'Les usages sans offre sont issus du classement catalogue courant, pas une affirmation sur tout le stock de la boutique. Les tabourets hauts existent, leur hauteur d’assise n’est pas renseignée.'};
await fs.writeFile(dossier+'/recettes.json',JSON.stringify(recettes,null,2)+'\n');
await fs.writeFile(dossier+'/inventaire.json',JSON.stringify(inventaire,null,2)+'\n');
console.log(JSON.stringify({nombreCommercial:inventaire.nombreCommercial,nombreGenerique:inventaire.nombreGenerique,nombreProps:inventaire.nombreProps,nombreRecettes:inventaire.nombreRecettes,tapisReordonnes:inventaire.tapisReordonnes,tabouretsCommerciaux:inventaire.tabouretsCommerciaux},null,2));

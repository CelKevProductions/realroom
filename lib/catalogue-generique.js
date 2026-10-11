// Objets de projet RealRoom, distincts des références commerciales Maison Corleone.
// Les dimensions décrivent exactement la maquette ; le prix est une provision indicative.
const DEFINITIONS = [
  ['basse-compacte-60','Table basse compacte · 60 × 40 cm','table',[.6,.4,.38],85,'ovale',['table-basse'],'chêne clair','#C7AD86'],
  ['basse-ronde-60','Table basse ronde · 60 cm','table',[.6,.6,.38],90,'ronde',['table-basse'],'chêne clair','#C7AD86'],
  ['basse-ronde-80','Table basse ronde · 80 cm','table',[.8,.8,.38],140,'ronde',['table-basse'],'travertin','#DED2BD'],
  ['basse-ovale-100','Table basse ovale · 100 cm','table',[1,.55,.38],160,'ovale',['table-basse'],'chêne clair','#C7AD86'],
  ['basse-120','Table basse · 120 cm','table',[1.2,.6,.4],190,'rectangulaire',['table-basse'],'noyer','#78614D'],
  ['basse-140','Grande table basse · 140 cm','table',[1.4,.7,.4],240,'rectangulaire',['table-basse'],'bois noir','#35332F'],
  ['appoint-35','Table d’appoint · 35 cm','table',[.35,.35,.5],55,'ronde',['table-appoint'],'bois noir','#35332F'],
  ['appoint-45','Table d’appoint · 45 cm','table',[.45,.45,.52],75,'ronde',['table-appoint'],'chêne clair','#C7AD86'],
  ['chevet-35','Chevet compact · 35 cm','table',[.35,.35,.5],70,'chevet',['chevet'],'chêne clair','#C7AD86'],
  ['chevet-45','Chevet à tiroir · 45 cm','table',[.45,.4,.52],100,'chevet',['chevet'],'noyer','#78614D'],
  ['repas-100','Table de repas · 4 places','table',[1,.7,.75],220,'rectangulaire',['table-repas'],'chêne clair','#C7AD86'],
  ['repas-160','Table de repas · 6 places','table',[1.6,.85,.75],380,'rectangulaire',['table-repas'],'noyer','#78614D'],
  ['repas-210','Table de repas · 8 places','table',[2.1,.9,.75],520,'rectangulaire',['table-repas'],'chêne clair','#C7AD86'],
  ['chaise-bois','Chaise de repas · bois','chaise',[.43,.47,.82],65,'chaise',['chaise-repas'],'chêne clair','#C7AD86'],
  ['chaise-tissu','Chaise de repas · tissu','chaise',[.48,.52,.84],90,'chaise',['chaise-repas'],'tissu beige','#D9CBB9'],
  ['chaise-noire','Chaise de repas · noire','chaise',[.45,.5,.82],80,'chaise',['chaise-repas'],'bois noir','#35332F'],
  ['bureau-100','Bureau compact · 100 cm','bureau',[1,.5,.75],170,'bureau',['bureau'],'chêne clair','#C7AD86'],
  ['bureau-140','Bureau · 140 cm','bureau',[1.4,.65,.75],260,'bureau',['bureau'],'noyer','#78614D'],
  ['chaise-bureau','Chaise de bureau','chaise',[.56,.57,.95],130,'bureau',['chaise-bureau'],'tissu taupe','#A89A89'],
  ['tv-100','Meuble TV compact · 100 cm','meuble',[1,.35,.45],180,'tv',['meuble-tv'],'chêne clair','#C7AD86'],
  ['tv-160','Meuble TV · 160 cm','meuble',[1.6,.4,.5],290,'tv',['meuble-tv'],'noyer','#78614D'],
  ['buffet-100','Buffet compact · 100 cm','buffet',[1,.4,.8],230,'buffet',['buffet'],'chêne clair','#C7AD86'],
  ['buffet-160','Buffet · 160 cm','buffet',[1.6,.45,.85],390,'buffet',['buffet'],'noyer','#78614D'],
  ['armoire-80','Armoire compacte · 80 cm','armoire',[.8,.55,2],320,'armoire',['armoire'],'chêne clair','#C7AD86'],
  ['armoire-120','Armoire · 120 cm','armoire',[1.2,.6,2.1],490,'armoire',['armoire'],'bois blanc','#E8E2D8'],
  ['commode-80','Commode · 80 cm','commode',[.8,.42,.8],220,'commode',['commode','buffet'],'chêne clair','#C7AD86'],
  ['etagere-60','Bibliothèque compacte · 60 cm','etagere',[.6,.3,1.8],140,'etagere',['etagere'],'chêne clair','#C7AD86'],
  ['etagere-100','Bibliothèque · 100 cm','etagere',[1,.32,1.8],230,'etagere',['etagere'],'noyer','#78614D'],
  ['console-80','Console compacte · 80 cm','console',[.8,.28,.8],110,'console',['console'],'chêne clair','#C7AD86'],
  ['console-120','Console · 120 cm','console',[1.2,.35,.8],170,'console',['console'],'noyer','#78614D'],
  ['banc-90','Banc compact · 90 cm','banc',[.9,.35,.45],100,'banc',['banc'],'tissu beige','#D9CBB9'],
  ['banc-120','Banc · 120 cm','banc',[1.2,.4,.45],160,'banc',['banc'],'tissu taupe','#A89A89'],
  ['tapis-120','Tapis · 120 × 180 cm','tapis',[1.2,1.8,.015],80,'tapis',['tapis'],'tissu écru','#DCCFBA'],
  ['tapis-160','Tapis · 160 × 230 cm','tapis',[1.6,2.3,.015],130,'tapis',['tapis'],'tissu beige','#BFAF97'],
  ['tapis-200','Tapis · 200 × 300 cm','tapis',[2,3,.015],220,'tapis',['tapis'],'tissu écru','#DCCFBA'],
  ['lampe-25','Lampe de table · 25 cm','lampe',[.25,.25,.4],45,'lampe',['lampe-chevet','lampe-bureau','lumiere-salon','lumiere-lecture'],'lin écru','#DFD1B9'],
  ['lampe-32','Lampe de table · 32 cm','lampe',[.32,.32,.5],70,'lampe',['lampe-chevet','lampe-bureau','lumiere-salon','lumiere-lecture'],'lin écru','#DFD1B9'],
  ['lampadaire','Lampadaire de lecture','lampadaire',[.34,.34,1.55],100,'lampadaire',['lumiere-salon','lumiere-lecture'],'métal noir','#35332F'],
  ['miroir-60','Miroir · 60 × 80 cm','miroir',[.6,.035,.8],80,'miroir',['miroir'],'verre et chêne','#C7AD86'],
  ['plante-90','Plante en pot · 90 cm','plante',[.4,.4,.9],50,'plante',['plante'],'végétation','#667A54'],
  ['plante-150','Plante en pot · 150 cm','plante',[.55,.55,1.5],90,'plante',['plante'],'végétation','#667A54'],
  ['portemanteau','Portemanteau sur pied','portemanteau',[.55,.28,1.7],70,'portemanteau',['portemanteau'],'chêne clair','#C7AD86'],
  ['pouf-45','Pouf · 45 cm','pouf',[.45,.45,.42],60,'pouf',['pouf'],'tissu beige','#D9CBB9'],
  ['fauteuil-compact','Fauteuil compact','fauteuil',[.65,.65,.8],230,'fauteuil',['fauteuil-salon','fauteuil-lecture'],'tissu beige','#D9CBB9']
];
export const LIBELLES_GENERIQUES = { chaise:'Chaise', bureau:'Bureau', armoire:'Armoire', commode:'Commode', buffet:'Buffet', etagere:'Bibliothèque', console:'Console', plante:'Plante', portemanteau:'Portemanteau' };
export const OBJETS_GENERIQUES = Object.fromEntries(DEFINITIONS.map(([cle,nom,fam,dim,prix,st,usagesGeneriques,mat,col]) => {
  const id='rr-gen-'+cle;
  return [id,{ id,nom,titre:nom,marque:'RealRoom · Générique',cat:LIBELLES_GENERIQUES[fam] || ({table:'Table',meuble:'Meuble TV',lampe:'Lampe',lampadaire:'Lampadaire',tapis:'Tapis',banc:'Banc',miroir:'Miroir',pouf:'Pouf',fauteuil:'Fauteuil'})[fam],fam,dim,st,prix,
    generique:true,prixEstime:true,usagesGeneriques,cols:[col],couleurs:[mat],mat,bois:/chêne|noyer|bois/.test(mat)?mat:'',metal:'noir',chevets:false,ext:false,dimsLues:true,
    vign:'/generiques/'+id+'.svg',img:null,url:null,texte:'Modèle générique pour préparer votre projet. Budget indicatif à confirmer auprès du vendeur choisi. '+mat+'.',
    points:[['Modèle','Objet générique de projet'],['Budget','Estimation indicative, sans offre de vente']] }];
}));
export function avecObjetsGeneriques(catalogue) {
  return {...catalogue,libelles:{...LIBELLES_GENERIQUES,...catalogue.libelles},produits:{...catalogue.produits,...OBJETS_GENERIQUES,...catalogue.produits}};
}

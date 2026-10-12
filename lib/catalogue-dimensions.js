// Certains tapis sont importés dans l'ordre largeur / épaisseur / longueur.
// Réordonner seulement ce cas non ambigu, sans inventer ni modifier une mesure.
export function normaliserDimensionsCatalogue(catalogue) {
  return {...catalogue,produits:Object.fromEntries(Object.entries(catalogue.produits).map(([id,p])=>[id,
    p.fam==='tapis'&&p.dim?.[1]>0&&p.dim[1]<=.1&&p.dim[2]>=.4
      ?{...p,dim:[p.dim[0],p.dim[2],p.dim[1]],dimSource:[...p.dim],ordreDimensionsSource:'largeur-epaisseur-longueur'}:p]))};
}

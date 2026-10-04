'use client';
// Le logo de la boutique (le « MC » de maisoncorleone.com), servi par le CDN Shopify comme les
// photos des produits. Il prend la couleur du texte qui l'entoure (espresso sur les écrans clairs,
// crème sur les fonds sombres) : son ombre portée, décalée hors de la boîte puis ramenée à sa
// place, en garde la forme exacte dans la couleur voulue (pas besoin d'accès CORS à l'image).
// S'il ne se charge pas, les initiales MC, en Didone, prennent sa place.
import { useEffect, useRef, useState } from 'react';

export const LOGO_MC = 'https://cdn.shopify.com/s/files/1/0938/1055/7195/files/Maison_Corleone_Logo.png?v=1786652952';

export default function Logo({ largeur = 360, className = '' }) {
  const img = useRef(null);
  const [panne, setPanne] = useState(false);
  // image en échec avant que React ne s'y abonne (chargée pendant l'hydratation)
  useEffect(() => { const i = img.current; if (i && i.complete && !i.naturalWidth) setPanne(true); }, []);
  return (
    <span className={`mc-logo${panne ? ' is-panne' : ''}${className ? ' ' + className : ''}`}>
      {panne
        ? <span className="mc-logo__mc" aria-hidden="true">MC</span>
        : <img ref={img} src={`${LOGO_MC}&width=${largeur}`} alt="" width="1024" height="303" decoding="async" draggable="false" onError={() => setPanne(true)} />}
    </span>
  );
}

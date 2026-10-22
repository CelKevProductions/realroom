'use client';
// Le nom couché du pied de page : « RealRoom » en 3D, de petits bonhommes qui sautent et jouent dessus
// (piece3d/pied.js, chargé seulement quand le pied approche). Le nom en HTML reste dessous : il
// s'efface quand le mot 3D arrive (data-etat="prete" sur .acc-pied__scene), et reste seul sans WebGL.
import { useEffect, useRef } from 'react';
import { webgl2 } from './PieceAccueil.js';

const TEXTES = { fr: { animal: 'Coucou !', lettre: 'Hop !' }, en: { animal: 'Hi!', lettre: 'Hop!' } };

export default function PiedAccueil({ lang = 'fr' }) {
  const boite = useRef(null);
  const toile = useRef(null);

  useEffect(() => {
    const el = boite.current, scene = el.parentElement;
    if (!webgl2()) return undefined;
    let vivant = true, pied = null;
    const effacer = () => { delete scene.dataset.etat; };
    const charger = () => import('./piece3d/pied.js').then(({ creerPied }) => {
      if (!vivant) return;
      pied = creerPied({
        toile: toile.current, boite: el, zone: el.closest('footer') || scene, textes: TEXTES[lang] || TEXTES.fr,
        surPrete: () => { scene.dataset.etat = 'prete'; },
        surPanne: () => { pied?.detruire(); pied = null; effacer(); }
      });
    }).catch(err => { console.error(err); effacer(); });
    // three.js n'arrive qu'à l'approche du pied de page
    const io = new IntersectionObserver(entrees => {
      if (!entrees.some(e => e.isIntersecting)) return;
      io.disconnect();
      charger();
    }, { rootMargin: '900px 0px' });
    io.observe(el);
    return () => {
      vivant = false;
      io.disconnect();
      pied?.detruire();
      pied = null;
      effacer();
    };
  }, [lang]);

  return (
    <div ref={boite} className="acc-pied__3d" aria-hidden="true">
      <canvas ref={toile} />
    </div>
  );
}

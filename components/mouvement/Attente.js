'use client';
// Indicateurs d'activité animés par GSAP : rouage et croquis qui se trace. Ils disent « en
// cours », jamais « à 60 % » : une progression affichée vient toujours d'une étape réellement
// terminée (voir Progression). Mouvement réduit : immobiles.
import { useRef } from 'react';
import { useBoucle } from './react.js';
import { COURBES } from './regles.js';

export function Rouage({ petit = true, className = '', ...props }) {
  const ref = useRef(null);
  useBoucle(ref, (tl, el) => tl.to(el, { rotation: 360, duration: .9, ease: COURBES.lineaire }));
  return <span ref={ref} className={'rouage' + (petit ? ' rouage--petit' : '') + (className ? ' ' + className : '')} aria-hidden="true" {...props} />;
}

// Croquis au trait d'une pièce : les lignes se tracent puis s'effacent, le tapis apparaît.
export function CroquisAnime({ className }) {
  const ref = useRef(null);
  useBoucle(ref, (tl, el) => {
    const traits = el.querySelectorAll('path:not(.croquis__tapis)'), tapis = el.querySelector('.croquis__tapis');
    tl.fromTo(traits, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.45, ease: COURBES.arrivee, stagger: .08 })
      .fromTo(tapis, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: .6, ease: COURBES.douce }, .95)
      .to(traits, { strokeDashoffset: -1, duration: .7, ease: COURBES.depart }, 2.5)
      .to(tapis, { opacity: 0, duration: .4 }, 2.5);
    return tl;
  });
  return (
    <svg ref={ref} className={'croquis croquis--trace' + (className ? ' ' + className : '')} viewBox="0 0 64 64" aria-hidden="true">
      <path pathLength="1" d="M32 54 8 42 32 30 56 42Z" />
      <path pathLength="1" d="M8 42V18L32 6v24" />
      <path pathLength="1" d="M32 6l24 12v24" />
      <path className="croquis__tapis" d="m22 42 10 5 10-5-10-5z" />
    </svg>
  );
}

// Progression réelle : étapes terminées sur étapes connues, avec leur nom.
export function Progression({ etapes, libelle }) {
  const faites = etapes.filter(e => e.fait).length;
  return (
    <div className="progression" role="group" aria-label={libelle}>
      <progress max={etapes.length} value={faites}>{faites}/{etapes.length}</progress>
      <ol>{etapes.map(e => <li key={e.id} className={e.fait ? 'is-fait' : e.encours ? 'is-actif' : undefined} aria-current={e.encours ? 'step' : undefined}>{e.nom}</li>)}</ol>
    </div>
  );
}

// Ligne qui balaie une image en cours de calcul (activité, pas avancement).
export function Balayage() {
  const ref = useRef(null);
  useBoucle(ref, (tl, el) => tl.fromTo(el, { yPercent: 0 }, { yPercent: 100, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: 1 }));
  return <span ref={ref} className="rendu-attente__balayage" aria-hidden="true" />;
}

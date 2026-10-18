'use client';
// Le panda de RealRoom : le guide des explications (parcours, guide de bienvenue, attentes).
// Dessin à l'encre sur plâtre, joues et mètre ruban rouille, comme les plans du site.
// Vivant mais discret : il cligne des yeux et penche la tête de temps en temps (boucle suspendue
// hors de l'écran) ; à l'arrivée, il salue. Mouvement réduit : immobile.
import { useRef } from 'react';
import { useAnimation, useBoucle } from './react.js';
import { gsap, mouvementPermis, COURBES } from './regles.js';

export function Panda({ taille = 72, geste = 'salut', accessoire = 'metre', className = '' }) {
  const ref = useRef(null);
  // arrivée : le panda se pose, puis salue de la patte
  useAnimation(ref, el => {
    if (!mouvementPermis()) return;
    const tl = gsap.timeline();
    tl.fromTo(el, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .5, ease: 'back.out(2)', clearProps: 'transform,opacity,visibility' })
      .fromTo(el.querySelector('.panda__tete'), { rotation: 8, svgOrigin: '80 100' }, { rotation: 0, svgOrigin: '80 100', duration: .6, ease: 'elastic.out(1, .5)' }, .15);
    if (geste === 'salut') tl.to(el.querySelector('.panda__patte-d'), { rotation: -38, svgOrigin: '112 114', duration: .22, ease: 'sine.inOut', yoyo: true, repeat: 3 }, .35);
  }, [geste]);
  // repos : clignement et tête qui penche
  useBoucle(ref, (tl, el) => {
    const yeux = el.querySelectorAll('.panda__oeil'), tete = el.querySelector('.panda__tete');
    tl.to(yeux, { scaleY: .1, duration: .08, transformOrigin: '50% 50%', ease: COURBES.lineaire }, 3.2)
      .to(yeux, { scaleY: 1, duration: .12, ease: COURBES.lineaire })
      .to(tete, { rotation: -6, duration: .6, svgOrigin: '80 100', ease: 'sine.inOut' }, 4.4)
      .to(tete, { rotation: 0, duration: .7, svgOrigin: '80 100', ease: 'sine.inOut' }, 5.6)
      .to({}, { duration: 1.4 });
    return tl;
  });
  return (
    <svg ref={ref} className={'panda' + (className ? ' ' + className : '')} viewBox="0 0 160 170" width={taille} height={taille * 170 / 160} aria-hidden="true" focusable="false">
      <g className="panda__trait">
        <path className="panda__corps" d="M42 150c-6-26 6-50 38-50s44 24 38 50z" />
        <path className="panda__noir panda__patte-g" d="M50 112c-10 8-12 20-6 26 6 5 14-2 16-10" />
        <path className="panda__noir panda__patte-d" d="M110 112c10 6 14 14 12 20-2 6-10 6-14 0" />
        <ellipse className="panda__noir" cx="60" cy="151" rx="13" ry="8" />
        <ellipse className="panda__noir" cx="100" cy="151" rx="13" ry="8" />
      </g>
      <g className="panda__tete">
        <g className="panda__trait">
          <circle className="panda__noir" cx="46" cy="34" r="14" />
          <circle className="panda__noir" cx="114" cy="34" r="14" />
          <path className="panda__corps" d="M80 22c30 0 50 18 50 44 0 26-22 40-50 40S30 92 30 66c0-26 20-44 50-44z" />
        </g>
        <ellipse className="panda__noir-plein" cx="60" cy="64" rx="11" ry="14" transform="rotate(28 60 64)" />
        <ellipse className="panda__noir-plein" cx="100" cy="64" rx="11" ry="14" transform="rotate(-28 100 64)" />
        <g className="panda__oeil"><circle className="panda__blanc" cx="62" cy="63" r="4.2" /><circle className="panda__noir-plein" cx="63.4" cy="61.6" r="1.4" /></g>
        <g className="panda__oeil"><circle className="panda__blanc" cx="98" cy="63" r="4.2" /><circle className="panda__noir-plein" cx="99.4" cy="61.6" r="1.4" /></g>
        <ellipse className="panda__joue" cx="50" cy="84" rx="7" ry="4" />
        <ellipse className="panda__joue" cx="110" cy="84" rx="7" ry="4" />
        <path className="panda__noir-plein" d="M75 76.5c0-2 10-2 10 0 0 3-3 5-5 5s-5-2-5-5z" />
        <path className="panda__bouche" d="M80 82v3M73 86c3 3 5 3 7 0 2 3 4 3 7 0" />
      </g>
      {accessoire === 'metre' && (
        <g className="panda__metre">
          <rect x="34" y="128" width="16" height="14" rx="4" />
          <path d="M50 136h40M58 133v3M66 133v3M74 133v3M82 133v3" />
        </g>
      )}
      {accessoire === 'crayon' && (
        <g className="panda__metre">
          <path d="M40 140l30-30 6 6-30 30-8 2z" />
        </g>
      )}
    </svg>
  );
}

// Le panda et sa phrase, dans une bulle. La phrase reste un texte normal (lue par les lecteurs d'écran).
export function Guide({ texte, geste, accessoire, taille = 84, className = '' }) {
  return (
    <div className={'guide-panda' + (className ? ' ' + className : '')}>
      <Panda taille={taille} geste={geste} accessoire={accessoire} />
      {texte && <p className="guide-panda__bulle">{texte}</p>}
    </div>
  );
}

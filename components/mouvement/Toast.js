'use client';
// Message bref en bas d'écran (role=status) : il monte en fondu, puis le parent le retire.
// Sans mouvement, il est simplement affiché.
import { useRef } from 'react';
import { useAnimation } from './react.js';
import { gsap, mouvementPermis, DUREES, COURBES, ECARTS } from './regles.js';

export default function Toast({ erreur, children }) {
  const ref = useRef(null);
  useAnimation(ref, el => { if (mouvementPermis()) gsap.from(el, { autoAlpha: 0, y: ECARTS.moyen, duration: DUREES.moyen, ease: COURBES.arrivee }); });
  return <div ref={ref} className={'toast' + (erreur ? ' toast--erreur' : '')} role="status">{children}</div>;
}

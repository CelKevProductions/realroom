'use client';
// Les règles d'animation (regles.js) dans React : React garde l'état et les composants, GSAP
// ne fait qu'accompagner. Chaque animation vit dans un gsap.context rattaché à son composant :
// démontage, remontage du mode strict, navigation et changement d'étape la nettoient (revert),
// sans doublon ni écouteur oublié.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap, initialiser, mouvementPermis, entrer, annoncer, focaliser, boucle, DUREES, COURBES, ECARTS, DECALAGES } from './regles.js';

export const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// fn(contexte) crée ses animations ; elles sont annulées au nettoyage.
export function useAnimation(ref, fn, deps = []) {
  const f = useRef(fn); f.current = fn;
  useIsoLayout(() => {
    const el = ref.current;
    if (!el) return undefined;
    initialiser();
    let nettoyage;
    const ctx = gsap.context(self => { nettoyage = f.current(el, self); }, el);
    return () => { if (typeof nettoyage === 'function') nettoyage(); ctx.revert(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Indicateur d'activité animé tant que l'élément est visible.
export function useBoucle(ref, creer, actif = true) {
  const f = useRef(creer); f.current = creer;
  useEffect(() => (actif ? boucle(ref.current, tl => f.current(tl, ref.current)) : undefined), [ref, actif]);
}

// Copie inerte de l'écran qui part : elle se fond pendant que le nouveau entre. Le nouvel écran
// est utilisable tout de suite ; la copie ne capte ni clic, ni focus, ni lecteur d'écran.
function fantome(el, sens) {
  const scene = el.parentElement;
  if (!scene || !mouvementPermis() || el.querySelector('canvas,video')) return;
  const copie = el.cloneNode(true);
  copie.removeAttribute('id');
  copie.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  copie.querySelectorAll('[data-titre-etape]').forEach(n => n.removeAttribute('data-titre-etape'));
  copie.inert = true;
  copie.setAttribute('aria-hidden', 'true');
  copie.dataset.fantome = '';
  Object.assign(copie.style, { position: 'absolute', left: el.offsetLeft + 'px', top: el.offsetTop + 'px', width: el.offsetWidth + 'px', margin: 0, pointerEvents: 'none' });
  // Le nettoyage précède le retrait réel du DOM. Si l'élément est toujours là ensuite (remontage
  // du mode strict), il n'y a pas de sortie à montrer.
  queueMicrotask(() => {
    if (el.isConnected || !scene.isConnected) return;
    scene.querySelectorAll(':scope > [data-fantome]').forEach(n => { gsap.killTweensOf(n); n.remove(); });
    scene.appendChild(copie);
    gsap.to(copie, { autoAlpha: 0, x: -sens * ECARTS.grand, duration: DUREES.court, ease: COURBES.depart, onComplete: () => copie.remove() });
  });
}

// Une étape d'un parcours. À utiliser avec une clé par étape (key={etape}) dans un conteneur
// en position relative : à chaque changement, l'ancienne étape sort en fondu, la nouvelle
// entre, le focus va sur son titre et le titre est annoncé.
export function Etape({ titre, sens = 1, as: Balise = 'section', className, children, focus = true, ...props }) {
  const ref = useRef(null);
  const sensRef = useRef(sens); sensRef.current = sens;
  useIsoLayout(() => {
    const el = ref.current;
    if (!el) return undefined;
    initialiser();
    const parties = el.querySelectorAll(':scope > *');
    // opacité seulement (pas autoAlpha) : l'étape reste focalisable et utilisable dès son arrivée
    const tw = mouvementPermis()
      ? gsap.fromTo(parties, { opacity: 0, x: sensRef.current * ECARTS.grand }, { opacity: 1, x: 0, duration: DUREES.moyen, stagger: DECALAGES.serre, ease: COURBES.arrivee, clearProps: 'opacity,transform' })
      : null;
    if (focus) focaliser(el.querySelector('[data-titre-etape]') || el);
    if (titre) annoncer(titre);
    return () => { tw?.progress(1).kill(); fantome(el, sensRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Balise ref={ref} className={className} {...props}>{children}</Balise>;
}

// Contenu remplacé après un geste (onglet, résultat) : il glisse en place.
export function useApparition(ref, cle, o) {
  const premier = useRef(true);
  useIsoLayout(() => {
    if (premier.current && !o?.auPremier) { premier.current = false; return undefined; }
    premier.current = false;
    const tw = entrer(o?.enfants === false ? ref.current : ref.current?.children, o);
    return () => { tw?.progress(1).kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
}

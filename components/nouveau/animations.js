'use client';
// Mouvements du nouveau projet (GSAP), composés à partir des règles communes (mouvement/regles.js) :
// une question entre par le bas et l'ancienne part vers le haut (le sens s'inverse au retour),
// le titre se révèle ligne à ligne, le plan se trace comme à la main.
// Mouvement réduit : rien ne bouge, tout est à sa place tout de suite.
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { gsap, initialiser, mouvementPermis, DUREES, COURBES, DECALAGES } from '@/components/mouvement/regles.js';

let pret = false;
function preparer() {
  initialiser();
  if (!pret) { gsap.registerPlugin(SplitText, DrawSVGPlugin); pret = true; }
}

// Entrée d'une question : ses parties [data-q] glissent en place, le titre monte ligne à ligne.
// Le découpage du titre est défait à la fin : React retrouve son texte tel qu'il l'a écrit.
export function entrerQuestion(el, sens = 1) {
  if (!el || !mouvementPermis()) return () => {};
  preparer();
  const parties = el.querySelectorAll('[data-q]');
  const titre = el.querySelector('[data-titre-etape]');
  const tl = gsap.timeline();
  tl.fromTo(parties, { opacity: 0, y: sens * 42 }, { opacity: 1, y: 0, duration: DUREES.long, stagger: DECALAGES.normal, ease: COURBES.arrivee, clearProps: 'opacity,transform' }, 0);
  let decoupe = null;
  if (titre && titre.textContent.length < 160) {
    decoupe = SplitText.create(titre, { type: 'lines', mask: 'lines' });
    tl.fromTo(decoupe.lines, { yPercent: sens > 0 ? 108 : -108 }, { yPercent: 0, duration: DUREES.titre * .8, stagger: .08, ease: COURBES.arrivee, onComplete: () => { decoupe?.revert(); decoupe = null; } }, .04);
  }
  return () => { tl.progress(1).kill(); decoupe?.revert(); };
}

// Copie inerte de la question qui part : elle s'efface vers le haut (vers le bas au retour)
// pendant que la suivante arrive. Elle ne capte ni clic, ni focus, ni lecteur d'écran.
export function sortirQuestion(el, sens = 1) {
  const conteneur = el?.parentElement;
  if (!conteneur || !mouvementPermis()) return;
  preparer();
  const copie = el.cloneNode(true);
  copie.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  copie.querySelectorAll('[data-titre-etape]').forEach(n => n.removeAttribute('data-titre-etape'));
  copie.inert = true;
  copie.setAttribute('aria-hidden', 'true');
  copie.dataset.fantome = '';
  Object.assign(copie.style, { position: 'absolute', left: el.offsetLeft + 'px', top: el.offsetTop + 'px', width: el.offsetWidth + 'px', margin: 0, pointerEvents: 'none' });
  queueMicrotask(() => {
    // remontage du mode strict : l'élément est toujours là, il n'y a rien à faire partir
    if (el.isConnected || !conteneur.isConnected) return;
    conteneur.querySelectorAll(':scope > [data-fantome]').forEach(n => { gsap.killTweensOf(n); n.remove(); });
    conteneur.appendChild(copie);
    gsap.to(copie, { autoAlpha: 0, y: -sens * 56, duration: DUREES.moyen, ease: COURBES.depart, onComplete: () => copie.remove() });
  });
}

// Le plan se trace : le sol, les murs trait par trait, les ouvertures, les cotes, puis les meubles
// qui se posent. Rend la timeline (à annuler au nettoyage) ou null en mouvement réduit.
export function tracerPlan(svg, o = {}) {
  if (!svg || !mouvementPermis()) return null;
  preparer();
  const q = gsap.utils.selector(svg);
  const tl = gsap.timeline({ delay: o.delai ?? 0, defaults: { overwrite: 'auto' } });
  tl.fromTo(q('.pv-sol'), { opacity: 0 }, { opacity: 1, duration: .6, ease: 'none' }, 0)
    .fromTo(q('.pv-mur'), { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: .7, stagger: { each: .07, from: 'start' }, ease: 'power2.inOut' }, .05)
    .fromTo(q('.pv-ouverture'), { opacity: 0 }, { opacity: 1, duration: .45, stagger: .06 }, '-=.35')
    .fromTo(q('.pv-cote'), { opacity: 0 }, { opacity: 1, duration: .5 }, '<');
  if (o.meubles !== false) tl.add(poserMeubles(svg), '-=.25');
  return tl;
}

// Les meubles se posent un par un, avec un léger rebond (tapis d'abord : ils sont dessinés en premier).
export function poserMeubles(svg, o = {}) {
  if (!svg || !mouvementPermis()) return null;
  preparer();
  const meubles = svg.querySelectorAll('.pv-meuble');
  if (!meubles.length) return gsap.timeline();
  return gsap.timeline().fromTo(meubles, { opacity: 0, scale: o.depart ?? .55, transformOrigin: '50% 50%' },
    { opacity: 1, scale: 1, duration: .55, stagger: { each: o.ecart ?? .05 }, ease: 'back.out(1.8)', overwrite: 'auto' });
}

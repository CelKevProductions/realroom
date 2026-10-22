// Curseur compagnon (accueil) : une pastille corail suit la souris avec un léger retard, grossit en
// anneau sur ce qui se clique et affiche un mot sur les zones marquées data-curseur (« Glisse »…) ;
// il s'efface sur une zone marquée data-curseur-cache (on y tient quelque chose qu'il cacherait).
// Décoratif : le vrai curseur reste visible. Souris seulement, jamais en mouvement réduit.
// Renvoie la fonction qui le retire.
import { gsap } from 'gsap';

const CLIQUABLE = 'a, button, summary, [role="button"], label, select';
const SAISIE = 'input, textarea, [contenteditable="true"]';

export function suivreCurseur() {
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const el = document.createElement('div');
  el.className = 'rr-curseur';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span class="rr-curseur__point"></span><span class="rr-curseur__mot"></span>';
  document.body.appendChild(el);
  const mot = el.lastChild;
  const allerX = gsap.quickTo(el, 'x', { duration: .38, ease: 'power3.out' });
  const allerY = gsap.quickTo(el, 'y', { duration: .38, ease: 'power3.out' });
  let premier = true, etat = '';

  const poser = (e, texte) => {
    if (etat === e && mot.textContent === texte) return;
    etat = e;
    el.dataset.etat = e;
    if (texte) mot.textContent = texte;
  };
  const surMouvement = e => {
    if (e.pointerType !== 'mouse') return;
    if (premier) { premier = false; gsap.set(el, { x: e.clientX, y: e.clientY }); }
    allerX(e.clientX);
    allerY(e.clientY);
    const cible = e.target instanceof Element ? e.target : null;
    const zone = cible?.closest('[data-curseur]');
    if (!cible || cible.closest(SAISIE) || cible.closest('[data-curseur-cache]')) poser('cache');
    else if (zone) poser('mot', zone.getAttribute('data-curseur'));
    else if (cible.closest(CLIQUABLE)) poser('lien');
    else poser('point');
  };
  const cacher = () => poser('cache');
  const enfoncer = () => el.classList.add('is-presse');
  const relacher = () => el.classList.remove('is-presse');
  addEventListener('pointermove', surMouvement, { passive: true });
  document.documentElement.addEventListener('pointerleave', cacher);
  addEventListener('pointerdown', enfoncer, { passive: true });
  addEventListener('pointerup', relacher, { passive: true });
  poser('cache');
  return () => {
    removeEventListener('pointermove', surMouvement);
    document.documentElement.removeEventListener('pointerleave', cacher);
    removeEventListener('pointerdown', enfoncer);
    removeEventListener('pointerup', relacher);
    gsap.killTweensOf(el);
    el.remove();
  };
}

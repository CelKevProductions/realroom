'use client';
// Animations de l'édition Maison Corleone (GSAP), dans l'esprit de la visite privée :
// lettres étirées qui se posent, script qui glisse, repères en chasse fixe qui se déchiffrent.
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { CustomEase } from 'gsap/CustomEase';

let pret = false;
export function initGsap() {
  if (pret || typeof window === 'undefined') return gsap;
  gsap.registerPlugin(SplitText, ScrambleTextPlugin, CustomEase);
  CustomEase.create('mc', '0.7,0,0.2,1');
  CustomEase.create('mcOut', '0.16,1,0.3,1');
  // images lentes (petits appareils) : le temps reste réel
  gsap.ticker.lagSmoothing(1200, 33);
  pret = true;
  return gsap;
}
export { gsap, SplitText };

export const reduit = () => typeof window !== 'undefined' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// découpe en lettres (et mots) ; renvoie les lettres
export function lettres(el) {
  if (!el) return [];
  initGsap();
  if (el.__split) el.__split.revert();
  el.__split = SplitText.create(el, { type: 'words,chars', wordsClass: 'mot', charsClass: 'char' });
  return el.__split.chars;
}

// titre : lettres étirées et floues qui se posent (visite privée)
export function entreeTitre(chars, delai = 0) {
  if (!chars || !chars.length || reduit()) return gsap.timeline();
  return gsap.timeline({ delay: delai }).fromTo(chars,
    { opacity: 0, scaleY: 1.9, yPercent: -12, filter: 'blur(8px)', transformOrigin: '50% 0%' },
    { opacity: 1, scaleY: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.2, stagger: .03, ease: 'expo.out', overwrite: true });
}
export function entreeScript(chars, delai = 0) {
  if (!chars || !chars.length || reduit()) return gsap.timeline();
  return gsap.timeline({ delay: delai }).fromTo(chars, { opacity: 0, x: -12, filter: 'blur(6px)' },
    { opacity: 1, x: 0, filter: 'blur(0px)', duration: 1, stagger: .03, ease: 'power2.out', overwrite: true });
}
export function sortieLettres(chars) {
  if (!chars || !chars.length || reduit()) return gsap.timeline();
  return gsap.timeline().to(chars, { opacity: 0, filter: 'blur(10px)', yPercent: -16, duration: .45, stagger: .01, ease: 'power2.in', overwrite: true });
}
// repère en chasse fixe : se déchiffre comme un écran de contrôle
export function dechiffrer(el, texte, duree = .9) {
  if (!el) return;
  if (reduit()) { el.textContent = texte; return; }
  initGsap();
  gsap.to(el, { duration: duree, scrambleText: { text: texte, chars: '01·—/×ABCDEFGHIJKLMNOPRSTUVWXYZ', revealDelay: .15, speed: .6 }, ease: 'none', overwrite: true });
}
// éléments qui montent en fondu (après le titre) ; en opacité seule : cliquables dès le départ,
// même si l'animation traîne sur un appareil lent
export function monter(els, delai = 0, y = 26) {
  const l = Array.from(els || []).filter(Boolean);
  if (!l.length || reduit()) return gsap.timeline();
  return gsap.timeline({ delay: delai }).fromTo(l, { opacity: 0, y }, { opacity: 1, y: 0, duration: .9, stagger: .06, ease: 'mcOut', overwrite: true, clearProps: 'transform,opacity' });
}

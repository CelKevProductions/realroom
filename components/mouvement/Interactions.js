'use client';
// Petites réactions communes à tout le site, par délégation (un seul jeu d'écouteurs sur document,
// posé une fois dans la mise en page) :
//  - les cartes s'inclinent vers le curseur et se soulèvent, puis reviennent en ressort ;
//  - les grands boutons sont « aimantés » : ils suivent un peu le curseur ;
//  - un bouton s'enfonce sous le clic et rebondit au relâcher ;
//  - une action principale lâche un anneau discret au clic.
// Transform seulement, jamais au doigt (inclinaison et aimant) ni en mouvement réduit : le CSS garde
// alors ses propres survols. Pour l'ajouter ailleurs : data-incline, data-aimant, data-presse, data-eclat.
// Maison Corleone (.mc) garde son allure : rien ne s'y applique.
import { useEffect } from 'react';
import { gsap, initialiser, mouvementPermis } from './regles.js';

const INCLINE = '[data-incline], .acc-pack, .carte-projet__image, .carte-vide';
const AIMANT = '[data-aimant], .acc-bouton, .btn--large, .parcours__boutons .btn--plein';
const PRESSE = '[data-presse], .btn, .acc-bouton, .puce-bouton, .carte-piece, .carte-vide';
const ECLAT = '[data-eclat], .acc-bouton, .btn--plein, .btn--accent';
// ressort : raideur, amortissement (sous-amorti : un léger dépassement au retour)
const RAIDEUR = 210, AMORTI = 17, AMORTI_AIMANT = 11;
const borne = (v, a, b) => Math.min(b, Math.max(a, v));
// élément visé, hors Maison Corleone
const viseHorsMaison = e => (e.target instanceof Element && !e.target.closest('.mc') ? e.target : null);

export default function Interactions() {
  useEffect(() => {
    initialiser();
    const fin = matchMedia('(pointer: fine)');
    const ressorts = new Map();   // élément → état du ressort (inclinaison ou aimant)
    let survoles = new Set();

    // ---------- ressorts (un pas par image, tant que quelque chose bouge)
    function ressort(el, sorte) {
      let r = ressorts.get(el);
      if (!r) {
        r = { sorte, x: 0, y: 0, rx: 0, ry: 0, vx: 0, vy: 0, vrx: 0, vry: 0, cx: 0, cy: 0, crx: 0, cry: 0 };
        ressorts.set(el, r);
        if (ressorts.size === 1) gsap.ticker.add(pas);
      }
      return r;
    }
    function viser(r, cibles) { Object.assign(r, { cx: 0, cy: 0, crx: 0, cry: 0 }, cibles); }
    function pas(_, ms) {
      const dt = Math.min(.034, (ms || 16) / 1000);
      for (const [el, r] of ressorts) {
        const c = survoles.has(el) ? AMORTI : (r.sorte === 'aimant' ? AMORTI_AIMANT : AMORTI);
        let calme = true;
        for (const [p, v, k] of [['x', 'vx', 'cx'], ['y', 'vy', 'cy'], ['rx', 'vrx', 'crx'], ['ry', 'vry', 'cry']]) {
          r[v] += (RAIDEUR * (r[k] - r[p]) - c * r[v]) * dt;
          r[p] += r[v] * dt;
          if (Math.abs(r[p] - r[k]) > .01 || Math.abs(r[v]) > .01) calme = false;
        }
        if (calme && !survoles.has(el) && !r.cx && !r.cy && !r.crx && !r.cry) {
          ressorts.delete(el);
          if (!gsap.isTweening(el)) gsap.set(el, { clearProps: 'transform' });
          continue;
        }
        gsap.set(el, r.sorte === 'incline'
          ? { x: r.x, y: r.y, rotationX: r.rx, rotationY: r.ry, transformPerspective: 900 }
          : { x: r.x, y: r.y });
      }
      if (!ressorts.size) gsap.ticker.remove(pas);
    }
    function relacher(sauf = new Set()) {
      for (const [el, r] of ressorts) if (!sauf.has(el)) viser(r, {});
    }

    // ---------- survol : inclinaison et aimant
    const surMouvement = e => {
      if (!fin.matches || !mouvementPermis() || e.pointerType === 'touch') return;
      const cible = viseHorsMaison(e);
      const actifs = new Set();
      // on ne penche pas une carte qu'on est en train de faire glisser (vitrine)
      const carte = e.buttons ? null : cible?.closest(INCLINE);
      if (carte) {
        const b = carte.getBoundingClientRect();
        const nx = borne((e.clientX - b.left) / b.width * 2 - 1, -1, 1), ny = borne((e.clientY - b.top) / b.height * 2 - 1, -1, 1);
        // les cartes de l'accueil penchent franchement, celles de l'application à peine
        const a = carte.classList.contains('acc-pack') || carte.hasAttribute('data-incline') ? 1 : .5;
        viser(ressort(carte, 'incline'), { cry: nx * 7 * a, crx: -ny * 6 * a, cy: -6 * a });
        actifs.add(carte);
      }
      const bouton = cible?.closest(AIMANT);
      if (bouton && !bouton.disabled && bouton.getAttribute('aria-disabled') !== 'true') {
        const b = bouton.getBoundingClientRect();
        viser(ressort(bouton, 'aimant'), {
          cx: borne((e.clientX - (b.left + b.width / 2)) * .22, -9, 9),
          cy: borne((e.clientY - (b.top + b.height / 2)) * .3, -7, 7)
        });
        actifs.add(bouton);
      }
      survoles = actifs;
      relacher(actifs);
    };
    const toutRelacher = () => { survoles = new Set(); relacher(); };

    // ---------- clic : le bouton s'enfonce puis rebondit ; un anneau s'élargit sur une action principale
    let presse = null;
    const enfoncer = e => {
      if (e.button !== 0 || !mouvementPermis()) return;
      const cible = viseHorsMaison(e);
      const el = cible?.closest(PRESSE);
      if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') {
        presse = el;
        gsap.to(el, { scale: .955, duration: .12, ease: 'power2.out', overwrite: 'auto' });
      }
      const eclat = cible?.closest(ECLAT);
      if (eclat && !eclat.disabled && eclat.getAttribute('aria-disabled') !== 'true') eclater(e.clientX, e.clientY);
    };
    const relever = () => {
      if (!presse) return;
      const el = presse;
      presse = null;
      gsap.to(el, {
        scale: 1, duration: .65, ease: 'elastic.out(1, .42)', overwrite: 'auto',
        onComplete: () => { if (!ressorts.has(el)) gsap.set(el, { clearProps: 'transform' }); }
      });
    };

    let couche = null;
    function eclater(x, y) {
      if (!couche) {
        couche = document.createElement('div');
        couche.className = 'rr-eclats';
        couche.setAttribute('aria-hidden', 'true');
        document.body.appendChild(couche);
      }
      const anneau = document.createElement('span');
      anneau.className = 'rr-eclats__anneau';
      couche.appendChild(anneau);
      gsap.fromTo(anneau, { x, y, scale: .2, opacity: .9 }, { scale: 2.6, opacity: 0, duration: .55, ease: 'power2.out', onComplete: () => anneau.remove() });
    }

    document.addEventListener('pointermove', surMouvement, { passive: true });
    document.addEventListener('pointerdown', enfoncer, { passive: true });
    addEventListener('pointerup', relever, { passive: true });
    addEventListener('pointercancel', relever, { passive: true });
    document.documentElement.addEventListener('pointerleave', toutRelacher);
    addEventListener('blur', toutRelacher);
    addEventListener('scroll', toutRelacher, { passive: true });
    return () => {
      document.removeEventListener('pointermove', surMouvement);
      document.removeEventListener('pointerdown', enfoncer);
      removeEventListener('pointerup', relever);
      removeEventListener('pointercancel', relever);
      document.documentElement.removeEventListener('pointerleave', toutRelacher);
      removeEventListener('blur', toutRelacher);
      removeEventListener('scroll', toutRelacher);
      gsap.ticker.remove(pas);
      ressorts.forEach((_, el) => gsap.set(el, { clearProps: 'transform' }));
      ressorts.clear();
      couche?.remove();
    };
  }, []);
  return null;
}

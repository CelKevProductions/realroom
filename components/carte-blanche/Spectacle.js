'use client';
// Toute la vie de l'accueil « Carte blanche » : la toile three.js fixe derrière la page (le nuage de points
// de nuage.js), le défilement doux (Lenis) qui pilote l'histoire en cinq actes (ScrollTrigger), le
// préchargement, le curseur, le bouton Shuffle et le passage de la nuit au jour au rendu photo.
// Sans WebGL ou avec « réduire les animations », la page reste lisible : textes visibles, photo en fond.
import { useEffect } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { webgl2 } from '@/components/accueil/PieceAccueil.js';

const NUIT = [14, 13, 12], JOUR = [239, 232, 221], IVOIRE = [237, 230, 218], ENCRE = [27, 25, 24];
const melange = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rad = d => d * Math.PI / 180;
// cadrages de la caméra, un par moment de l'histoire : azimut, élévation (degrés), distance, hauteur visée
const CADRES = {
  heros: { az: 38, el: 16, r: 10.5, y: 1.3, dx: 0.12 },
  scan: { az: 24, el: 20, r: 8.6, y: 1.0, dx: 0.2 },
  plan: { az: 0.01, el: 89, r: 11, y: 0, dx: 0.2 },
  meubles: { az: -28, el: 30, r: 9.2, y: 0.8, dx: 0.2 },
  shuffle: { az: -40, el: 46, r: 9.2, y: 0.4, dx: 0.2 },
  rendu: { az: 14, el: 13, r: 7.9, y: 1.05, dx: -0.19 }
};

export default function Spectacle() {
  useEffect(() => {
    const page = document.querySelector('.cb');
    const toile = page?.querySelector('.cb-toile canvas');
    if (!page || !toile) return undefined;
    const doux = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tactile = matchMedia('(pointer: coarse)').matches;
    gsap.registerPlugin(ScrollTrigger);
    const nettoyer = [];
    let vivant = true;
    const fini = () => page.setAttribute('data-pret', '');

    // ---------- défilement doux
    let lenis = null;
    if (!doux) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
      lenis.on('scroll', ScrollTrigger.update);
      const tic = t => lenis.raf(t * 1000);
      gsap.ticker.add(tic);
      gsap.ticker.lagSmoothing(0);
      nettoyer.push(() => { gsap.ticker.remove(tic); lenis.destroy(); });
      page.querySelectorAll('a[href^="#"]').forEach(a => {
        const aller = e => {
          const h = a.getAttribute('href'), cible = h === '#cb-haut' ? 0 : document.querySelector(h);
          if (cible !== null) { e.preventDefault(); lenis.scrollTo(cible, { duration: 1.6 }); }
        };
        a.addEventListener('click', aller);
        nettoyer.push(() => a.removeEventListener('click', aller));
      });
    }

    // ---------- textes qui montent quand leur acte arrive
    page.querySelectorAll('[data-montee]').forEach(el => {
      const st = ScrollTrigger.create({ trigger: el, start: 'top 82%', onEnter: () => el.setAttribute('data-vu', ''), onLeaveBack: () => el.removeAttribute('data-vu') });
      nettoyer.push(() => st.kill());
    });

    // ---------- la scène
    let rendu = null, nuage = null, raf = 0;
    const etat = { ...CADRES.heros, intro: 0, scan: 0, plan: 0, meubles: 0, shuffle: 0, photo: 0, jour: 0, clic: 0 };
    const souris = { x: 9, y: 9, vx: 9, vy: 9, force: 0 };
    const avecGL = webgl2();
    if (!avecGL) page.setAttribute('data-sans-3d', '');

    const demarrer = async () => {
      const { creerNuage } = await import('./nuage.js');
      if (!vivant) return;
      const petit = innerWidth < 760;
      rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: false, alpha: true, powerPreference: 'high-performance' });
      rendu.setPixelRatio(Math.min(devicePixelRatio, petit ? 2 : 1.6));
      rendu.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
      nuage = creerNuage({ n: petit ? 38000 : 72000 });
      scene.add(nuage.points);
      const u = nuage.uniforms;

      const taille = () => {
        const w = innerWidth, h = innerHeight;
        rendu.setSize(w, h, false);
        camera.aspect = w / h;
        // en portrait, on recule pour que la pièce tienne en largeur
        camera.fov = w / h < 0.8 ? 46 : 34;
        camera.updateProjectionMatrix();
        u.uAspect.value = w / h;
        u.uEchelle.value = h * rendu.getPixelRatio() / (2 * Math.tan(rad(camera.fov) / 2));
      };
      taille();
      addEventListener('resize', taille);
      nettoyer.push(() => removeEventListener('resize', taille));

      const vise = new THREE.Vector3();
      const t0 = performance.now();
      const image = () => {
        raf = requestAnimationFrame(image);
        const t = (performance.now() - t0) / 1000;
        // la caméra : le cadre de l'acte, une lente respiration, un soupçon de parallaxe à la souris
        const px = souris.vx < 5 ? souris.vx : 0, py = souris.vy < 5 ? souris.vy : 0;
        const az = rad(etat.az + Math.sin(t * 0.13) * 4 * (1 - etat.plan) + px * 3);
        const el = rad(Math.min(89.4, etat.el + py * 2 * (1 - etat.plan)));
        const R = etat.r * (camera.aspect < 0.8 ? 1.55 : 1);
        vise.set(0, etat.y, etat.plan * 0.15);
        camera.position.set(vise.x + Math.sin(az) * Math.cos(el) * R, vise.y + Math.sin(el) * R, vise.z + Math.cos(az) * Math.cos(el) * R);
        camera.up.set(-Math.sin(az) * etat.plan, 1 - etat.plan, -Math.cos(az) * etat.plan).normalize();
        camera.lookAt(vise);
        // la pièce se décale à l'opposé du texte (en bas sur téléphone : elle remonte)
        const w = innerWidth, h = innerHeight, portrait = w < 760;
        camera.setViewOffset(w, h, portrait ? 0 : -etat.dx * w, portrait ? h * 0.16 : 0, w, h);
        souris.vx += (souris.x - souris.vx) * 0.12;
        souris.vy += (souris.y - souris.vy) * 0.12;
        souris.force += ((souris.x < 5 ? 1 : 0) - souris.force) * 0.08;
        u.uTemps.value = t;
        u.uIntro.value = etat.intro;
        u.uScan.value = etat.scan;
        u.uPlan.value = etat.plan;
        u.uMeubles.value = etat.meubles;
        u.uShuffle.value = Math.abs(etat.shuffle - etat.clic);
        u.uRendu.value = etat.photo;
        u.uSouris.value.set(souris.vx, souris.vy);
        u.uForce.value = souris.force;
        const f = melange(NUIT, JOUR, etat.jour);
        u.uFond.value.set(f[0] / 255, f[1] / 255, f[2] / 255);
        rendu.render(scene, camera);
      };
      image();
      nettoyer.push(() => { cancelAnimationFrame(raf); nuage.liberer(); rendu.dispose(); });
    };

    // ---------- la nuit qui devient jour (fond et encre de la page)
    const teinter = () => {
      const f = melange(NUIT, JOUR, etat.jour), e = melange(IVOIRE, ENCRE, etat.jour);
      page.style.setProperty('--cb-fond', `rgb(${f})`);
      page.style.setProperty('--cb-encre', `rgb(${e})`);
      page.style.setProperty('--cb-trait', `rgba(${e}, .16)`);
      page.toggleAttribute('data-jour', etat.jour > 0.5);
    };

    // ---------- l'histoire : un acte par section, une même ligne de temps liée au défilement
    const histoire = page.querySelector('.cb-histoire');
    const actes = [...page.querySelectorAll('[data-acte]')];
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
    const cadre = (nom, debut, duree) => tl.to(etat, { ...CADRES[nom], duration: duree }, debut);
    cadre('scan', 0.3, 0.9);
    tl.to(etat, { scan: 1, duration: 0.9, ease: 'none' }, 0.45);
    cadre('plan', 1.4, 0.8);
    tl.to(etat, { plan: 1, duration: 0.7 }, 1.45);
    cadre('meubles', 2.3, 0.8);
    tl.to(etat, { plan: 0, duration: 0.45 }, 2.3);
    tl.to(etat, { meubles: 1, duration: 0.85, ease: 'none' }, 2.55);
    cadre('shuffle', 3.45, 0.8);
    tl.to(etat, { shuffle: 1, duration: 0.75, ease: 'none' }, 3.55);
    cadre('rendu', 4.4, 0.95);
    tl.to(etat, { photo: 1, duration: 0.8 }, 4.5);
    tl.to(etat, { jour: 1, duration: 0.45, onUpdate: teinter }, 4.75);
    tl.set({}, {}, actes.length + 1);

    const indice = page.querySelectorAll('[data-indice]');
    const compteur = page.querySelector('[data-compteur]');
    const barre = page.querySelector('[data-barre]');
    let actif = -1;
    const st = ScrollTrigger.create({
      trigger: histoire, start: 'top top', end: 'bottom bottom', scrub: doux ? true : 1,
      animation: tl,
      onUpdate: self => {
        const n = Math.max(0, Math.min(actes.length, Math.floor(self.progress * (actes.length + 1) + 0.35)));
        barre?.style.setProperty('--p', self.progress.toFixed(4));
        if (n === actif) return;
        actif = n;
        indice.forEach((el, i) => el.toggleAttribute('data-actif', i + 1 === n));
        if (compteur) compteur.textContent = n ? String(n).padStart(2, '0') : '00';
        page.setAttribute('data-acte-actif', String(n));
      }
    });
    nettoyer.push(() => { st.kill(); tl.kill(); });
    teinter();

    // la toile s'efface quand la fin arrive
    const fin = page.querySelector('.cb-fin');
    const stFin = ScrollTrigger.create({
      trigger: fin, start: 'top bottom', end: 'top 25%', scrub: true,
      onUpdate: self => page.style.setProperty('--cb-toile', (1 - self.progress).toFixed(3))
    });
    nettoyer.push(() => stFin.kill());

    // ---------- Shuffle : une autre idée au clic, sans attendre le défilement
    const bouton = page.querySelector('[data-shuffle]');
    const melanger = () => {
      gsap.to(etat, { clic: etat.clic > 0.5 ? 0 : 1, duration: 1.4, ease: 'power2.inOut' });
      const tours = (Number(bouton.dataset.tourne) || 0) + 1;
      bouton.dataset.tourne = String(tours);
      bouton.style.setProperty('--r', String(tours / 2));
    };
    bouton?.addEventListener('click', melanger);
    nettoyer.push(() => bouton?.removeEventListener('click', melanger));

    // ---------- souris : elle écarte les points ; curseur maison (pas au doigt)
    const curseur = page.querySelector('.cb-curseur');
    const bouge = e => {
      souris.x = (e.clientX / innerWidth) * 2 - 1;
      souris.y = -(e.clientY / innerHeight) * 2 + 1;
      if (curseur) { curseur.style.left = `${e.clientX}px`; curseur.style.top = `${e.clientY}px`; }
    };
    const sort = () => { souris.x = souris.y = 9; };
    const survol = e => {
      const lien = e.target.closest?.('a, button');
      curseur?.toggleAttribute('data-lien', !!lien);
      if (curseur) curseur.dataset.texte = lien?.dataset.curseur || '';
    };
    if (!tactile) {
      addEventListener('pointermove', bouge, { passive: true });
      document.addEventListener('pointerleave', sort);
      addEventListener('pointerover', survol, { passive: true });
      page.setAttribute('data-curseur', '');
      nettoyer.push(() => { removeEventListener('pointermove', bouge); document.removeEventListener('pointerleave', sort); removeEventListener('pointerover', survol); });
    }

    // ---------- boutons aimantés
    if (!tactile && !doux) page.querySelectorAll('[data-aimant]').forEach(el => {
      const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' }), y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      const m = e => { const b = el.getBoundingClientRect(); x((e.clientX - b.left - b.width / 2) * 0.28); y((e.clientY - b.top - b.height / 2) * 0.35); };
      const o = () => { x(0); y(0); };
      el.addEventListener('pointermove', m);
      el.addEventListener('pointerleave', o);
      nettoyer.push(() => { el.removeEventListener('pointermove', m); el.removeEventListener('pointerleave', o); });
    });

    // ---------- horloge du pied de page
    const horloge = page.querySelector('[data-horloge]');
    const heure = () => { if (horloge) horloge.textContent = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date()); };
    heure();
    const minute = setInterval(heure, 20000);
    nettoyer.push(() => clearInterval(minute));

    // ---------- préchargement : le compteur monte pendant que le nuage se prépare, puis le rideau se lève
    const compte = page.querySelector('[data-precompte]');
    const charge = { v: 0 };
    const ouvrir = () => {
      if (!vivant) return;
      fini();
      gsap.to(etat, { intro: 1, duration: doux ? 0.01 : 2.4, ease: 'power2.out' });
      ScrollTrigger.refresh();
    };
    const prete = avecGL ? demarrer().catch(err => { console.error(err); page.setAttribute('data-sans-3d', ''); }) : Promise.resolve();
    if (doux) prete.then(ouvrir);
    else {
      const montee = gsap.to(charge, { v: 100, duration: 1.8, ease: 'power2.inOut', onUpdate: () => { if (compte) compte.textContent = String(Math.round(charge.v)).padStart(3, '0'); } });
      Promise.all([prete, montee.then()]).then(ouvrir);
      nettoyer.push(() => montee.kill());
    }

    return () => { vivant = false; nettoyer.forEach(f => f()); };
  }, []);

  return null;
}

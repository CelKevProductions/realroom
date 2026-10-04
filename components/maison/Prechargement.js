'use client';
// Préchargement : celui de la visite privée, aux couleurs de Maison Corleone (espresso et crème).
// Les lettres se posent dans le flou, la fleur tourne, un filet de laiton compte le chargement,
// puis une arche s'ouvre au centre et dévoile l'intro 3D.
import { useLayoutEffect, useRef } from 'react';
import { initGsap, gsap, SplitText, reduit } from '@/components/maison/anim.js';
import { Fleur } from '@/components/maison/Embleme.js';

export default function Prechargement({ t, avancement, pret, onSortie, onFini }) {
  const racine = useRef(null), forme = useRef(null), ligne = useRef(null), pct = useRef(null), etape = useRef(null);
  const pretRef = useRef(pret);
  pretRef.current = pret;
  const rappels = useRef({ onSortie, onFini });
  rappels.current = { onSortie, onFini };

  useLayoutEffect(() => {
    initGsap();
    const el = racine.current;
    const q = s => el.querySelector(s);
    const arche = { w: 0, h: 0 };
    const dessiner = () => {
      const w = innerWidth, h = innerHeight, r = arche.w / 2, cx = w / 2, B = h + r + 20, cy = h - arche.h + r;
      let d = `M0 0H${w}V${B}H0Z`;
      if (arche.w > .5 && arche.h > .5) d += `M${cx - r} ${B}V${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}V${B}Z`;
      if (forme.current) forme.current.setAttribute('d', d);
    };
    dessiner();
    addEventListener('resize', dessiner);
    const coupes = [
      SplitText.create(el.querySelectorAll('.mc-pre__caps span'), { type: 'chars' }),
      SplitText.create(q('.mc-pre__script'), { type: 'chars' }),
      SplitText.create(el.querySelectorAll('.mc-pre__cote'), { type: 'chars' })
    ];
    const [caps, script, cotes] = coupes.map(c => c.chars);
    const R = reduit();
    const s = { introFinie: R, sortie: false, compteur: 0, debut: performance.now() };
    el.classList.add('is-pret');
    let tl = null;
    if (!R) {
      gsap.set(caps, { opacity: 0, filter: 'blur(12px)', yPercent: 14 });
      gsap.set(script, { opacity: 0, filter: 'blur(8px)', x: -10 });
      gsap.set(cotes, { opacity: 0, filter: 'blur(6px)' });
      gsap.set(['.mc-pre__fleur', '.mc-pre__pied', '.mc-pre__ligne', '.mc-pre__pct'].map(q), { opacity: 0 });
      tl = gsap.timeline({ onComplete: () => { s.introFinie = true; } })
        .to(q('.mc-pre__fleur'), { opacity: 1, duration: 1, ease: 'power2.out' }, 0)
        .fromTo(q('.mc-pre__fleur svg'), { rotation: -60, scale: .6 }, { rotation: 0, scale: 1, duration: 1.8, ease: 'expo.out' }, 0)
        .to(caps, { opacity: 1, filter: 'blur(0px)', yPercent: 0, duration: 1.1, stagger: .05, ease: 'power3.out' }, .2)
        .to(script, { opacity: 1, filter: 'blur(0px)', x: 0, duration: .9, stagger: .05, ease: 'power2.out' }, .6)
        .to(cotes, { opacity: 1, filter: 'blur(0px)', duration: .5, stagger: .05, ease: 'power1.out' }, .25)
        .to(['.mc-pre__pied', '.mc-pre__ligne', '.mc-pre__pct'].map(q), { opacity: 1, duration: 1, ease: 'power2.out' }, .8)
        .to(q('.mc-pre__filigrane'), { opacity: .05, duration: 2.6, ease: 'power1.out' }, .4);
    }

    // compteur : un temps minimal (les lettres ont le temps de se poser) et le vrai chargement
    const tick = () => {
      if (s.sortie) return;
      const temps = Math.min(1, (performance.now() - s.debut) / (R ? 300 : 2800));
      const cible = Math.min(temps, .1 + .9 * Math.min(1, (avancement && avancement.current) || 0)) * 100;
      s.compteur += (cible - s.compteur) * .12;
      if (cible - s.compteur < .5) s.compteur = cible;
      if (pct.current) pct.current.textContent = String(Math.floor(s.compteur));
      if (ligne.current) ligne.current.style.transform = `scaleY(${.06 + .94 * s.compteur / 100})`;
      if (etape.current) etape.current.textContent = s.compteur < 70 ? t.pre.etapes[0] : s.compteur < 99 ? t.pre.etapes[1] : t.pre.etapes[2];
      if (pretRef.current && s.introFinie && s.compteur >= 99.5) sortir();
    };
    gsap.ticker.add(tick);

    // sortie : les lettres s'effacent, l'arche monte puis s'ouvre en plein écran
    function sortir() {
      s.sortie = true;
      gsap.ticker.remove(tick);
      if (rappels.current.onSortie) rappels.current.onSortie();
      const fin = () => rappels.current.onFini && rappels.current.onFini();
      if (R) { gsap.to(el, { autoAlpha: 0, duration: .35, onComplete: fin }); return; }
      const w = innerWidth, h = innerHeight;
      const w1 = w < 700 ? w * .52 : Math.min(w * .24, 380), h1 = h * (w < 700 ? .58 : .64);
      gsap.timeline({ onComplete: fin })
        .to(caps.concat(script), { opacity: 0, filter: 'blur(10px)', yPercent: -16, duration: .6, stagger: .015, ease: 'power2.in' }, 0)
        .to(['.mc-pre__ligne', '.mc-pre__pied', '.mc-pre__pct'].map(q), { opacity: 0, duration: .45 }, 0)
        .to(q('.mc-pre__filigrane'), { opacity: 0, duration: .9 }, 0)
        .to(arche, { w: w1, h: h1, duration: 1.25, ease: 'expo.inOut', onUpdate: dessiner }, .3)
        .to(q('.mc-pre__fleur'), { opacity: 0, duration: .6 }, 1.1)
        .to(arche, { w: Math.max(w, h) * 2.4, h: h * 2, duration: 1.45, ease: 'expo.inOut', onUpdate: dessiner }, 1.5)
        .to(cotes, { opacity: 0, filter: 'blur(6px)', duration: .45, stagger: .015 }, 1.55);
    }
    return () => {
      gsap.ticker.remove(tick);
      removeEventListener('resize', dessiner);
      if (tl) tl.kill();
      coupes.forEach(c => c.revert());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mc-pre" ref={racine} aria-hidden="true">
      <svg className="mc-pre__rideau" width="100%" height="100%"><path ref={forme} className="mc-pre__forme" fillRule="evenodd" d="M0 0H20000V20000H0Z" /></svg>
      <p className="mc-pre__filigrane mc-pre__txt">{t.service}</p>
      <span className="mc-pre__fleur mc-pre__txt"><Fleur /></span>
      <p className="mc-pre__cote mc-pre__cote--g mc-pre__txt">{t.pre.gauche}</p>
      <p className="mc-pre__cote mc-pre__cote--d mc-pre__txt">{t.pre.droite}</p>
      <div className="mc-pre__titre mc-pre__txt">
        <p className="mc-pre__caps"><span>Maison</span><span>Corleone</span></p>
        <p className="mc-pre__script">{t.service}</p>
      </div>
      <span className="mc-pre__ligne mc-pre__txt"><span ref={ligne} /></span>
      <p className="mc-pre__pct mc-pre__txt"><span ref={etape}>{t.pre.etapes[0]}</span> <b ref={pct}>0</b>&nbsp;%</p>
      <p className="mc-pre__pied mc-pre__txt">{t.pre.pied[0]}<br />{t.pre.pied[1]}</p>
    </div>
  );
}

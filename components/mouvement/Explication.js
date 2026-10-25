'use client';
// Explications en mouvement : une courte scène au trait (2 à 4 s) qui montre ce que fait l'étape,
// à côté d'une phrase courte. Elle se joue quand elle arrive à l'écran et se rejoue au
// survol ou au toucher. Mouvement réduit : la scène est affichée à son état final, immobile.
// Dessins : encre pour la pièce, rouille pour ce qui compte (comme les plans de l'accueil).
import { useRef } from 'react';
import { useAnimation } from './react.js';
import { gsap, mouvementPermis } from './regles.js';

// trait qui se trace (pathLength 1 : strokeDashoffset va de 1 à 0)
const T = props => <path pathLength="1" className="expl__trace" {...props} />;
const tracer = (tl, cibles, o = {}, pos) => tl.fromTo(cibles, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: o.d ?? .9, ease: o.e ?? 'power2.inOut', stagger: o.s ?? .12 }, pos);
const poser = (tl, cibles, o = {}, pos) => tl.fromTo(cibles, { autoAlpha: 0, y: o.y ?? -26 }, { autoAlpha: 1, y: 0, duration: o.d ?? .55, ease: o.e ?? 'back.out(1.8)', stagger: o.s ?? .16 }, pos);
const surgir = (tl, cibles, o = {}, pos) => tl.fromTo(cibles, { autoAlpha: 0, scale: .4, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: o.d ?? .45, ease: 'back.out(2.2)', stagger: o.s ?? .14 }, pos);

// une pièce vue de dessus (murs), réutilisée par plusieurs scènes
const MURS = 'M40 22h160v96H40z';
const PORTE = 'M40 92v-18a18 18 0 0 1 18 18';

const SCENES = {
  pieces: {
    dessin: (<>
      <T d="M30 20h180v100H30z" /><T d="M110 20v100" /><T d="M110 70h100" />
      <path className="expl__zone" d="M111 21h98v48h-98z" />
      <T className="expl__trace expl__accent" d="M150 46l8 8 16-16" />
    </>),
    jouer: (tl, q) => { tracer(tl, q('.expl__trace:not(.expl__accent)')); surgir(tl, q('.expl__zone'), {}, '-=.2'); tracer(tl, q('.expl__accent'), { d: .4 }, '-=.1'); }
  },
  usages: {
    dessin: (<>
      <T d={MURS} />
      <g className="expl__objet"><rect className="expl__meuble" x="60" y="40" width="40" height="26" rx="2" /><circle className="expl__meuble" cx="56" cy="53" r="4" /><circle className="expl__meuble" cx="104" cy="53" r="4" /></g>
      <g className="expl__objet"><rect className="expl__meuble expl__plein" x="140" y="34" width="44" height="18" rx="2" /><rect className="expl__meuble" x="154" y="56" width="14" height="12" rx="3" /></g>
      <g className="expl__objet"><path className="expl__meuble" d="M64 96h52v14H64zM64 96v-8h52v8" /></g>
    </>),
    jouer: (tl, q) => { tracer(tl, q('.expl__trace')); surgir(tl, q('.expl__objet'), { s: .25 }); }
  },
  relever: {
    dessin: (<>
      <T d="M40 22h160v96H40z" />
      <path className="expl__balayage" d="M0 18v104" />
      <g className="expl__tel"><rect x="-11" y="52" width="22" height="38" rx="4" className="expl__meuble expl__fond" /><path className="expl__accent-trait" d="M-4 57h8" /></g>
    </>),
    jouer: (tl, q) => {
      tl.set(q('.expl__tel'), { x: 40 }).set(q('.expl__balayage'), { x: 40 });
      tracer(tl, q('.expl__trace'), { d: 1.8, e: 'none' }, 0);
      tl.to(q('.expl__tel'), { x: 200, duration: 1.8, ease: 'sine.inOut' }, 0)
        .to(q('.expl__balayage'), { x: 200, duration: 1.8, ease: 'sine.inOut' }, 0)
        .to(q('.expl__balayage'), { autoAlpha: 0, duration: .3 });
    },
    final: q => { gsap.set(q('.expl__tel'), { x: 200 }); gsap.set(q('.expl__balayage'), { autoAlpha: 0 }); }
  },
  valider: {
    dessin: (<>
      <T d={MURS} /><T d={PORTE} />
      <g className="expl__cote"><path d="M40 12h160M40 8v8M200 8v8" /><text x="120" y="9" textAnchor="middle">4,20 m</text></g>
      <circle className="expl__sceau" cx="120" cy="70" r="16" />
      <T className="expl__trace expl__accent" d="M112 70l6 6 11-12" />
    </>),
    jouer: (tl, q) => { tracer(tl, q('.expl__trace:not(.expl__accent)')); surgir(tl, q('.expl__cote'), { d: .4 }); surgir(tl, q('.expl__sceau'), { d: .4 }, '+=.15'); tracer(tl, q('.expl__accent'), { d: .35 }); }
  },
  conserver: {
    dessin: (<>
      <path className="expl__mur" d={MURS} />
      <g className="expl__garde"><rect className="expl__meuble" x="58" y="34" width="62" height="24" rx="3" /><path className="expl__meuble" d="M58 40h62" /></g>
      <rect className="expl__meuble expl__remplace" x="150" y="36" width="30" height="30" rx="4" />
      <rect className="expl__meuble expl__remplace" x="96" y="80" width="46" height="24" rx="2" />
      <g className="expl__cadenas"><path className="expl__anse" d="M82 70v-6a7 7 0 0 1 14 0v6" /><rect x="78" y="70" width="22" height="16" rx="2" /></g>
    </>),
    jouer: (tl, q) => {
      const garde = q('.expl__garde')[0];
      tl.add(() => garde?.classList.remove('is-garde'), 0)
        .add(() => garde?.classList.add('is-garde'), .3)
        .to(q('.expl__remplace'), { opacity: .28, duration: .5 }, .5);
      surgir(tl, q('.expl__cadenas'), { d: .35 }, .8);
      tl.fromTo(q('.expl__anse'), { y: -5 }, { y: 0, duration: .25, ease: 'power2.in' }, 1.25);
    },
    final: q => q('.expl__garde')[0]?.classList.add('is-garde')
  },
  photo: {
    dessin: (<>
      <path className="expl__meuble" d="M96 70h48v26H96zM100 96v10M140 96v10M96 70V54a8 8 0 0 1 8-8h32a8 8 0 0 1 8 8v16" />
      <g className="expl__viseur"><path d="M78 36h12M78 36v12M162 36h-12M162 36v12M78 116h12M78 116v-12M162 116h-12M162 116v-12" /></g>
      <rect className="expl__flash" x="0" y="0" width="240" height="140" />
      <g className="expl__vignette"><rect x="190" y="98" width="34" height="28" rx="2" /><path d="M197 112h20v8h-20z" /></g>
    </>),
    jouer: (tl, q) => {
      surgir(tl, q('.expl__viseur'), { d: .5 });
      tl.fromTo(q('.expl__flash'), { autoAlpha: 0 }, { autoAlpha: .85, duration: .08, yoyo: true, repeat: 1 }, '+=.2');
      tl.fromTo(q('.expl__vignette'), { autoAlpha: 0, x: -80, y: -40, scale: 1.6 }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: .6, ease: 'power3.out', transformOrigin: '50% 50%' });
    }
  },
  preferences: {
    dessin: (<>
      {[40, 70, 100].map(y => <path key={y} className="expl__rail" d={`M50 ${y}h140`} />)}
      <circle className="expl__curseur" cx="0" cy="40" r="7" /><circle className="expl__curseur" cx="0" cy="70" r="7" /><circle className="expl__curseur" cx="0" cy="100" r="7" />
      <g className="expl__teintes"><rect x="58" y="114" width="16" height="16" rx="8" /><rect x="80" y="114" width="16" height="16" rx="8" /><rect className="expl__plein" x="102" y="114" width="16" height="16" rx="8" /></g>
    </>),
    jouer: (tl, q) => {
      const c = q('.expl__curseur');
      tl.fromTo(c, { x: 60 }, { x: i => [150, 96, 172][i], duration: .9, ease: 'power3.inOut', stagger: .15 });
      surgir(tl, q('.expl__teintes rect'), { s: .1 }, '-=.3');
    },
    final: q => gsap.set(q('.expl__curseur'), { x: i => [150, 96, 172][i] })
  },
  proposition: {
    dessin: (<>
      <path className="expl__mur" d={MURS} /><path className="expl__mur" d={PORTE} />
      <g className="expl__objet"><rect className="expl__meuble expl__plein" x="60" y="30" width="72" height="22" rx="3" /></g>
      <g className="expl__objet"><rect className="expl__meuble" x="74" y="62" width="44" height="22" rx="2" /></g>
      <g className="expl__objet"><circle className="expl__meuble" cx="168" cy="48" r="13" /></g>
      <g className="expl__objet"><rect className="expl__meuble" x="146" y="88" width="44" height="22" rx="2" /></g>
      <g className="expl__objet"><circle className="expl__meuble expl__plante" cx="186" cy="32" r="6" /></g>
    </>),
    jouer: (tl, q) => { poser(tl, q('.expl__objet'), { s: .22 }); }
  },
  shuffle: {
    dessin: (<>
      <path className="expl__mur" d={MURS} />
      <rect className="expl__meuble expl__plein expl__m1" x="60" y="30" width="72" height="22" rx="3" />
      <rect className="expl__meuble expl__m2" x="74" y="62" width="44" height="22" rx="2" />
      <circle className="expl__meuble expl__m3" cx="168" cy="48" r="13" />
    </>),
    jouer: (tl, q) => {
      tl.to(q('.expl__m1'), { x: 70, y: 58, duration: .8, ease: 'power3.inOut' }, .3)
        .to(q('.expl__m2'), { x: -14, y: -32, duration: .8, ease: 'power3.inOut' }, .38)
        .to(q('.expl__m3'), { x: -100, y: 40, duration: .8, ease: 'power3.inOut' }, .46);
    }
  },
  affiner: {
    dessin: (<>
      <path className="expl__mur" d={MURS} />
      <rect className="expl__meuble expl__plein" x="60" y="30" width="72" height="22" rx="3" />
      <rect className="expl__meuble expl__ajuste" x="78" y="66" width="44" height="22" rx="2" />
      <circle className="expl__meuble" cx="168" cy="52" r="13" />
      <g className="expl__loupe"><circle cx="0" cy="0" r="18" /><path d="M13 13l12 12" /></g>
      <path className="expl__etincelle" d="M150 92l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
    </>),
    jouer: (tl, q) => {
      tl.fromTo(q('.expl__loupe'), { x: 40, y: 40 }, { x: 100, y: 76, duration: 1, ease: 'power2.inOut' })
        .to(q('.expl__ajuste'), { x: -8, rotation: -6, svgOrigin: '100 77', duration: .5, ease: 'back.out(2)' })
        .to(q('.expl__loupe'), { x: 172, y: 56, duration: .9, ease: 'power2.inOut' }, '-=.1');
      surgir(tl, q('.expl__etincelle'), { d: .4 }, '-=.5');
    },
    final: q => { gsap.set(q('.expl__loupe'), { x: 172, y: 56 }); gsap.set(q('.expl__ajuste'), { x: -8, rotation: -6, svgOrigin: '100 77' }); }
  }
};

export const SCENES_EXPLICATION = Object.keys(SCENES);

export function Explication({ scene, texte, className = '' }) {
  const ref = useRef(null);
  const s = SCENES[scene];
  useAnimation(ref, el => {
    const svg = el.querySelector('.expl__scene');
    const q = gsap.utils.selector(svg);
    if (!s) return undefined;
    if (!mouvementPermis()) { s.final?.(q); return undefined; }
    const tl = gsap.timeline({ paused: true });
    s.jouer(tl, q);
    // se joue à l'arrivée à l'écran, se rejoue au survol ou au toucher (pas pendant qu'elle joue)
    let vue = false;
    const io = new IntersectionObserver(e => { if (e[0]?.isIntersecting && !vue) { vue = true; tl.play(0); } }, { threshold: .4 });
    io.observe(svg);
    const rejouer = () => { if (!tl.isActive()) tl.play(0); };
    svg.addEventListener('pointerenter', rejouer);
    svg.addEventListener('click', rejouer);
    return () => { io.disconnect(); svg.removeEventListener('pointerenter', rejouer); svg.removeEventListener('click', rejouer); tl.kill(); };
  }, [scene]);
  if (!s) return texte ? <p className="expl__bulle">{texte}</p> : null;
  return (
    <figure ref={ref} className={'explication' + (className ? ' ' + className : '')}>
      <svg className="expl__scene" viewBox="0 0 240 140" aria-hidden="true" focusable="false">{s.dessin}</svg>
      <figcaption>{texte && <p className="expl__bulle">{texte}</p>}</figcaption>
    </figure>
  );
}

'use client';
// Rendu photo IA sur l'accueil : la maquette 3D et le rendu de la même chambre, à comparer en glissant.
// À l'arrivée à l'écran, la poignée balaie l'image une fois (GSAP) pour montrer le geste ; dès que
// le visiteur la prend en main, le balayage s'arrête. Mouvement réduit : rien ne bouge tout seul.
import { useEffect, useRef, useState } from 'react';
import { gsap, mouvementPermis } from '@/components/mouvement/regles.js';

export default function RenduIA({ avant, apres, libelles }) {
  const [k, setK] = useState(50);
  const cadre = useRef(null), pris = useRef(false);

  useEffect(() => {
    const el = cadre.current;
    if (!el || !mouvementPermis()) return undefined;
    const etat = { k: 50 };
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.inOut' }, onUpdate: () => { if (!pris.current) setK(etat.k); } })
      .to(etat, { k: 84, duration: .9 }, .25)
      .to(etat, { k: 22, duration: 1.3 })
      .to(etat, { k: 50, duration: .9 });
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { io.disconnect(); if (!pris.current) tl.play(); } }, { threshold: .5 });
    io.observe(el);
    return () => { io.disconnect(); tl.kill(); };
  }, []);

  const prendre = () => { pris.current = true; };
  return (
    <figure className="acc-rendu__figure">
      <div className="acc-rendu__cadre" ref={cadre} style={{ '--k': k + '%' }}>
        <img src={avant} alt={libelles.avantAlt} width="1200" height="800" loading="lazy" decoding="async" />
        <img className="acc-rendu__apres" src={apres} alt={libelles.apresAlt} width="1200" height="800" loading="lazy" decoding="async" />
        <span className="acc-rendu__poignee" aria-hidden="true"><i /></span>
        <span className="acc-rendu__etiquette" data-cote="avant" aria-hidden="true">{libelles.avant}</span>
        <span className="acc-rendu__etiquette" data-cote="apres" aria-hidden="true">{libelles.apres}</span>
        <input type="range" min="0" max="100" step=".5" value={k} aria-label={libelles.glisser}
          aria-valuetext={`${libelles.avant} ${Math.round(k)} %, ${libelles.apres} ${Math.round(100 - k)} %`}
          onPointerDown={prendre} onKeyDown={prendre} onChange={e => { prendre(); setK(+e.target.value); }} />
      </div>
      <figcaption className="acc-rendu__note">{libelles.note}</figcaption>
    </figure>
  );
}

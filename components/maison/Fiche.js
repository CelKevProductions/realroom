'use client';
// Fiche d'une pièce Maison Corleone : sa maquette en 360° (moteur/vitrine.js, on la fait tourner
// au doigt) ou sa photo, ses points forts, son prix, et le lien vers la boutique.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prix } from '@/lib/i18n.js';
import { remplir } from '@/components/maison/textes.js';
import { initGsap, gsap, reduit } from '@/components/maison/anim.js';
import { Icone, I, lienBoutique } from '@/components/maison/icones.js';

export default function Fiche({ t, lang, p, produits, onFermer, onEchanger, onRetirer }) {
  const racine = useRef(null), canvas = useRef(null), texte = useRef(null), vitrine = useRef(null);
  const courant = useRef(p);
  courant.current = p;
  const [vue, setVue] = useState('3d');
  const [panne, setPanne] = useState(false);

  useLayoutEffect(() => {
    if (reduit()) return;
    initGsap();
    const large = innerWidth >= 900;
    gsap.fromTo(racine.current, large ? { xPercent: 12, autoAlpha: 0 } : { yPercent: 14, autoAlpha: 0 },
      { xPercent: 0, yPercent: 0, autoAlpha: 1, duration: .7, ease: 'mcOut' });
  }, []);
  useEffect(() => {
    let vivant = true;
    import('@/moteur/vitrine.js').then(({ creerVitrine }) => {
      if (!vivant || !canvas.current) return;
      vitrine.current = creerVitrine(canvas.current, { produits, anime: !reduit() });
      vitrine.current.montrer(courant.current.id);
    }).catch(e => { console.error('vitrine', e); if (vivant) setPanne(true); });
    return () => { vivant = false; if (vitrine.current) { vitrine.current.detruire(); vitrine.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    if (vitrine.current) vitrine.current.montrer(p.id);
    setVue('3d');
    if (texte.current && !reduit()) gsap.fromTo(texte.current, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .6, ease: 'mcOut' });
  }, [p.id]);
  useEffect(() => { if (vitrine.current) vitrine.current.pause(vue !== '3d'); }, [vue]);

  const cm = v => Math.round(v * 100);
  const photo = vue === 'photo' || panne;
  const lien = lienBoutique(p.url);
  return (
    <aside className="mc-fiche" ref={racine} aria-label={p.nom}>
      <div className="mc-fiche__defile">
        <div className="mc-fiche__vue">
          <canvas ref={canvas} aria-label={t.scene.tournerAide} />
          {photo && <img src={p.img || p.vign} alt={p.titre || p.nom} />}
          <div className="mc-segment mc-fiche__onglets" role="group" aria-label={t.scene.voir360}>
            <button type="button" aria-pressed={!photo} disabled={panne} onClick={() => setVue('3d')}>{t.scene.vue3d}</button>
            <button type="button" aria-pressed={photo} onClick={() => setVue('photo')}>{t.scene.photo}</button>
          </div>
          <button type="button" className="mc-fiche__fermer" onClick={onFermer} aria-label={t.scene.fermer}><Icone d={I.croix} /></button>
          {!photo && <span className="mc-fiche__aide mc-mono">{t.scene.tournerAide}</span>}
        </div>
        <div className="mc-fiche__texte" ref={texte}>
          <p className="mc-fiche__cat mc-mono">{p.cat}{p.dim ? ' · ' + remplir(t.scene.dims, { l: cm(p.dim[0]), p: cm(p.dim[1]), h: cm(p.dim[2]) }) : ''}</p>
          <h3 className="mc-fiche__nom">{p.nom}</h3>
          {p.titre && p.titre !== p.nom && <p className="mc-fiche__titre">{p.titre}</p>}
          {p.texte && <p className="mc-fiche__desc">{p.texte}</p>}
          {p.points && p.points.length > 0 && (
            <ul className="mc-fiche__points">{p.points.slice(0, 5).map(([k, v]) => <li key={k}><span>{k}</span>{v}</li>)}</ul>
          )}
          <p className="mc-fiche__prix">{p.prix > 0 ? prix(p.prix * 100, lang) : t.scene.surDevis}</p>
        </div>
      </div>
      <div className="mc-fiche__pied">
        {lien && <a className="mc-btn mc-btn--plein" href={lien} target="_blank" rel="noopener">{t.scene.voir}<Icone d={I.externe} /></a>}
        <button type="button" className="mc-btn" onClick={onEchanger}>{t.scene.echanger}</button>
        <button type="button" className="mc-btn" onClick={onRetirer}>{t.scene.retirer}</button>
      </div>
    </aside>
  );
}

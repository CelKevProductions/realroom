'use client';
// Chargement : pendant l'analyse des photos puis l'aménagement, une pièce au trait de laiton
// tourne (moteur/chargeur.js), balayée par un plan de lecture, et les meubles y apparaissent en
// volumes filaires. Le pourcentage suit le vrai travail (estimé tant que le serveur n'a pas répondu).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import { chargerCatalogue } from '@/components/catalogueClient.js';
import Embleme from '@/components/maison/Embleme.js';
import { composerEnvies, aGarder } from '@/components/maison/demande.js';
import { initGsap, lettres, entreeTitre, entreeScript, monter, dechiffrer, reduit } from '@/components/maison/anim.js';

const pause = ms => new Promise(r => setTimeout(r, ms));
const SEUILS = [0, .2, .38, .6, .8];

export default function Chargement({ t, lang, demo, piece, choix, aDesPieces, onMaj, onFini, onPhotos, onRetour, onMesPieces }) {
  const tc = t.chargement;
  const racine = useRef(null), canvas = useRef(null), pct = useRef(null);
  const moteur = useRef(null);
  const etat = useRef({ phase: 'analyse', t0: performance.now(), aff: 0 });
  const [etape, setEtape] = useState(0);
  const [erreur, setErreur] = useState(null);
  const [essai, setEssai] = useState(0);
  const courante = useRef(piece);
  const rappels = useRef({});
  rappels.current = { onMaj, onFini };

  // entrée du texte (comme une station)
  useLayoutEffect(() => {
    const el = racine.current;
    initGsap();
    entreeTitre(lettres(el.querySelector('.mc-charge__titre')), .15);
    entreeScript(lettres(el.querySelector('.mc-charge__script')), .55);
    const lab = el.querySelector('[data-label]');
    if (lab) dechiffrer(lab, lab.dataset.label, .8);
    monter(el.querySelectorAll('.mc-charge__pct, .mc-charge__etapes, .mc-charge__duree'), .5, 18);
  }, []);

  // la pièce au trait, et la boucle d'affichage de la progression
  useEffect(() => {
    let vivant = true, raf = 0, derniere = -1;
    import('@/moteur/chargeur.js').then(({ creerChargeur }) => {
      if (!vivant || !canvas.current) return;
      try { moteur.current = creerChargeur(canvas.current, { couleur: '#C9A66B' }); } catch (e) { console.error('chargeur 3D', e); }
    });
    const PLAN = {
      analyse: { de: .03, a: .58, tau: demo ? 2.6 : 40 },
      amenager: { de: .6, a: .96, tau: demo ? 2 : 28 },
      fin: { de: 1, a: 1, tau: 1 }
    };
    const boucle = () => {
      const e = etat.current, pl = PLAN[e.phase] || PLAN.fin;
      const ecoule = (performance.now() - e.t0) / 1000;
      const cible = pl.de + (pl.a - pl.de) * (1 - Math.exp(-ecoule / pl.tau));
      e.aff += (Math.max(e.aff, cible) - e.aff) * (e.phase === 'fin' ? .12 : .05);
      if (e.phase === 'fin' && 1 - e.aff < .004) e.aff = 1;
      if (pct.current) pct.current.textContent = String(Math.floor(e.aff * 100));
      if (moteur.current) moteur.current.avancer(e.aff);
      const i = e.phase === 'fin' && e.aff >= .995 ? SEUILS.length : SEUILS.reduce((m, s, k) => (e.aff >= s ? k : m), 0);
      if (i !== derniere) { derniere = i; setEtape(i); }
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => { vivant = false; cancelAnimationFrame(raf); if (moteur.current) { moteur.current.detruire(); moteur.current = null; } };
  }, [demo]);

  // le travail : analyse (si la pièce n'a pas encore sa maquette), puis aménagement
  useEffect(() => {
    let vivant = true;
    const phase = nom => { etat.current.phase = nom; etat.current.t0 = performance.now(); };
    const minimum = async (t0, ms) => { const r = ms - (performance.now() - t0); if (r > 0) await pause(r); };
    // analyse déjà en cours (autre onglet, page rechargée) : on suit son état
    const suivre = async id => {
      for (let n = 0; n < 120 && vivant; n++) {
        await pause(4000);
        const r = await api(`/api/pieces/${id}`);
        if (r.ok && r.piece.etat !== 'analyse') return r.piece;
      }
      throw { erreur: 'analyse' };
    };
    (async () => {
      setErreur(null);
      try {
        const cat = await chargerCatalogue().catch(() => null);
        let p = courante.current;
        if (!p.modele || p.etat === 'erreur' || p.etat === 'analyse') {
          phase('analyse');
          const t0 = performance.now();
          if (p.etat === 'analyse') p = await suivre(p.id);
          else {
            const r = await api(`/api/pieces/${p.id}/analyse`, { method: 'POST', corps: { langue: lang } });
            if (r.ok) p = r.piece;
            else if (r.erreur === 'en-cours') p = await suivre(p.id);
            else throw r;
          }
          if (!vivant) return;
          if (!p || !p.modele || p.etat === 'erreur') throw { erreur: (p && p.erreur) || 'analyse' };
          courante.current = p;
          rappels.current.onMaj && rappels.current.onMaj(p);
          await minimum(t0, demo ? 3800 : 1800);
        }
        if (!vivant) return;
        phase('amenager');
        const t1 = performance.now();
        const r2 = await api(`/api/pieces/${p.id}/amenager`, {
          method: 'POST',
          corps: { mode: 'tout', envies: composerEnvies(t, choix, cat && cat.produits), budget: choix.budget || 0, garder: aGarder(p, choix), aRemplacer: [], langue: lang }
        });
        if (!r2.ok) throw r2;
        p = r2.piece;
        courante.current = p;
        await minimum(t1, demo ? 3200 : 1500);
        if (!vivant) return;
        phase('fin');
        await pause(reduit() ? 150 : 1200);
        if (vivant) rappels.current.onFini(p);
      } catch (e) {
        if (!vivant) return;
        console.error('chargement', e);
        const code = e && e.erreur;
        setErreur(code === 'limite-mc' ? 'limite' : code === 'limite' ? 'limiteJour' : code === 'service' || (e && e.statut === 503) ? 'service' : 'erreur');
      }
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essai]);

  const reessayer = () => { etat.current = { phase: 'analyse', t0: performance.now(), aff: Math.min(etat.current.aff, .5) }; setEssai(n => n + 1); };
  return (
    <div className="mc-charge mc-fixe" ref={racine}>
      <Embleme texte={t.emblème} label={t.scene.boutique} href="https://maisoncorleone.com" />
      <div className="mc-charge__texte">
        <p className="mc-question__label mc-mono"><i /><span data-label={t.marque + ' · ' + t.service}>{t.marque + ' · ' + t.service}</span></p>
        <h1 className="mc-charge__titre mc-display">{tc.lignes.map((l, i) => <span key={i} className="mc-ligne">{l}</span>)}</h1>
        <p className="mc-charge__script mc-script">{tc.script}</p>
        <p className="mc-charge__pct" aria-hidden="true"><span ref={pct}>0</span><small>%</small></p>
        {erreur ? (
          <div className="mc-charge__erreur" role="alert">
            <p>{erreur === 'erreur' ? tc.erreur : tc[erreur]}</p>
            <div className="mc-charge__actions">
              {(erreur === 'erreur' || erreur === 'service') && <button type="button" className="mc-btn mc-btn--creme" onClick={reessayer}>{tc.reessayer}</button>}
              {erreur === 'erreur' && <button type="button" className="mc-btn mc-btn--clair" onClick={onPhotos}>{tc.photos}</button>}
              {erreur === 'limite' && aDesPieces && <button type="button" className="mc-btn mc-btn--creme" onClick={onMesPieces}>{t.scene.mesPieces}</button>}
              {(erreur === 'limite' || erreur === 'limiteJour') && <button type="button" className="mc-btn mc-btn--clair" onClick={onRetour}>{t.nav.retour}</button>}
            </div>
          </div>
        ) : (
          <ol className="mc-charge__etapes mc-mono" aria-live="polite">
            {tc.etapes.map((e, i) => <li key={e} className={i < etape ? 'is-fait' : i === etape ? 'is-en-cours' : undefined}><i />{e}</li>)}
          </ol>
        )}
        {!erreur && <p className="mc-charge__duree">{demo ? t.nav.demo : tc.duree}</p>}
      </div>
      <div className="mc-charge__vue"><canvas ref={canvas} aria-hidden="true" /></div>
    </div>
  );
}

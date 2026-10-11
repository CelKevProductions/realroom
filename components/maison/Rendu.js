'use client';
// Rendu réaliste (un des deux offerts) : la maquette est capturée depuis le point de vue de la
// photo, puis réinventée en photo. Pendant l'attente, la capture reste à l'écran, balayée par un
// filet de laiton ; à l'arrivée, un curseur avant / après s'ouvre sur le résultat.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import AnglesRendu from '@/components/piece/AnglesRendu.js';
import { remplir } from '@/components/maison/textes.js';
import { initGsap, gsap, lettres, entreeTitre, reduit } from '@/components/maison/anim.js';

export default function Rendu({ t, piece, rendus, setRendus, credits, setCredits, capturer,lireVue,surVue,avant, fermer, lang='fr',onPiece }) {
  const tr = t.rendu;
  const racine = useRef(null);
  const [ratioApercu,setRatioApercu]=useState(4/3);
  const images = rendus.filter(r => r.type === 'image');
  const [apercu, setApercu] = useState(null);
  const [suivi, setSuivi] = useState(() => (images.find(r => r.etat === 'en_cours') || {}).id || null);
  const [erreur, setErreur] = useState(null);
  const [choisi, setChoisi] = useState(() => (images.find(r => r.etat === 'fini' && r.resultat) || {}).id || null);
  const [lance, setLance] = useState(false);
  const [k, setK] = useState(50);
  const rappels = useRef({});
  rappels.current = { capturer, avant, setCredits, setRendus };

  useLayoutEffect(() => {
    if (reduit()) return;
    initGsap();
    gsap.fromTo(racine.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: .45, ease: 'power2.out' });
    entreeTitre(lettres(racine.current.querySelector('.mc-rendu__titre')), .1);
  }, []);
  useEffect(() => {
    const touche = e => { if (e.key === 'Escape') fermer(); };
    addEventListener('keydown', touche);
    return () => removeEventListener('keydown', touche);
  }, [fermer]);

  // Ouvrir la fenêtre ne consomme aucun crédit : choix du cadrage, aperçu, puis clic explicite.
  async function lancer(options) {
      if (suivi || lance) return;
      setErreur(null);
      if (credits < 1) { setErreur(tr.epuise); return; }
      const {capture,angle,vue,ambiance}=options;
      if (!capture) { setErreur(t.scene.erreur); return; }
      setApercu(capture);setLance(true);
      try {
        const r = await api(`/api/pieces/${piece.id}/rendus`, { method: 'POST', corps: { type: 'image', ...options } });
        if (!r.ok) { setLance(false); setErreur(r.erreur === 'credits' ? tr.epuise : r.erreur==='rendu-en-cours'?(lang==='fr'?'Une photo est déjà en cours. Attendez sa fin.':'A photo is already being generated. Wait for it to finish.'):t.scene.erreur); return; }
        rappels.current.setCredits(c => Math.max(0, c - 1));
        rappels.current.setRendus(l => [{ id: r.id, type: 'image', angle,vue,ambiance,etat: 'en_cours', credits: 1, resultat: null, cree_le: new Date().toISOString() }, ...l]);
        setSuivi(r.id);
      } catch (_) { setLance(false);setErreur(t.scene.erreur); }
  }

  // suivi du rendu en cours
  useEffect(() => {
    if (!suivi) return;
    let arret = false, h;
    const tour = async () => {
      const s = await api(`/api/rendus/${suivi}`);
      if (arret) return;
      if (s.ok && s.etat !== 'en_cours') {
        rappels.current.setRendus(l => l.map(x => (x.id === suivi ? { ...x, ...s } : x)));
        if (s.etat === 'fini' && s.resultat) setChoisi(s.id); else setErreur(tr.erreur);
        setSuivi(null);
        setLance(false);
        const m = await api('/api/moi');
        if (!arret && m.ok && m.connecte) rappels.current.setCredits(m.credits);
        return;
      }
      h = setTimeout(tour, 2500);
    };
    h = setTimeout(tour, 2500);
    return () => { arret = true; clearTimeout(h); };
  }, [suivi, tr.erreur]);

  const finis = images.filter(r => r.etat === 'fini' && r.resultat && r.resultat.image);
  const actuel = finis.find(r => r.id === choisi) || null;
  const photoAvant = actuel?.reference?{url:actuel.reference}:(piece.photos || []).find(p => p.role === (actuel?.angle || 'entree'));
  const attente = !!suivi || lance;
  const ratio = !attente&&actuel?.resultat?.largeur&&actuel?.resultat?.hauteur?actuel.resultat.largeur/actuel.resultat.hauteur:ratioApercu;
  // le résultat se dévoile : le curseur balaie de droite à gauche
  useEffect(() => {
    if (!actuel || reduit()) return;
    const o = { v: 97 };
    setK(97);
    const tw = gsap.to(o, { v: 50, duration: 1.6, delay: .35, ease: 'expo.inOut', onUpdate: () => setK(o.v) });
    return () => tw.kill();
  }, [actuel && actuel.id]);

  return (
    <div className="mc-rendu" ref={racine} role="dialog" aria-modal="true" aria-label={tr.titre}>
      <div className="mc-rendu__tete">
        <p className="mc-rendu__titre">{tr.titre}</p>
        <button type="button" className="mc-btn mc-btn--clair" onClick={fermer}>{tr.fermer}</button>
      </div>
      <div className="mc-rendu__corps">
        <AnglesRendu lang={lang} piece={piece} onPiece={onPiece} capturer={capturer} lireVue={lireVue} surVue={surVue} avant={avant} onGenerer={lancer} disabled={attente}/>
        {(attente||actuel)&&<div className={'mc-rendu__image' + (attente ? ' is-attente' : '')} style={{ '--ratio': ratio }}>
          {attente ? (
            <>
              {apercu && <img src={apercu} alt="" onLoad={e=>setRatioApercu(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight)}/>}
              <div className="mc-rendu__attente" role="status"><div><b>{tr.attente}</b><p className="mc-mono">{tr.duree}</p></div></div>
            </>
          ) : actuel ? (
            photoAvant ? (
              <div className="mc-aa">
                <img src={photoAvant.url} alt={tr.avant} onLoad={e=>setRatioApercu(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight)}/>
                <div className="mc-aa__apres" style={{ clipPath: `inset(0 0 0 ${k}%)` }}><img src={actuel.resultat.image} alt={tr.apres} /></div>
                <span className="mc-aa__poignee" style={{ left: k + '%' }} />
                <span className="mc-aa__etiq mc-aa__etiq--avant mc-mono" aria-hidden="true">{tr.avant}</span>
                <span className="mc-aa__etiq mc-aa__etiq--apres mc-mono" aria-hidden="true">{tr.apres}</span>
                <input type="range" min="0" max="100" value={Math.round(k)} onChange={e => setK(+e.target.value)} aria-label={tr.avant + ' / ' + tr.apres} />
              </div>
            ) : <img src={actuel.resultat.image} alt={tr.apres} onLoad={e=>setRatioApercu(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight)}/>
          ) : null}
        </div>}
        {erreur&&<p role="alert">{erreur}</p>}
      </div>
      <div className="mc-rendu__pied">
        <p className="mc-rendu__note">{erreur && actuel ? erreur + ' ' : ''}{tr.avertissement}</p>
        <div className="mc-rendu__actions">
          {finis.length > 1 && (
            <div className="mc-rendu__vignettes">
              {finis.map(r => <button key={r.id} type="button" aria-pressed={actuel && actuel.id === r.id} onClick={() => setChoisi(r.id)}><img src={r.resultat.image} alt="" /></button>)}
            </div>
          )}
          <span className="mc-mono">{remplir(tr.restants, { n: credits })}</span>
          {actuel && <a className="mc-btn mc-btn--creme" href={actuel.resultat.image} download={`maison-corleone-${piece.nom}.jpg`} target="_blank" rel="noopener">{tr.telecharger}</a>}
        </div>
      </div>
    </div>
  );
}

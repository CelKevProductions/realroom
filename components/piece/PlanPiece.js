'use client';
import { useEffect, useRef, useState } from 'react';
import { MURS, boite, produitDe, estSuspendu } from '@/lib/agencement.js';
import { longueurMur, corrigerPiece } from '@/lib/geometrie.js';
import s from './PlanPiece.module.css';
import { contourDe, segmentsDe, pointOuverture, validerContour } from '@/lib/contour.js';

const textes = {
  fr: { titre: 'Vérifier le plan de la pièce', intro: 'Mesurez une longueur réelle pour corriger l’échelle. Les autres dimensions restent estimées tant que vous ne les confirmez pas.',
    dims: ['Largeur', 'Profondeur', 'Hauteur'], mesure: 'Mesure vérifiée', estime: 'Estimée', murs: { fond: 'Mur du fond', entree: 'Mur d’entrée', gauche: 'Mur gauche', droite: 'Mur droit' },
    scan: 'Cote du scan, à vérifier', ajout: 'Noter un meuble existant', nom: 'Nom', famille: 'Type de meuble', face: 'Face vers', depuisGauche: 'Centre depuis le mur gauche', depuisEntree: 'Centre depuis le mur d’entrée',
    ajoutsNote: 'Notez les dimensions réelles et la position des meubles non détectés. Le relevé Android ne fait pas de reconnaissance du mobilier.', annulerAjout: 'Annuler l’ajout', validerAjout: 'Ajouter au relevé',
    types: { porte: 'Porte', fenetre: 'Fenêtre', baie: 'Baie', passage: 'Passage' },
    ouvertures: 'Portes et fenêtres', ajouter: 'Ajouter une ouverture', aucune: 'Ce mur est sans ouverture', inconnu: 'Mur à vérifier sur place',
    position: 'Centre depuis le début du mur', largeur: 'Largeur', hauteur: 'Hauteur', allege: 'Hauteur d’allège', type: 'Type', retirer: 'Retirer',
    meubles: 'Dimensions d’un meuble existant', choisir: 'Choisir un meuble', meublesNote: 'Ces mesures corrigent le relevé. Les dimensions des produits de la boutique viennent de leur fiche.',
    aide: 'Sélectionnez une ouverture sur le plan et glissez-la le long du mur, ou ajustez ses mesures ci-dessous.',
    fermer: 'Fermer', sauver: 'Enregistrer le plan', attente: 'Enregistrement…', erreur: 'Le plan n’a pas pu être enregistré. Réessayez.',
    limites: 'Saisissez des dimensions valides : 1,20–30 m au sol, 1,90–8 m sous plafond.',
    note: 'Le contour peut comporter 3 à 32 coins, des renfoncements et des murs obliques. Vérifiez les cotes sur place.' },
  en: { titre: 'Check your room plan', intro: 'Measure a real length to correct the scale. Other dimensions remain estimates until you confirm them.',
    dims: ['Width', 'Depth', 'Height'], mesure: 'Verified measurement', estime: 'Estimated', murs: { fond: 'Far wall', entree: 'Entrance wall', gauche: 'Left wall', droite: 'Right wall' },
    scan: 'Scan dimension, check on site', ajout: 'Record existing furniture', nom: 'Name', famille: 'Furniture type', face: 'Facing', depuisGauche: 'Centre from left wall', depuisEntree: 'Centre from entrance wall',
    ajoutsNote: 'Record real dimensions and position of undetected furniture. The Android survey does not recognise furniture.', annulerAjout: 'Cancel item', validerAjout: 'Add to survey',
    types: { porte: 'Door', fenetre: 'Window', baie: 'Glass opening', passage: 'Passage' },
    ouvertures: 'Doors and windows', ajouter: 'Add an opening', aucune: 'This wall has no openings', inconnu: 'Check this wall on site',
    position: 'Centre from the start of the wall', largeur: 'Width', hauteur: 'Height', allege: 'Sill height', type: 'Type', retirer: 'Remove',
    meubles: 'Existing furniture dimensions', choisir: 'Choose a piece', meublesNote: 'These measurements correct the survey. Shop product dimensions come from their listing.',
    aide: 'Select an opening on the plan and drag it along the wall, or adjust its measurements below.',
    fermer: 'Close', sauver: 'Save room plan', attente: 'Saving…', erreur: 'The room plan could not be saved. Please try again.',
    limites: 'Enter valid dimensions: 1.20–30 m on the floor, 1.90–8 m ceiling height.',
    note: 'The outline supports 3–32 corners, recesses and angled walls. Check dimensions on site.' }
};
const clesDims = ['largeur', 'profondeur', 'hauteur'];
const valeur = v => Number(String(v).replace(',', '.'));
const rond = v => Math.round(v * 100) / 100;
const famillesManuelles = {
  fr: { lit: 'Lit', canape: 'Canapé', fauteuil: 'Fauteuil', chaise: 'Chaise', table: 'Table', bureau: 'Bureau', armoire: 'Armoire', commode: 'Commode', meuble: 'Meuble', chevet: 'Chevet', tv: 'Télévision', radiateur: 'Radiateur', cuisine: 'Cuisine / équipement fixe', autre: 'Autre' },
  en: { lit: 'Bed', canape: 'Sofa', fauteuil: 'Armchair', chaise: 'Chair', table: 'Table', bureau: 'Desk', armoire: 'Wardrobe', commode: 'Chest of drawers', meuble: 'Storage', chevet: 'Bedside table', tv: 'Television', radiateur: 'Radiator', cuisine: 'Kitchen / fixed appliance', autre: 'Other' }
};

// Petit plan exact de la maquette, utilisé aussi pour comparer les dispositions.
export function ApercuPlan({ modele, items = [], produits = {}, label, ouvertures, selection, surPointer, surChoisir, surCoin }) {
  const { largeur: L, profondeur: P } = modele.dims, marge = Math.max(L, P) * .15;
  return <svg className={s.plan} viewBox={`${-L / 2 - marge} ${-P / 2 - marge} ${L + marge * 2} ${P + marge * 2}`}
    role="img" aria-label={label}>
    <polygon points={contourDe(modele).map(p=>p.join(",")).join(" ")} fill="#F8F4EA" stroke="#74634F" strokeWidth={.035} />
    {items.filter(it => it.garde !== false).map(it => {
      const p = produitDe(it, produits);
      if (!p?.dim || estSuspendu(p.fam)) return null;
      const b = boite(it, p.dim);
      return <g key={it.id} opacity={p.fam === 'tapis' ? .18 : .65}>
        <rect x={b.x0} y={b.z0} width={b.x1 - b.x0} height={b.z1 - b.z0} rx={.025} fill={p.cols?.[0] || '#B8A58D'} stroke="#74634F" strokeWidth={.015} />
        {['lit', 'canape', 'bureau'].includes(p.fam) && <line x1={it.x} y1={it.z} x2={it.x + Math.sin(it.rot || 0) * .25} y2={it.z + Math.cos(it.rot || 0) * .25} stroke="#524838" strokeWidth={.04} />}
        <title>{p.nom}</title>
      </g>;
    })}
    {segmentsDe(modele).flatMap(pan => { const mur=pan.id; return (ouvertures?.[mur] || modele.murs?.[mur]?.ouvertures || []).map((o, i) => {
      const [x,z]=pointOuverture(pan,o.position);
      const a=pointOuverture(pan,o.position-o.largeur/2), b=pointOuverture(pan,o.position+o.largeur/2);
      return <g key={`${mur}-${i}`} className={surPointer ? s.ouverture : undefined}
        onPointerDown={surPointer ? e => surPointer(e, mur, i) : undefined}
        onClick={surChoisir ? () => surChoisir(mur, i) : undefined}>
        <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
          stroke={['porte', 'passage'].includes(o.type) ? '#806746' : '#648B92'} strokeWidth={.12} />
        {surPointer && <circle cx={x} cy={z} r={.14} fill={selection?.mur === mur && selection?.i === i ? '#392D23' : '#FFFDF6'} stroke="#74634F" strokeWidth={.035} />}
      </g>;
    });})}
    {surCoin && contourDe(modele).map(([x,z],i)=><g key={i}><circle className={s.ouverture} cx={x} cy={z} r={.11} fill="#C9A66B" stroke="#392D23" strokeWidth={.02} onPointerDown={e=>surCoin(e,i)}><title>{i+1}</title></circle><text x={x+.12} y={z-.12} fontSize={.15}>{i+1}</text></g>)}
    <text x={0} y={-P / 2 - marge * .5} textAnchor="middle" fontSize={marge * .32} fill="currentColor">{L.toFixed(2)} m</text>
    <text x={L / 2 + marge * .5} y={0} textAnchor="middle" fontSize={marge * .32} fill="currentColor" transform={`rotate(90 ${L / 2 + marge * .5} 0)`}>{P.toFixed(2)} m</text>
  </svg>;
}

export default function PlanPiece({ modele, items, produits, lang = 'fr', onSauver, onFermer }) {
  const t = textes[lang] || textes.fr, dialogue = useRef(null);
  const [dims, setDims] = useState(() => Object.fromEntries(clesDims.map(k => [k, String(modele.dims[k])])));
  const [mesures, setMesures] = useState(() => Object.fromEntries(clesDims.map(k => [k, modele.dims.sources?.[k] === 'mesure' || modele.dims.estimees === false])));
  const [contour,setContour] = useState(()=>modele.contour ? structuredClone(modele.contour) : null);
  const [murs, setMurs] = useState(() => structuredClone(modele.murs));
  const [touches, setTouches] = useState(() => new Set());
  const [mur, setMur] = useState(()=>segmentsDe(modele).find(p=>p.id==='entree')?.id || segmentsDe(modele)[0].id), [selection, setSelection] = useState(null);
  const [meuble, setMeuble] = useState(''), [releve, setReleve] = useState({});
  const [ajouts, setAjouts] = useState([]), [ajout, setAjout] = useState(null);
  const [attente, setAttente] = useState(false), [erreur, setErreur] = useState('');
  useEffect(() => { const d = dialogue.current; d.showModal(); return () => d.close(); }, []);
  const valides = clesDims.every((k, i) => { const n = valeur(dims[k]); return Number.isFinite(n) && n >= (i === 2 ? 1.9 : 1.2) && n <= (i === 2 ? 8 : 30); });
  const source = k => mesures[k] ? 'mesure' : valeur(dims[k]) === modele.dims[k] && modele.dims.sources?.[k] === 'scan' ? 'scan' : modele.dims.sources?.[k] === 'estimation' ? 'estimation' : 'photo';
  const correction = { dims: valides ? Object.fromEntries(clesDims.map(k => [k, valeur(dims[k])])) : {},
    sources: Object.fromEntries(clesDims.map(k => [k, source(k)])), ajouts, ...(contour?{contour}:{}),
    murs: Object.fromEntries([...touches].map(m => [m, { ouvertures: murs[m]?.ouvertures || [] }])),
    meubles: Object.entries(releve).map(([id, dim]) => ({ id, dim: dim.map(valeur) })) };
  let preview, contourValide=true;
  try { preview=corrigerPiece(modele,items,correction,produits); } catch (_) { contourValide=false;preview={modele,agencement:items}; }
  const modelePlan=preview.modele, pans=segmentsDe(modelePlan);
  const long = longueurMur(modelePlan.dims, mur, modelePlan);
  const nomMur=m=>t.murs[m] || `${lang==='fr'?'Mur':'Wall'} ${m.split('_').at(-1)}`;
  const contourTexte=lang==='fr' ? 'Coins du contour · coordonnées X/Z en mètres' : 'Outline corners · X/Z coordinates in metres';
  const contourErreur=lang==='fr' ? 'Le contour se croise, est trop petit ou dépasse le cadre. Corrigez les coins.' : 'The outline crosses itself, is too small or exceeds the frame. Correct the corners.';
  const existants = preview.agencement.filter(it => it.origine === 'existant' && it.garde !== false && it.p?.dim);
  const choisi = existants.find(it => it.id === meuble);

  function changerMur(m, ouvertures) {
    setMurs(l => ({ ...l, [m]: { ...l[m], ouvertures } }));
    setTouches(l => new Set([...l, m]));
  }
  function modifierOuverture(m, i, champs) {
    setMurs(l => ({ ...l, [m]: { ...l[m], ouvertures: (l[m]?.ouvertures || []).map((o, j) => j === i ? { ...o, ...champs } : o) } }));
    setTouches(l => new Set([...l, m]));
  }
  function glisser(e, m, i) {
    if (attente) return;
    setMur(m); setSelection({ mur: m, i });
    const cible = e.currentTarget, svg = cible.ownerSVGElement, matrice = svg.getScreenCTM();
    if (!matrice) return;
    e.preventDefault(); cible.setPointerCapture(e.pointerId);
    const o = modelePlan.murs[m].ouvertures[i], longueur = longueurMur(modelePlan.dims, m, modelePlan), pan=pans.find(p=>p.id===m);
    const bouger = ev => {
      const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(matrice.inverse());
      const pos = ((p.x-pan.centre[0])*pan.d[0]+(p.y-pan.centre[1])*pan.d[1])*pan.signePosition;
      modifierOuverture(m, i, { position: rond(Math.max(-longueur / 2 + o.largeur / 2, Math.min(longueur / 2 - o.largeur / 2, pos))) });
    };
    const finir = () => { cible.removeEventListener('pointermove', bouger); cible.removeEventListener('pointerup', finir); cible.removeEventListener('pointercancel', finir); };
    cible.addEventListener('pointermove', bouger); cible.addEventListener('pointerup', finir); cible.addEventListener('pointercancel', finir);
  }
  function activerContour() {
    setContour(contourDe(modelePlan).map(p=>[...p]));
    const nouveaux=Object.fromEntries(pans.map((p,i)=>[`pan_${i+1}`,{...murs[p.id],ouvertures:(murs[p.id]?.ouvertures||[]).map(o=>({...o,position:o.position*p.signePosition}))}]));
    setMurs(nouveaux);setTouches(new Set(Object.keys(nouveaux)));setMur('pan_1');
  }
  function coin(i,axe,v) {setContour(ps=>ps.map((p,j)=>j===i?p.map((n,k)=>k===axe?Number(v):n):p));}
  function changerCoins(ps) {
    setContour(ps);const nouveaux=Object.fromEntries(ps.map((_,i)=>[`pan_${i+1}`,{ouvertures:[]}]));
    setMurs(nouveaux);setTouches(new Set(Object.keys(nouveaux)));setMur('pan_1');setSelection(null);
  }
  function glisserCoin(e,i) {
    if(attente)return;const cible=e.currentTarget,matrice=cible.ownerSVGElement.getScreenCTM();if(!matrice)return;
    e.preventDefault();cible.setPointerCapture(e.pointerId);
    const bouger=ev=>{const p=new DOMPoint(ev.clientX,ev.clientY).matrixTransform(matrice.inverse());setContour(ps=>ps.map((q,j)=>j===i?[rond(Math.max(-modelePlan.dims.largeur/2,Math.min(modelePlan.dims.largeur/2,p.x))),rond(Math.max(-modelePlan.dims.profondeur/2,Math.min(modelePlan.dims.profondeur/2,p.y)))]:q));};
    const finir=()=>{cible.removeEventListener('pointermove',bouger);cible.removeEventListener('pointerup',finir);cible.removeEventListener('pointercancel',finir);};
    cible.addEventListener('pointermove',bouger);cible.addEventListener('pointerup',finir);cible.addEventListener('pointercancel',finir);
  }
  async function sauver(e) {
    e.preventDefault(); setErreur('');
    if (!valides || !contourValide) { setErreur(contourValide?t.limites:contourErreur); return; }
    const meubles = Object.entries(releve).map(([id, dim]) => ({ id, dim: dim.map(valeur) }));
    if (meubles.some(m => !m.dim.every(v => Number.isFinite(v) && v >= .01 && v <= 6))) { setErreur(t.limites); return; }
    setAttente(true);
    try {
      const ok = await onSauver({ dims: Object.fromEntries(clesDims.map(k => [k, valeur(dims[k])])),
        sources: Object.fromEntries(clesDims.map(k => [k, source(k)])), ...(contour?{contour}:{}),
        murs: Object.fromEntries([...touches].map(m => [m, { ouvertures: modelePlan.murs[m].ouvertures }])), meubles,
        ajouts: ajouts.map(m => ({ ...m, dim: meubles.find(e => e.id === m.id)?.dim || m.dim })) });
      if (ok !== false) onFermer(); else setErreur(t.erreur);
    } catch (_) { setErreur(t.erreur); }
    setAttente(false);
  }
  const champ = (label, value, change, min = 0, max = 30) => <label className={s.champ}><span>{label} (m)</span><input type="number" step=".01" min={min} max={max} required value={value} onChange={e => change(e.target.value)} /></label>;
  return <dialog ref={dialogue} className={s.dialogue} onCancel={e => { e.preventDefault(); if (!attente) onFermer(); }} aria-labelledby="plan-titre">
    <form onSubmit={sauver}>
      <header className={s.entete}><h2 id="plan-titre">{t.titre}</h2><button type="button" disabled={attente} aria-label={t.fermer} onClick={onFermer}>×</button></header>
      <p className={s.intro}>{t.intro}</p>
      <div className={s.dimensions}>{clesDims.map((k, i) => <div key={k}>
        {champ(t.dims[i], dims[k], v => { if(contour && k!=='hauteur' && valeur(v)>0 && valeur(dims[k])>0){const axe=k==='largeur'?0:1,rapport=valeur(v)/valeur(dims[k]);setContour(ps=>ps.map(p=>p.map((n,j)=>j===axe?rond(n*rapport):n)));}setDims(d=>({...d,[k]:v})); setMesures(d => ({ ...d, [k]: true })); }, i === 2 ? 1.9 : 1.2, i === 2 ? 8 : 30)}
        <label className={s.confirmer}><input type="checkbox" checked={mesures[k]} onChange={e => setMesures(d => ({ ...d, [k]: e.target.checked }))} />{mesures[k] ? t.mesure : source(k) === 'scan' ? t.scan : t.estime}</label>
      </div>)}</div>
      <div className={s.corps}>
        <div className={s.visuel}><ApercuPlan modele={modelePlan} items={preview.agencement} produits={produits} label={t.titre} selection={selection} surCoin={contour?glisserCoin:undefined} surPointer={glisser} surChoisir={(m, i) => { setMur(m); setSelection({ mur: m, i }); }} /><p>{t.aide}</p><p>{t.note}</p></div>
        <div className={s.reglages}>
          <h3>{contourTexte}</h3>
          {!contour ? <button type="button" onClick={activerContour}>{lang==='fr'?'Modifier la forme de la pièce':'Edit room shape'}</button> : <>
            <p className={s.intro}>{lang==='fr'?'Glissez les coins sur le plan ou saisissez leurs coordonnées. Ajouter/retirer un coin efface les ouvertures : replacez-les ensuite.':'Drag corners or enter coordinates. Adding/removing a corner clears openings: place them again afterwards.'}</p>
            {!contourValide && <p role="alert">{contourErreur}</p>}
            {contour.map((p,i)=><fieldset key={i} className={s.ouvertureChamps}><legend>{lang==='fr'?'Coin':'Corner'} {i+1}</legend><div className={s.paire}>{champ('X',p[0],v=>coin(i,0,v),-modelePlan.dims.largeur/2,modelePlan.dims.largeur/2)}{champ('Z',p[1],v=>coin(i,1,v),-modelePlan.dims.profondeur/2,modelePlan.dims.profondeur/2)}</div><p>{lang==='fr'?'Mur suivant':'Next wall'} : {Math.hypot(p[0]-contour[(i+1)%contour.length][0],p[1]-contour[(i+1)%contour.length][1]).toFixed(2)} m</p><div className={s.actions}><button type="button" disabled={contour.length>=32} onClick={()=>{const q=contour[(i+1)%contour.length];changerCoins([...contour.slice(0,i+1),p.map((v,k)=>rond((v+q[k])/2)),...contour.slice(i+1)]);}}>{lang==='fr'?'Ajouter un coin après':'Add corner after'}</button><button type="button" disabled={contour.length<=3} onClick={()=>changerCoins(contour.filter((_,j)=>j!==i))}>{t.retirer}</button></div></fieldset>)}
          </>}
          <h3>{t.ouvertures}</h3>
          <label className={s.champ}><span>{nomMur(mur)}</span><select aria-label={t.ouvertures} value={mur} onChange={e => { setMur(e.target.value); setSelection(null); }}>{pans.map(({id:m}) => <option key={m} value={m}>{nomMur(m)}</option>)}</select></label>
          {modele.murs?.[mur]?.observe !== true && !touches.has(mur) && <p className={s.inconnu}>{t.inconnu}</p>}
          {(modelePlan.murs[mur]?.ouvertures || []).map((o, i) => <fieldset key={i} className={s.ouvertureChamps}>
            <legend>{t.types[o.type]} {i + 1}</legend>
            <label className={s.champ}><span>{t.type}</span><select aria-label={t.type} value={o.type} onChange={e => modifierOuverture(mur, i, { type: e.target.value })}>{Object.entries(t.types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            {champ(t.position, rond(o.position + long / 2), v => modifierOuverture(mur, i, { position: valeur(v) - long / 2 }), o.largeur / 2, long - o.largeur / 2)}
            <div className={s.paire}>{champ(t.largeur, o.largeur, v => modifierOuverture(mur, i, { largeur: valeur(v) }), .3, long - .1)}{champ(t.hauteur, o.hauteur, v => modifierOuverture(mur, i, { hauteur: valeur(v) }), .4, modelePlan.dims.hauteur)}</div>
            {!['porte', 'passage'].includes(o.type) && champ(t.allege, o.allege, v => modifierOuverture(mur, i, { allege: valeur(v) }), 0, modelePlan.dims.hauteur - .45)}
            <button type="button" onClick={() => changerMur(mur, (murs[mur]?.ouvertures || []).filter((_, j) => i !== j))}>{t.retirer}</button>
          </fieldset>)}
          <div className={s.actions}><button type="button" disabled={(murs[mur]?.ouvertures || []).length >= 6} onClick={() => changerMur(mur, [...murs[mur]?.ouvertures || [], { type: 'porte', position: 0, largeur: .9, hauteur: 2.04, allege: 0 }])}>{t.ajouter}</button><button type="button" onClick={() => changerMur(mur, [])}>{t.aucune}</button></div>
          {existants.length > 0 && <><h3>{t.meubles}</h3><select aria-label={t.meubles} value={meuble} onChange={e => setMeuble(e.target.value)}><option value="">{t.choisir}</option>{existants.map(it => <option key={it.id} value={it.id}>{it.p.nom}</option>)}</select>
            {choisi && <div className={s.dimensions}>{clesDims.map((k, i) => <div key={k}>{champ(t.dims[i], (releve[meuble] || choisi.p.dim)[i], v => setReleve(l => ({ ...l, [meuble]: (l[meuble] || choisi.p.dim).map((d, j) => j === i ? v : d) })), .01, 6)}</div>)}</div>}
            <p className={s.intro}>{t.meublesNote}</p></>}
          <h3>{t.ajout}</h3><p className={s.intro}>{t.ajoutsNote}</p>
          {!ajout ? <button type="button" disabled={existants.length >= 40} onClick={() => setAjout({ fam: 'lit', nom: '', dim: ['', '', ''], x: modelePlan.dims.largeur / 2, p: modelePlan.dims.profondeur / 2, rot: 0 })}>{t.ajout}</button>
            : <fieldset className={s.ouvertureChamps}><legend>{t.ajout}</legend>
              <label className={s.champ}><span>{t.famille}</span><select value={ajout.fam} onChange={e => setAjout(a => ({ ...a, fam: e.target.value }))}>{Object.entries(famillesManuelles[lang] || famillesManuelles.fr).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className={s.champ}><span>{t.nom}</span><input maxLength={80} value={ajout.nom} onChange={e => setAjout(a => ({ ...a, nom: e.target.value }))} /></label>
              <div className={s.dimensions}>{clesDims.map((k, i) => <div key={k}>{champ(t.dims[i], ajout.dim[i], v => setAjout(a => ({ ...a, dim: a.dim.map((d, j) => j === i ? v : d) })), .01, 6)}</div>)}</div>
              {champ(t.depuisGauche, ajout.x, v => setAjout(a => ({ ...a, x: v })), 0, modelePlan.dims.largeur)}
              {champ(t.depuisEntree, ajout.p, v => setAjout(a => ({ ...a, p: v })), 0, modelePlan.dims.profondeur)}
              <label className={s.champ}><span>{t.face}</span><select value={ajout.rot} onChange={e => setAjout(a => ({ ...a, rot: Number(e.target.value) }))}>{[['entree', 0], ['droite', Math.PI / 2], ['fond', Math.PI], ['gauche', -Math.PI / 2]].map(([m, v]) => <option key={m} value={v}>{t.murs[m]}</option>)}</select></label>
              <div className={s.actions}><button type="button" onClick={() => setAjout(null)}>{t.annulerAjout}</button><button type="button" disabled={!ajout.dim.every(v => valeur(v) >= .01 && valeur(v) <= 6) || !valides} onClick={() => {
                const id = 'm_' + Date.now().toString(36) + '_' + ajouts.length;
                setAjouts(l => [...l, { id, fam: ajout.fam, nom: ajout.nom || (famillesManuelles[lang] || famillesManuelles.fr)[ajout.fam], dim: ajout.dim.map(valeur),
                  x: rond(valeur(ajout.x) - modelePlan.dims.largeur / 2), z: rond(modelePlan.dims.profondeur / 2 - valeur(ajout.p)), rot: ajout.rot }]);
                setAjout(null); setMeuble(id);
              }}>{t.validerAjout}</button></div>
            </fieldset>}
        </div>
      </div>
      <footer className={s.pied}><p role="alert">{erreur}</p><button type="button" disabled={attente} onClick={onFermer}>{t.fermer}</button><button type="submit" disabled={attente || !valides || !contourValide}>{attente ? t.attente : t.sauver}</button></footer>
    </form>
  </dialog>;
}

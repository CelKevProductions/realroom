'use client';
import { useEffect, useRef, useState } from 'react';
import { MURS, boite, produitDe, estSuspendu } from '@/lib/agencement.js';
import { longueurMur, corrigerPiece } from '@/lib/geometrie.js';
import s from './PlanPiece.module.css';

const textes = {
  fr: { titre: 'Vérifier le plan de la pièce', intro: 'Mesurez une longueur réelle pour corriger l’échelle. Les autres dimensions restent estimées tant que vous ne les confirmez pas.',
    dims: ['Largeur', 'Profondeur', 'Hauteur'], mesure: 'Mesure vérifiée', estime: 'Estimée', murs: { fond: 'Mur du fond', entree: 'Mur d’entrée', gauche: 'Mur gauche', droite: 'Mur droit' },
    types: { porte: 'Porte', fenetre: 'Fenêtre', baie: 'Baie', passage: 'Passage' },
    ouvertures: 'Portes et fenêtres', ajouter: 'Ajouter une ouverture', aucune: 'Ce mur est sans ouverture', inconnu: 'Mur à vérifier sur place',
    position: 'Centre depuis le début du mur', largeur: 'Largeur', hauteur: 'Hauteur', allege: 'Hauteur d’allège', type: 'Type', retirer: 'Retirer',
    meubles: 'Dimensions d’un meuble existant', choisir: 'Choisir un meuble', meublesNote: 'Ces mesures corrigent le relevé. Les dimensions des produits de la boutique viennent de leur fiche.',
    aide: 'Sélectionnez une ouverture sur le plan et glissez-la le long du mur, ou ajustez ses mesures ci-dessous.',
    fermer: 'Fermer', sauver: 'Enregistrer le plan', attente: 'Enregistrement…', erreur: 'Le plan n’a pas pu être enregistré. Réessayez.',
    limites: 'Saisissez des dimensions valides : 1,20–30 m au sol, 1,90–8 m sous plafond.',
    note: 'Le plan représente une pièce rectangulaire. Les renfoncements et murs obliques ne sont pas encore pris en charge.' },
  en: { titre: 'Check your room plan', intro: 'Measure a real length to correct the scale. Other dimensions remain estimates until you confirm them.',
    dims: ['Width', 'Depth', 'Height'], mesure: 'Verified measurement', estime: 'Estimated', murs: { fond: 'Far wall', entree: 'Entrance wall', gauche: 'Left wall', droite: 'Right wall' },
    types: { porte: 'Door', fenetre: 'Window', baie: 'Glass opening', passage: 'Passage' },
    ouvertures: 'Doors and windows', ajouter: 'Add an opening', aucune: 'This wall has no openings', inconnu: 'Check this wall on site',
    position: 'Centre from the start of the wall', largeur: 'Width', hauteur: 'Height', allege: 'Sill height', type: 'Type', retirer: 'Remove',
    meubles: 'Existing furniture dimensions', choisir: 'Choose a piece', meublesNote: 'These measurements correct the survey. Shop product dimensions come from their listing.',
    aide: 'Select an opening on the plan and drag it along the wall, or adjust its measurements below.',
    fermer: 'Close', sauver: 'Save room plan', attente: 'Saving…', erreur: 'The room plan could not be saved. Please try again.',
    limites: 'Enter valid dimensions: 1.20–30 m on the floor, 1.90–8 m ceiling height.',
    note: 'The plan represents a rectangular room. Recesses and angled walls are not supported yet.' }
};
const clesDims = ['largeur', 'profondeur', 'hauteur'];
const valeur = v => Number(String(v).replace(',', '.'));
const rond = v => Math.round(v * 100) / 100;

// Petit plan exact de la maquette, utilisé aussi pour comparer les dispositions.
export function ApercuPlan({ modele, items = [], produits = {}, label, ouvertures, selection, surPointer, surChoisir }) {
  const { largeur: L, profondeur: P } = modele.dims, marge = Math.max(L, P) * .15;
  return <svg className={s.plan} viewBox={`${-L / 2 - marge} ${-P / 2 - marge} ${L + marge * 2} ${P + marge * 2}`}
    role="img" aria-label={label}>
    <rect x={-L / 2} y={-P / 2} width={L} height={P} fill="#F8F4EA" stroke="#74634F" strokeWidth={.035} />
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
    {MURS.flatMap(mur => (ouvertures?.[mur] || modele.murs?.[mur]?.ouvertures || []).map((o, i) => {
      const horizontal = ['fond', 'entree'].includes(mur), x = horizontal ? o.position : mur === 'gauche' ? -L / 2 : L / 2;
      const z = horizontal ? mur === 'fond' ? -P / 2 : P / 2 : o.position;
      return <g key={`${mur}-${i}`} className={surPointer ? s.ouverture : undefined}
        onPointerDown={surPointer ? e => surPointer(e, mur, i) : undefined}
        onClick={surChoisir ? () => surChoisir(mur, i) : undefined}>
        <line x1={horizontal ? x - o.largeur / 2 : x} y1={horizontal ? z : z - o.largeur / 2}
          x2={horizontal ? x + o.largeur / 2 : x} y2={horizontal ? z : z + o.largeur / 2}
          stroke={['porte', 'passage'].includes(o.type) ? '#806746' : '#648B92'} strokeWidth={.12} />
        {surPointer && <circle cx={x} cy={z} r={.14} fill={selection?.mur === mur && selection?.i === i ? '#392D23' : '#FFFDF6'} stroke="#74634F" strokeWidth={.035} />}
      </g>;
    }))}
    <text x={0} y={-P / 2 - marge * .5} textAnchor="middle" fontSize={marge * .32} fill="currentColor">{L.toFixed(2)} m</text>
    <text x={L / 2 + marge * .5} y={0} textAnchor="middle" fontSize={marge * .32} fill="currentColor" transform={`rotate(90 ${L / 2 + marge * .5} 0)`}>{P.toFixed(2)} m</text>
  </svg>;
}

export default function PlanPiece({ modele, items, produits, lang = 'fr', onSauver, onFermer }) {
  const t = textes[lang] || textes.fr, dialogue = useRef(null);
  const [dims, setDims] = useState(() => Object.fromEntries(clesDims.map(k => [k, String(modele.dims[k])])));
  const [mesures, setMesures] = useState(() => Object.fromEntries(clesDims.map(k => [k, modele.dims.sources?.[k] === 'mesure' || modele.dims.estimees === false])));
  const [murs, setMurs] = useState(() => structuredClone(modele.murs));
  const [touches, setTouches] = useState(() => new Set());
  const [mur, setMur] = useState('entree'), [selection, setSelection] = useState(null);
  const [meuble, setMeuble] = useState(''), [releve, setReleve] = useState({});
  const [attente, setAttente] = useState(false), [erreur, setErreur] = useState('');
  useEffect(() => { const d = dialogue.current; d.showModal(); return () => d.close(); }, []);
  const valides = clesDims.every((k, i) => { const n = valeur(dims[k]); return Number.isFinite(n) && n >= (i === 2 ? 1.9 : 1.2) && n <= (i === 2 ? 8 : 30); });
  const correction = { dims: valides ? Object.fromEntries(clesDims.map(k => [k, valeur(dims[k])])) : {},
    sources: Object.fromEntries(clesDims.map(k => [k, mesures[k] ? 'mesure' : 'photo'])),
    murs: Object.fromEntries([...touches].map(m => [m, { ouvertures: murs[m]?.ouvertures || [] }])),
    meubles: Object.entries(releve).map(([id, dim]) => ({ id, dim: dim.map(valeur) })) };
  const preview = corrigerPiece(modele, items, correction, produits), modelePlan = preview.modele;
  const long = longueurMur(modelePlan.dims, mur);
  const existants = items.filter(it => it.origine === 'existant' && it.garde !== false && it.p?.dim);
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
    const o = modelePlan.murs[m].ouvertures[i], longueur = longueurMur(modelePlan.dims, m);
    const bouger = ev => {
      const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(matrice.inverse());
      const pos = ['fond', 'entree'].includes(m) ? p.x : p.y;
      modifierOuverture(m, i, { position: rond(Math.max(-longueur / 2 + o.largeur / 2, Math.min(longueur / 2 - o.largeur / 2, pos))) });
    };
    const finir = () => { cible.removeEventListener('pointermove', bouger); cible.removeEventListener('pointerup', finir); cible.removeEventListener('pointercancel', finir); };
    cible.addEventListener('pointermove', bouger); cible.addEventListener('pointerup', finir); cible.addEventListener('pointercancel', finir);
  }
  async function sauver(e) {
    e.preventDefault(); setErreur('');
    if (!valides) { setErreur(t.limites); return; }
    const meubles = Object.entries(releve).map(([id, dim]) => ({ id, dim: dim.map(valeur) }));
    if (meubles.some(m => !m.dim.every(v => Number.isFinite(v) && v >= .01 && v <= 6))) { setErreur(t.limites); return; }
    setAttente(true);
    try {
      const ok = await onSauver({ dims: Object.fromEntries(clesDims.map(k => [k, valeur(dims[k])])),
        sources: Object.fromEntries(clesDims.map(k => [k, mesures[k] ? 'mesure' : 'photo'])),
        murs: Object.fromEntries([...touches].map(m => [m, { ouvertures: modelePlan.murs[m].ouvertures }])), meubles });
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
        {champ(t.dims[i], dims[k], v => { setDims(d => ({ ...d, [k]: v })); setMesures(d => ({ ...d, [k]: true })); }, i === 2 ? 1.9 : 1.2, i === 2 ? 8 : 30)}
        <label className={s.confirmer}><input type="checkbox" checked={mesures[k]} onChange={e => setMesures(d => ({ ...d, [k]: e.target.checked }))} />{mesures[k] ? t.mesure : t.estime}</label>
      </div>)}</div>
      <div className={s.corps}>
        <div className={s.visuel}><ApercuPlan modele={modelePlan} items={preview.agencement} produits={produits} label={t.titre} selection={selection} surPointer={glisser} surChoisir={(m, i) => { setMur(m); setSelection({ mur: m, i }); }} /><p>{t.aide}</p><p>{t.note}</p></div>
        <div className={s.reglages}>
          <h3>{t.ouvertures}</h3>
          <label className={s.champ}><span>{t.murs[mur]}</span><select aria-label={t.ouvertures} value={mur} onChange={e => { setMur(e.target.value); setSelection(null); }}>{MURS.map(m => <option key={m} value={m}>{t.murs[m]}</option>)}</select></label>
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
        </div>
      </div>
      <footer className={s.pied}><p role="alert">{erreur}</p><button type="button" disabled={attente} onClick={onFermer}>{t.fermer}</button><button type="submit" disabled={attente || !valides}>{attente ? t.attente : t.sauver}</button></footer>
    </form>
  </dialog>;
}

'use client';
import { referencesStylesDe } from '@/lib/references-styles.js';

import { useEffect, useMemo, useRef, useState } from 'react';
import { bilanConfort, optimiserAmenagement } from '@/lib/confort.js';
import PlanPiece, { ApercuPlan } from './PlanPiece.js';
import { REFERENCES } from '@/lib/references.js';
import s from './Confort.module.css';

const textes = {
  fr: {
    titre: 'La pièce au quotidien', passages: 'Passages', acces: 'Accès aux meubles', ouvertures: 'Ouvertures',
    bon: 'Dégagé', attention: 'À ajuster', inconnu: 'À vérifier', details: 'Voir les repères',
    note: 'Repères indicatifs sur la maquette : environ 90 cm pour circuler, 60 cm autour du lit et 35 à 50 cm entre canapé et table basse.',
    estimees: 'Les dimensions sont estimées à partir des photos. Confirmez-les avant de commander.',
    pasDePorte: 'Aucune entrée reconnue : vérifiez les passages dans votre pièce.',
    optimiser: 'Optimiser la disposition', attente: 'Ajustement…', annuler: 'Annuler l’ajustement',
    garde: 'Les meubles existants et ceux choisis « à garder » restent en place.',
    modifie: 'Disposition ajustée. Vous pouvez revenir à la précédente.',
    identique: 'Aucune meilleure disposition trouvée avec les meubles conservés.',
    annule: 'La disposition précédente est rétablie.',
    releve: 'Relevé à confirmer', incertain: 'Certains éléments ont été reconnus avec incertitude. Vérifiez leur place et leurs dimensions.',
    murs: 'Un ou plusieurs murs ne sont pas visibles sur les photos : leurs ouvertures restent à vérifier.',
    plan: 'Vérifier le plan et les mesures', comparer: 'Comparer les dispositions', disposition: 'Disposition',
    aucune: 'Aucune autre disposition améliorant l’usage n’a été trouvée avec ces meubles.', choix: 'Choisissez le plan qui vous convient. Les meubles et leur prix restent identiques.',
    score: 'Score de disposition', partiel: 'Partiel', scoreNote: 'Indice indicatif pour comparer ces meubles dans cette pièce. Il ne mesure pas la beauté du projet. Les collisions, les ouvertures et les accès passent avant le style.',
    criteres: { geometrie: 'Encombrement et ouvertures', circulation: 'Chemins depuis les portes', usage: 'Recul pour utiliser les meubles', relations: 'Groupes de meubles', orientation: 'Orientation et vue', conversation: 'Conversation', equilibre: 'Équilibre visuel', alignement: 'Alignement', symetrie: 'Symétrie', tapisLumiere: 'Tapis et lumière près des usages' },
    sans: 'Non applicable', recherche: 'Principes de composition', sources: 'Règles inspirées de ces travaux, adaptées à RealRoom.',
    profil: 'Préférences', styles: { neutre: 'Libre', epure: 'Épuré', chaleureux: 'Chaleureux', classique: 'Classique', boheme: 'Bohème', artdeco: 'Art déco', japandi: 'Japandi', audacieux: 'Audacieux', mediterraneen: 'Méditerranéen', scandinave: 'Scandinave', industriel: 'Industriel', contemporain: 'Contemporain' }, compositions: { equilibre: 'Équilibre', conversation: 'Conversation', symetrie: 'Symétrie' }
  },
  en: {
    titre: 'Designed for everyday living', passages: 'Walkways', acces: 'Furniture access', ouvertures: 'Doors & windows',
    bon: 'Clear', attention: 'Needs room', inconnu: 'Check', details: 'View the guidance',
    note: 'Indicative model checks: about 90 cm for walkways, 60 cm beside beds and 35–50 cm between a sofa and coffee table.',
    estimees: 'Dimensions are estimated from your photos. Confirm them before ordering.',
    pasDePorte: 'No entrance was recognised: check the walkways in your room.',
    optimiser: 'Improve the arrangement', attente: 'Adjusting…', annuler: 'Undo adjustment',
    garde: 'Existing furniture and pieces you chose to keep stay in place.',
    modifie: 'Arrangement adjusted. You can return to the previous version.',
    identique: 'No better arrangement found with the pieces being kept.',
    annule: 'Your previous arrangement has been restored.',
    releve: 'Survey to confirm', incertain: 'Some elements were recognised with uncertainty. Check their position and size.',
    murs: 'One or more walls are not visible in the photos: their openings still need to be checked.',
    plan: 'Check the plan and measurements', comparer: 'Compare arrangements', disposition: 'Arrangement',
    aucune: 'No other arrangement improving everyday use was found with these pieces.', choix: 'Choose the plan you prefer. The furniture and prices stay the same.',
    score: 'Layout score', partiel: 'Partial', scoreNote: 'An indicative index to compare these pieces in this room. It does not measure beauty. Collisions, openings and access take priority over style.',
    criteres: { geometrie: 'Footprints and openings', circulation: 'Routes from doorways', usage: 'Room to use furniture', relations: 'Furniture groups', orientation: 'Orientation and view', conversation: 'Conversation', equilibre: 'Visual balance', alignement: 'Alignment', symetrie: 'Symmetry', tapisLumiere: 'Rugs and lighting near activities' },
    sans: 'Not applicable', recherche: 'Composition principles', sources: 'Rules inspired by these studies, adapted for RealRoom.',
    profil: 'Preferences', styles: { neutre: 'Flexible', epure: 'Minimal', chaleureux: 'Warm', classique: 'Classic', boheme: 'Bohemian', artdeco: 'Art deco', japandi: 'Japandi', audacieux: 'Bold', mediterraneen: 'Mediterranean', scandinave: 'Scandinavian', industriel: 'Industrial', contemporain: 'Contemporary' }, compositions: { equilibre: 'Balance', conversation: 'Conversation', symetrie: 'Symmetry' }
  }
};

export default function Confort({ modele, items, produits, lang = 'fr', garder = [], avis = [], onAppliquer, onCorriger, mode, envies, preferences }) {
  const t = textes[lang] || textes.fr;
  const bilan = useMemo(() => produits ? bilanConfort(modele, items, produits, lang, { envies, preferences }) : null, [modele, items, produits, lang, envies, preferences]);
  const [attente, setAttente] = useState(false), [message, setMessage] = useState(''), [retour, setRetour] = useState(null);
  const [plan, setPlan] = useState(false), [comparaison, setComparaison] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!bilan) return null;
  const fixes = [...garder, ...items.filter(it => it.origine === 'existant' || it.fixe).map(it => it.id)];
  const mobile = items.some(it => it.garde !== false && !fixes.includes(it.id));
  const valeurs = [[t.passages, bilan.circulation], [t.acces, bilan.acces], [t.ouvertures, bilan.ouvertures]];
  const incertain = items.some(it => it.origine === 'existant' && it.confiance < .65)
    || Object.values(modele.murs || {}).some(m => m.ouvertures?.some(o => o.confiance != null && o.confiance < .65));
  const mursInconnus = Object.values(modele.murs || {}).some(m => m.observe === false);

  function optimiser(comparer = false) {
    setAttente(true);
    // Laisse le bouton s'afficher avant le calcul local ; aucun appel IA ni crédit consommé.
    timer.current = setTimeout(() => {
      const r = optimiserAmenagement(modele, items, produits, { garder: fixes, langue: lang, mode, envies, preferences, ...(comparer ? { variantes: 3 } : {}) });
      if (comparer) { setComparaison({ base: items, variantes: r.variantes }); setAttente(false); return; }
      const change = r.items.some((it, i) => it.x !== items[i].x || it.z !== items[i].z || it.rot !== items[i].rot);
      if (change) { setRetour({ avant: items, apres: r.items }); onAppliquer(r.items); }
      setMessage(change ? t.modifie : t.identique);
      setAttente(false);
    }, 32);
  }

  return <section className={s.carte} aria-label={t.titre}>
    <p className={s.titre}>{t.titre}</p>
    {(incertain || mursInconnus) && <p className={s.releve}><strong>{t.releve}.</strong> {mursInconnus ? t.murs : t.incertain}</p>}
    <ul className={s.reperes}>
      {valeurs.map(([nom, valeur]) => <li key={nom} data-etat={valeur === true ? 'bon' : 'attention'}>
        <span aria-hidden="true">{valeur === true ? '✓' : '·'}</span>
        <span>{nom}<small>{valeur === null ? t.inconnu : valeur ? t.bon : t.attention}</small></span>
      </li>)}
    </ul>
    <details className={s.score}>
      <summary>{t.score} <strong>{bilan.score.total === null ? t.inconnu : `${bilan.score.total}/100`}</strong>{bilan.score.incomplet && <small> · {t.partiel}</small>}</summary>
      <p>{t.scoreNote}</p>
      <dl>{bilan.score.criteres.map(c => <div key={c.id}><dt>{t.criteres[c.id]}</dt><dd>{c.note === null ? c.id === 'circulation' ? t.inconnu : t.sans : `${c.note}/100`}</dd></div>)}</dl>
      <p>{t.profil} : {bilan.score.preferences.styles.map(id => t.styles[id]).join(' / ')} · {t.compositions[bilan.score.preferences.composition]}</p>
      {bilan.score.preferences.resume && <p>{bilan.score.preferences.resume}</p>}
      {bilan.score.preferences.palette.length > 0 && <p>{bilan.score.preferences.palette.join(' · ')}{bilan.score.preferences.matieres.length > 0 ? ' / ' + bilan.score.preferences.matieres.join(' · ') : ''}</p>}
    </details>
    <details className={s.details}><summary>{lang==='fr'?'Inspirations des styles':'Style inspirations'}</summary><p>{lang==='fr'?'Exemples de palettes, matières et compositions. Votre sélection de styles guide les produits et les dispositions ; les passages restent prioritaires.':'Examples of palettes, materials and compositions. Your styles guide products and layouts; clear passages remain the priority.'}</p><ul>{referencesStylesDe(bilan.score.preferences.styles).map(ref=><li key={ref.id}><a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.titre}</a></li>)}</ul></details>
    <details className={s.details}>
      <summary>{t.details}{bilan.alertes.length > 0 && <span> · {bilan.alertes.length}</span>}</summary>
      {bilan.alertes.length > 0 && <ul>{bilan.alertes.map((a, i) => <li key={i}>{a.texte}</li>)}</ul>}
      {avis.length > 0 && <ul>{avis.map((a, i) => <li key={i}>{a}</li>)}</ul>}
      {bilan.circulation === null && <p>{t.pasDePorte}</p>}
      <p>{t.note}</p>
      {bilan.mesuresEstimees && <p>{t.estimees}</p>}
      {incertain && mursInconnus && <p>{t.incertain}</p>}
      {(modele.remarques || []).length > 0 && <ul>{modele.remarques.map((r, i) => <li key={i}>{r}</li>)}</ul>}
      <p>{t.sources}</p>
      <ul aria-label={t.recherche}>{REFERENCES.map(ref => <li key={ref.id}><a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.titre}</a></li>)}</ul>
    </details>
    {onAppliquer && <>
      <div className={s.actions}>
        <button type="button" disabled={attente || !mobile} onClick={() => optimiser()}>{attente ? t.attente : t.optimiser}<span aria-hidden="true"> ↗</span></button>
        <button type="button" disabled={attente || !mobile} onClick={() => optimiser(true)}>{t.comparer}</button>
        {retour?.apres === items && <button type="button" className={s.annuler} disabled={attente} onClick={() => { onAppliquer(retour.avant); setRetour(null); setMessage(t.annule); }}>{t.annuler}</button>}
      </div>
      <p className={s.note}>{t.garde}</p>
      <p className={s.message} role="status">{message}</p>
    </>}
    {comparaison?.base === items && <div className={s.comparaison}>
      <p>{comparaison.variantes.length > 1 ? t.choix : t.aucune}</p>
      <div className={s.variantes}>{comparaison.variantes.map((v, i) => <button type="button" key={i} aria-label={`${t.disposition} ${i + 1}`} onClick={() => {
        setRetour({ avant: items, apres: v.items }); onAppliquer(v.items); setComparaison(null); setMessage(t.modifie);
      }}><ApercuPlan modele={modele} items={v.items} produits={produits} label={`${t.disposition} ${i + 1}`} /><span>{t.disposition} {i + 1}</span><small>{v.confort.score.total}/100 · {v.confort.alertes.length} {lang === 'en' ? 'checks' : 'repères à revoir'}</small></button>)}</div>
    </div>}
    {onCorriger && <div className={s.actions}><button type="button" onClick={() => setPlan(true)}>{t.plan}</button></div>}
    {plan && <PlanPiece modele={modele} items={items} produits={produits} lang={lang} onSauver={onCorriger} onFermer={() => setPlan(false)} />}
  </section>;
}

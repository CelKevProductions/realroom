'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { bilanConfort, optimiserAmenagement } from '@/lib/confort.js';
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
    murs: 'Un ou plusieurs murs ne sont pas visibles sur les photos : leurs ouvertures restent à vérifier.'
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
    murs: 'One or more walls are not visible in the photos: their openings still need to be checked.'
  }
};

export default function Confort({ modele, items, produits, lang = 'fr', garder = [], avis = [], onAppliquer }) {
  const t = textes[lang] || textes.fr;
  const bilan = useMemo(() => produits ? bilanConfort(modele, items, produits, lang) : null, [modele, items, produits, lang]);
  const [attente, setAttente] = useState(false), [message, setMessage] = useState(''), [retour, setRetour] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!bilan) return null;
  const fixes = [...garder, ...items.filter(it => it.origine === 'existant' || it.fixe).map(it => it.id)];
  const mobile = items.some(it => it.garde !== false && !fixes.includes(it.id));
  const valeurs = [[t.passages, bilan.circulation], [t.acces, bilan.acces], [t.ouvertures, bilan.ouvertures]];
  const incertain = items.some(it => it.origine === 'existant' && it.confiance < .65)
    || Object.values(modele.murs || {}).some(m => m.ouvertures?.some(o => o.confiance != null && o.confiance < .65));
  const mursInconnus = Object.values(modele.murs || {}).some(m => m.observe === false);

  function optimiser() {
    setAttente(true);
    // Laisse le bouton s'afficher avant le calcul local ; aucun appel IA ni crédit consommé.
    timer.current = setTimeout(() => {
      const r = optimiserAmenagement(modele, items, produits, { garder: fixes, langue: lang });
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
    <details className={s.details}>
      <summary>{t.details}{bilan.alertes.length > 0 && <span> · {bilan.alertes.length}</span>}</summary>
      {bilan.alertes.length > 0 && <ul>{bilan.alertes.map((a, i) => <li key={i}>{a.texte}</li>)}</ul>}
      {avis.length > 0 && <ul>{avis.map((a, i) => <li key={i}>{a}</li>)}</ul>}
      {bilan.circulation === null && <p>{t.pasDePorte}</p>}
      <p>{t.note}</p>
      {bilan.mesuresEstimees && <p>{t.estimees}</p>}
      {incertain && mursInconnus && <p>{t.incertain}</p>}
      {(modele.remarques || []).length > 0 && <ul>{modele.remarques.map((r, i) => <li key={i}>{r}</li>)}</ul>}
    </details>
    {onAppliquer && <>
      <div className={s.actions}>
        <button type="button" disabled={attente || !mobile} onClick={optimiser}>{attente ? t.attente : t.optimiser}<span aria-hidden="true"> ↗</span></button>
        {retour?.apres === items && <button type="button" className={s.annuler} disabled={attente} onClick={() => { onAppliquer(retour.avant); setRetour(null); setMessage(t.annule); }}>{t.annuler}</button>}
      </div>
      <p className={s.note}>{t.garde}</p>
      <p className={s.message} role="status">{message}</p>
    </>}
  </section>;
}

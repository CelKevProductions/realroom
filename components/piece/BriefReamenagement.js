'use client';
import { useEffect, useId, useRef, useState } from 'react';
import {encyclopedieActive} from '@/lib/encyclopedie-active.js';
import { ESPACES_PAR_FONCTION } from '@/lib/espaces.js';
import { initialiserBrief, demandeDepuisBrief, actualiserEnvies } from '@/lib/brief-reamenagement.js';
import s from './BriefReamenagement.module.css';

const textes = {
  fr: {
    titre: 'Quelles idées pour cette pièce ?', intro: 'Choisis les coins à aménager et indique ce que tu imagines. Nous organiserons le mobilier autour de ces usages.',
    espaces: 'Des coins ou espaces à créer ?', repas: ['Coin repas', 'Une table à manger et ses chaises'], travail: ['Coin bureau', 'Un bureau, son siège et une lampe'],
    lecture: ['Coin lecture', 'Un fauteuil et un éclairage adapté'], rangement: ['Rangement', 'Un buffet ou des étagères utiles'],
    cuisine:['Coin cuisine','Îlot et assises de mise en scène'],bar:['Coin bar','Comptoir et accessoires de mise en scène'],
    places: 'Combien de places à table ?', place: 'places', envies: 'Tes idées et envies', exemple: 'Une table près de la fenêtre, un coin lecture dans l’angle, du bois clair…',
    budget: 'Budget mobilier', budgetAide: 'Facultatif · vide = sans plafond', annuler: 'Annuler', lancer: 'Réaménager avec ces idées',
    aide: 'Les espaces choisis passent avant les compléments décoratifs. Si un ensemble ne tient pas dans la pièce ou le budget, tu verras ce qui manque et pourquoi.',
    partiel: 'En mode partiel, les meubles conservés restent en place. Les espaces choisis seront ajoutés si la place le permet.'
  },
  en: {
    titre: 'What do you imagine for this room?', intro: 'Choose the areas to create and share your ideas. We will arrange furniture around these activities.',
    espaces: 'Which areas would you like?', repas: ['Dining area', 'A dining table and its chairs'], travail: ['Work area', 'A desk, chair and task light'],
    lecture: ['Reading corner', 'An armchair and a suitable light'], rangement: ['Storage', 'Useful shelves or a sideboard'],
    cuisine:['Kitchen area','Staged island and seating'],bar:['Bar area','Staged counter and accessories'],
    places: 'How many seats at the table?', place: 'seats', envies: 'Your ideas and wishes', exemple: 'A table near the window, a reading corner, light wood…',
    budget: 'Furniture budget', budgetAide: 'Optional · leave empty for no limit', annuler: 'Cancel', lancer: 'Rearrange with these ideas',
    aide: 'Your chosen areas take priority over decorative extras. If an area cannot fit the room or budget, you will see what is missing and why.',
    partiel: 'In partial mode, kept furniture stays in place. Your chosen areas will be added where space allows.'
  }
};

export default function BriefReamenagement({ piece, demande, lang = 'fr', onFermer, onValider }) {
  const t = textes[lang] || textes.fr, titre = useId(), dialogue = useRef(null), assistant = demande.methode !== 'ia';
  const [brief, setBrief] = useState(() => initialiserBrief(piece, demande));
  const options = ESPACES_PAR_FONCTION[piece.fonction] || [];
  const repas = brief.espaces.includes('repas') || piece.fonction === 'salle_a_manger';
  useEffect(() => { const d = dialogue.current; d.showModal(); return () => d.close(); }, []);
  const changer = (cle, valeur) => setBrief(b => ({ ...b, [cle]: valeur }));
  function cocher(id, oui) {
    setBrief(b => ({ ...b, espaces: oui ? [...b.espaces, id] : b.espaces.filter(x => x !== id) }));
  }
  return <dialog ref={dialogue} className={s.dialogue} aria-labelledby={titre}
    onCancel={e => { e.preventDefault(); onFermer(); }} onClick={e => { if (e.target === dialogue.current) onFermer(); }}>
    <form onSubmit={e => { e.preventDefault(); onValider({...demandeDepuisBrief(piece, demande, brief),encyclopedie:encyclopedieActive(demande?.encyclopedie)}); }}>
      <header className={s.entete}><h2 id={titre}>{t.titre}</h2><button type="button" aria-label={t.annuler} onClick={onFermer}>×</button></header>
      <p className={s.intro}>{t.intro} {assistant && (lang === 'en' ? 'Once the first proposal is ready, use Shuffle to explore other layouts.' : 'Après la première proposition, utilise Shuffle pour explorer d’autres dispositions.')}</p>
      {options.length > 0 && <fieldset className={s.espaces}><legend>{t.espaces}</legend><div className={s.choix}>
        {options.map(id => <label key={id} className={s.option}>
          <input type="checkbox" checked={brief.espaces.includes(id)} onChange={e => cocher(id, e.target.checked)} />
          <span><b>{t[id][0]}</b><small>{t[id][1]}</small></span>
        </label>)}
      </div></fieldset>}
      <div className={s.reglages}>
        {repas && <label className={s.champ}>{t.places}<select value={brief.placesRepas} onChange={e => changer('placesRepas', +e.target.value)}>
          {[2, 4, 6, 8, 10].map(n => <option key={n} value={n}>{n} {t.place}</option>)}
        </select></label>}
        <label className={s.champ}>{t.budget}<span className={s.montant}><input type="number" min="0" max="1000000" step="0.01" inputMode="decimal" value={brief.budget} onChange={e => changer('budget', e.target.value)} /><span>€</span></span><small>{t.budgetAide}</small></label>
      </div>
      <label className={s.champ}>{t.envies}<textarea autoFocus rows="4" value={brief.envies} maxLength={1200} placeholder={t.exemple} onChange={e => setBrief(b => actualiserEnvies(b, e.target.value, options))} /></label>
      <p className={s.aide}>{demande.mode === 'partiel' ? t.partiel : t.aide}</p>
      <footer className={s.actions}><button type="button" onClick={onFermer}>{t.annuler}</button><button type="submit">{assistant ? (lang === 'en' ? 'Create my furnished room' : 'Créer ma pièce meublée') : t.lancer}</button></footer>
    </form>
  </dialog>;
}

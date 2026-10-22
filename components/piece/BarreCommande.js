'use client';
// Barre de commande de l'atelier : on écrit ce qu'on veut changer (« ajoute un fauteuil »,
// « retire le tapis »). Quelques exemples s'affichent au-dessus quand la barre a le focus.
import { useRef, useState } from 'react';

export default function BarreCommande({ lang, exemples = [], desactive, surCommande }) {
  const fr = lang !== 'en';
  const [texte, setTexte] = useState('');
  const champ = useRef(null);
  const envoyer = v => {
    const t = String(v || '').trim();
    if (!t || desactive) return;
    if (surCommande(t) !== false) setTexte('');
    champ.current?.focus();
  };
  return (
    <form className="commande" onSubmit={e => { e.preventDefault(); envoyer(texte); }}>
      {exemples.length > 0 && <div className="commande__exemples" aria-label={fr ? 'Exemples' : 'Examples'}>
        {exemples.map(x => <button key={x} type="button" disabled={desactive} onClick={() => envoyer(x)}>{x}</button>)}
      </div>}
      <div className="commande__barre">
        <span className="commande__etoile" aria-hidden="true">✦</span>
        <input ref={champ} value={texte} onChange={e => setTexte(e.target.value)} maxLength={200} enterKeyHint="send" autoComplete="off"
          placeholder={fr ? 'Ajoute un fauteuil, retire le tapis…' : 'Add an armchair, remove the rug…'}
          aria-label={fr ? 'Dis ce que tu veux changer dans la pièce' : 'Say what to change in the room'} />
        <button type="submit" className="commande__envoyer" disabled={desactive || !texte.trim()} aria-label={fr ? 'Envoyer' : 'Send'}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </div>
    </form>
  );
}

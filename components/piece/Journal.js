'use client';
// Journal du moteur : pendant que l'assistant compose la pièce, ses étapes défilent comme un
// journal de travail (« [ OK ] ») avec une barre qui avance. Les étapes sont celles que fait le
// moteur ; leur rythme est indicatif (la réponse arrive d'un bloc), la dernière attend la réponse.
import { useEffect, useState } from 'react';

const ETAPES = {
  fr: ['Lecture du plan, des portes et des fenêtres', 'Zones de vie et passages à garder libres', 'Choix des meubles dans le catalogue', 'Placement, collisions et accès', 'Comparaison des propositions'],
  en: ['Reading the plan, doors and windows', 'Living zones and clear passages', 'Picking furniture from the catalogue', 'Placement, collisions and access', 'Comparing proposals']
};

export default function Journal({ lang, ia = false }) {
  const fr = lang !== 'en';
  const etapes = ETAPES[fr ? 'fr' : 'en'];
  const [n, setN] = useState(0);
  const [t0] = useState(() => Date.now());
  const [maintenant, setMaintenant] = useState(t0);
  useEffect(() => {
    const h = setInterval(() => {
      setMaintenant(Date.now());
      setN(v => Math.min(etapes.length - 1, v + 1));
    }, 1300);
    return () => clearInterval(h);
  }, [etapes.length]);
  // progression qui ralentit sans jamais finir seule : seule la réponse du moteur la termine
  const s = (maintenant - t0) / 1000;
  const pc = Math.round(92 * (1 - Math.exp(-s / 5)));
  return (
    <div className="journal" role="status" aria-live="polite">
      <p className="journal__tete"><span className="journal__point" aria-hidden="true" />{ia ? (fr ? 'L’IA réaménage ta pièce' : 'AI is redesigning your room') : (fr ? 'Le moteur compose ta pièce' : 'The engine is arranging your room')}</p>
      <ol className="journal__lignes">
        {etapes.slice(0, n + 1).map((e, i) => (
          <li key={e} className={i < n ? 'is-fait' : 'is-encours'}>
            <span className="journal__etat">{i < n ? '[ OK ]' : '[ … ]'}</span>
            <span>{e}</span>
          </li>
        ))}
      </ol>
      <div className="journal__barre" aria-hidden="true"><span style={{ transform: `scaleX(${pc / 100})` }} /></div>
      <p className="journal__pied"><span>{fr ? 'Les meubles conservés ne bougent pas' : 'Kept furniture stays put'}</span><span className="chiffre">{String(pc).padStart(2, '0')} %</span></p>
    </div>
  );
}

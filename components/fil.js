'use client';
// Fil d'Ariane dans l'en-tête de l'application : chaque page déclare où l'on est (useFil),
// l'en-tête l'affiche (Fil). Sur téléphone, seul le lien vers le niveau du dessus reste.
import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';

const VIDE = [];
let courant = VIDE;
const abonnes = new Set();
const abonner = f => { abonnes.add(f); return () => abonnes.delete(f); };

// liens : [{ nom, href }] du plus large au plus précis ; le dernier est la page affichée
export function useFil(liens) {
  const cle = JSON.stringify(liens);
  useEffect(() => {
    courant = liens;
    abonnes.forEach(f => f());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
}

export function Fil({ libelle }) {
  const liens = useSyncExternalStore(abonner, () => courant, () => VIDE);
  return (
    <nav className="fil" aria-label={libelle}>
      {liens.map((l, i) => {
        const dernier = i === liens.length - 1;
        const parent = i === liens.length - 2;
        return [
          i > 0 && <span key={'s' + i} className="fil__sep" aria-hidden="true">/</span>,
          dernier || !l.href
            ? <span key={i} className={dernier ? 'fil__ici' : undefined} aria-current={dernier ? 'page' : undefined}>{l.nom}</span>
            : <Link key={i} href={l.href} className={parent ? 'is-parent' : undefined}>{l.nom}</Link>
        ];
      })}
    </nav>
  );
}

'use client';
// Solde de crédits dans l'en-tête : suit les dépenses et achats faits dans la page ; le nombre défile
// jusqu'à sa nouvelle valeur et passe un instant à la rouille
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRacine } from '@/components/chemins.js';
import { Compteur } from '@/components/Mouvement.js';

export default function Solde({ lang, initial, libelle }) {
  const racine = useRacine(lang);
  const [n, setN] = useState(initial);
  const [change, setChange] = useState(false);
  const premier = useRef(true);
  useEffect(() => {
    const f = e => { if (typeof e.detail === 'number') setN(e.detail); };
    addEventListener('realroom:credits', f);
    return () => removeEventListener('realroom:credits', f);
  }, []);
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    setChange(true);
    const h = setTimeout(() => setChange(false), 1400);
    return () => clearTimeout(h);
  }, [n]);
  return (
    <Link className={'solde' + (change ? ' is-change' : '')} href={`${racine}/compte`} data-solde={n}>
      <b><Compteur valeur={n} /></b> {libelle}
    </Link>
  );
}

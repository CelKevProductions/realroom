'use client';
// Solde de crédits dans l'en-tête : suit les dépenses et achats faits dans la page
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRacine } from '@/components/chemins.js';

export default function Solde({ lang, initial, libelle }) {
  const racine = useRacine(lang);
  const [n, setN] = useState(initial);
  useEffect(() => {
    const f = e => { if (typeof e.detail === 'number') setN(e.detail); };
    addEventListener('realroom:credits', f);
    return () => removeEventListener('realroom:credits', f);
  }, []);
  return <Link className="solde" href={`${racine}/compte`} data-solde={n}><b>{n}</b> {libelle}</Link>;
}

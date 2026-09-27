'use client';
// Boutons de l'en-tête public : « Se connecter / Essayer » ou « Mes projets » si une session existe
// (lu après affichage : l'accueil reste une page statique, rapide à servir et à indexer).
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CtaCompte({ lang, connexion, commencer, projets }) {
  const [connecte, setConnecte] = useState(false);
  useEffect(() => {
    let vivant = true;
    fetch('/api/moi', { cache: 'no-store' }).then(r => r.json()).then(j => { if (vivant) setConnecte(!!j.connecte); }).catch(() => {});
    return () => { vivant = false; };
  }, []);
  if (connecte) return <Link className="btn btn--plein btn--petit" href={`/${lang}/app`}>{projets}</Link>;
  return (
    <>
      <Link className="lien-section" href={`/${lang}/connexion`}>{connexion}</Link>
      <Link className="btn btn--plein btn--petit" href={`/${lang}/connexion?inscription=1`}>{commencer}</Link>
    </>
  );
}

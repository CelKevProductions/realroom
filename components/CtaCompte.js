'use client';
// Boutons de l'en-tête public : « Se connecter / Essayer » ou « Mes projets » si une session existe
// (lu après affichage : l'accueil reste une page statique, rapide à servir et à indexer).
import Link from 'next/link';
import { useEffect, useState } from 'react';

// classes : pour réutiliser les boutons dans un autre habillage (page d'accueil)
export default function CtaCompte({ lang, connexion, commencer, projets, classeLien = 'lien-section', classeBouton = 'btn btn--plein btn--petit' }) {
  const [connecte, setConnecte] = useState(false);
  useEffect(() => {
    let vivant = true;
    fetch('/api/moi', { cache: 'no-store' }).then(r => r.json()).then(j => { if (vivant) setConnecte(!!j.connecte); }).catch(() => {});
    return () => { vivant = false; };
  }, []);
  if (connecte) return <Link className={classeBouton} href={`/${lang}/app`}>{projets}</Link>;
  return (
    <>
      <Link className={classeLien} href={`/${lang}/connexion`}>{connexion}</Link>
      <Link className={classeBouton} href={`/${lang}/connexion?inscription=1`}>{commencer}</Link>
    </>
  );
}

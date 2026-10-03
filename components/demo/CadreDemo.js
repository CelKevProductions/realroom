'use client';
// En-tête de la démo : mêmes pages que l'application, liens vers /<langue>/demo, solde simulé,
// et un bandeau sombre qui rappelle que rien n'est réel
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo.js';
import Solde from '@/components/Solde.js';
import { Fil } from '@/components/fil.js';
import { RacineApp } from '@/components/chemins.js';
import { lire, abonner, remettreAZero } from '@/components/demo/magasin.js';

export default function CadreDemo({ lang, t, children }) {
  const router = useRouter();
  const [credits, setCredits] = useState(null);
  const [cle, setCle] = useState(0);
  const entete = useRef(null);
  useEffect(() => {
    setCredits(lire(lang).credits);
    return abonner(() => setCredits(lire().credits));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // hauteur de l'en-tête (barre + bandeau) : l'atelier 3D occupe le reste de l'écran
  useEffect(() => {
    const racine = document.documentElement;
    const o = new ResizeObserver(() => racine.style.setProperty('--haut-entete', entete.current.offsetHeight + 'px'));
    o.observe(entete.current);
    return () => { o.disconnect(); racine.style.removeProperty('--haut-entete'); };
  }, []);
  function recommencer() {
    remettreAZero(lang);
    setCle(k => k + 1);
    router.push(`/${lang}/demo`);
  }
  return (
    <RacineApp value={`/${lang}/demo`}>
      <header className="app-entete" ref={entete}>
        <div className="app-entete__barre">
          <Link href={`/${lang}`} className="logo" aria-label="RealRoom"><Logo />RealRoom</Link>
          <span className="badge-demo">{t.demo.badge}</span>
          <Fil libelle={t.nav.fil} />
          <nav className="app-entete__compte" aria-label={t.nav.compte}>
            {credits !== null && <Solde key={cle} lang={lang} initial={credits} libelle={t.nav.credits} />}
            <Link className="btn btn--plein btn--petit lien-creer" href={`/${lang}/connexion?inscription=1`}>{t.demo.creer}</Link>
          </nav>
        </div>
        <div className="bandeau-demo">
          <span>{t.demo.bandeau}</span>
          <span className="bandeau-demo__actions">
            <Link className="btn btn--lien btn--petit lien-creer-bandeau" href={`/${lang}/connexion?inscription=1`}>{t.demo.creer}</Link>
            <button type="button" className="btn btn--lien btn--petit" onClick={recommencer}>{t.demo.recommencer}</button>
          </span>
        </div>
      </header>
      <main id="contenu" key={cle}>{children}</main>
    </RacineApp>
  );
}

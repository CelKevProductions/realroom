import Link from 'next/link';
import Logo from '@/components/Logo.js';
import CtaCompte from '@/components/CtaCompte.js';
import { texte } from '@/lib/i18n.js';

// en-tête et pied des pages publiques hors accueil (connexion, pages légales)
export default async function MiseEnPageSite({ children, params }) {
  const { lang } = await params;
  const t = texte(lang);
  const autre = lang === 'fr' ? 'en' : 'fr';
  return (
    <>
      <header className="entete">
        <div className="entete__barre">
          <Link href={`/${lang}`} className="logo" aria-label="RealRoom"><Logo />RealRoom</Link>
          <nav aria-label={lang === 'fr' ? 'Navigation principale' : 'Main navigation'}>
            <a className="lien-section" href={`/${lang}#methode`}>{t.nav.comment}</a>
            <a className="lien-section" href={`/${lang}#tarifs`}>{t.nav.tarifs}</a>
            <a className="lien-section" href={`/${lang}#faq`}>{t.nav.faq}</a>
            <Link className="langue" href={`/${autre}`} hrefLang={autre} lang={autre}>{autre.toUpperCase()}</Link>
            <CtaCompte lang={lang} connexion={t.nav.connexion} commencer={t.nav.commencer} projets={t.nav.mesProjets} />
          </nav>
        </div>
      </header>
      <main id="contenu">{children}</main>
      <footer className="pied">
        <div className="pied__ligne">
          <div>
            <Link href={`/${lang}`} className="logo"><Logo taille={22} />RealRoom</Link>
            <p className="pied__credit">{t.pied.editeur}. {t.pied.meubles}.</p>
          </div>
          <nav aria-label={lang === 'fr' ? 'Informations légales' : 'Legal'}>
            <Link href={`/${lang}/legal/mentions`}>{t.pied.mentions}</Link>
            <Link href={`/${lang}/legal/cgv`}>{t.pied.cgv}</Link>
            <Link href={`/${lang}/legal/confidentialite`}>{t.pied.confidentialite}</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

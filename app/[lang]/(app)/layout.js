import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo.js';
import Deconnexion from '@/components/Deconnexion.js';
import { utilisateur } from '@/lib/session.js';
import { texte } from '@/lib/i18n.js';

export const metadata = { robots: { index: false, follow: false } };

// l'application : réservée aux comptes connectés
export default async function MiseEnPageApp({ children, params }) {
  const { lang } = await params;
  const u = await utilisateur();
  if (!u) redirect(`/${lang}/connexion`);
  const t = texte(lang);
  return (
    <>
      <header className="app-entete">
        <div className="conteneur app-entete__barre" style={{ width: 'min(1400px, 100% - 24px)' }}>
          <Link href={`/${lang}/app`} className="logo" aria-label="RealRoom"><Logo />RealRoom</Link>
          <nav aria-label={t.nav.compte}>
            <Link className="btn btn--lien" href={`/${lang}/app`}>{t.nav.mesProjets}</Link>
            <Link className="solde" href={`/${lang}/app/compte`} data-solde={u.credits}><b>{u.credits}</b> {t.nav.credits}</Link>
            <Deconnexion lang={lang} libelle={t.nav.deconnexion} />
          </nav>
        </div>
      </header>
      <main id="contenu">{children}</main>
    </>
  );
}

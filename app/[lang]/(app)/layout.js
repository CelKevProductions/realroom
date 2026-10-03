import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo.js';
import Deconnexion from '@/components/Deconnexion.js';
import Solde from '@/components/Solde.js';
import { Fil } from '@/components/fil.js';
import { utilisateur } from '@/lib/session.js';
import { texte } from '@/lib/i18n.js';

export const metadata = { robots: { index: false, follow: false } };

// l'application : réservée aux comptes connectés.
// En-tête : la marque, où l'on est (fil), les crédits (vers le compte), la déconnexion.
export default async function MiseEnPageApp({ children, params }) {
  const { lang } = await params;
  const u = await utilisateur();
  if (!u) redirect(`/${lang}/connexion`);
  const t = texte(lang);
  return (
    <>
      <header className="app-entete">
        <div className="app-entete__barre">
          <Link href={`/${lang}/app`} className="logo" aria-label="RealRoom"><Logo />RealRoom</Link>
          <Fil libelle={t.nav.fil} />
          <nav className="app-entete__compte" aria-label={t.nav.compte}>
            <Solde lang={lang} initial={u.credits} libelle={t.nav.credits} />
            <Deconnexion lang={lang} libelle={t.nav.deconnexion} />
          </nav>
        </div>
      </header>
      <main id="contenu">{children}</main>
    </>
  );
}

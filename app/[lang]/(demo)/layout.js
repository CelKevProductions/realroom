import CadreDemo from '@/components/demo/CadreDemo.js';
import { texte } from '@/lib/i18n.js';

// démo sans compte : pas indexée (le contenu est celui de l'application, simulé)
export const metadata = { robots: { index: false, follow: true } };

export default async function MiseEnPageDemo({ children, params }) {
  const { lang } = await params;
  return <CadreDemo lang={lang} t={texte(lang)}>{children}</CadreDemo>;
}

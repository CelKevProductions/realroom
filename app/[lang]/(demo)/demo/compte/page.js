import PageDemo from '@/components/demo/PageDemo.js';
import { texte } from '@/lib/i18n.js';
import { CREDITS, PACKS } from '@/lib/config.js';

export default async function Page({ params }) {
  const { lang } = await params;
  return <PageDemo lang={lang} t={texte(lang)} vue="compte" couts={CREDITS} packs={PACKS} />;
}

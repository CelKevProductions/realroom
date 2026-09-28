import PageDemo from '@/components/demo/PageDemo.js';
import { texte } from '@/lib/i18n.js';
import { CREDITS } from '@/lib/config.js';

export default async function Page({ params }) {
  const { lang, id } = await params;
  return <PageDemo lang={lang} t={texte(lang)} vue="piece" id={id} couts={CREDITS} />;
}

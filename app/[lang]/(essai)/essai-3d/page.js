import Essai3D from '@/components/essai3d/Essai3D.js';
import { textesEssai } from '@/components/essai3d/textes.js';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  return { title: { absolute: lang === 'en' ? 'RealRoom · 3D home (test)' : 'RealRoom · accueil 3D (essai)' } };
}

// essai privé : l'accueil raconté en 3D (plan, maison, découpe, meubles qui se placent)
export default async function Page({ params }) {
  const { lang } = await params;
  return <Essai3D t={textesEssai(lang)} lang={lang} />;
}

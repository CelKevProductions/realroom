import { notFound } from 'next/navigation';
import { DemoRespaceNavigateur } from '@/components/DemoRespace.js';
import { configRespace } from '@/lib/moteurs/respace.js';

export const metadata = { title: 'Démo ReSpace', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Démo ReSpace sans compte (pièces de la démo, dans le navigateur) : invisible tant qu'elle n'est
// pas configurée ; chaque appel exige le code d'accès.
export default async function PageRespaceDemo({ params }) {
  const { lang } = await params;
  if (!configRespace().actif) notFound();
  return <DemoRespaceNavigateur lang={lang} />;
}

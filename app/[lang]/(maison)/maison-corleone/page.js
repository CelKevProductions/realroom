import Experience from '@/components/maison/Experience.js';
import { utilisateur } from '@/lib/session.js';
import { profilMaison, estCompteMaison, maisonConfiguree, maisonSimulee } from '@/lib/maison.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  return {
    title: { absolute: lang === 'en' ? 'At home · Maison Corleone' : 'Chez vous · Maison Corleone' },
    description: lang === 'en'
      ? 'Photograph a room in your home: Maison Corleone rebuilds it in 3D and furnishes it with its pieces. Free with your customer account.'
      : 'Photographiez une pièce de votre intérieur : Maison Corleone la reconstruit en 3D et la meuble avec ses pièces. Offert avec votre compte client.'
  };
}

// l'édition gratuite pour les clients de maisoncorleone.com (connexion avec le compte client)
export default async function Page({ params, searchParams }) {
  const { lang } = await params;
  const sp = await searchParams;
  const u = await utilisateur();
  const profil = estCompteMaison(u) ? await profilMaison(u) : null;
  const message = ['inactif', 'erreur', 'annule'].includes(sp.mc) ? sp.mc : null;
  const pieceId = profil && typeof sp.piece === 'string' && /^r_[A-Za-z0-9_-]{4,40}$/.test(sp.piece) ? sp.piece : null;
  return (
    <Experience lang={lang} profil={profil ? JSON.parse(JSON.stringify(profil)) : null} connexion={maisonConfiguree() || maisonSimulee()}
      message={message} bienvenue={!!profil && sp.bienvenue === '1'} pieceId={pieceId} />
  );
}

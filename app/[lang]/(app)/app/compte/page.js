import { Suspense } from 'react';
import Compte from '@/components/Compte.js';
import { utilisateur } from '@/lib/session.js';
import { historique } from '@/lib/credits.js';
import { texte } from '@/lib/i18n.js';
import { PACKS, CREDITS } from '@/lib/config.js';
import { paiementActif, paiementSimule } from '@/lib/paiement.js';

export default async function PageCompte({ params }) {
  const { lang } = await params;
  const u = await utilisateur();
  const h = JSON.parse(JSON.stringify(await historique(u.id)));
  return (
    <Suspense>
      <Compte lang={lang} t={texte(lang)} email={u.email} credits={u.credits} historique={h} packs={PACKS} couts={CREDITS} paiement={paiementActif() || paiementSimule()} />
    </Suspense>
  );
}

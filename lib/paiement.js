// Paiement des packs de crédits : Stripe Checkout, puis crédit par le webhook et au retour
// (les deux sont idempotents : la session Stripe sert de référence unique).
import Stripe from 'stripe';
import { PACKS, MARQUE, ESSAIS_LOCAUX } from './config.js';
import { crediter } from './credits.js';

const stripe = () => {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) return null;
  return new Stripe(cle);
};
export const paiementActif = () => !!process.env.STRIPE_SECRET_KEY;
// sans Stripe, et seulement en local (développement, essais automatiques) : achat simulé
export const paiementSimule = () => !process.env.STRIPE_SECRET_KEY && ESSAIS_LOCAUX;

export async function creerPaiement({ uid, email, packId, langue, origine }) {
  const pack = PACKS.find(p => p.id === packId);
  if (!pack) return { erreur: 'pack' };
  const s = stripe();
  if (!s) return paiementSimule() ? { url: `${origine}/api/credits/simulation?pack=${pack.id}&langue=${langue}` } : { erreur: 'paiement-inactif' };
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: pack.prix,
        product_data: { name: `${MARQUE.nom} · ${pack.credits} ${langue === 'en' ? 'credits' : 'crédits'}`, description: langue === 'en' ? 'Photo renders and 3D tours of your rooms' : 'Rendus photo et visites 3D de vos pièces' }
      }
    }],
    customer_email: email,
    client_reference_id: uid,
    // la case « exécution immédiate, renonciation au droit de rétractation » a été cochée : on en garde la trace
    metadata: { uid, pack: pack.id, credits: String(pack.credits), renonciation_retractation: 'acceptee', renonciation_le: new Date().toISOString() },
    payment_intent_data: { metadata: { uid, pack: pack.id } },
    locale: langue === 'en' ? 'en' : 'fr',
    success_url: `${origine}/${langue}/app/compte?paiement=ok&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origine}/${langue}/app/compte?paiement=annule`
  });
  return { url: session.url };
}

// crédite une session payée (webhook ou retour du client) ; true si de nouveaux crédits
async function crediterSession(session) {
  if (!session || session.mode !== 'payment' || session.payment_status !== 'paid') return false;
  const uid = session.metadata?.uid || session.client_reference_id;
  const pack = PACKS.find(p => p.id === session.metadata?.pack);
  if (!uid || !pack || session.amount_total !== pack.prix || session.currency !== 'eur') {
    // payé mais incohérent (pack modifié, montant, devise) : à régler à la main depuis Stripe
    console.error('Stripe : session payée non créditée, à vérifier', session.id, { uid, pack: session.metadata?.pack, montant: session.amount_total, devise: session.currency });
    return false;
  }
  try {
    return await crediter(uid, pack.credits, 'achat', 'stripe:' + session.id);
  } catch (e) {
    // compte supprimé entre le paiement et le crédit : rien à créditer (Stripe ne doit pas réessayer)
    if (e && (e.code === '23503' || /foreign key/i.test(e.message || ''))) {
      console.error('Stripe : paiement pour un compte supprimé, à rembourser', session.id);
      return false;
    }
    throw e;
  }
}

export async function verifierRetour(sessionId, uid) {
  const s = stripe();
  if (!s || !/^cs_[\w]+$/.test(sessionId || '')) return false;
  const session = await s.checkout.sessions.retrieve(sessionId).catch(() => null);
  if (!session || (session.metadata?.uid || session.client_reference_id) !== uid) return false;
  return crediterSession(session);
}

export async function traiterWebhook(brut, signature) {
  const s = stripe(), secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return { statut: 503 };
  let evt;
  try { evt = s.webhooks.constructEvent(brut, signature, secret); } catch (_) { return { statut: 400 }; }
  if (evt.type === 'checkout.session.completed' || evt.type === 'checkout.session.async_payment_succeeded') await crediterSession(evt.data.object);
  // remboursements et litiges : les crédits se reprennent à la main (voir README)
  else if (evt.type === 'charge.refunded' || evt.type === 'charge.dispute.created') console.error('Stripe :', evt.type, evt.data.object && evt.data.object.id, '— ajuster les crédits du compte si besoin');
  return { statut: 200 };
}

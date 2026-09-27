// Paiement des packs de crédits : Stripe Checkout, puis crédit par le webhook et au retour
// (les deux sont idempotents : la session Stripe sert de référence unique).
import Stripe from 'stripe';
import { PACKS, MARQUE } from './config.js';
import { crediter } from './credits.js';

const stripe = () => {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) return null;
  return new Stripe(cle);
};
export const paiementActif = () => !!process.env.STRIPE_SECRET_KEY;
// sans Stripe, hors production : achat simulé (développement, essais)
export const paiementSimule = () => !process.env.STRIPE_SECRET_KEY && process.env.VERCEL_ENV !== 'production';

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
    metadata: { uid, pack: pack.id, credits: String(pack.credits) },
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
  if (!uid || !pack || session.amount_total !== pack.prix || session.currency !== 'eur') return false;
  return crediter(uid, pack.credits, 'achat', 'stripe:' + session.id);
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
  return { statut: 200 };
}

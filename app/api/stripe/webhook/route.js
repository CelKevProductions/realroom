import { traiterWebhook } from '@/lib/paiement.js';

// Stripe -> paiements confirmés (signature vérifiée sur le corps brut)
export async function POST(request) {
  const brut = await request.text();
  const r = await traiterWebhook(brut, request.headers.get('stripe-signature'));
  return Response.json({ recu: r.statut === 200 }, { status: r.statut });
}

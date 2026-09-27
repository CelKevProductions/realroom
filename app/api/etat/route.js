import { route, json } from '@/lib/http.js';
import { SIMULATION } from '@/lib/config.js';
import { paiementActif, paiementSimule } from '@/lib/paiement.js';

// services branchés (sans révéler les clés) : l'interface adapte ses boutons
export const GET = route(async () => json({
  simulation: SIMULATION,
  analyse: SIMULATION || !!process.env.ANTHROPIC_API_KEY,
  rendu: SIMULATION || !!process.env.FAL_KEY,
  monde: SIMULATION || !!process.env.WLT_API_KEY,
  paiement: paiementActif() || paiementSimule(),
  paiementSimule: paiementSimule(),
  email: !!process.env.RESEND_API_KEY
}));

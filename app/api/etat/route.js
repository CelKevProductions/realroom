import { route, json } from '@/lib/http.js';
import { SIMULATION } from '@/lib/config.js';
import { paiementActif, paiementSimule } from '@/lib/paiement.js';
import { adresseBase } from '@/lib/db.js';
import { fichiersEnLigne } from '@/lib/stockage.js';
import { maisonConfiguree } from '@/lib/maison.js';
import { iaDisponible } from '@/lib/claude.js';

// services branchés (sans révéler les clés) : l'interface adapte ses boutons, et c'est la page à
// ouvrir pour vérifier une mise en ligne (base, fichiers, session, IA, connexion Maison Corleone)
export const GET = route(async () => json({
  simulation: SIMULATION,
  base: !!adresseBase() || !process.env.VERCEL,
  fichiers: fichiersEnLigne() || !process.env.VERCEL,
  session: (process.env.SESSION_SECRET || '').length >= 32 || !process.env.VERCEL,
  analyse: SIMULATION || iaDisponible(),
  rendu: SIMULATION || !!process.env.FAL_KEY,
  monde: SIMULATION || !!process.env.WLT_API_KEY,
  paiement: paiementActif() || paiementSimule(),
  paiementSimule: paiementSimule(),
  email: !!process.env.RESEND_API_KEY,
  maisonCorleone: maisonConfiguree()
}));

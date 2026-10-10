// Repli réversible, sans modifier le relevé, les crédits ou la sélection de produits.
// Côté serveur : REALROOM_MOTEUR_GUIDE=0. Côté navigateur : même drapeau public,
// ou localStorage rr-moteur-guide=0 pour examiner le repli dans la preview.
export function moteurGuideActif(choix) {
  if (choix === false) return false;
  if (typeof process !== 'undefined' && (process.env.REALROOM_MOTEUR_GUIDE === '0' || process.env.NEXT_PUBLIC_REALROOM_MOTEUR_GUIDE === '0')) return false;
  if (typeof window !== 'undefined') { try { if (localStorage.getItem('rr-moteur-guide') === '0') return false; } catch (_) {} }
  return true;
}

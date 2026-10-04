// Pictogrammes de l'édition Maison Corleone (trait fin, couleur du texte)
export const Fleche = ({ sens = 'droite' }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true"><path d={sens === 'droite' ? 'M1 7h12M8 2l5 5-5 5' : 'M13 7H1M6 2 1 7l5 5'} /></svg>
);
export const Icone = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
export const I = {
  gauche: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  droite: 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5',
  echanger: 'M7 7h13l-3-3M17 17H4l3 3',
  retirer: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  garder: 'M5 13l4 4L19 7',
  tour: 'M12 6c4.4 0 8 1.6 8 3.6S16.4 13.2 12 13.2 4 11.6 4 9.6 7.6 6 12 6zM4 9.6v4.8c0 2 3.6 3.6 8 3.6M14.5 15.5 12 18l2.5 2.5',
  croix: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  externe: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6'
};

// lien vers la fiche du produit sur la boutique, marqué pour les statistiques de Maison Corleone
export function lienBoutique(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'chez-vous');
    u.searchParams.set('utm_medium', 'amenagement-3d');
    return u.toString();
  } catch (_) { return url; }
}

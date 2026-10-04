// La fleur de la visite privée (préchargement) et la marque en haut à gauche : le monogramme MC,
// qui ramène à la boutique
import Logo from '@/components/maison/Logo.js';

export function Fleur({ className }) {
  const petale = 'M50 49C45.5 44 45.2 38.6 50 35.5C54.8 38.6 54.5 44 50 49Z';
  return (
    <svg viewBox="33 33 34 34" className={className} aria-hidden="true">
      <g className="fleur">
        {[0, 90, 180, 270].map(r => <path key={r} d={petale} transform={`rotate(${r} 50 50)`} />)}
        <circle cx="50" cy="50" r="1.5" /><circle cx="56.6" cy="43.4" r="1" /><circle cx="56.6" cy="56.6" r="1" /><circle cx="43.4" cy="56.6" r="1" /><circle cx="43.4" cy="43.4" r="1" />
      </g>
    </svg>
  );
}

// label : nom accessible du lien (« Retour à la boutique Maison Corleone »)
export default function Marque({ label, href = 'https://maisoncorleone.com' }) {
  return (
    <a className="mc-marque" href={href} aria-label={label}>
      <Logo />
    </a>
  );
}

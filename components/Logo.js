// Marque RealRoom : une pièce ouverte (deux murs et le sol), un tapis rouille
export default function Logo({ taille = 28 }) {
  return (
    <svg className="logo__marque" width={taille} height={taille} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#121211" />
      <path d="M14 23 32 32 50 23" fill="none" stroke="#EDEAE4" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M14 23v19l18 10V32M50 23v19L32 52" fill="none" stroke="#EDEAE4" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="m23 38.5 9 5 9-5-9-5z" fill="#B8411D" />
    </svg>
  );
}

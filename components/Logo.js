// Marque RealRoom (« Maison douce ») : une pastille en quatre quartiers pastel, comme quatre pièces vues
// d'en haut, avec un quartier corail : la pièce qu'on est en train d'aménager
export default function Logo({ taille = 28 }) {
  return (
    <svg className="logo__marque" width={taille} height={taille} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 32V2a30 30 0 0 1 30 30z" fill="#F2613F" />
      <path d="M32 32h30a30 30 0 0 1-30 30z" fill="#C5DDC9" />
      <path d="M32 32v30A30 30 0 0 1 2 32z" fill="#DCD5F6" />
      <path d="M32 32H2A30 30 0 0 1 32 2z" fill="#FFE08A" />
    </svg>
  );
}

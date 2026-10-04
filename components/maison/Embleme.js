// La fleur de Maison Corleone (reprise de la visite privée) et l'emblème à anneau de texte tournant
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

// href : lien (retour à la boutique) ; sinon bouton
export default function Embleme({ texte, label, onClick, href, style }) {
  const Balise = href ? 'a' : 'button';
  const attributs = href ? { href } : { type: 'button', onClick };
  return (
    <Balise className="mc-embleme" aria-label={label} style={style} {...attributs}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs><path id="mc-cercle" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" /></defs>
        <g className="mc-embleme__rot"><text><textPath href="#mc-cercle" textLength="224" lengthAdjust="spacing">{texte}</textPath></text></g>
        <svg x="37" y="37" width="26" height="26" viewBox="33 33 34 34">
          <g className="fleur">
            {[0, 90, 180, 270].map(r => <path key={r} d="M50 49C45.5 44 45.2 38.6 50 35.5C54.8 38.6 54.5 44 50 49Z" transform={`rotate(${r} 50 50)`} />)}
            <circle cx="50" cy="50" r="1.5" />
          </g>
        </svg>
      </svg>
    </Balise>
  );
}

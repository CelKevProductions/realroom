'use client';
// Curseur avant / après : la vraie photo, puis le rendu par-dessus
import { useState } from 'react';

export default function AvantApres({ avant, apres, libelles, etiquette }) {
  const [k, setK] = useState(55);
  return (
    <div className="avant-apres">
      <img src={avant} alt={libelles.avant} />
      <div className="avant-apres__apres" style={{ clipPath: `inset(0 0 0 ${k}%)` }}>
        <img src={apres} alt={libelles.apres} />
      </div>
      <div className="avant-apres__poignee" style={{ left: k + '%' }} />
      <span className="etiquette-ia">{etiquette}</span>
      <span className="avant-apres__etiquette avant-apres__etiquette--avant" aria-hidden="true">{libelles.avant}</span>
      <span className="avant-apres__etiquette avant-apres__etiquette--apres" aria-hidden="true">{libelles.apres}</span>
      <input type="range" min="0" max="100" value={k} onChange={e => setK(+e.target.value)} aria-label={libelles.avant + ' / ' + libelles.apres} />
    </div>
  );
}

'use client';
// Guide des nouveaux venus : quelques étapes illustrées, dans un dialogue. Il s'ouvre de lui-même
// à la première visite (mémorisé dans ce navigateur), et le bouton « Guide » le rouvre.
import { useEffect, useRef, useState } from 'react';
import { ouvrirDialogue, fermerDialogue, apparaitre } from '@/components/Mouvement.js';
import { remplir } from '@/lib/i18n.js';

const lu = cle => { try { return localStorage.getItem(cle) === '1'; } catch (_) { return true; } };
const noter = cle => { try { localStorage.setItem(cle, '1'); } catch (_) { /* navigation privée */ } };

// illustrations au trait, comme un plan (le trait rouille montre ce qui compte)
const ILLUS = {
  projet: (
    <>
      <path d="M40 96V52l40-28 40 28v44z" /><path d="M66 96V70h28v26" />
      <circle className="tuto__accent" cx="122" cy="34" r="13" /><path className="tuto__accent" d="M122 27v14M115 34h14" />
    </>
  ),
  photos: (
    <>
      <rect x="52" y="22" width="56" height="84" rx="8" /><path d="M72 30h16" /><circle cx="80" cy="96" r="4" />
      <path className="tuto__accent" d="M60 44h10M60 44v10M100 44H90M100 44v10M60 84h10M60 84V74M100 84H90M100 84V74" />
    </>
  ),
  maquette: (
    <>
      <path d="M30 70l50-26 50 26-50 26z" /><path d="M30 70V40l50-26v30M130 70V40L80 14" />
      <path className="tuto__accent" d="M44 66l14 7 14-7-14-7z" /><path d="M96 58l10 5 10-5-10-5z" />
    </>
  ),
  amenager: (
    <>
      <path d="M30 84V62a8 8 0 0 1 8-8h84a8 8 0 0 1 8 8v22" /><path d="M24 84h112M38 54V44a8 8 0 0 1 8-8h68a8 8 0 0 1 8 8v10" /><path d="M36 84v10M124 84v10" />
      <path className="tuto__accent" d="M80 12v16M72 20h16M128 14l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
    </>
  ),
  rendu: (
    <>
      <rect x="24" y="22" width="112" height="78" rx="3" /><path d="M24 82l30-26 22 18 18-14 42 28" /><circle cx="108" cy="42" r="8" />
      <rect className="tuto__accent" x="98" y="88" width="42" height="22" rx="3" /><text className="tuto__ia" x="119" y="104" textAnchor="middle">IA</text>
    </>
  ),
  controles: (
    <>
      <path d="M40 72l40-20 40 20-40 20z" /><path d="M40 72V56M120 72V56M80 92V76" />
      <path className="tuto__accent" d="M30 40a52 30 0 0 1 100 0M124 30l6 10-11 2" /><path d="M78 60l6 22 5-8 9 9 4-4-9-9 8-5z" />
    </>
  ),
  onglets: (
    <>
      <rect x="30" y="20" width="100" height="88" rx="3" /><path d="M30 42h100M63 20v22M97 20v22" />
      <path className="tuto__accent" d="M40 31h14" /><path d="M74 31h12M108 31h12M42 58h76M42 72h60M42 86h68" />
    </>
  )
};

export default function Tuto({ id, etapes, libelles, auto = true, className = 'btn btn--lien btn--petit' }) {
  const dlg = useRef(null), corps = useRef(null);
  const [i, setI] = useState(0);
  const cle = 'rr-tuto-' + id;
  const ouvrir = () => { setI(0); ouvrirDialogue(dlg.current); };
  const fermer = () => { noter(cle); fermerDialogue(dlg.current); };
  // première visite : le guide s'ouvre seul, un instant après l'arrivée
  useEffect(() => {
    if (!auto || lu(cle)) return;
    const h = setTimeout(ouvrir, 700);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { apparaitre(corps.current, { y: 8 }); }, [i]);
  const e = etapes[i], dernier = i === etapes.length - 1;
  return (
    <>
      <button type="button" className={className} onClick={ouvrir}>{libelles.guide}</button>
      <dialog ref={dlg} className="dialogue tuto" aria-label={libelles.guide} onCancel={ev => { ev.preventDefault(); fermer(); }} onClick={ev => { if (ev.target === dlg.current) fermer(); }}>
        <div className="tuto__illu" aria-hidden="true">
          <svg viewBox="0 0 160 120">{ILLUS[e.illu] || ILLUS.maquette}</svg>
        </div>
        <div className="dialogue__corps tuto__corps" ref={corps}>
          <p className="tuto__etape">{remplir(libelles.etape, { n: i + 1, t: etapes.length })}</p>
          <h3>{e.titre}</h3>
          <p className="tuto__texte">{e.texte}</p>
          <div className="tuto__points" aria-hidden="true">{etapes.map((_, k) => <i key={k} className={k === i ? 'is-actif' : ''} />)}</div>
          <div className="dialogue__actions">
            {!dernier && <button type="button" className="btn btn--lien" onClick={fermer}>{libelles.passer}</button>}
            {i > 0 && <button type="button" className="btn btn--clair" onClick={() => setI(i - 1)}>{libelles.precedent}</button>}
            <button type="button" className="btn btn--plein" onClick={() => (dernier ? fermer() : setI(i + 1))}>{dernier ? libelles.fin : libelles.suivant}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}

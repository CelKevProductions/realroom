'use client';

import { useRef, useState } from 'react';
import { api } from '@/components/api.js';
import { reduireImage } from './image.js';
import s from './Inspirations.module.css';

export default function Inspirations({ piece, setPiece, assurerPiece, lang = 'fr', demo = false, onOccupe }) {
  const [occupe, setOccupe] = useState(false), [erreur, setErreur] = useState('');
  const verrou = useRef(false);
  const en = lang === 'en', photos = (piece?.photos || []).filter(p => p.role === 'inspiration');
  const signaler = v => { verrou.current = v; setOccupe(v); onOccupe?.(v); };
  async function envoyer(fichier) {
    if (!fichier || verrou.current) return;
    signaler(true); setErreur('');
    try {
      const p = piece || await assurerPiece();
      const { blob, largeur, hauteur } = await reduireImage(fichier);
      const f = new FormData();
      f.append('photo', blob, 'inspiration.jpg'); f.append('role', 'inspiration');
      f.append('largeur', String(largeur)); f.append('hauteur', String(hauteur));
      const r = await api(`/api/pieces/${p.id}/photos`, { method: 'POST', formulaire: f });
      if (!r.ok) throw new Error('envoi');
      setPiece(ancienne => ancienne ? { ...ancienne, photos: r.piece.photos, maj_le: r.piece.maj_le } : r.piece);
    } catch (_) { setErreur(en ? 'Could not save this image. Try another file.' : 'Cette image n’a pas pu être enregistrée. Essayez un autre fichier.'); }
    finally { signaler(false); }
  }
  async function retirer(url) {
    if (verrou.current) return;
    signaler(true); setErreur('');
    try {
      const r = await api(`/api/pieces/${piece.id}/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('suppression');
      setPiece(ancienne => ({ ...ancienne, photos: r.piece.photos, maj_le: r.piece.maj_le }));
    } catch (_) { setErreur(en ? 'Could not remove this image.' : 'Cette image n’a pas pu être retirée.'); }
    finally { signaler(false); }
  }
  return <section className={s.carte} aria-label={en ? 'Inspiration images' : 'Photos d’inspiration'}>
    <p className={s.titre}>{en ? 'Your inspiration' : 'Vos inspirations'} <small>{photos.length}/3</small></p>
    <p>{en ? 'Add up to three rooms whose colours, materials or furniture arrangement you like. They guide your next proposal.' : 'Ajoutez jusqu’à trois ambiances dont vous aimez les couleurs, les matières ou l’organisation des meubles. Elles guideront votre prochaine proposition.'}</p>
    <div className={s.images}>
      {photos.map((ph, i) => <div className={s.image} key={ph.url}><img src={ph.url} alt={`Inspiration ${i + 1}`} /><button type="button" disabled={occupe} aria-label={`${en ? 'Remove inspiration' : 'Retirer l’inspiration'} ${i + 1}`} onClick={() => retirer(ph.url)}>×</button></div>)}
      {photos.length < 3 && <label className={s.ajouter}><span>{occupe ? (en ? 'Saving…' : 'Enregistrement…') : (en ? '+ Add an inspiration' : '+ Ajouter une inspiration')}</span><input type="file" accept="image/*" disabled={occupe} aria-label={en ? 'Add an inspiration' : 'Ajouter une inspiration'} onChange={e => { envoyer(e.target.files[0]); e.target.value = ''; }} /></label>}
    </div>
    {demo && <p className={s.note}>{en ? 'Demo: images are saved; their visual interpretation is simulated.' : 'Démo : les images sont enregistrées, leur interprétation visuelle est simulée.'}</p>}
    {erreur && <p role="alert">{erreur}</p>}
  </section>;
}

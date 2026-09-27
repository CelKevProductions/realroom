'use client';
// Étape 1 : photos guidées (depuis l'entrée d'abord), mesures approximatives, précisions
import { useState } from 'react';
import { api } from '@/components/api.js';
import { reduireImage } from '@/components/piece/image.js';

const ROLES = ['entree', 'fond', 'gauche', 'droite'];

export default function Photos({ lang, t, piece, setPiece, analyser, attente }) {
  const tp = t.piece;
  const [envoi, setEnvoi] = useState({});
  const [erreur, setErreur] = useState('');
  const [dims, setDims] = useState(() => ({ largeur: piece.dims?.largeur ?? '', profondeur: piece.dims?.profondeur ?? '', hauteur: piece.dims?.hauteur ?? '' }));
  const [notes, setNotes] = useState(piece.notes || '');
  const photos = piece.photos || [];
  const photo = role => photos.find(p => p.role === role);
  const details = photos.filter(p => p.role === 'detail');

  async function envoyer(role, fichier, cle = role) {
    if (!fichier) return;
    setErreur('');
    setEnvoi(e => ({ ...e, [cle]: true }));
    try {
      const { blob, largeur, hauteur } = await reduireImage(fichier);
      const f = new FormData();
      f.append('photo', blob, 'photo.jpg');
      f.append('role', role);
      f.append('largeur', String(largeur));
      f.append('hauteur', String(hauteur));
      const r = await api(`/api/pieces/${piece.id}/photos`, { method: 'POST', formulaire: f });
      if (r.ok) setPiece(r.piece); else setErreur(t.erreurs.generique);
    } catch (_) { setErreur(t.erreurs.generique); }
    setEnvoi(e => ({ ...e, [cle]: false }));
  }
  async function retirer(url) {
    const r = await api(`/api/pieces/${piece.id}/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
    if (r.ok) setPiece(r.piece);
  }
  async function enregistrer(champs) {
    const r = await api(`/api/pieces/${piece.id}`, { method: 'PATCH', corps: champs });
    if (r.ok) setPiece(r.piece);
  }
  const num = v => (v === '' || v == null ? null : Math.round(parseFloat(String(v).replace(',', '.')) * 100) / 100);
  const majDims = () => enregistrer({ dims: { largeur: num(dims.largeur), profondeur: num(dims.profondeur), hauteur: num(dims.hauteur) } });

  const caseRendu = ({ role, p, principale, cle = role }) => (
    <div key={cle + (p ? p.url : '')} className={'case-photo' + (principale ? ' case-photo--principale' : '') + (envoi[cle] ? ' is-envoi' : '')} data-role={role}>
      {p ? <img src={p.url} alt={tp.roles[role][0]} /> : (
        <div className="case-photo__vide">
          <b>{tp.roles[role][0]}{principale ? ' *' : ''}</b>
          <span>{tp.roles[role][1]}</span>
          <span className="btn btn--clair btn--petit" aria-hidden="true">{envoi[cle] ? tp.envoi : tp.prendre}</span>
        </div>
      )}
      {!p && <input type="file" accept="image/*" aria-label={tp.roles[role][0]} onChange={e => envoyer(role, e.target.files[0], cle)} />}
      {p && (
        <div className="case-photo__pied">
          <span>{tp.roles[role][0]}</span>
          <span style={{ display: 'flex', gap: 6 }}>
            {role !== 'detail' && <label style={{ position: 'relative' }}><button type="button" tabIndex={-1}>{tp.remplacer}</button><input type="file" accept="image/*" style={{ position: 'absolute', inset: 0, opacity: 0 }} aria-label={tp.remplacer} onChange={e => envoyer(role, e.target.files[0], cle)} /></label>}
            <button type="button" onClick={() => retirer(p.url)}>{tp.retirer}</button>
          </span>
        </div>
      )}
      {envoi[cle] && <span className="rouage" style={{ position: 'absolute', zIndex: 2 }} />}
    </div>
  );

  return (
    <div className="conteneur app-page" style={{ maxWidth: 980 }}>
      <section className="carte bloc">
        <div className="bloc__tete"><h2 style={{ fontSize: '1.6rem' }}>{tp.photosTitre}</h2><p>{tp.photosIntro}</p></div>
        <div className="photos-grille">
          {ROLES.map(role => caseRendu({ role, p: photo(role), principale: role === 'entree' }))}
          {details.map((p, i) => caseRendu({ role: 'detail', p, cle: 'detail' + i }))}
          {photos.length < 8 && caseRendu({ role: 'detail', p: null, cle: 'detail-nouveau' })}
        </div>
        {erreur && <p className="avis avis--alerte">{erreur}</p>}
      </section>

      <section className="carte bloc">
        <div className="bloc__tete"><h2 style={{ fontSize: '1.6rem' }}>{tp.mesuresTitre}</h2><p>{tp.mesuresIntro}</p></div>
        <div className="mesures">
          {['largeur', 'profondeur', 'hauteur'].map(k => (
            <label key={k} className="champ"><span>{tp[k]}</span>
              <span className="unite" data-unite="m">
                <input className="saisie" inputMode="decimal" name={k} placeholder={k === 'hauteur' ? '2,50' : ''} value={dims[k]} onChange={e => setDims(d => ({ ...d, [k]: e.target.value }))} onBlur={majDims} />
              </span>
            </label>
          ))}
        </div>
        <label className="champ"><span>{tp.notes}</span>
          <textarea className="saisie" value={notes} placeholder={tp.notesAide} maxLength={1000} onChange={e => setNotes(e.target.value)} onBlur={() => enregistrer({ notes })} />
        </label>
      </section>

      <div className="barre-action">
        {!photo('entree') && <span className="discret petit">{tp.manquePhoto}</span>}
        <button className="btn btn--accent btn--large" disabled={!photo('entree') || attente} onClick={async () => { await majDims(); analyser(); }}>{tp.analyser}</button>
      </div>
    </div>
  );
}

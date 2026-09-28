'use client';
// Un projet : ses pièces (photos, état de l'analyse), l'ajout d'une pièce, l'analyse de plusieurs
// pièces en même temps
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/api.js';
import { useRacine } from '@/components/chemins.js';
import { remplir } from '@/lib/i18n.js';
import { FONCTIONS } from '@/lib/config.js';

export default function Projet({ lang, t, initial }) {
  const router = useRouter();
  const racine = useRacine(lang);
  const [p, setP] = useState(initial);
  const [nom, setNom] = useState(initial.nom);
  const [fonction, setFonction] = useState('salon');
  const [nomPiece, setNomPiece] = useState('');
  const [message, setMessage] = useState('');
  const dialogue = useRef(null);

  // tant qu'une analyse tourne, on rafraîchit l'état des pièces
  useEffect(() => {
    if (!p.pieces.some(x => x.etat === 'analyse')) return;
    const h = setInterval(async () => { const r = await api(`/api/projets/${p.id}`); if (r.ok) setP(r.projet); }, 4000);
    return () => clearInterval(h);
  }, [p]);

  async function renommer() {
    if (nom.trim() && nom !== p.nom) await api(`/api/projets/${p.id}`, { method: 'PATCH', corps: { nom } });
  }
  async function ajouter(e) {
    e.preventDefault();
    const r = await api(`/api/projets/${p.id}/pieces`, { method: 'POST', corps: { nom: nomPiece || t.fonctions[fonction], fonction } });
    if (r.ok) router.push(`${racine}/pieces/${r.piece.id}`);
  }
  // analyse en parallèle de toutes les pièces qui ont leur photo principale
  async function analyserTout() {
    const pretes = p.pieces.filter(x => x.etat !== 'analyse' && !x.nb_meubles && x.photos.some(f => f.role === 'entree'));
    if (!pretes.length) return;
    setP(v => ({ ...v, pieces: v.pieces.map(x => (pretes.includes(x) ? { ...x, etat: 'analyse' } : x)) }));
    setMessage(remplir(t.projet.analyseLancee, { n: pretes.length }));
    await Promise.all(pretes.map(x => api(`/api/pieces/${x.id}/analyse`, { method: 'POST', corps: { langue: lang } })));
    const r = await api(`/api/projets/${p.id}`);
    if (r.ok) setP(r.projet);
    setMessage('');
  }
  const aAnalyser = p.pieces.filter(x => x.etat !== 'analyse' && !x.nb_meubles && x.photos.some(f => f.role === 'entree')).length;

  return (
    <div className="conteneur app-page">
      <nav className="fil" aria-label="fil"><Link href={racine}>{t.projets.titre}</Link><span>›</span></nav>
      <div className="app-page__tete">
        <input className="saisie" style={{ fontFamily: 'var(--titre)', fontSize: '2rem', border: 0, background: 'none', padding: 0, maxWidth: 560 }} value={nom}
          onChange={e => setNom(e.target.value)} onBlur={renommer} aria-label={t.projets.renommer} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {aAnalyser > 1 && <button className="btn btn--clair" onClick={analyserTout}>{t.projet.analyserTout}</button>}
          <button className="btn btn--accent" onClick={() => dialogue.current.showModal()}>{t.projet.ajouter}</button>
        </div>
      </div>
      {message && <p className="avis avis--ok" style={{ marginBottom: 16 }}>{message}</p>}
      {!p.pieces.length && <p className="vide">{t.projet.vide}</p>}
      <div className="grille-cartes">
        {p.pieces.map(x => {
          const image = x.dernier_rendu || (x.photos[0] && x.photos[0].url);
          return (
            <Link key={x.id} href={`${racine}/pieces/${x.id}`} className="carte carte-projet">
              <div className="carte-projet__image" style={image ? { backgroundImage: `url(${image})` } : undefined}>{!image && '📷'}</div>
              <div className="carte-projet__texte">
                <b>{x.nom}</b>
                <span className="puces">
                  <span className="puce">{t.fonctions[x.fonction]}</span>
                  <span className={'puce ' + (x.etat === 'prete' ? 'puce--vert' : x.etat === 'erreur' ? 'puce--accent' : '')}>
                    {x.etat === 'analyse' && <span className="rouage rouage--petit" />} {t.projet.etats[x.etat] || x.etat}
                  </span>
                </span>
              </div>
            </Link>
          );
        })}
        <button className="carte-vide" onClick={() => dialogue.current.showModal()}>+ {t.projet.ajouter}</button>
      </div>

      <dialog ref={dialogue} className="dialogue" onClick={e => { if (e.target === dialogue.current) dialogue.current.close(); }}>
        <form className="dialogue__corps" onSubmit={ajouter}>
          <h3>{t.projet.ajouter}</h3>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="champ" style={{ marginBottom: 8 }}><span>{t.projet.fonction}</span></legend>
            <div className="choix-fonction">
              {FONCTIONS.map(f => (
                <label key={f}><input type="radio" name="fonction" value={f} checked={fonction === f} onChange={() => setFonction(f)} />{t.fonctions[f]}</label>
              ))}
            </div>
          </fieldset>
          <label className="champ"><span>{t.projet.nomPiece}</span>
            <input className="saisie" value={nomPiece} placeholder={t.fonctions[fonction]} onChange={e => setNomPiece(e.target.value)} maxLength={80} />
          </label>
          <div className="dialogue__actions">
            <button type="button" className="btn btn--lien" onClick={() => dialogue.current.close()}>✕</button>
            <button className="btn btn--plein">{t.projet.creer}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

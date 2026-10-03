'use client';
// Un projet : ses pièces (photo, état de l'analyse), l'ajout d'une pièce, l'analyse de plusieurs
// pièces en même temps. Le nom du projet se modifie sur place.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/api.js';
import { useRacine } from '@/components/chemins.js';
import { useFil } from '@/components/fil.js';
import { useEntree, ouvrirDialogue, fermerDialogue } from '@/components/Mouvement.js';
import Croquis from '@/components/Croquis.js';
import { remplir } from '@/lib/i18n.js';
import { FONCTIONS } from '@/lib/config.js';

function Etat({ etat, t }) {
  return (
    <span className={'etat etat--' + etat}>
      {etat === 'analyse' ? <span className="rouage rouage--petit" /> : <span className="point" />}
      {t.projet.etats[etat] || etat}
    </span>
  );
}

export default function Projet({ lang, t, initial }) {
  const router = useRouter();
  const racine = useRacine(lang);
  const [p, setP] = useState(initial);
  const [nom, setNom] = useState(initial.nom);
  const [fonction, setFonction] = useState('salon');
  const [nomPiece, setNomPiece] = useState('');
  const [message, setMessage] = useState('');
  const dialogue = useRef(null);
  const page = useRef(null);
  useEntree(page);
  useFil([{ nom: t.projets.titre, href: racine }, { nom: nom.trim() || p.nom }]);

  // tant qu'une analyse tourne, on rafraîchit l'état des pièces
  useEffect(() => {
    if (!p.pieces.some(x => x.etat === 'analyse')) return;
    const h = setInterval(async () => { const r = await api(`/api/projets/${p.id}`); if (r.ok) setP(r.projet); }, 4000);
    return () => clearInterval(h);
  }, [p]);

  async function renommer() {
    if (nom.trim() && nom !== p.nom) {
      const r = await api(`/api/projets/${p.id}`, { method: 'PATCH', corps: { nom } });
      if (r.ok) setP(v => ({ ...v, nom }));
    } else setNom(p.nom);
  }
  async function ajouter(e) {
    e.preventDefault();
    const r = await api(`/api/projets/${p.id}/pieces`, { method: 'POST', corps: { nom: nomPiece || t.fonctions[fonction], fonction } });
    if (r.ok) router.push(`${racine}/pieces/${r.piece.id}`);
  }
  const ouvrir = () => ouvrirDialogue(dialogue.current);
  const fermer = () => fermerDialogue(dialogue.current);
  // analyse en parallèle de toutes les pièces qui ont leur photo principale
  const pretes = p.pieces.filter(x => x.etat !== 'analyse' && !x.nb_meubles && x.photos.some(f => f.role === 'entree'));
  async function analyserTout() {
    if (!pretes.length) return;
    setP(v => ({ ...v, pieces: v.pieces.map(x => (pretes.includes(x) ? { ...x, etat: 'analyse' } : x)) }));
    setMessage(remplir(t.projet.analyseLancee, { n: pretes.length }));
    await Promise.all(pretes.map(x => api(`/api/pieces/${x.id}/analyse`, { method: 'POST', corps: { langue: lang } })));
    const r = await api(`/api/projets/${p.id}`);
    if (r.ok) setP(r.projet);
    setMessage('');
  }

  return (
    <div className="conteneur app-page" ref={page}>
      <div className="app-page__tete">
        <input className="titre-modifiable" data-entree="" value={nom} maxLength={80} aria-label={t.projets.renommer}
          onChange={e => setNom(e.target.value)} onBlur={renommer} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <div className="app-page__actions" data-entree="">
          {pretes.length > 1 && <button className="btn btn--clair" onClick={analyserTout}>{t.projet.analyserTout}</button>}
          <button className="btn btn--plein" onClick={ouvrir}>{t.projet.ajouter}</button>
        </div>
      </div>
      {message && <p className="avis avis--ok app-page__avis">{message}</p>}
      {!p.pieces.length && <p className="vide" data-entree="">{t.projet.vide}</p>}
      <div className="grille-cartes" data-entree="">
        {p.pieces.map(x => {
          const image = x.dernier_rendu || (x.photos[0] && x.photos[0].url);
          return (
            <Link key={x.id} href={`${racine}/pieces/${x.id}`} className="carte-projet">
              <span className="carte-projet__image">{image ? <img src={image} alt="" loading="lazy" /> : <Croquis />}</span>
              <span className="carte-projet__texte">
                <b>{x.nom}</b>
                <span className="carte-projet__meta">
                  {t.fonctions[x.fonction] !== x.nom && <span>{t.fonctions[x.fonction]}</span>}
                  <Etat etat={x.etat} t={t} />
                </span>
              </span>
            </Link>
          );
        })}
        <button className="carte-vide" onClick={ouvrir}>
          <span className="carte-vide__plus" aria-hidden="true" />
          <b>{t.projet.ajouter}</b>
        </button>
      </div>

      <dialog ref={dialogue} className="dialogue" onClick={e => { if (e.target === dialogue.current) fermer(); }} onCancel={e => { e.preventDefault(); fermer(); }}>
        <form className="dialogue__corps" onSubmit={ajouter}>
          <h3>{t.projet.ajouter}</h3>
          <fieldset className="champ champ--groupe">
            <legend>{t.projet.fonction}</legend>
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
            <button type="button" className="btn btn--lien" onClick={fermer}>{t.projet.annuler}</button>
            <button className="btn btn--plein">{t.projet.creer}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

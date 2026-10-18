'use client';
// Parcours guidé d'un projet, en dix étapes, sur une ou plusieurs pièces. Chaque choix est
// enregistré tout de suite (reprise à la visite suivante, sur n'importe quel appareil). On peut
// revenir en arrière à tout moment ; l'avancement affiché vient des données réelles. Les étapes
// réutilisent l'atelier existant (relevé, plan, Shuffle) au lieu de le refaire.
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import { chargerCatalogue } from '@/components/catalogueClient.js';
import { useRacine } from '@/components/chemins.js';
import { useFil } from '@/components/fil.js';
import { Etape } from '@/components/mouvement/react.js';
import { Rouage, Progression } from '@/components/mouvement/Attente.js';
import { annoncer } from '@/components/mouvement/regles.js';
import { reduireImage } from '@/components/piece/image.js';
import { MiniPlan } from '@/components/piece/Variantes.js';
import { ETAPES, avancement, gardesDe, demandeProposition, normaliserParcours } from '@/lib/parcours.js';
import { ESPACES_PAR_FONCTION } from '@/lib/espaces.js';
import { estInstallation } from '@/lib/usages.js';
import { contourDe } from '@/lib/contour.js';
import { FONCTIONS } from '@/lib/config.js';
import { TEXTES } from './textes.js';

const TACHE_ACTIVE = ['attente', 'en_cours'];

export default function Parcours({ lang, t, projetId, projetNom, initial, produits: produitsInitiaux, approfondissement }) {
  const x = TEXTES[lang] || TEXTES.fr;
  const racine = useRacine(lang);
  const [etat, setEtat] = useState(initial.etat);
  const [pieces, poserPieces] = useState(initial.pieces);
  // lu par modifier() dans le même geste qu'un ajout de pièce
  const piecesRef = useRef(pieces);
  const setPieces = useCallback(ps => { piecesRef.current = ps; poserPieces(ps); }, []);
  // le catalogue complet arrive ensuite : les plans des propositions montrent aussi les meubles ajoutés
  const [produits, setProduits] = useState(produitsInitiaux || {});
  useEffect(() => { chargerCatalogue().then(c => setProduits(p => ({ ...c.produits, ...p }))).catch(() => {}); }, []);
  const [sens, setSens] = useState(1);
  const [sauvegarde, setSauvegarde] = useState('ok');     // ok | encours | erreur
  const [occupe, setOccupe] = useState('');
  const [message, setMessage] = useState(null);
  const revision = useRef(initial.revision);
  const aEnvoyer = useRef(null), minuterie = useRef(null), enCours = useRef(Promise.resolve());
  useFil([{ nom: t.projets.titre, href: racine }, { nom: projetNom, href: `${racine}/projets/${projetId}` }, { nom: x.titre }]);

  const faits = avancement(etat, pieces);
  const choisies = etat.pieces.map(id => pieces.find(p => p.id === id)).filter(Boolean);
  const i = ETAPES.indexOf(etat.etape);

  // Enregistrement automatique : un envoi à la fois, le dernier état gagne.
  const envoyer = useCallback(() => {
    clearTimeout(minuterie.current);
    const e = aEnvoyer.current;
    if (!e) return enCours.current;
    aEnvoyer.current = null;
    enCours.current = enCours.current.then(async () => {
      setSauvegarde('encours');
      const r = await api(`/api/projets/${projetId}/parcours`, { method: 'PUT', corps: { etat: e, revision: revision.current } });
      if (r.ok) { revision.current = r.revision; setSauvegarde(aEnvoyer.current ? 'encours' : 'ok'); return; }
      if (r.erreur === 'parcours-conflit') {
        // modifié ailleurs (autre onglet, autre appareil) : on reprend la version enregistrée
        revision.current = r.revision; setEtat(r.etat); setPieces(r.pieces); setSauvegarde('ok');
        setMessage({ texte: x.conflit }); annoncer(x.conflit); return;
      }
      setSauvegarde('erreur');
    });
    return enCours.current;
  }, [projetId, x.conflit, setPieces]);
  const modifier = useCallback(f => {
    setEtat(avant => {
      const apres = normaliserParcours(typeof f === 'function' ? f(avant) : { ...avant, ...f }, piecesRef.current);
      aEnvoyer.current = apres;
      setSauvegarde('encours');
      clearTimeout(minuterie.current);
      minuterie.current = setTimeout(envoyer, 500);
      return apres;
    });
  }, [envoyer]);
  useEffect(() => {
    // page quittée ou rechargée : le dernier état part quand même (keepalive)
    const quitter = () => {
      const e = aEnvoyer.current;
      // démo : tout est déjà dans le navigateur, rien à envoyer au serveur
      if (!e || racine.includes('/demo')) return;
      aEnvoyer.current = null; clearTimeout(minuterie.current);
      try { fetch(`/api/projets/${projetId}/parcours`, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etat: e, revision: revision.current }) }); } catch (_) {}
    };
    addEventListener('pagehide', quitter);
    // navigation dans l'application : envoi normal
    return () => { removeEventListener('pagehide', quitter); if (aEnvoyer.current) envoyer(); };
  }, [envoyer, projetId, racine]);

  async function recharger() {
    const r = await api(`/api/projets/${projetId}/parcours`);
    if (r.ok) setPieces(r.pieces);
    return r;
  }
  const aller = (cible, direction) => { setSens(direction); setMessage(null); modifier({ etape: cible }); };
  async function suivant() {
    // en quittant la sélection, les contraintes des meubles gardés sont écrites sur chaque pièce
    if (etat.etape === 'selection') {
      setOccupe('contraintes');
      await envoyer();
      for (const p of choisies) {
        const r = await api(`/api/projets/${projetId}/parcours`, { method: 'POST', corps: { action: 'contraintes', piece: p.id } });
        if (!r.ok) { setOccupe(''); setMessage({ texte: x.erreurs[r.erreur] || x.erreurs.generique, erreur: true }); return; }
        setPieces(r.pieces);
      }
      setOccupe('');
    }
    if (i < ETAPES.length - 1) aller(ETAPES[i + 1], 1);
  }
  const precedent = () => { if (i > 0) aller(ETAPES[i - 1], -1); };
  // une étape déjà faite, ou la première qui ne l'est pas, est accessible depuis le récapitulatif
  const premiereAFaire = ETAPES.findIndex(e => !faits[e] && !['photos', 'approfondissement'].includes(e));
  const accessible = j => j <= (premiereAFaire < 0 ? ETAPES.length - 1 : premiereAFaire) || faits[ETAPES[j]];
  // les photos des meubles gardés sont facultatives
  const peutContinuer = faits[etat.etape] || etat.etape === 'photos';

  const props = { x, t, lang, racine, etat, modifier, pieces, choisies, produits, faits, recharger, setPieces, setMessage, occupe, setOccupe, projetId, approfondissement, envoyer };
  return (
    <div className="conteneur app-page parcours">
      <div className="app-page__tete">
        <div>
          <p className="discret">{projetNom}</p>
          <h1>{x.titre}</h1>
        </div>
        <p className="parcours__sauvegarde discret" role="status">
          {sauvegarde === 'encours' ? x.enregistrement : sauvegarde === 'erreur' ? x.nonEnregistre : x.enregistre}
        </p>
      </div>
      <div className="parcours__grille">
        <nav className="parcours__recap" aria-label={x.recap}>
          <Progression libelle={x.avancement} etapes={ETAPES.map(e => ({ id: e, nom: x.etapes[e].nom, fait: !!faits[e], encours: e === etat.etape }))} />
          <ol className="parcours__etapes">
            {ETAPES.map((e, j) => (
              <li key={e}>
                <button type="button" className={'parcours__lien' + (e === etat.etape ? ' is-actif' : '') + (faits[e] ? ' is-fait' : '')}
                  disabled={!accessible(j)} aria-current={e === etat.etape ? 'step' : undefined} onClick={() => aller(e, j >= i ? 1 : -1)}>
                  <span className="parcours__num">{String(j + 1).padStart(2, '0')}</span>
                  <span>{x.etapes[e].nom}</span>
                  {faits[e] && <span className="visuel-masque">{x.fait}</span>}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="parcours__scene">
          <Etape key={etat.etape} titre={x.etapes[etat.etape].nom} sens={sens} className="parcours__etape">
            <h2 data-titre-etape="">{x.etapes[etat.etape].titre}</h2>
            <p className="parcours__intro">{x.etapes[etat.etape].intro}</p>
            {message && <p className={'avis ' + (message.erreur ? 'avis--alerte' : 'avis--note')}>{message.texte}</p>}
            <Contenu {...props} />
            <div className="parcours__actions">
              <button type="button" className="btn btn--clair" onClick={precedent} disabled={i === 0 || !!occupe}>{x.retour}</button>
              {i < ETAPES.length - 1 && <button type="button" className="btn btn--plein" onClick={suivant} disabled={!peutContinuer || !!occupe}>
                {occupe === 'contraintes' ? <><Rouage /> {x.enregistrement}</> : x.continuer}
              </button>}
            </div>
            {!peutContinuer && i < ETAPES.length - 1 && <p className="discret">{x.etapes[etat.etape].bloque}</p>}
          </Etape>
        </div>
      </div>
    </div>
  );
}

function Contenu(props) {
  const E = { perimetre: Perimetre, usages: Usages, capture: Capture, validation: Validation, choix: Choix, selection: Selection,
    photos: PhotosMeubles, preferences: Preferences, proposition: Proposition, approfondissement: Approfondissement }[props.etat.etape];
  return <E {...props} />;
}

/* 1. Périmètre : les pièces concernées */
function Perimetre({ x, t, etat, modifier, pieces, setPieces, projetId, recharger }) {
  const [fonction, setFonction] = useState('salon'), [nom, setNom] = useState(''), [attente, setAttente] = useState(false);
  const basculer = id => modifier(e => ({ ...e, pieces: e.pieces.includes(id) ? e.pieces.filter(p => p !== id) : [...e.pieces, id] }));
  async function ajouter(ev) {
    ev.preventDefault(); setAttente(true);
    const r = await api(`/api/projets/${projetId}/pieces`, { method: 'POST', corps: { nom: nom.trim() || t.fonctions[fonction], fonction } });
    setAttente(false);
    if (!r.ok) return;
    const n = await recharger();
    if (n.ok) { setPieces(n.pieces); modifier(e => ({ ...e, pieces: [...e.pieces, r.piece.id] })); setNom(''); }
  }
  return (
    <>
      {pieces.length > 0 && <fieldset className="champ champ--groupe">
        <legend>{x.perimetre.pieces}</legend>
        <div className="coches">
          {pieces.map(p => <label key={p.id} className="coche coche--cadre">
            <input type="checkbox" checked={etat.pieces.includes(p.id)} onChange={() => basculer(p.id)} />
            <span>{p.nom} <span className="discret">· {t.fonctions[p.fonction]}{p.modele ? ' · ' + x.planReleve : ''}</span></span>
          </label>)}
        </div>
      </fieldset>}
      <form className="parcours__ajout" onSubmit={ajouter}>
        <label className="champ"><span>{x.perimetre.fonction}</span>
          <select className="saisie" value={fonction} onChange={e => setFonction(e.target.value)}>
            {FONCTIONS.map(f => <option key={f} value={f}>{t.fonctions[f]}</option>)}
          </select>
        </label>
        <label className="champ"><span>{x.perimetre.nom}</span>
          <input className="saisie" value={nom} maxLength={80} placeholder={t.fonctions[fonction]} onChange={e => setNom(e.target.value)} />
        </label>
        <button className="btn btn--clair" disabled={attente}>{attente ? <Rouage /> : null} {x.perimetre.ajouter}</button>
      </form>
    </>
  );
}

/* 2. Usages : ce qui se passe dans chaque pièce */
function Usages({ x, t, etat, modifier, choisies }) {
  const maj = (id, champ, v) => modifier(e => ({ ...e, usages: { ...e.usages, [id]: { espaces: [], envies: '', ...e.usages[id], [champ]: v } } }));
  return choisies.map(p => {
    const u = etat.usages[p.id] || { espaces: [], envies: '' }, possibles = ESPACES_PAR_FONCTION[p.fonction] || [];
    return (
      <fieldset key={p.id} className="carte parcours__piece">
        <legend><b>{p.nom}</b> <span className="discret">· {t.fonctions[p.fonction]}</span></legend>
        {possibles.length > 0 && <div className="coches">
          {possibles.map(s => <label key={s} className="coche">
            <input type="checkbox" checked={u.espaces.includes(s)} onChange={() => maj(p.id, 'espaces', u.espaces.includes(s) ? u.espaces.filter(v => v !== s) : [...u.espaces, s])} />
            {x.espaces[s]}
          </label>)}
        </div>}
        {u.espaces.includes('repas') && <label className="champ"><span>{x.usages.places}</span>
          <input className="saisie" type="number" min="2" max="12" value={u.placesRepas || 4} onChange={e => maj(p.id, 'placesRepas', +e.target.value)} />
        </label>}
        <label className="champ"><span>{x.usages.envies}</span>
          <textarea className="saisie" rows={2} maxLength={600} value={u.envies} placeholder={x.usages.exemple} onChange={e => maj(p.id, 'envies', e.target.value)} />
        </label>
        <label className="coche"><input type="checkbox" checked={!!u.confirme} onChange={e => maj(p.id, 'confirme', e.target.checked)} />{x.usages.confirme}</label>
      </fieldset>
    );
  });
}

/* 3. Capture : relevé dans l'atelier existant (RoomPlan, import de plan, photos et mesures) */
function Capture({ x, racine, choisies, recharger }) {
  const [attente, setAttente] = useState(false);
  return (
    <>
      <ul className="parcours__liste">
        {choisies.map(p => <li key={p.id} className="carte parcours__piece">
          <b>{p.nom}</b>
          {p.modele ? <span className="puce puce--vert">{x.capture.fait}</span>
            : p.etat === 'analyse' ? <span className="puce"><Rouage /> {x.capture.analyse}</span>
              : <span className="puce">{x.capture.aFaire}</span>}
          <Link className="btn btn--petit btn--clair" href={`${racine}/pieces/${p.id}`}>{p.modele ? x.capture.refaire : x.capture.relever}</Link>
        </li>)}
      </ul>
      <button type="button" className="btn btn--lien" disabled={attente} onClick={async () => { setAttente(true); await recharger(); setAttente(false); }}>
        {attente && <Rouage />} {x.capture.actualiser}
      </button>
    </>
  );
}

function Cotes({ m, x }) {
  const f = v => v.toLocaleString(x.locale, { maximumFractionDigits: 2 });
  const ouv = Object.values(m.murs || {}).flatMap(w => w.ouvertures || []);
  return <p className="discret">{f(m.dims.largeur)} × {f(m.dims.profondeur)} m, {x.validation.hauteur} {f(m.dims.hauteur)} m
    {m.contour ? ` · ${contourDe(m).length} ${x.validation.cotes}` : ''} · {ouv.filter(o => o.type === 'porte' || o.type === 'passage').length} {x.validation.portes},
    {' '}{ouv.filter(o => o.type === 'fenetre').length} {x.validation.fenetres}{m.dims.estimees ? ' · ' + x.validation.estimees : ''}</p>;
}

/* 4. Validation du plan */
function Validation({ x, racine, etat, modifier, choisies, produits, projetId, setPieces, setMessage }) {
  const [attente, setAttente] = useState('');
  async function valider(p) {
    setAttente(p.id);
    const r = await api(`/api/projets/${projetId}/parcours`, { method: 'POST', corps: { action: 'valider', piece: p.id } });
    setAttente('');
    if (!r.ok) { setMessage({ texte: x.erreurs[r.erreur] || x.erreurs.generique, erreur: true }); return; }
    setPieces(r.pieces);
    const n = r.pieces.find(q => q.id === p.id);
    modifier(e => ({ ...e, valides: { ...e.valides, [p.id]: n.version_scene || 0 } }));
  }
  return choisies.map(p => (
    <section key={p.id} className="carte parcours__piece parcours__piece--plan">
      <h3>{p.nom}</h3>
      {!p.modele ? <p>{x.validation.pasDePlan}</p> : <>
        <div className="parcours__plan"><MiniPlan modele={p.modele} items={p.agencement || []} produits={produits} /></div>
        <Cotes m={p.modele} x={x} />
        {etat.valides[p.id] === (p.version_scene || 0)
          ? <p className="puce puce--vert">{x.validation.valide}</p>
          : <div className="rangee">
            <button type="button" className="btn btn--plein btn--petit" disabled={!!attente} onClick={() => valider(p)}>{attente === p.id && <Rouage />} {x.validation.juste}</button>
            <Link className="btn btn--clair btn--petit" href={`${racine}/pieces/${p.id}`}>{x.validation.corriger}</Link>
          </div>}
      </>}
    </section>
  ));
}

const existants = p => (p.agencement || []).filter(it => it.origine === 'existant' && it.garde !== false);

/* 5. Choix par pièce */
function Choix({ x, etat, modifier, choisies }) {
  return choisies.map(p => {
    const meubles = existants(p).filter(it => !estInstallation(it));
    return (
      <fieldset key={p.id} className="carte parcours__piece">
        <legend><b>{p.nom}</b></legend>
        {!meubles.length ? <p className="discret">{x.choix.vide}</p> : ['tout', 'reagencer', 'certains'].map(c => (
          <label key={c} className="coche coche--cadre">
            <input type="radio" name={'choix-' + p.id} checked={etat.choix[p.id] === c} onChange={() => modifier(e => ({ ...e, choix: { ...e.choix, [p.id]: c } }))} />
            <span><b>{x.choix[c]}</b><br /><span className="discret">{x.choix[c + 'Aide']}</span></span>
          </label>
        ))}
      </fieldset>
    );
  });
}

// Plan numéroté des meubles relevés ; les meubles gardés sont mis en avant.
function PlanNumerote({ p, gardes }) {
  const m = p.modele, L = m.dims.largeur, P = m.dims.profondeur, liste = existants(p);
  return <svg viewBox={`${-L / 2 - .15} ${-P / 2 - .15} ${L + .3} ${P + .3}`} className="parcours__svg" aria-hidden="true">
    <polygon points={contourDe(m).map(q => q.join(',')).join(' ')} fill="#eee5d7" stroke="#85745f" strokeWidth=".035" />
    {liste.map((it, n) => {
      const [w, d] = it.p.dim, garde = gardes.has(it.id);
      return <g key={it.id} transform={`translate(${it.x} ${it.z})`}>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} rx=".03" transform={`rotate(${-(it.rot || 0) * 180 / Math.PI})`}
          fill={garde ? '#7d8f89' : '#d8ccb9'} stroke="#786b58" strokeWidth=".02" />
        <circle r=".17" fill="#fff" stroke="#3d342a" strokeWidth=".02" />
        <text textAnchor="middle" dominantBaseline="central" fontSize=".2" fontWeight="700" fill="#3d342a">{n + 1}</text>
      </g>;
    })}
  </svg>;
}

/* 6. Sélection sur le plan */
function Selection({ x, t, etat, modifier, choisies }) {
  const poser = (pid, id, v) => modifier(e => {
    const s = { ...(e.selection[pid] || {}) };
    if (v) s[id] = v; else delete s[id];
    return { ...e, selection: { ...e.selection, [pid]: s } };
  });
  return choisies.map(p => {
    const liste = existants(p), choix = etat.choix[p.id] || 'tout', gardes = new Set(gardesDe(etat, p).map(it => it.id));
    if (!liste.length || !p.modele) return <section key={p.id} className="carte parcours__piece"><h3>{p.nom}</h3><p className="discret">{x.choix.vide}</p></section>;
    return (
      <section key={p.id} className="carte parcours__piece parcours__piece--plan">
        <h3>{p.nom} <span className="discret">· {x.choix[choix]}</span></h3>
        <div className="parcours__plan"><PlanNumerote p={p} gardes={gardes} /></div>
        <ol className="parcours__meubles">
          {liste.map((it, n) => {
            const installation = estInstallation(it), [w, d, h] = it.p.dim;
            const valeur = installation ? 'fixe' : choix === 'certains' ? (etat.selection[p.id]?.[it.id] || '') : choix === 'reagencer' ? 'deplacable' : '';
            return (
              <li key={it.id}>
                <span className="parcours__num">{n + 1}</span>
                <span><b>{it.p.nom || t.fonctions?.[it.p.fam] || it.p.fam}</b><br />
                  <span className="discret">{[w, d, h].map(v => Math.round(v * 100)).join(' × ')} cm{gardes.has(it.id) ? ' · ' + x.selection.verrou : ''}</span></span>
                {installation ? <span className="puce">{x.selection.installation}</span>
                  : choix === 'certains' ? (
                    <select className="saisie" aria-label={x.selection.devenir + ' ' + (n + 1)} value={valeur} onChange={e => poser(p.id, it.id, e.target.value)}>
                      <option value="">{x.selection.remplacer}</option>
                      <option value="deplacable">{x.selection.deplacable}</option>
                      <option value="fixe">{x.selection.fixe}</option>
                    </select>
                  ) : <span className="puce">{valeur ? x.selection.deplacable : x.selection.remplacer}</span>}
              </li>
            );
          })}
        </ol>
        <p className="discret">{x.selection.note}</p>
      </section>
    );
  });
}

/* 7. Photos des meubles conservés (facultatif) */
function PhotosMeubles({ x, etat, modifier, choisies, setPieces, recharger, setMessage }) {
  const [attente, setAttente] = useState('');
  async function envoyer(p, it, fichier) {
    if (!fichier) return;
    setAttente(it.id);
    try {
      const { blob, largeur, hauteur } = await reduireImage(fichier);
      const f = new FormData();
      f.append('photo', blob, 'meuble.jpg'); f.append('role', 'detail'); f.append('meuble', it.id);
      f.append('largeur', String(largeur)); f.append('hauteur', String(hauteur));
      const r = await api(`/api/pieces/${p.id}/photos`, { method: 'POST', formulaire: f });
      if (!r.ok) setMessage({ texte: x.erreurs[r.erreur] || x.erreurs.generique, erreur: true });
      else { const n = await recharger(); if (n.ok) setPieces(n.pieces); }
    } catch (_) { setMessage({ texte: x.erreurs.format, erreur: true }); }
    setAttente('');
  }
  return choisies.map(p => {
    const gardes = gardesDe(etat, p).filter(it => !estInstallation(it));
    return (
      <section key={p.id} className="carte parcours__piece">
        <h3>{p.nom}</h3>
        {!gardes.length ? <p className="discret">{x.photos.aucun}</p> : <ul className="parcours__liste">
          {gardes.map(it => {
            const photo = (p.photos || []).find(f => f.meuble === it.id);
            return <li key={it.id} className="parcours__photo">
              {photo ? <img src={photo.url} alt={x.photos.alt + ' ' + (it.p.nom || it.p.fam)} width="72" height="72" /> : <span className="parcours__vignette" aria-hidden="true" />}
              <span>{it.p.nom || it.p.fam}</span>
              <label className="btn btn--petit btn--clair">
                {attente === it.id ? <Rouage /> : null} {photo ? x.photos.remplacer : x.photos.ajouter}
                <input type="file" accept="image/*" className="visuel-masque" disabled={!!attente} onChange={e => envoyer(p, it, e.target.files?.[0])} />
              </label>
            </li>;
          })}
        </ul>}
        <label className="coche"><input type="checkbox" checked={!!etat.photosPassees[p.id]}
          onChange={e => modifier(s => ({ ...s, photosPassees: { ...s.photosPassees, [p.id]: e.target.checked } }))} />{x.photos.passer}</label>
      </section>
    );
  });
}

/* 8. Préférences */
function Preferences({ x, etat, modifier }) {
  const pr = etat.preferences, maj = (k, v) => modifier(e => ({ ...e, preferences: { ...e.preferences, [k]: v } }));
  return (
    <div className="formulaire">
      <label className="champ"><span>{x.preferences.budget}</span>
        <input className="saisie" type="number" min="0" step="100" value={pr.budget || ''} placeholder={x.preferences.sansBudget} onChange={e => maj('budget', +e.target.value || 0)} />
        <small>{x.preferences.budgetAide}</small>
      </label>
      <label className="champ"><span>{x.preferences.style}</span>
        <input className="saisie" maxLength={120} value={pr.style} placeholder={x.preferences.styleExemple} onChange={e => maj('style', e.target.value)} />
      </label>
      <label className="champ"><span>{x.preferences.envies}</span>
        <textarea className="saisie" rows={3} maxLength={800} value={pr.envies} onChange={e => maj('envies', e.target.value)} />
      </label>
      <label className="coche"><input type="checkbox" checked={!!pr.confirme} onChange={e => maj('confirme', e.target.checked)} />{x.preferences.confirme}</label>
    </div>
  );
}

/* 9. Première proposition : l'assistant de l'atelier, pièce par pièce */
function Proposition({ x, lang, racine, etat, choisies, produits, faits, recharger, setPieces, occupe, setOccupe }) {
  const [suivi, setSuivi] = useState({});
  async function lancer() {
    setOccupe('proposition');
    const n = { ...suivi };
    for (const p of choisies) {
      n[p.id] = 'encours'; setSuivi({ ...n });
      const r = await api(`/api/pieces/${p.id}/variantes`, { method: 'POST', corps: demandeProposition(etat, p, lang) });
      n[p.id] = r.ok ? 'fait' : (x.erreurs[r.erreur] || x.erreurs.generique);
      setSuivi({ ...n });
      annoncer(p.nom + ' : ' + (r.ok ? x.proposition.prete : n[p.id]));
    }
    const r = await recharger();
    if (r.ok) setPieces(r.pieces);
    setOccupe('');
  }
  const prete = p => (p.proposition?.variantes?.liste || []).length > 0;
  return (
    <>
      {occupe === 'proposition' && <Progression libelle={x.proposition.calcul} etapes={choisies.map(p => ({ id: p.id, nom: p.nom, fait: suivi[p.id] === 'fait', encours: suivi[p.id] === 'encours' }))} />}
      <button type="button" className="btn btn--plein" disabled={!!occupe} onClick={lancer}>
        {occupe === 'proposition' ? <><Rouage /> {x.proposition.calcul}</> : faits.proposition ? x.proposition.relancer : x.proposition.lancer}
      </button>
      {choisies.map(p => (
        <section key={p.id} className="carte parcours__piece parcours__piece--plan">
          <h3>{p.nom}</h3>
          {typeof suivi[p.id] === 'string' && !['fait', 'encours'].includes(suivi[p.id]) && <p className="avis avis--alerte">{suivi[p.id]}</p>}
          {prete(p) && p.modele && <>
            <div className="parcours__plan"><MiniPlan modele={p.modele} items={p.agencement || []} produits={produits} /></div>
            <Link className="btn btn--clair btn--petit" href={`${racine}/pieces/${p.id}`}>{x.proposition.atelier}</Link>
          </>}
        </section>
      ))}
    </>
  );
}

/* 10. Approfondissement (facultatif) : tâche longue sur le service GPU */
function Approfondissement({ x, lang, choisies, approfondissement, recharger, setPieces }) {
  const [taches, setTaches] = useState({}), [erreurs, setErreurs] = useState({});
  const lire = useCallback(async id => {
    const r = await api(`/api/pieces/${id}/approfondir`);
    if (r.ok) setTaches(v => ({ ...v, [id]: r.taches[0] || null }));
  }, []);
  useEffect(() => { choisies.forEach(p => lire(p.id)); }, [choisies.length, lire]); // eslint-disable-line react-hooks/exhaustive-deps
  // suivi des tâches actives, puis mise à jour des pièces à la fin
  useEffect(() => {
    const actives = Object.entries(taches).filter(([, t]) => t && TACHE_ACTIVE.includes(t.etat));
    if (!actives.length) return undefined;
    const h = setTimeout(async () => {
      for (const [pid, t] of actives) {
        const r = await api(`/api/taches/${t.id}`);
        if (r.ok) {
          setTaches(v => ({ ...v, [pid]: r.tache }));
          if (!TACHE_ACTIVE.includes(r.tache.etat)) { annoncer(x.approfondissement.etats[r.tache.etat]); const n = await recharger(); if (n.ok) setPieces(n.pieces); }
        }
      }
    }, 3000);
    return () => clearTimeout(h);
  }, [taches, recharger, setPieces, x]);
  async function lancer(p) {
    setErreurs(v => ({ ...v, [p.id]: '' }));
    const r = await api(`/api/pieces/${p.id}/approfondir`, { method: 'POST', corps: { langue: lang } });
    if (!r.ok) { setErreurs(v => ({ ...v, [p.id]: x.erreurs[r.erreur] || x.erreurs.generique })); return; }
    setTaches(v => ({ ...v, [p.id]: r.tache }));
  }
  async function arreter(p) {
    const r = await api(`/api/taches/${taches[p.id].id}`, { method: 'DELETE' });
    if (r.ok) setTaches(v => ({ ...v, [p.id]: r.tache }));
  }
  if (!approfondissement.actif) return <p className="avis avis--note">{x.approfondissement.indisponible}</p>;
  return (
    <>
      {approfondissement.simulation && <p className="avis avis--note">{x.approfondissement.simulation}</p>}
      {choisies.map(p => {
        const tache = taches[p.id], active = tache && TACHE_ACTIVE.includes(tache.etat);
        return (
          <section key={p.id} className="carte parcours__piece">
            <h3>{p.nom}</h3>
            {tache && <p className="discret" role="status">{active && <Rouage />} {x.approfondissement.etats[tache.etat]}
              {active && tache.progression ? ` (${tache.progression.etape}/${tache.progression.total})` : ''}
              {tache.etat === 'fini' && tache.resultat?.obsolete ? ' ' + x.approfondissement.obsolete : ''}
              {tache.etat === 'fini' && tache.resultat?.rapport ? ' ' + x.approfondissement.rapport(tache.resultat.rapport) : ''}
              {['erreur', 'annule'].includes(tache.etat) && tache.credits ? ' ' + x.approfondissement.rembourse : ''}</p>}
            {erreurs[p.id] && <p className="avis avis--alerte">{erreurs[p.id]}</p>}
            {active ? <button type="button" className="btn btn--clair btn--petit" onClick={() => arreter(p)}>{x.approfondissement.arreter}</button>
              : <button type="button" className="btn btn--plein btn--petit" onClick={() => lancer(p)}>{x.approfondissement.lancer} · {approfondissement.credits} {x.credits}</button>}
          </section>
        );
      })}
    </>
  );
}

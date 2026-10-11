'use client';
// Le parcours guidé : de grands écrans qui se suivent, une question à la fois.
// Compte → (vos pièces) → pièce → budget → style → priorité → photos.
// Chaque écran entre comme une station de la visite privée : lettres étirées qui se posent,
// script qui glisse, repère déchiffré ; il sort en se floutant avant le suivant.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import { reduireImage } from '@/components/piece/image.js';
import Inspirations from '@/components/piece/Inspirations.js';
import Acquisition from '@/components/piece/Acquisition.js';
import PlanPiece from '@/components/piece/PlanPiece.js';
import { prix } from '@/lib/i18n.js';
import Marque from '@/components/maison/Embleme.js';
import { Fleche } from '@/components/maison/icones.js';
import { remplir, PRIORITES } from '@/components/maison/textes.js';
import { suggerer } from '@/components/maison/demande.js';
import { initGsap, gsap, lettres, entreeTitre, entreeScript, dechiffrer, monter, reduit } from '@/components/maison/anim.js';

export const ETAPES = ['piece', 'budget', 'style', 'priorite', 'photos'];
const BUDGETS = [1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000, 12500, 15000, 20000];
const pad2 = n => String(n).padStart(2, '0');

// montant qui défile jusqu'à sa nouvelle valeur (texte écrit ici, pas par React)
function Montant({ valeur, lang, libre }) {
  const el = useRef(null);
  const affiche = useRef(0);
  useLayoutEffect(() => {
    const ecrire = v => { if (el.current) el.current.textContent = v ? prix(Math.round(v * 100), lang, Number.isInteger(valeur) ? 0 : 2) : libre; };
    if (!valeur || !affiche.current || reduit()) { affiche.current = valeur; ecrire(valeur); return; }
    const o = { v: affiche.current };
    const tw = gsap.to(o, { v: valeur, duration: .6, ease: 'power3.out', onUpdate: () => ecrire(o.v), onComplete: () => { affiche.current = valeur; } });
    return () => { tw.kill(); affiche.current = o.v; };
  }, [valeur, lang, libre]);
  return <span ref={el} />;
}

export default function Parcours({
  t, lang, demo, etapeInitiale, connecte, profil, connexion, message, raison, choix, setChoix,
  piece, setPiece, assurerPiece, produits, onConnecteDemo, onOuvrirPiece, onLancer, onDeconnexion, photoPourRendu = false
}) {
  const [etape, setEtape] = useState(etapeInitiale);
  const [envoi, setEnvoi] = useState({});
  const [erreurPhoto, setErreurPhoto] = useState('');
  const [avisStyle, setAvisStyle] = useState('');
  const [modeCapture, setModeCapture] = useState('photos'), [plan, setPlan] = useState(false);
  const [dims, setDims] = useState(() => ({ largeur: (piece && piece.dims && piece.dims.largeur) || '', profondeur: (piece && piece.dims && piece.dims.profondeur) || '' }));
  const corps = useRef(null);
  const occupe = useRef(false);
  const num = ETAPES.indexOf(etape);
  const photos = (piece && piece.photos) || [];
  const photo = role => photos.find(p => p.role === role);
  const pieces = (profil && profil.pieces) || [];

  // sortie de l'écran (lettres floutées), puis le suivant
  function aller(suivante) {
    if (occupe.current || suivante === etape) return;
    const el = corps.current && corps.current.querySelector('[data-etape]');
    if (!el || reduit()) { setEtape(suivante); return; }
    occupe.current = true;
    gsap.timeline({ onComplete: () => { occupe.current = false; setEtape(suivante); } })
      .to(el.querySelectorAll('.char'), { opacity: 0, yPercent: -24, duration: .4, stagger: .007, ease: 'power2.in', overwrite: true }, 0)
      .to(el.querySelectorAll('.mc-question__label, .mc-question__texte, .mc-reponses'), { autoAlpha: 0, y: -16, duration: .38, ease: 'power2.in', overwrite: true }, 0);
  }
  // entrée de l'écran
  useLayoutEffect(() => {
    const el = corps.current && corps.current.querySelector('[data-etape]');
    if (!el) return;
    initGsap();
    corps.current.scrollTop = 0;
    entreeTitre(lettres(el.querySelector('.mc-question__titre')), .05);
    entreeScript(lettres(el.querySelector('.mc-question__script')), .45);
    const lab = el.querySelector('[data-label]');
    if (lab) dechiffrer(lab, lab.dataset.label, .7);
    monter(el.querySelectorAll('.mc-question__label, .mc-question__texte'), .3, 12);
    monter(el.querySelectorAll('.mc-reponses > *'), .42, 26);
  }, [etape]);
  useEffect(() => { if (!avisStyle) return; const h = setTimeout(() => setAvisStyle(''), 2600); return () => clearTimeout(h); }, [avisStyle]);

  const precedente = etape === 'piece' ? (connecte ? (pieces.length ? 'reprise' : null) : 'compte') : num > 0 ? ETAPES[num - 1] : null;
  const peutContinuer = !Object.values(envoi).some(Boolean) && (etape === 'piece' ? !!choix.fonction
    : etape === 'priorite' ? choix.priorites.length > 0
      : etape === 'photos' ? (!!photo('entree') || !!piece?.modele?.capture) && !plan
        : true);
  async function continuer() {
    if (!peutContinuer) return;
    if (etape === 'photos') {
      setErreurPhoto(''); setEnvoi(e => ({ ...e, precisions: true }));
      try { if (await onLancer(dims, choix.notes ?? piece?.notes ?? '') === false) setErreurPhoto(t.photos.erreurDetails); }
      catch (_) { setErreurPhoto(t.photos.erreurDetails); }
      finally { setEnvoi(e => ({ ...e, precisions: false })); }
      return;
    }
    aller(ETAPES[num + 1]);
  }

  // ---------- réponses ----------
  function choisirPiece(f) {
    setChoix(c => ({ ...c, fonction: f, priorites: c.fonction === f ? c.priorites : [] }));
    setTimeout(() => aller('budget'), reduit() ? 0 : 420);
  }
  function basculerStyle(id) {
    if (choix.styles.includes(id)) { setChoix(c => ({ ...c, styles: c.styles.filter(s => s !== id) })); return; }
    if (choix.styles.length >= 3) { setAvisStyle(t.style.max); return; }
    setChoix(c => ({ ...c, styles: [...c.styles.filter(s => s !== id), id].slice(0, 3) }));
  }
  function basculerCoup(id) {
    setChoix(c => ({ ...c, coups: c.coups.includes(id) ? c.coups.filter(x => x !== id) : [...c.coups, id].slice(-4) }));
  }
  function basculerPriorite(k) {
    setChoix(c => {
      if (k === 'tout') return { ...c, priorites: c.priorites.includes('tout') ? [] : ['tout'] };
      const sans = c.priorites.filter(x => x !== 'tout');
      return { ...c, priorites: sans.includes(k) ? sans.filter(x => x !== k) : [...sans, k] };
    });
  }
  async function envoyer(role, fichier) {
    if (!fichier) return;
    setErreurPhoto('');
    setEnvoi(e => ({ ...e, [role]: true }));
    try {
      const p = await assurerPiece();
      const { blob, largeur, hauteur } = await reduireImage(fichier);
      const f = new FormData();
      f.append('photo', blob, 'photo.jpg');
      f.append('role', role);
      f.append('largeur', String(largeur));
      f.append('hauteur', String(hauteur));
      const r = await api(`/api/pieces/${p.id}/photos`, { method: 'POST', formulaire: f });
      if (r.ok) setPiece(r.piece); else setErreurPhoto(t.photos.erreur);
    } catch (_) { setErreurPhoto(t.photos.erreur); }
    setEnvoi(e => ({ ...e, [role]: false }));
  }

  const suggestions = useMemo(() => {
    const base = suggerer(produits, choix, 4);
    const coups = choix.coups.map(id => produits && produits[id]).filter(Boolean);
    return [...coups, ...base.filter(p => !choix.coups.includes(p.id))].slice(0, Math.max(4, coups.length));
  }, [produits, choix]);

  const question = (q, titreBalise = 'h2') => {
    const Titre = titreBalise;
    return (
      <div className="mc-question">
        <p className="mc-question__label mc-mono"><i />{num >= 0 && <>{pad2(num + 1)} — </>}<span data-label={q.label}>{q.label}</span></p>
        <Titre className="mc-question__titre mc-display">{q.lignes.map((l, i) => <span key={i} className="mc-ligne">{l}</span>)}</Titre>
        <p className="mc-question__script mc-script">{q.script}</p>
        {q.texte && <p className="mc-question__texte">{q.texte}</p>}
      </div>
    );
  };

  let contenu = null;
  if (etape === 'compte') {
    const suite = `/${lang}/maison-corleone`;
    contenu = (
      <>
        {question(t.compte, 'h1')}
        <div className="mc-reponses">
          <div className="mc-compte">
            <ul className="mc-compte__offre">{t.compte.offre.map(([b, s]) => <li key={s}><b>{b}</b><span>{s}</span></li>)}</ul>
            {message && <p className="mc-avis" role="status">{t.compte[message]}{raison && <small className="mc-avis__ref">{t.compte.ref} {raison}</small>}</p>}
            {demo ? (
              <>
                <button type="button" className="mc-btn mc-btn--plein mc-btn--grand" onClick={() => { onConnecteDemo(); aller(pieces.length ? 'reprise' : 'piece'); }}>{t.compte.bouton}<Fleche /></button>
                <p className="mc-compte__note">{t.compte.demoNote}</p>
              </>
            ) : connexion ? (
              <>
                <a className="mc-btn mc-btn--plein mc-btn--grand" href={`/api/mc/connexion?lang=${lang}&suite=${encodeURIComponent(suite)}`}>{t.compte.bouton}<Fleche /></a>
                <p className="mc-compte__note">{t.compte.note}</p>
              </>
            ) : (
              <>
                <p className="mc-avis">{t.compte.inactif}</p>
                <a className="mc-btn mc-btn--grand" href={`/${lang}/maison-corleone/demo`}>{t.compte.demo}<Fleche /></a>
              </>
            )}
          </div>
        </div>
      </>
    );
  } else if (etape === 'reprise') {
    const date = d => { try { return new Date(d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long' }); } catch (_) { return ''; } };
    contenu = (
      <>
        {question(t.reprise)}
        <div className="mc-reponses">
          <ul className="mc-reprise">
            {pieces.map((p, i) => (
              <li key={p.id}>
                <button type="button" className="mc-reprise__piece" onClick={() => onOuvrirPiece(p.id)}>
                  <em>{pad2(i + 1)}</em>
                  <span className="mc-reprise__txt"><b>{p.nom}</b><small className="mc-mono">{remplir(t.reprise.le, { d: date(p.maj_le) })}</small></span>
                  <Fleche />
                </button>
              </li>
            ))}
          </ul>
          <div><button type="button" className="mc-btn mc-btn--plein mc-btn--grand" onClick={() => aller('piece')}>{t.reprise.nouvelle}<Fleche /></button></div>
        </div>
      </>
    );
  } else if (etape === 'piece') {
    contenu = (
      <>
        {question(t.piece)}
        <div className="mc-reponses">
          <ul className="mc-choix">
            {t.piece.options.map(([id, nom, aide], i) => (
              <li key={id}>
                <button type="button" className="mc-choix__btn" aria-pressed={choix.fonction === id} onClick={() => choisirPiece(id)}>
                  <em>{pad2(i + 1)}</em>
                  <span className="mc-choix__txt"><b>{nom}</b><small>{aide}</small></span>
                  <span className="mc-choix__coche" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  } else if (etape === 'budget') {
    const i = choix.budget ? BUDGETS.reduce((m, v, k) => (Math.abs(v - choix.budget) < Math.abs(BUDGETS[m] - choix.budget) ? k : m), 0) : BUDGETS.length - 1;
    const pct = i / (BUDGETS.length - 1) * 100;
    contenu = (
      <>
        {question(t.budget)}
        <div className="mc-reponses">
          <div className="mc-budget">
            <p className="mc-budget__valeur" aria-live="polite"><Montant valeur={choix.budget} lang={lang} libre={t.budget.libre} />{choix.budget > 0 && <small>{lang==='fr'?'plafond de votre sélection':'your selection limit'}</small>}</p>
            <label className="mc-budget__saisie"><span className="mc-mono">{lang==='fr'?'Mon budget (€)':'My budget (€)'}</span><input type="number" inputMode="decimal" min="0" max="1000000" step=".01" placeholder="2500" value={choix.budget||''} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&n<=1e6)setChoix(c=>({...c,budget:n}));}}/><small>{lang==='fr'?'Saisissez votre plafond ou choisissez « Sans limite ».':'Enter your spending limit or choose “No limit”.'}</small></label>
            <div className={'mc-curseur' + (choix.budget ? '' : ' is-libre')}>
              <span className="mc-curseur__rail" />
              <span className="mc-curseur__plein" style={{ width: pct + '%' }} />
              <input type="range" min="0" max={BUDGETS.length - 1} step="1" value={i} aria-label={t.budget.label}
                aria-valuetext={choix.budget ? prix(choix.budget * 100, lang, 0) : t.budget.libre}
                onChange={e => setChoix(c => ({ ...c, budget: BUDGETS[+e.target.value] }))} />
              <span className="mc-curseur__bouton" style={{ left: pct + '%' }} />
            </div>
            <div className="mc-puces">
              {t.budget.presets.map(v => <button key={v} type="button" className="mc-puce" aria-pressed={choix.budget === v} onClick={() => setChoix(c => ({ ...c, budget: v }))}>{prix(v * 100, lang, 0)}</button>)}
              <button type="button" className="mc-puce" aria-pressed={!choix.budget} onClick={() => setChoix(c => ({ ...c, budget: 0 }))}>{t.budget.libre}</button>
            </div>
          </div>
        </div>
      </>
    );
  } else if (etape === 'style') {
    contenu = (
      <>
        {question(t.style)}
        <div className="mc-reponses">
          <div className="mc-styles">
            <div className="mc-puces">
              {t.style.styles.map(([id, nom]) => <button key={id} type="button" className="mc-puce" aria-pressed={choix.styles.includes(id)} onClick={() => basculerStyle(id)}>{nom}</button>)}
            </div>
            {avisStyle && <p className="mc-avis mc-avis--leger" role="status">{avisStyle}</p>}
            <input className="mc-champ-libre" type="text" maxLength={300} placeholder={t.style.champ} aria-label={t.style.champ} value={choix.texte}
              onChange={e => setChoix(c => ({ ...c, texte: e.target.value }))} />
          </div>
          <Inspirations piece={piece} setPiece={setPiece} assurerPiece={assurerPiece} lang={lang} demo={demo} onOccupe={v => setEnvoi(e => ({ ...e, inspiration: v }))} />
          {suggestions.length > 0 && (
            <div className="mc-suggestions">
              <p className="mc-suggestions__tete"><span className="mc-mono">{t.style.suggestions}</span><small>{t.style.coupsAide}</small></p>
              <ul className="mc-suggestions__grille">
                {suggestions.map(p => (
                  <li key={p.id}>
                    <button type="button" className="mc-produit-mini" aria-pressed={choix.coups.includes(p.id)} onClick={() => basculerCoup(p.id)} aria-label={`${p.nom} — ${t.style.coup}`}>
                      <span className="mc-produit-mini__img"><img src={p.vign} alt="" loading="lazy" width="180" height="225" /><i className="mc-produit-mini__coeur" aria-hidden="true">{t.style.coup}</i></span>
                      <b>{p.nom}</b>
                      <small>{p.cat}{p.prix > 0 ? ' · ' + prix(p.prix * 100, lang, 0) : ''}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </>
    );
  } else if (etape === 'priorite') {
    const options = [...(PRIORITES[choix.fonction] || PRIORITES.salon).map(k => [k, t.priorite.options[k]]), [t.priorite.tout[0], t.priorite.tout[1], t.priorite.tout[2]]];
    contenu = (
      <>
        {question(t.priorite)}
        <div className="mc-reponses">
          <ul className="mc-choix">
            {options.map(([k, nom, aide], i) => (
              <li key={k} className={k === 'tout' ? 'mc-choix__tout' : undefined}>
                <button type="button" className="mc-choix__btn" aria-pressed={choix.priorites.includes(k)} onClick={() => basculerPriorite(k)}>
                  <em>{pad2(i + 1)}</em>
                  <span className="mc-choix__txt"><b>{nom}</b>{aide && <small>{aide}</small>}</span>
                  <span className="mc-choix__coche" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  } else if (etape === 'photos') {
    const p0 = photo('entree');
    contenu = (
      <>
        {question(t.photos)}
        <div className="mc-reponses">
          <Acquisition piece={piece} setPiece={setPiece} assurerPiece={assurerPiece} lang={lang}
            onMode={setModeCapture} onOccupe={v => setEnvoi(e => ({ ...e, scan: v }))}
            onImport={() => { setDims({ largeur: '', profondeur: '' }); setPlan(true); }} />
          {piece?.modele?.capture && <button type="button" className="mc-btn" onClick={() => setPlan(true)}>{lang === 'en' ? 'Check metric room plan' : 'Vérifier le plan métrique'}</button>}
          <div className="mc-photos">
            <div className="mc-photo-principale" hidden={modeCapture !== 'photos'}>
              {p0 ? (
                <>
                  <img src={p0.url} alt={t.photos.principale} />
                  <span className="mc-photo-repere mc-mono">{t.photos.repere}</span>
                  <label className="mc-photo-remplacer mc-mono">{t.photos.remplacer}<input type="file" accept="image/*" aria-label={t.photos.remplacer} onChange={e => envoyer('entree', e.target.files[0])} /></label>
                </>
              ) : (
                <>
                  <div className="mc-photo-vide">
                    <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 15h9.5l3-5h13l3 5H43v24H5z" /><circle cx="24" cy="26.5" r="7.5" /></svg>
                    <b>{t.photos.principale}</b>
                    <span className="mc-btn mc-btn--plein" aria-hidden="true">{t.photos.prendre}</span>
                  </div>
                  <input type="file" accept="image/*" aria-label={t.photos.prendre} onChange={e => envoyer('entree', e.target.files[0])} />
                </>
              )}
              {envoi.entree && <div className="mc-envoi"><i /></div>}
            </div>
            <div className="mc-photos__autres" hidden={modeCapture !== 'photos'}>
              {['fond', 'gauche', 'droite'].map(role => {
                const p = photo(role);
                return (
                  <label key={role} className={'mc-photo-mini' + (p ? ' is-pleine' : '')}>
                    {p ? <img src={p.url} alt={t.photos.angles[role]} /> : <span>+ {t.photos.angles[role]}</span>}
                    <input type="file" accept="image/*" aria-label={t.photos.angles[role]} onChange={e => envoyer(role, e.target.files[0])} />
                    {envoi[role] && <span className="mc-envoi"><i /></span>}
                  </label>
                );
              })}
            </div>
            {modeCapture === 'photos' && <p className="mc-photos__aide">{t.photos.precision}</p>}
            <details className="mc-dims" hidden={modeCapture !== 'photos' || !!piece?.modele?.capture}>
              <summary className="mc-mono">{t.photos.dims}</summary>
              <div className="mc-dims__champs">
                {['largeur', 'profondeur'].map(k => (
                  <label key={k}><span>{t.photos[k]}</span>
                    <input inputMode="decimal" placeholder={k === 'largeur' ? '4,20' : '5,00'} value={dims[k]} onChange={e => setDims(d => ({ ...d, [k]: e.target.value.replace(/[^0-9.,]/g, '') }))} />
                  </label>
                ))}
              </div>
              <p className="mc-photos__aide">{t.photos.repereDims}</p>
            </details>
            <label className="mc-photo-notes"><span className="mc-mono">{t.photos.notes}</span>
              <textarea className="mc-champ-libre" maxLength={1000} rows={3} value={choix.notes ?? piece?.notes ?? ''}
                placeholder={t.photos.notesAide} onChange={e => setChoix(c => ({ ...c, notes: e.target.value }))} />
            </label>
            {erreurPhoto && <p className="mc-avis" role="alert">{erreurPhoto}</p>}
            {!p0 && !envoi.entree && !piece?.modele?.capture && modeCapture === 'photos' && <p className="mc-photos__aide">{t.photos.manque}</p>}
          </div>
        </div>
      </>
    );
  }

  const bonjour = profil && profil.prenom ? remplir(t.nav.bonjour, { p: profil.prenom }) : t.nav.connecte;
  return (
    <div className="mc-guide mc-fixe">
      {plan && piece?.modele && <PlanPiece modele={piece.modele} items={piece.agencement || []} produits={produits || {}} lang={lang}
        onFermer={() => setPlan(false)} onSauver={async geometrie => {
          const r = await api(`/api/pieces/${piece.id}`, { method: 'PATCH', corps: { geometrie } });
          if (!r.ok) return false;
          setPiece(r.piece); return true;
        }} />}
      <Marque label={t.scene.boutique} />
      <header className="mc-guide__tete">
        {demo ? <span className="mc-pill">{t.nav.demoCourt}</span> : connecte && <span className="mc-guide__compte mc-mono">{bonjour}</span>}
        {connecte && <button type="button" className="mc-lien" onClick={onDeconnexion}>{demo ? t.scene.recommencer : t.nav.deconnexion}</button>}
      </header>
      <div className="mc-guide__corps" ref={corps}>
        <p className="mc-guide__filigrane" aria-hidden="true">{t.service}</p>
        <div key={etape} data-etape={etape} className={'mc-etape mc-etape--' + etape}>{contenu}</div>
      </div>
      {num >= 0 && (
        <footer className="mc-guide__pied">
          {precedente ? <button type="button" className="mc-retour mc-mono" onClick={() => aller(precedente)}><Fleche sens="gauche" />{t.nav.retour}</button> : <span />}
          <div className="mc-guide__progres" role="progressbar" aria-valuemin={1} aria-valuemax={ETAPES.length} aria-valuenow={num + 1} aria-label={remplir(t.nav.etape, { n: num + 1, t: ETAPES.length })}>
            <span style={{ transform: `scaleX(${(num + 1) / ETAPES.length})` }} />
            <em className="mc-mono">{remplir(t.nav.etape, { n: num + 1, t: ETAPES.length })}</em>
          </div>
          <button type="button" className="mc-btn mc-btn--plein" disabled={!peutContinuer || (etape === 'photos' && photoPourRendu && !photo('entree'))} onClick={continuer}>{etape === 'photos' ? photoPourRendu ? (lang === 'en' ? 'Return to my room' : 'Revenir à ma pièce') : t.photos.lancer : t.nav.continuer}<Fleche /></button>
        </footer>
      )}
    </div>
  );
}

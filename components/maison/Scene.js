'use client';
// La pièce du client en 3D, mise en scène comme la visite privée : une station de texte à gauche
// (titre en lettres étirées, script, repère déchiffré) qui change à chaque meuble visité, des points
// sur les pièces Maison Corleone, la caméra qui glisse jusqu'au meuble choisi et en fait le tour.
// Dessous, l'éditeur de RealRoom : on déplace, tourne, échange ou retire chaque meuble.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import Editeur3D, { chargerCatalogue } from '@/components/piece/Editeur3D.js';
import Catalogue from '@/components/piece/Catalogue.js';
import { texte as texteRealRoom, prix } from '@/lib/i18n.js';
import { estMural, estSuspendu, estAdosse, placerAuMur, demiEmpreinte, resoudre, ANGLES } from '@/lib/agencement.js';
import Marque from '@/components/maison/Embleme.js';
import Fiche from '@/components/maison/Fiche.js';
import Rendu from '@/components/maison/Rendu.js';
import { remplir } from '@/components/maison/textes.js';
import { Fleche, Icone, I, lienBoutique } from '@/components/maison/icones.js';
import { initGsap, gsap, lettres, entreeTitre, entreeScript, dechiffrer, monter, reduit } from '@/components/maison/anim.js';

const pad2 = n => String(n).padStart(2, '0');
const cm = v => Math.round(v * 100);
const DECALAGE = .17;   // la pièce se range à droite de la station (écrans larges)

export default function Scene({ t, lang, demo, piece: initiale, rendus: rendusInitiaux, credits, setCredits, profil, nbPieces, onNouvelle, onMesPieces, onDeconnexion }) {
  const ts = t.scene;
  const tr = useMemo(() => texteRealRoom(lang), [lang]);
  const [piece] = useState(initiale);
  const [items, setItems] = useState(initiale.agencement || []);
  const [rendus, setRendus] = useState(rendusInitiaux || []);
  const [selection, setSelection] = useState(null);
  const [cadre, setCadre] = useState(null);
  const [vue, setVue] = useState('dessus');
  const [soir, setSoir] = useState(false);
  const [produits, setProduits] = useState(null);
  const [libelles, setLibelles] = useState({});
  const [cat, setCat] = useState({ ouvert: false, famille: '', remplace: null });
  const [fiche, setFiche] = useState(null);
  const [rendu, setRendu] = useState(null);
  const [toast, setToast] = useState(null);
  const [pret, setPret] = useState(false);
  const [large, setLarge] = useState(true);
  const editeur = useRef(null);
  const station = useRef(null);
  const outils = useRef(null);
  const points = useRef({});
  const sauvegarde = useRef({ h: 0, liste: null });
  const aCadrer = useRef(null);
  const arrivee = useRef(true);

  useEffect(() => { chargerCatalogue().then(c => { setProduits(c.produits); setLibelles(c.libelles || {}); }).catch(() => {}); }, []);
  useEffect(() => {
    const m = matchMedia('(min-width: 900px)');
    const maj = () => setLarge(m.matches);
    maj();
    m.addEventListener('change', maj);
    return () => m.removeEventListener('change', maj);
  }, []);
  const dire = (texte, erreur) => setToast({ texte, erreur, n: Date.now() });
  useEffect(() => { if (!toast) return; const h = setTimeout(() => setToast(null), 3600); return () => clearTimeout(h); }, [toast]);

  // ---------- enregistrement différé des modifications ----------
  const ecrire = useCallback(async liste => {
    const r = await api(`/api/pieces/${piece.id}`, { method: 'PATCH', corps: { agencement: liste } });
    if (!r.ok) dire(ts.erreur, true);
  }, [piece.id, ts.erreur]);
  const enregistrer = useCallback(liste => {
    clearTimeout(sauvegarde.current.h);
    sauvegarde.current.liste = liste;
    sauvegarde.current.h = setTimeout(() => { const l = sauvegarde.current.liste; sauvegarde.current.liste = null; if (l) ecrire(l); }, 700);
  }, [ecrire]);
  // avant un rendu ou en quittant la pièce : ce qui attend part tout de suite
  const vider = useCallback(async () => {
    clearTimeout(sauvegarde.current.h);
    const l = sauvegarde.current.liste;
    sauvegarde.current.liste = null;
    if (l) await ecrire(l);
  }, [ecrire]);
  useEffect(() => () => { vider(); }, [vider]);
  const modifier = useCallback(f => setItems(l => { const n = f(l); enregistrer(n); return n; }), [enregistrer]);

  const produitDe = useCallback(it => (it.sku ? produits && produits[it.sku] : it.p), [produits]);
  const nouveaux = useMemo(() => items.filter(it => it.origine === 'catalogue' && it.garde !== false && produitDe(it)), [items, produitDe]);
  const existants = items.filter(it => it.origine === 'existant');
  const gardes = existants.filter(it => it.garde !== false).length;
  const total = nouveaux.reduce((s, it) => { const p = produitDe(it); return s + (p && p.prix > 0 ? p.prix : 0); }, 0);
  const choisi = items.find(it => it.id === selection) || null;
  const pChoisi = choisi && produitDe(choisi);
  const indexChoisi = choisi ? nouveaux.findIndex(it => it.id === choisi.id) : -1;
  const finis = rendus.filter(r => r.type === 'image' && r.etat === 'fini' && r.resultat);
  const renduEnCours = rendus.some(r => r.type === 'image' && r.etat === 'en_cours');
  const ficheItem = fiche && items.find(it => it.id === fiche);
  const ficheProduit = ficheItem && produitDe(ficheItem);

  // ---------- éditeur prêt : la pièce se range, les points apparaissent ----------
  useEffect(() => {
    if (!pret || !editeur.current) return;
    editeur.current.decalage(large && !fiche ? DECALAGE : 0, 0, arrivee.current);
    arrivee.current = false;
  }, [pret, large, fiche]);
  useEffect(() => { if (pret && editeur.current) editeur.current.ambiance(soir ? 1 : 0, 1700); }, [soir, pret]);
  useLayoutEffect(() => {
    if (!pret || reduit()) return;
    const els = Object.values(points.current).filter(Boolean);
    gsap.fromTo(els, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .7, stagger: .12, delay: 1.8, ease: 'back.out(2)', clearProps: 'transform,opacity,visibility' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret]);
  // meuble ajouté depuis le catalogue : la caméra va le montrer dès qu'il est dans la maquette
  useEffect(() => {
    if (aCadrer.current && editeur.current && editeur.current.cadrer(aCadrer.current)) aCadrer.current = null;
  }, [items]);

  // points et barre d'outils : suivent les meubles à l'écran
  useEffect(() => {
    if (!pret) return;
    let raf;
    const tour = () => {
      const ed = editeur.current;
      if (ed) {
        for (const it of nouveaux) {
          const el = points.current[it.id];
          if (!el) continue;
          const p = ed.projeter(it.id);
          if (!p) { el.style.visibility = 'hidden'; continue; }
          el.style.left = p.x.toFixed(1) + 'px';
          el.style.top = (p.y - 8).toFixed(1) + 'px';
          el.style.visibility = p.visible ? '' : 'hidden';
        }
        if (outils.current && selection) {
          const p = ed.projeter(selection);
          if (p) { outils.current.style.left = p.x + 'px'; outils.current.style.top = p.y + 'px'; outils.current.style.visibility = p.visible ? '' : 'hidden'; }
        }
      }
      raf = requestAnimationFrame(tour);
    };
    raf = requestAnimationFrame(tour);
    return () => cancelAnimationFrame(raf);
  }, [pret, nouveaux, selection]);

  // ---------- la station change : texte de la visite privée ----------
  const cleStation = !produits ? 'attente' : choisi ? 'meuble-' + choisi.id : 'ensemble';
  useLayoutEffect(() => {
    const el = station.current;
    if (!el) return;
    initGsap();
    entreeTitre(lettres(el.querySelector('.mc-station__titre')), .05);
    entreeScript(lettres(el.querySelector('.mc-station__script')), .4);
    const lab = el.querySelector('[data-label]');
    if (lab) dechiffrer(lab, lab.dataset.label, .7);
    monter(el.querySelectorAll('.mc-station__texte, .mc-station__liste, .mc-station__donnees, .mc-station__total, .mc-station__actions, .mc-station__nav'), .3, 16);
  }, [cleStation]);

  // ---------- choix d'un meuble ----------
  function choisir(id) {
    if (!id) { setSelection(null); if (cadre && editeur.current) editeur.current.ensemble(); return; }
    setSelection(id);
    if (fiche) { const it = items.find(x => x.id === id); setFiche(it && it.origine === 'catalogue' ? id : null); }
    if (vue === 'dessus' && editeur.current) editeur.current.cadrer(id);
  }
  // clic dans la maquette : on reste où l'on est (le meuble peut être déplacé tout de suite)
  function surSelection(id) {
    setSelection(id);
    if (!id && cadre && editeur.current) editeur.current.ensemble();
  }
  function ensemble() { setSelection(null); if (editeur.current) editeur.current.ensemble(); }
  function voisin(sens) {
    if (!nouveaux.length) return;
    const i = indexChoisi < 0 ? (sens > 0 ? 0 : nouveaux.length - 1) : (indexChoisi + sens + nouveaux.length) % nouveaux.length;
    choisir(nouveaux[i].id);
  }
  useEffect(() => {
    const touche = e => {
      if (e.key !== 'Escape' || rendu || cat.ouvert) return;
      if (fiche) setFiche(null); else if (selection) ensemble();
    };
    addEventListener('keydown', touche);
    return () => removeEventListener('keydown', touche);
  });

  // ---------- modifications ----------
  function surDeplacement(d) {
    modifier(l => l.map(it => (it.id === d.id ? { ...it, x: d.x, z: d.z, rot: d.rot, ...(d.mur ? { mur: d.mur } : {}), ...(d.y != null ? { y: d.y } : {}) } : it)));
  }
  function tourner(delta) {
    const r = editeur.current && editeur.current.tourner(selection, delta);
    if (r) modifier(l => l.map(it => (it.id === r.id ? { ...it, rot: r.rot, x: r.x, z: r.z } : it)));
  }
  function retirer(id) {
    const it = items.find(x => x.id === id);
    if (!it) return;
    if (it.origine === 'existant') { modifier(l => l.map(x => (x.id === id ? { ...x, garde: x.garde === false } : x))); return; }
    const p = produitDe(it);
    if (cadre === id && editeur.current) editeur.current.ensemble();
    modifier(l => l.filter(x => x.id !== id));
    setSelection(null);
    if (fiche === id) setFiche(null);
    if (p) dire(remplir(ts.retireToast, { n: p.nom }));
  }
  const ouvrirCatalogue = (famille, remplace) => setCat({ ouvert: true, famille: famille || '', remplace: remplace || null });
  function echanger(it) {
    const p = produitDe(it);
    ouvrirCatalogue(p && produits && Object.values(produits).some(x => x.fam === p.fam) ? p.fam : '', it.id);
  }
  // ajout ou échange : le nouveau meuble prend la place (et le rôle) de l'ancien
  function choisirProduit(p) {
    const { largeur: L, profondeur: P } = piece.modele.dims;
    const ancien = cat.remplace && items.find(x => x.id === cat.remplace);
    const id = 'c' + Date.now().toString(36);
    const [hx0, hz0] = demiEmpreinte(p.dim, ANGLES.entree);
    const coin = ['lampadaire', 'lampe', 'sculpture', 'jardiniere', 'plante'].includes(p.fam);
    let it = { id, origine: 'catalogue', sku: p.id, rot: ancien ? ancien.rot : ANGLES.entree,
      x: ancien ? ancien.x : coin ? L / 2 - hx0 - .1 : 0,
      z: ancien ? ancien.z : estAdosse(p.fam) || coin ? -P / 2 + hz0 + .02 : 0 };
    if (estMural(p.fam)) it = placerAuMur(piece.modele, { ...it, mur: ancien && ancien.mur ? ancien.mur : undefined, y: ancien && ancien.y ? ancien.y : 1.6 }, p.dim, ancien && ancien.mur ? ancien.mur : 'fond');
    else if (!estSuspendu(p.fam)) {
      const [hx, hz] = demiEmpreinte(p.dim, it.rot);
      it.x = Math.max(-L / 2 + hx, Math.min(L / 2 - hx, it.x));
      it.z = Math.max(-P / 2 + hz, Math.min(P / 2 - hz, it.z));
    }
    modifier(l => {
      let n = l;
      if (ancien) n = ancien.origine === 'existant' ? n.map(x => (x.id === ancien.id ? { ...x, garde: false } : x)) : n.filter(x => x.id !== ancien.id);
      const { items: places } = resoudre(piece.modele, [...n.map(x => ({ ...x, fixe: true })), it], produits);
      const place = places.find(x => x.id === id);
      return [...n, place ? { ...it, x: place.x, z: place.z, rot: place.rot, ...(place.mur ? { mur: place.mur, y: place.y } : {}) } : it];
    });
    setCat({ ouvert: false, famille: '', remplace: null });
    setSelection(id);
    if (fiche) setFiche(id);
    if (vue === 'dessus') aCadrer.current = id;
  }

  // ---------- rendu réaliste ----------
  const ouvrirRendu = () => setRendu({ demarrer: !renduEnCours && credits > 0, n: Date.now() });
  const fermerRendu = useCallback(() => setRendu(null), []);
  const capturer = useCallback(o => (editeur.current ? editeur.current.capture(o) : null), []);
  const quitter = f => async () => { await vider(); f(); };

  // ---------- station ----------
  const prixDe = p => (p && p.prix > 0 ? prix(p.prix * 100, lang) : ts.surDevis);
  let contenu;
  if (choisi && pChoisi) {
    const catalogue = choisi.origine === 'catalogue';
    const pill = catalogue ? remplir(ts.numero, { n: indexChoisi + 1, t: nouveaux.length }) : ts.deVotrePiece;
    const lien = catalogue && lienBoutique(pChoisi.url);
    contenu = (
      <>
        <p className="mc-pill mc-station__pill"><i /><span key={pill} data-label={pill}>{pill}</span></p>
        <h2 className="mc-station__titre mc-display">{pChoisi.nom}</h2>
        <p className="mc-station__script mc-script">{catalogue ? String(pChoisi.cat || '').toLowerCase() : choisi.garde === false ? ts.retireEtat.toLowerCase() : ts.gardeEtat.toLowerCase()}</p>
        {(choisi.raison || (catalogue && pChoisi.titre)) && <p className="mc-station__texte">{choisi.raison || pChoisi.titre}</p>}
        <ul className="mc-station__donnees mc-mono">
          {pChoisi.dim && <li>{remplir(ts.dims, { l: cm(pChoisi.dim[0]), p: cm(pChoisi.dim[1]), h: cm(pChoisi.dim[2]) })}</li>}
          {catalogue && (pChoisi.points || []).filter(([k]) => !/dimension|taille|encombrement/i.test(k)).slice(0, 2).map(([k, v]) => <li key={k}><b>{k}</b> {v}</li>)}
        </ul>
        {catalogue && <p className="mc-station__total">{prixDe(pChoisi)}</p>}
        <div className="mc-station__actions">
          {catalogue && <button type="button" className="mc-btn mc-btn--plein" onClick={() => setFiche(choisi.id)}>{ts.voir360}</button>}
          {lien && <a className="mc-btn" href={lien} target="_blank" rel="noopener">{ts.voir}<Icone d={I.externe} /></a>}
          <button type="button" className="mc-lien" onClick={() => echanger(choisi)} disabled={!produits}>{ts.echanger}</button>
          <button type="button" className="mc-lien" onClick={() => retirer(choisi.id)}>{choisi.origine === 'existant' && choisi.garde === false ? ts.garder : ts.retirer}</button>
        </div>
        <nav className="mc-station__nav mc-mono" aria-label={ts.mesPieces}>
          <button type="button" onClick={() => voisin(-1)} disabled={!nouveaux.length} aria-label={ts.precedente}><Fleche sens="gauche" /></button>
          <button type="button" onClick={ensemble}>{ts.ensemble}</button>
          <button type="button" onClick={() => voisin(1)} disabled={!nouveaux.length} aria-label={ts.suivante}><Fleche /></button>
        </nav>
      </>
    );
  } else {
    const pill = `${ts.proposition} · ${remplir(ts.pieces, { n: nouveaux.length })}`;
    const prop = piece.proposition;
    const offerts = remplir(credits > 1 ? ts.offertsPl : ts.offerts, { n: credits });
    contenu = (
      <>
        <p className="mc-pill mc-station__pill"><i /><span key={pill} data-label={pill}>{pill}</span></p>
        <h1 className="mc-station__titre mc-display">{remplir(ts.titre, { piece: t.fonctions[piece.fonction] || piece.nom })}</h1>
        <p className="mc-station__script mc-script">{ts.script}</p>
        <p className="mc-station__texte">{(prop && prop.concept) || ts.concept}</p>
        {nouveaux.length > 0 ? (
          <ol className="mc-station__liste">
            {nouveaux.map((it, i) => {
              const p = produitDe(it);
              return (
                <li key={it.id}>
                  <button type="button" className="mc-ligne-piece" onClick={() => choisir(it.id)} onMouseEnter={() => points.current[it.id] && points.current[it.id].classList.add('is-actif')} onMouseLeave={() => points.current[it.id] && points.current[it.id].classList.remove('is-actif')}>
                    <em>{pad2(i + 1)}</em>
                    <span className="mc-ligne-piece__txt"><small>{p.cat}</small><b>{p.nom}</b></span>
                    <span className="mc-ligne-piece__prix">{prixDe(p)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : <p className="mc-station__texte">{ts.vide}</p>}
        <ul className="mc-station__donnees mc-mono">
          <li>{remplir(ts.maquette, { l: String(piece.modele.dims.largeur).replace('.', lang === 'fr' ? ',' : '.'), p: String(piece.modele.dims.profondeur).replace('.', lang === 'fr' ? ',' : '.') })}</li>
          {existants.length > 0 && <li>{remplir(ts.gardes, { n: gardes })}</li>}
        </ul>
        <p className="mc-station__total"><small className="mc-mono">{ts.total}</small>{prix(total * 100, lang)}</p>
        <div className="mc-station__actions">
          <button type="button" className="mc-rendu-btn" onClick={ouvrirRendu} disabled={!credits && !renduEnCours && !finis.length}>
            {credits > 0 || renduEnCours ? <>{ts.rendu} <i>· {offerts}</i></> : finis.length ? ts.renduVoir : ts.plusDeRendu}
          </button>
          {finis.length > 0 && credits > 0 && <button type="button" className="mc-lien" onClick={() => setRendu({ demarrer: false, n: Date.now() })}>{ts.renduVoir}</button>}
          <button type="button" className="mc-lien" onClick={() => ouvrirCatalogue('', null)} disabled={!produits}>+ {ts.ajouter}</button>
        </div>
      </>
    );
  }

  const bonjour = profil && profil.prenom ? profil.prenom : null;
  return (
    <div className={'mc-piece mc-fixe' + (soir ? ' is-soir' : '') + (fiche ? ' a-fiche' : '')}>
      <div className="mc-piece__scene">
        <Editeur3D ref={editeur} modele={piece.modele} items={items} selection={selection} vue={vue} fond="#E6E0D4" fondSoir="#1E160E"
          surSelection={surSelection} surDeplacement={surDeplacement} surCadre={setCadre} surPret={() => setPret(true)} erreurWebgl={ts.erreur} />
        <div className="mc-points">
          {nouveaux.map((it, i) => {
            const p = produitDe(it);
            return (
              <button key={it.id} type="button" className={'mc-point' + (it.id === selection ? ' is-actif' : '')} ref={el => { points.current[it.id] = el; }}
                style={{ visibility: 'hidden' }} onClick={() => choisir(it.id)} aria-label={`${pad2(i + 1)} — ${p.nom}`}>
                <span className="mc-point__pt" aria-hidden="true" />
                <span className="mc-point__lbl" aria-hidden="true"><b>{p.nom}</b> · <em>{prixDe(p)}</em></span>
              </button>
            );
          })}
        </div>
        {choisi && pChoisi && (
          <div ref={outils} className="mc-outils" role="toolbar" aria-label={pChoisi.nom} style={{ visibility: 'hidden' }}>
            {!estMural(pChoisi.fam) && choisi.garde !== false && (
              <>
                <button type="button" title={ts.tourner} aria-label={ts.tourner} onClick={() => tourner(-Math.PI / 12)}><Icone d={I.gauche} /></button>
                <button type="button" title={ts.tourner} aria-label={ts.tourner} onClick={() => tourner(Math.PI / 12)}><Icone d={I.droite} /></button>
              </>
            )}
            <button type="button" title={ts.echanger} aria-label={ts.echanger} onClick={() => echanger(choisi)} disabled={!produits}><Icone d={I.echanger} /></button>
            {choisi.origine === 'catalogue' && <button type="button" title={ts.voir360} aria-label={ts.voir360} onClick={() => setFiche(choisi.id)}><Icone d={I.tour} /></button>}
            <button type="button" title={choisi.origine === 'existant' && choisi.garde === false ? ts.garder : ts.retirer} aria-label={choisi.origine === 'existant' && choisi.garde === false ? ts.garder : ts.retirer} onClick={() => retirer(choisi.id)}>
              <Icone d={choisi.origine === 'existant' && choisi.garde === false ? I.garder : I.retirer} />
            </button>
          </div>
        )}
      </div>
      <div className="mc-piece__voile" aria-hidden="true" />
      <Marque label={ts.boutique} />

      <header className="mc-piece__tete">
        <p className="mc-piece__nom">{t.marque}</p>
        <p className="mc-mono">{t.service}{bonjour ? ' · ' + bonjour : ''}{demo ? ' · ' + tr.demo.badge : ''}</p>
        <nav className="mc-piece__menu">
          <button type="button" onClick={quitter(onNouvelle)}>{ts.nouvelle}</button>
          {nbPieces > 1 && <button type="button" onClick={quitter(onMesPieces)}>{ts.mesPieces}</button>}
          <button type="button" onClick={quitter(onDeconnexion)}>{demo ? ts.recommencer : t.nav.deconnexion}</button>
        </nav>
      </header>

      {produits && <section className={'mc-station' + (choisi ? ' mc-station--meuble' : '')} key={cleStation} ref={station} aria-live="polite">{contenu}</section>}

      <div className="mc-commandes">
        {cadre && vue === 'dessus' && !choisi && <button type="button" className="mc-segment mc-segment--seul" onClick={ensemble}><span>{ts.ensemble}</span></button>}
        <div className="mc-segment" role="group" aria-label={ts.jour + ' / ' + ts.soir}>
          <button type="button" aria-pressed={!soir} onClick={() => setSoir(false)}>{ts.jour}</button>
          <button type="button" aria-pressed={soir} onClick={() => setSoir(true)}>{ts.soir}</button>
        </div>
        <div className="mc-segment" role="group" aria-label={ts.vueMaquette + ' / ' + ts.vuePhoto}>
          <button type="button" aria-pressed={vue === 'dessus'} onClick={() => setVue('dessus')}>{ts.vueMaquette}</button>
          <button type="button" aria-pressed={vue === 'photo'} onClick={() => { setSelection(null); setVue('photo'); }}>{ts.vuePhoto}</button>
        </div>
      </div>
      <p className="mc-aide">{ts.aide}</p>

      {ficheItem && ficheProduit && (
        <Fiche t={t} lang={lang} p={ficheProduit} produits={produits} onFermer={() => setFiche(null)}
          onEchanger={() => echanger(ficheItem)} onRetirer={() => retirer(ficheItem.id)} />
      )}
      {produits && (
        <Catalogue lang={lang} t={tr} produits={produits} libelles={libelles} dims={piece.modele.dims} exterieur={piece.fonction === 'terrasse'} famille={cat.famille} ouvert={cat.ouvert}
          fermer={() => setCat({ ouvert: false, famille: '', remplace: null })} choisir={choisirProduit} action={cat.remplace ? tr.piece.catalogue.choisir : tr.piece.catalogue.ajouter} />
      )}
      {rendu && (
        <Rendu key={rendu.n} t={t} piece={{ ...piece, agencement: items }} rendus={rendus} setRendus={setRendus} credits={credits} setCredits={setCredits}
          capturer={capturer} avant={vider} demarrer={rendu.demarrer} fermer={fermerRendu} />
      )}
      {toast && <div key={toast.n} className="mc-toast" role="status">{toast.texte}</div>}
    </div>
  );
}

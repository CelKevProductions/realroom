'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import { ApercuPlan } from '@/components/piece/PlanPiece.js';
import { depuisScan, VERSION_SCAN, MAX_SCAN_OCTETS } from '@/lib/scan.js';
import s from './Acquisition.module.css';

const textes = {
  fr: { titre: 'Comment relever votre pièce ?', intro: 'Un scan apporte une échelle métrique. Le plan et les éléments détectés restent à vérifier.',
    photos: 'Photos guidées', android: 'Android · ARCore', apple: 'Apple · LiDAR',
    androidIntro: 'Dans Chrome sur un Android compatible ARCore, pointez les quatre coins au sol, dans l’ordre, en faisant le tour d’une pièce rectangulaire.',
    androidLimite: 'Ce relevé mesure le contour. Il ne reconnaît ni les meubles ni les portes : ajoutez-les ensuite dans le plan.',
    indisponible: 'AR indisponible ici. Utilisez Chrome sur un Android compatible, avec Google Play Services for AR et une connexion HTTPS, ou importez un relevé.',
    verification: 'Vérification de la compatibilité…', hauteur: 'Hauteur mesurée sous plafond (m, facultatif)', hauteurNote: 'Sans mesure saisie, la hauteur restera estimée à 2,50 m.',
    commencer: 'Démarrer le relevé AR', appleIntro: 'RoomPlan utilise le LiDAR et le machine learning Apple sur l’appareil pour relever murs, ouvertures et mobilier. Il nécessite un iPhone/iPad avec LiDAR et une application native, pas Safari.',
    appleNote: 'L’application de scan RealRoom n’est pas encore disponible au téléchargement. Si vous avez déjà un relevé RealRoom, importez-le ci-dessous. Sinon, commencez avec les photos guidées.',
    appleEtapes: ['Dans le compagnon RealRoom, scannez une seule pièce rectangulaire, bien éclairée, puis touchez Terminer.', 'Choisissez Enregistrer ou partager le relevé, puis Enregistrer dans Fichiers.', 'Importez ce fichier ici, vérifiez les mesures et complétez le plan avant d’aménager.'],
    alternativePhotos: 'Utiliser les photos guidées', vigilance: 'Certains éléments du scan ont une confiance moyenne ou faible. Vérifiez leurs dimensions et leur position dans le plan.',
    importer: 'Importer un relevé métrique', prive: 'Seuls les cotes et les éléments du relevé sont enregistrés. Aucune vidéo AR n’est envoyée.',
    apercu: 'Vérifier avant d’importer', utiliser: 'Utiliser ce plan', fermer: 'Annuler', attente: 'Enregistrement…',
    remplacement: 'Remplacer le plan et l’aménagement actuels. Les photos et les rendus restent conservés.',
    mobilier: 'meuble(s) détecté(s)', ouvertures: 'ouverture(s)', plan: 'Aperçu du plan métrique',
    courant: 'Relevé métrique enregistré — vérifiez le plan avant d’aménager.', rendu: 'La photo d’entrée reste nécessaire uniquement pour votre rendu photo final.',
    coin: 'Coin', instruction: 'Visez le sol dans le coin, puis validez le point. Restez au même niveau de sol.',
    recherche: 'Déplacez doucement le téléphone jusqu’à voir la mire au sol.', valider: 'Valider ce coin', retour: 'Annuler le dernier coin', terminer: 'Vérifier les quatre coins',
    erreur: 'Le relevé n’a pas pu être enregistré. Réessayez.',
    erreurs: { 'scan-format': 'Format invalide : choisissez un export JSON RealRoom, en mètres.', 'scan-repere': 'Le repère du scan est invalide ou les éléments sont inclinés.',
      'scan-dimensions': 'Les cotes sortent des limites du plan : 1,20–30 m au sol, 1,90–8 m sous plafond.',
      'scan-coins': 'Choisissez quatre coins distincts et consécutifs au sol.', 'scan-sol': 'Les points ne sont pas au même niveau de sol. Recommencez en visant le sol.',
      'scan-forme': 'Ce relevé n’est pas rectangulaire. Les pièces en L et murs obliques ne sont pas encore importables ; aucun plan n’a été modifié.',
      'scan-incomplet': 'Il manque un pan du contour. Reprenez le scan de la pièce entière.', 'scan-ouverture': 'Une ouverture dépasse le mur ou le plafond : corrigez le relevé.',
      'scan-objet': 'Un objet se trouve hors de la pièce : vérifiez le relevé.', 'scan-conflit': 'La pièce a changé depuis cet aperçu. Rechargez-la et vérifiez de nouveau le relevé.',
      'scan-remplacement': 'Confirmez le remplacement du plan actuel.', 'ar-suivi': 'Le suivi AR est perdu. Attendez que la mire revienne avant de valider.',
      'ar-refuse': 'La session AR n’a pas démarré. Vérifiez la compatibilité et autorisez la caméra si vous souhaitez scanner.',
      'trop-gros': 'Le relevé dépasse 190 Ko. Exportez uniquement une pièce, sans images ni maillage.', 'limite-mc': 'Le nombre de relevés inclus dans votre compte Maison Corleone est atteint.' } },
  en: { titre: 'How would you like to survey your room?', intro: 'A scan provides metric scale. Check the plan and detected elements before use.',
    photos: 'Guided photos', android: 'Android · ARCore', apple: 'Apple · LiDAR',
    androidIntro: 'In Chrome on an ARCore-compatible Android, mark four floor corners in order around a rectangular room.',
    androidLimite: 'This survey measures the outline. It does not recognise furniture or openings: add them in the room plan.',
    indisponible: 'AR unavailable here. Use Chrome on a compatible Android with Google Play Services for AR and HTTPS, or import a survey.',
    verification: 'Checking compatibility…', hauteur: 'Measured ceiling height (m, optional)', hauteurNote: 'Without a measurement, height stays estimated at 2.50 m.',
    commencer: 'Start AR survey', appleIntro: 'RoomPlan uses on-device Apple machine learning and LiDAR to survey walls, openings and furniture. It requires an iPhone/iPad with LiDAR and a native app, not Safari.',
    appleNote: 'The RealRoom scanning app is not available to download yet. If you already have a RealRoom survey, import it below. Otherwise, start with guided photos.',
    appleEtapes: ['In the RealRoom companion, scan one well-lit rectangular room, then tap Terminer (Finish).', 'Choose Enregistrer ou partager le relevé (Save or share), then Save to Files.', 'Import that file here, check measurements and complete the plan before furnishing.'],
    alternativePhotos: 'Use guided photos', vigilance: 'Some scanned elements have medium or low confidence. Check their dimensions and position in the plan.',
    importer: 'Import a metric survey', prive: 'Only dimensions and survey elements are saved. No AR video is uploaded.',
    apercu: 'Check before importing', utiliser: 'Use this plan', fermer: 'Cancel', attente: 'Saving…',
    remplacement: 'Replace the current plan and layout. Photos and renders are kept.', mobilier: 'detected item(s)', ouvertures: 'opening(s)', plan: 'Metric room plan preview',
    courant: 'Metric survey saved — check your plan before furnishing.', rendu: 'The entrance photo is only needed for the final photo render.',
    coin: 'Corner', instruction: 'Aim at the floor corner and confirm. Keep all points on the same floor level.',
    recherche: 'Move your phone slowly until the floor reticle appears.', valider: 'Confirm this corner', retour: 'Undo last corner', terminer: 'Check four corners',
    erreur: 'The survey could not be saved. Please try again.', erreurs: {
      'scan-format': 'Invalid format: choose a RealRoom JSON export in metres.', 'scan-repere': 'Invalid reference frame or tilted elements.',
      'scan-dimensions': 'Room limits: 1.20–30 m on the floor, 1.90–8 m ceiling height.', 'scan-coins': 'Choose four distinct consecutive floor corners.',
      'scan-sol': 'Points are not on the same floor level. Aim at the floor and try again.',
      'scan-forme': 'Non-rectangular survey. L-shaped rooms and angled walls are not supported yet. No plan has been changed.',
      'scan-incomplet': 'The outline is incomplete. Scan the whole room again.', 'scan-ouverture': 'An opening extends beyond its wall or ceiling.',
      'scan-objet': 'An object is outside the room.', 'scan-conflit': 'The room changed after this preview. Reload it and check the survey again.',
      'scan-remplacement': 'Confirm replacement of the current room plan.', 'ar-suivi': 'AR tracking lost. Wait for the reticle before confirming.',
      'ar-refuse': 'AR could not start. Check compatibility and allow camera access if you wish to scan.', 'trop-gros': 'Survey exceeds 190 KB. Export one room without images or mesh.',
      'limite-mc': 'Your Maison Corleone account has reached its included survey limit.' } }
};

export default function Acquisition({ piece, setPiece, assurerPiece, lang = 'fr', onOccupe, onImport, onMode }) {
  const t = textes[lang] || textes.fr;
  const [mode, setMode] = useState('photos'), [compatible, setCompatible] = useState(null);
  const [hauteur, setHauteur] = useState(''), [erreur, setErreur] = useState('');
  const [apercu, setApercu] = useState(null), [remplacer, setRemplacer] = useState(false), [attente, setAttente] = useState(false);
  const [actif, setActif] = useState(false), [etatAR, setEtatAR] = useState({ coins: [], mire: false });
  const racineAR = useRef(null), session = useRef(null), controleur = useRef(null), vivant = useRef(true), occupe = useRef(false);
  const titreApercu = useRef(null);
  const rappels = useRef({}); rappels.current = { onOccupe, onImport };
  const signaler = v => { occupe.current = v; rappels.current.onOccupe?.(v); };
  const message = e => t.erreurs[e?.code || e?.message || e?.erreur] || t.erreur;
  useEffect(() => { if (apercu && !actif) titreApercu.current?.focus(); }, [apercu, actif]);
  useEffect(() => {
    vivant.current = true;
    const root = racineAR.current, prevenir = e => e.preventDefault();
    root.addEventListener('beforexrselect', prevenir);
    if (!isSecureContext || !navigator.xr) setCompatible(false);
    else navigator.xr.isSessionSupported('immersive-ar').then(v => { if (vivant.current) setCompatible(v); }).catch(() => { if (vivant.current) setCompatible(false); });
    return () => {
      vivant.current = false; controleur.current?.detruire(); session.current?.end().catch(() => {});
      root.removeEventListener('beforexrselect', prevenir);
      if (occupe.current) rappels.current.onOccupe?.(false);
    };
  }, []);
  async function arreter() {
    const xr = session.current; session.current = null; controleur.current?.detruire(); controleur.current = null;
    if (xr) await xr.end().catch(() => {});
    if (vivant.current) { setActif(false); signaler(false); }
  }
  function changerMode(m) {
    setMode(m); onMode?.(m); setErreur(''); setApercu(null);
  }
  function preparer(scan) {
    const resultat = depuisScan(scan); // validation locale identique à celle du serveur
    setApercu({ scan, ...resultat, revision: piece?.maj_le }); setRemplacer(false); setErreur('');
  }
  async function importer(fichier) {
    if (!fichier) return;
    setErreur('');
    try {
      if (fichier.size > MAX_SCAN_OCTETS - 10000) throw new Error('trop-gros');
      let scan; try { scan = JSON.parse(await fichier.text()); } catch (_) { throw new Error('scan-format'); }
      preparer(scan);
    } catch (e) { setErreur(message(e)); }
  }
  async function demarrer() {
    if (occupe.current) return;
    setErreur(''); setEtatAR({ coins: [], mire: false }); setActif(true); signaler(true);
    try {
      // requestSession reste dans le geste utilisateur, avant tout import asynchrone lourd.
      const xr = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test', 'dom-overlay'], domOverlay: { root: racineAR.current } });
      if (!vivant.current) { await xr.end(); return; }
      session.current = xr;
      xr.addEventListener('end', () => { session.current = null; controleur.current = null; if (vivant.current) { setActif(false); signaler(false); } }, { once: true });
      const { ouvrirReleveAR } = await import('@/moteur/releveAR.js');
      if (session.current !== xr) return;
      controleur.current = await ouvrirReleveAR(xr, racineAR.current, e => { if (vivant.current) setEtatAR(e); });
    } catch (_) { await arreter(); if (vivant.current) setErreur(t.erreurs['ar-refuse']); }
  }
  async function terminer() {
    try {
      const n = hauteur.trim() ? Number(hauteur.replace(',', '.')) : null;
      preparer({ version: VERSION_SCAN, source: 'android-arcore-webxr', unit: 'm', floorCorners: etatAR.coins, ceilingHeight: n });
      await arreter();
    } catch (e) { setErreur(message(e)); }
  }
  async function enregistrer() {
    if (!apercu || occupe.current || (piece?.modele && !remplacer)) return;
    setAttente(true); setErreur(''); signaler(true);
    try {
      const p = assurerPiece ? await assurerPiece() : piece;
      if (!p?.id) throw new Error('piece');
      const r = await api(`/api/pieces/${p.id}/scan`, { method: 'POST', corps: {
        scan: apercu.scan, remplacer, revision: apercu.revision
      } });
      if (!r.ok) throw r;
      setPiece(r.piece); setApercu(null); rappels.current.onImport?.(r.piece);
    } catch (e) { if (vivant.current) setErreur(message(e)); }
    finally { if (vivant.current) setAttente(false); signaler(false); }
  }
  return <section className={s.acquisition} aria-label={t.titre}>
    <h2>{t.titre}</h2><p>{t.intro}</p>
    {piece?.modele?.capture && <p className={s.succes} role="status">{t.courant}</p>}
    <div className={s.modes} role="group" aria-label={t.titre}>
      {['photos', 'android', 'apple'].map(m => <button type="button" key={m} aria-pressed={mode === m} disabled={actif || attente} onClick={() => changerMode(m)}>{t[m]}</button>)}
    </div>
    {mode === 'android' && <div className={s.options}>
      <p>{t.androidIntro}</p><p className={s.note}>{t.androidLimite}</p>
      <label className={s.champ}><span>{t.hauteur}</span><input type="number" min="1.9" max="8" step=".01" value={hauteur} placeholder="2.50" onChange={e => setHauteur(e.target.value)} /></label>
      <small>{t.hauteurNote}</small>
      <button type="button" className={s.plein} disabled={!compatible || actif || attente} onClick={demarrer}>{t.commencer}</button>
      {compatible !== true && <p className={s.note}>{compatible == null ? t.verification : t.indisponible}</p>}
    </div>}
    {mode === 'apple' && <div className={s.options}>
      <p>{t.appleIntro}</p><p className={s.note}>{t.appleNote}</p>
      <button type="button" disabled={attente} onClick={() => changerMode('photos')}>{t.alternativePhotos}</button>
      <ol>{t.appleEtapes.map(etape => <li key={etape}>{etape}</li>)}</ol>
    </div>}
    {mode !== 'photos' && <><label className={s.importer}><span>{t.importer}</span><input type="file" accept="application/json,.json,.realroom" aria-label={t.importer} disabled={actif || attente} onChange={e => { importer(e.target.files[0]); e.target.value = ''; }} /></label><p className={s.note}>{t.prive}</p></>}
    {apercu && <div className={s.apercu}>
      <h3 ref={titreApercu} tabIndex={-1}>{t.apercu}</h3><p>{apercu.scan.source === 'apple-roomplan' ? 'Apple RoomPlan' : 'Android ARCore'} · {apercu.agencement.length} {t.mobilier} · {apercu.modele.capture.nbOuvertures} {t.ouvertures}</p>
      <ApercuPlan modele={apercu.modele} items={apercu.agencement} label={t.plan} />
      <p className={s.note}>{t.intro}</p>
      {apercu.scan.source === 'apple-roomplan' && [...apercu.scan.walls, ...(apercu.scan.openings || []), ...(apercu.scan.objects || [])].some(e => e.confidence !== 'high') && <p className={s.note}>{t.vigilance}</p>}
      {!apercu.modele.capture.mobilierDetecte && <p className={s.note}>{t.androidLimite}</p>}
      {apercu.modele.dims.sources.hauteur === 'estimation' && <p className={s.note}>{t.hauteurNote}</p>}
      {piece?.modele && <label className={s.confirmer}><input type="checkbox" checked={remplacer} disabled={attente} onChange={e => setRemplacer(e.target.checked)} /><span>{t.remplacement}</span></label>}
      <div className={s.actions}><button type="button" disabled={attente} onClick={() => setApercu(null)}>{t.fermer}</button><button type="button" className={s.plein} disabled={attente || (!!piece?.modele && !remplacer)} onClick={enregistrer}>{attente ? t.attente : t.utiliser}</button></div>
    </div>}
    {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    <p className={s.note}>{t.rendu}</p>
    <div ref={racineAR} className={s.ar} hidden={!actif}>
      <div className={s.commandes}>
        <strong>{t.coin} {Math.min(4, etatAR.coins.length + 1)} / 4</strong><p>{etatAR.mire ? t.instruction : t.recherche}</p>
        {erreur && <p role="alert">{erreur}</p>}
        <div className={s.actions}>
          <button type="button" onClick={arreter}>{t.fermer}</button>
          <button type="button" disabled={!etatAR.coins.length} onClick={() => controleur.current?.annulerCoin()}>{t.retour}</button>
          {etatAR.coins.length < 4 ? <button type="button" disabled={!etatAR.mire} onClick={() => { try { controleur.current?.validerCoin(); setErreur(''); } catch (e) { setErreur(message(e)); } }}>{t.valider}</button>
            : <button type="button" onClick={terminer}>{t.terminer}</button>}
        </div>
      </div>
    </div>
  </section>;
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import { ApercuPlan } from '@/components/piece/PlanPiece.js';
import { depuisScan, normaliserScan, VERSION_SCAN, MAX_SCAN_OCTETS } from '@/lib/scan.js';
import s from './Acquisition.module.css';
import TransfertScan from './TransfertScan.js';

const textes = {
  fr: { titre: 'Comment relever votre pièce ?', intro: 'Un scan apporte une échelle métrique. Le plan et les éléments détectés restent à vérifier.',
    photos: 'Photos guidées', android: 'Android · ARCore', apple: 'Apple · LiDAR',
    androidIntro: 'Dans Chrome sur un Android compatible ARCore, pointez les coins au sol dans l’ordre en faisant le tour de la pièce (3 à 32 coins, y compris les renfoncements). Terminez après le dernier coin, sans repointer le premier.',
    androidLimite: 'Ce relevé mesure le contour. Il ne reconnaît ni les meubles ni les portes : ajoutez-les ensuite dans le plan.',
    indisponible: 'AR indisponible ici. Utilisez Chrome sur un Android compatible, avec Google Play Services for AR et une connexion HTTPS, ou importez un relevé.',
    verification: 'Vérification de la compatibilité…', hauteur: 'Hauteur mesurée sous plafond (m, facultatif)', hauteurNote: 'Sans mesure saisie, la hauteur restera estimée à 2,50 m.',
    commencer: 'Démarrer le relevé AR', appleIntro: 'RoomPlan utilise le LiDAR et le machine learning Apple sur l’appareil pour relever murs, ouvertures et mobilier. Il nécessite un iPhone/iPad avec LiDAR et une application native, pas Safari.',
    appleNote: 'Vous pouvez utiliser une application RoomPlan existante, puis importer son JSON CapturedRoom. Voxelio annonce des scans et exports gratuits avec une limite hebdomadaire. Le format doit être compatible : vérifiez l’aperçu avant de l’utiliser.',
    appleEtapes: ['Dans Voxelio, choisissez Room Scan / Room Plan sur un iPhone ou iPad compatible LiDAR et relevez une seule pièce.', 'Exportez le JSON de la pièce dans Fichiers (pas seulement le modèle USDZ), puis revenez dans cet onglet.', 'Importez ce fichier ici, vérifiez les mesures et complétez le plan avant d’aménager.'],
    alternativePhotos: 'Utiliser les photos guidées', vigilance: 'Certains éléments du scan ont une confiance moyenne ou faible. Vérifiez leurs dimensions et leur position dans le plan.',
    importer: 'Importer un relevé métrique', prive: 'Seuls les cotes et les éléments du relevé sont enregistrés. Aucune vidéo AR n’est envoyée.',
    apercu: 'Vérifier avant d’importer', utiliser: 'Utiliser ce plan', fermer: 'Annuler', attente: 'Enregistrement…',
    remplacement: 'Remplacer le plan et l’aménagement actuels. Les photos et les rendus restent conservés.',
    mobilier: 'meuble(s) détecté(s)', ouvertures: 'ouverture(s)', plan: 'Aperçu du plan métrique',
    courant: 'Relevé métrique enregistré — vérifiez le plan avant d’aménager.', rendu: 'La photo d’entrée reste nécessaire uniquement pour votre rendu photo final.',
    coin: 'Coin', instruction: 'Visez le sol dans le coin, puis validez le point. Restez au même niveau de sol.',
    recherche: 'Déplacez doucement le téléphone jusqu’à voir la mire au sol.', valider: 'Valider ce coin', retour: 'Annuler le dernier coin', terminer: 'Terminer et vérifier le plan',
    erreur: 'Le relevé n’a pas pu être enregistré. Réessayez.',
    erreurs: { 'capture-expire':'Ce lien a expiré ou a déjà été utilisé. Créez un nouveau QR code sur l’ordinateur.', 'scan-format': 'Choisissez le JSON RoomPlan/CapturedRoom ou RealRoom d’une seule pièce, en mètres. Les fichiers USDZ seuls ne sont pas importables.', 'scan-repere': 'Le repère du scan est invalide ou les éléments sont inclinés.',
      'scan-dimensions': 'Les cotes sortent des limites du plan : 1,20–30 m au sol, 1,90–8 m sous plafond.',
      'scan-coins': 'Choisissez 3 à 32 coins distincts et consécutifs au sol.', 'scan-sol': 'Les points ne sont pas au même niveau de sol. Recommencez en visant le sol.',
      'scan-forme': 'Le contour se croise ou est trop petit. Annulez le dernier coin et poursuivez dans l’ordre autour de la pièce.',
      'scan-incomplet': 'Il manque un pan du contour. Reprenez le scan de la pièce entière.', 'scan-ouverture': 'Une ouverture dépasse le mur ou le plafond : corrigez le relevé.',
      'scan-objet': 'Un objet se trouve hors de la pièce : vérifiez le relevé.', 'scan-conflit': 'La pièce a changé depuis cet aperçu. Rechargez-la et vérifiez de nouveau le relevé.',
      'scan-remplacement': 'Confirmez le remplacement du plan actuel.', 'ar-suivi': 'Le suivi AR est perdu. Attendez que la mire revienne avant de valider.',
      'ar-refuse': 'La session AR n’a pas démarré. Vérifiez la compatibilité et autorisez la caméra si vous souhaitez scanner.',
      'trop-gros': 'Le fichier dépasse 5 Mo. Exportez le JSON d’une seule pièce, sans images ni maillage.', 'limite-mc': 'Le nombre de relevés inclus dans votre compte Maison Corleone est atteint.' } },
  en: { titre: 'How would you like to survey your room?', intro: 'A scan provides metric scale. Check the plan and detected elements before use.',
    photos: 'Guided photos', android: 'Android · ARCore', apple: 'Apple · LiDAR',
    androidIntro: 'In Chrome on an ARCore-compatible Android, mark the floor corners in order around the room (3–32 corners, including recesses). Finish after the last corner without repeating the first.',
    androidLimite: 'This survey measures the outline. It does not recognise furniture or openings: add them in the room plan.',
    indisponible: 'AR unavailable here. Use Chrome on a compatible Android with Google Play Services for AR and HTTPS, or import a survey.',
    verification: 'Checking compatibility…', hauteur: 'Measured ceiling height (m, optional)', hauteurNote: 'Without a measurement, height stays estimated at 2.50 m.',
    commencer: 'Start AR survey', appleIntro: 'RoomPlan uses on-device Apple machine learning and LiDAR to survey walls, openings and furniture. It requires an iPhone/iPad with LiDAR and a native app, not Safari.',
    appleNote: 'Use an existing RoomPlan app, then import its CapturedRoom JSON. Voxelio advertises free scans and exports with a weekly allowance. The format must be compatible: check the preview before using it.',
    appleEtapes: ['In Voxelio, choose Room Scan / Room Plan on a LiDAR-compatible iPhone or iPad and scan one room.', 'Save the room JSON to Files (not just the USDZ model), then return to this tab.', 'Import that file here, check measurements and complete the plan before furnishing.'],
    alternativePhotos: 'Use guided photos', vigilance: 'Some scanned elements have medium or low confidence. Check their dimensions and position in the plan.',
    importer: 'Import a metric survey', prive: 'Only dimensions and survey elements are saved. No AR video is uploaded.',
    apercu: 'Check before importing', utiliser: 'Use this plan', fermer: 'Cancel', attente: 'Saving…',
    remplacement: 'Replace the current plan and layout. Photos and renders are kept.', mobilier: 'detected item(s)', ouvertures: 'opening(s)', plan: 'Metric room plan preview',
    courant: 'Metric survey saved — check your plan before furnishing.', rendu: 'The entrance photo is only needed for the final photo render.',
    coin: 'Corner', instruction: 'Aim at the floor corner and confirm. Keep all points on the same floor level.',
    recherche: 'Move your phone slowly until the floor reticle appears.', valider: 'Confirm this corner', retour: 'Undo last corner', terminer: 'Finish and check plan',
    erreur: 'The survey could not be saved. Please try again.', erreurs: {
      'capture-expire':'This link expired or was already used. Create a new QR code on your computer.', 'scan-format': 'Choose one-room RoomPlan/CapturedRoom or RealRoom JSON in metres. USDZ files alone cannot be imported.', 'scan-repere': 'Invalid reference frame or tilted elements.',
      'scan-dimensions': 'Room limits: 1.20–30 m on the floor, 1.90–8 m ceiling height.', 'scan-coins': 'Choose 3–32 distinct consecutive floor corners.',
      'scan-sol': 'Points are not on the same floor level. Aim at the floor and try again.',
      'scan-forme': 'The outline crosses itself or is too small. Undo the last corner and continue in order around the room.',
      'scan-incomplet': 'The outline is incomplete. Scan the whole room again.', 'scan-ouverture': 'An opening extends beyond its wall or ceiling.',
      'scan-objet': 'An object is outside the room.', 'scan-conflit': 'The room changed after this preview. Reload it and check the survey again.',
      'scan-remplacement': 'Confirm replacement of the current room plan.', 'ar-suivi': 'AR tracking lost. Wait for the reticle before confirming.',
      'ar-refuse': 'AR could not start. Check compatibility and allow camera access if you wish to scan.', 'trop-gros': 'File exceeds 5 MB. Export one room JSON without images or mesh.',
      'limite-mc': 'Your Maison Corleone account has reached its included survey limit.' } }
};

export default function Acquisition({ piece, setPiece, assurerPiece, lang = 'fr', onOccupe, onImport, onMode, envoyerScan, mobileSeul=false, modeInitial='photos' }) {
  const t = textes[lang] || textes.fr;
  const [mode, setMode] = useState(modeInitial), [compatible, setCompatible] = useState(null);
  const [hauteur, setHauteur] = useState(''), [erreur, setErreur] = useState('');
  const [apercu, setApercu] = useState(null), [remplacer, setRemplacer] = useState(false), [attente, setAttente] = useState(false);
  const [actif, setActif] = useState(false), [etatAR, setEtatAR] = useState({ coins: [], mire: false });
  const racineAR = useRef(null), session = useRef(null), controleur = useRef(null), vivant = useRef(true), occupe = useRef(false);
  const titreApercu = useRef(null);
  const rappels = useRef({}); rappels.current = { onOccupe, onImport };
  const signaler = v => { occupe.current = v; rappels.current.onOccupe?.(v); };
  const message = e => t.erreurs[e?.code || e?.message || e?.erreur] || t.erreur;
  useEffect(() => {
    if (apercu && !actif) { titreApercu.current?.focus(); titreApercu.current?.scrollIntoView({ block: 'start' }); }
  }, [apercu, actif]);
  useEffect(() => {
    vivant.current = true;
    if(mobileSeul && /iPhone|iPad|iPod/.test(navigator.userAgent)) setMode('apple');
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
    scan = normaliserScan(scan);
    if(new TextEncoder().encode(JSON.stringify(scan)).length>MAX_SCAN_OCTETS-10000) throw new Error('trop-gros');
    const resultat = depuisScan(scan); // validation locale identique à celle du serveur
    setApercu({ scan, ...resultat, revision: piece?.maj_le }); setRemplacer(false); setErreur('');
  }
  async function importer(fichier) {
    if (!fichier) return;
    setErreur('');
    try {
      if (fichier.size > 5e6) throw new Error('trop-gros');
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
      if(envoyerScan){await envoyerScan(apercu.scan);setApercu(null);return;}
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
    {!mobileSeul && <TransfertScan lang={lang} onScan={scan=>{try{preparer(scan);setMode(scan.source==='apple-roomplan'?'apple':'android');onMode?.(scan.source==='apple-roomplan'?'apple':'android');}catch(e){setErreur(message(e));}}}/>}
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
      <p><a href="https://apps.apple.com/app/id6764829442" target="_blank" rel="noopener noreferrer">{lang==='fr'?'Ouvrir Voxelio dans l’App Store':'Open Voxelio in the App Store'}</a> · <a href="https://www.voxelio.app/modes/roomplan-scanner" target="_blank" rel="noopener noreferrer">{lang==='fr'?'Voir le mode et les exports':'View mode and exports'}</a></p>
      <ol>{t.appleEtapes.map(etape => <li key={etape}>{etape}</li>)}</ol>
    </div>}
    {(mode !== 'photos' || mobileSeul) && <><label className={s.importer}><span>{t.importer}</span><input type="file" accept="application/json,.json,.realroom" aria-label={t.importer} disabled={actif || attente} onChange={e => { importer(e.target.files[0]); e.target.value = ''; }} /></label><p className={s.note}>{t.prive}</p></>}
    {apercu && <div className={s.apercu}>
      <h3 ref={titreApercu} tabIndex={-1}>{t.apercu}</h3><p>{apercu.scan.source === 'apple-roomplan' ? 'Apple RoomPlan' : 'Android ARCore'} · {apercu.agencement.length} {t.mobilier} · {apercu.modele.capture.nbOuvertures} {t.ouvertures}</p>
      <ApercuPlan modele={apercu.modele} items={apercu.agencement} label={t.plan} />
      <p className={s.note}>{t.intro}</p>
      {apercu.scan.source === 'apple-roomplan' && [...apercu.scan.walls, ...(apercu.scan.openings || []), ...(apercu.scan.objects || [])].some(e => e.confidence !== 'high') && <p className={s.note}>{t.vigilance}</p>}
      {!apercu.modele.capture.mobilierDetecte && <p className={s.note}>{t.androidLimite}</p>}
      {apercu.modele.dims.sources.hauteur === 'estimation' && <p className={s.note}>{t.hauteurNote}</p>}
      {piece?.modele && <label className={s.confirmer}><input type="checkbox" checked={remplacer} disabled={attente} onChange={e => setRemplacer(e.target.checked)} /><span>{t.remplacement}</span></label>}
      <div className={s.actions}><button type="button" disabled={attente} onClick={() => setApercu(null)}>{t.fermer}</button><button type="button" className={s.plein} disabled={attente || (!!piece?.modele && !remplacer)} onClick={enregistrer}>{attente ? t.attente : envoyerScan ? (lang==='fr'?'Envoyer sur mon ordinateur':'Send to my computer') : t.utiliser}</button></div>
    </div>}
    {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    <p className={s.note}>{t.rendu}</p>
    <div ref={racineAR} className={s.ar} hidden={!actif}>
      <div className={s.commandes}>
        <strong>{t.coin} {etatAR.coins.length + 1} · {etatAR.coins.length} {lang==='fr'?'point(s) relevé(s)':'recorded point(s)'}</strong><p>{etatAR.mire ? t.instruction : t.recherche}</p>
        {etatAR.coins.length>1 && <p>{lang==='fr'?'Dernier mur':'Last wall'} : {Math.hypot(etatAR.coins.at(-1)[0]-etatAR.coins.at(-2)[0],etatAR.coins.at(-1)[2]-etatAR.coins.at(-2)[2]).toFixed(2)} m</p>}
        {erreur && <p role="alert">{erreur}</p>}
        <div className={s.actions}>
          <button type="button" onClick={arreter}>{t.fermer}</button>
          <button type="button" disabled={!etatAR.coins.length} onClick={() => controleur.current?.annulerCoin()}>{t.retour}</button>
          {etatAR.coins.length < 32 && <button type="button" disabled={!etatAR.mire} onClick={() => { try { controleur.current?.validerCoin(); setErreur(''); } catch (e) { setErreur(message(e)); } }}>{t.valider}</button>
            }
          <button type="button" className={s.plein} disabled={etatAR.coins.length<3} onClick={terminer}>{t.terminer}</button>
        </div>
      </div>
    </div>
  </section>;
}

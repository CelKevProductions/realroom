'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '@/components/api.js';
import {reduireImage} from './image.js';
import {vuePourPosition,validerVue,dimensionsCapture} from '@/lib/cadrages.js';
import CameraPhoto from './CameraPhoto.js';
import s from './AnglesRendu.module.css';

// Deux étapes partagées : caméra figée, puis photo ajoutée sans quitter le rendu.
export default function AnglesRendu({lang='fr',piece,onPiece,capturer,lireVue,surVue,disabled=false,avant,onGenerer,cout=1}){
 const fr=lang==='fr',[etape,setEtape]=useState(1),[vue,setVue]=useState(()=>lireVue?.()||null),[apercu,setApercu]=useState(null),[ambiance,setAmbiance]=useState('jour');
 const [photo,setPhoto]=useState(null),[sansPhoto,setSansPhoto]=useState(false),[erreur,setErreur]=useState(''),[attente,setAttente]=useState(false);
 const rappels=useRef({});rappels.current={capturer,lireVue,surVue,avant,onPiece,onGenerer};
 const vivant=useRef(true),verrou=useRef(false);
 useEffect(()=>{vivant.current=true;return()=>{vivant.current=false;};},[]);
 useEffect(()=>{if(vue)return;let annule=false,h,essais=0;function lire(){if(annule)return;const v=rappels.current.lireVue?.();if(v){setVue(v);return;}if(++essais<60)h=setTimeout(lire,150);else setErreur(fr?'Ouvrez la vue Photo avant de préparer le rendu.':'Open Photo view before preparing the render.');}lire();return()=>{annule=true;clearTimeout(h);};},[piece.id,vue,fr]);
 useEffect(()=>{
  if(!vue)return;let annule=false,h,essais=0;setApercu(null);
  const indisponible=()=>setErreur(fr?'Le cadrage n’est pas disponible. Revenez à la vue Photo.':'View unavailable. Return to Photo view.');
  function prendre(){
   if(annule)return;
   try{const image=rappels.current.capturer?.({...dimensionsCapture(vue,640),vue,ambiance});if(image){setApercu(image);return;}if(++essais>=60){indisponible();return;}h=setTimeout(prendre,150);}catch(_){indisponible();}
  }
  prendre();return()=>{annule=true;clearTimeout(h);};
 },[vue,ambiance,piece.agencement,piece.modele,fr]);
 function choisir(v){const cadrage={...v,aspect:v.aspect||vue?.aspect||rappels.current.lireVue?.()?.aspect||4/3};setVue(cadrage);setPhoto(null);setSansPhoto(false);setErreur('');rappels.current.surVue?.(cadrage);}
 function regarder(sens){if(!vue)return;const dx=vue.cx-vue.x,dz=vue.cz-vue.z,a=sens*Math.PI/12;choisir({...vue,cx:vue.x+dx*Math.cos(a)-dz*Math.sin(a),cz:vue.z+dx*Math.sin(a)+dz*Math.cos(a)});}
 async function ajouter(f){
  if(!f||disabled||verrou.current)return;verrou.current=true;setAttente(true);setErreur('');
  try{await rappels.current.avant?.();const {blob,largeur,hauteur}=await reduireImage(f),form=new FormData();form.append('photo',blob,'photo.jpg');form.append('role','rendu');form.append('largeur',String(largeur));form.append('hauteur',String(hauteur));const r=await api(`/api/pieces/${piece.id}/photos`,{method:'POST',formulaire:form});if(!r.ok)throw Error();if(!vivant.current)return;const p=r.piece.photos.find(p=>p.role==='rendu');setPhoto(p);setSansPhoto(false);rappels.current.onPiece?.(r.piece);}
  catch(_){if(vivant.current)setErreur(fr?'La photo n’a pas pu être enregistrée. Utilisez un JPEG, PNG ou WebP et réessayez.':'Could not save photo. Use JPEG, PNG or WebP and try again.');}
  finally{verrou.current=false;if(vivant.current)setAttente(false);}
 }
 async function generer(){
  if(disabled||verrou.current||!vue||(!photo&&!sansPhoto))return;
  verrou.current=true;setAttente(true);setErreur('');
  try{await rappels.current.avant?.();validerVue(piece.modele,vue);const capture=rappels.current.capturer?.({...dimensionsCapture(vue),vue,ambiance});if(!capture)throw Error('capture');await rappels.current.onGenerer?.({capture,vue,ambiance,angle:'libre',photoRole:photo?'rendu':null,sansPhoto:!photo&&sansPhoto});}
  catch(_){if(vivant.current)setErreur(fr?'La génération n’a pas démarré. Vérifiez le cadrage et réessayez.':'Generation did not start. Check the view and try again.');}
  finally{verrou.current=false;if(vivant.current)setAttente(false);}
 }
 const bloque=disabled||attente;
 return <fieldset className={s.angles} disabled={bloque}>
  <legend>{fr?`Étape ${etape} sur 2 · ${etape===1?'Choisir le cadrage':'Photo réelle et lumière'}`:`Step ${etape} of 2 · ${etape===1?'Choose the view':'Real photo and lighting'}`}</legend>
  {!apercu&&!erreur&&<p role="status">{fr?'Préparation de l’aperçu…':'Preparing preview…'}</p>}
  {etape===1?<>
   <p>{fr?'Voici votre cadrage actuel en vue Photo, avec sa position et sa direction. Validez-le pour le rendu, ou revenez dans la pièce pour vous déplacer avec les flèches.':'This is your current Photo view, with its position and direction. Confirm it for the render, or return to the room to move with the arrow keys.'}</p>
   <CameraPhoto modele={piece.modele} lang={lang} surChoisir={choisir} disabled={bloque}/>
   <div className={s.choix}><button type="button" onClick={()=>regarder(-1)} disabled={!vue}>{fr?'← Regarder à gauche':'← Look left'}</button><button type="button" onClick={()=>regarder(1)} disabled={!vue}>{fr?'Regarder à droite →':'Look right →'}</button><button type="button" onClick={()=>choisir(rappels.current.lireVue?.()||vuePourPosition(piece.modele,'entree'))}>{fr?'Reprendre la vue Photo':'Use current Photo view'}</button></div>
   {apercu&&<img className={s.apercu} src={apercu} alt={fr?'Cadrage de la caméra pour le rendu':'Camera framing for the render'}/>}
   <button type="button" className={s.principal} disabled={!apercu||!vue||bloque} onClick={()=>{setEtape(2);setErreur('');}}>{fr?'Valider cet angle →':'Confirm this angle →'}</button>
  </>:<>
   <button type="button" className={s.retour} onClick={()=>{setEtape(1);setErreur('');}}>{fr?'← Modifier le cadrage':'← Change view'}</button>
   <p>{fr?'Placez-vous au même endroit dans votre pièce et prenez une photo dans la même direction. Les autres photos de la chambre complètent la référence.':'Stand at the same spot in your room and take a photo looking in the same direction. Other room photos provide extra context.'}</p>
   <div className={s.references}>{apercu&&<img src={apercu} alt={fr?'Angle 3D validé':'Confirmed 3D angle'}/>}<div className={s.depot} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();ajouter(e.dataTransfer.files[0]);}}>{photo?<img src={photo.url} alt={fr?'Photo réelle du même angle':'Real photo from the same angle'}/>:<p>{fr?'Déposez votre photo ici':'Drop your photo here'}</p>}<label className={s.photo}>{photo?(fr?'Remplacer la photo':'Replace photo'):(fr?'Choisir une photo':'Choose a photo')}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={fr?'Photo réelle pour ce rendu':'Real photo for this render'} onChange={e=>{ajouter(e.target.files[0]);e.target.value='';}}/></label><label className={s.photo}>{fr?'Prendre une photo':'Take a photo'}<input type="file" accept="image/*" capture="environment" aria-label={fr?'Prendre une photo du même angle':'Take a photo from the same angle'} onChange={e=>{ajouter(e.target.files[0]);e.target.value='';}}/></label>{photo&&<button type="button" className={s.retour} onClick={()=>setPhoto(null)}>{fr?'Ne pas utiliser cette photo':'Do not use this photo'}</button>}</div></div>
   {!photo&&<label className={s.sansPhoto}><input type="checkbox" checked={sansPhoto} onChange={e=>setSansPhoto(e.target.checked)}/><span>{fr?'Continuer sans prendre de photo':'Continue without taking a photo'}</span></label>}
   {sansPhoto&&!photo&&<p className={s.avertissement} role="status">{fr?'Sans photo de cet angle, le rendu peut être moins réaliste et moins fidèle aux matériaux et aux détails de votre pièce.':'Without a photo from this angle, the render may be less realistic and less faithful to your room’s materials and details.'}</p>}
   <div className={s.choix} role="group" aria-label={fr?'Lumière du rendu':'Render lighting'}>{['jour','nuit'].map(a=><button type="button" key={a} aria-pressed={ambiance===a} onClick={()=>setAmbiance(a)}>{a==='jour'?(fr?'Jour':'Day'):(fr?'Nuit':'Night')}</button>)}</div>
   <button type="button" className={s.principal} disabled={bloque||(!photo&&!sansPhoto)||!apercu} onClick={generer}>{fr?`Générer une photo · ${cout} crédit${cout>1?'s':''}`:`Generate one photo · ${cout} credit${cout>1?'s':''}`}</button>
   <p>{fr?'Une seule photo est générée à la fois.':'One photo is generated at a time.'}</p>
  </>}
  {attente&&<p role="status">{fr?'Préparation…':'Preparing…'}</p>}{erreur&&<p role="alert">{erreur}</p>}
 </fieldset>;
}

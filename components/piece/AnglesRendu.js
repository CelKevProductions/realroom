'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '@/components/api.js';
import {reduireImage} from './image.js';
import {ANGLES_RENDU} from '@/lib/cadrages.js';
import s from './AnglesRendu.module.css';
const noms={fr:{entree:'Depuis l’entrée',fond:'Depuis le fond',gauche:'Depuis la gauche',droite:'Depuis la droite'},en:{entree:'From entrance',fond:'From back',gauche:'From left',droite:'From right'}};
export default function AnglesRendu({lang='fr',piece,onPiece,angle,setAngle,capturer,disabled=false,avant}){
 const fr=lang==='fr',[apercu,setApercu]=useState(null),[erreur,setErreur]=useState(''),[attente,setAttente]=useState(false);
 const photo=piece.photos?.find(p=>p.role===angle);
 const captureRef=useRef(capturer);captureRef.current=capturer;
 useEffect(()=>{let fini=false;const h=setTimeout(()=>{if(!fini)setApercu(captureRef.current?.({largeur:640,hauteur:480,angle})||null);},150);return()=>{fini=true;clearTimeout(h);};},[angle,piece.modele,piece.agencement]);
 async function ajouter(f){if(!f)return;setAttente(true);setErreur('');try{await avant?.();const {blob,largeur,hauteur}=await reduireImage(f),form=new FormData();form.append('photo',blob,'photo.jpg');form.append('role',angle);form.append('largeur',String(largeur));form.append('hauteur',String(hauteur));const r=await api(`/api/pieces/${piece.id}/photos`,{method:'POST',formulaire:form});if(!r.ok)throw Error();onPiece?.(r.piece);}catch(_){setErreur(fr?'La photo n’a pas pu être enregistrée. Réessayez.':'Could not save photo. Try again.');}finally{setAttente(false);}}
 return <fieldset className={s.angles}><legend>{fr?'Choisir l’angle de la photo':'Choose the photo angle'}</legend><div className={s.choix}>{ANGLES_RENDU.map(a=><button type="button" key={a} disabled={disabled||attente} aria-pressed={angle===a} onClick={()=>setAngle(a)}>{(noms[lang]||noms.fr)[a]}</button>)}</div>{apercu&&<img className={s.apercu} src={apercu} alt={fr?'Aperçu du cadrage 3D choisi':'Chosen 3D viewpoint preview'}/>}<p>{fr?'Le cadrage est approximatif. Une photo prise depuis la même vue sert de référence pour préserver la pièce.':'Framing is approximate. A photo from the same view helps preserve your room.'}</p><label className={s.photo}>{photo?(fr?'Remplacer la photo de cette vue':'Replace this view’s photo'):(fr?'Ajouter la photo de cette vue':'Add this view’s photo')}<input type="file" accept="image/*" aria-label={fr?'Photo de cette vue':'Photo for this view'} disabled={disabled||attente} onChange={e=>{ajouter(e.target.files[0]);e.target.value='';}}/></label>{attente&&<p role="status">{fr?'Enregistrement…':'Saving…'}</p>}{erreur&&<p role="alert">{erreur}</p>}</fieldset>;
}

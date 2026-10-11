'use client';
import {useEffect,useRef} from 'react';
import {POSITIONS_PHOTO,NOMS_VUES,vuePourPosition} from '@/lib/cadrages.js';
import s from './AnglesRendu.module.css';
export default function CameraPhoto({modele,lang='fr',surChoisir,surMouvement,disabled=false}){
 const rappel=useRef(surMouvement),minuteur=useRef();rappel.current=surMouvement;
 useEffect(()=>()=>{clearTimeout(minuteur.current);rappel.current?.(null);},[]);
 const commandes=[['↑',lang==='fr'?'Avancer':'Move forward',{avant:1}],['←',lang==='fr'?'Aller à gauche':'Move left',{droite:-1}],['↓',lang==='fr'?'Reculer':'Move backward',{avant:-1}],['→',lang==='fr'?'Aller à droite':'Move right',{droite:1}]];
 return <div className={s.camera}>
  <label className={s.position}><span>{lang==='fr'?'Se déplacer dans la pièce':'Move around the room'}</span><select aria-label={lang==='fr'?'Position de la caméra':'Camera position'} disabled={disabled} defaultValue="" onChange={e=>{if(e.target.value)surChoisir(vuePourPosition(modele,e.target.value));e.target.value='';}}><option value="">{lang==='fr'?'Choisir un côté ou un coin':'Choose a side or corner'}</option>{POSITIONS_PHOTO.map(p=><option key={p} value={p}>{(NOMS_VUES[lang]||NOMS_VUES.fr)[p]}</option>)}</select></label>
  {surMouvement&&<div className={s.navigation} role="group" aria-label={lang==='fr'?'Déplacer la caméra':'Move camera'}>{commandes.map(([icone,label,commande])=><button key={icone} type="button" aria-label={label} title={label} disabled={disabled}
   onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);clearTimeout(minuteur.current);surMouvement(commande);}}
   onPointerUp={()=>surMouvement(null)} onPointerCancel={()=>surMouvement(null)} onLostPointerCapture={()=>surMouvement(null)} onBlur={()=>surMouvement(null)}
   onClick={e=>{if(e.detail===0){surMouvement(commande);clearTimeout(minuteur.current);minuteur.current=setTimeout(()=>rappel.current?.(null),120);}}}>{icone}</button>)}</div>}
 </div>;
}

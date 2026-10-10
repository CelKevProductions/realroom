'use client';
import {POSITIONS_PHOTO,NOMS_VUES,vuePourPosition} from '@/lib/cadrages.js';
import s from './AnglesRendu.module.css';
export default function CameraPhoto({modele,lang='fr',surChoisir,disabled=false}){
 return <label className={s.position}><span>{lang==='fr'?'Se déplacer dans la pièce':'Move around the room'}</span><select aria-label={lang==='fr'?'Position de la caméra':'Camera position'} disabled={disabled} defaultValue="" onChange={e=>{if(e.target.value)surChoisir(vuePourPosition(modele,e.target.value));e.target.value='';}}><option value="">{lang==='fr'?'Choisir un côté ou un coin':'Choose a side or corner'}</option>{POSITIONS_PHOTO.map(p=><option key={p} value={p}>{(NOMS_VUES[lang]||NOMS_VUES.fr)[p]}</option>)}</select></label>;
}

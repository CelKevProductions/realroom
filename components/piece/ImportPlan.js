'use client';
// L'analyse DXF reste dans le navigateur ; seul le plan sélectionné est transmis.
import {useEffect,useState,useRef} from 'react';
import {ApercuPlan} from './PlanPiece.js';
import { parseDXF } from '@/lib/dxf.mjs';
import { modelFromRoom } from '@/lib/design-adapter.mjs';
import { openingFrame, signedArea } from '@/lib/geometry.mjs';
import s from './Acquisition.module.css';

export default function ImportPlan({lang='fr',onScan,disabled=false}){
 const request=useRef(0);useEffect(()=>()=>{request.current++;},[]);
 const fr=lang==='fr',[brut,setBrut]=useState(null),[unite,setUnite]=useState(''),[pieces,setPieces]=useState([]),[choisi,setChoisi]=useState('0'),[erreur,setErreur]=useState(''),[attente,setAttente]=useState(false),[layers,setLayers]=useState([]),[mapping,setMapping]=useState({}),[warnings,setWarnings]=useState([]);
 function lire(texte,u='',map=mapping){try{const r=parseDXF(texte,{unit:u||undefined,...map});setLayers(r.layers);setWarnings(r.warnings);setUnite(r.units||'');setChoisi('0');setErreur('');setPieces(r.rooms.map((room,i)=>{
  if(room.polygon.length>32)throw Error('Le plan dépasse 32 sommets. Simplifiez le contour avant de l’importer dans cet éditeur.');
  const scan={version:'realroom-scan-v1',source:'plan-dxf',unit:'m',floorCorners:room.polygon.map(([x,z])=>[x,0,z]),ceilingHeight:null,openings:room.openings.map(o=>{const f=openingFrame(room,o);return {type:o.type==='door'?'porte':'fenetre',a:f.a,b:f.b};})};
  return {id:String(i),nom:room.name,surface:Math.abs(signedArea(room.polygon)).toFixed(2),modele:modelFromRoom(room),scan};
 }));}catch(e){setPieces([]);setErreur(e.message);}}
 async function ouvrir(f){if(!f)return;const token=++request.current;setErreur('');setPieces([]);setBrut(null);setLayers([]);setMapping({});setUnite('');setAttente(true);try{if(f.size>8e6)throw Error('Le DXF doit peser moins de 8 Mo.');const texte=await f.text();if(token!==request.current)return;setBrut(texte);lire(texte,'',{});}catch(e){if(token===request.current)setErreur(e.message);}finally{if(token===request.current)setAttente(false);}}
 const p=pieces.find(p=>p.id===choisi);
 return <div className={s.options}>
  <label className={s.importer}><span>{fr?'Déposer un plan DXF':'Upload a DXF floor plan'}</span><input type="file" accept=".dxf,application/dxf,image/vnd.dxf" aria-label={fr?'Déposer un plan DXF':'Upload a DXF floor plan'} disabled={disabled} onChange={e=>{ouvrir(e.target.files[0]);e.target.value='';}}/></label>
  {attente&&<p role="status">{fr?'Lecture du plan DXF…':'Reading the DXF floor plan…'}</p>}
  {brut&&<label className={s.champ}><span>{fr?'Unités du fichier':'File units'}</span><select disabled={disabled||attente} value={unite} onChange={e=>{setUnite(e.target.value);if(e.target.value)lire(brut,e.target.value);else{setPieces([]);setErreur('');}}}><option value="">{fr?'Choisir les unités':'Choose units'}</option>{[['m',fr?'mètres (m)':'metres (m)'],['cm',fr?'centimètres (cm)':'centimetres (cm)'],['mm',fr?'millimètres (mm)':'millimetres (mm)'],['ft',fr?'pieds':'feet'],['in',fr?'pouces':'inches']].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>}
  {brut&&!unite&&!erreur&&<p role="status">{fr?'Les unités ne sont pas indiquées dans ce fichier. Choisissez-les pour obtenir les bonnes dimensions.':'This file does not specify units. Choose them to obtain the correct dimensions.'}</p>}
  {layers.length>0&&<details><summary>{fr?'Associer les calques':'Map layers'}</summary>{[['roomLayer','Contour'],['doorLayer','Portes'],['windowLayer','Fenêtres']].map(([key,label])=><label key={key} className={s.champ}><span>{label}</span><select value={mapping[key]||''} onChange={e=>{const next={...mapping,[key]:e.target.value||undefined};setMapping(next);lire(brut,unite,next);}}><option value="">Automatique</option>{layers.map(l=><option key={l}>{l}</option>)}</select></label>)}</details>}
  {warnings.map((w,i)=><p key={i} className={s.note}>{w}</p>)}
  {pieces.length>1&&<label className={s.champ}><span>{fr?'Quelle pièce souhaitez-vous aménager ?':'Which room would you like to furnish?'}</span><select disabled={disabled||attente} value={choisi} onChange={e=>setChoisi(e.target.value)}>{pieces.map(p=><option key={p.id} value={p.id}>{p.nom} · {p.surface} m²</option>)}</select></label>}
  {p&&<><p>{p.nom} · {p.surface} m² · {p.modele.capture.nbOuvertures} {fr?'ouverture(s)':'opening(s)'}</p><ApercuPlan modele={p.modele} label={fr?'Aperçu du plan importé':'Imported floor plan preview'}/><p className={s.note}>{fr?'Vérifiez une cote réelle. Hauteur, mobilier et sens des portes restent à compléter.':'Check a real measurement. Add height, furniture and door swing information.'}</p><button type="button" className={s.plein} disabled={disabled} onClick={()=>onScan(p.scan)}>{fr?'Vérifier cette pièce':'Check this room'}</button></>}
  {erreur&&<p role="alert" className={s.erreur}>{erreur}</p>}
 </div>;
}


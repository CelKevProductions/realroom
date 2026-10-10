'use client';
// L'analyse DXF reste dans le navigateur ; seul le plan sélectionné est transmis.
import {useState} from 'react';
import {ApercuPlan} from './PlanPiece.js';
import {lireDXF} from '@/lib/plans.js';
import s from './Acquisition.module.css';

export default function ImportPlan({lang='fr',onScan,disabled=false}){
 const fr=lang==='fr',[brut,setBrut]=useState(null),[unite,setUnite]=useState(''),[pieces,setPieces]=useState([]),[choisi,setChoisi]=useState('0'),[erreur,setErreur]=useState('');
 function lire(texte,u=null){try{const r=lireDXF(texte,u);setPieces(r.pieces);setUnite(r.unites||'');setChoisi('0');setErreur('');}catch(e){setPieces([]);setErreur(e.code==='plan-courbe'?(fr?'Ce plan contient des murs courbes. Utilisez un contour tracé en segments.':'Curved walls are not supported. Trace a segmented outline.'):fr?'Contour illisible. Utilisez un DXF avec des polylignes fermées et vérifiez les unités.':'Could not read the outline. Use closed DXF polylines and check units.');}}
 async function ouvrir(f){if(!f)return;setErreur('');setPieces([]);setBrut(null);try{if(f.size>5e6)throw Error();const texte=await f.text();setBrut(texte);lire(texte);}catch(_){setErreur(fr?'Choisissez un DXF ASCII de moins de 5 Mo.':'Choose an ASCII DXF smaller than 5 MB.');}}
 const p=pieces.find(p=>p.id===choisi);
 return <div className={s.options}>
  <label className={s.importer}><span>{fr?'Déposer un plan DXF':'Upload a DXF floor plan'}</span><input type="file" accept=".dxf,application/dxf,image/vnd.dxf" aria-label={fr?'Déposer un plan DXF':'Upload a DXF floor plan'} disabled={disabled} onChange={e=>{ouvrir(e.target.files[0]);e.target.value='';}}/></label>
  {brut&&<label className={s.champ}><span>{fr?'Unités du fichier':'File units'}</span><select value={unite} onChange={e=>{setUnite(e.target.value);if(e.target.value)lire(brut,e.target.value);else setPieces([]);}}><option value="">{fr?'Choisir les unités':'Choose units'}</option>{[['m','m'],['cm','cm'],['mm','mm'],['ft',fr?'pieds':'feet'],['in',fr?'pouces':'inches']].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>}
  {pieces.length>1&&<label className={s.champ}><span>{fr?'Quelle pièce souhaitez-vous aménager ?':'Which room would you like to furnish?'}</span><select value={choisi} onChange={e=>setChoisi(e.target.value)}>{pieces.map(p=><option key={p.id} value={p.id}>{p.nom} · {p.surface} m²</option>)}</select></label>}
  {p&&<><p>{p.nom} · {p.surface} m² · {p.modele.capture.nbOuvertures} {fr?'ouverture(s)':'opening(s)'}</p><ApercuPlan modele={p.modele} label={fr?'Aperçu du plan importé':'Imported floor plan preview'}/><p className={s.note}>{fr?'Vérifiez une cote réelle. Hauteur, mobilier et sens des portes restent à compléter.':'Check a real measurement. Add height, furniture and door swing information.'}</p><button type="button" className={s.plein} disabled={disabled} onClick={()=>onScan(p.scan)}>{fr?'Vérifier cette pièce':'Check this room'}</button></>}
  {erreur&&<p role="alert" className={s.erreur}>{erreur}</p>}
 </div>;
}

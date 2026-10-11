'use client';
// L'analyse DXF reste dans le navigateur ; seul le plan sélectionné est transmis.
import {useEffect,useState} from 'react';
import {ApercuPlan} from './PlanPiece.js';
import {lireDXF,creerLecteurDXF,messageErreurDXF} from '@/lib/plans.js';
import s from './Acquisition.module.css';

export default function ImportPlan({lang='fr',onScan,disabled=false}){
 const fr=lang==='fr',[brut,setBrut]=useState(null),[unite,setUnite]=useState(''),[pieces,setPieces]=useState([]),[choisi,setChoisi]=useState('0'),[erreur,setErreur]=useState(''),[attente,setAttente]=useState(false),[lecteur]=useState(creerLecteurDXF);
 useEffect(()=>()=>lecteur.annuler(),[lecteur]);
 function resultat(r){setPieces(r.pieces);setUnite(r.unites||'');setChoisi('0');setErreur('');}
 function lire(texte,u=null){try{resultat(lireDXF(texte,u));}catch(e){setPieces([]);setErreur(messageErreurDXF(e.code,lang));}}
 function ouvrir(f){if(!f)return;setErreur('');setPieces([]);setBrut(null);setUnite('');setAttente(true);lecteur.lire(f,({texte,resultat:r})=>{setBrut(texte);resultat(r);setAttente(false);},e=>{setErreur(messageErreurDXF(e.code,lang));setAttente(false);});}
 const p=pieces.find(p=>p.id===choisi);
 return <div className={s.options}>
  <label className={s.importer}><span>{fr?'Déposer un plan DXF':'Upload a DXF floor plan'}</span><input type="file" accept=".dxf,application/dxf,image/vnd.dxf" aria-label={fr?'Déposer un plan DXF':'Upload a DXF floor plan'} disabled={disabled} onChange={e=>{ouvrir(e.target.files[0]);e.target.value='';}}/></label>
  {attente&&<p role="status">{fr?'Lecture du plan DXF…':'Reading the DXF floor plan…'}</p>}
  {brut&&<label className={s.champ}><span>{fr?'Unités du fichier':'File units'}</span><select disabled={disabled||attente} value={unite} onChange={e=>{setUnite(e.target.value);if(e.target.value)lire(brut,e.target.value);else{setPieces([]);setErreur('');}}}><option value="">{fr?'Choisir les unités':'Choose units'}</option>{[['m',fr?'mètres (m)':'metres (m)'],['cm',fr?'centimètres (cm)':'centimetres (cm)'],['mm',fr?'millimètres (mm)':'millimetres (mm)'],['ft',fr?'pieds':'feet'],['in',fr?'pouces':'inches']].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>}
  {brut&&!unite&&!erreur&&<p role="status">{fr?'Les unités ne sont pas indiquées dans ce fichier. Choisissez-les pour obtenir les bonnes dimensions.':'This file does not specify units. Choose them to obtain the correct dimensions.'}</p>}
  {pieces.length>1&&<label className={s.champ}><span>{fr?'Quelle pièce souhaitez-vous aménager ?':'Which room would you like to furnish?'}</span><select disabled={disabled||attente} value={choisi} onChange={e=>setChoisi(e.target.value)}>{pieces.map(p=><option key={p.id} value={p.id}>{p.nom} · {p.surface} m²</option>)}</select></label>}
  {p&&<><p>{p.nom} · {p.surface} m² · {p.modele.capture.nbOuvertures} {fr?'ouverture(s)':'opening(s)'}</p><ApercuPlan modele={p.modele} label={fr?'Aperçu du plan importé':'Imported floor plan preview'}/><p className={s.note}>{fr?'Vérifiez une cote réelle. Hauteur, mobilier et sens des portes restent à compléter.':'Check a real measurement. Add height, furniture and door swing information.'}</p><button type="button" className={s.plein} disabled={disabled} onClick={()=>onScan(p.scan)}>{fr?'Vérifier cette pièce':'Check this room'}</button></>}
  {erreur&&<p role="alert" className={s.erreur}>{erreur}</p>}
 </div>;
}

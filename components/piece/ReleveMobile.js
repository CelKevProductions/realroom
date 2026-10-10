'use client';
import {useEffect,useState} from 'react';
import Acquisition from './Acquisition.js';

export default function ReleveMobile({lang}) {
  const fr=lang==='fr',[jeton,setJeton]=useState(''),[envoye,setEnvoye]=useState(false);
  useEffect(()=>{const t=new URLSearchParams(location.hash.slice(1)).get('t');if(t)setJeton(t);},[]);
  async function envoyer(scan){
    if(!jeton)throw Error('capture-expire');
    const r=await fetch('/api/transferts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${jeton}`},body:JSON.stringify({scan})});
    const j=await r.json();if(!r.ok)throw {code:j.erreur};setEnvoye(true);
  }
  return <main style={{maxWidth:'55rem',margin:'auto',padding:'1rem',color:'#392D23'}}><h1>RealRoom · {fr?'Relever ma pièce':'Survey my room'}</h1>
    {envoye?<p role="status">{fr?'Relevé envoyé ! Revenez sur votre ordinateur pour vérifier et utiliser le plan.':'Survey sent! Return to your computer to check and use the plan.'}</p>:<><p>{fr?'Le lien reste ouvert pendant votre scan. Sur iPhone, revenez dans cet onglet après avoir enregistré le DXF dans Fichiers.':'Keep this link open during your scan. On iPhone, return to this tab after saving the DXF to Files.'}</p><Acquisition lang={lang} modeInitial="android" envoyerScan={envoyer} mobileSeul/></>}
    <p><a href={`/${lang}/demo`}>{fr?'Essayer aussi le parcours photos':'Try the photo workflow'}</a></p>
  </main>;
}

'use client';
import {useEffect,useRef,useState} from 'react';

export default function TransfertScan({lang='fr',onScan}) {
  const fr=lang==='fr',[ticket,setTicket]=useState(null),[etat,setEtat]=useState(''),[attente,setAttente]=useState(false),vivant=useRef(true),rappel=useRef(onScan);
  rappel.current=onScan;
  useEffect(()=>{vivant.current=true;return()=>{vivant.current=false;};},[]);
  useEffect(()=>{
    if(!ticket)return;let fini=false,timer,requete;
    async function verifier(){
      if(fini)return;
      if(Date.now()>=new Date(ticket.expire_le).getTime()){setEtat(fr?'Lien expiré. Créez un nouveau QR code.':'Link expired. Create a new QR code.');setTicket(null);return;}
      requete=new AbortController();
      try{const r=await fetch('/api/transferts',{cache:'no-store',headers:{Authorization:`Bearer ${ticket.lecture}`},signal:requete.signal}),j=await r.json();
        if(fini)return;
        if(r.ok&&j.scan){rappel.current(j.scan);setEtat(fr?'Relevé reçu. Vérifiez le plan ci-dessous.':'Survey received. Check the plan below.');setTicket(null);await fetch('/api/transferts',{method:'DELETE',headers:{Authorization:`Bearer ${ticket.lecture}`}});return;}
        if(r.status===410){setTicket(null);setEtat(fr?'Lien expiré.':'Link expired.');return;}
        setEtat(fr?'En attente du téléphone…':'Waiting for your phone…');
      }catch(e){if(!fini)setEtat(fr?'Connexion interrompue ; nouvelle tentative…':'Connection interrupted; retrying…');}
      if(!fini)timer=setTimeout(verifier,2500);
    }
    verifier();return()=>{fini=true;clearTimeout(timer);requete?.abort();};
  },[ticket,fr]);
  async function creer(){setAttente(true);setEtat('');try{const r=await fetch('/api/transferts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang})});const j=await r.json();if(!r.ok)throw Error();if(vivant.current)setTicket(j);}catch(_){if(vivant.current)setEtat(fr?'Impossible de créer le lien. Réessayez.':'Could not create link. Try again.');}finally{if(vivant.current)setAttente(false);}}
  async function annuler(){const t=ticket;setTicket(null);setEtat('');if(t)await fetch('/api/transferts',{method:'DELETE',headers:{Authorization:`Bearer ${t.lecture}`}}).catch(()=>{});}
  return <div>
    <button type="button" disabled={attente} onClick={creer}>{attente?(fr?'Préparation…':'Preparing…'):(fr?'Scanner avec mon téléphone · QR code':'Scan with my phone · QR code')}</button>
    {ticket&&<div><p>{fr?'Scannez ce QR code avec votre téléphone. Android : relevez les coins. iPhone LiDAR : importez le JSON de votre application de scan, puis envoyez-le ici.':'Scan this QR code on your phone. Android: record corners. iPhone LiDAR: import your scanning app’s JSON, then send it here.'}</p><img src={ticket.qr} width="256" height="256" alt={fr?'QR code vers le relevé sur téléphone':'QR code for phone survey'} style={{maxWidth:'100%',display:'block'}}/><p><a href={ticket.lien} target="_blank" rel="noopener noreferrer">{fr?'Ouvrir le lien sur ce téléphone':'Open link on this phone'}</a></p><p><small>{fr?'Lien privé valable 15 minutes, un seul envoi. Ne le partagez pas. Seules les données métriques transitent ; aucun accès à votre compte.':'Private link valid for 15 minutes, one submission. Keep it private. Metric data only; no account access.'}</small></p><button type="button" onClick={annuler}>{fr?'Annuler ce lien':'Cancel this link'}</button></div>}
    <p role="status">{etat}</p>
  </div>;
}

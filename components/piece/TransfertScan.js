'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import s from './Acquisition.module.css';

export default function TransfertScan({lang='fr',onScan,automatique=false}) {
  const fr=lang==='fr',[ticket,setTicket]=useState(null),[etat,setEtat]=useState(''),[attente,setAttente]=useState(false),vivant=useRef(true),rappel=useRef(onScan);
  rappel.current=onScan;
  const ticketRef=useRef(null);ticketRef.current=ticket;
  useEffect(()=>{vivant.current=true;return()=>{vivant.current=false;const t=ticketRef.current;if(t)fetch('/api/transferts',{method:'DELETE',headers:{Authorization:`Bearer ${t.lecture}`}}).catch(()=>{});};},[]);
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
  const creer=useCallback(async()=>{setAttente(true);setEtat('');try{const r=await fetch('/api/transferts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang})});const j=await r.json();if(!r.ok)throw Error();if(vivant.current)setTicket(j);else fetch('/api/transferts',{method:'DELETE',headers:{Authorization:`Bearer ${j.lecture}`}}).catch(()=>{});}catch(_){if(vivant.current)setEtat(fr?'Impossible de créer le lien. Réessayez.':'Could not create link. Try again.');}finally{if(vivant.current)setAttente(false);}},[lang,fr]);
  useEffect(()=>{if(!automatique)return;const h=setTimeout(creer,0);return()=>clearTimeout(h);},[automatique,creer]);
  async function annuler(){const t=ticket;setTicket(null);setEtat('');if(t)await fetch('/api/transferts',{method:'DELETE',headers:{Authorization:`Bearer ${t.lecture}`}}).catch(()=>{});}
  return <aside className={s.qr} aria-label={fr?'Scanner sur mon téléphone':'Scan on my phone'}>
    <h3>{fr?'Continuez sur votre téléphone':'Continue on your phone'}</h3>
    {!ticket&&<button type="button" disabled={attente} onClick={creer}>{attente?(fr?'Préparation du QR…':'Preparing QR…'):(fr?'Afficher le QR code':'Show QR code')}</button>}
    {ticket&&<div><img src={ticket.qr} width="256" height="256" alt={fr?'QR code vers le relevé sur téléphone':'QR code for phone survey'}/><p>{fr?'Scannez pour ouvrir le relevé. Votre téléphone choisit le parcours Android ou Apple.':'Scan to open the survey. Your phone selects the Android or Apple workflow.'}</p><p><a href={ticket.lien} target="_blank" rel="noopener noreferrer">{fr?'Ouvrir le lien':'Open link'}</a></p><p><small>{fr?'Lien privé · 15 minutes · un seul envoi.':'Private link · 15 minutes · one submission.'}</small></p><button type="button" onClick={annuler}>{fr?'Fermer ce lien':'Close link'}</button></div>}
    <p role="status">{etat}</p>
  </aside>;
}

const ZONES_EN = { salon: 'Living', repas: 'Dining', lecture: 'Reading', couchage: 'Sleeping', rangement: 'Storage', travail: 'Work', bain: 'Bath', vasque: 'Washbasin', accueil: 'Entrance', assise: 'Seating', detente: 'Relaxation' };
import { intituleUsage, manquesParEspace } from '@/lib/programme-textes.js';

// Une ligne de composition, le détail uniquement à la demande, dans les deux expériences.
export default function PlanVie({ proposition, langue = 'fr' }) {
  const programme = proposition?.programme, plan = proposition?.planZones;
  if (!programme) return null;
  const en = langue === 'en', zones = plan?.zones || [];
  const densite = proposition.densite;
  const manquants = [...new Set((programme.manquants || []).filter(s => s.obligatoire).map(s => s.usage))];
  const espacesManquants = manquesParEspace(programme, langue);
  const detailsManquants = [...new Set((programme.manquants || []).filter(s => !s.obligatoire && s.couche === 'finition').map(s => s.usage))];
  return (
    <div className="plan-vie">
      {zones.length > 0 && <p className="plan-vie__zones" aria-label={en ? 'Activity areas' : 'Organisation de la pièce'}>{zones.map(z => <span key={z.id}>{en ? ZONES_EN[z.type] || z.type : z.libelle || z.type}</span>)}</p>}
      {densite?.aCompleter && <p role="status" className="plan-vie__densite"><b>{en ? 'Room to complete' : 'Une pièce à compléter'}</b> — {en ? 'The furniture or activity areas do not yet cover this room’s size.' : 'Le mobilier ou les espaces de vie ne couvrent pas encore les besoins de cette surface.'} {densite.choixExplicites && (en ? 'Your selected areas have been respected.' : 'Tes choix d’espaces ont été respectés.')}</p>}
      {densite?.echelle?.aVerifier && <p className="plan-vie__densite">{en ? 'Check the scale: confirm a room dimension and the openings in the editable plan.' : 'Échelle à vérifier : confirme une cote de la pièce et ses ouvertures dans le plan éditable.'}</p>}
      {espacesManquants.length > 0 && <ul className="plan-vie__manquants" role="status">{espacesManquants.map(z => <li key={z.zone}>
        <b>{z.libelle} {en ? 'incomplete' : 'à compléter'}</b> — {z.pieces}.<br />{en ? 'Reason: ' : 'Motif : '}{z.raisons}.
      </li>)}</ul>}
      {(manquants.length > 0 || detailsManquants.length > 0 || plan?.statut !== 'compose') && <details className="plan-vie__details">
        <summary>{manquants.length ? en ? 'Areas to complete' : 'Ensembles à compléter' : detailsManquants.length ? en ? 'Finishing details' : 'Détails de la pièce' : en ? 'Circulation to check' : 'Circulation à vérifier'}</summary>
        {manquants.length > 0 && <p>{en ? 'Adjust your area choices, seat count or budget when rearranging.' : 'Au prochain réaménagement, ajuste les espaces choisis, le nombre de places ou le budget.'}</p>}
        {detailsManquants.length > 0 && <p>{en ? 'Finishing pieces left out due to budget, mounting height or usable wall space: ' : 'Détails écartés selon le budget, la hauteur de pose ou les murs disponibles : '}{detailsManquants.map(u => intituleUsage(u, langue)).join(', ')}.</p>}
        {plan?.statut !== 'compose' && <p>{en ? 'Check the access paths in the editable plan before confirming.' : 'Vérifiez les accès dans le plan éditable avant de valider.'}</p>}
      </details>}
    </div>
  );
}

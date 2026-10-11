const ZONES_EN = { salon: 'Living', repas: 'Dining', lecture: 'Reading', couchage: 'Sleeping', rangement: 'Storage', travail: 'Work', bain: 'Bath', vasque: 'Washbasin', accueil: 'Entrance', assise: 'Seating', detente: 'Relaxation' };
import { intituleUsage } from '@/lib/programme-textes.js';

// Une ligne de composition, le détail uniquement à la demande, dans les deux expériences.
export default function PlanVie({ proposition, langue = 'fr' }) {
  const programme = proposition?.programme, plan = proposition?.planZones;
  if (!programme) return null;
  const en = langue === 'en', zones = plan?.zones || [];
  const manquants = [...new Set((programme.manquants || []).filter(s => s.obligatoire).map(s => s.usage))];
  return (
    <div className="plan-vie">
      {zones.length > 0 && <p className="plan-vie__zones" aria-label={en ? 'Activity areas' : 'Organisation de la pièce'}>{zones.map(z => <span key={z.id}>{en ? ZONES_EN[z.type] || z.type : z.libelle || z.type}</span>)}</p>}
      {(manquants.length > 0 || plan?.statut !== 'compose') && <details className="plan-vie__details">
        <summary>{manquants.length ? en ? 'Areas to complete' : 'Ensembles à compléter' : en ? 'Circulation to check' : 'Circulation à vérifier'}</summary>
        {manquants.length > 0 && <p>{en ? 'Some pieces need a suitable catalogue product, more space or an adjusted budget: ' : 'Il reste à trouver des produits adaptés, prévoir plus de place ou ajuster le budget : '}{manquants.map(u => intituleUsage(u, langue)).join(', ')}.</p>}
        {plan?.statut !== 'compose' && <p>{en ? 'Check the access paths in the editable plan before confirming.' : 'Vérifiez les accès dans le plan éditable avant de valider.'}</p>}
      </details>}
    </div>
  );
}

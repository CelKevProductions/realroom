'use client';
import { contourDe, segmentsDe, pointOuverture } from '@/lib/contour.js';
import { estMural, estSuspendu } from '@/lib/agencement.js';
import { etatVariantes, signatureBrief } from '@/lib/variation-disposition.js';
import s from './Variantes.module.css';

function MiniPlan({ modele, items, produits }) {
  const contour = contourDe(modele), L = modele.dims.largeur, P = modele.dims.profondeur;
  return <svg viewBox={`${-L / 2 - .12} ${-P / 2 - .12} ${L + .24} ${P + .24}`} aria-hidden="true" focusable="false">
    <polygon points={contour.map(p => p.join(',')).join(' ')} fill="#eee5d7" stroke="#85745f" strokeWidth=".035" />
    {items.filter(it => it.garde !== false).map(it => {
      const p = it.sku ? produits?.[it.sku] : it.p;
      if (!p || estMural(p.fam) || estSuspendu(p.fam)) return null;
      const [w, d] = p.dim, principal = ['lit', 'canape', 'table-repas', 'bureau'].includes(it.usageProgramme);
      return <rect key={it.id} x={-w / 2} y={-d / 2} width={w} height={d} rx=".025"
        transform={`translate(${it.x} ${it.z}) rotate(${-(it.rot || 0) * 180 / Math.PI})`}
        fill={principal ? '#7d8f89' : '#bfae97'} opacity={p.fam === 'tapis' ? .2 : 1} stroke="#786b58" strokeWidth=".018" />;
    })}
    {segmentsDe(modele).flatMap(pan => (modele.murs[pan.id]?.ouvertures || []).map((o, i) => {
      const a = pointOuverture(pan, o.position - o.largeur / 2), b = pointOuverture(pan, o.position + o.largeur / 2);
      return <line key={`${pan.id}-${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={o.type === 'fenetre' ? '#598994' : '#bd8756'} strokeWidth=".09" />;
    }))}
  </svg>;
}

export default function Variantes({ piece, items, produits, demande, lang, attente, onShuffle, onChoisir, onRelancer }) {
  const contexte = etatVariantes(piece, items);
  if (!contexte) return null;
  const fr = lang !== 'en', { etat } = contexte;
  const obsolete = contexte.obsolete || demande && signatureBrief(demande) !== signatureBrief(etat.brief);
  return <section className={s.variantes} aria-label={fr ? 'Propositions d’aménagement' : 'Room layout proposals'} aria-busy={attente}>
    <div className={s.entete}><b>{fr ? 'Propositions' : 'Proposals'}</b>
      <button type="button" className={s.shuffle} onClick={onShuffle} disabled={attente || obsolete}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 5-5m3-4c1-2 2-3 4-3h3m-4-4 4 4-4 4" /></svg>
        Shuffle
      </button>
    </div>
    {obsolete ? <p className={s.aide}>{fr ? 'La pièce ou tes choix ont changé. Relance l’assistant pour créer des propositions adaptées.' : 'The room or your choices have changed. Restart the assistant to create matching proposals.'}
      <button type="button" onClick={onRelancer} disabled={attente}>{fr ? 'Relancer l’assistant' : 'Restart assistant'}</button></p>
      : <><p className={s.aide}>{fr ? 'Explore une autre disposition ou reviens à une proposition.' : 'Explore another layout or return to a proposal.'}</p>
        <div className={s.liste}>
          {etat.liste.map(v => <button type="button" key={v.id} className={s.carte} aria-pressed={v.id === etat.selection}
            disabled={attente || v.id === etat.selection} onClick={() => onChoisir(v.id)}>
            <MiniPlan modele={piece.modele} items={v.agencement} produits={produits} />
            <b>{fr ? 'Proposition' : 'Proposal'} {v.numero}</b>
            <small>{v.proposition.programme?.complet ? (fr ? 'Complète' : 'Complete') : (fr ? 'À compléter' : 'Incomplete')}</small>
            {produits && <small>{new Intl.NumberFormat(fr ? 'fr-FR' : 'en-GB', {style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v.agencement.filter(it=>it.garde!==false&&it.origine==='catalogue').reduce((s,it)=>s+(produits[it.sku]?.prix||0),0))}{v.agencement.some(it=>produits[it.sku]?.generique) ? ' ≈' : ''}</small>}
          </button>)}
        </div></>}
  </section>;
}

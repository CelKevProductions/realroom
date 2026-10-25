'use client';
// Plan d'une pièce dessiné comme un plan d'architecte : sol, murs épais coupés aux ouvertures,
// battants de porte, fenêtres, meubles en symboles (dossier d'un canapé, oreillers d'un lit…).
// Sert à « Voilà ce que j'ai compris », à l'aperçu du nouveau projet et à la page d'attente.
// Unités : le mètre (x vers la droite, z vers le bas), comme lib/contour.js.
// Les classes pv-* permettent aux animations (GSAP) de viser murs, ouvertures et meubles.
import { contourDe, segmentsDe, pointOuverture } from '@/lib/contour.js';
import { estMural, estSuspendu } from '@/lib/agencement.js';
import { estInstallation } from '@/lib/usages.js';
import s from './Nouveau.module.css';

const EP = .11;   // épaisseur des murs dessinés
const f2 = v => Math.round(v * 1000) / 1000;

// cadre du dessin (contour + marge pour les cotes)
export function cadrePlan(modele, marge = .7) {
  const ps = contourDe(modele);
  const xs = ps.map(p => p[0]), zs = ps.map(p => p[1]);
  const x0 = Math.min(...xs) - marge, z0 = Math.min(...zs) - marge;
  return { x0, z0, l: Math.max(...xs) - Math.min(...xs) + 2 * marge, p: Math.max(...zs) - Math.min(...zs) + 2 * marge };
}

// murs : chaque pan est coupé là où il y a une porte, une fenêtre ou un passage
function murs(modele) {
  const traits = [], portes = [], fenetres = [];
  for (const pan of segmentsDe(modele)) {
    const ouv = (modele.murs?.[pan.id]?.ouvertures || []).map(o => {
      const a = pointOuverture(pan, o.position - o.largeur / 2), b = pointOuverture(pan, o.position + o.largeur / 2);
      const ta = (a[0] - pan.a[0]) * pan.d[0] + (a[1] - pan.a[1]) * pan.d[1], tb = (b[0] - pan.a[0]) * pan.d[0] + (b[1] - pan.a[1]) * pan.d[1];
      return { ...o, t0: Math.max(0, Math.min(ta, tb)), t1: Math.min(pan.long, Math.max(ta, tb)) };
    }).sort((u, v) => u.t0 - v.t0);
    const point = t => [pan.a[0] + pan.d[0] * t, pan.a[1] + pan.d[1] * t];
    let t = 0;
    for (const o of ouv) {
      if (o.t0 - t > .01) traits.push([point(t), point(o.t0)]);
      t = Math.max(t, o.t1);
      const a = point(o.t0), b = point(o.t1);
      if (o.type === 'fenetre') fenetres.push({ a, b, n: pan.n });
      else {
        // battant vers l'intérieur, charnière au début de l'ouverture
        const r = o.t1 - o.t0, n = pan.n, bout = [a[0] + n[0] * r, a[1] + n[1] * r];
        portes.push({ a, b, bout, r, passage: o.type === 'passage', balayage: (pan.d[0] * n[1] - pan.d[1] * n[0]) > 0 ? 1 : 0 });
      }
    }
    if (pan.long - t > .01) traits.push([point(t), point(pan.long)]);
  }
  return { traits, portes, fenetres };
}

// symbole d'un meuble dans son repère (largeur w sur x, profondeur d sur y, façade vers +y)
function Symbole({ fam, nom, w, d }) {
  const r = Math.min(.06, w / 6, d / 6);
  const corps = <rect className={s.pvCorps} x={-w / 2} y={-d / 2} width={w} height={d} rx={r} />;
  const ligne = (x1, y1, x2, y2, k) => <line key={k} className={s.pvDetail} x1={f2(x1)} y1={f2(y1)} x2={f2(x2)} y2={f2(y2)} />;
  const n = String(nom || '').toLowerCase();
  if (['canape', 'meridienne', 'fauteuil'].includes(fam)) {
    const dos = Math.min(.2, d * .24), bras = Math.min(.18, w * .14);
    const assises = fam === 'fauteuil' ? 1 : Math.max(2, Math.round((w - 2 * bras) / .65));
    return <>{corps}{ligne(-w / 2, -d / 2 + dos, w / 2, -d / 2 + dos, 'd')}{ligne(-w / 2 + bras, -d / 2 + dos, -w / 2 + bras, d / 2, 'g')}{ligne(w / 2 - bras, -d / 2 + dos, w / 2 - bras, d / 2, 'b')}
      {Array.from({ length: assises - 1 }, (_, i) => { const x = -w / 2 + bras + (w - 2 * bras) * (i + 1) / assises; return ligne(x, -d / 2 + dos, x, d / 2 - .04, 'a' + i); })}</>;
  }
  if (fam === 'lit') {
    const tete = Math.min(.1, d * .06), oreillers = w > 1.25 ? 2 : 1, ow = (w - .12 - (oreillers - 1) * .06) / oreillers;
    return <>{corps}{ligne(-w / 2, -d / 2 + tete, w / 2, -d / 2 + tete, 't')}
      {Array.from({ length: oreillers }, (_, i) => <rect key={i} className={s.pvDetailPlein} x={f2(-w / 2 + .06 + i * (ow + .06))} y={f2(-d / 2 + tete + .05)} width={f2(ow)} height=".26" rx=".05" />)}
      {ligne(-w / 2, -d / 2 + d * .38, w / 2, -d / 2 + d * .38, 'p')}</>;
  }
  if (fam === 'chaise') return <>{corps}{ligne(-w / 2 + .03, -d / 2 + .07, w / 2 - .03, -d / 2 + .07, 'd')}</>;
  if (['tv', 'tv-murale'].includes(fam)) return <rect className={s.pvEcran} x={-w / 2} y={-Math.max(d, .05) / 2} width={w} height={Math.max(d, .05)} rx=".01" />;
  if (fam === 'tapis') return <rect className={s.pvTapis} x={-w / 2} y={-d / 2} width={w} height={d} rx=".03" />;
  if (['plante', 'jardiniere', 'lampadaire', 'lampe'].includes(fam)) { const rr = Math.min(w, d) / 2; return <><circle className={s.pvCorps} r={rr} /><circle className={s.pvDetail} r={rr * .45} /></>; }
  if (fam === 'cuisine') {
    if (/evier|évier|sink/.test(n)) return <>{corps}<rect className={s.pvDetail} x={-w / 2 + .1} y={-d / 2 + .1} width={Math.max(.1, w - .2)} height={Math.max(.1, d - .22)} rx=".05" /></>;
    if (/cuisson|stove|plaque/.test(n)) return <>{corps}{[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v], i) => <circle key={i} className={s.pvDetail} cx={f2(u * w / 4.4)} cy={f2(v * d / 4.4)} r={f2(Math.min(w, d) / 7)} />)}</>;
    return <>{corps}{ligne(-w / 2, -d / 2, w / 2, d / 2, 'x')}</>;
  }
  if (['meuble', 'buffet', 'commode', 'etagere', 'bibliotheque', 'armoire', 'dressing', 'chevet'].includes(fam)) return <>{corps}{ligne(-w / 2 + .03, d / 2 - .05, w / 2 - .03, d / 2 - .05, 'f')}</>;
  return corps;
}

// etat d'un meuble : fixe, deplacable, remplace, installation, propose, neutre
export function etatParDefaut(it) {
  if (it.origine === 'catalogue') return 'propose';
  if (estInstallation(it)) return 'installation';
  return 'neutre';
}

export default function PlanVivant({ modele, items = [], produits, etats = {}, numeros = false, choisi, surChoisir, cotes = true, fantomes = null,
  className = '', label, children }) {
  if (!modele) return null;
  const c = cadrePlan(modele, cotes ? .72 : .3);
  const { traits, portes, fenetres } = murs(modele);
  const contour = contourDe(modele);
  const L = modele.dims.largeur, P = modele.dims.profondeur;
  const fmt = v => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const produitDe = it => (it.sku && produits?.[it.sku]) || it.p;
  const xs = contour.map(p => p[0]), zs = contour.map(p => p[1]);
  const gx = Math.min(...xs), dx = Math.max(...xs), hz = Math.min(...zs), bz = Math.max(...zs);
  // tapis d'abord, puis les meubles ; numéros par-dessus
  const visibles = items.filter(it => it.garde !== false && produitDe(it) && !estSuspendu(produitDe(it).fam));
  const ordre = [...visibles.filter(it => produitDe(it).fam === 'tapis'), ...visibles.filter(it => produitDe(it).fam !== 'tapis')];
  let numero = 0;
  const rangs = new Map(items.filter(it => it.origine === 'existant' && !estInstallation(it)).map(it => [it.id, ++numero]));
  return (
    <svg className={s.pv + (className ? ' ' + className : '')} viewBox={`${f2(c.x0)} ${f2(c.z0)} ${f2(c.l)} ${f2(c.p)}`} role="img" aria-label={label}>
      <polygon className={s.pvSol + ' pv-sol'} points={contour.map(p => p.join(',')).join(' ')} />
      {cotes && <g className={s.pvCotes + ' pv-cote'} aria-hidden="true">
        <line x1={gx} y1={hz - .34} x2={dx} y2={hz - .34} /><line x1={gx} y1={hz - .44} x2={gx} y2={hz - .24} /><line x1={dx} y1={hz - .44} x2={dx} y2={hz - .24} />
        <text x={(gx + dx) / 2} y={hz - .44} textAnchor="middle">{fmt(L)} m</text>
        <line x1={gx - .34} y1={hz} x2={gx - .34} y2={bz} /><line x1={gx - .44} y1={hz} x2={gx - .24} y2={hz} /><line x1={gx - .44} y1={bz} x2={gx - .24} y2={bz} />
        <text x={gx - .44} y={(hz + bz) / 2} textAnchor="middle" transform={`rotate(-90 ${f2(gx - .44)} ${f2((hz + bz) / 2)})`}>{fmt(P)} m</text>
      </g>}
      <g aria-hidden="true">
        {ordre.map(it => {
          const q = produitDe(it), [w, d] = q.dim, mural = estMural(q.fam);
          const etat = etats[it.id] || etatParDefaut(it), n = rangs.get(it.id);
          const clic = surChoisir && it.origine === 'existant' && !estInstallation(it);
          return (
            <g key={it.id} className={`${s.pvMeuble} ${s['pv_' + etat] || ''} ${it.id === choisi ? s.pvChoisi : ''} ${clic ? s.pvClic : ''} pv-meuble`} data-id={it.id} data-fam={q.fam}
              transform={`translate(${f2(it.x)} ${f2(it.z)})`} onClick={clic ? () => surChoisir(it.id) : undefined}>
              <g className="pv-forme" transform={`rotate(${f2(-(it.rot || 0) * 180 / Math.PI)})`}>
                <Symbole fam={q.fam} nom={q.nom} w={w} d={mural ? Math.max(.06, d) : d} />
              </g>
              {numeros && n && <g className={s.pvNumero + ' pv-numero'}><circle r=".17" /><text textAnchor="middle" dominantBaseline="central">{n}</text></g>}
            </g>
          );
        })}
      </g>
      {fantomes}
      <g className={s.pvMurs} aria-hidden="true">
        {traits.map(([a, b], i) => <line key={i} className="pv-mur" x1={f2(a[0])} y1={f2(a[1])} x2={f2(b[0])} y2={f2(b[1])} strokeWidth={EP} />)}
      </g>
      <g aria-hidden="true">
        {fenetres.map((o, i) => (
          <g key={i} className={s.pvFenetre + ' pv-ouverture'}>
            <line x1={f2(o.a[0])} y1={f2(o.a[1])} x2={f2(o.b[0])} y2={f2(o.b[1])} strokeWidth={EP} className={s.pvVitre} />
            <line x1={f2(o.a[0])} y1={f2(o.a[1])} x2={f2(o.b[0])} y2={f2(o.b[1])} className={s.pvMeneau} />
          </g>
        ))}
        {portes.map((o, i) => (
          <g key={i} className={s.pvPorte + ' pv-ouverture'}>
            {!o.passage && <>
              <path className={s.pvBattant} d={`M${f2(o.b[0])} ${f2(o.b[1])}A${f2(o.r)} ${f2(o.r)} 0 0 ${o.balayage} ${f2(o.bout[0])} ${f2(o.bout[1])}`} />
              <line className={s.pvVantail} x1={f2(o.a[0])} y1={f2(o.a[1])} x2={f2(o.bout[0])} y2={f2(o.bout[1])} />
            </>}
          </g>
        ))}
      </g>
      {children}
    </svg>
  );
}

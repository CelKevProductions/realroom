// Ce que le parcours guidé produit, sans React ni réseau (testé dans tests/unitaires) :
// suggestions du catalogue, demande écrite envoyée à l'aménagement, meubles actuels à garder.
import { remplir, FAMILLES_PRIORITE, FAMILLES_PIECE, MOTS_STYLE } from './textes.js';
import { respecteStyle, scoreStyle } from '../../lib/styles.js';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const hache = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; };

// suggestions du catalogue pour la pièce, le style et le budget choisis (variété de familles d'abord)
export function suggerer(produits, { fonction, styles = [], texte = '', budget = 0 }, n = 4) {
  if (!produits) return [];
  const fams = FAMILLES_PIECE[fonction] || FAMILLES_PIECE.salon;
  const dehors = fonction === 'terrasse';
  const envie = [...styles.map(s => s === 'epure' ? 'minimal' : s), texte].join(' ');
  const mots = [...styles.flatMap(s => MOTS_STYLE[s] || []), ...norm(texte).split(/[^a-z0-9]+/).filter(m => m.length > 3)].map(norm).filter(Boolean);
  const liste = Object.values(produits).filter(p => fams.includes(p.fam) && p.vign && respecteStyle(p, envie) && (dehors || !p.ext) && (!budget || !p.prix || p.prix <= budget));
  const score = p => {
    const txt = norm([p.nom, p.titre, p.texte, p.st, p.mat, (p.couleurs || []).join(' '), (p.points || []).map(x => x[1]).join(' ')].join(' '));
    let s = scoreStyle(p, envie);
    for (const m of mots) if (txt.includes(m)) s += 1;
    if (p.look) s += .6;
    return s + hache(p.id) / 1e5;
  };
  const tries = liste.map(p => ({ p, s: score(p) })).sort((a, b) => b.s - a.s);
  const sortie = [], vues = new Set();
  for (const { p } of tries) { if (sortie.length >= n) break; if (vues.has(p.fam)) continue; vues.add(p.fam); sortie.push(p); }
  for (const { p } of tries) { if (sortie.length >= n) break; if (!sortie.includes(p)) sortie.push(p); }
  return sortie;
}

// la demande écrite envoyée à l'aménagement : style, mots du client, priorités, coups de cœur
export function composerEnvies(t, choix, produits) {
  const parts = [];
  const styles = (choix.styles || []).map(id => (t.style.styles.find(s => s[0] === id) || [])[1]).filter(Boolean);
  if (styles.length) parts.push(remplir(t.envies.style, { s: styles.join(', ') }));
  if (choix.texte && choix.texte.trim()) parts.push(choix.texte.trim().replace(/[.\s]*$/, '.'));
  if (choix.notes?.trim()) parts.push(choix.notes.trim().slice(0, 600));
  const prio = choix.priorites || [];
  if (prio.includes('tout')) parts.push(t.envies.tout);
  else if (prio.length) parts.push(remplir(t.envies.priorite, { p: prio.map(k => String(t.priorite.options[k] || k).toLowerCase()).join(', ') }));
  const coups = (choix.coups || []).map(id => produits && produits[id] && produits[id].nom).filter(Boolean);
  if (coups.length) parts.push(remplir(t.envies.coups, { c: coups.join(', ') }));
  return parts.join(' ').slice(0, 1200);
}
// meubles actuels à garder : tous ceux que les priorités ne visent pas (aucun si « tout repenser »)
export function aGarder(piece, choix) {
  const prio = choix.priorites || [];
  if (!prio.length || prio.includes('tout')) return [];
  const fams = new Set(prio.flatMap(k => FAMILLES_PRIORITE[k] || []));
  return (piece.agencement || []).filter(it => it.origine === 'existant' && !fams.has(it.p && it.p.fam)).map(it => it.id);
}

// Configurations éditoriales partagées : préférences visuelles, jamais des règles d'accès.
// Elles ne sont ni des styles appris ni des compositions approuvées par un décorateur.
export const PROFILS = Object.freeze({
  neutre: { mots: [], alignement: .25, complements: 100, tapisLumiere: .3 },
  epure: { motif: /\b(epur\w*|minimal\w*|sobre)\b/, mots: ['minimal', 'epure', 'sobre', 'simple', 'discret', 'ligne droite', 'profil bas'], alignement: .5, complements: -20, tapisLumiere: .2 },
  chaleureux: { motif: /\b(chaleureux|warm|cosy|cozy|convivial\w*)\b/, mots: ['velours', 'bois', 'cognac', 'terracotta', 'doux', 'warm', 'cosy'], alignement: .2, complements: 160, tapisLumiere: 1.2 },
  classique: { motif: /\b(classique|classic|symetri\w*)\b/, mots: ['classique', 'classic', 'bergere', 'chesterfield', 'capitonne', 'laiton'], alignement: .65, complements: 100, tapisLumiere: .4 },
  boheme: { motif: /\b(boheme|bohemian)\b/, mots: ['rotin', 'rattan', 'tresse', 'naturel', 'lin', 'frange'], alignement: .1, complements: 130, tapisLumiere: .8 },
  artdeco: { motif: /\b(art[ -]?deco)\b/, mots: ['art deco', 'laiton', 'brass', 'velours', 'cannel', 'geometrique', 'marbre'], alignement: .6, complements: 110, tapisLumiere: .5 },
  japandi: { motif: /\b(japandi)\b/, mots: ['japandi', 'bois', 'chene', 'oak', 'lin', 'naturel', 'sobre', 'profil bas'], alignement: .45, complements: 30, tapisLumiere: .6 },
  audacieux: { motif: /\b(audacieux|bold|maximal\w*)\b/, mots: ['sculptural', 'colore', 'courbe', 'graphique', 'pop art', 'multicolore'], alignement: .1, complements: 140, tapisLumiere: .4 },
  mediterraneen: { motif: /\b(mediterrane\w*)\b/, mots: ['terracotta', 'rotin', 'lin', 'beige', 'pierre', 'naturel', 'blanc'], alignement: .2, complements: 100, tapisLumiere: .7 },
  scandinave: { motif: /\b(scandinave|scandinavian|nordique|nordic)\b/, mots: ['scandinave', 'scandinavian', 'chene', 'oak', 'bois clair', 'blanc', 'lin', 'sobre'], alignement: .4, complements: 60, tapisLumiere: .6 },
  industriel: { motif: /\b(industriel|industrial)\b/, mots: ['industriel', 'industrial', 'metal', 'acier', 'steel', 'cuir', 'leather', 'noir'], alignement: .4, complements: 60, tapisLumiere: .4 },
  contemporain: { motif: /\b(contemporain\w*|contemporary|moderne|modern)\b/, mots: ['contemporain', 'contemporary', 'moderne', 'courbe', 'ligne pure', 'design'], alignement: .35, complements: 80, tapisLumiere: .5 }
});
export const normaliserStyle = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function stylesDemandes(envies) {
  const texte = normaliserStyle(envies);
  return Object.entries(PROFILS).flatMap(([id, p]) => {
    const m = p.motif?.exec(texte);
    if (!m || /\b(?:sans|pas(?: de)?|not|no|avoid|eviter)\s+(?:style\s+)?$/.test(texte.slice(Math.max(0, m.index - 25), m.index))) return [];
    return [{ id, index: m.index }];
  }).sort((a, b) => a.index - b.index).slice(0, 3).map(p => p.id);
}
export function profilsDe(preferences) {
  const ids = (preferences?.styles?.length ? preferences.styles : [preferences?.style]).filter(id => PROFILS[id]);
  return ids.length ? ids.map(id => PROFILS[id]) : [PROFILS.neutre];
}

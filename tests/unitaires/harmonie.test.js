import test from 'node:test';
import assert from 'node:assert/strict';
import { lab, natureCouleur, affiniteStyles, bilanHarmonie, gainHarmonie, toneBois, finitionMetal, vecteurStyle, statistiquesStyles } from '../../lib/harmonie.js';

// Produits synthétiques : seuls les champs lus par l'harmonie.
let n = 0;
const produit = (fam, cols, extra = {}) => ({ id: 'h' + (++n), nom: fam + ' ' + n, titre: '', fam, cols, couleurs: [], dim: fam === 'canape' ? [2.2, .95, .8] : fam === 'tapis' ? [2, 3, .01] : [.8, .8, .8], mat: '', metal: 'noir', bois: '', st: '', ...extra });

test('couleurs : neutres, naturels et accents', () => {
  assert.equal(natureCouleur(lab('#F1EEE7')), 'neutre');   // écru
  assert.equal(natureCouleur(lab('#35332F')), 'neutre');   // noir chaud
  assert.equal(natureCouleur(lab('#78614D')), 'naturel');  // noyer
  assert.equal(natureCouleur(lab('#D8C6A6')), 'naturel');  // beige
  assert.equal(natureCouleur(lab('#DCCFBA')), 'naturel');  // lin clair
  assert.equal(natureCouleur(lab('#2448C9')), 'accent');   // bleu électrique
  assert.equal(natureCouleur(lab('#D7732E')), 'accent');   // orange
  assert.equal(lab('pas une couleur'), null);
});

test('affinité des styles : symétrique, 1 avec soi-même, bornée', () => {
  assert.equal(affiniteStyles('japandi', 'japandi'), 1);
  assert.equal(affiniteStyles('japandi', 'scandinave'), affiniteStyles('scandinave', 'japandi'));
  assert.ok(affiniteStyles('japandi', 'scandinave') > affiniteStyles('japandi', 'artdeco'));
  assert.equal(affiniteStyles('neutre', 'artdeco'), .7);
});

test('bois et métaux : la valeur « noir » par défaut de l’export ne compte pas', () => {
  assert.equal(toneBois({ bois: 'noyer' }), 'fonce');
  assert.equal(toneBois({ generique: true, mat: 'chêne clair' }), 'clair');
  assert.equal(toneBois({ bois: '', titre: 'Fauteuil en velours' }), null);
  assert.equal(finitionMetal({ metal: 'noir', titre: 'Fauteuil velours' }), null);
  assert.equal(finitionMetal({ metal: 'noir', titre: 'Chaise à structure en acier noir' }), 'noir');
  assert.equal(finitionMetal({ metal: 'laiton', titre: '' }), 'laiton');
});

test('une palette dispersée et des pièces fortes multiples sont pénalisées', () => {
  const chaos = [
    produit('canape', ['#D7732E'], { mat: 'velours' }), produit('fauteuil', ['#2448C9'], { mat: 'velours' }),
    produit('fauteuil', ['#1F9E3A'], { mat: 'velours' }), produit('fauteuil', ['#E5C40F'], { mat: 'velours' }),
    produit('table', ['#C7AD86'], { bois: 'chêne clair' }), produit('meuble', ['#B8874F'], { bois: 'teck' }), produit('meuble', ['#78614D'], { bois: 'noyer' })
  ];
  const b = bilanHarmonie(chaos);
  const ids = b.regles.map(r => r.id);
  assert.ok(ids.includes('accents-trop-nombreux'));
  assert.ok(ids.includes('pieces-fortes'));
  assert.ok(ids.includes('bois-trop-nombreux'));
  assert.ok(b.score < -10);
  assert.ok(b.aRevoir.length > 0 && b.aRevoir.length <= 3);
});

test('une palette resserrée avec un accent répété est valorisée', () => {
  const calme = [
    produit('canape', ['#D8C6A6'], { mat: 'boucle' }), produit('fauteuil', ['#9CAF88'], { mat: 'velours' }),
    produit('pouf', ['#9CAF88'], { mat: 'tissu' }), produit('table', ['#C7AD86'], { bois: 'chêne clair' }),
    produit('tapis', ['#F1EEE7']), produit('lampadaire', ['#35332F'])
  ];
  const b = bilanHarmonie(calme);
  assert.ok(b.regles.some(r => r.id === 'accent-repete'));
  assert.ok(!b.regles.some(r => r.points < 0), JSON.stringify(b.regles));
  assert.ok(b.score > 0);
});

test('deux bois voisins sans être assortis : « presque assortis »', () => {
  const b = bilanHarmonie([produit('table', [], { bois: 'chêne clair' }), produit('meuble', [], { bois: 'teck' })]);
  assert.ok(b.regles.some(r => r.id === 'bois-presque'));
  const contraste = bilanHarmonie([produit('table', [], { bois: 'chêne clair' }), produit('meuble', [], { bois: 'noyer' })]);
  assert.ok(!contraste.regles.some(r => r.id.startsWith('bois')));
});

test('laiton et chrome à égalité : métaux mélangés ; une dominante suffit', () => {
  const egal = bilanHarmonie([produit('suspension', [], { metal: 'laiton' }), produit('fauteuil', [], { metal: 'chrome' })]);
  assert.ok(egal.regles.some(r => r.id === 'metaux-melanges'));
  const domine = bilanHarmonie([produit('suspension', [], { metal: 'laiton' }), produit('applique', [], { metal: 'laiton' }), produit('fauteuil', [], { metal: 'chrome' })]);
  assert.ok(!domine.regles.some(r => r.id === 'metaux-melanges'));
});

test('un style resserré refuse les couleurs vives ; un style audacieux les tolère', () => {
  const salon = [produit('canape', ['#D8C6A6'], { mat: 'boucle' }), produit('fauteuil', ['#2448C9'], { mat: 'velours' }), produit('tapis', ['#F1EEE7'])];
  const japandi = bilanHarmonie(salon, { preferences: { styles: ['japandi'] } });
  const audacieux = bilanHarmonie(salon, { preferences: { styles: ['audacieux'] } });
  assert.ok(japandi.regles.some(r => r.id === 'saturation-hors-style'));
  assert.ok(!audacieux.regles.some(r => r.id === 'saturation-hors-style'));
  assert.ok(audacieux.score > japandi.score);
});

test('le gain d’harmonie préfère le fauteuil qui reprend la palette', () => {
  const base = [produit('canape', ['#D8C6A6'], { mat: 'boucle' }), produit('pouf', ['#9CAF88'], { mat: 'tissu' }), produit('tapis', ['#F1EEE7'])];
  const sauge = produit('fauteuil', ['#9CAF88'], { mat: 'velours' }), bleu = produit('fauteuil', ['#2448C9'], { mat: 'velours' });
  const opts = { preferences: { styles: ['scandinave'] } };
  assert.ok(gainHarmonie(sauge, base, opts) > 0, String(gainHarmonie(sauge, base, opts)));
  assert.ok(gainHarmonie(sauge, base, opts) > gainHarmonie(bleu, base, opts));
  assert.equal(gainHarmonie(null, base, opts), 0);
});

test('style visuel : les scores OpenCLIP sont centrés par style avant d’être utilisés', () => {
  // « contemporain » donne des cosinus plus élevés pour tout le catalogue : ce biais ne doit pas gagner.
  const scores = (j, c) => ({ epure: .17, chaleureux: .17, classique: .17, boheme: .17, artdeco: .17, japandi: j, audacieux: .17, mediterraneen: .17, scandinave: .17, industriel: .17, contemporain: c });
  const cat = {
    a: { id: 'a', fam: 'fauteuil', styleVisuel: { scores: scores(.26, .27) } },
    b: { id: 'b', fam: 'fauteuil', styleVisuel: { scores: scores(.15, .28) } },
    c: { id: 'c', fam: 'fauteuil', styleVisuel: { scores: scores(.16, .27) } }
  };
  const v = vecteurStyle(cat.a, statistiquesStyles(cat));
  assert.ok(v.japandi > v.contemporain, JSON.stringify(v));
  assert.equal(vecteurStyle({ id: 'tv', fam: 'tv' }), null);
});

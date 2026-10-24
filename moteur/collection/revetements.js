import * as THREE from 'three';

const TAILLE = 512;
const TOUR = Math.PI * 2;
const CACHE_MATERIAUX = new Map();
const ORDRE_STYLES = [
  'neutre', 'epure', 'chaleureux', 'classique', 'boheme', 'artdeco',
  'japandi', 'audacieux', 'mediterraneen', 'scandinave', 'industriel', 'contemporain'
];

function definirColoris(id, nom, principale, detail, styles) {
  return { id, nom, couleurs: [principale, detail], styles };
}

const PALETTES = {
  brique: [
    definirColoris('noir', 'Noir mat', '#2A292B', '#494541', ['industriel', 'contemporain']),
    definirColoris('rouge-ancien', 'Rouge ancien', '#98523D', '#D8CFC2', ['industriel', 'chaleureux']),
    definirColoris('blanc-chaux', 'Blanc chaux', '#ECE7DE', '#CFC8BC', ['scandinave', 'mediterraneen']),
    definirColoris('gris-fume', 'Gris fumé', '#716C67', '#AAA197', ['neutre', 'contemporain']),
    definirColoris('terre-rose', 'Terre rosée', '#B87B63', '#D8C8B5', ['boheme', 'mediterraneen']),
    definirColoris('brun', 'Brun chocolat', '#635044', '#B8A692', ['chaleureux', 'industriel'])
  ],
  mineral: [
    definirColoris('sable', 'Sable chaud', '#D3C3A8', '#A6967B', ['japandi', 'mediterraneen']),
    definirColoris('craie', 'Blanc craie', '#E9E3D8', '#C7BFB0', ['epure', 'scandinave']),
    definirColoris('grege', 'Grège', '#B2ABA0', '#8E877D', ['neutre', 'contemporain']),
    definirColoris('terracotta', 'Terracotta', '#B97559', '#8C5946', ['boheme', 'mediterraneen']),
    definirColoris('sauge', 'Vert sauge', '#A0AA94', '#707C67', ['japandi', 'chaleureux']),
    definirColoris('anthracite', 'Anthracite', '#484B49', '#777B76', ['industriel', 'contemporain'])
  ],
  ceramique: [
    definirColoris('ivoire', 'Ivoire', '#EFE7D8', '#CFC6B5', ['neutre', 'classique']),
    definirColoris('sauge', 'Vert sauge', '#A0AD92', '#D8D6C9', ['japandi', 'scandinave']),
    definirColoris('olive', 'Vert olive', '#6E7954', '#B8BAA2', ['chaleureux', 'mediterraneen']),
    definirColoris('terracotta', 'Terracotta', '#B9775D', '#DAC5B0', ['boheme', 'mediterraneen']),
    definirColoris('bleu-profond', 'Bleu profond', '#304F64', '#BFC7C6', ['artdeco', 'audacieux']),
    definirColoris('noir', 'Noir encre', '#292E30', '#6F7775', ['industriel', 'contemporain'])
  ],
  bois: [
    definirColoris('chene-clair', 'Chêne clair', '#C5A47A', '#8E704E', ['japandi', 'scandinave']),
    definirColoris('miel', 'Chêne miel', '#B58A55', '#795A36', ['chaleureux', 'boheme']),
    definirColoris('noyer', 'Noyer', '#805E44', '#4B3528', ['classique', 'artdeco']),
    definirColoris('chene-fume', 'Chêne fumé', '#877360', '#574A3D', ['chaleureux', 'industriel']),
    definirColoris('frene-noir', 'Frêne noir', '#343431', '#171A19', ['epure', 'contemporain']),
    definirColoris('blanchi', 'Bois blanchi', '#DDD2BA', '#A89A7D', ['scandinave', 'mediterraneen'])
  ],
  marbre: [
    definirColoris('blanc', 'Blanc veiné gris', '#E9E6DF', '#888C8B', ['classique', 'epure']),
    definirColoris('creme', 'Crème dorée', '#DACEB6', '#967A54', ['chaleureux', 'artdeco']),
    definirColoris('vert', 'Vert profond', '#385C50', '#CBD2BA', ['artdeco', 'audacieux']),
    definirColoris('noir', 'Noir veiné ivoire', '#292C2E', '#CFC2A7', ['artdeco', 'contemporain']),
    definirColoris('rose', 'Rose poudré', '#D5B3A8', '#967D78', ['boheme', 'audacieux']),
    definirColoris('brun', 'Brun café', '#665247', '#CAB49C', ['chaleureux', 'artdeco'])
  ],
  papier: [
    definirColoris('sauge', 'Écru et sauge', '#E8E1D2', '#7C8D6B', ['japandi', 'boheme']),
    definirColoris('bleu', 'Ivoire et bleu', '#E5DFD1', '#3D596C', ['classique', 'artdeco']),
    definirColoris('terracotta', 'Lin et terracotta', '#E2D3BD', '#AD7058', ['mediterraneen', 'chaleureux']),
    definirColoris('olive', 'Crème et olive', '#E9DFC8', '#6D754E', ['boheme', 'mediterraneen']),
    definirColoris('noir', 'Écru et encre', '#E8E2D7', '#373D3C', ['contemporain', 'audacieux']),
    definirColoris('caramel', 'Sable et caramel', '#E4D3B7', '#9E714C', ['chaleureux', 'artdeco'])
  ],
  textile: [
    definirColoris('ecru', 'Écru naturel', '#D6C9B1', '#A99B83', ['boheme', 'japandi']),
    definirColoris('beige', 'Beige lin', '#BAA68B', '#877660', ['neutre', 'chaleureux']),
    definirColoris('caramel', 'Caramel', '#A77B50', '#735238', ['chaleureux', 'boheme']),
    definirColoris('sauge', 'Sauge grisée', '#99A18A', '#68715D', ['japandi', 'scandinave']),
    definirColoris('chocolat', 'Chocolat', '#685348', '#42382F', ['chaleureux', 'contemporain']),
    definirColoris('bleu', 'Bleu nuit', '#435766', '#2A3945', ['classique', 'artdeco'])
  ],
  liege: [
    definirColoris('naturel', 'Liège naturel', '#B68B5D', '#725638', ['boheme', 'chaleureux']),
    definirColoris('miel', 'Liège miel', '#C49B64', '#8A643B', ['scandinave', 'chaleureux']),
    definirColoris('brun', 'Liège fumé', '#84644A', '#4E392C', ['industriel', 'chaleureux']),
    definirColoris('blanchi', 'Liège blanchi', '#D3C2A0', '#A18C6D', ['japandi', 'scandinave'])
  ],
  vegetal: [
    definirColoris('sous-bois', 'Sous-bois', '#334C35', '#7B9462', ['boheme', 'chaleureux']),
    definirColoris('olive', 'Olive et mousse', '#4D5735', '#9A9E66', ['mediterraneen', 'japandi']),
    definirColoris('foret', 'Forêt profonde', '#233D32', '#547F54', ['contemporain', 'boheme']),
    definirColoris('sauge', 'Sauge argentée', '#64755F', '#B2B79B', ['japandi', 'scandinave'])
  ]
};

function palette(nom, premier) {
  const couleurs = PALETTES[nom];
  return premier
    ? couleurs.filter(c => c.id === premier).concat(couleurs.filter(c => c.id !== premier))
    : couleurs.slice();
}

function variante(id, nom, styles, reglages = {}) {
  return { id, nom, styles, ...reglages };
}

function fiche(id, nom, surfaces, pas, coloris, styles, rugosite, relief, motif, variantes, description) {
  return {
    id, nom, surfaces, pas, couleur: coloris[0].couleurs[0], teintable: true,
    rugosite, metal: 0, relief, styles, stylePrincipal: styles[0],
    coloris, variantes, motif, description
  };
}

const POSES_BRIQUE = [
  variante('decalee', 'Pose décalée', ['industriel', 'chaleureux'], { decalage: 0.5, joint: 0.01 }),
  variante('alignee', 'Pose alignée', ['epure', 'contemporain'], { decalage: 0, joint: 0.007 }),
  variante('patinee', 'Patine ancienne', ['boheme', 'mediterraneen'], { decalage: 0.5, joint: 0.014, patine: 1 })
];

const POSES_LAMES = [
  variante('large', 'Lames larges', ['japandi', 'contemporain'], { rangees: 4, decalage: 0.5 }),
  variante('reguliere', 'Pose au tiers', ['scandinave', 'epure'], { rangees: 3, decalage: 1 / 3 }),
  variante('fine', 'Lames fines', ['classique', 'chaleureux'], { rangees: 6, decalage: 0.5 })
];

const DEFINITIONS = [
  fiche('brique-noire', 'Brique noire', ['mur'], [0.92, 0.6], palette('brique'), ['industriel', 'contemporain'], 0.92, 0.7, 'brique', POSES_BRIQUE, 'Briques noires mates, joints anthracite et grain minéral.'),
  fiche('brique-rouge', 'Brique rouge ancienne', ['mur'], [0.92, 0.6], palette('brique', 'rouge-ancien'), ['industriel', 'chaleureux'], 0.96, 0.8, 'brique', POSES_BRIQUE, 'Briques anciennes nuancées de 22 × 6,5 cm, joints clairs.'),
  fiche('brique-blanche', 'Brique blanche', ['mur'], [0.92, 0.6], palette('brique', 'blanc-chaux'), ['scandinave', 'mediterraneen'], 0.88, 0.65, 'brique', POSES_BRIQUE, 'Briques peintes, grain doux et joints légèrement creusés.'),
  fiche('pierre-apparente', 'Pierre apparente', ['mur'], [1.2, 0.9], palette('mineral'), ['mediterraneen', 'chaleureux'], 0.96, 0.9, 'pierre', [
    variante('moellons', 'Moellons irréguliers', ['mediterraneen', 'boheme'], { rangees: 6, joint: 0.014 }),
    variante('petit-appareil', 'Petites pierres', ['classique', 'chaleureux'], { rangees: 8, joint: 0.012 }),
    variante('grandes-pierres', 'Grandes pierres', ['contemporain', 'epure'], { rangees: 4, joint: 0.008 })
  ], 'Pierres de tailles variées, contours irréguliers et mortier sable.'),
  fiche('beton-brut', 'Béton brut', ['mur'], [1.2, 2.4], palette('mineral', 'grege'), ['industriel', 'contemporain'], 0.89, 0.55, 'beton', [
    variante('banche', 'Banches verticales', ['industriel', 'contemporain'], { orientation: 'verticale' }),
    variante('horizontal', 'Banches horizontales', ['epure', 'contemporain'], { orientation: 'horizontale', pas: [2.4, 1.2] }),
    variante('planches', 'Empreinte de planches', ['industriel', 'chaleureux'], { orientation: 'planches' })
  ], 'Béton banché nuageux, reprises discrètes et trous de tiges.'),
  fiche('beton-cire', 'Béton ciré', ['mur', 'sol'], [1.2, 1.2], palette('mineral', 'grege'), ['epure', 'contemporain'], 0.72, 0.16, 'enduit', [
    variante('lisse', 'Lissé fin', ['epure', 'contemporain'], { nuage: 0.055 }),
    variante('taloche', 'Taloché nuageux', ['japandi', 'chaleureux'], { nuage: 0.12 }),
    variante('mineral', 'Grain minéral', ['industriel', 'mediterraneen'], { nuage: 0.085, grain: 0.07 })
  ], 'Surface continue sans joints, nuances de taloche et fini satiné mat.'),
  fiche('enduit-chaux', 'Enduit à la chaux', ['mur'], [1.2, 1.2], palette('mineral', 'craie'), ['japandi', 'mediterraneen'], 0.98, 0.3, 'enduit', [
    variante('nuageux', 'Chaux nuageuse', ['japandi', 'mediterraneen'], { nuage: 0.14 }),
    variante('brosse', 'Chaux brossée', ['boheme', 'chaleureux'], { nuage: 0.1, brosse: true }),
    variante('argile', 'Argile fine', ['epure', 'chaleureux'], { nuage: 0.075, grain: 0.055 })
  ], 'Enduit mat aux variations douces, teintable sans multiplier une image grise.'),
  fiche('carrelage-metro', 'Carrelage métro', ['mur'], [0.608, 0.308], palette('ceramique'), ['classique', 'industriel'], 0.26, 0.55, 'metro', [
    variante('decale', 'Métro décalé', ['classique', 'industriel'], { colonnes: 4, rangees: 4, decalage: 0.5 }),
    variante('droit', 'Métro aligné', ['epure', 'contemporain'], { colonnes: 4, rangees: 4, decalage: 0 }),
    variante('vertical', 'Métro vertical', ['artdeco', 'contemporain'], { colonnes: 4, rangees: 4, decalage: 0, pas: [0.308, 0.608] })
  ], 'Carreaux de 7,5 × 15 cm, joints de 2 mm et biseaux périphériques.'),
  fiche('zellige', 'Zellige', ['mur'], [0.412, 0.412], palette('ceramique', 'sauge'), ['mediterraneen', 'boheme'], 0.25, 0.45, 'zellige', [
    variante('droit', 'Pose droite artisanale', ['mediterraneen', 'japandi'], { colonnes: 4, rangees: 4, decalage: 0, joint: 0.003 }),
    variante('decale', 'Pose décalée', ['boheme', 'chaleureux'], { colonnes: 4, rangees: 4, decalage: 0.5, joint: 0.003 }),
    variante('joint-large', 'Joints accentués', ['mediterraneen', 'audacieux'], { colonnes: 4, rangees: 4, decalage: 0, joint: 0.006, pas: [0.424, 0.424] })
  ], 'Carreaux émaillés de 10 × 10 cm, teintes et surface irrégulières.'),
  fiche('mosaique', 'Mosaïque', ['mur'], [0.352, 0.352], palette('ceramique'), ['contemporain', 'artdeco'], 0.34, 0.4, 'mosaique', [
    variante('unie', 'Petits carrés nuancés', ['contemporain', 'neutre'], { colonnes: 16, rangees: 16 }),
    variante('damier', 'Damier ton sur ton', ['artdeco', 'classique'], { colonnes: 16, rangees: 16, damier: true }),
    variante('bandes', 'Bandes fines', ['audacieux', 'epure'], { colonnes: 16, rangees: 16, bandes: true })
  ], 'Tesselles de 2 × 2 cm et joints de 2 mm, dessinées en texture.'),
  fiche('marbre-mural', 'Marbre mural', ['mur'], [1.2, 2.4], palette('marbre'), ['classique', 'artdeco'], 0.23, 0.12, 'marbre', [
    variante('fin', 'Veines fines', ['classique', 'epure'], { veines: 5, epaisseur: 0.025 }),
    variante('ample', 'Grandes veines', ['artdeco', 'audacieux'], { veines: 3, epaisseur: 0.07 }),
    variante('arabesque', 'Veines ramifiées', ['chaleureux', 'contemporain'], { veines: 7, epaisseur: 0.04, branches: true })
  ], 'Grandes dalles de 120 × 240 cm et réseau de veines minérales.'),
  fiche('tasseaux-bois', 'Tasseaux de bois', ['mur'], [0.32, 1.2], palette('bois'), ['japandi', 'chaleureux'], 0.78, 0.9, 'tasseaux', [
    variante('regulier', 'Lattes régulières', ['japandi', 'scandinave'], { colonnes: 8, ouverture: 0.28 }),
    variante('large', 'Lattes larges', ['contemporain', 'epure'], { colonnes: 4, ouverture: 0.18 }),
    variante('fin', 'Lattes fines', ['chaleureux', 'artdeco'], { colonnes: 12, ouverture: 0.26 })
  ], 'Lattes verticales veinées et rainures en relief de texture.'),
  fiche('panneau-acoustique', 'Panneau acoustique', ['mur'], [0.32, 1.2], palette('bois').map(c => ({ ...c, couleurs: [c.couleurs[0], '#181B1A'] })), ['contemporain', 'japandi'], 0.85, 0.95, 'tasseaux', [
    variante('regulier', 'Tasseaux sur feutre', ['contemporain', 'japandi'], { colonnes: 8, ouverture: 0.32 }),
    variante('large', 'Larges tasseaux', ['epure', 'chaleureux'], { colonnes: 4, ouverture: 0.2 }),
    variante('fin', 'Rythme fin', ['artdeco', 'scandinave'], { colonnes: 12, ouverture: 0.3 })
  ], 'Tasseaux de bois sur fond de feutre noir, sans géométrie ajoutée.'),
  fiche('boiseries-moulures', 'Boiseries moulurées', ['mur'], [1.2, 1.2], palette('mineral', 'craie'), ['classique', 'artdeco'], 0.63, 0.8, 'moulures', [
    variante('cadre', 'Grand cadre', ['classique', 'epure'], { cadres: 1 }),
    variante('double', 'Double moulure', ['classique', 'artdeco'], { cadres: 1, double: true }),
    variante('soubassement', 'Petits panneaux', ['chaleureux', 'classique'], { cadres: 2 })
  ], 'Panneaux peints avec cadres moulurés simulés par une carte de relief.'),
  fiche('papier-peint-feuillage', 'Papier peint feuillage', ['mur'], [0.64, 0.64], palette('papier'), ['boheme', 'japandi'], 0.94, 0.07, 'feuillage', [
    variante('fin', 'Rameaux fins', ['japandi', 'scandinave'], { branches: 7, taille: 0.075 }),
    variante('ample', 'Grand feuillage', ['boheme', 'audacieux'], { branches: 5, taille: 0.12 }),
    variante('dense', 'Herbier dense', ['chaleureux', 'mediterraneen'], { branches: 13, taille: 0.065 })
  ], 'Rameaux originaux dessinés au canvas, sur fond légèrement fibreux.'),
  fiche('papier-peint-geometrique', 'Papier peint géométrique', ['mur'], [0.64, 0.64], palette('papier', 'bleu'), ['artdeco', 'audacieux'], 0.93, 0.06, 'geometrique', [
    variante('eventails', 'Éventails Art déco', ['artdeco', 'classique'], { dessin: 'eventails' }),
    variante('losanges', 'Losanges fins', ['scandinave', 'contemporain'], { dessin: 'losanges' }),
    variante('arches', 'Arches graphiques', ['audacieux', 'mediterraneen'], { dessin: 'arches' })
  ], 'Motifs géométriques originaux, fins ou amples, sans image importée.'),
  fiche('papier-peint-rayures', 'Papier peint rayé', ['mur'], [0.32, 0.64], palette('papier', 'terracotta'), ['classique', 'chaleureux'], 0.94, 0.05, 'rayures', [
    variante('fines', 'Rayures fines', ['classique', 'scandinave'], { bandes: 16, rapport: 0.2 }),
    variante('larges', 'Rayures larges', ['mediterraneen', 'audacieux'], { bandes: 4, rapport: 0.5 }),
    variante('doubles', 'Rayures jumelées', ['artdeco', 'chaleureux'], { bandes: 8, rapport: 0.18, double: true })
  ], 'Rayures verticales tissées, aux deux couleurs coordonnées.'),
  fiche('liege', 'Liège', ['mur', 'sol'], [0.48, 0.48], palette('liege'), ['chaleureux', 'boheme'], 0.98, 0.35, 'liege', [
    variante('fin', 'Grain fin', ['japandi', 'scandinave'], { cellules: 72 }),
    variante('naturel', 'Écorce naturelle', ['boheme', 'chaleureux'], { cellules: 38 }),
    variante('grossier', 'Fragments larges', ['industriel', 'audacieux'], { cellules: 24 })
  ], 'Aggloméré de liège à particules irrégulières, naturellement mat.'),
  fiche('vegetal', 'Feuillage végétal', ['mur'], [0.72, 0.72], palette('vegetal'), ['boheme', 'contemporain'], 0.79, 0.85, 'vegetal', [
    variante('mixte', 'Feuilles mixtes', ['boheme', 'chaleureux'], { feuilles: 310, forme: 'ovale' }),
    variante('fougeres', 'Fougères fines', ['japandi', 'contemporain'], { feuilles: 440, forme: 'fine' }),
    variante('ample', 'Feuilles larges', ['mediterraneen', 'audacieux'], { feuilles: 180, forme: 'large' })
  ], 'Fond végétal dense avec feuilles et nervures peintes ; silhouette plane.'),
  fiche('parquet-chevron', 'Parquet en chevrons', ['sol'], [0.8485281374, 0.8485281374], palette('bois'), ['classique', 'artdeco'], 0.76, 0.28, 'chevron', [
    variante('classique', 'Point de Hongrie 45°', ['classique', 'artdeco'], { rangees: 6 }),
    variante('fin', 'Chevrons fins', ['japandi', 'scandinave'], { rangees: 8 }),
    variante('large', 'Chevrons larges', ['chaleureux', 'contemporain'], { rangees: 4 })
  ], 'Lames à coupes biaises, rencontre en V et fibres orientées à 45°.'),
  fiche('parquet-baton-rompu', 'Parquet à bâtons rompus', ['sol'], [0.8, 0.8], palette('bois'), ['classique', 'chaleureux'], 0.78, 0.3, 'baton', [
    variante('classique', 'Lames de 10 × 40 cm', ['classique', 'chaleureux'], { longueur: 4 }),
    variante('court', 'Lames de 10 × 30 cm', ['scandinave', 'japandi'], { longueur: 3, pas: [0.6, 0.6] }),
    variante('long', 'Lames de 10 × 60 cm', ['contemporain', 'epure'], { longueur: 6, pas: [1.2, 1.2] })
  ], 'Lames rectangulaires croisées à 90°, distinctes du point de Hongrie.'),
  fiche('parquet-grandes-lames', 'Parquet grandes lames', ['sol'], [1.8, 0.72], palette('bois'), ['scandinave', 'japandi'], 0.8, 0.24, 'lames', POSES_LAMES, 'Chêne clair mat par défaut, lames de 180 × 18 cm et joints fins.'),
  fiche('terrazzo', 'Terrazzo', ['sol'], [0.64, 0.64], palette('mineral', 'craie'), ['contemporain', 'audacieux'], 0.56, 0.12, 'terrazzo', [
    variante('fin', 'Petits éclats', ['epure', 'contemporain'], { cellules: 44 }),
    variante('moyen', 'Éclats moyens', ['artdeco', 'chaleureux'], { cellules: 28 }),
    variante('gros', 'Grands fragments', ['audacieux', 'mediterraneen'], { cellules: 16 })
  ], 'Éclats minéraux polygonaux de tailles variées dans un liant nuancé.'),
  fiche('carreaux-ciment', 'Carreaux de ciment', ['sol'], [0.404, 0.404], palette('papier', 'bleu'), ['classique', 'mediterraneen'], 0.81, 0.16, 'ciment', [
    variante('fleurs', 'Fleurs traditionnelles', ['classique', 'mediterraneen'], { dessin: 'fleurs' }),
    variante('etoiles', 'Étoiles graphiques', ['artdeco', 'audacieux'], { dessin: 'etoiles' }),
    variante('rosaces', 'Rosaces arrondies', ['boheme', 'chaleureux'], { dessin: 'rosaces' })
  ], 'Carreaux de 20 × 20 cm, décors géométriques et joints de 2 mm.'),
  fiche('tomettes', 'Tomettes hexagonales', ['sol'], [0.6, 0.692820323], palette('brique', 'terre-rose'), ['mediterraneen', 'chaleureux'], 0.95, 0.42, 'tomettes', [
    variante('classique', 'Hexagones de 20 cm', ['mediterraneen', 'chaleureux'], { rayon: 0.1 }),
    variante('petites', 'Hexagones de 15 cm', ['classique', 'boheme'], { rayon: 0.075, pas: [0.45, 0.5196152423] }),
    variante('grandes', 'Hexagones de 25 cm', ['contemporain', 'mediterraneen'], { rayon: 0.125, pas: [0.75, 0.8660254038] })
  ], 'Terre cuite hexagonale, nuances de cuisson et joints sable.'),
  fiche('carrelage-grand-format', 'Carrelage grand format', ['sol'], [1.208, 1.204], palette('mineral'), ['epure', 'contemporain'], 0.61, 0.2, 'grand-carreau', [
    variante('droit', '60 × 120 cm droit', ['epure', 'contemporain'], { colonnes: 2, rangees: 1 }),
    variante('horizontal', '120 × 60 cm droit', ['neutre', 'japandi'], { colonnes: 1, rangees: 2, pas: [1.204, 1.208] }),
    variante('decale', '60 × 120 cm décalé', ['chaleureux', 'contemporain'], { colonnes: 2, rangees: 2, decalage: 0.5, pas: [1.208, 2.408] })
  ], 'Dalles minérales de 60 × 120 cm avec joints de 4 mm.'),
  fiche('travertin', 'Travertin', ['sol'], [0.808, 0.808], palette('mineral'), ['mediterraneen', 'japandi'], 0.84, 0.32, 'travertin', [
    variante('veine', 'Coupe veinée', ['mediterraneen', 'chaleureux'], { veine: true }),
    variante('fleur', 'Coupe fleur', ['japandi', 'epure'], { veine: false }),
    variante('rustique', 'Pores accentués', ['boheme', 'classique'], { veine: true, pores: 1.8 })
  ], 'Dalles de 40 × 40 cm, strates calcaires et pores fins.'),
  fiche('moquette-bouclette', 'Moquette bouclée', ['sol'], [0.256, 0.256], palette('textile'), ['chaleureux', 'contemporain'], 1, 0.38, 'bouclette', [
    variante('fine', 'Boucle fine', ['epure', 'scandinave'], { cellules: 64 }),
    variante('large', 'Boucle généreuse', ['chaleureux', 'boheme'], { cellules: 40 }),
    variante('cotelee', 'Boucle côtelée', ['contemporain', 'artdeco'], { cellules: 48, cotes: true })
  ], 'Boucles textiles de 4 à 6 mm ; le volume est simulé en texture.'),
  fiche('jonc-de-mer', 'Jonc de mer', ['sol'], [0.384, 0.384], palette('textile', 'beige'), ['boheme', 'mediterraneen'], 0.97, 0.42, 'jonc', [
    variante('natte', 'Tissage natté', ['boheme', 'mediterraneen'], { cellules: 48, dessin: 'natte' }),
    variante('chevrons', 'Tissage en chevrons', ['chaleureux', 'classique'], { cellules: 48, dessin: 'chevrons' }),
    variante('panier', 'Tressage panier', ['japandi', 'scandinave'], { cellules: 32, dessin: 'panier' })
  ], 'Fibres végétales tressées avec croisements et variations naturelles.'),
  fiche('vinyle-bois', 'Vinyle aspect bois', ['sol'], [1.2, 0.6], palette('bois'), ['neutre', 'contemporain'], 0.68, 0.12, 'lames', [
    variante('decale', 'Lames décalées', ['neutre', 'contemporain'], { rangees: 4, decalage: 0.5 }),
    variante('tiers', 'Lames au tiers', ['scandinave', 'japandi'], { rangees: 3, decalage: 1 / 3 }),
    variante('fine', 'Lames étroites', ['chaleureux', 'epure'], { rangees: 6, decalage: 0.5 })
  ], 'Imitation chêne à grain fin, joints discrets et reflet satiné.'),
  fiche('lambris-plafond', 'Lambris de plafond', ['plafond'], [1.8, 0.56], palette('bois', 'blanchi'), ['chaleureux', 'scandinave'], 0.84, 0.45, 'lames', [
    variante('classique', 'Lames de 14 cm', ['chaleureux', 'scandinave'], { rangees: 4, decalage: 0 }),
    variante('large', 'Lames de 28 cm', ['japandi', 'epure'], { rangees: 2, decalage: 0.5 }),
    variante('fin', 'Lames de 7 cm', ['classique', 'mediterraneen'], { rangees: 8, decalage: 0 })
  ], 'Lames jointives, rainures régulières et veinage longitudinal.')
];

function figer(valeur) {
  if (valeur && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    Object.values(valeur).forEach(figer);
    Object.freeze(valeur);
  }
  return valeur;
}

DEFINITIONS.sort((a, b) => ORDRE_STYLES.indexOf(a.stylePrincipal) - ORDRE_STYLES.indexOf(b.stylePrincipal) || a.id.localeCompare(b.id));

export const REVETEMENTS = figer(Object.fromEntries(DEFINITIONS.map(f => [f.id, f])));

export function listeRevetements(surface) {
  if (!['mur', 'sol', 'plafond'].includes(surface)) {
    throw Error('Surface inconnue : ' + surface);
  }
  return Object.values(REVETEMENTS).filter(f => f.surfaces.includes(surface));
}

function borner(valeur, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, valeur));
}

function modulo(valeur, periode) {
  return ((valeur % periode) + periode) % periode;
}

function lisser(valeur) {
  const borne = borner(valeur);
  return borne * borne * (3 - 2 * borne);
}

function graineDepuis(texte) {
  let graine = 2166136261;
  for (let i = 0; i < texte.length; i++) graine = Math.imul(graine ^ texte.charCodeAt(i), 16777619);
  return graine >>> 0;
}

function hasardDepuis(graine) {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6D2B79F5) >>> 0;
    let valeur = Math.imul(etat ^ (etat >>> 15), etat | 1);
    valeur ^= valeur + Math.imul(valeur ^ (valeur >>> 7), valeur | 61);
    return ((valeur ^ (valeur >>> 14)) >>> 0) / 4294967296;
  };
}

function hacher(x, y, graine) {
  let valeur = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ graine;
  valeur = Math.imul(valeur ^ (valeur >>> 13), 1274126177);
  return ((valeur ^ (valeur >>> 16)) >>> 0) / 4294967296;
}

function couleurHex(couleur) {
  if (typeof couleur !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(couleur)) {
    throw Error('Couleur attendue au format #RRGGBB : ' + couleur);
  }
  return couleur.toUpperCase();
}

function composantes(couleur) {
  const entier = Number.parseInt(couleur.slice(1), 16);
  return [(entier >>> 16) & 255, (entier >>> 8) & 255, entier & 255];
}

function nouveauCanvas() {
  let toile;
  if (typeof OffscreenCanvas !== 'undefined') toile = new OffscreenCanvas(TAILLE, TAILLE);
  else if (typeof document !== 'undefined') {
    toile = document.createElement('canvas');
    toile.width = toile.height = TAILLE;
  } else throw Error('Les revêtements doivent être générés dans un navigateur ou un worker avec OffscreenCanvas.');
  const contexte = toile.getContext('2d');
  if (!contexte) throw Error('Canvas 2D indisponible pour les revêtements.');
  return { toile, contexte };
}

function champPeriodique(colonnes, rangees, hasard) {
  const valeurs = Float32Array.from({ length: colonnes * rangees }, () => hasard() * 2 - 1);
  const champ = new Float32Array(TAILLE * TAILLE);
  for (let y = 0; y < TAILLE; y++) {
    const v = y / (TAILLE - 1) * rangees;
    const j = Math.floor(v), fy = lisser(v - j);
    for (let x = 0; x < TAILLE; x++) {
      const u = x / (TAILLE - 1) * colonnes;
      const i = Math.floor(u), fx = lisser(u - i);
      const a = valeurs[modulo(j, rangees) * colonnes + modulo(i, colonnes)];
      const b = valeurs[modulo(j, rangees) * colonnes + modulo(i + 1, colonnes)];
      const c = valeurs[modulo(j + 1, rangees) * colonnes + modulo(i, colonnes)];
      const d = valeurs[modulo(j + 1, rangees) * colonnes + modulo(i + 1, colonnes)];
      champ[y * TAILLE + x] = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    }
  }
  return champ;
}

function grainBois(longitudinal, transversal, valeur) {
  const onde = transversal * 115 + 0.13 * Math.sin(TOUR * longitudinal * 2 + valeur * 5);
  return Math.sin(TOUR * onde) * 0.025 + Math.sin(TOUR * onde * 0.37 + valeur * 9) * 0.025;
}

function creerEchantillonneur(f, v, pas, graine) {
  const [largeur, hauteur] = pas;
  const etat = { melange: 0, ton: 0, hauteur: 0.7, rugosite: f.rugosite };
  const cellule = (i, j, colonnes, rangees) => hacher(modulo(i, colonnes), modulo(j, rangees), graine);

  function carreau(u, t, colonnes, rangees, decalage = 0) {
    const ligne = Math.floor(t * rangees);
    // Un décalage au tiers boucle après trois rangées, au demi après deux.
    const rang = modulo(ligne, rangees);
    const x = u * colonnes + modulo(rang * decalage, 1);
    const colonne = Math.floor(x), a = x - colonne, b = modulo(t * rangees, 1);
    return {
      a, b, colonne, ligne: rang,
      valeur: cellule(colonne, rang, colonnes, rangees),
      bord: Math.min(Math.min(a, 1 - a) * largeur / colonnes, Math.min(b, 1 - b) * hauteur / rangees)
    };
  }

  function joint(bord, epaisseur, biseau = 0.001) {
    const interieur = lisser((bord - epaisseur / 2) / biseau);
    etat.melange = 1 - interieur;
    etat.hauteur = 0.22 + interieur * 0.53;
    etat.rugosite = f.rugosite * interieur + 0.97 * (1 - interieur);
    return interieur;
  }

  return (u, t, nuage, fin, grain) => {
    etat.melange = 0;
    etat.ton = fin * 0.018 + grain * 0.012;
    etat.hauteur = 0.67 + fin * 0.025 + grain * 0.018;
    etat.rugosite = f.rugosite;
    const x = u * largeur, y = t * hauteur;
    let c, interieur, dessin;
    switch (f.motif) {
      case 'brique':
        c = carreau(u, t, 4, 8, v.decalage);
        interieur = joint(c.bord + fin * 0.0008, v.joint, 0.0025);
        etat.ton += interieur * ((c.valeur - 0.5) * (f.id === 'brique-blanche' ? 0.07 : 0.24) + nuage * 0.04 + fin * (f.id === 'brique-blanche' ? 0.025 : 0.07));
        etat.hauteur += interieur * (fin * 0.12 + grain * 0.06);
        if (v.patine) etat.ton += Math.max(0, nuage) * 0.12;
        break;
      case 'pierre': {
        const tOndule = t + Math.sin(u * TOUR * 3) * 0.008 + nuage * 0.009;
        const ligne = Math.floor(tOndule * v.rangees);
        const rang = modulo(ligne, v.rangees);
        const colonnes = [3, 4, 3, 5, 4, 4, 5, 3][rang];
        const a = modulo(u * colonnes + cellule(0, rang, 1, v.rangees), 1);
        const b = modulo(tOndule * v.rangees, 1);
        const bord = Math.min(Math.min(a, 1 - a) * largeur / colonnes, Math.min(b, 1 - b) * hauteur / v.rangees);
        interieur = joint(bord + fin * 0.0025, v.joint, 0.004);
        const valeur = cellule(Math.floor(u * colonnes + cellule(0, rang, 1, v.rangees)), rang, colonnes, v.rangees);
        etat.ton += interieur * ((valeur - 0.5) * 0.22 + nuage * 0.08 + fin * 0.06);
        etat.hauteur += interieur * (nuage * 0.12 + fin * 0.09);
        break;
      }
      case 'beton': {
        const a = v.orientation === 'horizontale' ? t : u;
        const b = v.orientation === 'horizontale' ? u : t;
        const bord = Math.min(a, 1 - a) * 1.2;
        const bordHaut = Math.min(b, 1 - b) * 2.4;
        joint(Math.min(bord, bordHaut), 0.003, 0.0015);
        const dx = (modulo(a * 2, 1) - 0.5) * 0.6;
        const dy = (modulo(b * 3, 1) - 0.5) * 0.8;
        const trou = 1 - lisser((Math.hypot(dx, dy) - 0.009) / 0.005);
        etat.melange = Math.max(etat.melange, trou * 0.7);
        etat.hauteur -= trou * 0.48;
        etat.ton += nuage * 0.09 + fin * 0.04;
        if (v.orientation === 'planches') {
          const sillon = 1 - lisser((Math.min(modulo(u * 6, 1), 1 - modulo(u * 6, 1)) - 0.006) / 0.012);
          etat.hauteur -= sillon * 0.12;
          etat.ton += grainBois(b, a, 0.4) * 0.8;
        }
        break;
      }
      case 'enduit':
        etat.ton += nuage * v.nuage + fin * (v.grain || 0.025);
        etat.hauteur += nuage * 0.1 + fin * (v.grain ? 0.1 : 0.025);
        if (v.brosse) {
          const trace = Math.sin(TOUR * (u * 85 + Math.sin(t * TOUR * 2) * 0.4));
          etat.ton += trace * 0.009;
          etat.hauteur += trace * 0.028;
        }
        break;
      case 'metro':
      case 'zellige':
      case 'mosaique':
      case 'grand-carreau':
        c = carreau(u, t, v.colonnes, v.rangees, v.decalage || 0);
        interieur = joint(c.bord + (f.motif === 'zellige' ? fin * 0.0004 : 0), v.joint || (f.motif === 'grand-carreau' ? 0.004 : 0.002), f.motif === 'metro' ? 0.006 : 0.0012);
        etat.ton += interieur * ((c.valeur - 0.5) * (f.motif === 'zellige' ? 0.2 : 0.075) + nuage * 0.03);
        if (f.motif === 'zellige') {
          etat.hauteur += interieur * (nuage * 0.065 + fin * 0.045);
          etat.rugosite = 0.97 * (1 - interieur) + interieur * borner(f.rugosite + (c.valeur - 0.5) * 0.14 + fin * 0.04);
        }
        if (v.damier) etat.ton += interieur * (modulo(c.colonne + c.ligne, 2) ? -0.16 : 0.08);
        if (v.bandes) etat.ton -= interieur * (modulo(c.colonne, 4) === 0 ? 0.2 : 0);
        break;
      case 'marbre': {
        const phase = u * 2 + t * v.veines + nuage * 0.85 + fin * 0.04;
        const epaisseur = v.epaisseur * (0.85 + fin * 0.25);
        let veine = Math.exp(-Math.pow(Math.sin(TOUR * phase) / epaisseur, 2));
        if (v.branches) veine = Math.max(veine, Math.exp(-Math.pow(Math.sin(TOUR * (u * 5 - t * 3 + nuage * 0.3)) / 0.035, 2)) * 0.6);
        etat.melange = veine * 0.72 + Math.exp(-Math.pow(Math.sin(TOUR * phase) / 0.16, 2)) * 0.15;
        etat.ton += nuage * 0.028;
        etat.hauteur += veine * 0.015;
        const bord = Math.min(x, largeur - x, y, hauteur - y);
        if (bord < 0.0015) joint(bord, 0.0015, 0.0008);
        break;
      }
      case 'tasseaux': {
        const a = modulo(u * v.colonnes, 1);
        const bord = Math.min(a, 1 - a);
        interieur = lisser((bord - v.ouverture / 2) / 0.025);
        etat.melange = 1 - interieur;
        etat.hauteur = 0.12 + interieur * 0.72;
        etat.ton += interieur * (grainBois(t, x, cellule(Math.floor(u * v.colonnes), 0, v.colonnes, 1)) + nuage * 0.025);
        etat.rugosite = interieur * f.rugosite + (1 - interieur) * 0.99;
        if (f.id === 'tasseaux-bois') etat.ton -= (1 - interieur) * 0.5;
        break;
      }
      case 'moulures': {
        const a = modulo(u * v.cadres, 1) * largeur / v.cadres;
        const lx = largeur / v.cadres;
        const interieurCadre = Math.min(a - 0.065, lx - 0.065 - a, y - 0.11, hauteur - 0.11 - y);
        let profil = Math.exp(-Math.pow(interieurCadre / 0.008, 2));
        if (v.double) profil += Math.exp(-Math.pow((interieurCadre - 0.025) / 0.005, 2)) * 0.65;
        etat.hauteur = 0.45 + profil * 0.38;
        etat.ton += profil * 0.025;
        break;
      }
      case 'rayures': {
        const a = modulo(u * v.bandes, 1);
        dessin = a < v.rapport || (v.double && a > 0.3 && a < 0.3 + v.rapport);
        etat.melange = dessin ? 0.92 : 0;
        etat.ton += grain * 0.008;
        break;
      }
      case 'geometrique': {
        const cGeo = carreau(u, t, 4, 4, v.dessin === 'eventails' ? 0.5 : 0);
        const a = cGeo.a - 0.5, b = cGeo.b - 0.5;
        if (v.dessin === 'losanges') dessin = Math.abs(modulo((Math.abs(a) + Math.abs(b)) * 3, 1) - 0.5) < 0.045;
        else if (v.dessin === 'arches') dessin = Math.abs(Math.hypot(a, Math.max(0, b)) - 0.38) < 0.026 || (b < 0 && Math.abs(Math.abs(a) - 0.38) < 0.026);
        else dessin = Math.abs(modulo(Math.hypot(a, cGeo.b) * 6, 1) - 0.5) < 0.055;
        etat.melange = dessin ? 0.9 : 0;
        break;
      }
      case 'lames':
        c = carreau(u, t, 1, v.rangees, v.decalage);
        interieur = joint(c.bord, f.id === 'lambris-plafond' ? 0.003 : 0.0012, 0.001);
        etat.ton += interieur * ((c.valeur - 0.5) * 0.14 + grainBois(c.a * largeur, c.b * hauteur / v.rangees, c.valeur) + nuage * 0.035);
        etat.hauteur += interieur * grain * 0.025;
        break;
      case 'chevron': {
        const demi = largeur / 2;
        const bras = x < demi ? 0 : 1;
        const a = bras ? largeur - x : x;
        const pasLigne = hauteur / v.rangees;
        const phase = (y - a) / pasLigne;
        const ligne = Math.floor(phase), b = modulo(phase, 1);
        const bord = Math.min(a, demi - a, Math.min(b, 1 - b) * pasLigne / Math.SQRT2);
        interieur = joint(bord, 0.0012, 0.001);
        const valeur = cellule(bras, ligne, 2, v.rangees);
        etat.ton += interieur * ((valeur - 0.5) * 0.16 + grainBois((2 * a + b * pasLigne) / Math.SQRT2, b * pasLigne / Math.SQRT2, valeur));
        break;
      }
      case 'baton': {
        const unite = largeur / (v.longueur * 2);
        const i = Math.floor(x / unite), j = Math.floor(y / unite);
        const somme = modulo(i + j, v.longueur * 2);
        const horizontal = somme < v.longueur;
        const debut = horizontal ? i - somme : j - (somme - v.longueur);
        const a = horizontal ? (x / unite - debut) : (y / unite - debut);
        const b = horizontal ? modulo(y / unite, 1) : modulo(x / unite, 1);
        const bord = Math.min(Math.min(a, v.longueur - a), Math.min(b, 1 - b)) * unite;
        interieur = joint(bord, 0.0012, 0.001);
        const valeur = cellule(horizontal ? debut : i, horizontal ? j : debut, v.longueur * 2, v.longueur * 2);
        etat.ton += interieur * ((valeur - 0.5) * 0.19 + grainBois(a * unite, b * unite, valeur));
        break;
      }
      case 'terrazzo':
      case 'liege': {
        const nombre = v.cellules;
        const i = Math.floor(u * nombre), j = Math.floor(t * nombre);
        const valeur = cellule(i, j, nombre, nombre);
        const a = modulo(u * nombre, 1) - 0.5 - (valeur - 0.5) * 0.26;
        const b = modulo(t * nombre, 1) - 0.5 - (cellule(i + 7, j + 2, nombre, nombre) - 0.5) * 0.26;
        const angle = Math.atan2(b, a);
        const rayon = (0.15 + valeur * 0.25) * (0.86 + Math.cos(angle * 5 + valeur * 9) * 0.14);
        const fragment = 1 - lisser((Math.hypot(a, b) - rayon) / 0.035);
        if (f.motif === 'terrazzo') {
          etat.melange = fragment * (0.35 + valeur * 0.6);
          etat.ton += fragment * (valeur > 0.62 ? 0.24 : -0.07) + nuage * 0.025;
          etat.hauteur += fragment * 0.02;
        } else {
          etat.melange = fragment * 0.38;
          etat.ton += (valeur - 0.5) * 0.17 + nuage * 0.045 + fin * 0.075;
          etat.hauteur += (valeur - 0.5) * 0.15 + fragment * 0.05;
        }
        break;
      }
      case 'ciment': {
        c = carreau(u, t, 2, 2);
        const a = c.a - 0.5, b = c.b - 0.5, rayon = Math.hypot(a, b), angle = Math.atan2(b, a);
        if (v.dessin === 'fleurs') dessin = rayon < 0.24 + Math.cos(angle * 4) * 0.11 || (rayon > 0.43 && rayon < 0.46);
        else if (v.dessin === 'etoiles') dessin = rayon < 0.25 + Math.cos(angle * 8) * 0.095 || Math.abs(Math.abs(a) + Math.abs(b) - 0.7) < 0.02;
        else dessin = Math.abs(rayon - 0.3) < 0.025 || rayon < 0.08 || Math.abs(Math.hypot(0.5 - Math.abs(a), 0.5 - Math.abs(b)) - 0.24) < 0.035;
        interieur = joint(c.bord, 0.002, 0.0007);
        etat.melange = Math.max(etat.melange * 0.4, dessin ? interieur * 0.88 : 0);
        etat.ton += (c.valeur - 0.5) * 0.05 + nuage * 0.025;
        break;
      }
      case 'tomettes': {
        const rayon = v.rayon, racine = Math.sqrt(3);
        const q = 2 * x / (3 * rayon), r = (-x / 3 + y / racine) / rayon;
        let a = Math.round(q), b = Math.round(r), cHex = Math.round(-q - r);
        const da = Math.abs(a - q), db = Math.abs(b - r), dc = Math.abs(cHex + q + r);
        if (da > db && da > dc) a = -b - cHex;
        else if (db > dc) b = -a - cHex;
        const dx = Math.abs(x - rayon * 1.5 * a);
        const dy = Math.abs(y - rayon * racine * (b + a / 2));
        const bord = Math.min(rayon * racine / 2 - dy, rayon * racine / 2 - racine * dx / 2 - dy / 2);
        interieur = joint(bord, 0.005, 0.0015);
        const valeur = cellule(a, b + Math.floor(a / 2), 4, 4);
        etat.ton += interieur * ((valeur - 0.5) * 0.22 + nuage * 0.05 + fin * 0.055);
        etat.hauteur += interieur * fin * 0.06;
        break;
      }
      case 'travertin': {
        c = carreau(u, t, 2, 2);
        interieur = joint(c.bord, 0.004, 0.001);
        const strate = v.veine ? Math.sin(TOUR * (t * 18 + nuage * 0.3)) * 0.035 : 0;
        const pore = Math.max(0, grain - 0.65) * (v.pores || 1);
        etat.ton += interieur * (nuage * 0.07 + strate + (c.valeur - 0.5) * 0.07 - pore * 0.22);
        etat.hauteur -= interieur * pore * 0.45;
        break;
      }
      case 'bouclette': {
        const a = modulo(u * v.cellules, 1) - 0.5;
        const b = modulo(t * v.cellules, 1) - 0.5;
        const boucle = Math.exp(-Math.pow((Math.hypot(a * 0.9, b) - 0.28) / 0.12, 2));
        etat.hauteur = 0.35 + boucle * 0.4 + grain * 0.07;
        etat.ton += boucle * 0.035 + grain * 0.055 + nuage * 0.02;
        if (v.cotes) {
          const cote = Math.cos(TOUR * u * 24);
          etat.hauteur += cote * 0.1;
          etat.ton += cote * 0.035;
        }
        break;
      }
      case 'jonc': {
        const i = Math.floor(u * v.cellules), j = Math.floor(t * v.cellules);
        const a = modulo(u * v.cellules, 1), b = modulo(t * v.cellules, 1);
        let croisement = modulo(i + j, 2);
        if (v.dessin === 'chevrons') croisement = modulo(i + Math.abs(modulo(j, 8) - 4), 4) < 2 ? 1 : 0;
        if (v.dessin === 'panier') croisement = modulo(Math.floor(i / 2) + Math.floor(j / 2), 2);
        const fil = Math.sin(Math.PI * (croisement ? a : b));
        etat.hauteur = 0.35 + fil * 0.4 + grain * 0.035;
        etat.ton += (fil - 0.5) * 0.13 + nuage * 0.035 + grain * 0.035;
        etat.melange = croisement * 0.12;
        break;
      }
      case 'feuillage':
      case 'vegetal':
        etat.ton += nuage * 0.045;
        if (f.motif === 'vegetal') {
          etat.ton -= 0.3;
          etat.hauteur = 0.18;
        }
        break;
      default:
        throw Error('Motif de revêtement inconnu : ' + f.motif);
    }
    return etat;
  };
}

function nuance(couleur, quantite) {
  const rgb = composantes(couleur).map(c => Math.round(borner(quantite >= 0 ? c + (255 - c) * quantite : c * (1 + quantite), 0, 255)));
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

function tracerFeuille(contexte, x, y, longueur, largeur, angle, couleur, nervure) {
  contexte.save();
  contexte.translate(x, y);
  contexte.rotate(angle);
  contexte.fillStyle = couleur;
  contexte.beginPath();
  contexte.moveTo(0, -longueur / 2);
  contexte.bezierCurveTo(largeur, -longueur * 0.15, largeur * 0.7, longueur * 0.4, 0, longueur / 2);
  contexte.bezierCurveTo(-largeur * 0.7, longueur * 0.4, -largeur, -longueur * 0.15, 0, -longueur / 2);
  contexte.fill();
  if (nervure) {
    contexte.strokeStyle = nervure;
    contexte.lineWidth = Math.max(0.45, largeur * 0.018);
    contexte.beginPath();
    contexte.moveTo(0, -longueur * 0.4);
    contexte.quadraticCurveTo(largeur * 0.07, 0, 0, longueur * 0.4);
    contexte.stroke();
  }
  contexte.restore();
}

function dessinerFeuillage(couches, f, v, couleurs, graine, pas) {
  const hasard = hasardDepuis(graine ^ 0x79A31C57);
  const periode = TAILLE - 1;
  const feuilles = [];
  if (f.motif === 'vegetal') {
    for (let i = 0; i < v.feuilles; i++) {
      const longueur = (0.035 + hasard() * (v.forme === 'large' ? 0.08 : 0.055)) / pas[1] * periode;
      feuilles.push({
        x: hasard() * periode, y: hasard() * periode, longueur,
        largeur: longueur * (v.forme === 'fine' ? 0.13 : v.forme === 'large' ? 0.45 : 0.28),
        angle: hasard() * TOUR, ton: hasard() * 0.23 - 0.12, hauteur: 0.5 + hasard() * 0.4
      });
    }
  } else {
    for (let i = 0; i < v.branches; i++) {
      const x = hasard() * periode, y = hasard() * periode;
      const angle = hasard() * TOUR, longueurBranche = periode * (0.2 + hasard() * 0.2);
      for (const decalageX of [-periode, 0, periode]) for (const decalageY of [-periode, 0, periode]) {
        const contexte = couches[0].contexte;
        contexte.save();
        contexte.translate(x + decalageX, y + decalageY);
        contexte.rotate(angle);
        contexte.strokeStyle = nuance(couleurs[1], 0.16);
        contexte.lineWidth = 0.9;
        contexte.beginPath();
        contexte.moveTo(0, -longueurBranche / 2);
        contexte.quadraticCurveTo(longueurBranche * 0.1, 0, 0, longueurBranche / 2);
        contexte.stroke();
        contexte.restore();
      }
      for (let j = 0; j < 7; j++) {
        const cote = j % 2 ? 1 : -1, avance = (j / 6 - 0.5) * longueurBranche;
        const longueur = v.taille / pas[1] * periode * (0.65 + hasard() * 0.4);
        const lateral = cote * longueur * 0.25;
        feuilles.push({
          x: x + lateral * Math.cos(angle) - avance * Math.sin(angle),
          y: y + lateral * Math.sin(angle) + avance * Math.cos(angle),
          longueur, largeur: longueur * 0.23, angle: angle + cote * 0.7,
          ton: hasard() * 0.16 - 0.06, hauteur: 0.68
        });
      }
    }
  }
  for (const feuille of feuilles) {
    const base = f.motif === 'vegetal' && hasard() < 0.45 ? couleurs[0] : couleurs[1];
    const teinte = nuance(base, feuille.ton);
    for (const decalageX of [-periode, 0, periode]) for (const decalageY of [-periode, 0, periode]) {
      const x = feuille.x + decalageX, y = feuille.y + decalageY;
      if (x < -feuille.longueur || y < -feuille.longueur || x > TAILLE + feuille.longueur || y > TAILLE + feuille.longueur) continue;
      tracerFeuille(couches[0].contexte, x, y, feuille.longueur, feuille.largeur, feuille.angle, teinte, nuance(teinte, 0.15));
      const gris = Math.round(feuille.hauteur * 255);
      tracerFeuille(couches[1].contexte, x, y, feuille.longueur, feuille.largeur, feuille.angle, `rgb(${gris},${gris},${gris})`, null);
      const rugosite = Math.round((f.motif === 'vegetal' ? 0.65 + feuille.hauteur * 0.15 : f.rugosite) * 255);
      tracerFeuille(couches[2].contexte, x, y, feuille.longueur, feuille.largeur, feuille.angle, `rgb(${rugosite},${rugosite},${rugosite})`, null);
    }
  }
}

function fermerRaccord(contexte) {
  const image = contexte.getImageData(0, 0, TAILLE, TAILLE);
  const pixels = image.data;
  // Le dernier texel reprend le premier pour stabiliser les mipmaps aux bords.
  for (let y = 0; y < TAILLE; y++) {
    const debut = y * TAILLE * 4, fin = debut + (TAILLE - 1) * 4;
    for (let canal = 0; canal < 4; canal++) pixels[fin + canal] = pixels[debut + canal];
  }
  pixels.copyWithin((TAILLE - 1) * TAILLE * 4, 0, TAILLE * 4);
  contexte.putImageData(image, 0, 0);
}

function fabriquerTextures(f, v, couleurs, pas) {
  // La géométrie du motif reste identique lors d'un changement de coloris.
  const graine = graineDepuis(f.id + ':' + v.id);
  const hasard = hasardDepuis(graine);
  const nuages = champPeriodique(4, 4, hasard);
  const details = champPeriodique(32, 32, hasard);
  const couches = [nouveauCanvas(), nouveauCanvas(), nouveauCanvas()];
  const images = couches.map(c => c.contexte.createImageData(TAILLE, TAILLE));
  const donnees = images.map(i => i.data);
  const principale = composantes(couleurs[0]), secondaire = composantes(couleurs[1]);
  const echantillonner = creerEchantillonneur(f, v, pas, graine);
  for (let y = 0; y < TAILLE; y++) for (let x = 0; x < TAILLE; x++) {
    const i = y * TAILLE + x, index = i * 4;
    const grain = hacher(x % (TAILLE - 1), y % (TAILLE - 1), graine) * 2 - 1;
    const e = echantillonner(x / (TAILLE - 1), 1 - y / (TAILLE - 1), nuages[i], details[i], grain);
    const melange = borner(e.melange);
    const relief = Math.round(borner(e.hauteur) * 255);
    const rugosite = Math.round(borner(e.rugosite + grain * 0.012, 0.04, 1) * 255);
    for (let canal = 0; canal < 3; canal++) {
      const base = principale[canal] * (1 - melange) + secondaire[canal] * melange;
      donnees[0][index + canal] = borner(e.ton >= 0 ? base + (255 - base) * e.ton : base * (1 + e.ton), 0, 255);
      donnees[1][index + canal] = relief;
      donnees[2][index + canal] = rugosite;
    }
    donnees[0][index + 3] = donnees[1][index + 3] = donnees[2][index + 3] = 255;
  }
  couches.forEach((c, i) => c.contexte.putImageData(images[i], 0, 0));
  if (f.motif === 'feuillage' || f.motif === 'vegetal') dessinerFeuillage(couches, f, v, couleurs, graine, pas);
  return couches.map((couche, index) => {
    fermerRaccord(couche.contexte);
    const texture = new THREE.CanvasTexture(couche.toile);
    texture.name = f.id + ':' + v.id + ':' + couleurs.join(':') + ':' + ['couleur', 'relief', 'rugosite'][index];
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / pas[0], 1 / pas[1]);
    texture.colorSpace = index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;
    texture.generateMipmaps = true;
    texture.userData.partage = true;
    return texture;
  });
}

export function materiauRevetement(id, { couleur, coloris, variante: varianteId } = {}) {
  if (!Object.hasOwn(REVETEMENTS, id)) throw Error('Revêtement inconnu : ' + id);
  const f = REVETEMENTS[id];
  const choixColoris = coloris === undefined ? f.coloris[0] : f.coloris.find(c => c.id === coloris);
  if (!choixColoris) throw Error('Coloris inconnu pour ' + id + ' : ' + coloris);
  const choixVariante = varianteId === undefined ? f.variantes[0] : f.variantes.find(v => v.id === varianteId);
  if (!choixVariante) throw Error('Variante inconnue pour ' + id + ' : ' + varianteId);
  if (couleur !== undefined && !f.teintable) throw Error('Revêtement non teintable : ' + id);
  const couleurs = choixColoris.couleurs.map(couleurHex);
  if (couleur !== undefined) couleurs[0] = couleurHex(couleur);
  const pas = choixVariante.pas || f.pas;
  const cle = [id, choixVariante.id, ...couleurs].join('|');
  if (CACHE_MATERIAUX.has(cle)) return CACHE_MATERIAUX.get(cle);
  const [carteCouleur, carteRelief, carteRugosite] = fabriquerTextures(f, choixVariante, couleurs, pas);
  const materiau = new THREE.MeshStandardMaterial({
    color: '#FFFFFF', map: carteCouleur, bumpMap: carteRelief,
    bumpScale: f.relief * (['brique', 'pierre', 'tasseaux', 'moulures', 'vegetal'].includes(f.motif) ? 0.012 : 0.003),
    roughness: 1, roughnessMap: carteRugosite, metalness: f.metal
  });
  materiau.name = 'revetement:' + cle;
  materiau.userData = {
    partage: true, revetement: id, variante: choixVariante.id,
    couleurs: couleurs.slice(), pas: pas.slice(), styles: choixVariante.styles.slice(),
    stylePrincipal: f.stylePrincipal
  };
  CACHE_MATERIAUX.set(cle, materiau);
  return materiau;
}

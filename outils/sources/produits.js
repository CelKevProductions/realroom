/* =================================================================
   Visite privée — Maison Corleone
   Données : réglages, produits du catalogue (Shopify), espaces de la visite
   ================================================================= */
window.MC_DATA = (function () {
  'use strict';

  /* ---------------------------------------------------------------
     Réglages de la proposition
     --------------------------------------------------------------- */
  const CONFIG = {
    hotel: 'Marriott Roissy-Charles-de-Gaulle',
    hotelCourt: 'Marriott CDG',
    script: 'Centre Roissy',
    coteGauche: 'Roissy',
    coteDroit: 'Charles-de-Gaulle',
    date: 'septembre 2026',
    email: 'contact@maisoncorleone.com',
    telephone: '[téléphone à compléter]',
    afficherPrix: true,      // false : masque les prix et le budget
    boutique: 'maisoncorleone.com'
  };

  // Image produit : réduite par le CDN Shopify (chargée seulement hors aperçu Claude)
  const IMG = u => u + (u.indexOf('?') > -1 ? '&' : '?') + 'width=900';
  const URL = h => 'https://maisoncorleone.com/products/' + h;

  /* ---------------------------------------------------------------
     Produits. prix : prix catalogue public (0 = sur devis).
     look : réglages de la maquette 3D générique (couleurs, forme).
     --------------------------------------------------------------- */
  const P = {};
  const def = (id, o) => { P[id] = Object.assign({ id, url: o.brouillon ? null : URL(id) }, o); };

  /* --- Lits --- */
  def('rce-05', { nom: 'Royal Curve Edition', titre: 'Lit design en cuir orange à chevets intégrés', cat: 'Lit', prix: 3500,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0902.12.38.jpg?v=1780100146'),
    texte: "Une tête de lit ondulée en cuir orange, deux chevets en laque beige intégrés et un piètement central en croix en laiton brossé : une seule ligne continue, sans espace perdu entre le lit et les chevets.",
    points: [['Revêtement', 'Cuir orange, surpiqûres verticales'], ['Chevets', 'Intégrés, laque beige'], ['Piètement', 'En croix, laiton brossé'], ['Chambre', '16 m² et plus']],
    look: { style: 'vague', tete: '#B4532F', base: '#A94C2B', chevets: '#D9CCB6' } });
  def('ec-01', { nom: 'Essential Comfort', titre: 'Lit capitonné en simili cuir taupe avec éclairage LED intégré', cat: 'Lit', prix: 1100,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0902.32.43.jpg?v=1780100123'),
    texte: "Simili cuir taupe, tête de lit à deux panneaux cousus et bandeau LED sous le sommier : le lit semble flotter au-dessus du sol, sans lampe d'appoint.",
    points: [['Revêtement', 'Simili cuir taupe'], ['Tête de lit', 'Deux panneaux, coutures verticales'], ['Éclairage', 'LED d\'ambiance sous le sommier']],
    look: { style: 'panneaux', tete: '#86766A', base: '#7C6D61', led: true } });
  def('bed-410', { nom: 'Lumea', titre: 'Lit capitonné en velours beige à têtière enveloppante et liseuses LED intégrées', cat: 'Lit', prix: 2350,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0818.41.41_3.jpg?v=1780239370'),
    texte: "Tête de lit haute en velours beige cannelé, panneaux latéraux arrondis qui enveloppent le couchage et deux liseuses LED orientables intégrées : aucune lampe de chevet n'est nécessaire.",
    points: [['Revêtement', 'Velours beige cannelé'], ['Tête de lit', 'Panneaux latéraux enveloppants'], ['Éclairage', 'Deux liseuses LED orientables'], ['Pieds', 'Embouts métalliques dorés']],
    look: { style: 'ailes', tete: '#D5C2A2', base: '#CBB795', liseuses: true } });
  def('nd-01', { nom: 'Nordic Duo', titre: 'Lit tapissé en velours bicolore taupe et beige', cat: 'Lit', prix: 1250,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0902.47.03.jpg?v=1780101030'),
    texte: "Tête de lit à double coussin, velours beige clair encadré de bandeaux taupe, sur de fins pieds en métal noir. Couchage 160 cm, silhouette basse et graphique.",
    points: [['Revêtement', 'Velours taupe et beige'], ['Couchage', '160 cm'], ['Pieds', 'Métal noir, fins']],
    look: { style: 'duo', tete: '#D2C3A8', base: '#7F6F61' } });
  def('rcb-05', { nom: 'Royal Curve', titre: 'Lit en velours côtelé beige à tête de lit arrondie capitonnée', cat: 'Lit', prix: 1800,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0902.21.39.jpg?v=1780099858'),
    texte: "Tête de lit galbée à capitonnage vertical, pied de lit cylindrique à côtes, le tout en velours côtelé beige. Un bandeau LED dissimulé sous le sommier crée un effet de flottement.",
    points: [['Revêtement', 'Velours côtelé beige'], ['Couchage', '160 cm'], ['Éclairage', 'LED sous le sommier']],
    look: { style: 'galbe', tete: '#D8C6A6', base: '#CDB997', led: true } });
  def('cbb-03', { nom: 'Cloud Bubble', titre: 'Lit Cloud Bubble en bouclette ivoire à structure tubulaire capitonnée', cat: 'Lit', prix: 1300,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0902.06.03.jpg?v=1780100204'),
    texte: "Tête de lit et contour en tubes capitonnés de bouclette ivoire, sur trois côtés. Un relief façon nuage, au format proche de 200 × 200 cm.",
    points: [['Revêtement', 'Bouclette ivoire épaisse'], ['Format', 'Environ 200 × 200 cm'], ['Sommier', 'Lattes de bois massif']],
    // encombrement d'après les photos : tête de lit avec ses deux chevets ronds (couchage 160 × 200)
    dim: [3, 2.5, 1.1],
    look: { style: 'tubes', tete: '#EEE7D8', base: '#E6DECD' } });
  def('lhs-15', { nom: 'Hotel Signature', titre: 'Lit capitonné en cuir beige à tête matelassée XXL', cat: 'Lit', prix: 2650,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0902.30.21.jpg?v=1780100173'),
    texte: "Une tête de lit XXL en cuir beige capitonné carré sur environ 145 cm de haut, prolongée par deux consoles suspendues en bois foncé avec liseuses chromées et tablettes en verre. Couchage 200 × 200 cm.",
    points: [['Revêtement', 'Cuir beige, capitonnage carré'], ['Tête de lit', 'Environ 145 cm de haut'], ['Couchage', '200 × 200 cm'], ['Chevets', 'Consoles suspendues, liseuses']],
    look: { style: 'signature', tete: '#D8C4A2', base: '#CDB794' } });
  def('ecp-12', { nom: 'Executive Comfort', titre: 'Lit capitonné tête de lit XXL avec chevets suspendus marbre & noyer', cat: 'Lit', prix: 2300,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0902.27.50.jpg?v=1780100080'),
    texte: "Tête de lit extra-large capitonnée en chenille gris-beige, prolongée par deux chevets suspendus en noyer à plateau effet marbre, chacun avec sa liseuse chromée.",
    points: [['Revêtement', 'Chenille gris-beige'], ['Chevets', 'Noyer, plateau effet marbre'], ['Éclairage', 'Liseuses chromées articulées']],
    look: { style: 'executive', tete: '#BCB1A2', base: '#B0A595' } });
  def('cr-06', { nom: 'Royal', titre: 'Lit capitonné Chesterfield en velours cognac à ailerons', cat: 'Lit', prix: 1800,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/pomelli_photoshoot_image_1_1_0713_2.png?v=1783970451'),
    texte: "Une tête de lit haute à ailerons façon wingback, en velours cognac capitonné en losanges avec boutons ton sur ton : on s'y adosse pour lire.",
    points: [['Revêtement', 'Velours cognac'], ['Capitonnage', 'Losanges, boutons ton sur ton'], ['Tête de lit', 'Ailerons latéraux']],
    look: { style: 'chesterfield', tete: '#8F5328', base: '#84491F' } });

  /* --- Luminaires --- */
  def('lst-min-03', { nom: 'Luna Stack', titre: 'Suspension en albâtre naturel à 3 diffuseurs empilés', cat: 'Suspension', prix: 200,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1107.07.06.jpg?v=1780106747'),
    texte: "Trois diffuseurs en albâtre naturel empilés sur une tige en métal noir mat. Chaque pierre a son propre veinage : deux suspensions ne sont jamais identiques.",
    points: [['Matière', 'Albâtre naturel, métal noir mat'], ['Diffuseurs', 'Environ 16 cm de diamètre'], ['Usage', 'Chevet ou composition']],
    look: { style: 'albatre' } });
  def('scg-light-2421', { nom: 'Silk Cylinder Glow', titre: 'Suspension cylindrique en fils de soie terracotta', cat: 'Suspension', prix: 1800,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1105.50.00.jpg?v=1780105264'),
    texte: "Un cylindre de fils tendus teinte terracotta, cerclé de métal noir. La LED cachée à la base fait remonter la lumière le long des fils.",
    points: [['Matière', 'Fils façon soie, métal noir mat'], ['Coloris', 'Terracotta'], ['Éclairage', 'LED dissimulée à la base']],
    look: { style: 'cylindre', couleur: '#B7603B' } });
  def('sus-lnb-34', { nom: 'Luna Balance', titre: 'Suspension Luna Balance en métal noir et verre opalin à 3 diffuseurs', cat: 'Suspension', prix: 550,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1107.48.32_1.jpg?v=1780106972'),
    texte: "Trois disques en verre opalin d'environ 35 cm flottent sur une armature tripode en métal noir, chacun au-dessus d'un point LED cerclé de laiton.",
    points: [['Matière', 'Verre opalin, métal noir mat'], ['Diffuseurs', 'Environ 35 cm'], ['Détail', 'Cerclages laiton']],
    look: { style: 'tripode' } });
  def('wom-wall-2414', { nom: 'Wood Orb Duo', titre: 'Applique murale en bois teinté noyer et globe opalin', cat: 'Applique', prix: 180,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1105.36.37.jpg?v=1780105435'),
    texte: "Une plaque ovale en bois teinté noyer, un globe en verre opalin et deux demi-sphères en métal noir mat. Une lumière tamisée, sans éblouissement.",
    points: [['Matière', 'Bois teinté noyer, verre opalin'], ['Hauteur', '38 cm'], ['Lumière', 'Tamisée']],
    look: { style: 'orbe' } });
  def('mc-wall-3347', { nom: 'Molten Capsule', titre: 'Applique murale en verre soufflé ambré et laiton doré', cat: 'Applique', prix: 560,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1106.23.36.jpg?v=1780106261'),
    texte: "Un verre soufflé ambré en forme de goutte étirée, traversé par un tube en laiton doré. Elle se pose volontiers en duo autour d'un miroir.",
    points: [['Matière', 'Verre soufflé ambré, laiton doré'], ['Hauteur', 'Environ 38 cm']],
    look: { style: 'capsule' } });
  def('ssl-wall-2423', { nom: 'Soft Stone Layers', titre: 'Applique murale en verre albâtre à trois vasques empilées', cat: 'Applique', prix: 450,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1105.54.22.jpg?v=1780105581'),
    texte: "Trois vasques en verre effet albâtre aux contours irréguliers, empilées sur une platine finition laiton. Une lumière diffuse, idéale en couloir ou au-dessus d'un bureau.",
    points: [['Matière', 'Verre effet albâtre, laiton'], ['Hauteur', 'Environ 70 cm']],
    look: { style: 'vasques' } });
  def('arc-slk-2203', { nom: 'Arc Silk', titre: 'Suspension Arc Silk en tissu plissé écru et structure métal noir', cat: 'Suspension', prix: 990,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1106.12.23.jpg?v=1780106020'),
    texte: "Un diffuseur en tissu plissé écru en arche de 130 cm, porté par deux tiges en métal noir. La lumière traverse les côtes du tissu sans point chaud.",
    points: [['Matière', 'Tissu plissé écru, métal noir'], ['Longueur', '130 cm']],
    look: { style: 'arche' } });
  def('sus-clh-21', { nom: 'Cluster Halo', titre: 'Suspension en laiton brossé et globes en verre opalin', cat: 'Suspension', prix: 350,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1107.29.42.jpg?v=1780175513'),
    texte: "Un abat-jour conique en laiton brossé et une grappe de globes en verre opalin strié, disposés en cascade. Trois tailles : 8, 12 ou 16 globes.",
    points: [['Matière', 'Laiton brossé, verre opalin strié'], ['Tailles', '8, 12 ou 16 globes']],
    look: { style: 'grappe' } });
  def('wave-line', { nom: 'Wave Line', titre: 'Suspension design en tubes de laiton entrelacés', cat: 'Suspension', prix: 780,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1107.31.48.jpg?v=1780106817'),
    texte: "Des tubes en laiton poli, courbés en nœud ondulant et ponctués de trois sphères en verre opalin blanc.",
    points: [['Matière', 'Laiton poli, verre opalin'], ['Points lumineux', '3 sphères']],
    look: { style: 'noeud' } });
  def('fpf-lamp-7705', { nom: 'Feather Palm', titre: 'Lampadaire Palmier en plumes naturelles et pied métal doré sculpté', cat: 'Lampadaire', prix: 1000,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1106.04.16.jpg?v=1780105391'),
    texte: "Un pied en métal doré texturé comme une branche noueuse et une couronne de plumes naturelles en corolle. La lumière se tamise à travers le plumage.",
    points: [['Matière', 'Métal doré, plumes naturelles'], ['Hauteur', 'Environ 165 cm']],
    look: { style: 'palmier' } });
  def('scg-light-2409', { nom: 'Spiral Crystal Grand', titre: 'Lustre suspendu en spirale de cristaux', cat: 'Lustre', prix: 2000,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1105.22.16.jpg?v=1780104095'),
    texte: "Sept anneaux chromés de diamètre dégressif, habillés de rideaux de cristaux et légèrement pivotés les uns par rapport aux autres. Pensé pour les volumes à double hauteur.",
    points: [['Matière', 'Métal chromé, cristaux facettés'], ['Anneaux', '7, éclairage LED chaud'], ['Hauteur', 'Environ 250 cm de suspension']],
    look: { style: 'spirale' } });
  def('fgc-light-2420', { nom: 'Floral Cascade', titre: 'Lustre floral en verre opalin et laiton doré', cat: 'Lustre', prix: 2350,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1105.48.15.jpg?v=1780105065'),
    texte: "Une couronne de fleurs en verre opalin sur tiges dorées, prolongée par une cascade de pampilles en verre facetté. Pour les volumes hauts.",
    points: [['Matière', 'Verre opalin, métal doré, pampilles'], ['Éclairage', 'Spots LED encastrés']],
    look: { style: 'floral' } });
  def('crp-light-2408', { nom: 'Crystal Rings Prestige', titre: 'Lustre suspendu 4 anneaux en cristal facetté et métal doré', cat: 'Lustre', prix: 500,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1105.20.54.jpg?v=1780104784'),
    texte: "Quatre anneaux de cristal facetté sur une structure dorée, chacun éclairé par un ruban LED à lumière chaude.",
    points: [['Matière', 'Cristal facetté, métal doré'], ['Anneaux', '4, diamètres dégressifs']],
    look: { style: 'anneaux' } });
  def('cmc-light-2413', { nom: 'Crystal Matrix Cube', titre: 'Lustre suspendu monumental en cristal gravé', cat: 'Lustre', prix: 4900,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1105.28.14.jpg?v=1780104894'),
    texte: "Des dizaines de cubes et de plaques de cristal gravé au laser, suspendus sur des câbles fins sur près de 4 mètres de hauteur. Conçu pour les halls d'hôtel à double hauteur.",
    points: [['Matière', 'Cristal gravé au laser'], ['Hauteur', 'Près de 4 m'], ['Usage', 'Halls et lobbies']],
    look: { style: 'matrice' } });
  def('ols-arch-30', { nom: 'Ondes Signature', titre: 'Suspension monumentale multi-anneaux LED en aluminium et bois', cat: 'Lustre', prix: 6500,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1107.13.10.jpg?v=1780107200'),
    texte: "Sept à neuf anneaux LED ondulés superposés en spirale, jusqu'à 300 cm de diamètre, avec une finition bois clair sur la tranche. Pour les halls et les atriums.",
    points: [['Matière', 'Aluminium, finition bois clair'], ['Diamètre', 'Jusqu\'à 300 cm'], ['Anneaux', '7 à 9, LED continue']],
    look: { style: 'ondes' } });
  def('isr-light-2411', { nom: 'Infinity Spiral Rings', titre: 'Lustre monumental en anneaux LED spiralés', cat: 'Lustre', prix: 3500,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1105.25.12.jpg?v=1780104310'),
    texte: "Des anneaux métalliques concentriques équipés de rubans LED, assemblés en spirale sur plusieurs niveaux, visibles depuis plusieurs étages.",
    points: [['Matière', 'Métal, rubans LED'], ['Usage', 'Grandes hauteurs sous plafond']],
    look: { style: 'infini' } });
  def('gbc-orbit-7734', { nom: 'Galaxy Bubble Cluster', titre: 'Suspension boules en verre soufflé et armature chromée', cat: 'Suspension', prix: 1650,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1106.19.21.jpg?v=1780106523'),
    texte: "Une quarantaine de globes en verre soufflé sur une armature chromée icosaédrique, chacun avec son ampoule LED à filament. Environ 60 cm de diamètre.",
    points: [['Matière', 'Verre soufflé, métal chromé'], ['Diamètre', 'Environ 60 cm'], ['Éclairage', 'LED à filament']],
    look: { style: 'galaxie' } });
  def('gbc-light-2418', { nom: 'Glass Bubble Cluster', titre: 'Suspension linéaire en verre soufflé fumé et transparent', cat: 'Suspension', prix: 1500,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1105.43.19.jpg?v=1780104925'),
    texte: "Une trentaine de globes en verre soufflé, fumé ou transparent côtelé, sur une armature chromée d'environ 95 cm de long.",
    points: [['Matière', 'Verre soufflé, métal chromé'], ['Longueur', 'Environ 95 cm']],
    look: { style: 'lineaire' } });

  /* --- Assises --- */
  def('terracotta', { nom: 'Terracotta', titre: 'Fauteuil lounge en velours terracotta à bourrelets sculptés', cat: 'Fauteuil', prix: 843.75,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/DJI_20251102172108_0439_D.jpg?v=1771175062'),
    texte: "Un fauteuil lounge en velours terracotta dont le dossier est formé de trois bourrelets empilés, prolongés en accoudoirs galbés. Assise basse et enveloppante.",
    points: [['Revêtement', 'Velours terracotta uni'], ['Dossier', 'Trois bourrelets rembourrés'], ['Accoudoirs', 'Intégrés, sans rupture']],
    look: { style: 'bourrelets', couleur: '#B45A3A' } });
  def('abbraccio', { nom: 'Abbraccio', titre: 'Fauteuil rond en cuir capitonné vert sauge et laiton', cat: 'Fauteuil', prix: 280,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/DJI_20251103143811_0784_D.jpg?v=1771172398'),
    texte: "Un fauteuil rond façon tub chair en cuir vert sauge mat, dossier capitonné à motif galets et insert en métal doré brossé. Compact, il se glisse devant un bureau.",
    points: [['Revêtement', 'Cuir ou simili cuir vert sauge'], ['Dossier', 'Capitonnage galets'], ['Détail', 'Insert doré brossé']],
    look: { style: 'tub', couleur: '#8F9B7F' } });
  def('fauteuil-velours-terracotta-pietement-plein-terra', { nom: 'Terra', titre: 'Fauteuil design en velours terracotta à piètement plein', cat: 'Fauteuil', prix: 1106.25,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/preview_images/0887b17a70f74cf3b15eac0630cda2bf.thumbnail.0000000000.jpg?v=1771177292'),
    texte: "Un fauteuil bas en velours terracotta, aux accoudoirs pleins qui descendent jusqu'au sol, avec deux coussins indépendants soulignés d'un liseré sombre.",
    points: [['Revêtement', 'Velours terracotta'], ['Piètement', 'Plein, intégré aux accoudoirs']],
    look: { style: 'terra', couleur: '#A85439' } });
  def('bubble-art', { nom: 'Bubble Art', titre: 'Fauteuil cocon en tissu bouclé écru à motif abstrait', cat: 'Fauteuil', prix: 520,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/preview_images/28b5fe64162643c49d5939d26b960786.thumbnail.0000000000.jpg?v=1771175130'),
    texte: "Un fauteuil cocon rond en bouclette écru à motif abstrait noir et gris, façon coup de pinceau, avec trois coussins carrés assortis.",
    points: [['Revêtement', 'Bouclette écru, motif abstrait'], ['Silhouette', 'Cocon, sans accoudoirs marqués']],
    look: { style: 'cocon', couleur: '#ECE4D6' } });
  def('classica', { nom: 'Classica', titre: 'Fauteuil lounge en tissu bouclé écru et piètement bois cintré noir', cat: 'Fauteuil', prix: 480,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/DJI_20251102164537_0386_D.jpg?v=1771177207'),
    texte: "Une bouclette épaisse blanc écru sur une structure en bois cintré laqué noir, avec piètement luge. Profil bas, dossier légèrement incliné.",
    points: [['Revêtement', 'Bouclette blanc écru'], ['Structure', 'Bois cintré laqué noir']],
    look: { style: 'luge', couleur: '#EEE8DC' } });
  def('prusse', { nom: 'Prusse', titre: 'Fauteuil bergère en velours capitonné bleu roi', cat: 'Fauteuil', prix: 1012.5,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/DJI_20251102171936_0430_D.png?v=1771525914'),
    texte: "Une bergère à dossier haut capitonné en losanges, en velours bleu roi, avec des accoudoirs pleins arrondis et de fins pieds en métal doré.",
    points: [['Revêtement', 'Velours bleu roi'], ['Dossier', 'Capitonné en losanges'], ['Pieds', 'Métal doré']],
    look: { style: 'bergere', couleur: '#2B438A' } });
  def('diamond-cream', { nom: 'Diamond Cream', titre: 'Fauteuil pivotant capitonné en cuir crème', cat: 'Fauteuil', prix: 900,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/DJI_20251102161647_0299_D.jpg?v=1771172238'),
    texte: "Un fauteuil pivotant à 360°, au dossier haut enveloppant à ailes, en cuir crème matelassé en losanges, sur piètement étoilé en métal brossé.",
    points: [['Revêtement', 'Cuir ou simili cuir crème'], ['Rotation', '360°'], ['Piètement', 'Étoilé, métal brossé']],
    look: { style: 'pivotant', couleur: '#EEE4CF' } });
  def('cognac-shell', { nom: 'Cognac Shell', titre: 'Fauteuil coquille en cuir cognac cannelé', cat: 'Fauteuil', prix: 550,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/DJI_20251103163453_0023_D.png?v=1771527344'),
    texte: "Un fauteuil coquille en cuir cognac : dossier et accoudoirs d'une seule pièce jusqu'au sol, seize cannelures cousues et une assise lisse indépendante.",
    points: [['Revêtement', 'Cuir cognac'], ['Dossier', 'Environ 16 cannelures cousues']],
    look: { style: 'coquille', couleur: '#9B5A2B' } });
  def('cigar-1919', { nom: 'Cigar 1919', titre: 'Fauteuil Chesterfield en cuir cognac capitonné', cat: 'Fauteuil', prix: 600,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/DJI_20251103143059_0764_D.png?v=1771526758'),
    texte: "Un wingback en cuir cognac brillant capitonné en losanges, aux oreilles galbées, monté sur roulettes en laiton.",
    points: [['Revêtement', 'Cuir cognac pleine fleur'], ['Capitonnage', 'Losanges boutonnés'], ['Pieds', 'Roulettes laiton']],
    look: { style: 'wingback', couleur: '#8B4B22' } });
  def('fleur-de-nuit', { nom: 'Fleur de Nuit', titre: 'Tabouret de bar en velours bleu nuit forme fleur', cat: 'Tabouret de bar', prix: 1181.25,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/DJI_20251103150911_0907_D.jpg?v=1771439953'),
    texte: "Une assise sculptée en cinq pétales de velours bleu nuit, sur quatre pieds effilés en métal brossé reliés par un repose-pieds circulaire torsadé.",
    points: [['Revêtement', 'Velours bleu nuit'], ['Piètement', 'Métal brossé, repose-pieds torsadé']],
    look: { style: 'fleur', couleur: '#22305A' } });
  def('orange-diamond-barstool', { nom: 'Diamond', titre: 'Tabouret de bar matelassé bicolore orange et crème', cat: 'Tabouret de bar', prix: 1687.5,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/DJI_20251101155842_0121_D.jpg?v=1771179233'),
    texte: "Un tabouret haut bicolore : cuir synthétique crème et losanges orange au dos, piètement noir mat et repose-pieds en laiton. Assise à environ 75 cm.",
    points: [['Revêtement', 'Cuir synthétique crème et orange'], ['Hauteur d\'assise', 'Environ 75 cm'], ['Repose-pieds', 'Laiton']],
    look: { style: 'diamond', couleur: '#D8793A' } });

  /* --- Canapés, bancs --- */
  def('sofa-220', { nom: 'Siena', titre: "Canapé d'angle en chenille orange rouille aux lignes galbées", cat: 'Canapé', prix: 1600,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0818.43.38_6999b197-b517-45e9-a83f-a2d3220f7a59.jpg?v=1780099434'),
    texte: "Un canapé d'angle aux lignes arrondies, entièrement recouvert d'une chenille épaisse orange rouille. Il repose au sol, sans piètement apparent.",
    points: [['Revêtement', 'Chenille orange rouille'], ['Composition', 'Modules assemblés en courbe']],
    look: { style: 'siena', couleur: '#B4592F' } });
  def('cm-950', { nom: 'Cloud Modular', titre: 'Canapé modulaire en tissu bouclé aux formes galets', cat: 'Canapé', prix: 1200,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0817.42.29.jpg?v=1780096086'),
    texte: "Des assises basses en forme de galet et des dossiers ronds en bouclette chocolat sur une assise écru. Les modules se recomposent selon la pièce.",
    points: [['Revêtement', 'Bouclette écru et chocolat'], ['Hauteur d\'assise', 'Environ 40 cm']],
    look: { style: 'galets', couleur: '#EDE4D4', dossier: '#5A3F31' } });
  def('mcs-01', { nom: 'Mineral Cloud', titre: 'Canapé courbe en velours effet marbre noir et beige', cat: 'Canapé', prix: 1900,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/pomelli_photoshoot_image_1_1_0711.png?v=1783726292'),
    texte: "Un canapé trois places sans angle droit, en velours effet marbre noir, beige et gris qui change avec la lumière. Environ 240 cm de large.",
    points: [['Revêtement', 'Velours effet marbre'], ['Places', '3'], ['Largeur', 'Environ 240 cm']],
    look: { style: 'mineral', couleur: '#4A4643' } });
  def('com-600', { nom: 'Bouclé Noyer', titre: "Canapé d'angle modulable en tissu bouclé écru à tablettes bois intégrées", cat: 'Canapé', prix: 1800,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0818.26.54.jpg?v=1780097344'),
    texte: "Trois modules arrondis en bouclé écru et, à chaque extrémité, une tablette ronde en noyer foncé qui sert d'accoudoir.",
    points: [['Revêtement', 'Bouclé écru'], ['Tablettes', 'Noyer foncé, intégrées']],
    look: { style: 'tablettes', couleur: '#EAE2D2' } });
  def('cls-je88', { nom: 'Jungle Edition', titre: 'Canapé lounge circulaire en velours imprimé jungle', cat: 'Canapé', prix: 3250,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0906.51.32.jpg?v=1780102502'),
    texte: "Des modules courbes qui referment un cercle complet autour d'une table basse, en velours imprimé jungle sur fond noir. Un point focal pour les grands espaces de réception.",
    points: [['Revêtement', 'Velours imprimé jungle'], ['Composition', 'Cercle complet, modulaire']],
    look: { style: 'cercle', couleur: '#233025' } });
  def('banc-sculptural-resine-violette-topographie', { nom: 'Topographie', titre: 'Banc sculptural en résine texturée violette', cat: 'Banc', prix: 3313,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/DJI_20251103174119_0176_D.jpg?v=1771442091'),
    texte: "Un bloc de résine moulée, texturé comme des strates rocheuses en dégradé de violet mat, creusé de deux assises concaves.",
    points: [['Matière', 'Résine moulée texturée'], ['Places', '2 assises concaves']],
    look: { style: 'topo', couleur: '#6E4C86' } });

  /* --- Salle de bain --- */
  def('wa5043', { nom: 'Bicolore Bologna', titre: 'Baignoire îlot ovale en acrylique noir mat et blanc', cat: 'Baignoire îlot', prix: 450,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/9252788203010bc38fdb212d5cdf5147.png?v=1780175102'),
    texte: "Une coque extérieure noir mat et une cuve intérieure blanc brillant, en forme ovale galbée. Autoportante, elle se pose au centre de la pièce, face à la fenêtre.",
    points: [['Matière', 'Acrylique 3 mm'], ['Finition', 'Noir mat, intérieur blanc brillant'], ['Pose', 'Autoportante']],
    look: { style: 'ovale', ext: '#1F1D22', int: '#F6F4EF' } });
  def('wa908', { nom: 'Baignoire Griffe', titre: 'Baignoire îlot rétro en acrylique blanc, pieds griffe dorés', cat: 'Baignoire îlot', prix: 450,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/df5c58a6cff74895a063b5b4c771621b.png?v=1751297467'),
    texte: "Une forme slipper à dossier incliné, sur quatre pieds griffe finition dorée. 140 × 74 × 78 cm.",
    points: [['Matière', 'Acrylique 3 mm'], ['Dimensions', '140 × 74 × 78 cm'], ['Pieds', 'Griffe, finition dorée']],
    look: { style: 'griffe', ext: '#F4F2EC', int: '#FBFAF6' } });
  def('wa5052-stripe', { nom: 'WA5052 Stripe', titre: 'Baignoire îlot en acrylique cannelé blanc mat', cat: 'Baignoire îlot', prix: 450,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/e16faa3049048b065588031c44078e64.jpg?v=1751297456'),
    texte: "Une baignoire îlot ovale à cannelures verticales moulées, extérieur blanc mat et intérieur blanc brillant.",
    points: [['Matière', 'Acrylique 3 mm'], ['Paroi', 'Cannelée, blanc mat']],
    look: { style: 'cannelee', ext: '#EEEBE4', int: '#FBFAF6' } });

  /* --- Art --- */
  def('gcw-art-2407', { nom: 'Golden Circle Walker', titre: 'Sculpture en bronze silhouette et anneau LED', cat: 'Sculpture', prix: 620,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-1105.18.34.jpg?v=1780104250'),
    texte: "Une silhouette en marche, finition bronze, tenant un anneau à ruban LED doré, sur un socle noir mat. Pensée pour un hall d'entrée ou un espace de réception.",
    points: [['Matière', 'Résine finition bronze'], ['Dimensions', 'Environ 60 × 30 × 130 cm'], ['Éclairage', 'Anneau LED doré']],
    look: { style: 'marcheur' } });
  def('sculpture-dexterieur-discobole-antique-avec-anneau-lumineux', { nom: 'Discobole', titre: "Sculpture d'extérieur Discobole antique avec anneau lumineux", cat: 'Sculpture', prix: 0, brouillon: true,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/KsH9qlfLo7PSSHhR_zzjTZBjFJ1_oUnPKQmIWBuwxx8.jpg?v=1789585172'),
    texte: "La silhouette du Discobole antique en composite minéral blanc, au centre d'un anneau LED sous diffuseur opale. Pour les parcs et les grandes réceptions.",
    points: [['Matière', 'Composite minéral, aspect pierre'], ['Éclairage', 'Anneau LED continu'], ['Usage', 'Extérieur']],
    look: { style: 'discobole' } });

  /* --- Extérieur --- */
  def('bulle-dexterieur-xxl-espace-bar-et-reception', { nom: 'Bulle XXL', titre: "Bulle d'extérieur XXL espace bar et réception", cat: 'Véranda bulle', prix: 0, brouillon: true, img: null,
    texte: "Une structure géodésique fermée, habillée de panneaux transparents, qui abrite un bar ou un lounge de réception avec une vue continue à 360°.",
    points: [['Structure', 'Géodésique, métal'], ['Parois', 'Panneaux transparents'], ['Usage', 'Bar, lounge, réception']],
    look: { style: 'geodesique' } });
  def('bulle-dexterieur-panoramique-avec-porte-vitree', { nom: 'Bulle Panoramique', titre: "Bulle d'extérieur panoramique avec porte vitrée", cat: 'Chambre bulle', prix: 0, brouillon: true, img: null,
    texte: "Un pavillon hémisphérique de 360 cm de diamètre : structure en aluminium thermolaqué noir, parois cintrées transparentes, porte battante vitrée et aération zénithale.",
    points: [['Diamètre', '360 cm'], ['Structure', 'Aluminium thermolaqué noir'], ['Accès', 'Porte battante vitrée']],
    look: { style: 'bulle', diametre: 3.6 } });
  def('dome-transparent-spherique-pour-salon-de-jardin', { nom: 'Dôme Sphérique', titre: 'Dôme transparent sphérique pour salon de jardin', cat: 'Véranda bulle', prix: 0, brouillon: true, img: null,
    texte: "Une bulle hémisphérique transparente sur armature en aluminium noir, jusqu'à 250 cm de haut, pour un salon privatif abrité sur 360°.",
    points: [['Hauteur', 'Jusqu\'à 250 cm'], ['Structure', 'Aluminium noir'], ['Usage', 'Terrasse, salon privatif']],
    look: { style: 'bulle', diametre: 3.4 } });
  def('fontaine-xxl', { nom: 'Fontaine monumentale', titre: 'Fontaine à vasques, jusqu\'à 7 m de diamètre', cat: 'Fontaine', prix: 0, brouillon: true, img: null,
    texte: "Une fontaine à vasques étagées dont le bassin peut atteindre 7 mètres de diamètre, dessinée pour votre jardin et réalisée sur mesure.",
    points: [['Bassin', 'Jusqu\'à 7 m de diamètre'], ['Réalisation', 'Sur mesure']],
    look: { style: 'fontaine' } });
  def('fc-1200', { nom: 'Fire Circle', titre: "Salon d'extérieur modulaire en tissu bouclette et métal à inserts laiton", cat: 'Salon extérieur', prix: 1200,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0818.00.31.jpg?v=1780096339'),
    texte: "Des modules courbes en bouclette qui forment un cercle presque fermé autour d'une table basse à brasero en verre. De 8 à 10 places.",
    points: [['Revêtement', 'Bouclette écru ou chenille anthracite'], ['Places', '8 à 10'], ['Table', 'Brasero en verre intégré']],
    look: { style: 'feu' } });
  def('jardiniere-boule-resine-blanche-orga', { nom: 'Orga', titre: 'Jardinière boule en résine blanche mate', cat: 'Jardinière', prix: 80,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/OkW5_cdtldx7wXOX0D0a0avkvdaMNbnE-i1PYyFzVY.png?v=1780093347'),
    texte: "Une jardinière sphérique en résine composite blanche mate, d'environ 80 cm de diamètre, pour arbustes, palmiers ou petits arbres.",
    points: [['Matière', 'Résine composite blanche mate'], ['Diamètre', 'Environ 80 cm']],
    look: { style: 'orga' } });
  def('nl-550', { nom: 'Natura Lounge', titre: 'Salon de jardin en corde tressée et aluminium', cat: 'Salon de jardin', prix: 550,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0817.29.52.jpg?v=1780095872'),
    texte: "Un canapé trois places, deux fauteuils et une table basse en corde tressée naturelle sur aluminium, avec des coussins gris foncé déhoussables.",
    points: [['Structure', 'Aluminium, corde tressée'], ['Composition', 'Canapé 3 places, 2 fauteuils, table basse']],
    look: { style: 'corde', coussins: '#55575A' } });
  def('zg-550', { nom: 'Zen Garden', titre: 'Salon de jardin en corde tressée et coussins verts', cat: 'Salon de jardin', prix: 550,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0817.31.08.jpg?v=1780095890'),
    texte: "Un canapé trois places, deux fauteuils, une table basse et une table d'appoint, en aluminium effet bois grisé et corde tressée, avec des coussins vert olive.",
    points: [['Structure', 'Aluminium effet bois grisé'], ['Coussins', 'Tissu déperlant vert olive']],
    look: { style: 'corde', coussins: '#6F7446' } });
  def('hl-550', { nom: 'Horizon Lounge', titre: "Méridienne d'extérieur en fibre tressée grise", cat: 'Méridienne', prix: 550,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/2026-04-0817.33.15.jpg?v=1780095967'),
    texte: "Une méridienne incurvée d'environ 180 cm en fibre tressée grège, sur un piètement fin en aluminium noir mat, avec des coussins gris clair et anthracite.",
    points: [['Structure', 'Fibre tressée, aluminium noir'], ['Longueur', 'Environ 180 cm']],
    look: { style: 'meridienne' } });
  def('balancelles-duo-auvent-corde-tressee-vis-a-vis', { nom: 'Vis-à-Vis', titre: 'Ensemble balancelles duo à auvent en corde tressée', cat: 'Balancelles', prix: 6000,
    img: IMG('https://cdn.shopify.com/s/files/1/0938/1055/7195/files/DJI_20251101173126_0232_D.jpg?v=1771442155'),
    texte: "Deux balancelles à auvent, face à face autour d'une table ronde : métal thermolaqué sable, corde tressée beige et gris, auvent en toile beige.",
    points: [['Structure', 'Métal thermolaqué sable'], ['Assises', 'Corde tressée bicolore'], ['Places', '2 balancelles']],
    look: { style: 'balancelles' } });

  /* ---------------------------------------------------------------
     Catalogue complet (window.MC_CATALOGUE, généré depuis Shopify par
     outils/catalogue.py) : toutes les pièces actives de la boutique.
     Les pièces choisies ci-dessus gardent leur texte et leur maquette
     détaillée ; les autres reçoivent une maquette générique (famille,
     style, dimensions, couleurs, matière).
     --------------------------------------------------------------- */
  const CAT = window.MC_CATALOGUE || { base: '', p: {} };
  const LIBELLES = { lit: 'Lit', fauteuil: 'Fauteuil', canape: 'Canapé', suspension: 'Suspension', lustre: 'Lustre', applique: 'Applique',
    lampadaire: 'Lampadaire', plafonnier: 'Plafonnier', lampe: 'Lampe', baignoire: 'Baignoire îlot', tabouret: 'Tabouret de bar', banc: 'Banc',
    pouf: 'Pouf', meuble: 'Buffet', table: 'Table', tapis: 'Tapisserie', miroir: 'Miroir', sculpture: 'Sculpture', balancelle: 'Balancelles',
    jardiniere: 'Jardinière', meridienne: 'Méridienne', 'salon-jardin': 'Salon de jardin', deco: 'Décoration' };
  const MATIERES = { velours: 'Velours', cuir: 'Cuir', boucle: 'Bouclette', tissu: 'Tissu', corde: 'Corde tressée', laque: 'Résine laquée',
    fourrure: 'Fourrure', bois: 'Bois', cristal: 'Cristal', verre: 'Verre', albatre: 'Albâtre', acrylique: 'Acrylique', metal: 'Métal' };
  const FINITIONS = { laiton: 'métal doré', chrome: 'métal chromé' };
  // famille des pièces choisies absentes du catalogue actif (sur mesure)
  const FAM_CAT = { 'Véranda bulle': 'bulle', 'Chambre bulle': 'bulle', Fontaine: 'fontaine', Sculpture: 'sculpture' };
  const urlImg = (chemin, w) => chemin ? (/^https?:/.test(chemin) ? chemin : CAT.base + chemin) + (w ? (chemin.indexOf('?') > -1 ? '&' : '?') + 'width=' + w : '') : null;
  const cm = v => Math.round(v * 100);
  const majuscule = s => s.charAt(0).toUpperCase() + s.slice(1);
  function texteDims(fam, d, lues) {
    const rond = ['suspension', 'lustre', 'plafonnier', 'jardiniere', 'pouf'].includes(fam) && Math.abs(d[0] - d[1]) < .01;
    const t = rond ? 'Ø ' + cm(d[0]) + ' × H ' + cm(d[2]) + ' cm' : cm(d[0]) + ' × ' + cm(d[1]) + ' × ' + cm(d[2]) + ' cm';
    return (lues ? '' : 'Environ ') + t;
  }
  function depuisCatalogue(h, c) {
    const fam = c.f;
    const cat = fam === 'baignoire' && /balneo|angle/.test(c.s) ? 'Baignoire balnéo'
      : fam === 'meuble' && /^Console/.test(c.t) ? 'Console' : LIBELLES[fam] || 'Pièce';
    const points = [['Dimensions', texteDims(fam, c.d, c.dt) + (c.dt ? '' : ' (estimation)')]];
    if (c.cou) points.push(['Couchage', cm(c.cou[0]) + ' × ' + cm(c.cou[1]) + ' cm']);
    points.push(['Matière', (MATIERES[c.m] || 'Tissu') + (FINITIONS[c.me] && !['laiton', 'chrome'].includes(c.m) ? ', ' + FINITIONS[c.me] : '')]);
    if (c.cn && c.cn.length) points.push(['Coloris', majuscule(c.cn.join(', '))]);
    if (c.pm) points.push(['Prix', 'Par module']);
    return {
      id: h, nom: c.n, titre: c.t, cat, prix: c.x || 0, prixMax: c.xm, parModule: !!c.pm,
      img: urlImg(c.i, 900), vign: urlImg(c.i, 360), imgs: (c.g || []).map(u => urlImg(u, 900)),
      texte: c.tx || c.t, points, url: URL(h),
      fam, st: c.s || '', dim: c.d, dimsLues: !!c.dt, dimsTexte: texteDims(fam, c.d, c.dt),
      cols: c.c || [], couleurs: c.cn || [], fc: c.fc || '', mat: c.m || 'tissu', metal: c.me || 'noir', bois: c.b || '', verre: c.v || '',
      led: !!c.led, chevets: !!c.ch, ext: !!c.ext, couchage: c.cou || null, boutique: true
    };
  }
  Object.keys(CAT.p).forEach(h => {
    const q = depuisCatalogue(h, CAT.p[h]);
    if (!P[h]) { P[h] = q; return; }
    // pièce choisie : texte et maquette d'origine, données de la boutique pour le reste
    Object.keys(q).forEach(k => { if (P[h][k] === undefined) P[h][k] = q[k]; });
    P[h].boutique = true;
  });
  Object.keys(P).forEach(h => { if (!P[h].fam) P[h].fam = FAM_CAT[P[h].cat] || ''; });
  // dimensions corrigées d'après les photos des produits (fiche absente ou manifestement fausse) : [l, p, h] en m
  const DIMS = {
    'boxing-glove': [.82, 1.6, .8]
  };
  Object.keys(DIMS).forEach(h => { if (P[h]) { P[h].dim = DIMS[h]; P[h].dimsLues = false; } });

  /* ---------------------------------------------------------------
     Les six espaces de la visite. Chaque emplacement propose un choix
     par défaut et des variantes ; qte = nombre de pièces par espace.
     Échanges avec le catalogue complet :
       fam  : familles acceptées à cet emplacement
       max  : [largeur, profondeur, hauteur] maximales en m (null = libre)
       min  : idem, minimales
       sans : styles exclus ; ext : true = extérieur seulement, false = intérieur seulement
     (les pièces proposées par Maison Corleone restent toujours disponibles)
     photo : photo de l'espace (chemin ou URL publique), envoyée au rendu
     réaliste pour l'architecture et la lumière ; null tant qu'on n'en a pas.
     monde : future 3D réelle (Marble). Renseigner { spz, echelle } pour
     remplacer la maquette générique de l'espace.
     --------------------------------------------------------------- */
  const ESPACES = [
    { id: 'deluxe', nom: 'Chambre Deluxe', type: 'Chambre', quantite: 10, unite: 'chambres', maquette: '4,2 × 6 m', photo: 'img/chambre-deluxe.webp',
      accroche: 'La chambre de référence',
      texte: "Tête de lit en cuir, lumière chaude et un vrai fauteuil : la Deluxe donne le ton de tout l'hôtel.",
      emplacements: [
        { id: 'lit', label: 'Le lit', choix: ['rce-05', 'ec-01', 'bed-410', 'nd-01'], qte: 1, fam: ['lit'], max: [3.1, 2.4, 1.6] },
        { id: 'suspension', label: 'La suspension de chevet', choix: ['lst-min-03', 'scg-light-2421', 'sus-lnb-34'], qte: 1, fam: ['suspension'], max: [.95, .95, null], sans: ['lineaire'] },
        { id: 'fauteuil', label: 'Le fauteuil', choix: ['terracotta', 'abbraccio', 'fauteuil-velours-terracotta-pietement-plein-terra'], qte: 1, fam: ['fauteuil'], max: [1.15, 1.15, 1.35], sans: ['suspendu'], ext: false },
        { id: 'applique', label: "L'applique", choix: ['wom-wall-2414', 'mc-wall-3347', 'ssl-wall-2423'], qte: 1, fam: ['applique'], max: [.7, null, 1] }
      ], monde: null },
    { id: 'junior', nom: 'Junior Suite', type: 'Suite', quantite: 4, unite: 'suites', maquette: '6,5 × 7 m',
      accroche: 'Un salon dans la chambre',
      texte: "Le coin salon devient une vraie pièce à vivre : on y reçoit, on y travaille, on s'y pose entre deux vols.",
      emplacements: [
        { id: 'lit', label: 'Le lit', choix: ['bed-410', 'rcb-05', 'cbb-03'], qte: 1, fam: ['lit'], max: [3.2, 2.4, 1.6] },
        { id: 'canape', label: 'Le canapé', choix: ['sofa-220', 'cm-950', 'mcs-01'], qte: 1, fam: ['canape'], max: [3.4, 2.1, null], ext: false },
        { id: 'fauteuil', label: 'Le fauteuil', choix: ['bubble-art', 'classica'], qte: 1, fam: ['fauteuil'], max: [1.3, 1.3, 1.5], sans: ['suspendu'], ext: false },
        { id: 'suspension', label: 'La suspension', choix: ['arc-slk-2203', 'sus-clh-21', 'wave-line'], qte: 1, fam: ['suspension'], max: [1.5, 1.5, null] },
        { id: 'lampadaire', label: 'Le lampadaire', choix: ['fpf-lamp-7705'], qte: 1, fam: ['lampadaire'] }
      ], monde: null },
    { id: 'presidentielle', nom: 'Suite Présidentielle', type: 'Suite', quantite: 1, unite: 'suite', maquette: '10 × 8 m + terrasse',
      accroche: 'La pièce maîtresse',
      texte: "Lustre de cristal, baignoire îlot face à la fenêtre et bulle privative sur la terrasse : une suite dont on parle en rentrant.",
      emplacements: [
        { id: 'lit', label: 'Le lit', choix: ['lhs-15', 'ecp-12', 'cr-06'], qte: 1, fam: ['lit'], max: [3.4, 2.4, 1.7] },
        { id: 'lustre', label: 'Le lustre', choix: ['scg-light-2409', 'fgc-light-2420', 'crp-light-2408'], qte: 1, fam: ['lustre', 'suspension'], max: [2, 2, null], min: [.45, null, null] },
        { id: 'baignoire', label: 'La baignoire', choix: ['wa5043', 'wa908', 'wa5052-stripe'], qte: 1, fam: ['baignoire'], max: [1.9, 1.25, null], sans: ['angle'] },
        { id: 'canape', label: 'Le canapé', choix: ['mcs-01', 'com-600'], qte: 1, fam: ['canape'], max: [3.6, 2, null], ext: false },
        { id: 'fauteuil', label: 'Le fauteuil', choix: ['prusse', 'diamond-cream'], qte: 1, fam: ['fauteuil'], max: [1.65, 1.45, 2], ext: false },
        { id: 'bulle', label: 'La bulle de terrasse', choix: ['dome-transparent-spherique-pour-salon-de-jardin'], qte: 1 }
      ], monde: null },
    { id: 'lobby', nom: 'Lobby et lounge', type: 'Espace commun', quantite: 1, unite: 'espace', maquette: '11 × 9 m, double hauteur',
      accroche: "L'arrivée",
      texte: "Un lustre monumental, un salon circulaire et des sculptures : l'attente devient un accueil dès la porte franchie.",
      emplacements: [
        { id: 'lustre', label: 'Le lustre monumental', choix: ['cmc-light-2413', 'ols-arch-30', 'isr-light-2411'], qte: 1, fam: ['lustre', 'suspension'], max: [3.2, 3.2, null], min: [.8, null, null] },
        { id: 'canape', label: 'Le salon circulaire', choix: ['cls-je88'], qte: 1, fam: ['canape'], max: [4.9, 4.5, null], ext: false },
        { id: 'fauteuils', label: 'Les fauteuils', choix: ['cognac-shell', 'cigar-1919'], qte: 4, fam: ['fauteuil'], max: [1.15, 1.15, 1.4], sans: ['suspendu'], ext: false },
        { id: 'banc', label: 'Le banc sculpture', choix: ['banc-sculptural-resine-violette-topographie'], qte: 1, fam: ['banc', 'pouf'], max: [2.4, 1.1, null], ext: false },
        { id: 'sculpture', label: 'La sculpture', choix: ['gcw-art-2407'], qte: 1, fam: ['sculpture'], max: [1.6, 1.2, 2.2] }
      ], monde: null },
    { id: 'bar', nom: 'Le grand bar', type: 'Véranda bulle', quantite: 1, unite: 'espace', maquette: 'Bulle de 10 m',
      accroche: 'Sous la bulle',
      texte: "Une bulle géodésique abrite le bar : un lieu singulier, pensé comme une expérience pour vos clients, de jour comme de nuit.",
      emplacements: [
        { id: 'bulle', label: 'La bulle', choix: ['bulle-dexterieur-xxl-espace-bar-et-reception'], qte: 1 },
        { id: 'tabourets', label: 'Les tabourets', choix: ['fleur-de-nuit', 'orange-diamond-barstool'], qte: 6, fam: ['tabouret'], min: [null, null, .7] },
        { id: 'suspensions', label: 'Les suspensions', choix: ['gbc-orbit-7734', 'gbc-light-2418'], qte: 3, fam: ['suspension'], max: [1, 1, null] },
        { id: 'salon', label: 'Le salon autour du feu', choix: ['fc-1200'], qte: 1, fam: ['salon-jardin'], max: [4.6, 4.6, null] },
        { id: 'jardinieres', label: 'Les jardinières', choix: ['jardiniere-boule-resine-blanche-orga'], qte: 4, fam: ['jardiniere'] }
      ], monde: null },
    { id: 'jardin', nom: 'Le jardin', type: 'Extérieur', quantite: 1, unite: 'espace', maquette: '15 × 16 m',
      accroche: 'Le point de repère',
      texte: "Une fontaine monumentale au centre, des chambres bulle dans les angles et le Discobole au bout de l'allée.",
      emplacements: [
        { id: 'fontaine', label: 'La fontaine', choix: ['fontaine-xxl'], qte: 1 },
        { id: 'bulles', label: 'Les chambres bulle', choix: ['bulle-dexterieur-panoramique-avec-porte-vitree'], qte: 2 },
        { id: 'sculpture', label: 'La sculpture', choix: ['sculpture-dexterieur-discobole-antique-avec-anneau-lumineux'], qte: 1, fam: ['sculpture'], max: [2, 1.5, 2.6], sans: ['arbre'] },
        { id: 'meridiennes', label: 'Les méridiennes', choix: ['hl-550'], qte: 4, fam: ['meridienne'], max: [2.3, 1.2, null] },
        { id: 'salon', label: 'Le salon de jardin', choix: ['nl-550', 'zg-550'], qte: 1, fam: ['salon-jardin', 'canape'], max: [5, 5, null], ext: true },
        { id: 'balancelles', label: 'Les balancelles', choix: ['balancelles-duo-auvent-corde-tressee-vis-a-vis'], qte: 1, fam: ['balancelle'] }
      ], monde: null }
  ];

  /* ---------------------------------------------------------------
     Pièces compatibles avec un emplacement : les propositions d'abord,
     puis le catalogue de même famille, aux dimensions de l'emplacement
     --------------------------------------------------------------- */
  const COMPAT = {};
  function compatibles(eid, sid) {
    const cle = eid + ':' + sid;
    if (COMPAT[cle]) return COMPAT[cle];
    const e = ESPACES.find(x => x.id === eid), s = e && e.emplacements.find(x => x.id === sid);
    if (!s) return [];
    const liste = s.choix.slice();
    if (s.fam) {
      Object.keys(P).forEach(h => {
        const p = P[h];
        if (liste.includes(h) || !p.boutique || !p.dim || !s.fam.includes(p.fam)) return;
        if (s.sans && s.sans.includes(p.st)) return;
        if (s.ext === true && !p.ext) return;
        if (s.ext === false && p.ext) return;
        for (let i = 0; i < 3; i++) {
          if (s.max && s.max[i] != null && p.dim[i] > s.max[i] + 1e-6) return;
          if (s.min && s.min[i] != null && p.dim[i] < s.min[i] - 1e-6) return;
        }
        liste.push(h);
      });
    }
    COMPAT[cle] = liste;
    return liste;
  }

  return { CONFIG, PRODUITS: P, ESPACES, compatibles, MATIERES, LIBELLES };
})();

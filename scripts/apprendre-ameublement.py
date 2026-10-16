#!/usr/bin/env python3
"""Calibre des repères agrégés SSR-3DFRONT, sans copier de scène ni de maillage.

Usage : python scripts/apprendre-ameublement.py /chemin/des/fichiers
Dépendances d'analyse uniquement : pyarrow et shapely. Aucun serveur/GPU requis.
"""
import argparse
import collections
import hashlib
import json
import math
import re
import zipfile
from pathlib import Path

import pyarrow.parquet as pq
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

ROLES = [
    ('meuble-tv', r'\b(?:tv|television|media)\s+(?:stand|cabinet|console|unit)\b'),
    ('chevet', r'\b(?:night\s?stand|bedside\s+(?:table|cabinet|stand))\b'),
    ('table-basse', r'\b(?:coffee|cocktail)\s+table\b'),
    ('table-repas', r'\b(?:dining|dinner)\s+(?:room\s+)?table\b'),
    ('table-appoint', r'\b(?:side|end|accent)\s+table\b'),
    ('bureau', r'\b(?:desk|writing\s+table|dressing\s+table|vanity\s+(?:table|desk))\b'),
    ('armoire', r'\b(?:wardrobe|closet)\b'),
    ('rangement', r'\b(?:sideboard|dresser|chest\s+of\s+drawers|credenza|bookcase|bookshelf|cabinet)\b'),
    ('lit', r'\b(?:bed|bunk\s+bed)\b'),
    ('canape', r'\b(?:sofa|couch|loveseat|sectional)\b'),
    ('fauteuil', r'\b(?:arm\s?chair|lounge\s+chair|accent\s+chair|wingback\s+chair|recliner)\b'),
    ('chaise', r'\bchair\b'),
    ('tabouret', r'\bstool\b'),
    ('banc', r'\bbench\b'),
    ('pouf', r'\b(?:ottoman|pouf)\b'),
    ('tapis', r'\b(?:rug|carpet)\b'),
    ('suspension', r'\b(?:pendant|chandelier|ceiling\s+(?:light|lamp))\b'),
    ('lampadaire', r'\bfloor\s+lamp\b'),
    ('lampe', r'\btable\s+lamp\b'),
]
SOL = {'lit','canape','fauteuil','chaise','tabouret','banc','pouf','chevet','table-basse','table-repas','table-appoint','bureau','armoire','rangement','meuble-tv','lampadaire'}
BORNES = [12, 20, 35, 60, 120, math.inf]
QUANTILES = [.1, .25, .5, .75, .9]


def role(description):
    """Premier nom de meuble : une lampe « beside a bed » reste une lampe."""
    candidats = []
    for ordre, (nom, patron) in enumerate(ROLES):
        m = re.search(patron, str(description or '').lower())
        if m:
            candidats.append((m.start(), ordre, nom))
    return min(candidats)[2] if candidats else None


def quantiles(valeurs):
    vs = sorted(v for v in valeurs if math.isfinite(v))
    if not vs:
        return None
    def q(p):
        i = (len(vs) - 1) * p
        a, b = math.floor(i), math.ceil(i)
        return round(vs[a] + (vs[b] - vs[a]) * (i-a), 4)
    return {'n': len(vs), 'q10': q(.1), 'q25': q(.25), 'q50': q(.5), 'q75': q(.75), 'q90': q(.9)}


def groupe(row):
    match = re.match(r'^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', row['file_id'])
    if not match:
        raise ValueError('Identifiant de logement non reconnu')
    return match.group()


def extraire(row):
    scene = row['scene']
    try:
        plan = Polygon([(float(v[0]), float(v[2])) for v in scene['bounds_bottom']])
    except (TypeError, ValueError, IndexError):
        return None, 'contour-invalide'
    if not plan.is_valid or not 4 <= plan.area <= 250:
        return None, 'contour-invalide'
    objets, rejetes = [], collections.Counter()
    for o in scene['objects']:
        r = role(o.get('desc'))
        if r not in SOL:
            rejetes['role-non-calibre'] += 1
            continue
        dim, pos, quat = o.get('size'), o.get('pos'), o.get('rot')
        if not (dim and len(dim)==3 and pos and len(pos)==3 and quat and len(quat)==4):
            rejetes['vecteur-invalide'] += 1
            continue
        if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in dim+pos+quat) or not all(.06 <= v <= 8 for v in dim):
            rejetes['dimension-invalide'] += 1
            continue
        norme = math.sqrt(sum(v*v for v in quat))
        if norme < .95 or norme > 1.05:
            rejetes['quaternion-invalide'] += 1
            continue
        x,y,z,w = [v/norme for v in quat]
        if abs(x)+abs(z) > .04:
            rejetes['objet-incline'] += 1
            continue
        angle = math.atan2(2*(w*y+x*z), 1-2*(y*y+x*x))
        c,s = math.cos(angle),math.sin(angle)
        largeur,hauteur,profondeur = dim
        points = [(pos[0]+c*a+s*b,pos[2]-s*a+c*b) for a,b in [(-largeur/2,-profondeur/2),(largeur/2,-profondeur/2),(largeur/2,profondeur/2),(-largeur/2,profondeur/2)]]
        boite = Polygon(points)
        if not plan.buffer(.03).covers(boite) or boite.intersection(plan).area/boite.area < .985:
            rejetes['hors-contour'] += 1
            continue
        objets.append({'role':r,'w':largeur,'d':profondeur,'h':hauteur,'x':pos[0],'z':pos[2],'rot':angle,'boite':boite})
    if len(objets) < 2:
        return None, 'pas-assez-de-mobilier-valide'
    type_piece = 'chambre' if row['room_type']=='bedroom' else 'salon' if row['room_type']=='livingroom' else None
    if type_piece is None:
        if any(o['role']=='bureau' for o in objets) and not any(o['role'] in ['canape','lit'] for o in objets):
            type_piece = 'bureau'
        elif any(o['role']=='table-repas' for o in objets) and not any(o['role'] in ['canape','lit'] for o in objets):
            type_piece = 'salle_a_manger'
    if not type_piece:
        return None, 'fonction-non-identifiee'
    occupation = unary_union([o['boite'] for o in objets]).intersection(plan).area/plan.area
    return {'fonction':type_piece,'surface':plan.area,'plan':plan,'objets':objets,'occupation':occupation,'rejetsObjets':dict(rejetes)}, None


def local(a,b):
    dx,dz=b['x']-a['x'],b['z']-a['z'];c,s=math.cos(a['rot']),math.sin(a['rot'])
    return c*dx-s*dz,s*dx+c*dz


def relations(scene):
    os=scene['objets'];sortie=[]
    for o in os:
        if o['role']=='lit':
            c,s=math.cos(o['rot']),math.sin(o['rot'])
            point=Point(o['x']-s*o['d']/2,o['z']-c*o['d']/2)
            d=point.distance(scene['plan'].boundary)
            if d <= 1:
                sortie.append(('tete-lit-mur',d))
        if o['role'] not in ['chevet','table-basse','chaise']:
            continue
        cible={'chevet':'lit','table-basse':'canape','chaise':'table-repas'}[o['role']]
        ancres=[a for a in os if a['role']==cible]
        if not ancres:
            continue
        a=min(ancres,key=lambda a:math.hypot(o['x']-a['x'],o['z']-a['z']))
        dx,dz=local(a,o);angle=o['rot']-a['rot']
        wx=abs(math.cos(angle))*o['w']+abs(math.sin(angle))*o['d']
        dzdim=abs(math.sin(angle))*o['w']+abs(math.cos(angle))*o['d']
        if cible=='lit' and abs(dx)<a['w']/2+wx/2+.8 and -.8<dz/a['d']<-.12:
            gap=abs(dx)-a['w']/2-wx/2
            if -.05<=gap<=.8:
                sortie.extend([('chevet-recul',dz/a['d']),('chevet-ecart',gap),('chevet-largeur',o['w']/a['w'])])
        elif cible=='canape' and 0<dz<a['d']/2+dzdim/2+1.2 and abs(dx)<a['w']/2:
            gap=dz-a['d']/2-dzdim/2
            if -.08<=gap<=1.2 and .2<wx/a['w']<1.4:
                sortie.extend([('table-canape-largeur',wx/a['w']),('table-canape-ecart',gap),('table-canape-decentrage',abs(dx)/a['w'])])
        elif cible=='table-repas' and math.hypot(dx,dz)<max(a['w'],a['d'])/2+1.2:
            v=(a['x']-o['x'],a['z']-o['z']);n=math.hypot(*v)
            face=(math.sin(o['rot'])*v[0]+math.cos(o['rot'])*v[1])/max(n,.01)
            sortie.append(('chaise-repas-face',face))
    return sortie


def compiler(root, profil, rapport):
    lignes={s:pq.read_table(root/f'{s}-00000-of-00001.parquet').to_pylist() for s in ['train','val','test']}
    archive={'presente':False}
    if (root/'raw_scenes.zip').exists():
        with zipfile.ZipFile(root/'raw_scenes.zip') as z:
            noms=set(z.namelist());identiques=0
            for rs in lignes.values():
                for r in rs:
                    chemin='scenes/'+r['file_id']+'.json'
                    if chemin not in noms or z.getinfo(chemin).file_size>1000000:
                        raise ValueError('Archive brute incohérente avec les partitions')
                    if json.loads(z.read(chemin)) != r['scene']:
                        raise ValueError('La scène brute diffère du Parquet')
                    identiques+=1
            archive={'presente':True,'scenes':sum(n.endswith('.json') for n in noms),'scenesIdentiquesAuParquet':identiques,'horsPartitions':sum(n.endswith('.json') for n in noms)-identiques,'calibreesHorsPartitions':0}
    logements={s:{groupe(r) for r in rs} for s,rs in lignes.items()}
    # Les annotations *_train des fichiers val/test ne changent jamais leur partition.
    partitions={'train':[r for r in lignes['train'] if groupe(r) not in logements['val']|logements['test']],
                'val':[r for r in lignes['val'] if groupe(r) not in logements['test']],'test':lignes['test']}
    measures=collections.defaultdict(list);dimensions=collections.defaultdict(lambda:collections.defaultdict(list));densites=collections.defaultdict(list);rejets={};acceptes={};audit_relations={}
    for split,rs in partitions.items():
        rejets[split]=collections.Counter();acceptes[split]=collections.Counter();observations=collections.defaultdict(list)
        for row in rs:
            scene,err=extraire(row)
            if err:
                rejets[split][err]+=1;continue
            acceptes[split][scene['fonction']]+=1
            for k,v in relations(scene):
                observations[k].append(v)
                if split=='train':measures[k].append(v)
            if split!='train':continue
            fn=scene['fonction'];palier=next(i for i,b in enumerate(BORNES) if scene['surface']<=b)
            densites[f'{fn}:{palier}'].append(scene['occupation'])
            for o in scene['objets']:
                for cle in [f'{fn}:{o["role"]}',f'{fn}:{palier}:{o["role"]}']:
                    for axe in ['w','d','h']:dimensions[cle][axe].append(o[axe])
        audit_relations[split]={k:quantiles(v) for k,v in sorted(observations.items())}
    empreintes={s:hashlib.sha256((root/f'{s}-00000-of-00001.parquet').read_bytes()).hexdigest() for s in lignes}
    sortie={'version':'ssr-reperes-1','source':{'nom':'SSR-3DFRONT / ReSpace','citation':'Bucher & Armeni, ReSpace (2025), arXiv:2506.02459','licenceCarte':'MIT dans les métadonnées ; paragraphe de licence renvoyant aux conditions originales 3D-FRONT','meshesImportes':False,'scenesDistribuees':False,'empreintes':empreintes},
            'calibration':{'partition':'train physique, hors logements de val/test','scenesFichier':len(lignes['train']),'scenesSansLogementReserve':len(partitions['train']),'scenesRetenues':sum(acceptes['train'].values()),'fonctions':dict(acceptes['train'])},
            'bornesSurface':[12,20,35,60,120,None],
            'relations':{k:quantiles(v) for k,v in sorted(measures.items()) if len(v)>=30},
            'dimensions':{k:{a:quantiles(v) for a,v in axes.items()} for k,axes in sorted(dimensions.items()) if len(axes['w'])>=30},
            'occupation':{k:quantiles(v) for k,v in sorted(densites.items()) if len(v)>=30}}
    info={'version':sortie['version'],'archive':archive,'fichiers':{s:{'scenes':len(rs),'logements':len(logements[s]),'pieces':dict(collections.Counter(r['room_type'] for r in rs))} for s,rs in lignes.items()},
          'separationLogements':{s:{'retenus':len(partitions[s]),'exclus':len(lignes[s])-len(partitions[s])} for s in lignes},
          'scenesAdmissibles':{s:dict(v) for s,v in acceptes.items()},'rejets':{s:dict(v) for s,v in rejets.items()},'relationsHorsCalibration':audit_relations,
          'controle':{'physiqueTrainSeulement':True,'logementsCommunsApresFiltre':{a+'/'+b:len({groupe(r) for r in partitions[a]}&{groupe(r) for r in partitions[b]}) for a,b in [('train','val'),('train','test'),('val','test')]},'dimensions':'Source [largeur,hauteur,profondeur], application [largeur,profondeur,hauteur].','rotations':'Quaternions normalisés, axe Y ; objets inclinés exclus.','contours':'Polygones réels, emprises orientées, tolérance 3 cm et inclusion >=98,5 %.','ouvertures':'Absentes du dataset : les portes/fenêtres réelles restent contrôlées par RealRoom.'}}
    for path,data in [(profil,sortie),(rapport,info)]:
        path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'calibration':sortie['calibration'],'relations':sortie['relations'],'separation':info['separationLogements'],'profilsDimensions':len(sortie['dimensions']),'sortie':str(profil)},ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('donnees',type=Path)
    parser.add_argument('--profil',type=Path,default=Path('data/ameublement/profils.json'))
    parser.add_argument('--rapport',type=Path,default=Path('.data/ameublement-reference/analyse.json'))
    args=parser.parse_args();compiler(args.donnees,args.profil,args.rapport)

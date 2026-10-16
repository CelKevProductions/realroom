#!/usr/bin/env python3
"""Prépare localement des contours de test ; aucune scène publiée."""
import importlib.util
import json
import sys
from pathlib import Path
import pyarrow.parquet as pq

spec=importlib.util.spec_from_file_location('apprendre',Path(__file__).with_name('apprendre-ameublement.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
rows=pq.read_table(Path(sys.argv[1])/'test-00000-of-00001.parquet').to_pylist()
choisis={}
for row in sorted(rows,key=lambda r:r['file_id']):
    scene,erreur=module.extraire(row)
    if erreur or scene['fonction'] not in ['chambre','salon']:
        continue
    aire=scene['surface']
    if not 8<=aire<=45:
        continue
    palier='petit' if aire<14 else 'moyen' if aire<24 else 'grand'
    ps=[(p[0],p[2]) for p in row['scene']['bounds_bottom']]
    concave=abs(scene['plan'].convex_hull.area-aire)>.1
    cle=(scene['fonction'],palier,concave)
    if cle in choisis:
        continue
    xs=[p[0] for p in ps];zs=[p[1] for p in ps];L=max(xs)-min(xs);P=max(zs)-min(zs)
    if min(L,P)<2.4 or max(L,P)>10:
        continue
    cx=(min(xs)+max(xs))/2;cz=(min(zs)+max(zs))/2
    modele={'dims':{'largeur':L,'profondeur':P,'hauteur':2.6,'estimees':False},'contour':[[x-cx,z-cz] for x,z in ps],'murs':{},'sourceMesures':'SSR-test-sans-ouvertures'}
    choisis[cle]={'nom':'Test réservé · '+' · '.join([scene['fonction'],palier,'concave' if concave else 'rectangle']),'fonction':scene['fonction'],'modele':modele,'surface':round(aire,2),'ouverturesConnues':False}
p=Path('.data/ameublement-reference/contours-test.json');p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(list(choisis.values()),ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'cas':len(choisis),'chemin':str(p)}))

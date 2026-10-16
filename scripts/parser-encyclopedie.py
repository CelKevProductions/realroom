"""Parser déterministe : tables, listes abrégées, prose et provenance intégrales."""
import re,json,hashlib,sys,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCES=[Path(sys.argv[1]),Path(sys.argv[2])] if len(sys.argv)>2 else [ROOT.parent/'upload/Encyclopédie des pièces — zones, dispositions, meubles, objets.md',ROOT.parent/'upload/compass_artifact_wf-2511793a-8ee7-5543-a0c5-5b2e35ca6851_text_markdown.md']
def clean(s): return s.replace('\\_','_').strip().strip('*')
def slug(s): return re.sub(r'[^a-z0-9]+','_',unicodedata.normalize('NFD',clean(s)).encode('ascii','ignore').decode().lower()).strip('_')
def nombre(s):
 m=re.match(r'\s*(\d+(?:[,.]\d+)?)',s);return float(m[1].replace(',','.')) if m else None
def dims(s):
 s=s.replace(" par module", "")
 # Seuls les triplets explicitement fournis sont des dimensions complètes.
 m=re.search(r'(\d+(?:[,.]\d+)?)(?:[–-](\d+(?:[,.]\d+)?))?\s*[×x]\s*(\d+(?:[,.]\d+)?)(?:[–-](\d+(?:[,.]\d+)?))?\s*[×x]\s*(\d+(?:[,.]\d+)?)(?:[–-](\d+(?:[,.]\d+)?))?',s)
 if not m:return None
 q=[float((m[i] or '').replace(',','.')) for i in [1,3,5]]
 return [round(v/100,4) for v in q]
base={k:[] for k in ['zones','dispositions','meubles','props','regles','signature_moments','sections','sources','trous']}
base['version']='encyclopedie-1';base['documents']=[]
roomCodes=['CH','SAM','CU','BU','SDB','EN','BA','AN'];groupes={
'SL':['conversation','ecran_media','bar','lecture','feu','bibliotheque','musique_piano'],
'CH':['couchage','chevets','rangement_vetements','bureau_chambre','coiffeuse','lecture','banc_pied_de_lit','bebe','jeux_enfant','devoirs','tv_chambre','salle_eau_ouverte','sport_yoga','animal','boudoir_salon','bibliotheque','priere_meditation'],
'SAM':['table_repas','rangement_vaisselle','bar_desserte','coin_cafe'],
'CU':['plan_preparation','ilot','coin_repas_cuisine','cellier_garde_manger'],
'BU':['poste_travail','rangement_bureau','visio_fond','reunion_canape'],
'SDB':['baignoire','vasque','rangement_sdb'],'EN':['depose_cles'],'BA':['repas_exterieur'],
'AN':['couloir_galerie','palier_lecture','dressing_i','lavage_sechage']}
secondairesSL=['home_cinema','cafe','bureau_appoint','jeux_enfants','jeux_adultes','gaming','meditation_yoga','sport','animalier','cave_vin','collection_vitrine','hifi_vinyles','sieste_daybed','couchage_invites','vegetal','loisirs_creatifs','conversation_secondaire','recharge_depose']
def zoneDispo(piece,id):
 if piece=='SL':
  p=id.split('.');return secondairesSL[int(p[1])-1] if p[0]=='8' else groupes['SL'][int(p[0])-1]
 n=int(id.split('-')[1].split('.')[0]);return groupes[piece][min(n-1,len(groupes[piece])-1)]
def dispo(piece,id,row,line,doc):
 uid=piece+':'+id
 if any(x['uid']==uid for x in base['dispositions']):return
 geom=row.get('Placement (géométrie)',row.get('Géométrie',row.get('Disposition','')))
 base['dispositions'].append(dict(uid=uid,id=id,piece=piece,zone_id=zoneDispo(piece,id),nom=row.get('Disposition',geom),geometrie=geom,conditions=row.get("Conditions d'usage",row.get('Conditions','')),avantage=row.get('Avantage',row.get('+','')),limite=row.get('Limite',row.get('−','')),ligne=line,document=doc,donnees=row,meubles=[]))
for doc,file in enumerate(SOURCES,1):
 text=file.read_text();lines=text.splitlines();piece='SL' if doc==1 else 'CH';section='intro';headers=[];couverture=[]
 base['documents'].append(dict(id=doc,nom=file.name,sha256=hashlib.sha256(text.encode()).hexdigest(),lignes=len(lines)))
 for i,line in enumerate(lines,1):
  if not line.strip():couverture.append(i);continue
  if doc==2 and (m:=re.match(r'# (\d)\. ',line)):piece=roomCodes[int(m[1])-1];section='intro'
  if re.search(r'Récapitulatif',line):section='recap'
  elif m:=re.match(r'#{2,3} ([A-G])\. ',line):section=m[1]
  if line.startswith('|'):
   cells=[clean(s) for s in re.split(r'(?<!\\)\|',line)[1:-1]]
   if all(re.match(r'^:?-+:?$',c) for c in cells):couverture.append(i);continue
   if not headers or (i>1 and not lines[i-2].startswith('|')):headers=cells;couverture.append(i);continue
   row=dict(zip(headers,cells));ref=dict(document=doc,ligne=i,donnees=row)
   ident=cells[0]
   if (doc==1 and re.fullmatch(r'\d+\.\d+(?:\.\d+)?',ident)) or re.fullmatch(r'(?:CH|SAM|CU|BU|SDB|EN|BA)-\d+\.\d+',ident):dispo(piece,ident,row,i,doc)
   elif section=='recap' and 'zone' in headers[0].lower():
    sid=ident;uid=piece+':'+sid;val=cells[1];old=next((z for z in base['zones'] if z['uid']==uid),None)
    data=dict(uid=uid,id=sid,piece=piece,surfaceMin=nombre(val),surfaceSource=val,meublesSource=cells[2] if len(cells)>2 else '',propsSource=cells[3] if len(cells)>3 else '',dispositions=[],**ref)
    if old:old.update(data)
    else:base['zones'].append(data)
   elif section=='A':
    # Données de choix gardées et reliées au récapitulatif après lecture.
    base['sections'].append(dict(type='zone-description',section=section,piece=piece,**ref))
   elif section=='C':
    nom=row.get('Meuble',ident);s=row.get('Dimensions types (cm)',row.get('L × P × H (cm)',row.get('Dimensions','')))
    base['meubles'].append(dict(uid=piece+':meuble:'+slug(nom),id=slug(nom),nom=nom,piece=piece,dim=dims(s),dimensionsSource=s,degagements=row.get('Dégagement devant / autour',row.get('Dégagements','')),**ref))
   elif section=='D' and doc==1:
    base['props'].append(dict(uid=piece+':prop:'+slug(ident),nom=ident,piece=piece,venteSource=cells[-1],vente='mixte' if 'B' in cells[-1] and 'S' in cells[-1] else 'S' if 'S' in cells[-1] else 'B',zonesSource=cells[1],**ref))
   elif section=='D':
    for j,m in enumerate(re.finditer(r'([^,;]+?)\s*\((S/B|B/S|S|B|B si[^)]+)\)', ' '.join(cells[1:]))):
     base['props'].append(dict(uid=f'{piece}:prop:{i}-{j}',nom=clean(m[1]),venteSource=m[2],vente='mixte' if '/' in m[2] or 'si' in m[2] else m[2],zonesSource=piece,piece=piece,**ref))
   elif section=='E' or (piece=='SL' and section=='intro' and headers[0]=='Règle'):
    brut=' '.join(cells);dur=bool(re.search(r'accessible|accessibilit|PMR|couchage haut|garde.corps',brut,re.I))
    base['regles'].append(dict(uid=piece+':regle:'+slug(ident),id=slug(ident),piece=piece,statut='dur' if dur else 'souple',statutSource='dur' if dur or 'INRS' in brut else 'souple',valeur=cells[1],source=' '.join(cells[2:]),certification=False,**ref))
   elif section=='F':base['signature_moments'].append(dict(uid=piece+':signature:'+slug(ident),zoneSource=ident,piece=piece,texte=' '.join(cells[1:]),**ref))
   elif piece=='AN':
    base['sections'].append(dict(type='annexe',section=section,piece=piece,**ref))
    for zid in cells[1].split(','):
     sid=clean(zid);base['zones'].append(dict(uid='AN:'+sid,id=sid,piece='AN',surfaceMin=None,surfaceSource=cells[-1],meublesSource='',propsSource='',dispositions=[],**ref))
    # Dispositions abrégées dans les annexes.
    prefix=None
    for m in re.finditer(r'(?:(AN)-)?(\d+)\.(\d+)\s+([^;|]+)',cells[2]):
     id=f'AN-{m[2]}.{m[3]}';dispo('AN',id,{'Géométrie':m[4]},i,doc)
   else:base['sections'].append(dict(type='table',section=section,piece=piece,**ref))
  else:
   headers=[]
   base['sections'].append(dict(document=doc,ligne=i,piece=piece,section=section,type='texte',texte=line))
   if section=='D':
    for j,m in enumerate(re.finditer(r'([^,;]+?)\s*\((S/B|B/S|S|B|B si[^)]+)\)',line)):
     nom=clean(m[1]);base['props'].append(dict(uid=f'{piece}:prop:{i}-{j}',nom=nom,venteSource=m[2],vente='mixte' if '/' in m[2] or 'si' in m[2] else m[2],zonesSource=piece,document=doc,ligne=i,piece=piece))
   if section=='F' and line.lstrip().startswith('-'):base['signature_moments'].append(dict(uid=f'{piece}:signature:{i}',texte=clean(line.lstrip('- ')),document=doc,ligne=i,piece=piece))
   if section=='B' and line.startswith('- **'):
    for m in re.finditer(r'(?:(CH|SAM|CU|BU|SDB|EN|BA)-)?(\d+)\.(\d+)\s+([^;]+)',line):
     id=f'{piece}-{m[2]}.{m[3]}';dispo(piece,id,{'Géométrie':m[4]},i,doc)
   if section=='intro' and piece=='AN' and line.startswith('Props annexes'):
    for j,m in enumerate(re.finditer(r'([^,;]+?)\s*\((S|B)\)',line)):base['props'].append(dict(uid=f'AN:prop:{i}-{j}',nom=clean(m[1]),vente=m[2],venteSource=m[2],document=doc,ligne=i,piece=piece))
   if re.match(r'- .*https?://',line) or (piece=='AN' and section=='intro' and re.match(r'\d+\. \[',line)):base['sources'].append(dict(document=doc,ligne=i,texte=line))
  couverture.append(i)
 assert len(set(couverture))==len(lines)
 base['documents'][-1]['lignesCouvertes']=len(set(couverture))
# Liens croisés explicitement décrits par les tomes, sans nouvelle disposition.
liens={
 'SL:repas_openspace':['SAM:table_repas'],'SL:cuisine_ouverte':['CU:plan_preparation','CU:ilot'],
 'SL:banquette_fenetre':['SL:lecture'],'SAM:banquette':['SAM:table_repas'],
 'CU:cuisson':['CU:plan_preparation'],'CU:lavage':['CU:plan_preparation'],'CU:froid':['CU:plan_preparation'],'CU:kitchenette_studio':['CU:plan_preparation'],
 'SDB:douche':['SDB:baignoire'],'SDB:wc_integre':['SDB:baignoire'],
 'EN:chaussures':['EN:depose_cles'],'EN:assise_chaussage':['EN:depose_cles'],'EN:vestiaire':['EN:depose_cles'],'EN:miroir_sortie':['EN:depose_cles'],
 'BA:detente_lounge':['BA:repas_exterieur'],'BA:bain_de_soleil':['BA:repas_exterieur'],'BA:potager_vegetal':['BA:repas_exterieur'],'BA:bar_ext':['BA:repas_exterieur'],
 'AN:couloir_bibliotheque':['AN:couloir_galerie'],'AN:couloir_rangement':['AN:couloir_galerie'],'AN:palier_rangement':['AN:palier_lecture'],
 'AN:dressing_l':['AN:dressing_i'],'AN:dressing_u':['AN:dressing_i'],'AN:ilot_dressing':['AN:dressing_i'],
 'AN:pliage':['AN:lavage_sechage'],'AN:repassage':['AN:lavage_sechage'],'AN:tri_linge':['AN:lavage_sechage']}
for z in base['zones']:
 z['renvoisZones']=liens.get(z['uid'],[])
 if z['piece']=='AN':
  ds=[d for d in base['dispositions'] if 'AN:'+d['zone_id'] in [z['uid']]+z['renvoisZones']]
  termes=['fauteuil','lampe','bibliothèque','console','coffre','placard','banc','miroir','machine','plan de pliage','bac','colonne']
  z['meublesSource']=', '.join(n for n in termes if any(n in d['geometrie'].lower() for d in ds))
  if 'lavage' in z['id']:z['meublesSource']+=' , machine'
  if z['id']=='lavage_sechage':base['meubles'].append(dict(uid='AN:meuble:machine',id='machine',nom='Machine',piece='AN',dim=dims(z['surfaceSource']),dimensionsSource=z['surfaceSource'],degagements='90 cm devant les hublots',document=z['document'],ligne=z['ligne']))
  base['regles'].append(dict(uid='AN:regle:'+z['id'],id=z['id'],piece='AN',valeur=z['surfaceSource'],statut='dur' if 'Garde-corps' in z['surfaceSource'] else 'souple',source='Cotes sourcées, annexe du tome 2',certification=False,document=z['document'],ligne=z['ligne']))
# Les meubles nommés uniquement dans les récapitulatifs sont des références
# explicites non cotées. Aucun dimensionnement ou SKU n'est fabriqué.
for z in base['zones']:
 z['meubles']=[]
 for nom in z['meublesSource'].split(','):
  nom=clean(nom)
  if not nom or nom=='—':continue
  m=next((m for m in base['meubles'] if m['piece']==z['piece'] and slug(m['nom'])==slug(nom)),None)
  if not m:
   m=dict(uid=z['piece']+':reference:'+slug(nom),id=slug(nom),nom=nom,piece=z['piece'],dim=None,dimensionsSource='Non cotée dans le récapitulatif',degagements='',definition='reference-sans-fiche',document=z['document'],ligne=z['ligne'])
   if not any(q['uid']==m['uid'] for q in base['meubles']):base['meubles'].append(m)
  z['meubles'].append(m['uid'])
# Enrichissement zone : description/conditions de A, meuble absent explicitement marqué.
for z in base['zones']:
 descriptions=[s for s in base['sections'] if s.get('type')=='zone-description' and s['piece']==z['piece']]
 row=next((s['donnees'] for s in descriptions if clean(next(iter(s['donnees'].values())))==z['id']),{})
 if z['piece']=='SL':
  index=[q['uid'] for q in base['zones'] if q['piece']=='SL'].index(z['uid'])
  if index<len(descriptions):row=descriptions[index]['donnees']
 z['conditions']=row.get('Quand',row.get('Quand la choisir',''));z['description']=row.get('Description',row.get('Nom',z['id']))
 z['dispositions']=[d['uid'] for d in base['dispositions'] if d['piece']+':'+d['zone_id'] in [z['uid']]+z.get('renvoisZones',[])]
 if z['piece']=='CH' and z['id']=='dressing_tete_de_lit':z['dispositions']=[d['uid'] for d in base['dispositions'] if d['id'] in [f'CH-3.{i:02}' for i in range(6,11)]]
 if not z['dispositions']:base['trous'].append(dict(type='zone-sans-disposition',uid=z['uid']))
for d in base['dispositions']:
 texte=slug(d['geometrie']);meubles=[m for m in base['meubles'] if m['piece']==d['piece'] and any(n in texte.split('_') for n in slug(m['nom']).split('_') if n in ['lit','canape','fauteuil','bureau','armoire','commode','banc','console','table','chevet','banquette','piano','bibliotheque','etagere','tabouret','tapis','bac','vitrine'])]
 d['meubles']=[m['uid'] for m in meubles]
 if not meubles:
  z=next((z for z in base['zones'] if z['piece']==d['piece'] and z['id']==d['zone_id']),None)
  d['meubles']=z.get('meubles',[]) if z else [];d['referencesImplicites']=True
  if not d['meubles']:base['trous'].append(dict(type='disposition-sans-meuble-explicite',uid=d['uid']))
 if not any(z['piece']==d['piece'] and z['id']==d['zone_id'] for z in base['zones']):base['trous'].append(dict(type='zone-absente',uid=d['uid'],zone=d['zone_id']))
for m in base['meubles']:
 if m['dim'] is None:base['trous'].append(dict(type='dimensions-incompletes',uid=m['uid']))
for regle in base['regles']:
 if regle['uid']=='CH:regle:plan_de_couchage_pmr':
  regle['statutSource']='dur';regle['statut']='souple';regle['justification']='Cible de confort de 40–50 cm. L’article 13 de l’arrêté logement du 24/12/2015 ne fixe pas la hauteur du couchage ; ne pas généraliser la règle ERP du tome à tous les logements.'
base['comptes']={k:len(base[k]) for k in ['zones','dispositions','meubles','props','regles','signature_moments','trous']};base['comptes']['dispositionsParPiece']={p:sum(d['piece']==p for d in base['dispositions']) for p in ['SL']+roomCodes}
(ROOT/'data/encyclopedie/base.json').write_text(json.dumps(base,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(base['comptes'],ensure_ascii=False,indent=2))

compact={k:[{a:b for a,b in x.items() if a not in ['donnees']} for x in base[k]] for k in ['zones','dispositions','meubles','props','regles','signature_moments','documents','trous']}
compact.update(version=base['version'],comptes=base['comptes'])
(ROOT/'data/encyclopedie/runtime.json').write_text(json.dumps(compact,ensure_ascii=False,separators=(',',':'))+'\n')

"""Comparaison métrique locale, mêmes onze produits synthétiques ; aucune photo client."""
import json
from pathlib import Path
import math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Polygon

root = Path(__file__).resolve().parents[1] / 'docs' / 'plan-zones'
avant = json.loads((root / 'avant.json').read_text())
apres = json.loads((root / 'apres.json').read_text())
fig, axes = plt.subplots(1, 2, figsize=(12, 6.5), facecolor='#faf8f3')
colors = {'salon': '#c79970', 'repas': '#789489', 'lecture': '#b3a0bd'}
names = {'canape': 'Canapé', 'fauteuil': 'Fauteuil', 'table': 'Table', 'meuble': 'TV', 'lampe': 'Lampe', 'chaise': 'Chaise', 'suspension': 'Susp.'}
for ax, data, titre in zip(axes, [avant, apres], ['Avant · placement existant', 'Après · composition par zones']):
    ax.set_facecolor('#faf8f3')
    ax.add_patch(Rectangle((-2.5, -2), 5, 4, facecolor='#f1ebe0', edgecolor='#51463e', linewidth=2))
    plan = data.get('proposition', {}).get('planZones', {})
    for z in plan.get('zones', []):
        color = colors.get(z['type'], '#ad9d88')
        ax.add_patch(Rectangle((z['x0'], z['z0']), z['x1']-z['x0'], z['z1']-z['z0'], facecolor=color, alpha=.22, edgecolor=color, linewidth=2))
    # Chemins issus du solveur, pas dessinés à la main.
    for chemin in plan.get('chemins', []):
        pts = chemin['points']
        if len(pts) > 1: ax.plot([p['x'] for p in pts], [p['z'] for p in pts], color='#758a80', linewidth=3, linestyle='--', zorder=2)
    for it in data['items']:
        if it.get('garde') is False: continue
        p = data['catalogue'][it['sku']]
        w, d, _ = p['dim']; angle = it.get('rot', 0)
        if p['fam'] in ('lampe', 'suspension'):
            ax.scatter([it['x']], [it['z']], s=50, c='#ba843e', marker='o' if p['fam']=='lampe' else '*', zorder=5)
            continue
        points = [(it['x']+math.cos(angle)*x+math.sin(angle)*z, it['z']-math.sin(angle)*x+math.cos(angle)*z) for x,z in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]]
        ax.add_patch(Polygon(points, facecolor='#fdfbf7', edgecolor='#6d5a4e', linewidth=1.4, zorder=3))
        if p['fam'] != 'chaise': ax.text(it['x'], it['z'], names.get(p['fam'], p['fam']), ha='center', va='center', fontsize=8, zorder=4)
        if p['fam'] in ('canape','fauteuil','meuble','chaise'):
            ax.arrow(it['x'], it['z'], math.sin(angle)*min(d*.3,.15), math.cos(angle)*min(d*.3,.15), width=.012, head_width=.07, color='#877060', zorder=4)
    for z in plan.get('zones', []):
        y = z['z1']+.16 if z['type']=='salon' else z['z0']-.16
        ax.text((z['x0']+z['x1'])/2,y,z['libelle'].upper(),ha='center',fontsize=10,weight='bold',color='#635449',zorder=6)
    ax.plot([-2.1,-1.2],[2,2],color='#faf8f3',linewidth=5)
    ax.plot([1.55,2.35],[-2,-2],color='#faf8f3',linewidth=5)
    ax.plot([2.5,2.5],[-.75,.35],color='#7aacc1',linewidth=5)
    ax.text(-1.65,2.22,'Entrée',ha='center',fontsize=9,color='#635449')
    ax.text(1.95,-2.2,'Cuisine',ha='center',fontsize=9,color='#635449')
    ax.text(2.64,-.2,'Fenêtre',rotation=90,va='center',fontsize=9,color='#578696')
    ax.set_xlim(-2.75,2.9); ax.set_ylim(2.5,-2.5); ax.set_aspect('equal')
    ax.set_xticks([-2,-1,0,1,2]); ax.set_yticks([-2,-1,0,1,2]); ax.tick_params(labelsize=8, colors='#87796b')
    ax.set_xlabel('Largeur · mètres',fontsize=9,color='#87796b')
    ax.set_title(titre,loc='left',fontsize=15,color='#3e352f',pad=20)
    for spine in ax.spines.values(): spine.set_visible(False)
fig.suptitle('Un salon de 20 m², les mêmes 11 produits',fontsize=19,color='#3e352f',x=.07,ha='left',y=.98)
fig.text(.07,.035,'Ancien moteur au commit 9099770 · nouveau moteur avec zones et passages de 90 cm.\nMaquette synthétique : cette comparaison ne mesure pas la beauté ni la précision d’un scan.',fontsize=10,color='#726456')
fig.subplots_adjust(left=.07,right=.97,top=.85,bottom=.16,wspace=.17)
fig.savefig(root/'comparaison.png',dpi=170,facecolor=fig.get_facecolor())
fig.savefig(root/'comparaison.svg',facecolor=fig.get_facecolor())
svg = root/'comparaison.svg'
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
print(root/'comparaison.png')

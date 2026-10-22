"""Render measured polygons, never an image-generated approximation of the room."""
import sys, json, io, base64, math
from PIL import Image, ImageDraw, ImageFont

data = json.load(sys.stdin)
b = data['bounds']
scale = min(760 / max(.1, b['maxX'] - b['minX']), 650 / max(.1, b['maxZ'] - b['minZ']))
image = Image.new('RGB', (1200, 840), '#fcfaf5')
draw = ImageDraw.Draw(image)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
except OSError:
    font = small = ImageFont.load_default()

def pt(p):
    return (55 + (p[0] - b['minX']) * scale, 85 + (p[1] - b['minZ']) * scale)

draw.text((40, 25), str(data['title'])[:85], fill='#202c25', font=font)
draw.text((40, 48), 'Plan exact / dimensions en metres / +X droite, +Z bas', fill='#42554a', font=small)
draw.polygon([pt(p) for p in data['polygon']], fill='#efeadf', outline='#152d25', width=5)
for o in data['openings']:
    if o['zone']:
        draw.polygon([pt(p) for p in o['zone']], fill='#f4d8be', outline='#bd7e3f', width=2)
    draw.line([pt(o['a']), pt(o['b'])], fill='#4587b1' if o['type'] == 'window' else '#fffaf1', width=8)
for n, item in enumerate(data['items'], 1):
    color = '#d9cdb6' if item['family'] == 'tapis' else '#c4d5c6' if item['y'] > .2 else '#acbba5'
    draw.polygon([pt(p) for p in item['polygon']], fill=color, outline='#53694e', width=2)
    cx, cz = pt((item['x'], item['z']))
    draw.text((cx-5, cz-8), str(n), fill='#17291c', font=small)
    if item['family'] != 'tapis':
        a = math.radians(item['rotation'])
        draw.line([(cx, cz), (cx+math.sin(a)*14, cz+math.cos(a)*14)], fill='#234e32', width=2)
    y = 85 + (n-1)*21
    if y < 805:
        draw.text((840, y), f"{n}. {item['label'][:31]}", fill='#202c25', font=small)
for w in data['walls']:
    a, c = pt(w['a']), pt(w['b'])
    draw.text(((a[0]+c[0])/2+4, (a[1]+c[1])/2-19), w['label'], fill='#152d25', font=small)
buffer = io.BytesIO()
image.save(buffer, format='PNG')
sys.stdout.write(base64.b64encode(buffer.getvalue()).decode())

"""Tutoriels motion design reproductibles : schémas et texte exact, aucun média client.
python scripts/guides-motion.py -- nécessite Pillow et ffmpeg (génération hors build).
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,math,html

OUT=Path('public/guides');OUT.mkdir(parents=True,exist_ok=True)
W,H,FPS=1120,720,15
BG='#EFE8DC';INK='#30271F';GOLD='#AD8151';WHITE='#FBF8F2';MUTED='#746556'
FONT='/usr/share/fonts/truetype/dejavu/'
def font(n,bold=False):return ImageFont.truetype(FONT+('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'),n)
titles={'fr':{'apple':'Scan Apple','android':'Scan Android','parcours':'Votre pièce, pas à pas'},'en':{'apple':'Scan Apple','android':'Scan Android','parcours':'Your room, step by step'}}
copy={
 'fr':{'apple':[('Installez Lagarsoft','iPhone ou iPad avec LiDAR. Ouvrez l’application, puis touchez +.'),('Scannez une pièce','Balayez lentement les murs et les ouvertures. Quand le contour est complet, touchez Done.'),('Exportez le DXF','Ouvrez le projet, puis Export. Choisissez DXF · 2D floorplan et enregistrez dans Fichiers.'),('Revenez sur le site','Déposez le DXF, vérifiez la pièce et les cotes. Le plan 2D reste modifiable.')],
 'android':[('Ouvrez dans Chrome','Sur un Android compatible ARCore. Depuis l’ordinateur, utilisez le QR de transfert.'),('Autorisez la caméra','Touchez Démarrer le relevé AR. Attendez que la mire apparaisse au sol.'),('Marquez tous les coins','Faites le tour dans l’ordre, y compris les renfoncements. Ne répétez pas le premier coin.'),('Vérifiez le relevé','Terminez après au moins 3 coins. Utilisez le plan ou envoyez-le sur l’ordinateur. Export JSON ou DXF disponible.')],
 'parcours':[('Relevez votre pièce','Photos, Scan Android ou Scan Apple. Vous pouvez aussi partir d’un plan DXF, PDF ou image.'),('Vérifiez le plan','Corrigez les dimensions et les ouvertures. Notez les meubles à conserver.'),('Choisissez vos envies','Saisissez votre budget, vos styles et vos priorités. Comparez les dispositions proposées.'),('Choisissez votre vue','Ajoutez sa photo de référence, contrôlez le cadrage puis lancez le rendu réaliste.') ]},
 'en':{'apple':[('Install Lagarsoft','Use a LiDAR iPhone or iPad. Open the app and tap +.'),('Scan one room','Slowly scan walls and openings. Tap Done when the outline is complete.'),('Export the DXF','Open the project, then Export. Choose DXF · 2D floorplan and save to Files.'),('Return to the website','Upload the DXF, check the room and its measurements. The 2D plan stays editable.')],
 'android':[('Open in Chrome','Use an ARCore-compatible Android. From a computer, use the transfer QR.'),('Allow camera access','Tap Start AR survey. Wait for the floor reticle.'),('Mark every corner','Walk around in order, including recesses. Do not repeat the first corner.'),('Check your survey','Finish after at least 3 corners. Use the plan or send it to your computer. JSON or DXF export is available.')],
 'parcours':[('Capture your room','Photos, Scan Android or Scan Apple. You can also use a DXF, PDF or image plan.'),('Check the plan','Correct dimensions and openings. Record the furniture you want to keep.'),('Choose your brief','Enter your budget, styles and priorities. Compare suggested layouts.'),('Choose your view','Add its reference photo, check framing and start the realistic render.')]}}

def text(d,xy,t,size=24,colour=INK,bold=False):d.text(xy,t,font=font(size,bold),fill=colour)
def wrap(d,t,width,size=25):
 lines=[];line=''
 for w in t.split():
  candidate=(line+' '+w).strip()
  if d.textlength(candidate,font=font(size))>width and line:lines.append(line);line=w
  else:line=candidate
 if line:lines.append(line)
 return lines
def box(d,b,fill=WHITE,outline=None,r=16,width=2):d.rounded_rectangle(b,radius=r,fill=fill,outline=outline,width=width)
def cursor(d,x,y,phase):
 radius=12+9*abs(math.sin(phase*math.pi));d.ellipse((x-radius,y-radius,x+radius,y+radius),outline=GOLD,width=3);d.ellipse((x-5,y-5,x+5,y+5),fill=GOLD)
def floor(d,progress=1):
 ps=[(786,255),(1006,255),(1006,357),(916,357),(916,447),(786,447),(786,255)]
 d.polygon(ps[:-1],fill='#E4D4BC')
 n=min(6,max(1,int(progress*6)))
 d.line(ps[:n+1],fill=GOLD,width=6)
 for x,y in ps[:n]:d.ellipse((x-6,y-6,x+6,y+6),fill=INK)
 text(d,(823,469),'3.50 m',18,MUTED)
def ui(d,mode,step,k,lang):
 x,y=750,112;box(d,(x,y,x+308,y+506),INK,r=35);box(d,(x+12,y+12,x+296,y+494),WHITE,r=25)
 box(d,(845,130,963,151),INK,r=8)
 text(d,(787,171),'LAGARSOFT' if mode=='apple' else 'REALROOM',18,INK,True)
 if mode=='apple' and step==0:
  box(d,(995,166,1032,203),GOLD,r=18);text(d,(1005,164),'+',30,WHITE);text(d,(785,290),'Projects' if lang=='en' else 'Projets',22,INK,True);box(d,(783,335,1025,421),BG);text(d,(800,350),'Room scan',20);text(d,(800,385),'1 room',15,MUTED);cursor(d,1014,184,k)
 elif (mode=='apple' and step==1) or (mode=='android' and step==2):
  floor(d,k);text(d,(977,202),'Done' if mode=='apple' else 'AR',18,GOLD,True)
  if mode=='android':
   box(d,(783,513,1025,584),INK);text(d,(800,526),'Corner / Coin',16,WHITE);text(d,(800,553),'Confirm / Valider',18,WHITE)
  ps=[(786,255),(1006,255),(1006,357),(916,357),(916,447),(786,447)]
  a=ps[min(5,int(k*6))];cursor(d,*a,k*6)
 elif mode=='apple' and step==2:
  text(d,(787,226),'Export',27,INK,True)
  for j,l in enumerate(['Floorplan · PDF','DXF · 2D floorplan','USDZ · 3D model','Report · PDF']):
   b=(783,282+j*60,1025,331+j*60);box(d,b,GOLD if j==1 else BG,r=8);text(d,(797,295+j*60),l,17,WHITE if j==1 else INK)
  cursor(d,1006,365,k)
 elif mode=='android' and step==0:
  box(d,(781,228,1027,282),BG,r=10);text(d,(794,244),'realroom / releve',17);box(d,(783,354,1025,414),GOLD);text(d,(800,371),'Scan Android',21,WHITE,True);cursor(d,982,389,k)
 elif mode=='android' and step==1:
  floor(d,.2);box(d,(774,310,1036,455),INK);text(d,(795,335),'Camera / Caméra',21,WHITE);text(d,(808,390),'Allow / Autoriser',20,'#D9B987',True);cursor(d,957,412,k)
 elif mode=='parcours' and step==0:
  for j,l in enumerate(['Photos','Scan Android','Scan Apple']):box(d,(784,260+j*72,1027,320+j*72),GOLD if j==1 else BG);text(d,(802,278+j*72),l,21,WHITE if j==1 else INK)
 elif mode=='parcours' and step==2:
  text(d,(785,240),'Budget',27,INK,True);box(d,(783,294,1027,360),BG);text(d,(798,309),'2 500 €',30,INK,True)
  for j,l in enumerate(['Scandinave','Contemporain','Cosy']):box(d,(783,395+j*50,1027,435+j*50),GOLD if j==0 else BG);text(d,(800,405+j*50),l,17,WHITE if j==0 else INK)
 elif mode=='parcours' and step==3:
  floor(d,1);box(d,(783,520,1027,578),GOLD);text(d,(800,537),'Generate / Générer',18,WHITE,True);cursor(d,1002,548,k)
 else:
  if mode=='apple':text(d,(790,212),'room.dxf',25,INK,True)
  floor(d,1);box(d,(783,528,1027,582),GOLD);text(d,(800,543),'Check / Vérifier',21,WHITE,True);cursor(d,1002,553,k)

def frame(mode,lang,t,duration):
 im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im);step=min(3,int(t/(duration/4)));k=(t%(duration/4))/(duration/4)
 text(d,(60,44),'REALROOM  /  MAISON CORLEONE',17,MUTED,True);text(d,(60,108),titles[lang][mode],36,INK)
 box(d,(60,213,136,272),GOLD);text(d,(79,224),f'{step+1:02}',27,WHITE,True)
 title,body=copy[lang][mode][step];text(d,(60,302),title,34,INK,True)
 for i,l in enumerate(wrap(d,body,600)):text(d,(60,372+i*40),l,25,MUTED)
 text(d,(60,564),'GUIDE · '+('4 ÉTAPES' if lang=='fr' else '4 STEPS'),15,MUTED)
 for i in range(4):box(d,(60+i*160,629,200+i*160,635),GOLD if i<=step else '#D9CEBE',r=2)
 box(d,(60,672,1060,677),'#D9CEBE',r=2);box(d,(60,672,60+1000*t/duration,677),GOLD,r=2)
 ui(d,mode,step,k,lang);return im

for lang in ['fr','en']:
 for mode in ['apple','android','parcours']:
  duration=35 if mode=='apple' else 30;path=OUT/f'{mode}-{lang}.mp4'
  p=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',str(path)],stdin=subprocess.PIPE)
  for i in range(duration*FPS):p.stdin.write(frame(mode,lang,i/FPS,duration).tobytes())
  p.stdin.close();assert p.wait()==0
  vtt=['WEBVTT','']
  for i,(title,body)in enumerate(copy[lang][mode]):
   def tm(n):return f'00:{int(n)//60:02d}:{n%60:06.3f}'
   vtt += [f'{tm(i*duration/4)} --> {tm((i+1)*duration/4)}',title+'. '+body,'']
  (OUT/f'{mode}-{lang}.vtt').write_text('\n'.join(vtt))
  title=html.escape(titles[lang][mode]);sub=html.escape(copy[lang][mode][0][0]);
  (OUT/f'{mode}-{lang}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 720"><rect width="1120" height="720" rx="18" fill="{BG}"/><text x="65" y="100" font-family="sans-serif" font-size="22" fill="{MUTED}">REALROOM / MAISON CORLEONE</text><text x="65" y="280" font-family="sans-serif" font-size="60" fill="{INK}">{title}</text><text x="65" y="355" font-family="sans-serif" font-size="32" fill="{MUTED}">{sub}</text><circle cx="900" cy="355" r="85" fill="{GOLD}"/><path d="M875 310L945 355L875 400Z" fill="{WHITE}"/><text x="65" y="620" font-family="sans-serif" font-size="23" fill="{INK}">{duration} s · 4 étapes / steps</text></svg>')
  print(path,path.stat().st_size,flush=True)

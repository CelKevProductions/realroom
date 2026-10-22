import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const material=(color,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
function box(g,w,h,d,x,y,z,m,r=0){const mesh=new THREE.Mesh(r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y+h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
function cylinder(g,r1,r2,h,x,y,z,m){const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,32),m);o.position.set(x,y+h/2,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function canvasTexture(draw,size=512){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
export function construireObjetDesign(p){const g=new THREE.Group(),[w,d,h]=p.dim,wood=material(p.cols?.[0]||'#ae8c62'),dark=material('#302e2a'),ivory=material('#eee6d4'),black=material('#151512'),metal=material('#867149',.35);
 const legs=(height,spread=.42)=>{for(const x of [-1,1])for(const z of [-1,1])box(g,.045,height,.045,x*w*spread,0,z*d*spread,wood,.009);};
 switch(p.st){
 case 'piano':box(g,w,h*.86,d*.62,0,h*.14,-d*.19,wood,.025);box(g,w,.12,d,0,.66,0,wood,.018);box(g,w,.08,d*.7,0,h-.08,-d*.15,wood,.01);for(let k=0;k<48;k++){const x=-w*.45+k*w*.9/48;box(g,w*.9/48-.002,.035,d*.35,x,.785,d*.25,ivory);if(![2,6].includes(k%7)&&k<47)box(g,w*.9/80,.045,d*.2,x+w*.9/96,.815,d*.19,black);}for(const x of [-1,1])box(g,.07,.66,.1,x*w*.44,0,d*.31,wood,.01);for(const x of [-.07,0,.07])box(g,.035,.02,.09,x,.08,d*.4,metal);break;
 case 'shelf':box(g,w,h,d,0,0,0,wood,.005);box(g,w-.08,h-.08,d-.025,0,.04,.03,material('#9b8062'));for(let i=0;i<5;i++){box(g,w,.035,d,0,h*i/5,0,wood);for(let j=0;j<7;j++){const hh=.17+(j*7+i*3)%5*.025;const b=box(g,.065,hh,.19,-w*.42+j*.1,h*i/5+.035,.025,material(['#d0c4ac','#876749','#9b9d83','#c39b79'][j%4]),.003);b.rotation.z=j===6?-.13:0;}}box(g,.035,h,d,0,0,0,wood);break;
 case 'desk':case 'dining':box(g,w,.05,d,0,h-.05,0,wood,.025);legs(h-.05);break;
 case 'coffee':{const top=cylinder(g,.5,.5,.055,0,h-.055,0,wood);top.scale.set(w,1,d);for(const x of [-.36,.36])cylinder(g,.09,.11,h-.055,x*w,0,0,wood);break;}
 case 'chair':legs(.43);box(g,w,.075,d,0,.43,0,ivory,.025);box(g,w-.02,h-.49,.07,0,.49,-d/2+.035,wood,.025);break;
 case 'nightstand':box(g,w,h-.1,d,0,.1,0,wood,.035);legs(.1);box(g,.1,.012,.02,0,.32,d/2,metal,.004);break;
 case 'banc':legs(h-.07);box(g,w,.07,d,0,h-.07,0,dark,.025);break;
 case 'vinyl':box(g,w,h-.2,d,0,.15,0,wood,.018);for(let j=0;j<16;j++)box(g,.028,.29,d*.65,-w*.44+j*.035,.2,d*.13,material(j%3?'#c0b298':'#55574a'));box(g,.44,.08,.32,w*.23,h-.08,0,dark,.01);cylinder(g,.12,.12,.009,w*.23,h,.0,black);legs(.15);break;
 case 'speaker':box(g,w,h*.55,d,0,h*.45,0,dark,.018);for(const y of [.6,.82]){const cone=cylinder(g,w*.3,w*.3,.012,0,h*y,d/2,black);cone.rotation.x=Math.PI/2;}box(g,.035,h*.45,.035,0,0,0,black);box(g,w*.9,.025,d*.85,0,0,0,black);break;
 case 'guitar':{const body=new THREE.Mesh(new THREE.SphereGeometry(.2,24,16),wood);body.scale.set(1,1.35,.3);body.position.set(0,.3,0);g.add(body);box(g,.055,.67,.04,0,.45,0,dark,.008);for(let i=0;i<6;i++)box(g,.001,.81,.001,-.018+i*.007,.3,.068,metal);box(g,w,.02,d,0,0,0,dark);break;}
 case 'books':for(let j=0;j<4;j++){const b=box(g,w*.83,.045,d*.93,0,j*.047,0,material(['#d8c8b1','#8d8065','#b87e5d','#777e65'][j]),.003);b.rotation.y=j%2?.06:0;}cylinder(g,.05,.06,.06,w*.34,h-.06,.02,wood);break;
 case 'vase':{const v=new THREE.Mesh(new THREE.LatheGeometry([[0,0],[.07,.01],[.09,.12],[.05,.23],[.045,.28]].map(q=>new THREE.Vector2(...q)),32),wood);g.add(v);v.castShadow=true;break;}
 case 'art':{box(g,w,h,d,0,0,0,material('#70543d'),.006);const tex=canvasTexture((c,n)=>{c.fillStyle='#e8ddc6';c.fillRect(0,0,n,n);c.fillStyle='#ad684c';c.beginPath();c.ellipse(n*.45,n*.64,n*.23,n*.33,-.55,0,Math.PI*2);c.fill();c.fillStyle='#92977e';c.beginPath();c.ellipse(n*.69,n*.3,n*.26,n*.18,.4,0,Math.PI*2);c.fill();c.strokeStyle='#514c3c';c.lineWidth=2;c.beginPath();c.moveTo(n*.2,n*.8);c.bezierCurveTo(n*.8,n*.35,n*.1,n*.18,n*.7,n*.1);c.stroke();});box(g,w-.035,h-.035,.004,0,.0175,d/2+.002,new THREE.MeshStandardMaterial({map:tex,roughness:1}));break;}
 case 'rug':{box(g,w,h,d,0,0,0,wood,.006);for(let i=0;i<8;i++)box(g,w-.1,.002,.015,0,h+.001,-d/2+.08+i*.035,ivory);break;}
 case 'pendant':{const shade=new THREE.Mesh(new THREE.SphereGeometry(w/2,48,24),ivory);shade.scale.set(1,h/w,1);shade.position.y=h/2;g.add(shade);break;}
 case 'curtain':for(let i=0;i<24;i++)box(g,w/24,h,.04,(i+.5)*w/24-w/2,0,Math.sin(i)*.025,wood,.012);break;
 default:box(g,w,h,d,0,0,0,wood,.025);
 }return g;
}

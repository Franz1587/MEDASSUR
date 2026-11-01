import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, View } from "react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import type { RnFilePart } from "../api/http";
import { colors } from "../theme/colors";

// Rogner / pivoter une photo avant envoi (2026-11) — voir demande
// utilisateur : "quand on filme on peut rogner, changer l'orientation".
// Canvas dans une WebView (déjà embarquée) : aucun module natif ajouté,
// livrable par mise à jour OTA. Même principe que le web (EditeurImage.tsx).
const page = (dataUrl: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:sans-serif;touch-action:none}
#zone{position:absolute;left:0;right:0;top:0;bottom:84px}canvas{position:absolute}
#barre{position:absolute;left:0;right:0;bottom:0;height:84px;display:flex;gap:8px;align-items:center;justify-content:center;padding:0 8px;background:#111}
button{flex:1;height:48px;border:0;border-radius:10px;font-size:15px;color:#fff;background:#333}#ok{background:${colors.primary};font-weight:bold}
#aide{position:absolute;top:8px;left:0;right:0;text-align:center;color:#ddd;font-size:13px;z-index:2}</style></head><body>
<div id="aide">Ajustez le cadre sur le document</div><div id="zone"><canvas id="c"></canvas></div>
<div id="barre"><button id="g">⟲</button><button id="d">⟳</button><button id="non">Annuler</button><button id="ok">Valider</button></div>
<script>
const img=new Image(),c=document.getElementById('c'),ctx=c.getContext('2d'),zone=document.getElementById('zone');
let rot=0,cadre={x:.03,y:.03,w:.94,h:.94},vue=null,prise=null;const MIN=.08,R=28;
function tourne(src,ech){const q=rot%180!==0,cv=document.createElement('canvas');cv.width=Math.round((q?src.height:src.width)*ech);cv.height=Math.round((q?src.width:src.height)*ech);
const x=cv.getContext('2d');x.translate(cv.width/2,cv.height/2);x.rotate(rot*Math.PI/180);x.drawImage(src,-src.width*ech/2,-src.height*ech/2,src.width*ech,src.height*ech);return cv;}
function dessine(){const W=zone.clientWidth,H=zone.clientHeight,q=rot%180!==0,iw=q?img.height:img.width,ih=q?img.width:img.height,e=Math.min(W/iw,H/ih);
if(!vue||vue.rot!==rot||vue.e!==e){vue={rot,e,cv:tourne(img,e)};}
c.width=vue.cv.width;c.height=vue.cv.height;c.style.left=((W-c.width)/2)+'px';c.style.top=((H-c.height)/2)+'px';
ctx.drawImage(vue.cv,0,0);const X=cadre.x*c.width,Y=cadre.y*c.height,w=cadre.w*c.width,h=cadre.h*c.height;
ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,c.width,Y);ctx.fillRect(0,Y+h,c.width,c.height-Y-h);ctx.fillRect(0,Y,X,h);ctx.fillRect(X+w,Y,c.width-X-w,h);
ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(X,Y,w,h);ctx.fillStyle='#fff';[[X,Y],[X+w,Y],[X,Y+h],[X+w,Y+h]].forEach(([a,b])=>{ctx.beginPath();ctx.arc(a,b,9,0,7);ctx.fill();});}
function pt(t){const r=c.getBoundingClientRect();return{x:(t.clientX-r.left)/r.width,y:(t.clientY-r.top)/r.height,px:t.clientX-r.left,py:t.clientY-r.top};}
c.addEventListener('touchstart',ev=>{const p=pt(ev.touches[0]),X=cadre.x*c.width,Y=cadre.y*c.height,w=cadre.w*c.width,h=cadre.h*c.height;
const coins={hg:[X,Y],hd:[X+w,Y],bg:[X,Y+h],bd:[X+w,Y+h]};let type=null;for(const k in coins){if(Math.hypot(p.px-coins[k][0],p.py-coins[k][1])<R)type=k;}
if(!type&&p.x>cadre.x&&p.x<cadre.x+cadre.w&&p.y>cadre.y&&p.y<cadre.y+cadre.h)type='m';if(type)prise={type,d:p,c:{...cadre}};ev.preventDefault();},{passive:false});
c.addEventListener('touchmove',ev=>{if(!prise)return;const p=pt(ev.touches[0]),dx=p.x-prise.d.x,dy=p.y-prise.d.y,o=prise.c,b=(v,a,z)=>Math.min(z,Math.max(a,v));let {x,y,w,h}=o;
if(prise.type==='m'){x=b(o.x+dx,0,1-o.w);y=b(o.y+dy,0,1-o.h);}else{if(prise.type[1]==='g'){const nx=b(o.x+dx,0,o.x+o.w-MIN);w=o.w+o.x-nx;x=nx;}else w=b(o.w+dx,MIN,1-o.x);
if(prise.type[0]==='h'){const ny=b(o.y+dy,0,o.y+o.h-MIN);h=o.h+o.y-ny;y=ny;}else h=b(o.h+dy,MIN,1-o.y);}cadre={x,y,w,h};dessine();ev.preventDefault();},{passive:false});
c.addEventListener('touchend',()=>prise=null);
function pivote(s){rot=(rot+90*s+360)%360;cadre={x:.03,y:.03,w:.94,h:.94};dessine();}
document.getElementById('g').onclick=()=>pivote(-1);document.getElementById('d').onclick=()=>pivote(1);
document.getElementById('non').onclick=()=>window.ReactNativeWebView.postMessage(JSON.stringify({t:'annuler'}));
document.getElementById('ok').onclick=()=>{const plein=tourne(img,Math.min(1,2400/Math.max(img.width,img.height))),o=document.createElement('canvas');
o.width=Math.round(plein.width*cadre.w);o.height=Math.round(plein.height*cadre.h);o.getContext('2d').drawImage(plein,plein.width*cadre.x,plein.height*cadre.y,o.width,o.height,0,0,o.width,o.height);
window.ReactNativeWebView.postMessage(JSON.stringify({t:'ok',data:o.toDataURL('image/jpeg',.88).split(',')[1]}));};
img.onload=dessine;window.addEventListener('resize',()=>{vue=null;dessine();});img.src='${dataUrl}';
</script></body></html>`;

export function EditeurImage({ fichier, onValider, onAnnuler }: { fichier: RnFilePart | null; onValider: (f: RnFilePart) => void; onAnnuler: () => void }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    setHtml(null);
    if (!fichier) return;
    FileSystem.readAsStringAsync(fichier.uri, { encoding: FileSystem.EncodingType.Base64 })
      .then((b64) => setHtml(page(`data:${fichier.type || "image/jpeg"};base64,${b64}`)))
      // Lecture impossible : la photo part telle quelle plutôt que de bloquer l'envoi.
      .catch(() => onValider(fichier));
  }, [fichier]); // eslint-disable-line react-hooks/exhaustive-deps

  const recevoir = async (brut: string) => {
    const m = JSON.parse(brut) as { t: "ok" | "annuler"; data?: string };
    if (m.t === "annuler" || !m.data || !fichier) { onAnnuler(); return; }
    const uri = `${FileSystem.cacheDirectory}photo-${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(uri, m.data, { encoding: FileSystem.EncodingType.Base64 });
    onValider({ uri, name: fichier.name.replace(/\.\w+$/, "") + ".jpg", type: "image/jpeg" });
  };

  return (
    <Modal visible={!!fichier} animationType="slide" onRequestClose={onAnnuler} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {html ? (
          <WebView originWhitelist={["*"]} source={{ html }} onMessage={(e) => recevoir(e.nativeEvent.data)} style={{ flex: 1, backgroundColor: "#000" }} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#fff" size="large" /></View>
        )}
      </View>
    </Modal>
  );
}

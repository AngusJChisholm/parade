/* Pro > Pitch decks (pro.html). Built from the platform walkthrough Angus shared (sportworks.io as the reference).
   Five parts, all drawn in the browser on <canvas>, so nothing leaves the machine until a deck is shared:
     Design  - a template library that doubles as the inventory of placements (jersey, LED, big screen, vehicle,
               media wall, on-field, social tile), plus your own photos: upload, cover the existing branding,
               drop in a logo zone. Logos pick their best variant (colour, white or black) from the background
               behind them. Mockups for up to 25 brands at once.
     Studio  - the same editor with free layers: product shots and cut-outs, text, the property's logo. Builds full
               activation visuals (a driver holding a can, a branded fan zone) from your own images.
     Video   - 5, 10 or 15 second clips from any design, LED board animations (motion preset, crossfade or your own
               clip) and a brand dropped onto existing footage (bug, lower third or end slate). Recorded in real time.
     Decks   - one master deck, set up once and organised into sections, personalised per brand from the database
               (Scout Score, the open slot, the brand's portfolio, category benchmark). Any slide can carry a design
               or a video. Out as PowerPoint or PDF, one brand or all of them.
     Shared  - secure links (password or email-domain gate) with view counts, a time-on-slide heat map and location.
               Needs Supabase (supabase/schema.sql section 6). The viewer is deck.html.
   Settings live in localStorage under "sssPro.decks." (synced to pro_state with the rest of Pro).
   Uploaded images and video stay in this browser's IndexedDB ("sssProMedia"). */
window.SSSDecks=(function(){
let X=null,D=null,L=null,S=null,MX=null,host=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const W=1920,H=1080,MAXB=25,VOLT="#D2FF3C",INK="#111111",GREY="#5C5C57",LINE="#DEDED8",CANVAS="#F4F4F1";
const NOW=new Date(),yr=NOW.getFullYear();
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- saved settings (small, synced) and media (big, this browser only) ---------- */
const LS="sssPro.decks.";
const cfg={get(k,d){try{const v=localStorage.getItem(LS+k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem(LS+k,JSON.stringify(v))}catch(e){console.warn("Couldn't save",k,e)}}};
const IDB=(()=>{let p=null;
  const open=()=>p||(p=new Promise((res,rej)=>{const r=indexedDB.open("sssProMedia",1);r.onupgradeneeded=()=>r.result.createObjectStore("m");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
  const run=(mode,fn)=>open().then(db=>new Promise((res,rej)=>{const t=db.transaction("m",mode);const q=fn(t.objectStore("m"));t.oncomplete=()=>res(q?q.result:undefined);t.onerror=()=>rej(t.error)}));
  return {put:(k,v)=>run("readwrite",s=>s.put(v,k)),get:k=>run("readonly",s=>s.get(k)),del:k=>run("readwrite",s=>s.delete(k))};})();

/* ---------- canvas helpers ---------- */
const canv=(w,h)=>{const c=document.createElement("canvas");c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c};
const loadImg=(src,cors)=>new Promise(res=>{if(!src)return res(null);const i=new Image();if(cors)i.crossOrigin="anonymous";i.decoding="async";i.onload=()=>res(i);i.onerror=()=>res(null);i.src=src});
const isClean=c=>{try{c.getContext("2d").getImageData(0,0,1,1);return true}catch(e){return false}};
const MEDIA=new Map();
function media(key){
  if(!key)return Promise.resolve(null);
  if(!MEDIA.has(key))MEDIA.set(key,IDB.get(key).then(b=>b?loadImg(URL.createObjectURL(b)):null).catch(()=>null));
  return MEDIA.get(key);
}
const hex2rgb=h=>{const m=String(h||"").replace("#","").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);return m?m.slice(1).map(x=>parseInt(x,16)):[17,17,17]};
const rel=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
const lumRGB=([r,g,b])=>.2126*rel(r)+.7152*rel(g)+.0722*rel(b);
const lumHex=h=>lumRGB(hex2rgb(h));
const contrast=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
const onCol=h=>lumHex(h)>.42?"#000000":"#FFFFFF";
const rgbHex=([r,g,b])=>"#"+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,"0")).join("");
function fitRect(sw,sh,b,fit,align){
  const s=fit==="cover"?Math.max(b.w/sw,b.h/sh):Math.min(b.w/sw,b.h/sh);
  const w=sw*s,h=sh*s;
  const x=align==="left"?b.x:align==="right"?b.x+b.w-w:b.x+(b.w-w)/2;
  return {x,y:b.y+(b.h-h)/2,w,h};
}
function avgLum(g,x,y,w,h){
  x=Math.max(0,Math.floor(x));y=Math.max(0,Math.floor(y));w=Math.min(g.canvas.width-x,Math.ceil(w));h=Math.min(g.canvas.height-y,Math.ceil(h));
  if(w<1||h<1)return 1;
  let d;try{d=g.getImageData(x,y,w,h).data}catch(e){return 1}
  let s=0,n=0;const step=Math.max(4,Math.floor(d.length/4/4000))*4;
  for(let i=0;i<d.length;i+=step){s+=lumRGB([d[i],d[i+1],d[i+2]]);n++}
  return n?s/n:1;
}
function edgeColour(img,box){ /* average colour just outside a box: what "cover existing branding" fills with */
  const c=canv(img.width||img.naturalWidth,img.height||img.naturalHeight),g=c.getContext("2d");g.drawImage(img,0,0);
  const pts=[];const pad=6,st=8;
  for(let x=box.x;x<=box.x+box.w;x+=st){pts.push([x,box.y-pad],[x,box.y+box.h+pad])}
  for(let y=box.y;y<=box.y+box.h;y+=st){pts.push([box.x-pad,y],[box.x+box.w+pad,y])}
  let r=0,gg=0,b=0,n=0;
  pts.forEach(([x,y])=>{if(x<0||y<0||x>=c.width||y>=c.height)return;const p=g.getImageData(x|0,y|0,1,1).data;r+=p[0];gg+=p[1];b+=p[2];n++});
  return n?rgbHex([r/n,gg/n,b/n]):"#FFFFFF";
}

/* ---------- type: Archivo, condensed for headlines (same as the site) ---------- */
let fontsReady=null;
const fonts=()=>fontsReady||(fontsReady=Promise.all([document.fonts.load('800 100px "ArchivoV"'),document.fonts.load('400 100px "ArchivoV"')]).catch(()=>null));
function font(g,size,weight,cond){
  g.font=`${weight||400} ${cond?"extra-condensed ":""}${size}px "ArchivoV", "Archivo", "Arial Narrow", Arial, sans-serif`;
  try{g.fontStretch=cond?"extra-condensed":"normal"}catch(e){}
}
function wrap(g,text,maxW){
  const out=[];
  String(text).split("\n").forEach(par=>{
    const words=par.split(/\s+/).filter(Boolean);if(!words.length){out.push("");return}
    let line="";
    words.forEach(w=>{const t=line?line+" "+w:w;if(g.measureText(t).width<=maxW||!line)line=t;else{out.push(line);line=w}});
    out.push(line);
  });
  return out;
}
/* Shrinks the type until it fits the box. The size it lands on is kept on the element, so PowerPoint gets the same. */
function fitText(g,el){
  const txt=el.upper?String(el.text).toUpperCase():String(el.text);
  const lh=el.lh||(el.cond?.92:1.25),min=el.min||Math.max(12,el.size*.4);
  let size=el.size,lines;
  for(;;){font(g,size,el.weight,el.cond);lines=wrap(g,txt,el.w);
    const tooWide=lines.some(l=>g.measureText(l).width>el.w+1);
    if((lines.length*size*lh<=el.h&&!tooWide)||size<=min)break;size=Math.max(min,size*.93)}
  return {size,lines,lh,txt};
}
function drawText(g,el){
  if(!el.text&&el.text!==0)return;
  const f=fitText(g,el);el._size=f.size;
  font(g,f.size,el.weight,el.cond);g.fillStyle=el.color||INK;g.textBaseline="alphabetic";
  try{g.letterSpacing=el.track?`${el.track}px`:"0px"}catch(e){}
  const total=f.lines.length*f.size*f.lh;
  let y=el.valign==="bottom"?el.y+el.h-total:el.valign==="middle"?el.y+(el.h-total)/2:el.y;
  f.lines.forEach(l=>{
    const w=g.measureText(l).width;const x=el.align==="center"?el.x+(el.w-w)/2:el.align==="right"?el.x+el.w-w:el.x;
    g.fillText(l,x,y+f.size*(el.cond?.86:.9));y+=f.size*f.lh;
  });
  try{g.letterSpacing="0px"}catch(e){}
}
/* A slide or mockup as a list of elements: rect, text, img. One list feeds the canvas, PDF, PowerPoint and video. */
function paint(els,w,h,bg){
  const c=canv(w||W,h||H),g=c.getContext("2d");
  g.fillStyle=bg||"#FFFFFF";g.fillRect(0,0,c.width,c.height);
  els.forEach(el=>{
    if(el.t==="rect"){g.fillStyle=el.fill;g.fillRect(el.x,el.y,el.w,el.h);if(el.stroke){g.strokeStyle=el.stroke;g.lineWidth=el.lw||2;g.strokeRect(el.x+1,el.y+1,el.w-2,el.h-2)}}
    else if(el.t==="text")drawText(g,el);
    else if(el.t==="img"&&el.src){
      const sw=el.src.width||el.src.naturalWidth,sh=el.src.height||el.src.naturalHeight;if(!sw||!sh)return;
      const r=fitRect(sw,sh,el,el.fit,el.align);
      if(el.fit==="cover"){g.save();g.beginPath();g.rect(el.x,el.y,el.w,el.h);g.clip();g.drawImage(el.src,r.x,r.y,r.w,r.h);g.restore()}
      else g.drawImage(el.src,r.x,r.y,r.w,r.h);
    }
  });
  return c;
}

/* ---------- logos: the best version for the background behind them ---------- */
const LOGO=new Map();
function trim(src){
  const sw=src.width||src.naturalWidth,sh=src.height||src.naturalHeight;
  const sc=Math.min(1,900/Math.max(sw,sh));const c=canv(sw*sc,sh*sc),g=c.getContext("2d");g.drawImage(src,0,0,c.width,c.height);
  const d=g.getImageData(0,0,c.width,c.height).data;
  let hasAlpha=false;for(let i=3;i<d.length;i+=16)if(d[i]<250){hasAlpha=true;break}
  // No transparency: trim the near-white border instead, so a logo on a white JPEG still fills its zone.
  const solid=i=>hasAlpha?d[i+3]>12:!(d[i]>242&&d[i+1]>242&&d[i+2]>242);
  let x0=c.width,y0=c.height,x1=-1,y1=-1,n=0,r=0,gg=0,b=0,cnt=0;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(solid(i)){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;n++;
    if(!(y%2)&&!(x%2)){const a=d[i+3]/255;r+=d[i]*a;gg+=d[i+1]*a;b+=d[i+2]*a;cnt+=a}}}
  if(x1<0)return null;
  const out=canv(x1-x0+1,y1-y0+1);out.getContext("2d").drawImage(c,x0,y0,out.width,out.height,0,0,out.width,out.height);
  const cover=n/(out.width*out.height);
  return {c:out,avg:cnt?[r/cnt,gg/cnt,b/cnt]:[17,17,17],boxed:!hasAlpha||cover>.93};
}
function recolour(c,rgb){
  const o=canv(c.width,c.height),g=o.getContext("2d");g.drawImage(c,0,0);
  g.globalCompositeOperation="source-in";g.fillStyle=rgb;g.fillRect(0,0,o.width,o.height);return o;
}
function monogram(e){
  const cols=(L.colours&&L.colours(e))||[];const bg=cols.find(h=>lumHex(h)<.9)||INK;
  const c=canv(512,512),g=c.getContext("2d");g.fillStyle=bg;g.fillRect(0,0,512,512);
  g.textAlign="center";font(g,250,800,true);g.fillStyle=onCol(bg);g.fillText((L.initials?L.initials(e.name):e.name.slice(0,1)).slice(0,3),256,345);g.textAlign="left";
  return c;
}
/* Official variants uploaded in Design win over the generated ones: "colour", "white" (for dark backgrounds), "black" (for light). */
function logoOf(e){
  if(!e)return Promise.resolve(null);
  if(LOGO.has(e.slug))return LOGO.get(e.slug);
  const p=(async()=>{
    const up={};for(const v of ["colour","white","black"]){const i=await media(`logo:${e.slug}:${v}`);if(i){const t=trim(i);if(t)up[v]=t.c}}
    let base=null,src="";
    if(up.colour){base=trim(up.colour);src="Uploaded"}
    if(!base){
      const tries=[];if(e.logo)tries.push([e.logo,false,"Logo file"]);
      const bf=L.bfId&&L.bfId();if(e.domain&&bf&&L.bfUrl)["logo","symbol"].forEach(t=>tries.push([L.bfUrl(e.domain,t,800,""),true,"Brandfetch"]));
      for(const [u,cors,lab] of tries){const i=await loadImg(u,cors);if(!i||i.naturalWidth<8)continue;
        const t0=canv(i.naturalWidth,i.naturalHeight);t0.getContext("2d").drawImage(i,0,0);if(!isClean(t0))continue;
        const t=trim(t0);if(t){base=t;src=lab;break}}
    }
    if(!base){base=trim(monogram(e));src="Monogram (no logo on file)"}
    const v={colour:base.c,white:up.white||(base.boxed?base.c:recolour(base.c,"#FFFFFF")),black:up.black||(base.boxed?base.c:recolour(base.c,"#000000"))};
    return {e,src,v,boxed:base.boxed,lum:lumRGB(base.avg),up:Object.keys(up)};
  })();
  LOGO.set(e.slug,p);return p;
}
const VARS=[["auto","Auto"],["colour","Colour"],["white","White"],["black","Black"]];
/* Intelligent pick: keep the colour logo if it stands out from what's behind it, otherwise white on dark, black on light. */
function pick(lg,bgLum,want){
  if(want&&want!=="auto")return want;
  if(lg.boxed)return "colour";
  if(contrast(lg.lum,bgLum)>=2.6)return "colour";
  return bgLum<.4?"white":"black";
}
const pickLabel=(v,bg)=>`${{colour:"Colour",white:"White",black:"Black"}[v]} (${bg<.18?"dark":bg<.5?"mid":"light"} background)`;

/* ---------- the property side: colours and logo ---------- */
async function propCtx(e){
  const cols=e&&L.colours?L.colours(e):[];
  const c1=cols.find(h=>lumHex(h)<.75)||"#0A1F44",c2=cols.find(h=>h!==c1)||VOLT;
  return {e,c1,c2,lg:e?await logoOf(e):null,name:e?e.name:"Your property"};
}
function drawLogo(g,lg,l,bgLum,want,o){
  const v=pick(lg,bgLum,want),img=lg.v[v];
  const pad=l.pad==null?.1:l.pad;
  const b={x:-l.w/2+l.w*pad,y:-l.h/2+l.h*pad,w:l.w*(1-2*pad),h:l.h*(1-2*pad)};
  const r=fitRect(img.width,img.height,b,"contain",l.align);
  g.save();g.translate(l.x+l.w/2,l.y+l.h/2);if(l.rot)g.rotate(l.rot*Math.PI/180);if(l.sy&&l.sy!==1)g.scale(1,l.sy);if(l.skx)g.transform(1,0,l.skx,1,0,0);
  if(l.glow){g.shadowColor="rgba(255,255,255,.55)";g.shadowBlur=18}
  if(o&&o.alpha!=null)g.globalAlpha*=o.alpha;
  g.drawImage(img,r.x,r.y,r.w,r.h);g.restore();
  return v;
}

/* ---------- the placement library: built-in templates ---------- */
function rng(seed){let s=seed>>>0||1;return()=>(s=(s*1664525+1013904223)>>>0)/4294967296}
function crowd(g,x,y,w,h,P,seed){
  const r=rng(seed||7);g.fillStyle="#15161a";g.fillRect(x,y,w,h);
  const cols=["#2b2d33","#3a3c44","#4a4d57",P.c1,P.c2,"#1f2025","#e7e7e2"];
  for(let row=0;row<h/22;row++)for(let i=0;i<w/18;i++){g.fillStyle=cols[Math.floor(r()*r()*cols.length)];g.beginPath();g.arc(x+i*18+r()*8,y+row*22+r()*6+8,5+r()*3,0,7);g.fill()}
  const gr=g.createLinearGradient(0,y,0,y+h);gr.addColorStop(0,"rgba(0,0,0,.55)");gr.addColorStop(1,"rgba(0,0,0,.1)");g.fillStyle=gr;g.fillRect(x,y,w,h);
}
function grass(g,x,y,w,h,stripes){
  for(let i=0;i<stripes;i++){g.fillStyle=i%2?"#2f7f39":"#348a3f";g.fillRect(x,y+i*h/stripes,w,h/stripes+1)}
  const gr=g.createLinearGradient(0,y,0,y+h);gr.addColorStop(0,"rgba(0,0,0,.25)");gr.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=gr;g.fillRect(x,y,w,h);
}
function propBadge(g,P,x,y,w,h,bgLum){
  if(P.lg)drawLogo(g,P.lg,{x,y,w,h,pad:.04},bgLum);
  else{g.fillStyle=onCol(P.c1);font(g,h*.4,800,true);g.fillText(P.name.toUpperCase().slice(0,14),x,y+h*.7)}
}
const BUILT={
  jersey:{name:"Playing jersey",group:"Kit",w:W,h:H,
    draw(g,P){
      const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#EFEFEB");bg.addColorStop(1,"#D8D8D2");g.fillStyle=bg;g.fillRect(0,0,W,H);
      const cx=960;const shirt=new Path2D();
      shirt.moveTo(cx-120,150);shirt.quadraticCurveTo(cx,250,cx+120,150);shirt.lineTo(cx+340,205);shirt.lineTo(cx+580,430);shirt.lineTo(cx+440,550);shirt.lineTo(cx+340,460);
      shirt.lineTo(cx+345,1000);shirt.quadraticCurveTo(cx,1040,cx-345,1000);shirt.lineTo(cx-340,460);shirt.lineTo(cx-440,550);shirt.lineTo(cx-580,430);shirt.lineTo(cx-340,205);shirt.closePath();
      g.save();g.shadowColor="rgba(0,0,0,.25)";g.shadowBlur=40;g.shadowOffsetY=18;g.fillStyle=P.c1;g.fill(shirt);g.restore();
      g.save();g.clip(shirt);
      const sh=g.createLinearGradient(cx-580,0,cx+580,0);sh.addColorStop(0,"rgba(255,255,255,.14)");sh.addColorStop(.5,"rgba(255,255,255,0)");sh.addColorStop(1,"rgba(0,0,0,.22)");g.fillStyle=sh;g.fillRect(0,0,W,H);
      g.strokeStyle=P.c2;g.lineWidth=30;g.beginPath();g.moveTo(cx+580,430);g.lineTo(cx+440,550);g.moveTo(cx-580,430);g.lineTo(cx-440,550);g.stroke();
      g.strokeStyle="rgba(0,0,0,.12)";g.lineWidth=4;g.beginPath();g.moveTo(cx-340,460);g.quadraticCurveTo(cx-300,700,cx-320,980);g.moveTo(cx+340,460);g.quadraticCurveTo(cx+300,700,cx+320,980);g.stroke();
      g.restore();
      g.strokeStyle=P.c2;g.lineWidth=24;g.beginPath();g.moveTo(cx-120,152);g.quadraticCurveTo(cx,250,cx+120,152);g.stroke();
      propBadge(g,P,cx+120,280,140,140,lumHex(P.c1));
    },
    layers:P=>[{type:"logo",x:720,y:470,w:480,h:200,pad:.06}]},
  led:{name:"LED perimeter board",group:"Signage",w:W,h:H,
    draw(g,P){
      crowd(g,0,0,W,610,P,11);
      g.fillStyle="#050505";g.fillRect(0,600,W,130);
      g.fillStyle="rgba(255,255,255,.04)";for(let x=0;x<W;x+=6)g.fillRect(x,600,1,130);
      g.fillStyle="#1d1d1d";g.fillRect(0,600,W,6);g.fillRect(0,724,W,6);
      grass(g,0,730,W,350,6);
      g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=6;g.beginPath();g.moveTo(0,860);g.lineTo(W,860);g.stroke();
    },
    layers:P=>[0,1,2].map(i=>({type:"logo",x:40+i*640,y:612,w:560,h:106,pad:.08,glow:true}))},
  screen:{name:"Big screen",group:"Signage",w:W,h:H,
    draw(g,P){
      const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#0b0d12");sky.addColorStop(1,"#1f2733");g.fillStyle=sky;g.fillRect(0,0,W,H);
      [[260,90],[1660,90]].forEach(([x,y])=>{const r=g.createRadialGradient(x,y,4,x,y,260);r.addColorStop(0,"rgba(255,255,240,.85)");r.addColorStop(1,"rgba(255,255,240,0)");g.fillStyle=r;g.fillRect(x-260,y-260,520,520)});
      g.fillStyle="#0a0a0a";g.fillRect(430,150,1060,620);
      const sc=g.createLinearGradient(0,170,0,750);sc.addColorStop(0,P.c1);sc.addColorStop(1,"#000000");g.fillStyle=sc;g.fillRect(450,170,1020,580);
      g.fillStyle="rgba(255,255,255,.035)";for(let y=170;y<750;y+=5)g.fillRect(450,y,1020,1);
      drawText(g,{x:500,y:205,w:920,h:60,text:`Official partner of ${P.name}`,size:44,weight:800,cond:true,upper:true,color:"#FFFFFF",align:"center",track:2});
      if(P.lg)drawLogo(g,P.lg,{x:1330,y:650,w:120,h:80,pad:.05},.05);
      g.fillStyle="#111";g.fillRect(940,770,40,90);
      crowd(g,0,840,W,240,P,23);
    },
    layers:P=>[{type:"logo",x:620,y:300,w:680,h:320,pad:.06}]},
  van:{name:"Team vehicle",group:"Vehicle",w:W,h:H,
    draw(g,P){
      g.fillStyle="#E9E9E5";g.fillRect(0,0,W,H);g.fillStyle="#cfcfca";g.fillRect(0,880,W,200);
      g.fillStyle="rgba(0,0,0,.18)";g.beginPath();g.ellipse(960,905,760,34,0,0,7);g.fill();
      const body=new Path2D();body.moveTo(260,340);body.lineTo(1380,340);body.quadraticCurveTo(1470,340,1520,420);body.lineTo(1640,600);body.quadraticCurveTo(1670,640,1670,700);body.lineTo(1670,830);body.lineTo(260,830);body.quadraticCurveTo(230,830,230,800);body.lineTo(230,370);body.quadraticCurveTo(230,340,260,340);body.closePath();
      g.fillStyle="#FFFFFF";g.fill(body);g.strokeStyle="#bdbdb7";g.lineWidth=3;g.stroke(body);
      g.fillStyle="#2a3038";const win=new Path2D();win.moveTo(1400,380);win.lineTo(1490,430);win.lineTo(1590,600);win.lineTo(1400,600);win.closePath();g.fill(win);
      g.fillStyle=P.c1;g.fillRect(232,720,1436,70);g.fillStyle=P.c2;g.fillRect(232,790,1436,14);
      g.strokeStyle="#c9c9c3";g.lineWidth=3;g.beginPath();g.moveTo(1380,380);g.lineTo(1380,830);g.stroke();
      [[520,840],[1400,840]].forEach(([x,y])=>{g.fillStyle="#111";g.beginPath();g.arc(x,y,105,0,7);g.fill();g.fillStyle="#9a9a96";g.beginPath();g.arc(x,y,48,0,7);g.fill()});
      propBadge(g,P,1120,600,220,100,1);
    },
    layers:P=>[{type:"logo",x:330,y:400,w:760,h:280,pad:.06}]},
  wall:{name:"Media wall",group:"Signage",w:W,h:H,
    draw(g,P){
      g.fillStyle="#FFFFFF";g.fillRect(0,0,W,H);
      const cw=320,ch=270;
      for(let r=0;r<4;r++)for(let c=0;c<6;c++){if((r+c)%2===0){if(P.lg)drawLogo(g,P.lg,{x:c*cw+40,y:r*ch+50,w:cw-80,h:ch-100,pad:.08},1);
        else drawText(g,{x:c*cw+30,y:r*ch+90,w:cw-60,h:ch-160,text:P.name,size:48,weight:800,cond:true,upper:true,align:"center",valign:"middle"})}}
      const sh=g.createLinearGradient(0,0,W,0);sh.addColorStop(0,"rgba(0,0,0,.06)");sh.addColorStop(.5,"rgba(0,0,0,0)");sh.addColorStop(1,"rgba(0,0,0,.06)");g.fillStyle=sh;g.fillRect(0,0,W,H);
    },
    layers:P=>{const o=[];for(let r=0;r<4;r++)for(let c=0;c<6;c++)if((r+c)%2===1)o.push({type:"logo",x:c*320+40,y:r*270+50,w:240,h:170,pad:.08});return o}},
  pitch:{name:"On-field logo",group:"Signage",w:W,h:H,
    draw(g,P){
      crowd(g,0,0,W,190,P,31);g.fillStyle="#050505";g.fillRect(0,190,W,50);
      grass(g,0,240,W,840,10);
      g.strokeStyle="rgba(255,255,255,.85)";g.lineWidth=7;g.beginPath();g.ellipse(960,700,520,170,0,0,7);g.stroke();
      g.beginPath();g.moveTo(0,700);g.lineTo(W,700);g.stroke();
    },
    layers:P=>[{type:"logo",x:560,y:520,w:800,h:360,pad:.04,sy:.5,op:.92}]},
  social:{name:"Partnership announcement",group:"Digital",w:1080,h:1350,
    draw(g,P,pc){
      g.fillStyle="#FFFFFF";g.fillRect(0,0,1080,1350);
      g.fillStyle=P.c1;g.fillRect(0,0,1080,620);
      g.fillStyle=VOLT;g.fillRect(70,680,250,58);
      drawText(g,{x:86,y:690,w:220,h:44,text:"New partner",size:34,weight:800,cond:true,upper:true,color:"#000"});
      drawText(g,{x:70,y:770,w:940,h:360,text:`${pc&&pc.be?pc.be.name:"Your brand"} x ${P.name}`,size:150,weight:800,cond:true,upper:true,color:INK});
      drawText(g,{x:70,y:1190,w:940,h:70,text:`Official partner of ${P.name}`,size:36,weight:400,color:GREY});
    },
    layers:P=>[{type:"prop",x:110,y:150,w:380,h:320,pad:.06},{type:"logo",x:590,y:150,w:380,h:320,pad:.06}]}
};
const BUILT_ORDER=["jersey","led","screen","wall","pitch","van","social"];

/* Library = built-ins plus your own (Design uploads and Studio compositions), kept in settings. */
const lib={own:()=>cfg.get("templates",[]),save(list){cfg.set("templates",list)},
  all(){return [...BUILT_ORDER.map(id=>({id,builtin:id,name:BUILT[id].name,group:BUILT[id].group,w:BUILT[id].w,h:BUILT[id].h})),...this.own()]},
  byId(id){return this.all().find(t=>t.id===id)}};

const TOK=/\{\{\s*(\w+)\s*\}\}/g;
const fillT=(s,T)=>String(s??"").replace(TOK,(m,k)=>k in T&&T[k]!==""&&T[k]!=null?T[k]:m.includes("brand")?"your brand":"");

/* Renders a template for one brand and property. o.edit draws the zones and the selection for the editor. */
async function renderTpl(t,pc,o){
  o=o||{};await fonts();
  const w=t.w||W,h=t.h||H,c=canv(w,h),g=c.getContext("2d");
  const P=await propCtx(pc&&pc.pe);
  const B=t.builtin&&BUILT[t.builtin];
  if(B)B.draw(g,P,pc);
  else{g.fillStyle="#E6E6E2";g.fillRect(0,0,w,h);const bi=await media(t.base);
    if(bi)g.drawImage(bi,0,0,w,h);
    else if(o.edit)drawText(g,{x:0,y:h/2-60,w,h:120,text:"Upload a photo to start",size:64,weight:800,cond:true,upper:true,align:"center",valign:"middle",color:GREY})}
  const layers=B?B.layers(P):(t.layers||[]);
  const T=pc?pc.T||{}:{};const picks=[];
  for(let i=0;i<layers.length;i++){
    const l=layers[i];g.save();g.globalAlpha=l.op==null?1:l.op;
    const rot=()=>{g.translate(l.x+l.w/2,l.y+l.h/2);if(l.rot)g.rotate(l.rot*Math.PI/180);g.translate(-(l.x+l.w/2),-(l.y+l.h/2))};
    if(l.type==="cover"){rot();if(l.feather)g.filter=`blur(${l.feather}px)`;g.fillStyle=l.fill||"#FFFFFF";g.fillRect(l.x,l.y,l.w,l.h);g.filter="none"}
    else if(l.type==="img"){const im=await layerImg(l);if(im){rot();g.drawImage(im,l.x,l.y,l.w,l.h)}}
    else if(l.type==="text"){rot();drawText(g,{x:l.x,y:l.y,w:l.w,h:l.h,text:fillT(l.text||"",T),size:l.size||80,weight:l.weight||800,cond:l.cond!==false,upper:!!l.upper,color:l.color||"#FFFFFF",align:l.align||"left",valign:"middle"})}
    else if(l.type==="logo"||l.type==="prop"){
      const lg=l.type==="logo"?(pc&&pc.be?await logoOf(pc.be):null):P.lg;
      if(lg){g.restore();g.save();const bgL=avgLum(g,l.x,l.y,l.w,l.h);g.globalAlpha=l.op==null?1:l.op;
        const v=drawLogo(g,lg,l,bgL,o.variant&&l.type==="logo"?o.variant:l.variant);if(l.type==="logo")picks.push({v,bg:bgL,src:lg.src})}
      else if(o.edit){g.setLineDash([16,10]);g.strokeStyle=VOLT;g.lineWidth=5;g.strokeRect(l.x,l.y,l.w,l.h);g.setLineDash([]);drawText(g,{x:l.x,y:l.y,w:l.w,h:l.h,text:l.type==="logo"?"Brand logo":"Property logo",size:48,weight:800,cond:true,upper:true,align:"center",valign:"middle",color:VOLT})}
    }
    g.restore();
    if(o.edit){g.save();g.translate(l.x+l.w/2,l.y+l.h/2);if(l.rot)g.rotate(l.rot*Math.PI/180);g.translate(-(l.x+l.w/2),-(l.y+l.h/2));
      const on=i===o.sel;g.strokeStyle=on?VOLT:"rgba(255,255,255,.7)";g.lineWidth=on?6:2;g.setLineDash(on?[]:[10,8]);g.strokeRect(l.x,l.y,l.w,l.h);g.setLineDash([]);
      if(on){g.fillStyle=VOLT;g.fillRect(l.x+l.w-22,l.y+l.h-22,44,44);g.strokeStyle="#000";g.lineWidth=3;g.strokeRect(l.x+l.w-22,l.y+l.h-22,44,44)}
      g.restore()}
  }
  return {c,picks};
}
/* Studio image layers can drop a white background (handy for product shots on white). */
const KEYED=new Map();
async function layerImg(l){
  const im=await media(l.key);if(!im||!l.keyWhite)return im;
  const k=l.key+"|kw";if(KEYED.has(k))return KEYED.get(k);
  const c=canv(im.naturalWidth,im.naturalHeight),g=c.getContext("2d");g.drawImage(im,0,0);
  const d=g.getImageData(0,0,c.width,c.height),p=d.data;
  for(let i=0;i<p.length;i+=4){const m=Math.min(p[i],p[i+1],p[i+2]);if(m>238)p[i+3]=0;else if(m>215)p[i+3]=Math.round(p[i+3]*(238-m)/23)}
  g.putImageData(d,0,0);KEYED.set(k,c);return c;
}

/* ---------- the pitch: who's pitching to whom ---------- */
const ctxGet=()=>cfg.get("ctx",{mode:"p",prop:"",brand:"",brands:[],props:[]});
const ctxSet=c=>cfg.set("ctx",c);
const org=slug=>slug?D.orgs.get(slug)||null:null;
function pairs(){
  const c=ctxGet();
  if(c.mode==="b")return c.brand?[{p:c.props[0]||"",b:c.brand,all:c.props}]:[];
  return c.prop?(c.brands.length?c.brands:[""]).map(b=>({p:c.prop,b})):[];
}
/* Targets: up to 25 per pitch. Brand-first pitches list properties; property pitches list brands. */
function targets(){const c=ctxGet();return c.mode==="b"?c.props:c.brands}
const live=d=>!d.ended&&d.status!=="Ended"&&(d.ends?d.ends>=yr:(d.date||d.month)?S.yearOf(d)>=yr-3:true);
const PT={club:"club",body:"league or governing body",event:"event",national:"national team",athlete:"athlete",venue:"venue"};
const BAND={"Call now":"Call now",Strong:"Strong fit",Watch:"Worth a look"};
function topSport(o){if(!o)return "";let best="",n=0;o.sports.forEach((v,k)=>{if(v>n){n=v;best=k}});return best}
function pairData(pSlug,bSlug){
  const p=org(pSlug),b=org(bSlug);
  const rec=p&&MX?MX.props[p.e.slug]:null,brec=b&&MX?MX.brands[b.e.slug]:null;
  const m=rec&&b?[...(rec.m||[]),...(rec.e||[])].find(r=>r.b===b.e.slug):null;
  const bm=brec&&p?[...(brec.m||[]),...(brec.e||[])].find(r=>r.p===p.e.slug):null;
  const sc=m||bm||null;
  const sub=(m&&m.u)||(brec&&brec.u)||"";
  const cat=b?b.cat:"";
  const sport=(rec&&rec.s)||topSport(p)||"sport";
  const slot=rec&&sub?(rec.sl||[]).find(s=>s.u===sub)||null:null;
  const open=rec?(rec.sl||[]).filter(s=>s.st==="open").map(s=>s.u):[];
  const seen=new Set();
  const port=b?b.deals.filter(x=>x.side==="b"&&live(x.d)).filter(x=>{const o=(x.other||[])[0];if(!o||seen.has(o.slug))return false;seen.add(o.slug);return true}).slice(0,8):[];
  const pseen=new Set();
  const pPartners=p?p.deals.filter(x=>x.side==="p"&&live(x.d)).filter(x=>{const o=(x.other||[])[0];if(!o||pseen.has(o.slug))return false;pseen.add(o.slug);return true}):[];
  const mk=p&&p.deals[0]?S.mkt(p.deals[0].d):"";
  let bench=b&&cat?D.deals.filter(d=>live(d)&&d.sport===sport&&(d._cats||[]).includes(cat)&&!(d._bs||[]).some(e=>e.slug===b.e.slug)):[];
  bench=[...bench.filter(d=>S.mkt(d)===mk),...bench.filter(d=>S.mkt(d)!==mk)].slice(0,7);
  return {p,b,rec,sc,sub,cat,sport,slot,open,port,pPartners,bench,reach:rec?rec.r:"",type:rec?rec.t:"",pf:rec?rec.pf:null,
    nB:b?b.deals.filter(x=>x.side==="b").length:0,sportsB:b?[...b.sports.keys()]:[]};
}
function tokens(pd){
  return {brand:pd.b?pd.b.e.name:"Your brand",property:pd.p?pd.p.e.name:"Your property",category:pd.cat||"",sub:pd.sub||pd.cat||"",sport:pd.sport||"sport",
    reach:(pd.reach||"").toLowerCase(),ptype:PT[pd.type]||"property",year:yr,date:NOW.toLocaleDateString("en-AU",{month:"long",year:"numeric"}),
    score:pd.sc?pd.sc.x:"",partners:pd.pPartners.length};
}
const pcOf=(pSlug,bSlug)=>{const pd=pairData(pSlug,bSlug);return {pe:pd.p?pd.p.e:null,be:pd.b?pd.b.e:null,T:tokens(pd),pd}};

/* ---------- the master deck ---------- */
const SECS=[["intro","Intro"],["fit","The fit"],["opp","The opportunity"],["pack","The package"],["close","Close"]];
const KINDS={cover:"Cover",shortlist:"Shortlist",why:"Why this brand",about:"About the property",portfolio:"Brand's sport portfolio",opportunity:"The open slot",
  benchmark:"Category benchmark",landscape:"Category landscape",renewals:"Renewals coming up",reco:"Recommendation",inventory:"Design",video:"Video",package:"The package",next:"Next steps",text:"Text",upload:"Master slide"};
const REPEAT=new Set(["why","about","opportunity","inventory","video"]); /* brand-first decks repeat these for each property */
function stdMaster(mode){
  const s=(kind,sec,o)=>Object.assign({id:uid(),kind,sec,on:true},o||{});
  if(mode==="b")return {name:"Agency strategy",accent:"volt",slides:[
    s("cover","intro",{title:"Partnership options for {{brand}}"}),
    s("portfolio","intro",{title:"Where {{brand}} is today"}),
    s("landscape","fit",{title:"What {{category}} brands back"}),
    s("renewals","fit",{title:"Coming up for renewal"}),
    s("shortlist","opp",{title:"What's out there"}),
    s("about","opp",{title:"{{property}}",body:"{{property}} is a {{reach}} {{ptype}} in {{sport}}, with {{partners}} live partners on file."}),
    s("why","opp",{title:"Why {{property}} fits"}),
    s("opportunity","opp",{title:"The open slot at {{property}}"}),
    s("inventory","opp",{title:"{{brand}} at {{property}}",tpl:"led"}),
    s("reco","pack",{title:"Our recommendation",body:"Lead with {{top}}.\n{{topwhy}}\nKeep {{second}} as the back-up option."}),
    s("next","close",{title:"Next steps",body:"Agree the shortlist.\nWe open conversations with each property.\nTerms and an activation plan back to {{brand}} in four weeks."})
  ]};
  return {name:"Property pitch",accent:"volt",slides:[
    s("cover","intro",{title:"{{property}} x {{brand}}"}),
    s("why","fit",{title:"Why {{brand}}"}),
    s("about","fit",{title:"About {{property}}",body:"{{property}} is a {{reach}} {{ptype}} in {{sport}}, with {{partners}} live partners on file."}),
    s("portfolio","fit",{title:"{{brand}} in sport"}),
    s("opportunity","opp",{title:"The open slot: {{sub}}"}),
    s("benchmark","opp",{title:"{{category}} in {{sport}}"}),
    s("inventory","opp",{title:"What it looks like",tpl:"jersey"}),
    s("inventory","opp",{title:"Every home game",tpl:"led"}),
    s("package","pack",{title:"The package",body:"Official {{sub}} partner of {{property}}\nLED and big screen inventory at every home game\nPlayer appearances and a content series\nMatch-day hospitality and tickets\nRights to use {{property}} marks in your campaigns",value:"On request"}),
    s("next","close",{title:"Next steps",body:"A 30-minute call to walk through the package.\nWe build the activation plan around {{brand}}'s calendar.\nTerms agreed and launch together."})
  ]};
}
/* One master per deck type: property decks sell partnerships, agency decks set out a brand's options. */
const mkey=()=>ctxGet().mode==="b"?"masterB":"master";
const master={get(){return cfg.get(mkey(),null)||stdMaster(ctxGet().mode)},set(m){cfg.set(mkey(),m)}};

/* Slide builders. Each returns {els,bg,notes}; one element list feeds the preview, PDF, PowerPoint and share link. */
const M=120;
function frame(n,total,T,sec,acc,ctx){
  return [{t:"rect",x:M,y:96,w:56,h:14,fill:acc},
    {t:"text",x:M+76,y:84,w:900,h:40,text:sec,size:24,weight:800,upper:true,color:GREY,track:3},
    {t:"rect",x:M,y:1000,w:W-2*M,h:2,fill:LINE},
    {t:"text",x:M,y:1018,w:1200,h:36,text:ctx&&ctx.mode==="b"?`${T.brand} partnership options`:`${T.property} x ${T.brand}`,size:24,weight:800,upper:true,color:GREY,track:2},
    {t:"text",x:W-M-200,y:1018,w:200,h:36,text:String(n).padStart(2,"0"),size:24,weight:800,color:GREY,align:"right"}];
}
const title=(s,T,o)=>Object.assign({t:"text",x:M,y:140,w:W-2*M,h:230,text:fillT(s.title,T),size:124,min:56,weight:800,cond:true,upper:true,valign:"bottom",color:INK},o||{});
const logoEl=async(e,box,bg)=>{if(!e)return null;const lg=await logoOf(e);if(!lg)return null;return Object.assign({t:"img",src:lg.v[pick(lg,bg==null?1:bg,box.variant)],fit:"contain"},box)};
async function slideEls(s,pd,n,total,acc,ctx){
  const T=tokens(pd),secName=(SECS.find(x=>x[0]===s.sec)||["",""])[1];
  const els=[],notes=[];const push=e=>{if(e)els.push(e)};
  const accTxt=onCol(acc);
  if(s.kind==="cover"){
    const tt=ctx.mode==="b"?Object.assign({},s,{title:s.title.includes("{{property}}")?"Partnership options for {{brand}}":s.title}):s;
    push({t:"rect",x:0,y:0,w:W,h:16,fill:acc});
    push({t:"text",x:M,y:110,w:1200,h:40,text:ctx.mode==="b"?"Partnership options":"Partnership proposal",size:28,weight:800,upper:true,color:GREY,track:3});
    push(title(tt,T,{y:170,h:560,size:230,min:90}));
    push({t:"rect",x:M,y:770,w:220,h:18,fill:acc});
    if(ctx.mode==="b"){push(await logoEl(pd.b&&pd.b.e,{x:M,y:830,w:300,h:150,align:"left"}))}
    else{push(await logoEl(pd.p&&pd.p.e,{x:M,y:830,w:260,h:150,align:"left"}));
      push({t:"text",x:M+290,y:850,w:80,h:110,text:"x",size:90,weight:800,cond:true,color:GREY,align:"center",valign:"middle"});
      push(await logoEl(pd.b&&pd.b.e,{x:M+400,y:830,w:260,h:150,align:"left"}))}
    push({t:"text",x:1100,y:880,w:W-M-1100,h:110,text:`Prepared for ${T.brand}\n${T.date}`,size:30,weight:400,color:GREY,align:"right",valign:"bottom"});
    return {els,bg:"#FFFFFF",notes};
  }
  els.push(...frame(n,total,T,secName,acc,ctx));
  if(s.kind==="shortlist"){
    push(title(s,T));
    const rows=(ctx.all||[]).slice(0,8).map(ps=>pairData(ps,pd.b&&pd.b.e.slug));
    for(let i=0;i<rows.length;i++){const r=rows[i],y=420+i*70;
      push({t:"rect",x:M,y:y+64,w:W-2*M,h:1,fill:LINE});
      push(await logoEl(r.p&&r.p.e,{x:M,y:y+6,w:90,h:52}));
      push({t:"text",x:M+120,y:y+12,w:760,h:44,text:r.p?r.p.e.name:"",size:34,weight:800,upper:true,cond:true});
      push({t:"text",x:M+900,y:y+16,w:420,h:40,text:`${r.sport}${r.reach?` · ${r.reach}`:""}`,size:26,color:GREY});
      push({t:"text",x:M+1340,y:y+16,w:340,h:40,text:r.sc?`Scout Score ${r.sc.x}`:"",size:26,weight:800,align:"right"});
      notes.push(`${r.p?r.p.e.name:""}: ${((r.sc||{}).w||[]).join("; ")}`)}
    if(!rows.length)push({t:"text",x:M,y:440,w:1400,h:80,text:"Add properties to the pitch to fill this slide.",size:36,color:GREY});
  }
  else if(s.kind==="why"){
    push(title(s,T));
    if(pd.sc){push({t:"rect",x:M,y:440,w:540,h:330,fill:acc});
      push({t:"text",x:M+40,y:450,w:460,h:250,text:String(pd.sc.x),size:260,weight:800,cond:true,color:accTxt,valign:"middle"});
      push({t:"text",x:M+40,y:700,w:460,h:50,text:`Scout Score · ${BAND[pd.sc.k]||pd.sc.k||"fit"}`,size:28,weight:800,upper:true,color:accTxt,track:2});
      push({t:"text",x:M,y:800,w:540,h:150,text:`How closely ${T.brand}'s partnerships match ${T.property}, plus the open slot. Out of 100.`,size:26,color:GREY})}
    else{push({t:"rect",x:M,y:440,w:540,h:330,fill:acc});
      push({t:"text",x:M+40,y:450,w:460,h:250,text:String(pd.nB),size:260,weight:800,cond:true,color:accTxt,valign:"middle"});
      push({t:"text",x:M+40,y:700,w:460,h:50,text:"Partnerships in sport",size:28,weight:800,upper:true,color:accTxt,track:2})}
    let reasons=((pd.sc||{}).w||[]).slice(0,5);
    if(!reasons.length){reasons=[pd.nB?`Backs ${pd.nB} propert${pd.nB===1?"y":"ies"} in sport${pd.sportsB.length?`, across ${pd.sportsB.slice(0,3).join(", ")}`:""}`:"",
      pd.slot&&pd.slot.st==="open"?`${T.property} has no ${pd.sub} partner: ${pd.slot.a} of ${pd.slot.n} peers do`:"",
      pd.bench.length?`${pd.cat} brands are already active in ${pd.sport}`:""].filter(Boolean)}
    if(!reasons.length)reasons=["Add your reasons here"];
    reasons.forEach((r,i)=>{const y=440+i*112;push({t:"rect",x:780,y:y+16,w:18,h:18,fill:acc,stroke:INK,lw:2});
      push({t:"text",x:830,y,w:W-M-830,h:100,text:r,size:38,weight:400,color:INK,lh:1.2})});
    notes.push(...reasons);
  }
  else if(s.kind==="about"){
    push(title(s,T));
    push({t:"text",x:M,y:430,w:800,h:300,text:fillT(s.body,T),size:42,color:INK,lh:1.3});
    const pf=pd.pf||{};const facts=[["Sport",pd.sport],["Reach",pd.reach||"-"],["Audience",(pf.aud||[]).slice(0,4).join(", ")||"-"],["Stands for",(pf.align||[]).slice(0,4).join(", ")||"-"]];
    facts.forEach(([k,v],i)=>{const x=1040+(i%2)*400,y=430+Math.floor(i/2)*170;push({t:"rect",x,y,w:360,h:2,fill:INK});
      push({t:"text",x,y:y+20,w:360,h:30,text:k,size:22,weight:800,upper:true,color:GREY,track:2});
      push({t:"text",x,y:y+58,w:360,h:100,text:v,size:36,weight:800,cond:true,upper:true,color:INK})});
    const pp=pd.pPartners.slice(0,8);
    if(pp.length){push({t:"text",x:M,y:780,w:900,h:34,text:"Current partners",size:22,weight:800,upper:true,color:GREY,track:2});
      for(let i=0;i<pp.length;i++)push(await logoEl(pp[i].other[0],{x:M+i*210,y:830,w:180,h:130}))}
  }
  else if(s.kind==="portfolio"){
    push(title(s,T));
    push({t:"text",x:M,y:390,w:1500,h:40,text:pd.nB?`${pd.nB} partnership${pd.nB===1?"":"s"} in the database, across ${pd.sportsB.slice(0,4).join(", ")||"sport"}`:"No partnerships in the database yet",size:30,color:GREY});
    for(let i=0;i<pd.port.length;i++){const x=M+(i%4)*430,y=460+Math.floor(i/4)*265,o=pd.port[i].other[0],d=pd.port[i].d;
      push({t:"rect",x,y,w:400,h:240,fill:CANVAS});
      push(await logoEl(o,{x:x+30,y:y+20,w:340,h:120},lumHex(CANVAS)));
      push({t:"text",x:x+30,y:y+150,w:340,h:40,text:o.name,size:28,weight:800,upper:true,cond:true});
      push({t:"text",x:x+30,y:y+192,w:340,h:34,text:`${d.sport||""}${S.yearOf(d)?` · since ${S.yearOf(d)}`:""}`,size:22,color:GREY})}
  }
  else if(s.kind==="opportunity"){
    push(title(s,T));
    const sl=pd.slot;let line,stat="",statLab="";
    if(sl&&sl.st==="open"){line=`${T.property} has no ${pd.sub} partner. ${sl.a} of ${sl.n} peers do.`;stat=`${sl.a}/${sl.n}`;statLab=`peers with a ${pd.sub} partner`}
    else if(sl&&sl.st==="ending"){line=`${T.property}'s ${pd.sub} partnership${sl.b.length?` with ${sl.b.join(", ")}`:""} ${sl.e?`is due by ${sl.e}`:"is past its last confirmed date"}.`;stat=sl.e?String(sl.e):"Due";statLab="up for renewal"}
    else if(sl&&sl.st==="sold"){line=`${T.property}'s ${pd.sub} slot is held by ${sl.b.join(", ")}. There's room in a neighbouring category.`;stat=String(pd.open.length);statLab="open categories"}
    else{line=`${pd.open.length} categories open at ${T.property} right now.`;stat=String(pd.open.length);statLab="open categories"}
    push({t:"text",x:M,y:430,w:1060,h:330,text:line,size:72,weight:800,cond:true,upper:true,color:INK,lh:1});
    push({t:"rect",x:1300,y:430,w:500,h:330,fill:acc});
    push({t:"text",x:1340,y:450,w:420,h:220,text:stat,size:200,weight:800,cond:true,color:accTxt,valign:"middle"});
    push({t:"text",x:1340,y:680,w:420,h:60,text:statLab,size:26,weight:800,upper:true,color:accTxt,track:1});
    const others=pd.open.filter(u=>u!==pd.sub).slice(0,6);
    if(others.length){push({t:"text",x:M,y:800,w:900,h:34,text:"Also open",size:22,weight:800,upper:true,color:GREY,track:2});
      others.forEach((u,i)=>{const x=M+(i%3)*560,y=850+Math.floor(i/3)*64;push({t:"rect",x,y,w:530,h:52,fill:"#FFFFFF",stroke:INK,lw:2});
        push({t:"text",x:x+20,y:y+8,w:490,h:36,text:u,size:26,weight:800,upper:true,valign:"middle"})})}
    notes.push(line);
  }
  else if(s.kind==="benchmark"){
    push(title(s,T));
    if(!pd.bench.length)push({t:"text",x:M,y:440,w:1400,h:80,text:`No other ${pd.cat||"category"} partnerships in ${pd.sport} in the database yet.`,size:36,color:GREY});
    for(let i=0;i<pd.bench.length;i++){const d=pd.bench[i],y=420+i*80;
      push({t:"rect",x:M,y:y+74,w:W-2*M,h:1,fill:LINE});
      push(await logoEl(d._b,{x:M,y:y+8,w:110,h:58}));
      push({t:"text",x:M+150,y:y+16,w:1000,h:46,text:d.deal,size:34,weight:800,upper:true,cond:true});
      push({t:"text",x:M+1180,y:y+20,w:280,h:40,text:d.tier||"",size:24,color:GREY});
      push({t:"text",x:M+1480,y:y+20,w:200,h:40,text:S.fmt(d),size:24,weight:800,color:GREY,align:"right"})}
  }
  else if(s.kind==="inventory"||s.kind==="video"){
    push(title(s,T,{h:150,y:130,size:100}));
    const t=lib.byId(s.tpl)||lib.byId("jersey");
    const r=await renderTpl(t,{pe:pd.p&&pd.p.e,be:pd.b&&pd.b.e,T});
    push({t:"img",src:r.c,x:M,y:310,w:W-2*M,h:670,fit:"contain"});
    push({t:"text",x:M,y:1018,w:W-2*M-220,h:36,text:"",size:24});
    notes.push(`${t.name}${s.kind==="video"?" (plays as video on the share link)":""}`);
  }
  else if(s.kind==="landscape"){
    push(title(s,T));
    const bs=pd.b?pd.b.e.slug:"";
    const rivals=D.brands.filter(o=>o.cat===pd.cat&&o.e.slug!==bs).map(o=>({o,l:o.deals.filter(x=>x.side==="b"&&live(x.d))})).filter(x=>x.l.length).sort((a,b)=>b.l.length-a.l.length).slice(0,6);
    if(!rivals.length)push({t:"text",x:M,y:440,w:1400,h:80,text:`No other ${pd.cat||"category"} brands in the database yet.`,size:36,color:GREY});
    for(let i=0;i<rivals.length;i++){const r=rivals[i],x=M+(i%3)*560,y=420+Math.floor(i/3)*280;
      push({t:"rect",x,y,w:530,h:4,fill:INK});
      push(await logoEl(r.o.e,{x,y:y+24,w:150,h:80,align:"left"}));
      push({t:"text",x:x+170,y:y+30,w:360,h:70,text:`${r.l.length} live`,size:30,weight:800,upper:true,color:GREY,valign:"middle",align:"right"});
      const names=[...new Set(r.l.map(z=>(z.other[0]||{}).name).filter(Boolean))].slice(0,4).join(", ");
      push({t:"text",x,y:y+120,w:530,h:130,text:names,size:28,color:INK,lh:1.25})}
    notes.push(...rivals.map(r=>`${r.o.e.name}: ${r.l.length} live partnerships`));
  }
  else if(s.kind==="renewals"){
    push(title(s,T));
    const src=ctx.mode==="b"?(pd.b?pd.b.deals.filter(x=>x.side==="b"):[]):(pd.p?pd.p.deals.filter(x=>x.side==="p"):[]);
    const rows=src.map(x=>x.d).filter(d=>!d.ended&&d.ends&&d.ends>=yr&&d.ends<=yr+2).sort((a,b)=>a.ends-b.ends).slice(0,7);
    if(!rows.length)push({t:"text",x:M,y:440,w:1500,h:80,text:"No partnerships with a confirmed or term-based end date in the next two years.",size:36,color:GREY});
    for(let i=0;i<rows.length;i++){const d=rows[i],y=420+i*80;
      push({t:"rect",x:M,y:y+74,w:W-2*M,h:1,fill:LINE});
      push({t:"rect",x:M,y:y+10,w:130,h:54,fill:acc});
      push({t:"text",x:M,y:y+10,w:130,h:54,text:String(d.ends),size:34,weight:800,cond:true,color:accTxt,align:"center",valign:"middle"});
      push({t:"text",x:M+170,y:y+16,w:1200,h:46,text:d.deal,size:34,weight:800,upper:true,cond:true});
      push({t:"text",x:M+1400,y:y+20,w:280,h:40,text:d.endsEst?"From term":"Confirmed",size:24,color:GREY,align:"right"})}
  }
  else if(s.kind==="reco"){
    push(title(s,T));
    const ranked=(ctx.all||[]).map(ps=>pairData(ps,pd.b&&pd.b.e.slug)).sort((a,b)=>((b.sc||{}).x||0)-((a.sc||{}).x||0));
    const T2=Object.assign({},T,{top:ranked[0]&&ranked[0].p?ranked[0].p.e.name:"the top property",topwhy:ranked[0]&&ranked[0].sc?(ranked[0].sc.w||[])[0]||"":"",second:ranked[1]&&ranked[1].p?ranked[1].p.e.name:"the next best"});
    push({t:"text",x:M,y:430,w:1060,h:500,text:fillT(s.body||"",T2),size:52,weight:800,cond:true,upper:true,color:INK,lh:1.05});
    if(ranked[0]&&ranked[0].p){push({t:"rect",x:1300,y:430,w:500,h:420,fill:acc});push(await logoEl(ranked[0].p.e,{x:1340,y:470,w:420,h:240},lumHex(acc)));
      push({t:"text",x:1340,y:740,w:420,h:80,text:ranked[0].sc?`Scout Score ${ranked[0].sc.x}`:"Top pick",size:34,weight:800,upper:true,color:accTxt,align:"center"})}
  }
  else if(s.kind==="package"){
    push(title(s,T));
    const lines=fillT(s.body||"",T).split("\n").filter(x=>x.trim()).slice(0,7);
    lines.forEach((l,i)=>{const y=430+i*78;push({t:"rect",x:M,y:y+14,w:16,h:16,fill:acc,stroke:INK,lw:2});push({t:"text",x:M+44,y,w:1040,h:64,text:l,size:36,color:INK})});
    push({t:"rect",x:1340,y:430,w:460,h:420,fill:acc});
    push({t:"text",x:1380,y:470,w:380,h:40,text:"Investment",size:26,weight:800,upper:true,color:accTxt,track:2});
    push({t:"text",x:1380,y:530,w:380,h:280,text:fillT(s.value||"On request",T),size:96,weight:800,cond:true,upper:true,color:accTxt,valign:"bottom"});
  }
  else if(s.kind==="next"){
    push(title(s,T));
    push({t:"text",x:M,y:430,w:1000,h:420,text:fillT(s.body||"",T),size:44,color:INK,lh:1.35});
    const me=cfg.get("me",{});
    if(me.name||me.email){push({t:"rect",x:1240,y:430,w:560,h:6,fill:acc});
      push({t:"text",x:1240,y:470,w:560,h:70,text:me.name||"",size:56,weight:800,cond:true,upper:true});
      push({t:"text",x:1240,y:550,w:560,h:80,text:[me.role,me.org].filter(Boolean).join(", "),size:30,color:GREY});
      push({t:"text",x:1240,y:650,w:560,h:120,text:[me.email,me.phone].filter(Boolean).join("\n"),size:32,color:INK})}
  }
  else if(s.kind==="text"){push(title(s,T));push({t:"text",x:M,y:430,w:1500,h:520,text:fillT(s.body||"",T),size:44,color:INK,lh:1.35})}
  else if(s.kind==="upload"){
    els.length=0;const im=await media(s.key);
    if(im)push({t:"img",src:im,x:0,y:0,w:W,h:H,fit:"cover"});
    if(s.overlay&&s.overlay!=="none"&&pd.b){
      const box=s.overlay==="tr"?{x:W-420,y:50,w:360,h:170}:s.overlay==="br"?{x:W-420,y:H-220,w:360,h:170}:{x:W/2-300,y:H/2-150,w:600,h:300};
      let bg=1;if(im){const c=paint([{t:"img",src:im,x:0,y:0,w:W,h:H,fit:"cover"}]);bg=avgLum(c.getContext("2d"),box.x,box.y,box.w,box.h)}
      push(await logoEl(pd.b.e,Object.assign({},box),bg))}
    return {els,bg:"#FFFFFF",notes};
  }
  return {els,bg:"#FFFFFF",notes};
}
/* The deck for one pitch: slides switched on, in section order; brand-first decks repeat the property slides. */
async function buildDeck(pair,opt){
  opt=opt||{};await fonts();
  const ms=master.get(),c=ctxGet();
  const acc0=ms.accent==="property"?(await propCtx(org(pair.p)&&org(pair.p).e)).c1:VOLT;
  const order=SECS.map(x=>x[0]);
  const on=ms.slides.filter(s=>s.on).filter(s=>s.kind!=="shortlist"||c.mode==="b").sort((a,b)=>order.indexOf(a.sec)-order.indexOf(b.sec));
  const plan=[];
  /* Brand-first: back-to-back property slides become one block per property (about, why, open slot, design...). */
  for(let i=0;i<on.length;){
    const s=on[i];
    if(c.mode==="b"&&REPEAT.has(s.kind)&&(pair.all||[]).length){let j=i;while(j<on.length&&REPEAT.has(on[j].kind)&&on[j].sec===s.sec)j++;
      const block=on.slice(i,j);pair.all.forEach(p=>block.forEach(x=>plan.push({s:x,p})));i=j}
    else{plan.push({s,p:pair.p});i++}
  }
  const out=[];
  for(let i=0;i<plan.length;i++){
    if(opt.progress)opt.progress(i,plan.length);
    const {s,p}=plan[i],pd=pairData(p,pair.b);
    const acc=ms.accent==="property"&&c.mode==="b"?(await propCtx(pd.p&&pd.p.e)).c1:acc0;
    const r=await slideEls(s,pd,i+1,plan.length,acc,{mode:c.mode,all:pair.all});
    out.push(Object.assign(r,{s,pd,title:fillT(s.title||KINDS[s.kind],tokens(pd))}));
  }
  return out;
}
const deckName=pair=>{const p=org(pair.p),b=org(pair.b),c=ctxGet();return c.mode==="b"?`${b?b.e.name:"Brand"} partnership options`:`${p?p.e.name:"Property"} x ${b?b.e.name:"Brand"}`};
const fileSafe=s=>String(s).replace(/[^\w]+/g,"_").replace(/^_|_$/g,"");

/* ---------- exports: PDF (written here, one JPEG page per slide) and PowerPoint (PptxGenJS) ---------- */
function canvasJpeg(c,q){const u=c.toDataURL("image/jpeg",q||.9);const b=atob(u.split(",")[1]);const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function pdfFrom(canvases){
  const enc=new TextEncoder(),parts=[],offs=[];let len=0;
  const add=x=>{const u=typeof x==="string"?enc.encode(x):x;parts.push(u);len+=u.length};
  const obj=(n,body)=>{offs[n]=len;add(`${n} 0 obj\n`);body.forEach(add);add("\nendobj\n")};
  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const n=canvases.length,pw=960,ph=540,kids=[];
  for(let i=0;i<n;i++)kids.push(`${3+i*3} 0 R`);
  obj(1,["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2,[`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${n} >>`]);
  canvases.forEach((c,i)=>{const pg=3+i*3,im=pg+1,ct=pg+2,jpg=canvasJpeg(c,.9);const cs=`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(pg,[`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`]);
    obj(im,[`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,jpg,"\nendstream"]);
    obj(ct,[`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`])});
  const total=3+n*3,xref=len;
  add(`xref\n0 ${total}\n0000000000 65535 f \n`);for(let i=1;i<total;i++)add(String(offs[i]).padStart(10,"0")+" 00000 n \n");
  add(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts,{type:"application/pdf"});
}
let vendor={};
const script=src=>vendor[src]||(vendor[src]=new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("Couldn't load "+src));document.head.appendChild(s)}));
const pptxLib=()=>script("assets/vendor/pptxgen.bundle.js").then(()=>window.PptxGenJS);
const hx=c=>String(c||"#000").replace("#","").toUpperCase().slice(0,6);
async function pptxFrom(slides,name){
  const P=await pptxLib();const pp=new P();pp.layout="LAYOUT_WIDE";pp.author="Sport Sport Sport Pro";pp.title=name;
  const k=1/144; /* 1920 px across = 13.333 in */
  slides.forEach(sl=>{
    const s=pp.addSlide();s.background={color:hx(sl.bg||"#FFFFFF")};
    sl.els.forEach(el=>{
      if(el.t==="rect"){s.addShape(pp.ShapeType.rect,{x:el.x*k,y:el.y*k,w:el.w*k,h:el.h*k,fill:{color:hx(el.fill)},line:el.stroke?{color:hx(el.stroke),width:(el.lw||2)*.5}:{type:"none"}})}
      else if(el.t==="text"&&String(el.text||"").trim()){
        const txt=el.upper?String(el.text).toUpperCase():String(el.text);
        s.addText(txt,{x:el.x*k,y:el.y*k,w:el.w*k,h:el.h*k,margin:0,fontFace:el.cond?"Arial Narrow":"Arial",fontSize:Math.max(6,Math.round((el._size||el.size)*.5*(el.cond?.8:.96)*10)/10), /* Arial Narrow and Arial run wider than Archivo */
          bold:(el.weight||400)>=700,color:hx(el.color||INK),align:el.align||"left",valign:el.valign==="middle"?"middle":el.valign==="bottom"?"bottom":"top",
          lineSpacingMultiple:el.lh||(el.cond?.9:1.2),charSpacing:el.track?el.track*.5:0,fit:"shrink"})}
      else if(el.t==="img"&&el.src){
        const sw=el.src.width||el.src.naturalWidth,sh=el.src.height||el.src.naturalHeight;if(!sw||!sh)return;
        const box=canv(el.w,el.h),r=fitRect(sw,sh,{x:0,y:0,w:el.w,h:el.h},el.fit,el.align);box.getContext("2d").drawImage(el.src,r.x,r.y,r.w,r.h);
        const opaque=el.fit==="cover"||(el.w>900&&el.h>500);
        s.addImage({data:opaque?box.toDataURL("image/jpeg",.9):box.toDataURL("image/png"),x:el.x*k,y:el.y*k,w:el.w*k,h:el.h*k})}
    });
    if(sl.notes&&sl.notes.length)s.addNotes(sl.notes.join("\n"));
  });
  return pp.write({outputType:"blob"});
}
const zipLib=()=>pptxLib().then(()=>window.JSZip);
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000)}

/* ---------- video: recorded from a canvas in real time ---------- */
const MIME=()=>["video/mp4;codecs=avc1.42E01E","video/mp4","video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported(m))||"";
const extOf=m=>m.includes("mp4")?"mp4":"webm";
function record(c,secs,frame,audio){
  return new Promise((res,rej)=>{
    const mime=MIME();if(!mime||!c.captureStream)return rej(new Error("This browser can't record video. Try Chrome."));
    const stream=c.captureStream(30);if(audio)audio.getAudioTracks().forEach(t=>stream.addTrack(t));
    const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8e6});const chunks=[];
    rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
    rec.onstop=()=>res(new Blob(chunks,{type:mime.split(";")[0]}));rec.onerror=e=>rej(e.error||e);
    frame(0);rec.start(250);const t0=performance.now();
    const tick=()=>{const t=(performance.now()-t0)/(secs*1000);frame(Math.min(1,t));if(t>=1){setTimeout(()=>rec.stop(),120);return}requestAnimationFrame(tick)};
    requestAnimationFrame(tick);
  });
}
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
async function clipFromDesign(t,pc,o){
  const full=(await renderTpl(t,pc)).c;
  const bare=await renderTpl(Object.assign({},t,t.builtin?{}:{layers:(t.layers||[]).filter(l=>l.type!=="logo")}),Object.assign({},pc,{be:null}));
  const w=1920,h=1080,c=canv(w,h),g=c.getContext("2d");
  const endCard=o.end?await endCardCanvas(pc):null,endAt=endCard?1-1.6/o.secs:2;
  const z=(t.builtin?BUILT[t.builtin].layers({}):t.layers||[]).find(l=>l.type==="logo")||{x:full.width/2-100,y:full.height/2-50,w:200,h:100};
  const fx=(z.x+z.w/2)/full.width,fy=(z.y+z.h/2)/full.height;
  const draw=(img,s,ox,oy,a)=>{const r=fitRect(img.width,img.height,{x:0,y:0,w,h},"cover");g.save();g.globalAlpha=a==null?1:a;g.translate(w*fx,h*fy);g.scale(s,s);g.translate(-w*fx+ox,-h*fy+oy);g.drawImage(img,r.x,r.y,r.w,r.h);g.restore()};
  return record(c,o.secs,t0=>{
    const t1=Math.min(1,t0/Math.min(1,endAt));g.fillStyle="#000";g.fillRect(0,0,w,h);
    if(o.motion==="push")draw(full,1+.14*ease(t1),0,0);
    else if(o.motion==="pan")draw(full,1.12,(ease(t1)-.5)*-200,0);
    else{const rv=Math.min(1,Math.max(0,(t1-.25)/.3));draw(bare.c,1+.05*t1,0,0);
      g.save();g.beginPath();g.rect(0,0,w*ease(rv),h);g.clip();draw(full,1+.05*t1,0,0);g.restore();
      if(rv>0&&rv<1){g.fillStyle=VOLT;g.fillRect(w*ease(rv)-14,0,28,h)}}
    if(endCard&&t0>endAt){const a=Math.min(1,(t0-endAt)/.25);g.globalAlpha=a;g.drawImage(endCard,0,0,w,h);g.globalAlpha=1}
  });
}
async function endCardCanvas(pc){
  const els=[{t:"rect",x:0,y:0,w:W,h:H,fill:"#FFFFFF"},{t:"rect",x:0,y:H-24,w:W,h:24,fill:VOLT}];
  if(pc.pe)els.push(await logoEl(pc.pe,{x:260,y:330,w:560,h:360}));
  els.push({t:"text",x:860,y:420,w:200,h:200,text:"x",size:160,weight:800,cond:true,color:GREY,align:"center",valign:"middle"});
  if(pc.be)els.push(await logoEl(pc.be,{x:1100,y:330,w:560,h:360}));
  return paint(els.filter(Boolean));
}
/* LED boards: a strip file (10:1) or the strip shown in the stadium. */
async function ledClip(pc,o){
  const sw=1920,sh=192,strip=canv(sw,sh),sg=strip.getContext("2d");
  const lg=pc.be?await logoOf(pc.be):null,P=await propCtx(pc.pe);
  const vid=o.mode==="video"&&o.video?o.video:null;
  const tag=`Official partner of ${P.name}`;
  const drawStrip=t=>{
    sg.fillStyle="#000";sg.fillRect(0,0,sw,sh);
    if(vid){const r=fitRect(vid.videoWidth||16,vid.videoHeight||9,{x:0,y:0,w:sw,h:sh},"cover");sg.drawImage(vid,r.x,r.y,r.w,r.h);return}
    const logoAt=(x,a,s)=>{if(!lg)return;sg.save();sg.globalAlpha=a;const v=lg.v[pick(lg,0)];const b={x:x-260*s,y:sh/2-70*s,w:520*s,h:140*s};const r=fitRect(v.width,v.height,b,"contain");sg.drawImage(v,r.x,r.y,r.w,r.h);sg.restore()};
    if(o.mode==="fade"){const ph=(t*o.secs/2.5)%2,a=ph<1?Math.min(1,ph*3):Math.max(0,1-(ph-1)*3);
      [0,1,2].forEach(i=>logoAt(320+i*640,a,1));
      if(P.lg){sg.save();sg.globalAlpha=1-a;const v=P.lg.v[pick(P.lg,0)];[0,1,2].forEach(i=>{const r=fitRect(v.width,v.height,{x:60+i*640,y:26,w:520,h:140},"contain");sg.drawImage(v,r.x,r.y,r.w,r.h)});sg.restore()}
      else{sg.globalAlpha=1-a;drawText(sg,{x:0,y:40,w:sw,h:110,text:tag,size:90,weight:800,cond:true,upper:true,color:"#fff",align:"center",valign:"middle"});sg.globalAlpha=1}}
    else{ /* motion preset: volt sweep, logos slide in, then the tagline runs across */
      const cyc=(t*o.secs)%5/5;
      if(cyc<.18){const p=ease(cyc/.18);sg.fillStyle=VOLT;sg.fillRect(0,0,sw*p,sh)}
      else if(cyc<.62){const p=Math.min(1,(cyc-.18)/.12);sg.fillStyle=P.c1;sg.fillRect(0,0,sw,sh);[0,1,2].forEach(i=>logoAt(320+i*640+(1-ease(Math.min(1,p*1.4-i*.15)))*500,Math.min(1,p*2),1))}
      else{const p=(cyc-.62)/.38;sg.fillStyle="#000";sg.fillRect(0,0,sw,sh);const x=sw-p*(sw*1.9);
        font(sg,110,800,true);sg.fillStyle=VOLT;sg.fillText(tag.toUpperCase(),x,140);logoAt(x+sg.measureText(tag.toUpperCase()).width+340,1,1)}
    }
    sg.fillStyle="rgba(0,0,0,.18)";for(let x=0;x<sw;x+=4)sg.fillRect(x,0,1,sh);
  };
  const out=o.size==="scene"?canv(1920,1080):strip,og=out.getContext("2d");
  let scene=null;
  if(o.size==="scene"){scene=canv(W,H);BUILT.led.draw(scene.getContext("2d"),P)}
  if(vid){vid.currentTime=0;vid.muted=true;await vid.play().catch(()=>{})}
  const blob=await record(out,o.secs,t=>{drawStrip(t);if(scene){og.drawImage(scene,0,0);og.drawImage(strip,0,600,W,130)}});
  if(vid)vid.pause();
  return blob;
}
/* Drop a brand into existing footage: a bug, a lower third or an end slate, with the clip's sound. No motion tracking. */
async function footageClip(pc,o){
  const v=o.video;const w=Math.min(1920,v.videoWidth||1280),h=Math.round(w*(v.videoHeight||720)/(v.videoWidth||1280));
  const c=canv(w,h),g=c.getContext("2d");const lg=pc.be?await logoOf(pc.be):null;
  const secs=Math.min(60,v.duration||10);
  let audio=null;try{const ac=new (window.AudioContext||window.webkitAudioContext)();const src=ac.createMediaElementSource(v);const dst=ac.createMediaStreamDestination();src.connect(dst);src.connect(ac.destination);audio=dst.stream;v._ac=ac}catch(e){}
  v.currentTime=0;v.muted=!audio;await v.play().catch(()=>{});
  const sz=o.scale||.18;
  const blob=await record(c,secs,t=>{
    g.drawImage(v,0,0,w,h);if(!lg)return;
    const bw=w*sz,bh=bw*.5,m=w*.03;
    if(o.pos==="lower"){const y=h-bh-m*1.4;g.globalAlpha=o.op;g.fillStyle="rgba(0,0,0,.6)";g.fillRect(m,y,bw*2.6,bh);g.fillStyle=VOLT;g.fillRect(m,y,10,bh);
      drawText(g,{x:m+30,y,w:bw*1.1,h:bh,text:"Presented by",size:bh*.28,weight:800,cond:true,upper:true,color:"#fff",valign:"middle"});
      drawLogo(g,lg,{x:m+bw*1.3,y,w:bw*1.2,h:bh,pad:.12},.05);g.globalAlpha=1}
    else if(o.pos==="slate"){const a=Math.max(0,Math.min(1,(t*secs-(secs-2.2))/.4));if(a>0){g.globalAlpha=a*o.op;g.fillStyle="#fff";g.fillRect(0,0,w,h);drawLogo(g,lg,{x:w*.25,y:h*.25,w:w*.5,h:h*.5,pad:.05},1);g.globalAlpha=1}}
    else{const x=o.pos==="tl"?m:w-bw-m,y=o.pos==="br"?h-bh-m:m;g.globalAlpha=o.op;drawLogo(g,lg,{x,y,w:bw,h:bh,pad:.05},avgLum(g,x,y,bw,bh));g.globalAlpha=1}
  },audio);
  v.pause();
  return blob;
}

/* ---------- UI ---------- */
const $=id=>document.getElementById(id);
const st={sub:"design",results:[],vres:[],busy:false};
const SUBS=[["design","Design"],["studio","Studio"],["video","Video"],["decks","Decks"],["shared","Shared"]];
const pillRow=(name,list,cur)=>list.map(([v,lab])=>`<button type="button" class="pill${cur===v?" on":""}" data-${name}="${esc(v)}" aria-pressed="${cur===v}">${esc(lab)}</button>`).join("");
const nm=slug=>{const o=org(slug);return o?o.e.name:slug};
function ctxBar(){
  const c=ctxGet(),T=targets();
  const brandOpts=D.brands.slice().sort((a,b)=>b.n-a.n).slice(0,3000).map(x=>`<option value="${esc(x.e.name)}">`).join("");
  const propOpts=D.props.slice().sort((a,b)=>b.n-a.n).slice(0,3000).map(x=>`<option value="${esc(x.e.name)}">`).join("");
  const main=c.mode==="b"?c.brand:c.prop;
  return `<div class="pd-ctx">
  <div class="ctl"><div class="pills tabs-keep">${pillRow("pdmode",[["p","Property: sell partnerships"],["b","Agency: strategy for a brand"]],c.mode)}</div></div>
  <div class="pd-ctx-r">
    <label class="pd-f"><span class="lbl mute-l">${c.mode==="b"?"Brand":"Your property"}</span><input class="srch" id="pdMain" list="${c.mode==="b"?"pdBrandL":"pdPropL"}" value="${esc(main?nm(main):"")}" placeholder="${c.mode==="b"?"e.g. Cadbury, Coopers":"e.g. Carlton, Wallabies"}" autocomplete="off"></label>
    <label class="pd-f"><span class="lbl mute-l">Add ${c.mode==="b"?"properties":"brands"} (${T.length}/${MAXB})</span><span class="pd-add"><input class="srch" id="pdAdd" list="${c.mode==="b"?"pdPropL":"pdBrandL"}" placeholder="Type a name, then Enter" autocomplete="off"><button type="button" class="ghost" id="pdTop">Add top ${c.mode==="b"?"matches":"Scout picks"}</button>${T.length?`<button type="button" class="ghost" id="pdClr">Clear</button>`:""}</span></label>
  </div>
  <div class="pd-tg">${T.map(s=>{const o=org(s);return `<span class="pd-chip">${o?L.mark(o.e,{px:22}):""}${esc(nm(s))}<button type="button" data-pdrm="${esc(s)}" aria-label="Remove">×</button></span>`}).join("")||`<span class="note-s">No ${c.mode==="b"?"properties":"brands"} yet. Add them one by one, or take the top Scout picks.</span>`}</div>
  <datalist id="pdBrandL">${brandOpts}</datalist><datalist id="pdPropL">${propOpts}</datalist></div>`;
}
function bindCtx(redraw){
  const c=ctxGet();
  const find=(v,pool)=>{v=v.trim().toLowerCase();if(!v)return null;return pool.find(x=>x.e.name.toLowerCase()===v)||pool.find(x=>(x.e.aliases||[]).some(a=>a.toLowerCase()===v))||pool.find(x=>x.e.name.toLowerCase().includes(v))};
  $("pdMain").onchange=e=>{const hit=find(e.target.value,c.mode==="b"?D.brands:D.props);if(hit){if(c.mode==="b")c.brand=hit.e.slug;else c.prop=hit.e.slug;ctxSet(c);redraw()}};
  $("pdAdd").onkeydown=e=>{if(e.key!=="Enter")return;e.preventDefault();addT(e.target.value)};
  $("pdAdd").onchange=e=>{if(e.target.value)addT(e.target.value)};
  const addT=v=>{const hit=find(v,c.mode==="b"?D.props:D.brands);const list=c.mode==="b"?c.props:c.brands;
    if(hit&&!list.includes(hit.e.slug)&&list.length<MAXB){list.push(hit.e.slug);ctxSet(c);redraw()}};
  $("pdTop").onclick=()=>{
    const list=c.mode==="b"?c.props:c.brands;const main=c.mode==="b"?c.brand:c.prop;if(!main){alert(`Pick ${c.mode==="b"?"a brand":"your property"} first.`);return}
    const rec=c.mode==="b"?MX.brands[main]:MX.props[main];const rows=(rec&&rec.m)||[];
    rows.slice(0,10).forEach(r=>{const s=c.mode==="b"?r.p:r.b;if(s&&org(s)&&!list.includes(s)&&list.length<MAXB)list.push(s)});ctxSet(c);redraw()};
  if($("pdClr"))$("pdClr").onclick=()=>{if(c.mode==="b")c.props=[];else c.brands=[];ctxSet(c);redraw()};
  host.querySelectorAll("[data-pdmode]").forEach(b=>b.onclick=()=>{c.mode=b.dataset.pdmode;ctxSet(c);redraw()});
  host.querySelectorAll("[data-pdrm]").forEach(b=>b.onclick=()=>{const k=c.mode==="b"?"props":"brands";c[k]=c[k].filter(x=>x!==b.dataset.pdrm);ctxSet(c);redraw()});
}
const firstPair=()=>pairs()[0]||{p:"",b:""};
function pcForPair(pr){return pcOf(pr.p,pr.b)}

function shell(){
  host.innerHTML=`<p class="pro-intro">Pitch decks for every brand you're going after: mockups on real inventory, short videos, and a deck personalised from the database, out as PowerPoint, PDF or a secure link you can track.</p>
  <div class="ctl pd-subs"><div class="pills tabs-keep">${pillRow("pdsub",SUBS,st.sub)}</div></div>
  <div id="pdCtx"></div><div id="pdBody"></div>${roadmap()}`;
  host.querySelectorAll("[data-pdsub]").forEach(b=>b.onclick=()=>{st.sub=b.dataset.pdsub;shell()});
  const redraw=()=>{$("pdCtx").innerHTML=ctxBar();bindCtx(redraw);({design,studio,video,decks,shared}[st.sub])()};
  redraw();
}
function roadmap(){
  return `<div class="pd-road"><div class="h3">On the way</div><div class="pd-rg">
  <div><b>Sizzle reel</b><span>Drop in images and get a cut with music and voiceover.</span></div>
  <div><b>Showcase</b><span>An interactive 3D portfolio of your inventory, so a brand can look around before there's a deck.</span></div>
  <div><b>AI scene edits</b><span>Remove existing branding automatically and merge products into photos (a driver holding the can).</span></div>
  <div><b>Market insight</b><span>Brands in market right now, with the people to talk to.</span></div>
  <div><b>Outbound</b><span>Find the brands that fit, sequence the outreach and attach each one's deck.</span></div>
  </div></div>`;
}

/* ---- Design ---- */
function tplCard(t,sel){
  return `<div class="pd-tc${sel?" on":""}" data-tpl="${esc(t.id)}"><canvas data-thumb="${esc(t.id)}" width="384" height="${Math.round(384*(t.h||H)/(t.w||W))}"></canvas>
  <div class="pd-tm"><label><input type="checkbox" data-tsel="${esc(t.id)}"${sel?" checked":""}> <b>${esc(t.name)}</b></label><span>${esc(t.group||"Your photos")}</span>
  ${t.builtin?"":`<span class="pd-ta"><button type="button" class="ghost sm" data-tedit="${esc(t.id)}">Edit</button><button type="button" class="ghost sm" data-tdel="${esc(t.id)}">Delete</button></span>`}</div></div>`;
}
async function thumbs(scope){
  const pr=firstPair(),pc=pr.p||pr.b?pcForPair(pr):{pe:null,be:null,T:{}};
  for(const cv of (scope||host).querySelectorAll("canvas[data-thumb]")){
    const t=lib.byId(cv.dataset.thumb);if(!t)continue;
    const r=await renderTpl(t,pc,{edit:!pc.be});const g=cv.getContext("2d");g.drawImage(r.c,0,0,cv.width,cv.height);
  }
}
function design(){
  if(st.edit)return editor("design");
  const sel=new Set(cfg.get("tsel",["jersey","led"]));const all=lib.all();const T=pairs().filter(p=>p.b);
  $("pdBody").innerHTML=`<div class="h3">Placement library</div>
  <p class="note-s">Your inventory. Tick the placements to mock up. Add your own from a photo of a jersey, a car, a sign or a venue: cover the old branding, mark where the logo goes, and it joins the library.</p>
  <div class="pd-lib">${all.map(t=>tplCard(t,sel.has(t.id))).join("")}<button type="button" class="pd-tc pd-new" id="pdNew"><b>+ New from a photo</b><span>Upload, cover the old logo, drop in a logo zone</span></button></div>
  <div class="pd-go"><button class="btn" id="pdGen"${T.length&&sel.size?"":" disabled"}>Make ${T.length*[...sel].filter(id=>lib.byId(id)).length||""} mockup${T.length*sel.size===1?"":"s"}</button>
  <span class="note-s">${T.length?`${T.length} ${ctxGet().mode==="b"?"propert"+(T.length===1?"y":"ies"):"brand"+(T.length===1?"":"s")} x ${sel.size} placement${sel.size===1?"":"s"}. Each logo picks colour, white or black for what's behind it.`:"Pick who you're pitching to above."}</span></div>
  <div id="pdRes">${st.results.length?resultsHtml():""}</div>
  <div class="h3">Logo variants</div>
  <p class="note-s">Logos come from the database (local file or Brandfetch), with a white and a black version made from each. Upload the official versions to use those instead.</p>
  <div id="pdLv" class="pd-lv"></div>`;
  thumbs($("pdBody"));
  $("pdBody").onchange=e=>{const t=e.target.closest("[data-tsel]");if(t){t.checked?sel.add(t.dataset.tsel):sel.delete(t.dataset.tsel);cfg.set("tsel",[...sel]);design()}};
  $("pdBody").onclick=async e=>{
    if(e.target.id==="pdNew"||e.target.closest("#pdNew")){st.edit={id:"c_"+uid(),name:"My placement",group:"Your photos",w:W,h:H,layers:[],isNew:true};return design()}
    const ed=e.target.closest("[data-tedit]");if(ed){st.edit=JSON.parse(JSON.stringify(lib.byId(ed.dataset.tedit)));return st.sub==="studio"?studio():design()}
    const dl=e.target.closest("[data-tdel]");if(dl){if(!confirm("Delete this template?"))return;lib.save(lib.own().filter(t=>t.id!==dl.dataset.tdel));sel.delete(dl.dataset.tdel);cfg.set("tsel",[...sel]);return design()}
    if(e.target.id==="pdGen")return generate([...sel]);
    const v=e.target.closest("[data-rdl]");if(v){const r=st.results[+v.dataset.rdl];r.c.toBlob(b=>download(b,`${fileSafe(r.name)}.png`),"image/png");return}
    if(e.target.id==="pdZip"){const Z=await zipLib();const z=new Z();for(const r of st.results){const b=await new Promise(res=>r.c.toBlob(res,"image/png"));z.file(`${fileSafe(r.name)}.png`,b)}download(await z.generateAsync({type:"blob"}),"mockups.zip");return}
    if(e.target.id==="pdSheet"){const n=st.results.length,cols=Math.min(5,n),rows=Math.ceil(n/cols),cw=480,ch=270;const c=canv(cols*cw,rows*(ch+40));const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);
      st.results.forEach((r,i)=>{const x=(i%cols)*cw,y=Math.floor(i/cols)*(ch+40);const f=fitRect(r.c.width,r.c.height,{x:x+6,y:y+6,w:cw-12,h:ch-12},"contain");g.drawImage(r.c,f.x,f.y,f.w,f.h);drawText(g,{x:x+8,y:y+ch,w:cw-16,h:32,text:r.name,size:20,weight:800,upper:true})});
      c.toBlob(b=>download(b,"mockups-contact-sheet.png"),"image/png");return}
  };
  $("pdBody").addEventListener("change",async e=>{const s=e.target.closest("[data-rvar]");if(!s)return;const i=+s.dataset.rvar,r=st.results[i];
    const out=await renderTpl(lib.byId(r.tpl),pcForPair(r.pair),{variant:s.value});r.c=out.c;r.picks=out.picks;const cv=host.querySelector(`[data-rc="${i}"]`);if(cv){cv.getContext("2d").clearRect(0,0,cv.width,cv.height);cv.getContext("2d").drawImage(r.c,0,0,cv.width,cv.height)}
    const lab=host.querySelector(`[data-rlab="${i}"]`);if(lab)lab.textContent=r.picks[0]?pickLabel(r.picks[0].v,r.picks[0].bg):""});
  variantsPanel();
}
function resultsHtml(){
  return `<div class="res"><span class="lbl mute-l">${st.results.length} mockups</span><span class="toolrow"><button class="ghost" id="pdSheet">Contact sheet</button><button class="ghost" id="pdZip">Download all</button></span></div>
  <div class="pd-rs">${st.results.map((r,i)=>`<div class="pd-r"><canvas data-rc="${i}" width="480" height="${Math.round(480*r.c.height/r.c.width)}"></canvas>
  <div class="pd-rm"><b>${esc(r.name)}</b><span data-rlab="${i}">${r.picks[0]?esc(pickLabel(r.picks[0].v,r.picks[0].bg)):""}</span>
  <span class="pd-ra"><select class="sel sm" data-rvar="${i}">${VARS.map(([v,l])=>`<option value="${v}"${(r.want||"auto")===v?" selected":""}>${l}</option>`).join("")}</select><button type="button" class="ghost sm" data-rdl="${i}">PNG</button></span></div></div>`).join("")}</div>`;
}
function paintResults(){st.results.forEach((r,i)=>{const cv=host.querySelector(`[data-rc="${i}"]`);if(cv)cv.getContext("2d").drawImage(r.c,0,0,cv.width,cv.height)})}
async function generate(ids){
  const P=pairs().filter(p=>p.b),T=ids.map(id=>lib.byId(id)).filter(Boolean);st.results=[];
  const box=$("pdRes");box.innerHTML=`<p class="note">Rendering 0 of ${P.length*T.length}…</p>`;
  let n=0;
  for(const pr of P){const pc=pcForPair(pr);for(const t of T){const r=await renderTpl(t,pc);
    st.results.push({c:r.c,picks:r.picks,tpl:t.id,pair:pr,name:`${pc.T.brand} - ${t.name}${ctxGet().mode==="b"?` - ${pc.T.property}`:""}`});n++;box.firstElementChild&&(box.firstElementChild.textContent=`Rendering ${n} of ${P.length*T.length}…`)}
    if(ctxGet().mode==="b")break}
  if(ctxGet().mode==="b"){st.results=[];const c=ctxGet();for(const p of c.props){const pc=pcOf(p,c.brand);for(const t of T){const r=await renderTpl(t,pc);st.results.push({c:r.c,picks:r.picks,tpl:t.id,pair:{p,b:c.brand},name:`${pc.T.property} - ${t.name}`})}}}
  box.innerHTML=resultsHtml();paintResults();
}
async function variantsPanel(){
  const c=ctxGet();const list=(c.mode==="b"?[c.brand]:c.brands).filter(Boolean).slice(0,MAXB);
  const el=$("pdLv");if(!el)return;
  if(!list.length){el.innerHTML=`<p class="note-s">Add brands to see their logos.</p>`;return}
  el.innerHTML=list.map(s=>`<div class="pd-lvr" data-lvs="${esc(s)}"><b>${esc(nm(s))}</b><span class="pd-lvsrc" data-lvsrc="${esc(s)}"></span>
  <div class="pd-lvv">${["colour","white","black"].map(v=>`<div class="pd-lvc ${v}"><canvas data-lvc="${esc(s)}:${v}" width="180" height="90"></canvas><span>${{colour:"Colour",white:"White, for dark",black:"Black, for light"}[v]}</span>
  <label class="ghost sm pd-up">Upload<input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" data-lvup="${esc(s)}:${v}" hidden></label></div>`).join("")}</div></div>`).join("");
  for(const s of list){const o=org(s);if(!o)continue;const lg=await logoOf(o.e);
    const src=el.querySelector(`[data-lvsrc="${CSS.escape(s)}"]`);if(src)src.textContent=lg.src+(lg.up.length?` · uploaded: ${lg.up.join(", ")}`:"");
    ["colour","white","black"].forEach(v=>{const cv=el.querySelector(`[data-lvc="${CSS.escape(s+":"+v)}"]`);if(!cv)return;const g=cv.getContext("2d");g.clearRect(0,0,180,90);const im=lg.v[v];const r=fitRect(im.width,im.height,{x:10,y:10,w:160,h:70},"contain");g.drawImage(im,r.x,r.y,r.w,r.h)})}
  el.onchange=async e=>{const u=e.target.closest("[data-lvup]");if(!u||!u.files[0])return;const [s,v]=u.dataset.lvup.split(":");
    await IDB.put(`logo:${s}:${v}`,u.files[0]);MEDIA.delete(`logo:${s}:${v}`);LOGO.delete(s);variantsPanel()};
}

/* ---- the editor (Design: your own placement; Studio: full compositions) ---- */
async function editor(mode){
  const t=st.edit;const studio=mode==="studio";
  const tools=studio?[["sel","Move"],["logo","Brand logo"],["prop","Property logo"],["cover","Cover branding"],["text","Text"]]:[["sel","Move"],["logo","Logo zone"],["prop","Property logo"],["cover","Cover existing branding"]];
  st.tool=st.tool||"sel";if(st.selL==null)st.selL=-1;
  $("pdBody").innerHTML=`<div class="pd-ed">
  <div class="pd-edbar"><input class="srch" id="edName" value="${esc(t.name)}" aria-label="Name">
  <label class="ghost pd-up">${t.base?"Change photo":"Upload photo"}<input type="file" id="edBase" accept="image/*" hidden></label>
  ${studio?`<label class="ghost pd-up">Add image<input type="file" id="edImg" accept="image/*" hidden></label>`:""}
  <button class="btn" id="edSave">Save to library</button><button class="ghost" id="edCancel">Cancel</button></div>
  <div class="pills tabs-keep pd-tools">${pillRow("edtool",tools,st.tool)}</div>
  <p class="note-s">${studio?"Layer your own images over a photo: product shots and cut-outs (tick Drop white background for shots on white), the brand's logo, the property's logo and text. Logo layers swap for every brand you pitch.":"Pick a tool, then drag on the photo. Cover existing branding fills the box with the colour around it (or pick one). Logo zone is where each brand's logo goes."} Drag the volt corner to resize.</p>
  <div class="pd-edw"><canvas id="edC" width="${t.w||W}" height="${t.h||H}"></canvas><div class="pd-layers" id="edL"></div></div></div>`;
  const cv=$("edC");let busy=false,again=false;
  const pr=firstPair(),pc=pr.p||pr.b?pcForPair(pr):{pe:null,be:null,T:{}};
  const redraw=async()=>{if(busy){again=true;return}busy=true;const r=await renderTpl(t,pc,{edit:true,sel:st.selL});cv.getContext("2d").drawImage(r.c,0,0);busy=false;if(again){again=false;redraw()}};
  const layersUI=()=>{$("edL").innerHTML=t.layers.length?t.layers.map((l,i)=>`<div class="pd-ly${i===st.selL?" on":""}" data-ly="${i}">
    <div class="pd-lyh"><b>${esc({logo:"Brand logo",prop:"Property logo",cover:"Cover",img:"Image",text:"Text"}[l.type])}</b><span>
    <button type="button" class="ghost sm" data-lyup="${i}" title="Bring forward">↑</button><button type="button" class="ghost sm" data-lydn="${i}" title="Send back">↓</button><button type="button" class="ghost sm" data-lydel="${i}">Delete</button></span></div>
    ${i===st.selL?`<div class="pd-lyc">
      ${l.type==="cover"?`<label>Fill <input type="color" data-lyk="fill" value="${esc(l.fill||"#ffffff")}"></label><button type="button" class="ghost sm" data-lysample="${i}">Sample from photo</button><label>Soften <input type="range" min="0" max="30" data-lyk="feather" value="${l.feather||0}"></label>`:""}
      ${l.type==="logo"?`<label>Variant <select class="sel sm" data-lyk="variant">${VARS.map(([v,lab])=>`<option value="${v}"${(l.variant||"auto")===v?" selected":""}>${lab}</option>`).join("")}</select></label>`:""}
      ${l.type==="text"?`<label class="pd-wide">Text <input class="srch" data-lyk="text" value="${esc(l.text||"")}" placeholder="Use {{brand}} or {{property}}"></label><label>Size <input type="range" min="20" max="300" data-lyk="size" value="${l.size||80}"></label><label>Colour <input type="color" data-lyk="color" value="${esc(l.color||"#ffffff")}"></label>`:""}
      ${l.type==="img"?`<label><input type="checkbox" data-lyk="keyWhite"${l.keyWhite?" checked":""}> Drop white background</label>`:""}
      <label>Rotate <input type="range" min="-45" max="45" data-lyk="rot" value="${l.rot||0}"></label>
      <label>Opacity <input type="range" min="10" max="100" data-lyk="op" value="${Math.round((l.op==null?1:l.op)*100)}"></label></div>`:""}</div>`).join(""):`<p class="note-s">No layers yet. ${t.base||studio?"Pick a tool and drag on the image.":"Upload a photo first."}</p>`};
  layersUI();redraw();
  const pt=e=>{const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height}};
  let drag=null;
  cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);const p=pt(e);
    const hit=[...t.layers.keys()].reverse().find(i=>{const l=t.layers[i];return p.x>=l.x-30&&p.x<=l.x+l.w+30&&p.y>=l.y-30&&p.y<=l.y+l.h+30});
    const sl=t.layers[st.selL];
    if(sl&&Math.abs(p.x-(sl.x+sl.w))<40&&Math.abs(p.y-(sl.y+sl.h))<40){drag={m:"size",l:sl,p,o:{w:sl.w,h:sl.h}};return}
    if(st.tool==="sel"){if(hit!=null){st.selL=hit;const l=t.layers[hit];drag={m:"move",l,p,o:{x:l.x,y:l.y}};layersUI();redraw()}return}
    const l={type:st.tool,x:p.x,y:p.y,w:1,h:1};
    if(st.tool==="cover")l.fill="#FFFFFF";if(st.tool==="text"){l.text="{{brand}}";l.size=90;l.color="#FFFFFF"}
    t.layers.push(l);st.selL=t.layers.length-1;drag={m:"new",l,p};layersUI()};
  cv.onpointermove=e=>{if(!drag)return;const p=pt(e),dx=p.x-drag.p.x,dy=p.y-drag.p.y;
    if(drag.m==="move"){drag.l.x=drag.o.x+dx;drag.l.y=drag.o.y+dy}
    else if(drag.m==="size"){drag.l.w=Math.max(30,drag.o.w+dx);drag.l.h=Math.max(20,drag.o.h+dy)}
    else{drag.l.x=Math.min(drag.p.x,p.x);drag.l.y=Math.min(drag.p.y,p.y);drag.l.w=Math.abs(dx);drag.l.h=Math.abs(dy)}
    redraw()};
  cv.onpointerup=async()=>{if(!drag)return;const l=drag.l;
    if(drag.m==="new"){if(l.w<30||l.h<20){const d={logo:[420,200],prop:[300,200],cover:[300,160],text:[700,140]}[l.type]||[300,200];l.w=d[0];l.h=d[1]}
      if(l.type==="cover"){const bi=await media(t.base);if(bi)l.fill=edgeColour(bi,l)}st.tool="sel";host.querySelectorAll("[data-edtool]").forEach(b=>b.classList.toggle("on",b.dataset.edtool==="sel"))}
    drag=null;layersUI();redraw()};
  host.querySelectorAll("[data-edtool]").forEach(b=>b.onclick=()=>{st.tool=b.dataset.edtool;host.querySelectorAll("[data-edtool]").forEach(x=>x.classList.toggle("on",x===b))});
  $("edL").oninput=e=>{const k=e.target.dataset.lyk;if(!k)return;const l=t.layers[st.selL];if(!l)return;
    let v=e.target.type==="checkbox"?e.target.checked:e.target.value;if(["rot","size","feather"].includes(k))v=+v;if(k==="op")v=+v/100;l[k]=v;redraw()};
  $("edL").onchange=e=>{if(e.target.dataset.lyk==="variant"||e.target.dataset.lyk==="keyWhite"){layersUI();redraw()}};
  $("edL").onclick=async e=>{
    const ly=e.target.closest("[data-ly]");const b=e.target.closest("button");
    if(b&&b.dataset.lydel!=null){t.layers.splice(+b.dataset.lydel,1);st.selL=-1;layersUI();redraw();return}
    if(b&&b.dataset.lyup!=null){const i=+b.dataset.lyup;if(i<t.layers.length-1){[t.layers[i],t.layers[i+1]]=[t.layers[i+1],t.layers[i]];st.selL=i+1}layersUI();redraw();return}
    if(b&&b.dataset.lydn!=null){const i=+b.dataset.lydn;if(i>0){[t.layers[i],t.layers[i-1]]=[t.layers[i-1],t.layers[i]];st.selL=i-1}layersUI();redraw();return}
    if(b&&b.dataset.lysample!=null){const l=t.layers[+b.dataset.lysample];const bi=await media(t.base);if(bi){l.fill=edgeColour(bi,l);layersUI();redraw()}return}
    if(ly&&!e.target.closest(".pd-lyc")&&+ly.dataset.ly!==st.selL){st.selL=+ly.dataset.ly;layersUI();redraw()}};
  $("edBase").onchange=async e=>{const f=e.target.files[0];if(!f)return;const im=await loadImg(URL.createObjectURL(f));if(!im)return alert("Couldn't read that image.");
    const s=Math.min(1,2400/Math.max(im.naturalWidth,im.naturalHeight));const c=canv(im.naturalWidth*s,im.naturalHeight*s);c.getContext("2d").drawImage(im,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.92));const key=`tpl:${t.id}:base:${uid()}`;await IDB.put(key,blob);MEDIA.delete(key);
    t.base=key;t.w=c.width;t.h=c.height;editor(mode)};
  if($("edImg"))$("edImg").onchange=async e=>{const f=e.target.files[0];if(!f)return;const key=`tpl:${t.id}:img:${uid()}`;await IDB.put(key,f);const im=await media(key);if(!im)return;
    const s=Math.min(.6*(t.w||W)/im.naturalWidth,.6*(t.h||H)/im.naturalHeight,1);t.layers.push({type:"img",key,x:((t.w||W)-im.naturalWidth*s)/2,y:((t.h||H)-im.naturalHeight*s)/2,w:im.naturalWidth*s,h:im.naturalHeight*s});st.selL=t.layers.length-1;layersUI();redraw()};
  $("edName").oninput=e=>{t.name=e.target.value};
  $("edCancel").onclick=()=>{st.edit=null;st.selL=-1;studio?window.SSSDecks._studio():design()};
  $("edSave").onclick=()=>{if(!t.base&&!studio)return alert("Upload a photo first.");if(!t.layers.some(l=>l.type==="logo"))if(!confirm("There's no brand logo layer, so every brand gets the same image. Save anyway?"))return;
    const own=lib.own().filter(x=>x.id!==t.id);const save=Object.assign({},t);delete save.isNew;save.group=studio?"Studio":"Your photos";if(studio&&!save.base&&!save.w){save.w=W;save.h=H}
    own.push(save);lib.save(own);const sel=new Set(cfg.get("tsel",[]));sel.add(t.id);cfg.set("tsel",[...sel]);st.edit=null;st.selL=-1;st.tool="sel";studio?window.SSSDecks._studio():design()};
  window.addEventListener("keydown",function kd(e){if(!document.body.contains(cv)){window.removeEventListener("keydown",kd);return}
    if((e.key==="Delete"||e.key==="Backspace")&&st.selL>=0&&!/input|textarea|select/i.test(document.activeElement.tagName)){t.layers.splice(st.selL,1);st.selL=-1;layersUI();redraw()}});
}

/* ---- Studio ---- */
function studio(){
  if(st.edit)return editor("studio");
  const own=lib.own().filter(t=>t.group==="Studio");
  $("pdBody").innerHTML=`<div class="h3">Studio</div>
  <p class="note-s">Go past logo placement: build the activation. Start from a venue, fan zone or athlete photo, then layer in product shots, the brand's logo, the property's logo and a line of copy. Every logo layer swaps per brand, and each composition joins the placement library for mockups, video and decks.</p>
  <div class="pd-lib">${own.map(t=>tplCard(t,false)).join("")}<button type="button" class="pd-tc pd-new" id="stNew"><b>+ New composition</b><span>Upload a photo to start</span></button></div>`;
  thumbs($("pdBody"));
  $("pdBody").onclick=e=>{
    if(e.target.closest("#stNew")){st.edit={id:"s_"+uid(),name:"Activation",group:"Studio",w:W,h:H,layers:[],isNew:true};st.tool="sel";return studio()}
    const ed=e.target.closest("[data-tedit]");if(ed){st.edit=JSON.parse(JSON.stringify(lib.byId(ed.dataset.tedit)));return studio()}
    const dl=e.target.closest("[data-tdel]");if(dl){if(!confirm("Delete this composition?"))return;lib.save(lib.own().filter(t=>t.id!==dl.dataset.tdel));return studio()}
  };
  $("pdBody").onchange=null;
}

/* ---- Video ---- */
let VSRC=null; /* the uploaded clip for LED or footage */
function video(){
  const v=st.v||(st.v={kind:"clip",tpl:"screen",motion:"reveal",secs:10,end:true,mode:"motion",size:"strip",pos:"br",scale:.18,op:1,who:"first"});
  const all=lib.all(),T=pairs().filter(p=>p.b);
  const kinds=[["clip","Clip from a design"],["led","LED animation"],["foot","Brand into footage"]];
  $("pdBody").innerHTML=`<div class="ctl"><div class="pills tabs-keep">${pillRow("vk",kinds,v.kind)}</div></div>
  <div class="pd-vf">
  ${v.kind==="clip"?`<label class="pd-f"><span class="lbl mute-l">Design</span><select class="sel" data-vo="tpl">${all.map(t=>`<option value="${esc(t.id)}"${t.id===v.tpl?" selected":""}>${esc(t.name)}</option>`).join("")}</select></label>
    <label class="pd-f"><span class="lbl mute-l">Motion</span><select class="sel" data-vo="motion">${[["reveal","Logo reveal"],["push","Push in"],["pan","Pan across"]].map(([k,l])=>`<option value="${k}"${k===v.motion?" selected":""}>${l}</option>`).join("")}</select></label>
    <label class="pd-f pd-cb"><input type="checkbox" data-vo="end"${v.end?" checked":""}> End card with both logos</label>`:""}
  ${v.kind==="led"?`<label class="pd-f"><span class="lbl mute-l">Animation</span><select class="sel" data-vo="mode">${[["motion","Motion preset"],["fade","Crossfade with the property"],["video","Your own clip"]].map(([k,l])=>`<option value="${k}"${k===v.mode?" selected":""}>${l}</option>`).join("")}</select></label>
    <label class="pd-f"><span class="lbl mute-l">Output</span><select class="sel" data-vo="size">${[["strip","LED file, 1920 x 192"],["scene","In the stadium, 1920 x 1080"]].map(([k,l])=>`<option value="${k}"${k===v.size?" selected":""}>${l}</option>`).join("")}</select></label>`:""}
  ${v.kind==="foot"?`<label class="pd-f"><span class="lbl mute-l">Placement</span><select class="sel" data-vo="pos">${[["br","Bug, bottom right"],["tr","Bug, top right"],["tl","Bug, top left"],["lower","Lower third: Presented by"],["slate","End slate"]].map(([k,l])=>`<option value="${k}"${k===v.pos?" selected":""}>${l}</option>`).join("")}</select></label>
    <label class="pd-f"><span class="lbl mute-l">Logo size</span><input type="range" min="8" max="35" data-vo="scale" value="${Math.round(v.scale*100)}"></label>`:""}
  ${v.kind!=="clip"&&(v.kind==="foot"||v.mode==="video")?`<label class="pd-f"><span class="lbl mute-l">Clip</span><label class="ghost pd-up">${VSRC?"Change clip":"Upload a clip"}<input type="file" id="vUp" accept="video/*" hidden></label>${VSRC?`<span class="note-s">${esc(VSRC.name)} · ${Math.round(VSRC.el.duration||0)}s</span>`:""}</label>`:""}
  ${v.kind!=="foot"?`<label class="pd-f"><span class="lbl mute-l">Length</span><div class="pills tabs-keep">${pillRow("vsecs",[["5","5s"],["10","10s"],["15","15s"]],String(v.secs))}</div></label>`:""}
  <label class="pd-f"><span class="lbl mute-l">For</span><div class="pills tabs-keep">${pillRow("vwho",[["first",T[0]?(ctxGet().mode==="b"?nm(T[0].p||"")||"First":nm(T[0].b)):"First"],["all",`All ${T.length}`]],v.who)}</div></label>
  </div>
  <div class="pd-go"><button class="btn" id="vGo"${T.length?"":" disabled"}>Make video${v.who==="all"&&T.length>1?"s":""}</button><span class="note-s" id="vMsg">${T.length?`Records in real time${v.who==="all"&&T.length>1?`, one after another (about ${Math.ceil(T.length*(v.kind==="foot"&&VSRC?Math.min(60,VSRC.el.duration||10):v.secs)/60)} min)`:""}. Keep this tab open and in front while it runs.`:"Pick who you're pitching to above."}</span></div>
  <div class="pd-vr">${st.vres.map((r,i)=>`<div class="pd-r"><video src="${r.url}" controls playsinline muted loop></video><div class="pd-rm"><b>${esc(r.name)}</b><span class="pd-ra"><button type="button" class="ghost sm" data-vdl="${i}">Download ${r.ext.toUpperCase()}</button></span></div></div>`).join("")}</div>`;
  const B=$("pdBody");
  B.onclick=async e=>{
    const k=e.target.closest("[data-vk]");if(k){v.kind=k.dataset.vk;return video()}
    const s=e.target.closest("[data-vsecs]");if(s){v.secs=+s.dataset.vsecs;return video()}
    const w=e.target.closest("[data-vwho]");if(w){v.who=w.dataset.vwho;return video()}
    const d=e.target.closest("[data-vdl]");if(d){const r=st.vres[+d.dataset.vdl];download(r.blob,`${fileSafe(r.name)}.${r.ext}`);return}
    if(e.target.id==="vGo"){if(st.busy)return;
      if((v.kind==="foot"||(v.kind==="led"&&v.mode==="video"))&&!VSRC)return alert("Upload a clip first.");
      st.busy=true;e.target.disabled=true;const list=v.who==="all"?T:T.slice(0,1);
      try{for(let i=0;i<list.length;i++){$("vMsg").textContent=`Recording ${i+1} of ${list.length}…`;const pc=pcForPair(list[i]);let blob;
          if(v.kind==="clip")blob=await clipFromDesign(lib.byId(v.tpl)||lib.byId("screen"),pc,v);
          else if(v.kind==="led")blob=await ledClip(pc,Object.assign({},v,{video:VSRC&&VSRC.el}));
          else blob=await footageClip(pc,Object.assign({},v,{video:VSRC.el}));
          const ext=extOf(blob.type);st.vres.unshift({blob,url:URL.createObjectURL(blob),ext,name:`${ctxGet().mode==="b"?pc.T.property:pc.T.brand} - ${{clip:(lib.byId(v.tpl)||{}).name||"Clip",led:"LED",foot:"Footage"}[v.kind]}`})}
      }catch(err){console.error(err);alert(err.message||"Couldn't record that video.")}
      st.busy=false;video()}
  };
  B.onchange=async e=>{const o=e.target.closest("[data-vo]");if(o){const k=o.dataset.vo;v[k]=o.type==="checkbox"?o.checked:k==="scale"?+o.value/100:o.value;if(k!=="scale")video();return}
    if(e.target.id==="vUp"){const f=e.target.files[0];if(!f)return;const el=document.createElement("video");el.src=URL.createObjectURL(f);el.playsInline=true;el.preload="auto";el.crossOrigin="anonymous";
      await new Promise(r=>{el.onloadedmetadata=r;el.onerror=r});VSRC={name:f.name,el};video()}};
}

/* ---- Decks ---- */
let saveT=null;
function decks(){
  const ms=master.get(),me=cfg.get("me",{}),P=pairs(),cur=st.dk||(st.dk={i:0});
  const byS=sec=>ms.slides.filter(s=>s.sec===sec);
  const tplOpts=v=>lib.all().map(t=>`<option value="${esc(t.id)}"${t.id===v?" selected":""}>${esc(t.name)}</option>`).join("");
  const edits=new Set(["about","package","next","text","reco"]);
  const row=s=>{const i=ms.slides.indexOf(s);return `<div class="pd-sl${s.on?"":" off"}" data-sl="${i}">
    <div class="pd-slh"><label><input type="checkbox" data-sk="on"${s.on?" checked":""}> <b>${esc(KINDS[s.kind])}</b>${REPEAT.has(s.kind)&&ctxGet().mode==="b"?` <span class="chip">Each property</span>`:""}${s.kind==="shortlist"&&ctxGet().mode!=="b"?` <span class="chip ex">Agency decks only</span>`:""}</label>
    <span><select class="sel sm" data-sk="sec">${SECS.map(([k,l])=>`<option value="${k}"${k===s.sec?" selected":""}>${l}</option>`).join("")}</select>
    <button type="button" class="ghost sm" data-smv="-1">↑</button><button type="button" class="ghost sm" data-smv="1">↓</button><button type="button" class="ghost sm" data-sdel="1">Delete</button></span></div>
    ${s.kind!=="upload"?`<label class="pd-wide"><span class="lbl mute-l">Title</span><input class="srch" data-sk="title" value="${esc(s.title||"")}"></label>`:""}
    ${edits.has(s.kind)?`<label class="pd-wide"><span class="lbl mute-l">${s.kind==="package"?"What's in it, one per line":"Text"}</span><textarea class="pd-ta" rows="${s.kind==="package"?5:3}" data-sk="body">${esc(s.body||"")}</textarea></label>`:""}
    ${s.kind==="package"?`<label class="pd-wide"><span class="lbl mute-l">Investment</span><input class="srch" data-sk="value" value="${esc(s.value||"")}"></label>`:""}
    ${s.kind==="inventory"||s.kind==="video"?`<label class="pd-wide"><span class="lbl mute-l">${s.kind==="video"?"Video from design":"Design"}</span><select class="sel" data-sk="tpl">${tplOpts(s.tpl)}</select></label>${s.kind==="video"?`<label class="pd-wide"><span class="lbl mute-l">Motion</span><select class="sel" data-sk="motion">${[["reveal","Logo reveal"],["push","Push in"],["pan","Pan across"]].map(([k,l])=>`<option value="${k}"${k===(s.motion||"reveal")?" selected":""}>${l}</option>`).join("")}</select></label>`:""}`:""}
    ${s.kind==="upload"?`<div class="pd-upr"><canvas data-upth="${esc(s.key)}" width="192" height="108"></canvas><label class="pd-wide"><span class="lbl mute-l">Brand logo on this slide</span><select class="sel" data-sk="overlay">${[["none","None"],["tr","Top right"],["br","Bottom right"],["c","Centre"]].map(([k,l])=>`<option value="${k}"${k===(s.overlay||"none")?" selected":""}>${l}</option>`).join("")}</select></label></div>`:""}
  </div>`};
  $("pdBody").innerHTML=`<div class="pd-dk">
  <div class="pd-dkl">
    <div class="h3 m0">${ctxGet().mode==="b"?"Agency strategy deck":"Property pitch deck"}</div>
    <p class="note-s">Set it up once. Every brand gets its own version: names, logos, Scout Score, the open slot and mockups fill in from the database. Use {{brand}}, {{property}}, {{sub}}, {{category}} or {{sport}} in any text${ctxGet().mode==="b"?", and {{top}}, {{topwhy}} or {{second}} on the recommendation":""}. Each deck type keeps its own master: switch type at the top.</p>
    <div class="toolrow"><label class="ghost pd-up">Upload master slides (PDF or images)<input type="file" id="dkUp" accept="application/pdf,image/*" multiple hidden></label>
    <select class="sel" id="dkAdd"><option value="">+ Add a slide</option>${["text","inventory","video","package","why","about","portfolio","opportunity","benchmark","landscape","renewals","shortlist","reco","next"].map(k=>`<option value="${k}">${esc(KINDS[k])}</option>`).join("")}</select>
    <select class="sel" id="dkAcc"><option value="volt"${ms.accent!=="property"?" selected":""}>Accent: Volt</option><option value="property"${ms.accent==="property"?" selected":""}>Accent: property colours</option></select>
    <button type="button" class="ghost sm" id="dkReset">Reset to standard</button></div>
    <span class="note-s" id="dkUpMsg"></span>
    ${SECS.map(([k,l])=>`<div class="pd-sec"><div class="pd-sech">${esc(l)}</div>${byS(k).map(row).join("")||`<p class="note-s">No slides in this section.</p>`}</div>`).join("")}
    <div class="pd-sec"><div class="pd-sech">Your details, on Next steps</div><div class="pd-me">
      ${[["name","Name"],["role","Role"],["org","Organisation"],["email","Email"],["phone","Phone"]].map(([k,l])=>`<label><span class="lbl mute-l">${l}</span><input class="srch" data-me="${k}" value="${esc(me[k]||"")}"></label>`).join("")}</div></div>
  </div>
  <div class="pd-dkr">
    <div class="pd-sticky">
    <div class="h3 m0">Preview</div>
    ${P.length?`<select class="sel" id="dkPair">${P.map((p,i)=>`<option value="${i}"${i===cur.i?" selected":""}>${esc(deckName(p))}</option>`).join("")}</select>`:`<p class="note-s">Pick who you're pitching to above to preview.</p>`}
    <div class="pd-thumbs" id="dkTh"></div>
    <div class="pd-ex"><button class="btn" id="dkPptx"${P.length?"":" disabled"}>PowerPoint</button><button class="ghost" id="dkPdf"${P.length?"":" disabled"}>PDF</button>
    ${P.length>1?`<button class="ghost" id="dkAllP">All ${P.length}: PowerPoint</button><button class="ghost" id="dkAllF">All ${P.length}: PDF</button>`:""}
    <button class="ghost" id="dkShare"${P.length?"":" disabled"}>Share link</button></div>
    <span class="note-s" id="dkMsg">PowerPoint keeps the text editable. Video slides go out as a still in PowerPoint and PDF, and play on share links.</span>
    </div>
  </div></div>`;
  const B=$("pdBody");
  const saveMs=(rebuild)=>{master.set(ms);clearTimeout(saveT);saveT=setTimeout(()=>preview(),500);if(rebuild)decks()};
  B.querySelectorAll("canvas[data-upth]").forEach(async cv=>{const im=await media(cv.dataset.upth);if(im)cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height)});
  B.oninput=e=>{const sl=e.target.closest("[data-sl]"),k=e.target.dataset.sk;
    if(sl&&k&&["title","body","value"].includes(k)){ms.slides[+sl.dataset.sl][k]=e.target.value;saveMs()}
    const m=e.target.dataset.me;if(m){me[m]=e.target.value;cfg.set("me",me);clearTimeout(saveT);saveT=setTimeout(()=>preview(),500)}};
  B.onchange=async e=>{const sl=e.target.closest("[data-sl]"),k=e.target.dataset.sk;
    if(sl&&k&&!["title","body","value"].includes(k)){const s=ms.slides[+sl.dataset.sl];s[k]=k==="on"?e.target.checked:e.target.value;saveMs(k==="sec"||k==="on");return}
    if(e.target.id==="dkAdd"&&e.target.value){const kind=e.target.value;const sec=kind==="package"||kind==="reco"?"pack":kind==="next"?"close":["why","about","portfolio"].includes(kind)?"fit":kind==="text"?"intro":"opp";
      ms.slides.push({id:uid(),kind,sec,on:true,title:{text:"A new slide",inventory:"What it looks like",video:"See it live",package:"The package",why:"Why {{brand}}",about:"About {{property}}",portfolio:"{{brand}} in sport",opportunity:"The open slot: {{sub}}",benchmark:"{{category}} in {{sport}}",landscape:"What {{category}} brands back",renewals:"Coming up for renewal",shortlist:"What's out there",reco:"Our recommendation",next:"Next steps"}[kind],tpl:"screen",body:kind==="text"?"":undefined});saveMs(true);return}
    if(e.target.id==="dkAcc"){ms.accent=e.target.value;saveMs();return}
    if(e.target.id==="dkPair"){cur.i=+e.target.value;preview();return}
    if(e.target.id==="dkUp"){await uploadMaster([...e.target.files],ms);saveMs(true)}};
  B.onclick=async e=>{
    const sl=e.target.closest("[data-sl]");
    if(sl&&e.target.dataset.smv){const i=+sl.dataset.sl,s=ms.slides[i];const same=ms.slides.map((x,j)=>j).filter(j=>ms.slides[j].sec===s.sec);const pos=same.indexOf(i),to=same[pos+(+e.target.dataset.smv)];
      if(to!=null){[ms.slides[i],ms.slides[to]]=[ms.slides[to],ms.slides[i]];saveMs(true)}return}
    if(sl&&e.target.dataset.sdel){ms.slides.splice(+sl.dataset.sl,1);saveMs(true);return}
    if(e.target.id==="dkReset"){if(confirm("Reset the master deck to the standard slides? Your uploaded master slides come out too.")){const m=stdMaster(ctxGet().mode);Object.assign(ms,m);saveMs(true)}return}
    const th=e.target.closest("[data-thi]");if(th){bigView(+th.dataset.thi);return}
    if(["dkPptx","dkPdf","dkAllP","dkAllF"].includes(e.target.id))return exportDecks(e.target.id);
    if(e.target.id==="dkShare"){st.sub="shared";st.shareI=cur.i;return shell()}
  };
  preview();
}
let PREV=[];
async function preview(){
  const P=pairs(),cur=st.dk||{i:0},box=$("dkTh");if(!box||!P.length)return;
  const pr=P[Math.min(cur.i,P.length-1)];box.innerHTML=`<p class="note-s">Building…</p>`;
  const tok=st.prevTok=uid();
  const slides=await buildDeck(pr);if(tok!==st.prevTok)return;
  PREV=slides.map(s=>Object.assign(s,{c:paint(s.els,W,H,s.bg)}));
  box.innerHTML=PREV.map((s,i)=>`<button type="button" class="pd-th" data-thi="${i}"><canvas width="384" height="216"></canvas><span>${String(i+1).padStart(2,"0")} ${esc(KINDS[s.s.kind])}</span></button>`).join("");
  box.querySelectorAll("canvas").forEach((cv,i)=>cv.getContext("2d").drawImage(PREV[i].c,0,0,384,216));
}
function bigView(i){
  const s=PREV[i];if(!s)return;const d=document.createElement("div");d.className="pd-modal";
  d.innerHTML=`<div class="pd-mbox"><canvas width="${W}" height="${H}"></canvas><div class="pd-mbar"><button class="ghost" data-mv="-1">← Back</button><span>${i+1} of ${PREV.length}</span><button class="ghost" data-mv="1">Next →</button><button class="ghost" data-mx="1">Close</button></div></div>`;
  d.querySelector("canvas").getContext("2d").drawImage(s.c,0,0);document.body.appendChild(d);
  const close=()=>{d.remove();removeEventListener("keydown",k)};
  const k=e=>{if(e.key==="Escape")close();if(e.key==="ArrowRight"){close();bigView(Math.min(PREV.length-1,i+1))}if(e.key==="ArrowLeft"){close();bigView(Math.max(0,i-1))}};
  addEventListener("keydown",k);
  d.onclick=e=>{if(e.target===d||e.target.dataset.mx)close();if(e.target.dataset.mv){close();bigView(Math.max(0,Math.min(PREV.length-1,i+(+e.target.dataset.mv))))}};
}
async function uploadMaster(files,ms){
  const msg=$("dkUpMsg");let n=0;
  for(const f of files){
    if(f.type==="application/pdf"||/\.pdf$/i.test(f.name)){
      msg.textContent="Reading the PDF…";
      const pdfjs=await import(new URL("assets/vendor/pdf.min.mjs",location.href).href);pdfjs.GlobalWorkerOptions.workerSrc=new URL("assets/vendor/pdf.worker.min.mjs",location.href).href;
      const doc=await pdfjs.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;
      for(let p=1;p<=Math.min(doc.numPages,60);p++){msg.textContent=`Reading page ${p} of ${doc.numPages}…`;const pg=await doc.getPage(p);const vp0=pg.getViewport({scale:1});const vp=pg.getViewport({scale:W/vp0.width});
        const c=canv(vp.width,vp.height);await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
        const key=`master:${uid()}`;await IDB.put(key,await new Promise(r=>c.toBlob(r,"image/jpeg",.9)));ms.slides.push({id:uid(),kind:"upload",sec:"intro",on:true,key,title:`${f.name.replace(/\.pdf$/i,"")} p${p}`,overlay:"none"});n++}
    }else if(/^image\//.test(f.type)){const key=`master:${uid()}`;await IDB.put(key,f);ms.slides.push({id:uid(),kind:"upload",sec:"intro",on:true,key,title:f.name,overlay:"none"});n++}
  }
  msg.textContent=n?`Added ${n} master slide${n===1?"":"s"} to Intro. Move them where you want them.`:"Nothing added. Upload a PDF or images.";
}
async function exportDecks(id){
  const P=pairs(),cur=st.dk||{i:0},msg=$("dkMsg");const list=id==="dkAllP"||id==="dkAllF"?P:[P[Math.min(cur.i,P.length-1)]];const pdf=id==="dkPdf"||id==="dkAllF";
  if(st.busy)return;st.busy=true;
  try{
    const files=[];
    for(let i=0;i<list.length;i++){const pr=list[i],name=deckName(pr);msg.textContent=`Building ${name} (${i+1} of ${list.length})…`;
      const slides=await buildDeck(pr);slides.forEach(s=>{if(!s.c)s.c=paint(s.els,W,H,s.bg)});
      const blob=pdf?pdfFrom(slides.map(s=>s.c)):await pptxFrom(slides,name);files.push({name:`${fileSafe(name)}.${pdf?"pdf":"pptx"}`,blob})}
    if(files.length===1)download(files[0].blob,files[0].name);
    else{msg.textContent="Zipping…";const Z=await zipLib();const z=new Z();files.forEach(f=>z.file(f.name,f.blob));download(await z.generateAsync({type:"blob"}),`pitch-decks-${pdf?"pdf":"pptx"}.zip`)}
    msg.textContent=`Done: ${files.length} deck${files.length===1?"":"s"}.`;
  }catch(e){console.error(e);msg.textContent=`Couldn't export: ${e.message||e}`}
  st.busy=false;
}

/* ---- Shared: secure links and analytics ---- */
const sbx=()=>window.SSSPro&&window.SSSPro.sb?window.SSSPro.sb:null;
function shared(){
  const sb=sbx(),P=pairs();
  if(!sb){$("pdBody").innerHTML=`<div class="h3">Share links</div>
    <p class="pro-intro">Secure links need the Pro database switched on. Once Supabase is connected (assets/pro-config.js) and section 6 of supabase/schema.sql has been run, you can send any deck as a link that's open, password protected, or limited to the brand's email domain, and see who opened it, for how long, slide by slide, and from where.</p>
    <p class="note-s">Until then, decks go out as PowerPoint or PDF from the Decks tab.</p>`;return}
  const i=Math.min(st.shareI||0,Math.max(0,P.length-1)),pr=P[i],b=pr?org(pr.b):null;
  $("pdBody").innerHTML=`<div class="pd-sh">
  <div class="h3 m0">New link</div>
  ${P.length?`<div class="pd-vf"><label class="pd-f"><span class="lbl mute-l">Deck</span><select class="sel" id="shPair">${P.map((p,j)=>`<option value="${j}"${j===i?" selected":""}>${esc(deckName(p))}</option>`).join("")}</select></label>
  <label class="pd-f"><span class="lbl mute-l">Who can open it</span><select class="sel" id="shProt"><option value="domain">Only emails at a domain</option><option value="password">Anyone with the password</option><option value="none">Anyone with the link</option></select></label>
  <label class="pd-f" id="shDomW"><span class="lbl mute-l">Email domains</span><input class="srch" id="shDom" value="${esc(b&&b.e.domain?b.e.domain.replace(/^www\./,""):"")}" placeholder="e.g. mdlz.com, cadbury.com.au"></label>
  <label class="pd-f" id="shPassW" hidden><span class="lbl mute-l">Password</span><input class="srch" id="shPass" autocomplete="new-password"></label>
  <label class="pd-f"><span class="lbl mute-l">Expires</span><select class="sel" id="shExp"><option value="30">In 30 days</option><option value="7">In 7 days</option><option value="90">In 90 days</option><option value="">Never</option></select></label></div>
  <div class="pd-go"><button class="btn" id="shGo">Create link</button><span class="note-s" id="shMsg">Domain links send the viewer a sign-in code, so you know exactly who opened it.</span></div>`:`<p class="note-s">Pick who you're pitching to above.</p>`}
  <div class="h3">Your links</div><div id="shList"><p class="note-s">Loading…</p></div></div>`;
  if($("shProt"))$("shProt").onchange=e=>{$("shDomW").hidden=e.target.value!=="domain";$("shPassW").hidden=e.target.value!=="password"};
  if($("shPair"))$("shPair").onchange=e=>{st.shareI=+e.target.value;shared()};
  if($("shGo"))$("shGo").onclick=()=>createLink(P[i]);
  loadLinks();
}
async function createLink(pr){
  const sb=sbx(),msg=$("shMsg"),btn=$("shGo");if(st.busy)return;
  const prot=$("shProt").value,pass=$("shPass").value,doms=$("shDom").value.split(/[\s,;]+/).map(d=>d.trim().toLowerCase().replace(/^@/,"").replace(/^www\./,"")).filter(Boolean);
  if(prot==="password"&&pass.length<6)return alert("Use a password of at least 6 characters.");
  if(prot==="domain"&&!doms.length)return alert("Add at least one email domain.");
  st.busy=true;btn.disabled=true;
  try{
    msg.textContent="Building the deck…";
    const slides=await buildDeck(pr);
    const {data:{user}}=await sb.auth.getUser();
    const id=crypto.randomUUID(),secret=uid()+uid()+uid();
    const out=[];
    for(let i=0;i<slides.length;i++){const s=slides[i];msg.textContent=`Uploading slide ${i+1} of ${slides.length}…`;
      const c=s.c||paint(s.els,W,H,s.bg);const path=`${id}/${secret}/${String(i+1).padStart(2,"0")}.jpg`;
      const {error}=await sb.storage.from("decks").upload(path,await new Promise(r=>c.toBlob(r,"image/jpeg",.88)),{contentType:"image/jpeg"});if(error)throw error;
      const item={img:path,title:s.title};
      if(s.s.kind==="video"){msg.textContent=`Recording the video on slide ${i+1}…`;const pc={pe:s.pd.p&&s.pd.p.e,be:s.pd.b&&s.pd.b.e,T:tokens(s.pd)};
        const vb=await clipFromDesign(lib.byId(s.s.tpl)||lib.byId("screen"),pc,{secs:10,motion:s.s.motion||"reveal",end:true});const vp=`${id}/${secret}/${String(i+1).padStart(2,"0")}.${extOf(vb.type)}`;
        const r=await sb.storage.from("decks").upload(vp,vb,{contentType:vb.type});if(r.error)throw r.error;item.video=vp}
      out.push(item)}
    const p=org(pr.p),b=org(pr.b),exp=$("shExp").value;
    const row={id,owner:user.id,title:deckName(pr),brand:b?b.e.name:null,property:p?p.e.name:null,slides:out,protect:prot,domains:prot==="domain"?doms:[],expires_at:exp?new Date(Date.now()+exp*864e5).toISOString():null};
    const {error}=await sb.from("pro_decks").insert(row);if(error)throw error;
    if(prot==="password"){const r=await sb.rpc("set_deck_password",{p_id:id,p_pass:pass});if(r.error)throw r.error}
    const link=`${location.origin}${location.pathname.replace(/pro(\.html)?$/,"")}deck?d=${id}`;
    msg.innerHTML=`Link ready: <a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a> <button type="button" class="ghost sm" id="shCopy">Copy</button>`;
    $("shCopy").onclick=()=>navigator.clipboard&&navigator.clipboard.writeText(link).then(()=>$("shCopy").textContent="Copied");
    loadLinks();
  }catch(e){console.error(e);msg.textContent=`Couldn't create the link: ${e.message||e}`}
  st.busy=false;btn.disabled=false;
}
async function loadLinks(){
  const sb=sbx(),box=$("shList");if(!box)return;
  const {data:dks,error}=await sb.from("pro_decks").select("id,title,brand,property,protect,domains,active,expires_at,created_at,slides").order("created_at",{ascending:false}).limit(50);
  if(error){box.innerHTML=`<p class="note-s">Couldn't load your links: ${esc(error.message)}. Has section 6 of supabase/schema.sql been run?</p>`;return}
  if(!dks.length){box.innerHTML=`<p class="note-s">No links yet.</p>`;return}
  const ids=dks.map(d=>d.id);
  const {data:views}=await sb.from("pro_deck_views").select("id,deck_id,email,session,country,tz,opened_at,last_seen").in("deck_id",ids).order("opened_at",{ascending:false}).limit(1000);
  const vids=(views||[]).map(v=>v.id);
  const {data:sl}=vids.length?await sb.from("pro_deck_slides").select("view_id,slide,ms,visits").in("view_id",vids):{data:[]};
  const base=`${location.origin}${location.pathname.replace(/pro(\.html)?$/,"")}deck?d=`;
  const fmtS=ms=>{const s=Math.round(ms/1000);return s<60?`${s}s`:`${Math.floor(s/60)}m ${s%60}s`};
  box.innerHTML=dks.map(d=>{
    const vs=(views||[]).filter(v=>v.deck_id===d.id),n=(d.slides||[]).length;
    const per=Array.from({length:n},()=>0);const byV=new Map();
    (sl||[]).forEach(r=>{const v=vs.find(x=>x.id===r.view_id);if(!v)return;if(r.slide>=1&&r.slide<=n)per[r.slide-1]+=r.ms;if(!byV.has(r.view_id))byV.set(r.view_id,{});byV.get(r.view_id)[r.slide]=r.ms});
    const who=new Set(vs.map(v=>v.email||v.session)),tot=[...byV.values()].reduce((a,o)=>a+Object.values(o).reduce((x,y)=>x+y,0),0);
    const max=Math.max(1,...per),vmax=Math.max(1,...[...byV.values()].flatMap(o=>Object.values(o)));
    const locs=new Map();vs.forEach(v=>{const k=[v.tz?v.tz.split("/").pop().replace(/_/g," "):"",v.country].filter(Boolean).join(", ")||"Unknown";locs.set(k,(locs.get(k)||0)+1)});
    const exp=d.expires_at&&new Date(d.expires_at)<new Date();
    return `<div class="pd-lk">
    <div class="pd-lkh"><div><b>${esc(d.title)}</b><span class="note-s">${esc({none:"Anyone with the link",password:"Password",domain:`Emails at ${(d.domains||[]).join(", ")}`}[d.protect])} · made ${esc(new Date(d.created_at).toLocaleDateString("en-AU",{day:"numeric",month:"short"}))}${d.expires_at?` · ${exp?"expired":"expires"} ${esc(new Date(d.expires_at).toLocaleDateString("en-AU",{day:"numeric",month:"short"}))}`:""}${d.active?"":" · switched off"}</span></div>
    <span class="toolrow"><button type="button" class="ghost sm" data-lcopy="${esc(base+d.id)}">Copy link</button><button type="button" class="ghost sm" data-ltog="${esc(d.id)}" data-on="${d.active?1:0}">${d.active?"Switch off":"Switch on"}</button></span></div>
    <div class="kpis pd-k"><div><b>${vs.length}</b><span>Views</span></div><div><b>${who.size}</b><span>Viewers</span></div><div><b>${vs.length?fmtS(tot/vs.length):"-"}</b><span>Avg time</span></div><div><b>${vs[0]?esc(new Date(vs[0].last_seen).toLocaleDateString("en-AU",{day:"numeric",month:"short"})):"-"}</b><span>Last opened</span></div></div>
    ${n?`<div class="pd-hm"><div class="pd-hmr pd-hmt"><span>Time on slide</span>${per.map((ms,j)=>`<i title="Slide ${j+1}: ${fmtS(ms)} in total" style="--v:${(ms/max).toFixed(2)}">${j+1}</i>`).join("")}</div>
    ${vs.slice(0,12).map(v=>{const o=byV.get(v.id)||{};return `<div class="pd-hmr"><span title="${esc(v.email||"")}">${esc(v.email||"Viewer "+String(v.session||"").slice(0,4))}<em>${esc(new Date(v.opened_at).toLocaleString("en-AU",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}))}</em></span>${per.map((x,j)=>`<i title="Slide ${j+1}: ${fmtS(o[j+1]||0)}" style="--v:${((o[j+1]||0)/vmax).toFixed(2)}"></i>`).join("")}</div>`}).join("")}</div>`:""}
    ${locs.size?`<p class="note-s"><b>Where:</b> ${[...locs.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${esc(k)} (${v})`).join(", ")}</p>`:""}
    </div>`}).join("");
  box.onclick=async e=>{const c=e.target.closest("[data-lcopy]");if(c){navigator.clipboard&&navigator.clipboard.writeText(c.dataset.lcopy).then(()=>c.textContent="Copied");return}
    const t=e.target.closest("[data-ltog]");if(t){await sb.from("pro_decks").update({active:t.dataset.on!=="1"}).eq("id",t.dataset.ltog);loadLinks()}};
}

/* ---------- entry point, called by pro.js for the Pitch decks tab ---------- */
function render(ctx){
  X=ctx;D=ctx.D;L=window.SSSLogos;S=window.SSSData;host=document.getElementById("view");
  host.innerHTML=`<p class="note">Loading…</p>`;
  Promise.all([ctx.mxLoad(),fonts()]).then(([mx])=>{MX=mx;shell()}).catch(err=>{console.error(err);host.innerHTML=`<p class="note">Couldn't load Pitch decks. Refresh to try again.</p>`});
}
return {render,_studio:studio,
  /* for tests */ _t:{renderTpl,buildDeck,paint,pdfFrom,pptxFrom,pick,lib,pairs,ctxSet,master,clipFromDesign,ledClip}};
})();

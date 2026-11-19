/* News page (news.html): every lead deal article and weekend feature, newest first. */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const PAGE=24;
$("yr").textContent=new Date().getFullYear();
const fmt=d=>new Date(d+"T00:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"});
const okImg=s=>/^(https:\/\/|assets\/)/.test(String(s||""));
const loc=s=>{const m=String(s||"").match(/^https:\/\/images\.unsplash\.com\/(photo-[\w-]+)/);return m?"assets/img/u/"+m[1]+".jpg":""};
const imgSrc=s=>/^https:\/\/images\.unsplash\.com\//.test(s)&&!/[?&]w=/.test(s)?s+(s.includes("?")?"&":"?")+"w=1200&q=70&auto=format&fit=crop":s;

let all=[],f="All",reg="All",shown=PAGE;
const F=[["All","All stories"],["deal","Partnerships"],["feature","Features"],["Data","Data drops"],["Breakdown","Breakdowns"]];
{const q=new URLSearchParams(location.search).get("f");if(F.some(([k])=>k===q))f=q;if(q==="ANZ"||q==="Intl")reg=q;}

Promise.all([
  fetch("deals.json",{cache:"no-cache"}).then(r=>r.json()),
  fetch("features.json",{cache:"no-cache"}).then(r=>r.ok?r.json():{features:[]}).catch(()=>({features:[]}))
]).then(([d,fj])=>{
  const leads=(d.deals||[]).filter(x=>x.slug&&x.article&&x.date).map(x=>({kind:"deal",date:x.added||x.date,head:x.headline||x.deal,sub:x.deal,
    stand:(x.article&&x.article.standfirst)||x.summary||"",label:x.sport,region:x.market||x.region,image:x.image,slug:x.slug}));
  const feats=(fj.features||[]).filter(x=>x.slug&&x.article&&x.date&&x.headline).map(x=>({kind:"feature",date:x.date,head:x.headline,sub:x.descriptor||"",
    stand:(x.article&&x.article.standfirst)||"",label:x.topic||"Feature",region:x.region,image:x.image,slug:x.slug}));
  all=[...leads,...feats].sort((a,b)=>b.date.localeCompare(a.date)||(a.kind==="feature"?-1:1));
  draw();side();
}).catch(()=>{$("grid").innerHTML=`<p class="note">Couldn't load the stories. Refresh to try again.</p>`});

const img=(x,big)=>`<div class="im${okImg(x.image)?"":" noimg"}">${okImg(x.image)?`<img src="${esc(loc(x.image)||imgSrc(x.image))}" data-alt="${esc(imgSrc(x.image))}" alt="" loading="${big?"eager":"lazy"}" decoding="async" onerror="if(this.dataset.alt&&this.src.indexOf(this.dataset.alt)<0){this.src=this.dataset.alt}else{this.parentElement.classList.add('noimg')}">`:""}</div>`;
const kindLab=x=>x.kind==="deal"?"Partnership":x.label==="Data"?"Data drop":x.label==="Breakdown"?"Breakdown":"Feature";
const meta=x=>`<div class="meta"><span class="chip ${kindLab(x)==="Partnership"||kindLab(x)==="Feature"?"up":"flat"}">${kindLab(x)}</span><span>${x.kind==="deal"?esc(x.label||"")+" · ":""}${esc(fmt(x.date))}</span></div>`;
const href=x=>`articles/${encodeURIComponent(x.slug)}`;

function draw(){
  const match=(x,k)=>k==="All"||x.kind===k||(k==="Data"||k==="Breakdown")&&x.kind==="feature"&&x.label===k||(k==="ANZ"?x.region==="ANZ":k==="Intl"&&x.region&&x.region!=="ANZ");
  const rOk=x=>reg==="All"||(reg==="ANZ"?x.region==="ANZ":x.region&&x.region!=="ANZ");
  const r=all.filter(x=>match(x,f)&&rOk(x));
  const [first,...rest]=r;
  $("lead").innerHTML=first?`<a class="nlead" href="${href(first)}">${img(first,true)}<div>${meta(first)}<h2 class="disp">${esc(first.head)}</h2>${first.stand?`<p>${esc(first.stand)}</p>`:""}<span class="more">Read the story →</span></div></a>`:`<p class="note">No stories here yet.</p>`;
  $("grid").innerHTML=rest.slice(0,shown).map(x=>`<a class="nc" href="${href(x)}">${img(x)}${meta(x)}<h3>${esc(x.head)}</h3>${x.sub&&x.sub!==x.head?`<span class="lbl mute-l" style="font-size:11px">${esc(x.sub)}</span>`:""}${x.stand?`<p>${esc(x.stand)}</p>`:""}</a>`).join("");
  $("moreBtn").hidden=rest.length<=shown;
  $("pills").innerHTML=F.filter(([k])=>all.some(x=>match(x,k))).map(([k,l])=>`<button type="button" class="${f===k?"on":""}" data-f="${k}" role="tab" aria-selected="${f===k}">${l} <span>${all.filter(x=>match(x,k)&&rOk(x)).length}</span></button>`).join("");
  document.querySelectorAll("#nReg button").forEach(b=>b.classList.toggle("on",b.dataset.r===reg));
}
$("nReg").onclick=e=>{const b=e.target.closest("[data-r]");if(!b)return;reg=b.dataset.r;shown=PAGE;draw()};
function side(){
  const last=all[0];if(last){const h=Math.round((new Date()-new Date(last.date+"T00:00:00"))/36e5);$("nStamp").innerHTML=`<i></i>Latest story ${h<24?"today":Math.round(h/24)===1?"yesterday":Math.round(h/24)+" days ago"} · ${all.length} stories`}
  const dow=new Date().getDay();
  $("nWeek").innerHTML=[[1,"Mon","Feature"],[2,"Tue","Partnerships of the day"],[3,"Wed","Data drop"],[4,"Thu","Partnerships of the day"],[5,"Fri","Breakdown"]].map(([d,k,t])=>`<div class="n3-wk"><span><b>${k}</b>${t}</span>${d===dow?'<span class="chip up">Today</span>':""}</div>`).join("");
  const wk=all.filter(x=>x.kind==="deal"&&(new Date()-new Date(x.date+"T00:00:00"))/864e5<=7);
  const m=new Map();wk.forEach(x=>{const b=String(x.sub||"").split(" × ")[0];if(b)m.set(b,(m.get(b)||0)+1)});
  const top=[...m].sort((a,b)=>b[1]-a[1]).slice(0,5);
  $("nHot").innerHTML=top.map(([b,n])=>`<div class="n3-wk"><span><b class="nb">${esc(b)}</b></span><span class="mute-l">${n} stor${n===1?"y":"ies"}</span></div>`).join("");
  $("nHotC").hidden=!top.length;
}
$("pills").onclick=e=>{const b=e.target.closest("[data-f]");if(!b)return;f=b.dataset.f;shown=PAGE;draw()};
$("moreBtn").onclick=()=>{shown+=PAGE;draw()};
})();

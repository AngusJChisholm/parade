/* Search results (search.html?q=): brands, properties, partnerships and news for one query. */
(function(){
const $=id=>document.getElementById(id);
const L=window.ParadeLogos,S=window.ParadeData,esc=S.esc;
if($("yr"))$("yr").textContent=new Date().getFullYear();
const qs=S.qs();
const st={q:(qs.get("q")||"").trim(),tab:qs.get("t")||"all",m:"All",sport:"All",type:"",days:""};
$("sQ").value=st.q;
$("sF").onsubmit=e=>{e.preventDefault();st.q=$("sQ").value.trim();run()};
let D=null,F=[];
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
const fmtD=s=>s?new Date(s+"T00:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"2-digit"}):"";
const chipOf=d=>{let t=d.ended||d.status==="Ended"?"Ended":/naming/i.test((d.type||"")+" "+(d.tier||""))?"Naming":d.status||"";if(/^current/i.test(t))t="Current";const k=t==="New"||t==="Naming"?"up":t==="Ended"?"down":"flat";return t?`<span class="chip ${k}">${esc(t)}</span>`:""};

Promise.all([S.load(),fetch("features.json").then(r=>r.ok?r.json():{features:[]}).catch(()=>({features:[]}))]).then(([d,fj])=>{D=d;F=(fj.features||[]).filter(x=>x.slug&&x.article&&x.headline);run()})
  .catch(e=>{console.error(e);$("sRes").innerHTML=`<p class="note">Search didn't load. Refresh to try again.</p>`});

function run(){
  if(!D)return;
  S.setQs({q:st.q,t:st.tab!=="all"&&st.tab});
  $("sH").textContent=st.q?`Results for “${st.q}”.`:"Search.";
  document.title=st.q?`${st.q} | Search | Parade`:"Search | Parade";
  const v=norm(st.q);
  if(v.length<2){$("sTabs").innerHTML="";$("sCount").textContent="";$("sRef").hidden=true;
    $("sRes").innerHTML=`<p class="i3-sub">Type a brand, club, league, event or sport. Try <a class="more" href="search?q=afl">AFL</a> <a class="more" href="search?q=nike">Nike</a> <a class="more" href="search?q=naming">naming rights</a>.</p>`;return}
  $("sRef").hidden=false;
  const now=new Date();
  const dOk=d=>(st.m==="All"||S.mkt(d)===st.m)&&(st.sport==="All"||d.sport===st.sport)&&
    (!st.type||(st.type==="ended"?(d.ended||d.status==="Ended"):st.type==="naming"?/naming/i.test((d.type||"")+" "+(d.tier||"")):d.status===st.type))&&
    (!st.days||(d.date&&(now-new Date(d.date+"T00:00:00"))/864e5<=+st.days));
  const score=r=>{const n=norm(r.e.name);return n===v?0:n.startsWith(v)?1:(r.e.aliases||[]).some(a=>norm(a)===v)?0.5:2};
  const hay=r=>norm([r.e.name,...(r.e.aliases||[]),r.cat||"",r.ptype||"",...r.sports.keys()].join(" "));
  const eOk=r=>(st.m==="All"||r.markets.has(st.m))&&(st.sport==="All"||r.sports.has(st.sport));
  const brands=D.brands.filter(r=>hay(r).includes(v)&&eOk(r)).sort((a,b)=>score(a)-score(b)||b.n-a.n);
  const props=D.props.filter(r=>hay(r).includes(v)&&eOk(r)).sort((a,b)=>score(a)-score(b)||b.cur-a.cur||b.n-a.n);
  const deals=D.deals.filter(d=>norm([d.deal,d.sport,d.type,d.tier,d.summary||""].join(" ")).includes(v)&&dOk(d)).sort((a,b)=>S.sortKey(b).localeCompare(S.sortKey(a)));
  const news=[...D.deals.filter(d=>d.slug&&d.article&&d.date&&norm((d.headline||"")+" "+d.deal).includes(v)&&dOk(d)).map(d=>({k:"Partnership",date:d.added||d.date,h:d.headline||d.deal,slug:d.slug,img:d.image})),
    ...F.filter(f=>norm(f.headline+" "+(f.descriptor||"")+" "+(f.sport||"")).includes(v)).map(f=>({k:f.label||"Feature",date:f.date,h:f.headline,slug:f.slug,img:f.image}))].sort((a,b)=>b.date.localeCompare(a.date));
  const top=[...brands.slice(0,1),...props.slice(0,1)].sort((a,b)=>score(a)-score(b)||b.n-a.n)[0];
  const T=[["all","All",brands.length+props.length+deals.length+news.length],["brands","Brands",brands.length],["props","Properties",props.length],["deals","Partnerships",deals.length],["news","News",news.length]];
  $("sTabs").innerHTML=T.map(([k,l,n])=>`<button type="button" data-t="${k}" class="${st.tab===k?"on":""}">${l} <span>${n.toLocaleString("en-AU")}</span></button>`).join("");
  $("sCount").textContent=`${T[0][2].toLocaleString("en-AU")} results across ${D.deals.length.toLocaleString("en-AU")} partnerships`;
  const all=st.tab==="all",lim=n=>all?n:400;
  const ent=(r,isB)=>`<a class="s3-row" href="${esc(L.page(r.e.slug))}">${L.mark(r.e,{px:36})}<span class="nm"><b>${esc(r.e.name)}</b><span>${esc([isB?"Brand":r.ptype||"Property",isB?r.cat:[...r.sports.keys()][0],[...r.markets][0]].filter(Boolean).join(" · "))}</span></span><span class="n">${isB?`${r.n} partnership${r.n===1?"":"s"}`:`${r.cur} current partner${r.cur===1?"":"s"}`}</span></a>`;
  const grp=(k,title,n,body,link)=>(all||st.tab===k)&&n?`<section class="s3-g"><div class="s3-gh"><h2>${title} <span>${n.toLocaleString("en-AU")}</span></h2>${all&&link?`<button type="button" class="more" data-t="${k}">All ${title.toLowerCase()} →</button>`:""}</div><div class="ps-c s3-list">${body}</div></section>`:"";
  let html="";
  if(all&&top){const isB=top.kind==="brand";html+=`<a class="s3-top" href="${esc(L.page(top.e.slug))}">${L.mark(top.e,{px:64})}<span class="nm"><span class="lbl mute-l">Top result · ${isB?"Brand":"Property"} · ${esc(isB?top.cat||"":top.ptype||"")}</span><b>${esc(top.e.name)}.</b></span><span class="st">${isB?`<span><b>${top.n}</b>Partnerships</span>`:`<span><b>${top.cur}</b>Current partners</span>`}<span><b>${top.sports.size}</b>Sports</span><span class="go">Open ${isB?"brand":"property"} page →</span></span></a>`}
  html+=grp("brands","Brands",brands.length,brands.slice(0,lim(5)).map(r=>ent(r,true)).join(""),1);
  html+=grp("props","Properties",props.length,props.slice(0,lim(5)).map(r=>ent(r,false)).join(""),1);
  html+=grp("deals","Partnerships",deals.length,deals.slice(0,lim(8)).map(d=>`<div class="s3-row d">${chipOf(d)}<span class="dl">${L.pair(d,{px:26})}<span>${S.dealLink(d)}</span></span><span class="n">${esc(S.fmt(d))}</span></div>`).join(""),1);
  html+=(all||st.tab==="news")&&news.length?`<section class="s3-g"><div class="s3-gh"><h2>News <span>${news.length}</span></h2>${all?`<button type="button" class="more" data-t="news">All news →</button>`:""}</div><div class="s3-news">${news.slice(0,lim(3)).map(x=>`<a href="articles/${encodeURIComponent(x.slug)}"><span class="im"${x.img&&/^https:/.test(x.img)?` style="background-image:url('${esc(x.img.split("?")[0])}?w=400&q=60&auto=format&fit=crop')"`:""}></span><span class="tx"><span class="lbl mute-l">${esc(x.k)} · ${esc(fmtD(x.date))}</span><b>${esc(x.h)}</b></span></a>`).join("")}</div></section>`:"";
  $("sRes").innerHTML=html||`<div class="ps-c"><b>Nothing on file for “${esc(st.q)}”.</b><p class="i3-sub">Try a shorter name, a league or a sport, or clear the filters on the right.</p></div>`;
  // Refine panel
  const sports=["All",...[...new Set(deals.map(d=>d.sport).filter(Boolean))].sort((a,b)=>deals.filter(d=>d.sport===b).length-deals.filter(d=>d.sport===a).length).slice(0,6)];
  if(st.sport!=="All"&&!sports.includes(st.sport))sports.push(st.sport);
  const grpB=(lab,key,opts)=>`<div class="s3-rg"><div class="ps-k">${lab}</div><div class="s3-pills">${opts.map(([v,l])=>`<button type="button" data-k="${key}" data-v="${esc(v)}" class="${String(st[key])===String(v)?"on":""}">${esc(l)}</button>`).join("")}</div></div>`;
  $("sRef").innerHTML=`<div class="ps-h">Refine</div>`+grpB("Region","m",[["All","All"],["ANZ","ANZ"],["UK & Ireland","UK & Ireland"],["North America","North America"],["Europe","Europe"]])
    +grpB("Sport","sport",sports.map(s=>[s,s]))+grpB("Type","type",[["","All"],["New","New"],["Renewal","Renewal"],["naming","Naming rights"],["ended","Ended"]])
    +grpB("Date","days",[["","Any time"],["30","30 days"],["365","12 months"]]);
}
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-t]");if(t&&t.closest(".s3")){st.tab=t.dataset.t;run();window.scrollTo({top:0,behavior:"smooth"});return}
  const r=e.target.closest("[data-k]");if(r&&r.closest("#sRef")){st[r.dataset.k]=r.dataset.v;run()}
});
})();

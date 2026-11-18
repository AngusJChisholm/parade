/* Categories (categories.html): every brand category, and one category in detail with ?c=<name>. */
(function(){
const $=id=>document.getElementById(id);
const L=window.SSSLogos, S=window.SSSData, esc=S.esc;
const yr=new Date().getFullYear();
$("yr").textContent=yr;
const plural=(n,a,b)=>`${n.toLocaleString("en-AU")} ${n===1?a:b}`;

S.load().then(D=>{
  const q=S.qs(); const c=q.get("c");
  const byCat=new Map(S.CATS.map(k=>[k,{brands:[],deals:new Set()}]));
  D.brands.forEach(b=>{const g=byCat.get(b.cat)||byCat.get("Other");g.brands.push(b);b.deals.forEach(x=>{if(x.side==="b")g.deals.add(x.d)})});
  if(!c||!byCat.has(c))return index(byCat);
  detail(c,byCat.get(c),q);
}).catch(()=>{$("view").innerHTML=`<p class="wrap note">Couldn't load categories. Refresh to try again.</p>`});

function index(byCat){
  document.title="Categories | Sport Sport Sport";
  const now=new Date(),doy=(now-new Date(yr,0,1))/864e5;
  const st={m:"All",sort:"deals"};
  const inM=d=>st.m==="All"||S.mkt(d)===st.m;
  const atPoint=d=>{if(!d.date)return false;const x=new Date(d.date+"T00:00:00");return (x-new Date(x.getFullYear(),0,1))/864e5<=doy};
  const spark=v=>{const mx=Math.max(1,...v),W=150,H=40;return `<svg viewBox="0 0 ${W} ${H+4}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${v.map((n,i)=>`${(i*W/(v.length-1)).toFixed(1)},${(H+2-n/mx*H).toFixed(1)}`).join(" ")}" fill="none" stroke="#111" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`};
  const calc=()=>[...byCat.entries()].filter(([k,g])=>k!=="Other"&&g.brands.length).map(([k,g])=>{
    const ds=[...g.deals].filter(inM);
    const brands=g.brands.filter(b=>b.deals.some(x=>x.side==="b"&&inM(x.d)));
    const ty=ds.filter(d=>S.yearOf(d)===yr).length, ly=ds.filter(d=>S.yearOf(d)===yr-1&&atPoint(d)).length;
    const years=[];for(let y=yr-5;y<=yr;y++)years.push(ds.filter(d=>S.yearOf(d)===y).length);
    const top=[...brands].sort((a,b)=>b.n-a.n);
    return {k,ds,brands,ty,ly,years,top,growth:ly?(ty-ly)/ly:ty?1:0};
  }).filter(x=>x.ds.length);
  const total=D_TOTAL(byCat);
  const draw=()=>{
    const cards=calc();
    const sorters={deals:(a,b)=>b.ds.length-a.ds.length,brands:(a,b)=>b.brands.length-a.brands.length,growth:(a,b)=>b.ty-b.ly-(a.ty-a.ly),az:(a,b)=>a.k.localeCompare(b.k)};
    cards.sort(sorters[st.sort]);
    const all=calc(),big=[...all].sort(sorters.deals)[0],fast=[...all].filter(x=>x.ly>=5).sort((a,b)=>b.growth-a.growth)[0];
    const bet=all.find(x=>x.k==="Betting & wagering");
    const betLive=bet?bet.ds.filter(d=>S.mkt(d)==="ANZ"&&!d.ended&&d.status!=="Ended").length:0;
    $("cHi").innerHTML=[big&&["Biggest category",big.k,`${big.ds.length.toLocaleString("en-AU")} partnerships · ${Math.round(big.ds.length/Math.max(1,all.reduce((s,x)=>s+x.ds.length,0))*100)}% of everything`,big.years],
      fast&&["Fastest growing",fast.k,`${fast.growth>=0?"+":""}${Math.round(fast.growth*100)}% on this point in ${yr-1}`,fast.years],
      bet&&["Exiting",bet.k,`${betLive} live ANZ partnerships roll off by 2031`,bet.years]].filter(Boolean)
      .map(([l,k,t,v])=>`<a class="c3-hi" href="categories?c=${encodeURIComponent(k)}"><span class="lbl mute-l">${l}</span><b>${esc(k)}</b><span class="x">${esc(t)}</span>${spark(v)}</a>`).join("");
    $("cGrid").innerHTML=cards.map(x=>`<a class="c3-c" href="categories?c=${encodeURIComponent(x.k)}"><span class="h"><b>${esc(x.k)}</b><span class="chip ${x.ty?"up":"flat"}">${x.ty?"+"+x.ty:"0"}</span></span>
      <span class="x">${plural(x.brands.length,"brand","brands")} · ${plural(x.ds.length,"partnership","partnerships")} · ${x.ty} in ${yr}</span>${spark(x.years)}
      <span class="lgs">${x.top.slice(0,4).map(b=>L.mark(b.e,{px:28})).join("")}${x.top.length>4?`<span class="more5">+${x.top.length-4}</span>`:""}</span></a>`).join("");
    document.querySelectorAll("#cMkt button").forEach(b=>b.classList.toggle("on",b.dataset.m===st.m));
    document.querySelectorAll("#cSort button").forEach(b=>b.classList.toggle("on",b.dataset.s===st.sort));
  };
  const lastAdd=total.last, ago=lastAdd?Math.round((now-new Date(lastAdd+"T00:00:00"))/864e5):0;
  $("view").innerHTML=`<section class="wrap d3-hero"><span class="lbl mute-l">Insights</span><h1 class="disp">Categories.</h1>
  <p>Every brand in the database sorted into the industry it sells in. Pick one to see who's spending, which sports they back and every partnership they've done.</p>
  <span class="stamp3"><i></i>Updated ${ago<=0?"today":ago===1?"yesterday":ago+" days ago"} · ${calc().length} categories</span>
  <div class="c3-his" id="cHi"></div></section>
  <div class="n3-bar"><div class="wrap"><div class="seg3" id="cMkt" role="group" aria-label="Market"><button type="button" data-m="All">Global</button><button type="button" data-m="ANZ">ANZ</button><button type="button" data-m="UK &amp; Ireland">UK</button><button type="button" data-m="North America">USA</button></div>
  <div class="tt3" id="cSort" role="group" aria-label="Sort"><button type="button" data-s="deals">Most partnerships</button><button type="button" data-s="brands">Most brands</button><button type="button" data-s="growth">Fastest growing</button><button type="button" data-s="az">A-Z</button></div></div></div>
  <section class="wrap c3-sec"><div class="c3-grid" id="cGrid"></div></section>`;
  $("cMkt").onclick=e=>{const b=e.target.closest("[data-m]");if(b){st.m=b.dataset.m;draw()}};
  $("cSort").onclick=e=>{const b=e.target.closest("[data-s]");if(b){st.sort=b.dataset.s;draw()}};
  draw();
}
function D_TOTAL(byCat){let last="";byCat.forEach(g=>g.deals.forEach(d=>{const k=d.added||d.date||"";if(k>last)last=k}));return {last}}
function detail(c,g,q){
  document.title=`${c} sponsors | Sport Sport Sport`;
  const st={sport:q.get("sport")||"All",region:q.get("region")||"All"};
  const deals=[...g.deals].sort((a,b)=>S.sortKey(b).localeCompare(S.sortKey(a)));
  const sports=(()=>{const m=new Map();deals.forEach(d=>m.set(d.sport,(m.get(d.sport)||0)+1));return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0])})();
  $("view").innerHTML=`<section class="wrap hero"><nav class="crumbs" style="padding:0 0 18px" aria-label="Breadcrumb"><a href="insights">Insights</a><span aria-hidden="true">/</span><a href="categories">Categories</a></nav>
  <span class="lbl mute-l">Category</span><h1 class="disp" style="font-size:clamp(48px,8vw,128px)">${esc(c)}.</h1><div class="stats" id="cStats" style="margin-top:32px"></div></section>
  <section class="wrap" style="padding-top:28px"><div class="ctl2"><div class="pills" id="spPills" role="group" aria-label="Sport"></div><div class="pills" id="regPills" role="group" aria-label="Region"></div></div></section>
  <section class="wrap sec" style="padding-top:12px"><div class="sh"><div><span class="lbl mute-l">The spenders</span><h2 class="disp">Brands.</h2></div><span class="lbl mute-l" id="bCount"></span></div><div class="dg" id="bGrid"></div></section>
  <section class="wrap sec" style="padding-top:0"><div class="sh"><div><span class="lbl mute-l">Who they back</span><h2 class="disp">Properties.</h2></div><span class="lbl mute-l" id="pCount"></span></div><div class="pg" id="pGrid"></div></section>
  <section class="wrap sec" style="padding-top:0"><div class="sh"><div><span class="lbl mute-l">The record</span><h2 class="disp">Every partnership.</h2></div><span class="lbl mute-l" id="dCount"></span></div><div class="tw"><table class="t"><thead><tr><th>Date</th><th>Partnership</th><th>Sport</th><th>Partnership type</th><th>Ends</th><th>Region</th></tr></thead><tbody id="dRows"></tbody></table></div></section>`;
  function draw(){
    const r=deals.filter(d=>(st.sport==="All"||d.sport===st.sport)&&(st.region==="All"||S.mkt(d)===st.region));
    const bm=new Map(),pm=new Map();
    r.forEach(d=>{d._bs.forEach(e=>{if(e&&g.brands.some(b=>b.e.slug===e.slug)){const m=bm.get(e.slug)||{e,n:0,sp:new Set()};m.n++;m.sp.add(d.sport);bm.set(e.slug,m)}});
      d._ps.forEach(e=>{if(!e)return;const m=pm.get(e.slug)||{e,n:0,sp:new Set()};m.n++;m.sp.add(d.sport);pm.set(e.slug,m)})});
    const bs=[...bm.values()].sort((a,b)=>b.n-a.n||a.e.name.localeCompare(b.e.name));
    const ps=[...pm.values()].sort((a,b)=>b.n-a.n||a.e.name.localeCompare(b.e.name));
    $("cStats").innerHTML=[[bs.length,"brands"],[r.length,"deals"],[r.filter(d=>S.yearOf(d)===yr).length,`in ${yr}`],[ps.length,"properties backed"]].map(([v,l])=>`<div class="stat"><b>${v.toLocaleString("en-AU")}</b><span>${l}</span></div>`).join("");
    $("bCount").textContent=plural(bs.length,"brand","brands");
    $("bGrid").innerHTML=bs.map(m=>`<a class="dt" href="${esc(L.page(m.e.slug))}">${L.mark(m.e,{px:72})}<b>${esc(m.e.name)}</b><span class="n">${m.n} partnership${m.n===1?"":"s"}</span><span class="k">${esc([...m.sp].slice(0,2).join(" · "))}</span></a>`).join("")||`<p class="note">No partnerships for that filter.</p>`;
    $("pCount").textContent=plural(ps.length,"property","properties");
    $("pGrid").innerHTML=ps.slice(0,48).map(m=>`<a class="pt" href="${esc(L.page(m.e.slug))}">${L.mark(m.e,{px:64})}<b>${esc(m.e.name)}</b><span class="k">${m.n>1?m.n+" partnerships · ":""}${esc([...m.sp].join(", "))}</span></a>`).join("");
    $("dCount").textContent=plural(r.length,"partnership","partnerships");
    $("dRows").innerHTML=r.map(d=>`<tr><td class="d">${esc(S.fmt(d))}</td><td><span class="dl">${L.pair(d,{px:34})}${S.dealLink(d)}</span></td><td>${esc(d.sport)}</td><td>${esc(d.tier||d.type||"")}</td><td class="d">${esc(S.endsTxt(d))}</td><td><span class="tag r">${esc(d.region)}</span></td></tr>`).join("");
    $("spPills").innerHTML=["All",...sports.slice(0,14)].map(s=>`<button type="button" class="pill${st.sport===s?" on":""}" data-s="${esc(s)}" aria-pressed="${st.sport===s}">${s==="All"?"All sports":esc(s)}</button>`).join("");
    $("regPills").innerHTML=S.MKTS.map(x=>`<button type="button" class="pill${st.region===x?" on":""}" data-r="${esc(x)}" aria-pressed="${st.region===x}">${esc(S.mktLab(x))}</button>`).join("");
    S.setQs({c,sport:st.sport!=="All"&&st.sport,region:st.region!=="All"&&st.region});
  }
  $("view").addEventListener("click",e=>{const b=e.target.closest("[data-s],[data-r]");if(!b)return;if(b.dataset.s)st.sport=b.dataset.s;if(b.dataset.r)st.region=b.dataset.r;draw()});
  draw();
}
})();

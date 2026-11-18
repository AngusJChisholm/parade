/* Brands and Properties directories (brands.html, properties.html). Data from assets/data.js. */
(function(){
const $=id=>document.getElementById(id);
const L=window.SSSLogos, S=window.SSSData, esc=S.esc;
const IS_B=document.body.dataset.kind!=="properties";
const PAGE=100;
const yr=new Date().getFullYear();
$("yr").textContent=yr;
const q0=S.qs();
const st={q:q0.get("q")||"",sport:q0.get("sport")||"All",region:q0.get("region")||"ANZ",league:q0.get("league")||"",
  group:q0.get(IS_B?"cat":"type")||"",sort:q0.get("sort")||"deals",shown:PAGE};
st.league=({BBL:"Big Bash League"})[st.league]||st.league;
const save=()=>S.setQs({q:st.q,sport:st.sport!=="All"&&st.sport,region:st.region!=="ANZ"&&st.region,league:st.league,[IS_B?"cat":"type"]:st.group,sort:st.sort!=="deals"&&st.sort});

S.load().then(D=>{
  const rows=IS_B?D.brands:D.props;
  const leagues=IS_B?[]:D.lgAll;
  const tally=new Map();rows.forEach(r=>r.sports.forEach((v,k)=>tally.set(k,(tally.get(k)||0)+v)));
  const sports=[...tally.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  const groupOf=r=>IS_B?r.cat:r.ptype;
  const groups=(IS_B?S.CATS:S.PTYPES).filter(g=>rows.some(r=>groupOf(r)===g));

  // Headline numbers: Global first, then ANZ, labelled so the two never get mixed up.
  const totalDeals=new Set(rows.flatMap(r=>r.deals.map(x=>x.d))).size;
  const anzRows=rows.filter(r=>r.markets.has("ANZ"));
  const anzDeals=new Set(anzRows.flatMap(r=>r.deals.map(x=>x.d)).filter(d=>S.mkt(d)==="ANZ")).size;
  const noun=IS_B?"brands":"properties";
  const firstYr=r=>Math.min(...r.deals.map(x=>S.yearOf(x.d)||9999));
  const fresh=rows.filter(r=>firstYr(r)===yr).length;
  const lastAdd=D.deals.map(d=>d.added||d.date||"").sort().pop();
  const agoD=lastAdd?Math.round((new Date()-new Date(lastAdd+"T00:00:00"))/864e5):0;
  $("dStamp").innerHTML=`<i></i>Updated ${agoD<=0?"today":agoD===1?"yesterday":agoD+" days ago"} · ${rows.length.toLocaleString("en-AU")} ${noun} tracked`;
  $("heroStats").innerHTML=[[rows.length,`${IS_B?"Brands":"Properties"} tracked`,""],[totalDeals,"Partnerships on file",""],[anzRows.length,`ANZ ${noun}`,""],[fresh,IS_B?`New to sport in ${yr}`:`First partnership in ${yr}`,fresh?`+${fresh}`:""]]
    .map(([v,l,c])=>`<div><span>${esc(l)}</span><b>${esc(v.toLocaleString("en-AU"))}</b>${c?`<span class="chip up">${esc(c)}</span>`:""}</div>`).join("");

  // Signed this week: the newest dated partnerships, one card each for this directory's side.
  const side=d=>IS_B?d._b:d._p, other=d=>IS_B?d._p:d._b;
  const seen=new Set();
  const sw=D.deals.filter(d=>d.date&&side(d)).sort((a,b)=>b.date.localeCompare(a.date)).filter(d=>{const k=side(d).slug;if(seen.has(k))return false;seen.add(k);return true}).slice(0,8);
  const fmtD=s=>new Date(s+"T00:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short"});
  const chipS=d=>{let t=d.status||"";if(/^current/i.test(t))t="Current";return t?`<span class="chip ${t==="New"?"up":t==="Ended"?"down":"flat"}">${esc(t)}</span>`:""};
  $("swG").innerHTML=sw.map(d=>`<a href="${esc(L.page(side(d).slug))}"><span class="t">${L.mark(side(d),{px:40})}${chipS(d)}</span><b>${esc(side(d).name)}</b><span class="x">with ${esc((other(d)||{}).name||"")} · ${esc(d.sport||"")}</span><span class="dt0">${esc(fmtD(d.date))}</span></a>`).join("");
  $("sw").hidden=!sw.length;

  // Most active this year, by market.
  const inM=(d,m)=>m==="All"||S.mkt(d)===m;
  const hotDraw=m=>{
    const yrN=r=>r.deals.filter(x=>inM(x.d,m)&&S.sortKey(x.d).startsWith(String(yr))).length;
    const hot=rows.map(r=>({r,n:yrN(r)})).filter(x=>x.n).sort((a,b)=>b.n-a.n||a.r.e.name.localeCompare(b.r.e.name)).slice(0,10);
    const row=({r,n},i)=>`<a href="${esc(L.page(r.e.slug))}"><span class="r">${String(i+1).padStart(2,"0")}</span>${L.mark(r.e,{px:32})}<span class="nm"><b>${esc(r.e.name)}</b><span>${esc(groupOf(r)||"")}</span></span><span class="tot">${r.n}</span><span class="chip up">+${n}</span></a>`;
    $("hot").innerHTML=`<div>${hot.slice(0,5).map(row).join("")}</div><div>${hot.slice(5).map((x,i)=>row(x,i+5)).join("")}</div>`;
    $("hotM").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.hm===m));
    $("band").hidden=!hot.length&&m==="ANZ";
  };
  $("hotYr").textContent=yr;
  $("hotM").onclick=e=>{const b=e.target.closest("[data-hm]");if(b)hotDraw(b.dataset.hm)};
  hotDraw("ANZ");

  // Category (or type) pills with counts
  const gc=new Map();rows.forEach(r=>{const g=groupOf(r);if(g&&g!=="Other")gc.set(g,(gc.get(g)||0)+1)});
  const topG=[...gc].sort((a,b)=>b[1]-a[1]).slice(0,IS_B?12:10);
  $("catP").innerHTML=topG.map(([g,n])=>IS_B?`<a href="categories?c=${encodeURIComponent(g)}">${esc(g)} <span>${n.toLocaleString("en-AU")}</span></a>`:`<button type="button" data-g="${esc(g)}">${esc(g)} <span>${n.toLocaleString("en-AU")}</span></button>`).join("");
  $("cats").hidden=!topG.length;

  $("sport").innerHTML=["All",...sports].map(s=>`<option value="${esc(s)}"${s===st.sport?" selected":""}>${s==="All"?"All sports":esc(s)}</option>`).join("");
  $("group").innerHTML=["",...groups].map(g=>`<option value="${esc(g)}"${g===st.group?" selected":""}>${g?esc(g):IS_B?"All categories":"All types"}</option>`).join("");
  $("region").innerHTML=["ANZ","All",...S.MKTS.filter(m=>m!=="ANZ"&&m!=="All")].map(r=>`<option value="${esc(r)}"${r===st.region?" selected":""}>${esc(S.mktLab(r))}</option>`).join("");
  $("sort").value=st.sort;$("q").value=st.q;

  function pills(){
    $("region").value=st.region;$("group").value=st.group;
    if(!IS_B)leagueSel();
  }
  // League dropdown: grouped by sport, only leagues with properties under the current sport, region and type,
  // biggest first. The picked league always stays in the list.
  function leagueSel(){
    const base=rows.filter(x=>(st.sport==="All"||x.sports.has(st.sport))&&(st.region==="All"||x.markets.has(st.region))&&(!st.group||groupOf(x)===st.group));
    const counts=new Map(leagues.map(l=>[l.name,base.filter(x=>l.ids.has(x.e.slug)).length]));
    $("league").innerHTML=S.lgOptions(leagues,st.league,counts,true);$("league").value=st.league;
  }
  function draw(){
    const q=st.q.trim().toLowerCase();
    const lg=leagues.find(l=>l.name===st.league);
    const inLg=lg?lg.ids:null;
    const r=rows.filter(x=>(!q||x.hay.includes(q))&&(st.sport==="All"||x.sports.has(st.sport))&&(st.region==="All"||x.markets.has(st.region))&&(!inLg||inLg.has(x.e.slug))&&(!st.group||groupOf(x)===st.group));
    const by={deals:(a,b)=>b.n-a.n||a.e.name.localeCompare(b.e.name),
      latest:(a,b)=>S.sortKey(b.latest.d).localeCompare(S.sortKey(a.latest.d))||b.n-a.n,
      az:(a,b)=>a.e.name.localeCompare(b.e.name,"en",{sensitivity:"base"})};
    r.sort(by[st.sort]||by.deals);
    $("count").textContent=`${r.length.toLocaleString("en-AU")} ${IS_B?(r.length===1?"brand":"brands"):(r.length===1?"property":"properties")}`;
    $("grid").innerHTML=r.slice(0,st.shown).map(x=>{
      const yN=x.deals.filter(z=>S.sortKey(z.d).startsWith(String(yr))).length;
      return `<a class="dc" href="${esc(L.page(x.e.slug))}">${L.mark(x.e,{px:44})}<span class="nm"><b>${esc(x.e.name)}</b><span>${esc([groupOf(x),...[...x.sports.keys()].slice(0,2)].filter(Boolean).join(" · "))}</span></span><span class="ft"><span><b>${x.n}</b> partnership${x.n===1?"":"s"}</span><span class="chip ${yN?"up":"flat"}">${yN?"+"+yN:"0"}</span></span></a>`;
    }).join("")||`<p class="note">Nothing matches that. Try a different name or clear the filters.</p>`;
    $("moreBtn").hidden=r.length<=st.shown;
    $("moreBtn").textContent=`Show more (${(r.length-st.shown).toLocaleString("en-AU")} left)`;
    pills();save();
  }
  let t;
  $("q").oninput=e=>{clearTimeout(t);t=setTimeout(()=>{st.q=e.target.value;st.shown=PAGE;draw()},120)};
  $("sport").onchange=e=>{st.sport=e.target.value;st.shown=PAGE;draw()};
  $("group").onchange=e=>{st.group=e.target.value;st.shown=PAGE;draw()};
  $("region").onchange=e=>{st.region=e.target.value;st.shown=PAGE;draw()};
  $("sort").onchange=e=>{st.sort=e.target.value;draw()};
  if(!IS_B)$("league").onchange=e=>{st.league=e.target.value;st.shown=PAGE;draw()};
  document.querySelector("main").addEventListener("click",e=>{
    const b=e.target.closest("[data-r],[data-g]");if(!b)return;
    if(b.dataset.r!==undefined)st.region=b.dataset.r;
    if(b.dataset.g!==undefined){st.group=b.dataset.g;$("all").scrollIntoView({behavior:"smooth"})}
    st.shown=PAGE;draw();
  });
  $("moreBtn").onclick=()=>{st.shown+=PAGE;draw()};
  draw();
}).catch(()=>{$("grid").innerHTML=`<p class="note">Couldn't load the directory. Refresh to try again.</p>`});
})();

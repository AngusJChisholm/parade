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
  $("heroStats").innerHTML=[[rows.length,`Global ${noun} tracked`],[totalDeals,"Global partnerships on file"],[anzRows.length,`ANZ ${noun}`],[anzDeals,"ANZ partnerships on file"]]
    .map(([v,l])=>`<div class="stat"><b>${esc(v.toLocaleString("en-AU"))}</b><span>${esc(l)}</span></div>`).join("");

  // Signed this week: the five newest ANZ partnerships, linking to this directory's side of each one.
  const side=d=>IS_B?d._b:d._p, other=d=>IS_B?d._p:d._b;
  const sw=D.deals.filter(d=>S.mkt(d)==="ANZ"&&d.date&&side(d)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const fmtD=s=>new Date(s+"T00:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short"});
  $("swG").innerHTML=sw.map(d=>`<a href="${esc(L.page(side(d).slug))}"><span class="k">${esc(d.status==="New"?"New partnership":d.status||"Partnership")} · ${esc(fmtD(d.date))}</span>${L.mark(side(d),{px:30})}<b>${esc(side(d).name)}</b><span class="x">with ${esc((other(d)||{}).name||"")} · ${esc(d.sport||"")}</span></a>`).join("");
  $("sw").hidden=!sw.length;

  // Top 10 this year in ANZ.
  const anzYr=r=>r.deals.filter(x=>S.mkt(x.d)==="ANZ"&&S.sortKey(x.d).startsWith(String(yr))).length;
  const hot=anzRows.map(r=>({r,n:anzYr(r)})).filter(x=>x.n).sort((a,b)=>b.n-a.n||a.r.e.name.localeCompare(b.r.e.name)).slice(0,10);
  $("hotYr").textContent=yr;
  $("hot").innerHTML=hot.map(({r,n},i)=>`<a href="${esc(L.page(r.e.slug))}"><span class="r">${String(i+1).padStart(2,"0")}</span>${L.mark(r.e,{px:48})}<b>${esc(r.e.name)}</b><span class="c">${n} ANZ partnership${n===1?"":"s"} in ${yr}</span></a>`).join("");
  $("band").hidden=!hot.length;

  $("sport").innerHTML=["All",...sports].map(s=>`<option value="${esc(s)}"${s===st.sport?" selected":""}>${s==="All"?"All sports":esc(s)}</option>`).join("");
  if(IS_B)$("group").innerHTML=["",...groups].map(g=>`<option value="${esc(g)}"${g===st.group?" selected":""}>${g?esc(g):"All categories"}</option>`).join("");
  $("sort").value=st.sort;$("q").value=st.q;

  function pills(){
    $("regPills").innerHTML=["ANZ","All",...S.MKTS.filter(m=>m!=="ANZ"&&m!=="All")].map(r=>`<button type="button" class="pill${st.region===r?" on":""}" data-r="${esc(r)}" aria-pressed="${st.region===r}">${esc(S.mktLab(r))}</button>`).join("");
    if(!IS_B){
      $("typePills").innerHTML=["",...groups].map(g=>`<button type="button" class="pill${st.group===g?" on":""}" data-g="${esc(g)}" aria-pressed="${st.group===g}">${g?esc(g):"All types"}</button>`).join("");
      leagueSel();
    }
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
      const o=(x.latest.other||[]).filter(Boolean).map(e=>e.name).join(" / ");
      return `<a class="dt" href="${esc(L.page(x.e.slug))}">${L.mark(x.e,{px:72})}<b>${esc(x.e.name)}</b><span class="n">${x.n} partnership${x.n===1?"":"s"}</span><span class="k">${esc(groupOf(x))}</span><span class="k">${esc([...x.sports.keys()].slice(0,2).join(" · "))}</span>${o?`<span class="lt">Latest: with ${esc(o)}</span>`:""}</a>`;
    }).join("")||`<p class="note">Nothing matches that. Try a different name or clear the filters.</p>`;
    $("moreBtn").hidden=r.length<=st.shown;
    $("moreBtn").textContent=`Show more (${(r.length-st.shown).toLocaleString("en-AU")} left)`;
    pills();save();
  }
  let t;
  $("q").oninput=e=>{clearTimeout(t);t=setTimeout(()=>{st.q=e.target.value;st.shown=PAGE;draw()},120)};
  $("sport").onchange=e=>{st.sport=e.target.value;st.shown=PAGE;draw()};
  if(IS_B)$("group").onchange=e=>{st.group=e.target.value;st.shown=PAGE;draw()};
  $("sort").onchange=e=>{st.sort=e.target.value;draw()};
  if(!IS_B)$("league").onchange=e=>{st.league=e.target.value;st.shown=PAGE;draw()};
  document.querySelector("main").addEventListener("click",e=>{
    const b=e.target.closest("[data-r],[data-g]");if(!b)return;
    if(b.dataset.r!==undefined)st.region=b.dataset.r;
    if(b.dataset.g!==undefined)st.group=b.dataset.g;
    st.shown=PAGE;draw();
  });
  $("moreBtn").onclick=()=>{st.shown+=PAGE;draw()};
  draw();
}).catch(()=>{$("grid").innerHTML=`<p class="note">Couldn't load the directory. Refresh to try again.</p>`});
})();

/* Compare (compare.html?a=<slug>&b=<slug>): two brands or properties head to head. */
(function(){
const $=id=>document.getElementById(id);
const L=window.ParadeLogos, S=window.ParadeData, esc=S.esc;
const yr=new Date().getFullYear();
if($("yr"))$("yr").textContent=yr;

S.load().then(D=>{
  const recs=[...D.orgs.values()].sort((a,b)=>b.n-a.n);
  const byName=new Map();recs.forEach(r=>{byName.set(r.e.name.toLowerCase(),r);(r.e.aliases||[]).forEach(a=>{if(!byName.has(a.toLowerCase()))byName.set(a.toLowerCase(),r)})});
  const q=S.qs();
  let A=D.orgs.get(q.get("a")||"adidas")||recs[0], B=D.orgs.get(q.get("b")||"nike")||recs[1];
  let kind=A.kind;
  const names=()=>{$("names").innerHTML=recs.filter(r=>r.kind===kind).slice(0,1500).map(r=>`<option value="${esc(r.e.name)}">`).join("");
    document.querySelectorAll("#cKind button").forEach(b=>b.classList.toggle("on",b.dataset.k===kind))};
  names();
  $("cKind").onclick=e=>{const b=e.target.closest("[data-k]");if(!b||b.dataset.k===kind)return;kind=b.dataset.k;
    const top=recs.filter(r=>r.kind===kind);A=top[0];B=top[1];names();draw()};
  const pick=(el,set)=>{el.onchange=()=>{const r=byName.get(el.value.trim().toLowerCase());if(r){set(r);draw()}else el.value=(el.id==="a"?A:B).e.name};el.onfocus=()=>el.select()};
  pick($("a"),r=>A=r);pick($("b"),r=>B=r);
  const lab=r=>r.kind==="brand"?`Brand · ${r.cat||"Brand"}`:`${r.ptype||"Property"}`;
  const mkts=r=>[...r.markets].slice(0,1).join("");

  // A stat row: A's value | label | B's value, the higher side gets volt
  const statRow=(l,a,b)=>`<div class="c4-sr"><span class="v${a>b?" w":""}">${a.toLocaleString("en-AU")}</span><span class="l">${l}</span><span class="v${b>a?" w":""}">${b.toLocaleString("en-AU")}</span></div>`;
  // Mirrored bars: A grows left, B grows right
  const mirror=(keysA,keysB,n)=>{const all=new Map();keysA.forEach((v,k)=>all.set(k,[v,0]));keysB.forEach((v,k)=>{const x=all.get(k)||[0,0];x[1]=v;all.set(k,x)});
    const rows=[...all].sort((x,y)=>(y[1][0]+y[1][1])-(x[1][0]+x[1][1])).slice(0,n);const mx=Math.max(1,...rows.flatMap(r=>r[1]));
    return rows.map(([k,[a,b]])=>`<div class="c4-mr"><span class="ba"><b>${a||""}</b><i style="width:${(a/mx*100).toFixed(1)}%"></i></span><span class="k">${esc(k||"Other")}</span><span class="bb"><i style="width:${(b/mx*100).toFixed(1)}%"></i><b>${b||""}</b></span></div>`).join("")};
  const tiersOf=r=>{const m=new Map();r.deals.forEach(x=>m.set(x.d.tier||x.d.type||"Other",(m.get(x.d.tier||x.d.type||"Other")||0)+1));return m};
  const topPartners=r=>{const c=new Map();r.deals.forEach(x=>(x.other||[]).forEach(o=>{if(o){const m=c.get(o.slug)||{e:o,n:0};m.n++;c.set(o.slug,m)}}));return [...c.values()].sort((a,b)=>b.n-a.n).slice(0,6)};
  const side=r=>`<div class="ps-c"><div class="c4-sh">${L.mark(r.e,{px:28})}<b>${esc(r.e.name)}</b></div>
    <div class="ps-k">Top partners</div>${topPartners(r).map(m=>`<a class="c4-row" href="${esc(L.page(m.e.slug))}">${L.mark(m.e,{px:26})}<span>${esc(m.e.name)}</span><em>${m.n}</em></a>`).join("")||`<p class="note-s">None filed yet.</p>`}
    <div class="ps-k" style="margin-top:18px">Latest partnerships</div>${r.deals.slice(0,5).map(x=>`<div class="c4-row"><span>${S.dealLink(x.d)}</span><em>${esc(S.fmt(x.d))}</em></div>`).join("")}
    <a class="more" href="${esc(L.page(r.e.slug))}" style="display:inline-block;margin-top:14px">Full record →</a></div>`;

  function draw(){
    $("a").value=A.e.name;$("b").value=B.e.name;
    $("lgA").innerHTML=L.mark(A.e,{px:56});$("lgB").innerHTML=L.mark(B.e,{px:56});
    $("kA").textContent=[lab(A),mkts(A)].filter(Boolean).join(" · ");$("kB").textContent=[lab(B),mkts(B)].filter(Boolean).join(" · ");
    const shared=[...A.partners.keys()].filter(k=>B.partners.has(k)).map(k=>A.partners.get(k));
    const sharedSports=[...A.sports.keys()].filter(k=>B.sports.has(k));
    const direct=A.deals.filter(x=>(x.other||[]).some(o=>o&&o.slug===B.e.slug));
    $("cmp").innerHTML=`<section class="wrap d3-sec c4-s"><div class="d3-h"><h2>Partnerships.</h2><div class="c4-key"><span><i></i>${esc(A.e.name)}</span><span><i class="b"></i>${esc(B.e.name)}</span></div></div>
      <div class="ps-c c4-stats">${statRow(A.kind==="property"&&B.kind==="property"?"Current partners":"Current partners / properties",A.cur||0,B.cur||0)}${statRow("Partnerships on file",A.n,B.n)}${statRow(`In ${yr}`,A.thisYr,B.thisYr)}${statRow("All-time partners",A.partners.size,B.partners.size)}${statRow("Sports",A.sports.size,B.sports.size)}</div></section>
      <section class="wrap d3-sec c4-s"><div class="i3-find" style="margin:0"><span class="lbl mute-l">In common</span><b>${direct.length?`They've done ${direct.length} partnership${direct.length===1?"":"s"} together. `:""}${shared.length?`${shared.length} shared partner${shared.length===1?"":"s"}.`:"No shared partners filed."}${sharedSports.length?` Both are in ${esc(sharedSports.slice(0,5).join(", "))}${sharedSports.length>5?" and more":""}.`:""}</b></div></section>
      <section class="wrap d3-sec c4-s"><div class="c4-two"><div class="ps-c"><div class="ps-h">Sports.</div>${mirror(A.sports,B.sports,8)}</div><div class="ps-c"><div class="ps-h">Partnership types.</div>${mirror(tiersOf(A),tiersOf(B),6)}</div></div></section>
      ${shared.length?`<section class="wrap d3-sec c4-s"><div class="d3-h"><div><h2>What they share.</h2><p class="i3-sub">${A.kind==="brand"?"Properties":"Brands"} both have signed with.</p></div></div><div class="c4-shared">${shared.slice(0,12).map(e=>`<a href="${esc(L.page(e.slug))}">${L.mark(e,{px:36})}<b>${esc(e.name)}</b></a>`).join("")}</div></section>`:""}
      <section class="wrap d3-sec c4-s" style="padding-bottom:72px"><div class="c4-two">${side(A)}${side(B)}</div></section>`;
    S.setQs({a:A.e.slug,b:B.e.slug});
  }
  draw();
}).catch(e=>{console.error(e);$("cmp").innerHTML=`<p class="wrap note">Couldn't load. Refresh to try again.</p>`});
})();

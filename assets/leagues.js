/* League maps (leagues.html): every club in a league against every sponsor category. */
(function(){
const $=id=>document.getElementById(id);
const L=window.SSSLogos, S=window.SSSData, esc=S.esc;
const yr=new Date().getFullYear();
$("yr").textContent=yr;
const q0=S.qs();
const st={league:q0.get("league")||"",span:q0.get("span")||"all"};

S.load().then(D=>{
  // Every league in leagues.json with 4+ clubs on file; a league with the same clubs as one above it (AFLW, WBBL) is skipped.
  const seen=new Set(),leagues=[];
  D.lgAll.forEach(l=>{const clubs=l.clubs.filter(s=>D.orgs.has(s));const k=clubs.slice().sort().join();if(clubs.length<4||seen.has(k))return;seen.add(k);leagues.push({name:l.name,sport:l.sport,clubs})});
  const lgCounts=new Map(leagues.map(l=>[l.name,l.clubs.length]));
  if(!leagues.some(l=>l.name===st.league))st.league=leagues[0].name;
  const recentFrom=`${yr-1}-01-01`;
  function draw(){
    const lg=leagues.find(l=>l.name===st.league);
    const clubs=lg.clubs.map(s=>D.orgs.get(s)||{e:L.byId(s)||{slug:s,name:s},deals:[]}).filter(c=>c.e);
    // club slug -> category -> Map(brand slug -> {e, last date})
    const grid=new Map();const catClubs=new Map();
    clubs.forEach(c=>{
      const m=new Map();grid.set(c.e.slug,m);
      (c.deals||[]).filter(x=>x.side==="p"&&(st.span==="all"||S.sortKey(x.d)>=recentFrom||(!x.d.date&&!x.d.month))).forEach(x=>{
        x.d._bs.forEach(b=>{if(!b)return;const rec=D.orgs.get(b.slug);const cat=(rec&&rec.cat)||"Other";
          const cm=m.get(cat)||new Map();if(!cm.has(b.slug))cm.set(b.slug,{e:b,d:x.d});m.set(cat,cm)});
      });
      m.forEach((_,cat)=>catClubs.set(cat,(catClubs.get(cat)||0)+1));
    });
    const cats=[...catClubs.entries()].sort((a,b)=>(a[0]==="Other")-(b[0]==="Other")||b[1]-a[1]).map(x=>x[0]);
    const n=clubs.length;
    $("lgSel").innerHTML=S.lgOptions(leagues,st.league,lgCounts,false);$("lgSel").value=st.league;
    $("regPills").innerHTML=[["all","All partnerships filed"],["recent",`Current and since ${yr-1}`]].map(([k,l])=>`<button type="button" class="pill${st.span===k?" on":""}" data-sp="${k}" aria-pressed="${st.span===k}">${l}</button>`).join("");
    $("lgNote").textContent=`${n} ${lg.name} clubs × ${cats.length} categories. A dash means we haven't filed a partner in that category for the club, not that one definitely doesn't exist. Tap a logo for the brand's page.`;
    $("map").innerHTML=cats.length?`<table class="m"><thead><tr><th class="club">${esc(lg.name)}</th>${cats.map(c=>`<th scope="col"><a href="categories?c=${encodeURIComponent(c)}">${esc(c)}</a><br><span class="mute-l" style="font-weight:500;letter-spacing:0">${catClubs.get(c)}/${n} clubs</span></th>`).join("")}</tr></thead><tbody>${clubs.map(c=>{const m=grid.get(c.e.slug);return `<tr><th class="club" scope="row"><a href="${esc(L.page(c.e.slug))}">${L.mark(c.e,{px:30})}${esc(c.e.name)}</a></th>${cats.map(cat=>{const cm=m.get(cat);if(!cm)return `<td class="no"></td>`;
      // Up to four logos in a 2 x 2 block; with five or more, three logos and a "+n" tile in the fourth spot.
      const all=[...cm.values()],show=all.length>4?all.slice(0,3):all;
      return `<td><span class="cell n${Math.min(all.length,4)}">${show.map(x=>`<a class="lga" href="${esc(L.page(x.e.slug))}" title="${esc(x.e.name)} · ${esc(S.fmt(x.d))}" aria-label="${esc(x.e.name)}">${L.mark(x.e,{px:32})}</a>`).join("")}${all.length>4?`<span class="more4" title="${esc(all.slice(3).map(x=>x.e.name).join(", "))}">+${all.length-3}</span>`:""}</span></td>`}).join("")}</tr>`}).join("")}</tbody></table>`:`<p class="note">No partnerships filed for these clubs yet.</p>`;
    S.setQs({league:st.league,span:st.span!=="all"&&st.span});
  }
  document.querySelector("main").addEventListener("click",e=>{const b=e.target.closest("[data-sp]");if(!b)return;st.span=b.dataset.sp;draw()});
  $("lgSel").onchange=e=>{st.league=e.target.value;draw()};
  draw();
}).catch(()=>{$("map").innerHTML=`<p class="note">Couldn't load the map. Refresh to try again.</p>`});
})();

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
  if(!leagues.some(l=>l.name===st.league))st.league=(leagues.find(l=>l.name==="Premier League")||leagues[0]).name;
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
    // Brands at two or more clubs get a fixed spot in the 2 x 2 block for that category, so the same brand lines up
    // down the column (most widely held first, top-left). Everything else fills the spots left over.
    const slots=new Map();
    cats.forEach(cat=>{
      const cells=[],freq=new Map();
      clubs.forEach(c=>{const cm=grid.get(c.e.slug).get(cat);if(cm){cells.push(cm);cm.forEach((_,b)=>freq.set(b,(freq.get(b)||0)+1))}});
      const used=cells.map(()=>new Set()),fixed=new Map();
      [...freq].filter(([,f])=>f>1).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).forEach(([b])=>{
        const at=cells.map((cm,i)=>cm.has(b)?i:-1).filter(i=>i>=0);
        for(let k=0;k<4;k++)if(at.every(i=>!used[i].has(k))){fixed.set(b,k);at.forEach(i=>used[i].add(k));break}
      });
      slots.set(cat,{fixed,freq});
    });
    const logo=x=>`<a class="lga" href="${esc(L.page(x.e.slug))}" title="${esc(x.e.name)} · ${esc(S.fmt(x.d))}" aria-label="${esc(x.e.name)}">${L.mark(x.e,{px:32})}</a>`;
    function cellHtml(cat,cm){
      const {fixed,freq}=slots.get(cat),box=[null,null,null,null],rest=[];
      [...cm.entries()].sort((a,b)=>(freq.get(b[0])||0)-(freq.get(a[0])||0)||a[1].e.name.localeCompare(b[1].e.name)).forEach(([b,x])=>{
        const k=fixed.get(b);if(k!=null&&!box[k])box[k]=x;else rest.push(x)});
      for(let k=0;k<4&&rest.length;k++)if(!box[k])box[k]=rest.shift();
      // No room left: the last spot becomes a "+n" tile.
      let more="";if(rest.length){rest.unshift(box[3]);box[3]=null;more=`<span class="more4" title="${esc(rest.map(x=>x.e.name).join(", "))}">+${rest.length}</span>`}
      const rows=box[2]||box[3]||more?4:2;
      return `<td><span class="cell">${box.slice(0,rows).map((x,k)=>x?logo(x):k===3&&more?more:`<span class="sl"></span>`).join("")}</span></td>`;
    }
    $("lgSel").innerHTML=S.lgOptions(leagues,st.league,lgCounts,false);$("lgSel").value=st.league;
    $("regPills").innerHTML=[["all","All filed"],["recent",`Current and since ${yr-1}`]].map(([k,l])=>`<button type="button" class="${st.span===k?"on":""}" data-sp="${k}" aria-pressed="${st.span===k}">${l}</button>`).join("");
    // Header: quick league pills, market label, stamps and stat cards
    const QUICK=["Premier League","NFL","NBA","LaLiga","IPL","Formula 1","MLB","Serie A","Bundesliga","NHL","MLS","AFL"];
    const quick=QUICK.filter(n=>leagues.some(l=>l.name===n));
    $("lgQuick").innerHTML=quick.map(n=>`<button type="button" data-lg="${esc(n)}" class="${n===st.league?"on":""}">${esc(n)}</button>`).join("");
    $("crLg").textContent=lg.name;document.title=`${lg.name} league map | Parade`;
    const mk=new Map();clubs.forEach(c=>(c.markets||new Set()).forEach(m=>mk.set(m,(mk.get(m)||0)+1)));const mkt=[...mk].sort((a,b)=>b[1]-a[1])[0];
    $("lgLbl").textContent=`League map · ${mkt?(mkt[0]==="ANZ"?"Australia & NZ":mkt[0]):lg.sport||""}`;
    $("lgSub").textContent=`Every ${lg.name} club against every sponsor category, drawn from each club's partners on file.`;
    const ENT=L.all(),ver=clubs.map(c=>(ENT[c.e.slug]||{}).ptiersChecked||"").filter(Boolean).sort();
    const added=clubs.flatMap(c=>(c.deals||[]).map(x=>x.d.added||x.d.date||"")).sort().pop();
    const dd=s=>new Date(s+"T00:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"});
    $("lgStamps").innerHTML=[ver.length?`${ver.length===clubs.length?"All clubs":ver.length+" of "+clubs.length+" clubs"} verified ${dd(ver[ver.length-1])}`:"",added?`Updated ${dd(added)}`:""].filter(Boolean).map(t=>`<span class="stamp3"><i></i>${esc(t)}</span>`).join("");
    const brands=new Set();let curP=0;clubs.forEach(c=>{const cs=new Set();(c.deals||[]).forEach(x=>{if(x.side==="p"&&!x.d.ended&&x.d.status!=="Ended")x.d._bs.forEach(b=>{if(b){brands.add(b.slug);cs.add(b.slug)}})});curP+=cs.size});
    $("lgStats").innerHTML=[[n,"Clubs"],[curP,"Current club partners"],[brands.size,"Brands"],[cats.length,"Categories"]].map(([v,l])=>`<div><span>${l}</span><b>${v.toLocaleString("en-AU")}</b></div>`).join("");
    $("lgNote").textContent=`${n} ${lg.name} clubs × ${cats.length} categories. A dash means we haven't filed a partner in that category for the club, not that one definitely doesn't exist. Tap a logo for the brand's page.`;
    $("map").innerHTML=cats.length?`<table class="m"><thead><tr><th class="club">${esc(lg.name)}</th>${cats.map(c=>`<th scope="col"><a href="categories?c=${encodeURIComponent(c)}">${esc(c)}</a><br><span class="mute-l" style="font-weight:500;letter-spacing:0">${catClubs.get(c)}/${n} clubs</span></th>`).join("")}</tr></thead><tbody>${clubs.map(c=>{const m=grid.get(c.e.slug);return `<tr><th class="club" scope="row"><a href="${esc(L.page(c.e.slug))}">${L.mark(c.e,{px:30})}${esc(c.e.name)}</a></th>${cats.map(cat=>{const cm=m.get(cat);if(!cm)return `<td class="no"></td>`;
      return cellHtml(cat,cm)}).join("")}</tr>`}).join("")}</tbody></table>`:`<p class="note">No partnerships filed for these clubs yet.</p>`;
    S.setQs({league:st.league,span:st.span!=="all"&&st.span});
  }
  document.querySelector("main").addEventListener("click",e=>{const g=e.target.closest("[data-lg]");if(g){st.league=g.dataset.lg;draw();return}const b=e.target.closest("[data-sp]");if(!b)return;st.span=b.dataset.sp;draw()});
  $("lgSel").onchange=e=>{st.league=e.target.value;draw()};
  draw();
}).catch(()=>{$("map").innerHTML=`<p class="note">Couldn't load the map. Refresh to try again.</p>`});
})();

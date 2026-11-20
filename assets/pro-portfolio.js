/* Partnership Pro: Portfolio tab.
   For rights holders that sell more than one property (Tennis Australia: AO, United Cup, Brisbane, Adelaide,
   Hobart and Canberra Internationals). A portfolio is any league map in leagues.json: its own name(s) plus its
   members. Everything here comes from deals.json and pro/matches.json (tools/match.py), nothing typed in by hand:
     Partner map         every live partner against every property in the portfolio
     Extend              brands already in the portfolio that fit another property they're not on yet
     Category coverage   each sub-category (from the Match model's slots): sold, ending or open, property by property
     New business        brands not in the portfolio yet, best Match Score across its properties, with the reasons
     Renewal radar       portfolio partnerships ending in the next three years
     Benchmark           for tennis: categories the other Grand Slams have sold that the AO hasn't */
(function(){
const SLAMS=["wimbledon","roland-garros","us-open"];
const SHORT={"australian-open":"AO","united-cup":"United Cup","tennis-australia":"TA","brisbane-international":"Brisbane","adelaide-international":"Adelaide","hobart-international":"Hobart","canberra-international":"Canberra","kooyong-classic":"Kooyong"};
const TOPT=["Naming rights","Title sponsor","Principal & major"];
let st={};

function render(c){
  const {D,S,L,mxLoad,renewal,basisTag,confTag,live,csv,FOR,go,state}=c, esc=S.esc, $=id=>document.getElementById(id);
  const yr=new Date().getFullYear();
  const view=$("view");
  // Pick the portfolio: the one the "Working for" property sits in, else Tennis Australia events.
  const wf=FOR.org();
  const lgs=D.lgAll.filter(l=>l.clubs.length>=2);
  if(!st.lg){
    const mine=wf&&lgs.filter(l=>l.ids.has(wf.e.slug)).sort((a,b)=>a.clubs.length-b.clubs.length)[0];
    st.lg=(mine||lgs.find(l=>l.name==="Tennis Australia events")||lgs[0]).name;
  }
  const lg=lgs.find(l=>l.name===st.lg)||lgs[0];
  const self=[...lg.ids].filter(s=>!lg.clubs.includes(s));
  const members=[...self,...lg.clubs].map(s=>D.orgs.get(s)).filter(Boolean);
  const ids=new Set(members.map(m=>m.e.slug));
  const short=m=>SHORT[m.e.slug]||m.e.name.replace(/ International$/," Intl").replace(/^Tennis /,"");
  const logo=(e,px)=>e?L.link(e,{px:px||28}):"";
  // Live, and not marked ended (an "ended" year this year or earlier means it's already rolled off for the coming summer).
  const on=d=>live(d)&&!(d.ended===true||(+d.ended&&+d.ended<=yr));
  view.innerHTML=`<p class="note">Loading the portfolio…</p>`;

  mxLoad().catch(()=>({props:{},brands:{},subs:{}})).then(MX=>{
    MX=MX||{props:{},subs:{}};
    // live partners per member
    const at=new Map(); // brand slug -> {b, on: Map(member slug -> deal)}
    const perM=new Map();
    members.forEach(m=>{
      const seen=new Map();
      m.deals.filter(x=>x.side==="p"&&on(x.d)).forEach(x=>(x.other||[]).forEach(b=>{
        if(!b||seen.has(b.slug))return;seen.set(b.slug,x.d);
        if(!at.has(b.slug))at.set(b.slug,{b,on:new Map()});at.get(b.slug).on.set(m.e.slug,x.d);
      }));
      perM.set(m.e.slug,seen);
    });
    const rows=[...at.values()].map(r=>{
      const ds=[...r.on.values()];
      const top=ds.some(d=>TOPT.includes(d.tier));
      return Object.assign(r,{n:r.on.size,top,cat:(D.orgs.get(r.b.slug)||{}).cat||r.b.cat||"Other",sub:(MX.subs||{})[r.b.slug]||""});
    }).sort((a,b)=>b.n-a.n||(b.top-a.top)||a.b.name.localeCompare(b.b.name));
    const pairs=rows.reduce((s,r)=>s+r.n,0);
    const allDeals=[...new Map(members.flatMap(m=>m.deals.filter(x=>x.side==="p").map(x=>[x.d.deal+(x.d.date||x.d.month||x.d.listed||""),x.d]))).values()];
    const m12=allDeals.filter(d=>(d.date||d.month)&&S.sortKey(d)>=`${yr-1}-${String(new Date().getMonth()+1).padStart(2,"0")}`);
    const due=allDeals.filter(d=>on(d)).map(d=>({d,r:renewal(d)})).filter(x=>x.r&&x.r.end>=yr&&x.r.end<=yr+2).sort((a,b)=>a.r.end-b.r.end||a.d.deal.localeCompare(b.d.deal));
    const flag=members.slice().sort((a,b)=>(perM.get(b.e.slug).size)-(perM.get(a.e.slug).size))[0];

    // Extend: brands already in the portfolio that the Match model ranks for a member they're not on.
    const ext=[];
    members.forEach(m=>{const P=MX.props[m.e.slug];if(!P)return;
      (P.m||[]).forEach(x=>{if(at.has(x.b)&&!at.get(x.b).on.has(m.e.slug))ext.push({x,m,r:at.get(x.b)})})});
    const exg=new Map();ext.forEach(o=>{const k=o.r.b.slug;if(!exg.has(k))exg.set(k,{r:o.r,to:[],x:o.x});const g=exg.get(k);g.to.push(o);if(o.x.x>g.x.x)g.x=o.x});
    const extl=[...exg.values()].map(g=>Object.assign(g,{to:g.to.sort((a,b)=>b.x.x-a.x.x)})).sort((a,b)=>b.x.x-a.x.x);
    // New business: best score per brand across members, brands not yet in the portfolio.
    const nb=new Map();
    members.forEach(m=>{const P=MX.props[m.e.slug];if(!P)return;
      [...(P.m||[]).map(x=>Object.assign({intl:0},x)),...(P.e||[]).map(x=>Object.assign({intl:1},x))].forEach(x=>{
        if(at.has(x.b))return;const cur=nb.get(x.b);
        if(!cur){nb.set(x.b,{x,best:m,fits:[m],intl:x.intl});return}
        if(!cur.fits.includes(m))cur.fits.push(m);if(x.x>cur.x.x){cur.x=x;cur.best=m}if(!x.intl)cur.intl=0;
      })});
    const nbl=[...nb.values()].sort((a,b)=>b.x.x-a.x.x);
    // Category coverage from each member's slots.
    const props=members.filter(m=>lg.clubs.includes(m.e.slug));
    const subs=new Map();
    props.forEach(m=>{const P=MX.props[m.e.slug];(P&&P.sl||[]).forEach(s=>{
      if(!subs.has(s.u))subs.set(s.u,{u:s.u,c:s.c,a:0,cells:new Map()});const g=subs.get(s.u);g.cells.set(m.e.slug,s);g.a=Math.max(g.a,s.a||0)})});
    rows.forEach(r=>{if(!r.sub)return;if(!subs.has(r.sub))subs.set(r.sub,{u:r.sub,c:r.cat,a:0,cells:new Map()});
      r.on.forEach((d,ms)=>{if(!lg.clubs.includes(ms))return;const g=subs.get(r.sub);const cur=g.cells.get(ms);if(!cur||cur.st==="open")g.cells.set(ms,{st:"sold",b:[r.b.name]})})});
    const subl=[...subs.values()].map(g=>Object.assign(g,{sold:[...g.cells.values()].filter(s=>s.st!=="open").length}))
      .sort((a,b)=>(b.sold>0)-(a.sold>0)||b.a-a.a||b.sold-a.sold||a.u.localeCompare(b.u));
    const gapsAll=subl.filter(g=>g.sold===0&&g.a>0);
    const bestFor=u=>nbl.filter(n=>n.x.u===u).slice(0,4);
    st.rows=rows;st.nbl=nbl;st.due=due;st.ext=extl;

    const tierDot=d=>TOPT.includes(d.tier)?"pf-dot pf-f":"pf-dot";
    const matrix=f=>{
      const rs=rows.filter(r=>f==="multi"?r.n>1:f==="single"?r.n===1:true);
      return `<div class="tw pf-mxw"><table class="t pf-mx"><thead><tr><th>Partner</th><th>Category</th>${members.map(m=>`<th class="c" title="${esc(m.e.name)}">${esc(short(m))}<span>${perM.get(m.e.slug).size}</span></th>`).join("")}<th class="c">Events</th></tr></thead>
      <tbody>${rs.map(r=>`<tr><td><span class="dl">${logo(r.b,26)}<a href="${esc(L.page(r.b.slug))}"><b>${esc(r.b.name)}</b></a></span></td><td class="pf-cat">${esc(r.sub||r.cat)}</td>${members.map(m=>{const d=r.on.get(m.e.slug);return `<td class="c">${d?`<span class="${tierDot(d)}" title="${esc(d.type||d.tier||"")}${d.ptier?" · "+esc(d.ptier):""}"></span>`:`<span class="pf-no"></span>`}</td>`}).join("")}<td class="c"><b>${r.n}</b></td></tr>`).join("")||`<tr><td colspan="${members.length+3}" class="note-s">Nothing in this view.</td></tr>`}</tbody></table></div>`;
    };
    // The model flags a slot "ending" if any deal in it ends soon; if the brand also has a firm live deal there, it's sold.
    const firm=(s,ms)=>(s.b||[]).some(n=>{const r=rows.find(r=>r.b.name===n);const d=r&&r.on.get(ms);return d&&!(d.ends&&d.ends<=yr+1)});
    const cell=(s,ms)=>{if(s&&s.st==="ending"&&firm(s,ms))s=Object.assign({},s,{st:"sold"});return !s?`<td class="c"><span class="pf-no"></span></td>`:s.st==="open"?`<td class="c"><span class="pf-open">Open</span></td>`:`<td class="c"><span class="pf-sold${s.st==="ending"?" end":""}" title="${esc((s.b||[]).join(", "))}${s.e?` · ends ${s.e}`:""}">${esc((s.b||[])[0]||"Sold")}${s.st==="ending"&&s.e?` <i>${s.e}</i>`:""}</span></td>`};

    // Grand Slam benchmark (tennis only)
    let bench="";
    if(lg.sport==="Tennis"&&MX.props["australian-open"]){
      const sl=p=>new Map(((MX.props[p]||{}).sl||[]).map(s=>[s.u,s]));
      const ao=sl("australian-open"),others=SLAMS.map(p=>({p,o:D.orgs.get(p),m:sl(p)})).filter(x=>x.o);
      const keys=[...new Set(others.flatMap(x=>[...x.m.values()].filter(s=>s.st!=="open").map(s=>s.u)))];
      const miss=keys.filter(u=>{const a=ao.get(u);return !a||a.st==="open"}).map(u=>({u,n:others.filter(x=>{const s=x.m.get(u);return s&&s.st!=="open"}).length})).sort((a,b)=>b.n-a.n||a.u.localeCompare(b.u));
      if(miss.length)bench=`<div class="h3">Grand Slam benchmark</div><p class="note-s">Categories at least one other Grand Slam has sold that the AO hasn't, with who holds them there. A natural first call list: these brands already buy Grand Slam tennis.</p>
      <div class="tw"><table class="t"><thead><tr><th>Category</th>${others.map(x=>`<th>${esc(x.o.e.name)}</th>`).join("")}<th>Slams sold</th></tr></thead><tbody>${miss.map(g=>`<tr><td><b>${esc(g.u)}</b></td>${others.map(x=>{const s=x.m.get(g.u);return `<td>${s&&s.st!=="open"?esc((s.b||[]).join(", ")):`<span class="mute-l">–</span>`}</td>`}).join("")}<td class="d"><b>${g.n}</b> of 3</td></tr>`).join("")}</tbody></table></div>`;
    }

    const why=x=>(x.w||[]).slice(0,2).map(esc).join(" · ");
    view.innerHTML=`<div class="ctl"><select class="sel" id="pfLg" aria-label="Portfolio">${lgs.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(l=>`<option value="${esc(l.name)}"${l.name===lg.name?" selected":""}>${esc(l.name)}</option>`).join("")}</select><button class="ghost" id="pfCsv">Export portfolio</button><button class="ghost" id="pfNb">Export new business list</button></div>
    <div class="ph pf-h"><div class="pf-lgs">${members.map(m=>`<a href="#" data-pfp="${esc(m.e.slug)}" title="${esc(m.e.name)}: property report">${L.mark(m.e,{px:44})}</a>`).join("")}</div><div><h2 class="disp">${esc(lg.name)}</h2><div class="sub">${members.length} properties · ${esc(lg.sport)} · ${esc(lg.market||"")} · from ${allDeals.length} partnerships on file</div></div></div>
    <div class="kpis"><div><b>${rows.length}</b><span>Live partners</span></div><div><b>${rows.filter(r=>r.n>1).length}</b><span>On more than one property</span></div><div><b>${m12.length}</b><span>Signed, last 12 months</span></div><div><b>${due.length}</b><span>Ending ${yr}-${yr+2}</span></div></div>

    <div class="h3">Partner map</div>
    <p class="note-s">Every live partner against every property in the portfolio. A filled dot is naming, title or major; hover for the partnership type. Most-shared partners first.</p>
    <div class="ctl2"><div class="seg" id="pfMf"><button type="button" data-mf="all">All ${rows.length}</button><button type="button" data-mf="multi">Shared ${rows.filter(r=>r.n>1).length}</button><button type="button" data-mf="single">One property ${rows.filter(r=>r.n===1).length}</button></div></div>
    <div id="pfMx">${matrix(st.mf||"all")}</div>

    <div class="h3">Extend across the portfolio</div>
    <p class="note-s">Brands already paying you somewhere in the portfolio that the Match model ranks for another of your properties. Usually the shortest sales cycle you have.</p>
    ${extl.length?`<div class="tw"><table class="t"><thead><tr><th>Brand</th><th>Already on</th><th>Extend to (Match Score)</th><th>Why</th></tr></thead><tbody>${extl.slice(0,20).map(({x,to,r})=>`<tr><td><span class="dl">${logo(r.b,26)}<a href="${esc(L.page(r.b.slug))}"><b>${esc(r.b.name)}</b></a></span></td><td>${[...r.on.keys()].map(s=>esc(short(D.orgs.get(s)))).join(", ")}</td><td><div class="chips">${to.map(o=>`<span class="chip">${esc(short(o.m))} <b>${o.x.x}</b></span>`).join("")}</div></td><td class="pf-why">${why(x)}</td></tr>`).join("")}</tbody></table></div>`:`<p class="note-s">No extension matches yet.</p>`}

    <div class="h3">Category coverage</div>
    <p class="note-s">Each sub-category, property by property: who holds it, when it ends if it's within a year, or Open. Built from the Match model's slots, so open means peers buy it and you don't have it yet.</p>
    <div class="tw pf-mxw"><table class="t pf-cov"><thead><tr><th>Category</th>${props.map(m=>`<th class="c">${esc(short(m))}</th>`).join("")}</tr></thead><tbody>${subl.filter(g=>g.cells.size).map(g=>`<tr><td><b>${esc(g.u)}</b><span class="pf-sc">${esc(g.c||"")}</span></td>${props.map(m=>cell(g.cells.get(m.e.slug),m.e.slug)).join("")}</tr>`).join("")}</tbody></table></div>

    ${gapsAll.length?`<div class="h3">Open across the whole portfolio</div><p class="note-s">No property in the portfolio has a partner here, and peers do. One sale can cover every event.</p>
    <div class="tw"><table class="t"><thead><tr><th>Category</th><th>Peers with one</th><th>Best fits, not yet with you</th></tr></thead><tbody>${gapsAll.map(g=>`<tr><td><b>${esc(g.u)}</b><span class="pf-sc">${esc(g.c||"")}</span></td><td class="d">${g.a}</td><td><div class="chips">${bestFor(g.u).map(n=>`<a class="chip" href="${esc(L.page(n.x.b))}" title="Match ${n.x.x} at ${esc(n.best.e.name)}">${esc(n.x.n)} <b>${n.x.x}</b></a>`).join("")||`<span class="mute-l">No strong fit on file yet</span>`}</div></td></tr>`).join("")}</tbody></table></div>`:""}

    <div class="h3">New business targets</div>
    <p class="note-s">Brands not in the portfolio yet, ranked by their best Match Score at any of your properties. International brands are those with no more than one ANZ partnership: they're looking for a way into the market.</p>
    <div class="ctl2"><div class="seg" id="pfNf"><button type="button" data-nf="all">All</button><button type="button" data-nf="anz">Active in ANZ</button><button type="button" data-nf="intl">International entrants</button></div></div>
    <div id="pfNbl"></div>

    <div class="h3">Renewal radar</div>
    ${due.length?`<div class="tw"><table class="t"><thead><tr><th>Ends</th><th>Basis</th><th>Partnership</th><th>Type</th><th>Announced</th><th>Source</th></tr></thead><tbody>${due.map(({d,r})=>`<tr><td><span class="yr">${r.end}</span></td><td>${basisTag(r)}</td><td><span class="dl">${L.pair(d,{px:26})}${S.dealLink(d)}</span></td><td>${esc(d.tier||"")}</td><td class="d">${esc(S.fmt(d))}</td><td>${confTag(d)}</td></tr>`).join("")}</tbody></table></div>`:`<p class="note-s">Nothing due in the next three years on what's been announced.</p>`}
    ${bench}
    <div class="h3">Latest across the portfolio</div>
    <div class="tw"><table class="t"><thead><tr><th>Announced</th><th>Partnership</th><th>Status</th><th>Summary</th></tr></thead><tbody>${allDeals.filter(d=>d.date||d.month).slice().sort((a,b)=>S.sortKey(b).localeCompare(S.sortKey(a))).slice(0,15).map(d=>`<tr><td class="d">${esc(S.fmt(d))}</td><td><span class="dl">${L.pair(d,{px:26})}${S.dealLink(d)}</span></td><td>${esc(d.status||"")}</td><td class="pf-why">${esc(d.summary||"")}</td></tr>`).join("")}</tbody></table></div>`;

    const drawNb=()=>{const f=st.nf||"all";
      const l=nbl.filter(n=>f==="intl"?n.intl:f==="anz"?!n.intl:true).slice(0,30);
      $("pfNbl").innerHTML=l.length?`<div class="tw"><table class="t"><thead><tr><th>Brand</th><th>Category</th><th>Best fit</th><th>Match</th><th>Also fits</th><th>Why</th></tr></thead><tbody>${l.map(n=>{const e=(D.orgs.get(n.x.b)||{}).e;return `<tr><td><span class="dl">${e?logo(e,26):""}<a href="${esc(L.page(n.x.b))}"><b>${esc(n.x.n)}</b></a>${n.intl?` <span class="chip">International</span>`:""}</span></td><td>${esc(n.x.u||n.x.c||"")}</td><td>${esc(n.best.e.name)}</td><td class="d"><b>${n.x.x}</b></td><td>${n.fits.filter(m=>m!==n.best).map(m=>esc(short(m))).join(", ")||"–"}</td><td class="pf-why">${why(n.x)}</td></tr>`}).join("")}</tbody></table></div>`:`<p class="note-s">No targets in this view yet.</p>`;
      document.querySelectorAll("#pfNf button").forEach(b=>b.classList.toggle("on",b.dataset.nf===f));};
    drawNb();
    document.querySelectorAll("#pfMf button").forEach(b=>b.classList.toggle("on",b.dataset.mf===(st.mf||"all")));
    $("pfLg").onchange=e=>{st={lg:e.target.value};render(c)};
    view.onclick=e=>{
      const mf=e.target.closest("[data-mf]");if(mf){st.mf=mf.dataset.mf;$("pfMx").innerHTML=matrix(st.mf);document.querySelectorAll("#pfMf button").forEach(b=>b.classList.toggle("on",b===mf));return}
      const nf=e.target.closest("[data-nf]");if(nf){st.nf=nf.dataset.nf;drawNb();return}
      const pp=e.target.closest("[data-pfp]");if(pp){e.preventDefault();state.p=D.orgs.get(pp.dataset.pfp);go("property");return}
      if(e.target.id==="pfCsv")csv([["Brand","Category","Sub-category",...members.map(m=>m.e.name),"Properties"],...rows.map(r=>[r.b.name,r.cat,r.sub,...members.map(m=>{const d=r.on.get(m.e.slug);return d?(d.ptier||d.type||d.tier||"Yes"):""}),r.n])],`partnership-pro-${lg.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}.csv`);
      if(e.target.id==="pfNb")csv([["Brand","Category","Best fit","Match Score","Also fits","International entrant","Why"],...nbl.map(n=>[n.x.n,n.x.u||n.x.c,n.best.e.name,n.x.x,n.fits.filter(m=>m!==n.best).map(m=>m.e.name).join("; "),n.intl?"Yes":"",(n.x.w||[]).join(" | ")])],`partnership-pro-${lg.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-new-business.csv`);
    };
  });
}
window.ParadePortfolio={render,reset(){st={}}};
})();

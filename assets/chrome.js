/* Site chrome behaviour: active menu item, mobile menu, footer year and the header search.
   Header search reads entities.json (every brand and property) the first time it opens. */
(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  // Active menu item from the path: /brands/nike lights Brands, /articles/x lights News, the Insights tools light Insights.
  const seg=(location.pathname.replace(/\.html$/,"").split("/").filter(Boolean)[0]||"").toLowerCase();
  const map={brands:"brands",properties:"properties",news:"news",articles:"news",insights:"insights",leagues:"insights",categories:"insights",compare:"insights",map:"insights",renewals:"insights",partnerships:"partnerships",deals:"partnerships",pro:"pro"};
  const on=map[seg];
  if(on)document.querySelectorAll(`header.v2 [data-nav="${on}"]`).forEach(a=>{a.classList.add("on");a.setAttribute("aria-current","page")});

  const yr=$("yr");if(yr)yr.textContent=new Date().getFullYear();

  const menu=$("menu"),nav=$("nav");
  if(menu&&nav)menu.addEventListener("click",()=>{const o=nav.classList.toggle("open");menu.setAttribute("aria-expanded",o);menu.textContent=o?"Close":"Menu"});


  // Live ticker (bottom of every page): ticker.json is a small file built from deals.json by tools/build_ticker.py.
  (function(){
    const tk=$("tk");if(!tk)return;
    const lg=document.querySelector("header.v2 .logo");
    const root=new URL(lg?lg.getAttribute("href"):"./",location.href);
    fetch(new URL("ticker.json",root),{cache:"no-cache"}).then(r=>r.ok?r.json():null).then(T=>{
      if(!T||!(T.items||[]).length)return;
      const item=x=>`<a href="${esc(new URL(x.href||"partnerships",root).href)}"><b>${esc(x.deal)}</b><span>${esc(x.sport||"")}</span><span class="ch ${x.status==="New"?"up":"flat"}">${esc(x.status||"New")}</span></a>`;
      const seq=(T.counts||[]).map(c=>`<a href="${esc(new URL("partnerships",root).href)}"><b>${esc(c.label)}</b><span>${esc(c.value)} partnerships on file</span></a>`).join("")+T.items.map(item).join("");
      tk.innerHTML=`<span class="tk-p"><i></i>Live</span><span class="tk-p g">${esc(T.total||"")} partnerships</span><div class="tk-w"><div class="tk-m">${seq}${seq}</div></div>`;
      tk.hidden=false;
    }).catch(()=>{});
  })();

  // Header search
  const btn=$("hsB"),box=$("hs"),q=$("hsQ"),res=$("hsR");
  if(!btn||!box||!q||!res)return;
  let list=null,hits=[],sel=-1;
  const load=()=>list||(list=fetch("entities.json",{cache:"force-cache"}).then(r=>r.ok?r.json():{}).then(E=>{
    const ent=E.entities||{};
    return Object.entries(ent).filter(([,x])=>x.k==="b"||x.k==="p").map(([slug,x])=>({slug,name:x.name,k:x.k,sub:x.k==="b"?(x.cat||"Brand"):(x.ptype||"Property"),
      hay:[x.name,...(x.aliases||[])].join(" ").toLowerCase()}));
  }).catch(()=>[]));
  const href=m=>`${m.k==="b"?"brands":"properties"}/${encodeURIComponent(m.slug)}`;
  const draw=()=>{
    const v=q.value.trim();
    if(v.length<2){res.hidden=true;res.innerHTML="";return}
    const grp=(k,t)=>{const h=hits.map((m,i)=>[m,i]).filter(([m])=>m.k===k);return h.length?`<span class="hs-g">${t}</span>`+h.map(([m,i])=>`<a href="${esc(href(m))}"${i===sel?' class="on"':""}><b>${esc(m.name)}</b><span>${m.k==="b"?"Brand":"Property"} · ${esc(m.sub)}</span></a>`).join(""):""};
    res.innerHTML=(hits.length?grp("b","Brands")+grp("p","Properties"):`<p>Nothing on file for "${esc(v)}" yet.</p>`)
      +`<a class="hs-all" href="search?q=${encodeURIComponent(v)}"><b>See all results for “${esc(v)}”</b><span>→</span></a>`;
    res.hidden=false;
  };
  const open=o=>{box.hidden=!o;btn.setAttribute("aria-expanded",o);if(o){load();setTimeout(()=>q.focus(),0)}};
  btn.addEventListener("click",()=>open(box.hidden));
  q.addEventListener("input",()=>{const v=q.value.trim().toLowerCase();sel=-1;
    if(v.length<2){hits=[];draw();return}
    load().then(L=>{if(q.value.trim().toLowerCase()!==v)return;
      hits=L.filter(m=>m.hay.includes(v)).sort((a,b)=>(b.name.toLowerCase().startsWith(v)-a.name.toLowerCase().startsWith(v))||a.name.length-b.name.length).slice(0,8);draw()})});
  q.addEventListener("keydown",e=>{
    if(e.key==="Escape"){open(false);btn.focus();return}
    if(e.key==="Enter"&&(sel<0||!hits.length)){e.preventDefault();const v=q.value.trim();if(v)location.href="search?q="+encodeURIComponent(v);return}
    if(!hits.length)return;
    if(e.key==="ArrowDown"){e.preventDefault();sel=(sel+1)%hits.length;draw()}
    else if(e.key==="ArrowUp"){e.preventDefault();sel=(sel-1+hits.length)%hits.length;draw()}
    else if(e.key==="Enter"){e.preventDefault();location.href=href(hits[sel<0?0:sel])}
  });
  document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|textarea|select/i.test((e.target.tagName||""))){e.preventDefault();open(true)}});
})();

/* Page change: two volt flaps fold shut with the Parade wordmark stamped on, then open on the next page.
   Same move as Riversdale Kitchen. The <head> of each page adds html.pd-arrive when we came from another page. */
(function(){
  const H=document.documentElement;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){H.classList.remove("pd-arrive");return}
  const KEY="pd-flaps";
  const lg=document.querySelector("header.v2 .logo");
  const root=new URL(lg?lg.getAttribute("href"):"./",location.href);
  const box=document.createElement("div");
  box.className="pd-flaps";box.setAttribute("aria-hidden","true");
  box.innerHTML=`<i class="pd-flap pd-flap-t"></i><i class="pd-flap pd-flap-b"></i><span class="pd-stamp"><img src="${new URL("assets/brand/Logo/parade-logo-black.svg",root).href}" alt=""></span>`;
  document.body.appendChild(box);

  // Arriving from another page: start shut, then open
  let came=false;try{came=sessionStorage.getItem(KEY)==="1";sessionStorage.removeItem(KEY)}catch(e){}
  if(came){box.classList.add("shut","now");requestAnimationFrame(()=>requestAnimationFrame(()=>{box.classList.remove("now");setTimeout(()=>box.classList.remove("shut"),120)}))}
  H.classList.remove("pd-arrive");

  const go=href=>{try{sessionStorage.setItem(KEY,"1")}catch(e){}box.classList.add("shut");setTimeout(()=>{location.href=href},520)};
  window.ParadeGo=go; // for buttons that change page in code

  document.addEventListener("click",e=>{
    const a=e.target.closest("a[href]");
    if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target||a.hasAttribute("download"))return;
    const url=new URL(a.href,location.href);
    if(url.origin!==location.origin)return;
    const last=url.pathname.split("/").pop();
    if(/\.(?!html$)[a-z0-9]+$/i.test(last))return; // files (json, png, pdf...) open as normal
    if(url.pathname.replace(/\.html$/,"")===location.pathname.replace(/\.html$/,"")&&url.search===location.search)return; // same page, just a jump
    e.preventDefault();go(url.href);
  });
  // Back button from the cache: never leave the page shut
  window.addEventListener("pageshow",e=>{if(e.persisted)box.classList.remove("shut")});
})();

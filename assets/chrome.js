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
    res.innerHTML=hits.length?hits.map((m,i)=>`<a href="${esc(href(m))}"${i===sel?' class="on"':""}><b>${esc(m.name)}</b><span>${m.k==="b"?"Brand":"Property"} · ${esc(m.sub)}</span></a>`).join("")
      :`<p>Nothing on file for "${esc(v)}" yet. <a href="partnerships?q=${encodeURIComponent(v)}" style="border-bottom:2px solid var(--volt)">Search every partnership →</a></p>`;
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
    if(!hits.length)return;
    if(e.key==="ArrowDown"){e.preventDefault();sel=(sel+1)%hits.length;draw()}
    else if(e.key==="ArrowUp"){e.preventDefault();sel=(sel-1+hits.length)%hits.length;draw()}
    else if(e.key==="Enter"){e.preventDefault();location.href=href(hits[sel<0?0:sel])}
  });
  document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|textarea|select/i.test((e.target.tagName||""))){e.preventDefault();open(true)}});
})();

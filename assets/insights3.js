/* Insights hub v3 (insights.html) */
(function(){
const $=id=>document.getElementById(id);
const L=window.SSSLogos,S=window.SSSData,esc=S.esc;
const yr=new Date().getFullYear(),now=new Date();
const fmtN=n=>n.toLocaleString("en-AU");
S.load().then(D=>{
  const deals=D.deals, live=d=>!d.ended&&d.status!=="Ended";
  const anz=deals.filter(d=>S.mkt(d)==="ANZ"), ty=deals.filter(d=>S.yearOf(d)===yr), anzTy=ty.filter(d=>S.mkt(d)==="ANZ");
  const last=deals.map(d=>d.added||d.date||"").sort().pop(), ago=last?Math.round((now-new Date(last+"T00:00:00"))/864e5):0;
  $("iStamp").innerHTML=`<i></i>Updated ${ago<=0?"today":ago===1?"yesterday":ago+" days ago"} · ${fmtN(deals.length)} partnerships on file`;
  $("iStats").innerHTML=[[deals.length,"Partnerships on file"],[ty.length,`Announced in ${yr}`],[anz.length,"ANZ partnerships on file"],[anzTy.length,`ANZ announced in ${yr}`]].map(([v,l])=>`<div><span>${l}</span><b>${fmtN(v)}</b></div>`).join("");
  // Headline finding: the category behind the most partnerships this year
  const cc=new Map();ty.forEach(d=>(d._cats||[]).forEach(c=>{if(c!=="Other")cc.set(c,(cc.get(c)||0)+1)}));
  const topC=[...cc].sort((a,b)=>b[1]-a[1])[0];
  if(topC){$("iFind").href=`categories?c=${encodeURIComponent(topC[0])}`;$("iFind").innerHTML=`<span class="lbl mute-l">The headline</span><b>${esc(topC[0])} brands are behind more ${yr} partnerships than any other category: ${fmtN(topC[1])} so far, ${Math.round(topC[1]/Math.max(1,ty.length)*100)}% of everything.</b><span class="go">See the category →</span>`;$("iFind").hidden=false}
  // Who's spending where
  const spend=m=>{const pool=deals.filter(d=>live(d)&&(m==="All"||S.mkt(d)===m));const c=new Map();pool.forEach(d=>(d._cats||[]).forEach(k=>{if(k!=="Other")c.set(k,(c.get(k)||0)+1)}));
    const rows=[...c].sort((a,b)=>b[1]-a[1]).slice(0,12),mx=rows.length?rows[0][1]:1;
    $("iSpend").innerHTML=rows.map(([k,n])=>`<a href="categories?c=${encodeURIComponent(k)}"><span>${esc(k)}</span><span class="b"><i style="width:${(n/mx*100).toFixed(1)}%"></i></span><b>${fmtN(n)}</b></a>`).join("");
    document.querySelectorAll("#iSpM button").forEach(b=>b.classList.toggle("on",b.dataset.m===m))};
  $("iSpM").onclick=e=>{const b=e.target.closest("[data-m]");if(b)spend(b.dataset.m)};spend("ANZ");
  // By month
  const months=[];for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push([d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),d.toLocaleDateString("en-AU",{month:"short"})])}
  const mc=months.map(([k])=>deals.filter(d=>(d.date||"").startsWith(k)).length),mmx=Math.max(1,...mc);
  $("iMonth").innerHTML=months.map(([k,l],i)=>`<div class="${i===11?"now":""}" title="${mc[i]} in ${l}"><span>${mc[i]||""}</span><i style="height:${(mc[i]/mmx*100).toFixed(1)}%"></i><em>${l.slice(0,1)}</em></div>`).join("");
  const hbars=(el,rows)=>{const mx=rows.length?Math.max(...rows.map(r=>r[1])):1;el.innerHTML=rows.map(([k,n,c])=>`<div class="pf-sp"><div><span>${esc(k)}</span><b>${fmtN(n)}</b></div><div class="pf-sb"><i style="width:${(n/mx*100).toFixed(1)}%;${c?"background:var(--volt)":""}"></i></div></div>`).join("")};
  const sc=new Map();ty.forEach(d=>{if(d.sport)sc.set(d.sport,(sc.get(d.sport)||0)+1)});
  hbars($("iSport"),[...sc].sort((a,b)=>b[1]-a[1]).slice(0,6));
  const nm=d=>/naming/i.test((d.type||"")+" "+(d.tier||""));
  hbars($("iType"),[["New",ty.filter(d=>d.status==="New").length,1],["Renewal",ty.filter(d=>d.status==="Renewal").length],["Extension",ty.filter(d=>d.status==="Extension").length],["Naming rights",ty.filter(nm).length,1]]);
  // Themed lists
  const bet=deals.filter(d=>S.mkt(d)==="ANZ"&&live(d)&&(d._cats||[]).includes("Betting & wagering"));
  const naming=deals.filter(d=>live(d)&&nm(d));
  const women=deals.filter(d=>live(d)&&/\b(women|womens|women's|aflw|nrlw|w-?league|wbbl|wnba|matildas|wallaroos|super netball|nwsl|liberty a-league)\b/i.test((d.deal||"")+" "+(d.sport||"")+" "+((d._ps||[]).map(e=>e.name).join(" "))));
  const logos=list=>{const seen=new Set(),out=[];for(const d of list){const e=(d._bs||[])[0];if(e&&!seen.has(e.slug)){seen.add(e.slug);out.push(e)}if(out.length>=3)break}return out.map(e=>L.mark(e,{px:30})).join("")};
  $("iThemes").innerHTML=[["The wagering exit",bet,"partnerships?q=&market=ANZ","Live ANZ betting partnerships, all rolling off by 2031"],["Naming rights",naming,"partnerships","Live naming rights partnerships"],["Women's sport",women,"partnerships","Live partnerships in women's sport"]]
    .map(([t,l,h,s])=>`<a href="${h}"><span class="tx"><b>${t}</b><span>${fmtN(l.length)} partnerships · ${s}</span></span><span class="lg3">${logos(l)}</span></a>`).join("");
  // Discover by category
  $("iCats").innerHTML=[...cc].sort((a,b)=>b[1]-a[1]).slice(0,16).map(([k,n])=>`<a href="categories?c=${encodeURIComponent(k)}">${esc(k)} <span>${fmtN(n)}</span></a>`).join("");
  // Popular comparisons: the two biggest in a few categories and leagues
  const topIn=(rows,f)=>rows.filter(f).sort((a,b)=>b.n-a.n).slice(0,2);
  const pairs=[];
  ["Apparel & footwear","Banking & finance","Alcohol"].forEach(c=>{const t=topIn(D.brands,r=>r.cat===c);if(t.length===2)pairs.push([t[0],t[1],"Brand"])});
  ["AFL","NRL","Premier League"].forEach(n=>{const lg=D.lgAll.find(l=>l.name===n);if(!lg)return;const t=topIn(D.props,r=>lg.ids.has(r.e.slug));if(t.length===2)pairs.push([t[0],t[1],"Property"])});
  $("iPairs").innerHTML=pairs.map(([a,b,k])=>`<a href="compare?a=${encodeURIComponent(a.e.slug)}&b=${encodeURIComponent(b.e.slug)}"><span class="s">${L.mark(a.e,{px:26})}<b>${esc(a.e.name)}</b><em>${k}</em></span><span class="vs" aria-hidden="true">→</span><span class="s r">${L.mark(b.e,{px:26})}<b>${esc(b.e.name)}</b><em>${k}</em></span></a>`).join("");
}).catch(e=>{console.error(e);$("iStats").innerHTML=`<p class="note">Couldn't load the numbers. Refresh to try again.</p>`});
})();

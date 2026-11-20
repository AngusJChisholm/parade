/* Insights hub (insights.html): headline numbers and simple charts from the deal archive. */
(function(){
const $=id=>document.getElementById(id);
const S=window.ParadeData, esc=S.esc;
$("yr").textContent=new Date().getFullYear();
const yr=new Date().getFullYear();
const tip=$("tip");
document.addEventListener("mousemove",e=>{const t=e.target.closest("[data-tip]");if(!t){tip.style.display="none";return}
  tip.innerHTML=t.dataset.tip;tip.style.display="block";const w=tip.offsetWidth;tip.style.left=Math.min(e.clientX+14,innerWidth-w-8)+"px";tip.style.top=(e.clientY+14)+"px"});

// Horizontal bars: rows of [label, value, href]. One series, one colour, so no legend.
function hbars(rows){
  const max=Math.max(1,...rows.map(r=>r[1]));
  return `<div class="hb">${rows.map(([l,v,h])=>`<div class="row" style="display:contents" data-tip="<b>${esc(v)}</b> partnerships · ${esc(l)}">${h?`<a class="lb" href="${esc(h)}">${esc(l)}</a>`:`<span class="lb">${esc(l)}</span>`}<span class="tr"><span class="br" style="width:${(v/max*100).toFixed(1)}%"></span></span><span class="vl">${v}</span></div>`).join("")}</div>`;
}
const count=(arr,f)=>{const m=new Map();arr.forEach(x=>[].concat(f(x)).forEach(k=>{if(k)m.set(k,(m.get(k)||0)+1)}));return [...m.entries()].sort((a,b)=>b[1]-a[1])};

S.load().then(D=>{
  const deals=D.deals, thisYr=deals.filter(d=>S.yearOf(d)===yr);
  // Who's spending where: live partnerships per brand category, ANZ or Global, biggest first.
  {const lv=d=>!d.ended&&d.status!=="Ended"&&(d.ends?d.ends>=yr:(d.date||d.month)?S.yearOf(d)>=yr-3:true);
   const drawSpend=m=>{const cc={};deals.filter(d=>lv(d)&&(m==="Global"||S.mkt(d)==="ANZ")).forEach(d=>(d._cats||[]).forEach(c=>{if(c&&c!=="Other")cc[c]=(cc[c]||0)+1}));
     $("spend").innerHTML=Object.entries(cc).sort((a,b)=>b[1]-a[1]).slice(0,16).map(([c,n])=>`<a href="categories?c=${encodeURIComponent(c)}"><b>${esc(c)}</b><span>${n.toLocaleString("en-AU")}</span></a>`).join("");
     $("spendNote").textContent=`Live ${m} partnerships by brand category, biggest first. Live means not ended, with an end date still to come or announced in the last three years.`;
     $("spendT").querySelectorAll("button").forEach(b=>{const o=b.dataset.m===m;b.classList.toggle("on",o);b.setAttribute("aria-selected",o)})};
   $("spendT").onclick=e=>{const b=e.target.closest("[data-m]");if(b)drawSpend(b.dataset.m)};
   drawSpend("ANZ")}

  // The lead finding: the category behind the most partnerships this year, as a share of everything announced,
  // against its share at the same point last year (shares, because our coverage has grown year on year).
  {const today=new Date().toISOString().slice(5,10);
   const ytd=y=>deals.filter(d=>(d.date||"").length===10&&+d.date.slice(0,4)===y&&d.date.slice(5)<=today);
   const A=ytd(yr),B=ytd(yr-1);
   const now=count(A,d=>d._cats).filter(([c])=>c!=="Other"),prev=new Map(count(B,d=>d._cats));
   if(now.length&&A.length){const [c,n]=now[0],p=prev.get(c)||0,pct=x=>Math.round(x*100);
     $("find").innerHTML=`${esc(c)} brands are behind more ${yr} sport partnerships than any other category: ${n.toLocaleString("en-AU")} so far, ${pct(n/A.length)}% of everything announced${B.length?` (${pct(p/B.length)}% at this point in ${yr-1})`:""}.<small>Global partnerships with an announcement date, ${yr} to date. Shares rather than totals, because our coverage has grown since ${yr-1}.</small>`;
     $("find").hidden=false}}
  const anzD=deals.filter(d=>S.mkt(d)==="ANZ");
  $("heroStats").innerHTML=[[deals.length.toLocaleString("en-AU"),"Global partnerships on file"],[thisYr.length.toLocaleString("en-AU"),`Global partnerships announced in ${yr}`],[anzD.length.toLocaleString("en-AU"),"ANZ partnerships on file"],[anzD.filter(d=>S.yearOf(d)===yr).length.toLocaleString("en-AU"),`ANZ partnerships announced in ${yr}`]]
    .map(([v,l])=>`<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");

  // Deals per month, last 24 months. Current month highlighted (it's still filling up).
  const now=new Date();const months=[];
  for(let i=23;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`)}
  const byM=new Map(months.map(m=>[m,0]));
  deals.forEach(d=>{const k=S.sortKey(d).slice(0,7);if(byM.has(k))byM.set(k,byM.get(k)+1)});
  const mMax=Math.max(1,...byM.values());
  const mlab=m=>new Date(m+"-01T00:00:00").toLocaleDateString("en-AU",{month:"short",year:"numeric"});
  const colsHtml=`<div class="cols">${months.map((m,i)=>`<span class="c${i===months.length-1?" cur":""}" style="height:${(byM.get(m)/mMax*100).toFixed(1)}%" data-tip="<b>${byM.get(m)}</b> partnerships · ${esc(mlab(m))}${i===months.length-1?" (so far)":""}"></span>`).join("")}</div><div class="cx"><span>${esc(mlab(months[0]))}</span><span>${esc(mlab(months[months.length-1]))}</span></div>`;

  // Sports: league codes rolled up into their sport, so NRL and Rugby league count together.
  const SPORT={NRL:"Rugby league",AFL:"Australian rules",NFL:"American football"};
  const sp=count(thisYr,d=>SPORT[d.sport]||d.sport).filter(([s])=>s!=="Multi-sport"&&s!=="Venues").slice(0,12);
  const tiers=count(thisYr,d=>d.tier).map(([t,v])=>[t,v]);
  // Status: new money (New, New partner), renewals, extensions, expansions and upgrades. Rows still marked
  // "Current partner" or "Ended" aren't new money or a renewal, so they're left out.
  const STATUS={"New":"New partnerships","New partner":"New partnerships","Renewal":"Renewals","Extension":"Extensions","Expansion":"Expansions & upgrades","Upgrade":"Expansions & upgrades"};
  const st=count(thisYr.filter(d=>STATUS[d.status]),d=>STATUS[d.status]);
  const reg=count(thisYr,d=>S.mkt(d)).map(([m,v])=>[S.mktLab(m),v,`partnerships?market=${encodeURIComponent(m)}`]);

  $("charts").innerHTML=`
  <div class="chart wide"><span class="lbl mute-l">Partnership flow</span><h3>Partnerships announced per month</h3>${colsHtml}</div>
  <div class="chart"><span class="lbl mute-l">${yr}</span><h3>Top sports</h3>${hbars(sp)}</div>
  <div class="chart"><span class="lbl mute-l">${yr}</span><h3>What brands are buying</h3>${hbars(tiers)}</div>
  <div class="chart"><span class="lbl mute-l">${yr}</span><h3>New money vs renewals</h3>${hbars(st)}</div>
  <div class="chart"><span class="lbl mute-l">${yr}</span><h3>By region</h3>${hbars(reg)}</div>
  <p class="note-s" style="grid-column:1/-1;padding-bottom:clamp(24px,3vw,48px)">Every chart counts partnerships with an announcement date. A further ${(deals.length-deals.filter(d=>d.date||d.month).length).toLocaleString("en-AU")} current partners taken from clubs' partner pages have no announcement date, so they appear in the totals above but not in these charts. Everything here is built from the partnerships we've found and checked, so it's a strong guide rather than a full census of every sponsorship in sport.</p>`;
}).catch(()=>{$("charts").innerHTML=`<p class="note">Couldn't load the numbers. Refresh to try again.</p>`});
})();

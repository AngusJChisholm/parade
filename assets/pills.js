/* Sport Sport Sport - filter dropdowns.
   Every row of filter buttons on the site (.pills, .cs-t, button .chips) is shown as a
   dropdown instead. The buttons stay in the page, hidden, and picking an option clicks
   the matching button, so each page's own filter code keeps working unchanged.
   One container holding two button sets (e.g. region + sort) becomes two dropdowns. */
(()=>{
  const SEL=".pills,.cs-t,.chips";
  const NAMES={r:"Region",reg:"Region",region:"Region",l:"League",league:"League",g:"Type",group:"Type",
    s:"Sport",sport:"Sport",t:"Group",sort:"Sort",basis:"Basis",yr:"Year",year:"Year",span:"Show",
    f:"Filter",mside:"View",mf:"Filter",rpk:"Type",rp:"Profile"};
  const css=document.createElement("style");
  css.textContent=`.to-sel{display:none!important}
.psels{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.ctl2:has(.psels){flex-direction:row;flex-wrap:wrap;align-items:center}
.psel{font:inherit;font-weight:800;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink,#111);background:var(--white,#fff) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z'/%3E%3C/svg%3E") no-repeat right 14px center;border:1px solid var(--ink,#111);border-radius:0;padding:12px 38px 12px 14px;min-width:180px;max-width:100%;cursor:pointer;-webkit-appearance:none;appearance:none}
.psel:hover{background-color:var(--canvas,#F4F4F1)}
.psel:focus-visible{outline:2px solid var(--volt,#D2FF3C);outline-offset:3px}
@media (max-width:760px){.psels{width:100%}.psel{flex:1 1 100%}}`;
  document.head.appendChild(css);

  const keyOf=b=>{for(const a of b.attributes)if(a.name.startsWith("data-"))return a.name.slice(5);return "_"};
  const isOn=b=>b.classList.contains("on")||b.getAttribute("aria-pressed")==="true";
  const label=t=>t.replace(/\s+/g," ").trim();

  function sync(c){
    const btns=[...c.children].filter(x=>x.tagName==="BUTTON");
    if(btns.length<2){if(c.classList.contains("to-sel"))c.classList.remove("to-sel");if(c._ps&&!c._ps.hidden)c._ps.hidden=true;return}
    const groups=new Map();
    btns.forEach(b=>{const k=keyOf(b);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(b)});
    const sig=[...groups].map(([k,g])=>k+":"+g.map(b=>label(b.textContent)+(isOn(b)?"*":"")+(b.disabled?"!":"")).join("|")).join("~");
    if(!c.classList.contains("to-sel"))c.classList.add("to-sel");
    if(!c._ps||!c._ps.isConnected){
      c._ps=document.createElement("div");c._ps.className="psels";c.after(c._ps);c._sig="";
    }
    if(c._ps.hidden)c._ps.hidden=false;
    if(c._sig===sig)return;
    c._sig=sig;
    const one=groups.size===1,aria=c.getAttribute("aria-label");
    c._ps.innerHTML="";
    for(const [k,g] of groups){
      const s=document.createElement("select");s.className="psel";
      const name=(one&&aria)||NAMES[k]||aria||"Filter";
      const nm=name.replace(/^Filter by /i,"");s.setAttribute("aria-label",nm.charAt(0).toUpperCase()+nm.slice(1));
      const cur=g.findIndex(isOn);
      if(cur<0){const o=new Option(name.replace(/^Filter by /i,"Choose "),"");o.disabled=true;o.selected=true;s.add(o)}
      g.forEach((b,i)=>{const o=new Option(label(b.textContent),i);o.disabled=b.disabled;o.selected=i===cur;s.add(o)});
      s.onchange=()=>{const b=g[+s.value];if(b&&b.isConnected)b.click()};
      c._ps.appendChild(s);
    }
  }
  let q=0;
  function run(){q=0;document.querySelectorAll(SEL).forEach(sync);
    document.querySelectorAll(".psels").forEach(p=>{const prev=p.previousElementSibling;if(!prev||!prev.matches(SEL))p.remove()})}
  const later=()=>{if(!q)q=requestAnimationFrame(run)};
  const start=()=>{run();new MutationObserver(later).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","aria-pressed","disabled"]})};
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start):start();
})();

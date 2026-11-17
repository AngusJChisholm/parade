/* Sport Sport Sport - filter bars.
   Every filter area on the site gets the Partnerships page layout: search box with the result count beside it,
   then one even row of dropdowns. Rows of filter buttons (.pills, .cs-t, button .chips) are shown as dropdowns
   instead. The buttons stay in the page, hidden, and picking an option clicks the matching button, so each page's
   own filter code keeps working unchanged. One container holding two button sets (e.g. region + sort) becomes two
   dropdowns. A .ctl row (search + selects) and the .ctl2 row of buttons under it merge into one bar. */
(()=>{
  const SEL=".pills:not(.tabs-keep),.cs-t,.chips";
  const NAMES={r:"Region",reg:"Region",region:"Region",l:"League",league:"League",g:"Type",group:"Type",
    s:"Sport",sport:"Sport",t:"Group",sort:"Sort",basis:"Basis",yr:"Year",year:"Year",y:"Year",span:"Show",sp:"Show",
    f:"Filter",mside:"View",mf:"Filter",rpk:"Type",rp:"Profile",win:"Time"};
  const ARROW=`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z'/%3E%3C/svg%3E") no-repeat right 14px center`;
  const css=document.createElement("style");
  css.textContent=`.to-sel{display:none!important}
.ctl.fb{display:flex;flex-direction:column;align-items:stretch;flex-wrap:nowrap;gap:10px;padding-block:24px 18px}
.ctl.fb+.ctl2{display:none}
.ctl2.fz{display:block;padding-bottom:22px}
.fbar{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.fbar .srch{flex:1 1 320px;max-width:none;font-size:16px;padding:13px 16px}
.fbar #count,.fbar .fcount{margin-left:auto;white-space:nowrap;font:500 14px/1.2 var(--font,inherit);letter-spacing:0;text-transform:none;color:var(--ink-3,#5C5C57)}
.fgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;width:100%}
.ctl.fb .fgrid{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.fgrid>.psels{display:contents}
.fgrid select,.psel{font:inherit;font-weight:800;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink,#111);background:var(--white,#fff) ${ARROW};border:1px solid var(--ink,#111);border-radius:0;padding:13px 36px 13px 14px;width:100%;min-width:0;max-width:none;margin:0;cursor:pointer;-webkit-appearance:none;appearance:none;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;flex:none}
.fgrid select:hover,.psel:hover{background-color:var(--canvas,#F4F4F1)}
.fgrid select:focus-visible,.psel:focus-visible{outline:2px solid var(--volt,#D2FF3C);outline-offset:3px}
.fgrid #league{width:100%}
@media (max-width:760px){.fgrid,.ctl.fb .fgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.fbar #count,.fbar .fcount{margin-left:0}}
@media (max-width:420px){.fgrid select,.psel{font-size:11px;letter-spacing:.08em;padding:12px 28px 12px 10px;background-position:right 10px center}}`;
  document.head.appendChild(css);

  const keyOf=b=>{for(const a of b.attributes)if(a.name.startsWith("data-"))return a.name.slice(5);return "_"};
  const isOn=b=>b.classList.contains("on")||b.getAttribute("aria-pressed")==="true";
  const label=t=>t.replace(/\s+/g," ").trim();
  const grid=()=>{const g=document.createElement("div");g.className="fgrid";return g};

  // A .ctl row becomes: search + count on top, every select in one grid underneath.
  function bar(c){
    if(c.dataset.fb)return;c.dataset.fb="1";c.classList.add("fb");
    const top=document.createElement("div");top.className="fbar";
    const g=grid();
    [...c.children].forEach(x=>{if(x.matches("select"))g.appendChild(x);else if(x.matches("input,.srch,label"))top.appendChild(x)});
    // The result count usually sits in a .res row just under the filters; bring it up beside the search.
    const sec=c.closest("section")||c.parentElement;const cnt=sec&&sec.querySelector(".res #count");
    if(cnt){const res=cnt.closest(".res");top.appendChild(cnt);if(res&&!res.textContent.trim()&&!res.children.length)res.hidden=true}
    if(top.children.length)c.appendChild(top);
    c.appendChild(g);c._g=g;
  }
  // Where a set of buttons' dropdowns go: the bar above it, its own .ctl2 grid, or a grid of its own.
  function target(c){
    const z=c.closest(".ctl2");
    if(z){const p=z.previousElementSibling;if(p&&p.matches(".ctl")){bar(p);return p._g}
      if(!z._g){z.classList.add("fz");z._g=grid();z.prepend(z._g);[...z.children].forEach(x=>{if(x.matches("select"))z._g.appendChild(x)})}
      return z._g}
    if(!c._g||!c._g.isConnected){c._g=grid();c.after(c._g)}
    return c._g;
  }
  const sortLast=g=>{const s=g&&g.querySelector(":scope>#sort");if(s&&s!==g.lastElementChild)g.appendChild(s)};

  function sync(c){
    const btns=[...c.children].filter(x=>x.tagName==="BUTTON");
    if(btns.length<2){if(c.classList.contains("to-sel"))c.classList.remove("to-sel");if(c._ps&&!c._ps.hidden)c._ps.hidden=true;return}
    const groups=new Map();
    btns.forEach(b=>{const k=keyOf(b);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(b)});
    const sig=[...groups].map(([k,g])=>k+":"+g.map(b=>label(b.textContent)+(isOn(b)?"*":"")+(b.disabled?"!":"")).join("|")).join("~");
    if(!c.classList.contains("to-sel"))c.classList.add("to-sel");
    if(!c._ps||!c._ps.isConnected){
      c._ps=document.createElement("div");c._ps.className="psels";c._ps._src=c;c._sig="";
      const g=target(c);g.appendChild(c._ps);sortLast(g);
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
  function run(){q=0;
    document.querySelectorAll(".ctl").forEach(bar);
    document.querySelectorAll(".ctl2").forEach(z=>{if(!z._g&&z.querySelector(":scope>select")){const p=z.previousElementSibling;if(!(p&&p.matches(".ctl"))){z.classList.add("fz");z._g=grid();z.prepend(z._g);[...z.children].forEach(x=>{if(x.matches("select"))z._g.appendChild(x)})}}});
    document.querySelectorAll(SEL).forEach(sync);
    document.querySelectorAll(".psels").forEach(p=>{const s=p._src;if(!s||!s.isConnected||!s.matches(SEL))p.remove()});
  }
  const later=()=>{if(!q)q=requestAnimationFrame(run)};
  const start=()=>{run();new MutationObserver(later).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","aria-pressed","disabled"]})};
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start):start();
})();

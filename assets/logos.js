/* Brand and club logos for the site.
   entities.json lists every brand and rights holder: name, official domain, optional local logo file.
   Logos come from Brandfetch (hotlinked, as their terms require) once "brandfetch" in entities.json holds a client ID.
   A local file in assets/logos/ always wins. Anything without a logo gets a monogram in its club colours. */
window.ParadeLogos=(function(){
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=x=>String(x||"").normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9()]+/g," ").trim();
  const slugify=x=>String(x||"").normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/\(.*?\)/g," ").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  let ENT={},LOOK={},LEAGUES=[],BF="",CLUBS=[];
  const okId=s=>/^[A-Za-z0-9_-]{4,64}$/.test(s);
  const okDomain=s=>/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s);
  const okFile=s=>/^assets\/logos\/[\w.-]+\.(png|svg|webp|jpg)$/i.test(s);

  function load(){
    const e=fetch("entities.json",{cache:"no-cache"}).then(r=>r.ok?r.json():{}).catch(()=>({}));
    const c=fetch("instagram/colours.json").then(r=>r.ok?r.json():{}).catch(()=>({}));
    return Promise.all([e,c]).then(([ej,cj])=>{
      ENT=ej.entities||{};LEAGUES=ej.leagues||[];BF=okId(String(ej.brandfetch||""))?ej.brandfetch:"";CLUBS=cj.teams||[];
      LOOK={};
      for(const [slug,x] of Object.entries(ENT)){
        LOOK[norm(x.name)]=slug;
        (x.aliases||[]).forEach(a=>{LOOK[norm(a)]=slug});
      }
    });
  }
  // A deal name is "Brand × Property". Returns the two sides.
  const split=deal=>{const p=String(deal||"").split(/\s+[×x]\s+/);return p.length>=2?[p[0].trim(),p.slice(1).join(" × ").trim()]:[String(deal||"").trim(),""]};
  function resolve(name){
    if(!name)return null;
    const slug=LOOK[norm(name)]||slugify(name);
    const x=ENT[slug]||{name};
    return {slug,name:x.name||name,domain:okDomain(String(x.domain||""))?x.domain:"",logo:okFile(String(x.logo||""))?x.logo:"",bf:Array.isArray(x.bf)?x.bf:null,aliases:x.aliases||[],cat:x.cat||"",ptype:x.ptype||"",parent:x.parent||"",short:x.short||"",ptiers:Array.isArray(x.ptiers)?x.ptiers:[]};
  }
  // One side of a deal can name several organisations: "Harvey Norman / Westpac / KFC".
  const many=name=>String(name||"").split(/\s+\/\s+/).map(s=>s.trim()).filter(Boolean).map(resolve);
  // Tags a deal with every organisation on each side (_bs/_ps), keeping _b/_p as the first of each.
  function tag(d){const [b,p]=split(d.deal);const bs=many(b),ps=p?many(p):[];return Object.assign(d,{_bs:bs,_ps:ps,_b:bs[0]||null,_p:ps[0]||null})}
  const has=(d,slug)=>[...(d._bs||[]),...(d._ps||[])].some(e=>e&&e.slug===slug);
  const byId=slug=>ENT[slug]?resolve(ENT[slug].name):null;
  // Club colours from instagram/colours.json, used for monograms.
  function colours(e){
    const names=[e.name,...(e.aliases||[])].map(n=>norm(n).replace(/\(.*?\)/g," ").replace(/\s+/g," ").trim());
    for(const t of CLUBS)for(const n of t.names||[])if(names.includes(norm(n)))return (t.colours||[]).filter(h=>/^#[0-9a-f]{6}$/i.test(h));
    return [];
  }
  const lum=h=>{const v=h.replace("#","").match(/../g).map(x=>{x=parseInt(x,16)/255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
  function initials(name){
    const skip=new Set(["fc","the","of","and","afc","cf","sc","club","f1","team"]);
    const w=String(name).replace(/\(.*?\)/g," ").split(/[\s\-\/·.]+/).filter(x=>x&&!skip.has(x.toLowerCase()));
    const t=(w.length>1?w[0][0]+w[1][0]:(w[0]||"?").slice(0,1));
    return t.toUpperCase();
  }
  // theme "dark" = the dark-coloured version, for light backgrounds ("light" is swapped in on .dk sections, see pump()).
  // No theme = whatever Brandfetch has. PNG, so the background stays transparent.
  function bfUrl(domain,type,px,theme){
    return `https://cdn.brandfetch.io/domain/${encodeURIComponent(domain)}/w/${px}/h/${px}${theme?`/theme/${theme}`:""}/fallback/404/type/${type}.png?c=${encodeURIComponent(BF)}`;
  }
  // big=true asks for the wide logo first (profile page header); small marks try the symbol, then the wide logo.
  // "icon" is Brandfetch's square social avatar, which sits on a coloured tile, so it is only ever the last resort.
  // Site favicons are not used: they are small, boxy and often outdated. With nothing usable the monogram shows.
  function mark(e,opts){
    opts=opts||{};
    if(!e)return "";
    const px=opts.px||96, big=!!opts.big;
    const cols=colours(e);
    let bg="",fg="";
    if(cols.length){const c=cols.find(h=>lum(h)<.9)||cols[0];bg=c;fg=lum(c)>.45?"#000":"#fff"}
    const mono=`<span class="mono"${bg?` style="background:${bg};color:${fg};border-color:${bg}"`:""} aria-hidden="true">${esc(initials(e.name))}</span>`;
    let src="",steps="";
    if(e.logo){src=e.logo}
    else if(BF&&e.domain){
      // e.bf lists the logo types Brandfetch is known to have (from the logo check), so most logos are one request.
      const order=(big?["logo","symbol"]:["symbol","logo"]).filter(t=>!e.bf||e.bf.includes(t));
      const urls=[...order.map(t=>bfUrl(e.domain,t,px*2,"dark")),...order.map(t=>bfUrl(e.domain,t,px*2,""))];
      if(!e.bf||e.bf.includes("icon"))urls.push(bfUrl(e.domain,"icon",px*2,""));
      if(urls.length){src=urls[0];steps=urls.slice(1).join(" ")}
    }
    // Images start without a src; the queue below loads them a few at a time as they come into view.
    const img=src?`<img data-src="${esc(src)}"${/^https:/.test(src)?' crossorigin="anonymous"':""} alt="" decoding="async" referrerpolicy="strict-origin-when-cross-origin"${steps?` data-next="${esc(steps)}"`:""} onload="ParadeLogos.ok(this)" onerror="ParadeLogos.fail(this)">`:"";
    queueSoon();
    return `<span class="lg${img?" has-img":""}${big?" lg-big":""}">${mono}${img}</span>`;
  }
  function fail(img,skip){
    // Retry once after a short pause first: a busy page can be briefly rate-limited.
    // Brandfetch rate-limits bursts (a page of 100 logos), so retry up to 3 times with growing, jittered waits.
    const n=+(img.dataset.retried||0),cur=img.src;
    // Drop the failed src straight away so the browser's broken-image icon never shows while we retry.
    img.removeAttribute("src");
    // A themed URL can fail simply because that brand has no dark/light version, so move straight on;
    // the un-themed URLs are types Brandfetch is known to have, so a failure there is most likely throttling.
    if(!skip&&n<3&&/brandfetch\.io/.test(cur)&&!/\/theme\//.test(cur)){img.dataset.retried=String(n+1);const u=cur.replace(/&r=\d+$/,"")+"&r="+(n+1);done(img);setTimeout(()=>{img.dataset.src=u;want(img)},(1500+Math.random()*2500)*(n+1));return}
    img.dataset.retried="0";
    const next=(img.dataset.next||"").split(" ").filter(Boolean);
    done(img);
    if(next.length){img.dataset.next=next.slice(1).join(" ");img.dataset.src=next[0];want(img);return}
    const box=img.parentElement;img.remove();if(box)box.classList.remove("has-img");
  }
  // Tiny images (blank placeholders, 16px favicons) look worse than a monogram, so treat them as missing.
  // The colour actually behind a logo (first ancestor with a solid background).
  function bgOf(el){
    for(;el&&el.nodeType===1;el=el.parentElement){
      const m=getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if(m&&(m.length<4||+m[3]>.5))return m.slice(0,3).map(Number);
    }
    return [255,255,255];
  }
  const onDark=img=>{const [r,g,b]=bgOf(img.parentElement);return (.2126*r+.7152*g+.0722*b)/255<.4};
  // A logo drawn in nearly the same colour as what's behind it (a white logo on a white card) is as good as missing.
  // Brandfetch and local files allow reading pixels; anything that can't be read is assumed fine.
  function visible(img){
    try{
      const w=40,h=Math.max(1,Math.round(40*img.naturalHeight/(img.naturalWidth||1)));
      const c=document.createElement("canvas");c.width=w;c.height=h;
      const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(img,0,0,w,h);
      const d=x.getImageData(0,0,w,h).data,bg=bgOf(img.parentElement);
      let ink=0,seen=0;
      for(let i=0;i<d.length;i+=4){if(d[i+3]<128)continue;ink++;if(Math.abs(d[i]-bg[0])+Math.abs(d[i+1]-bg[1])+Math.abs(d[i+2]-bg[2])>90)seen++}
      return !ink||seen/ink>.08;
    }catch(e){return true}
  }
  // Every logo sits in the same box. To look the same size, each one is scaled to cover about the same area
  // of that box: a square symbol nearly fills its height, a long wordmark runs the full width but stays short.
  const AREA=.45;
  function ok(img){
    if(img.naturalWidth&&img.naturalWidth<48&&img.naturalHeight<48){fail(img,true);return}
    if(!visible(img)){fail(img,true);return}
    const box=img.parentElement,r=img.naturalWidth/(img.naturalHeight||1);
    if(box&&r>0){
      box.classList.toggle("lg-ic",/\/type\/icon\./.test(img.src));
      const b=box.getBoundingClientRect(),B=b.width&&b.height?b.width/b.height:(box.classList.contains("lg-big")?1.4:1);
      img.style.width=(Math.min(1,Math.sqrt(AREA*r/B))*100).toFixed(1)+"%";
      img.style.height=(Math.min(1,Math.sqrt(AREA*B/r))*100).toFixed(1)+"%";
    }
    done(img)
  }
  // Load queue: Brandfetch's free CDN throttles bursts, so at most MAX logos are in flight at once,
  // and only ones on (or near) the screen are requested.
  const MAX=4;let busy=0;const waiting=[];const inflight=new Set();
  const io=("IntersectionObserver" in window)?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);want(e.target)}}),{rootMargin:"300px"}):null;
  function want(img){if(!img.isConnected||!img.dataset.src)return;waiting.push(img);pump()}
  function pump(){while(busy<MAX&&waiting.length){const img=waiting.shift();if(!img.isConnected||!img.dataset.src)continue;busy++;inflight.add(img);if(onDark(img)){const lt=u=>u.replace("/theme/dark/","/theme/light/");img.dataset.src=lt(img.dataset.src);if(img.dataset.next)img.dataset.next=img.dataset.next.split(" ").map(lt).join(" ")}img.src=img.dataset.src;img.removeAttribute("data-src")}}
  function done(img){if(inflight.delete(img)){busy--;setTimeout(pump,60)}}
  let qt=0;
  function queueSoon(){if(qt)return;qt=setTimeout(()=>{qt=0;document.querySelectorAll("img[data-src]:not([data-q])").forEach(img=>{img.dataset.q="1";io?io.observe(img):want(img)})},0)}
  // Pages render with innerHTML, so watch for new logos being added.
  if("MutationObserver" in window)new MutationObserver(queueSoon).observe(document.documentElement,{childList:true,subtree:true});
  // Every brand and property has its own page (tools/build_profiles.py); brand-new names fall back to profile.html.
  const page=slug=>{const x=ENT[slug];return x&&(x.k==="b"||x.k==="p")?`${x.k==="b"?"brands":"properties"}/${encodeURIComponent(slug)}`:`profile?id=${encodeURIComponent(slug)}`};
  // Logo pair for a deal: every brand, ×, every property.
  function pair(d,opts){
    const side=a=>(a||[]).map(e=>link(e,opts)).join("");
    return `<span class="pair">${side(d._bs)}<span class="xx" aria-hidden="true">×</span>${side(d._ps)}</span>`;
  }
  // Linked logo for a deal side.
  function link(e,opts){
    if(!e)return "";
    return `<a class="lga" href="${esc(page(e.slug))}" aria-label="${esc(e.name)}" title="${esc(e.name)}">${mark(e,opts)}</a>`;
  }
  return {load,split,resolve,many,tag,has,pair,ok,byId,mark,link,fail,page,esc,leagues:()=>LEAGUES,all:()=>ENT,
    /* for Pro pitch decks (assets/pro-decks.js), which draws logos onto <canvas> */
    colours,initials,bfUrl,bfId:()=>BF};
})();

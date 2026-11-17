/* deck.html: a shared pitch deck from Pro > Pitch decks > Shared.
   deck_meta() says which check the link needs: none, a password, or an email at the brand's domain (proved with
   a one-time code, same sign-in as Pro). open_deck() does the check, logs the view and returns the slides.
   Time on each slide goes back through deck_ping() every few seconds and when the page is hidden. */
(function(){
  const $=id=>document.getElementById(id);
  const C=window.SSS_SUPABASE||{};
  const id=new URLSearchParams(location.search).get("d")||"";
  const say=(t,p)=>{$("gT").textContent=t;$("gP").textContent=p||""};
  if(!C.url||!C.anonKey||!window.supabase){say("Link not available.","Share links aren't switched on yet.");return}
  if(!/^[0-9a-f-]{36}$/i.test(id)){say("Link not found.","Check the address and try again.");return}
  const sb=window.supabase.createClient(C.url,C.anonKey,{auth:{persistSession:true,storage:window.sessionStorage,flowType:"implicit"}});
  const SID=(()=>{try{let s=localStorage.getItem("sssDeckSid");if(!s){s=crypto.randomUUID();localStorage.setItem("sssDeckSid",s)}return s}catch(e){return crypto.randomUUID()}})();
  const err=t=>{$("gE").textContent=t||""};
  let meta=null,mode="",sentTo="";

  function form(m){
    mode=m;err("");$("gF").hidden=false;
    $("gEm").hidden=m!=="email";$("gC").hidden=m!=="code";$("gPw").hidden=m!=="pass";
    $("gB").textContent=m==="email"?"Send code":"Open";
    ({email:$("gEm"),code:$("gC"),pass:$("gPw")}[m]).focus();
  }
  async function open(pass){
    const tz=(Intl.DateTimeFormat().resolvedOptions().timeZone)||"";
    const {data,error}=await sb.rpc("open_deck",{p_id:id,p_pass:pass||null,p_session:SID,p_tz:tz,p_lang:navigator.language||""});
    if(error){err("Couldn't open the deck. Try again.");return false}
    if(!data){say("This link has expired.","Ask the person who sent it for a new one.");$("gF").hidden=true;return false}
    if(data.error==="password"){err(pass?"That password isn't right.":"");form("pass");return false}
    if(data.error==="domain"){err(sentTo?`${sentTo} can't open this deck. Use your email at ${meta.domains.join(" or ")}.`:"");await sb.auth.signOut();form("email");return false}
    show(data);return true;
  }
  $("gF").onsubmit=async e=>{
    e.preventDefault();err("");const b=$("gB");b.disabled=true;
    try{
      if(mode==="pass"){await open($("gPw").value)}
      else if(mode==="email"){
        const em=$("gEm").value.trim().toLowerCase();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){err("Enter a valid email.");return}
        if(!meta.domains.includes(em.split("@")[1])){err(`This deck is for emails at ${meta.domains.join(" or ")}.`);return}
        const {error}=await sb.auth.signInWithOtp({email:em,options:{shouldCreateUser:true,emailRedirectTo:location.href}});
        if(error){err(/rate|security purposes/i.test(error.message)?"Too many codes requested. Wait a minute and try again.":error.message);return}
        sentTo=em;$("gP").textContent=`We've emailed a code to ${em}. Enter it below.`;form("code");
      }else if(mode==="code"){
        const token=$("gC").value.replace(/\s/g,"");
        const {error}=await sb.auth.verifyOtp({email:sentTo,token,type:"email"});
        if(error){err("That code is wrong or has expired.");return}
        await open();
      }
    }finally{b.disabled=false}
  };

  /* ---------- the deck ---------- */
  let slides=[],cur=0,view=null,since=0,pend=new Map(),seen=new Set();
  const url=p=>sb.storage.from("decks").getPublicUrl(p).data.publicUrl;
  function show(d){
    view=d.view;slides=d.slides||[];document.title=d.title;
    $("gate").hidden=true;$("view").classList.add("on");$("vT").textContent=d.title;
    $("vD").innerHTML=slides.map((s,i)=>`<i data-i="${i}" title="${i+1}"></i>`).join("");
    slides.forEach(s=>{const im=new Image();im.src=url(s.img)});
    go(0);
    setInterval(flush,5000);
    addEventListener("pagehide",()=>flush(true));
    document.addEventListener("visibilitychange",()=>{if(document.hidden)flush(true);else since=performance.now()});
  }
  function tally(){if(since&&!document.hidden){const ms=performance.now()-since;pend.set(cur,(pend.get(cur)||0)+ms)}since=performance.now()}
  function go(i){
    tally();cur=Math.max(0,Math.min(slides.length-1,i));const s=slides[cur];
    $("vS").innerHTML=s.video?`<video src="${url(s.video)}" poster="${url(s.img)}" autoplay muted playsinline loop controls></video>`:`<img src="${url(s.img)}" alt="${(s.title||"").replace(/"/g,"&quot;")}">`;
    $("vN").textContent=`${cur+1} / ${slides.length}`;
    $("vD").querySelectorAll("i").forEach((x,j)=>x.classList.toggle("on",j===cur));
    if(!seen.has(cur)){seen.add(cur);ping(cur,0,true)}
  }
  function ping(slide,ms,visit,keep){
    if(!view)return;
    // fetch with keepalive so the last few seconds still land when the tab closes
    return fetch(`${C.url}/rest/v1/rpc/deck_ping`,{method:"POST",keepalive:!!keep,headers:{"Content-Type":"application/json",apikey:C.anonKey,Authorization:`Bearer ${C.anonKey}`},
      body:JSON.stringify({p_view:view,p_slide:slide+1,p_ms:Math.round(ms),p_visit:!!visit})}).catch(()=>{});
  }
  function flush(keep){tally();pend.forEach((ms,s)=>{if(ms>=300)ping(s,ms,false,keep)});pend.clear()}
  $("vPrev").onclick=()=>go(cur-1);$("vNext").onclick=()=>go(cur+1);
  $("vD").onclick=e=>{const i=e.target.dataset.i;if(i!=null)go(+i)};
  addEventListener("keydown",e=>{if(!slides.length)return;if(["ArrowRight","PageDown"," "].includes(e.key)){e.preventDefault();go(cur+1)}if(["ArrowLeft","PageUp"].includes(e.key)){e.preventDefault();go(cur-1)}});
  let tx=null;$("vS").addEventListener("touchstart",e=>{tx=e.touches[0].clientX},{passive:true});
  $("vS").addEventListener("touchend",e=>{if(tx==null)return;const dx=e.changedTouches[0].clientX-tx;if(Math.abs(dx)>40)go(cur+(dx<0?1:-1));tx=null});

  /* ---------- start ---------- */
  (async()=>{
    const {data,error}=await sb.rpc("deck_meta",{p_id:id});
    if(error){say("Couldn't load the deck.","Refresh to try again.");return}
    if(!data){say("This link has expired.","Ask the person who sent it for a new one.");return}
    meta=data;$("gK").textContent=[data.property,data.brand].filter(Boolean).join(" x ")||"Partnership deck";say(data.title,"");
    if(data.protect==="none"){await open();return}
    if(data.protect==="password"){$("gP").textContent="Enter the password you were sent.";form("pass");return}
    const {data:s}=await sb.auth.getSession();
    if(s.session){if(await open())return}
    $("gP").textContent=`This deck is for ${data.domains.map(d=>"@"+d).join(" or ")} emails. Enter yours and we'll send a code.`;form("email");
  })();
})();

/* Pro sign-in (pro.html).
   With Supabase set up (assets/pro-config.js filled in):
     - members enter their email, get a one-time code by email, and type it in (no passwords)
     - access = an active row in pro_members (supabase/schema.sql), checked by is_pro(); anyone can request a
       code, but only listed emails get past the check
     - Pro-only files (matches.json, audit.json) download from the private "pro" bucket
     - everything Pro keeps in localStorage under "sssPro." (watchlist, notes, report options, match feedback)
       is synced to the member's pro_state row, so it follows them to any device
     - the session lasts until the tab or browser closes (sessionStorage), so Pro asks again each visit
   Without Supabase set up: the old single password, and Pro reads pro/*.json from the site as before.
   Once signed in, it exposes window.SSSPro.json(name) for pro.js, then loads the app scripts. */
(function(){
  const $=id=>document.getElementById(id);
  const C=window.SSS_SUPABASE||{};
  const LIVE=!!(C.url&&C.anonKey&&window.supabase);
  const APP=["assets/logos.js?v=11","assets/pills.js?v=3","assets/data.js?v=8","assets/pro-decks.js?v=3","assets/pro.js?v=23"];
  const err=t=>{$("gateE").textContent=t||""};
  const msg=t=>{$("gateMsg").textContent=t};

  function loadScripts(list){
    return list.reduce((p,src)=>p.then(()=>new Promise((res,rej)=>{
      const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("Couldn't load "+src));document.body.appendChild(s);
    })),Promise.resolve());
  }
  let started=false;
  function start(who,signOut){
    if(started)return;started=true;
    document.documentElement.classList.remove("locked");window.scrollTo(0,0);
    if(who){
      const hero=document.querySelector(".hero");
      if(hero){const d=document.createElement("p");d.className="pro-who";
        d.innerHTML=`Signed in as <b></b> · <button type="button">Sign out</button>`;
        d.querySelector("b").textContent=who;d.querySelector("button").onclick=signOut;hero.appendChild(d)}
    }
    loadScripts(APP).catch(e=>{console.error(e);$("view").innerHTML=`<p class="note">Couldn't load Pro. Refresh to try again.</p>`});
  }

  /* ---------- Fallback: the old single password, until Supabase is set up ---------- */
  if(!LIVE){
    const K="4d533574c6b65069bd3124a0cfce762b3431575350c337a1f2749fa25d4e4f34";
    const hex=b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
    $("gateEm").hidden=true;$("gateC").hidden=true;msg("Enter the password to open the partnerships desk.");$("gateB").textContent="Enter";
    window.SSSPro={json:name=>fetch("pro/"+name,{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error(name);return r.json()})};
    $("gateF").onsubmit=e=>{e.preventDefault();
      const v=$("gateP").value.trim().toLowerCase();
      crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)).then(b=>{
        if(hex(b)===K)start();else{err("Wrong password. Try again.");$("gateP").select()}});
    };
    $("gateP").focus();
    return;
  }

  /* ---------- Supabase ---------- */
  const sb=window.supabase.createClient(C.url,C.anonKey,{auth:{persistSession:true,storage:window.sessionStorage,detectSessionInUrl:true,flowType:"implicit"}});
  let mode="email",sentTo="";

  function view(m){
    mode=m;err("");
    const em=$("gateEm"),code=$("gateC"),b=$("gateB"),back=$("gateBack");
    $("gateP").hidden=true;
    if(m==="email"){msg("Enter your email and we'll send you a sign-in code.");em.hidden=false;code.hidden=true;b.textContent="Send code";back.hidden=true;em.focus()}
    if(m==="code"){msg(`We've emailed a code to ${sentTo}. Enter it below.`);em.hidden=true;code.hidden=false;code.value="";b.textContent="Sign in";back.hidden=false;code.focus()}
  }
  $("gateBack").onclick=()=>view("email");

  $("gateF").onsubmit=async e=>{
    e.preventDefault();err("");const b=$("gateB");b.disabled=true;
    try{
      if(mode==="email"){
        const email=$("gateEm").value.trim().toLowerCase();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err("Enter a valid email.");return}
        const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname}});
        if(error){err(/rate|security purposes/i.test(error.message)?"Too many codes requested. Wait a minute and try again.":error.message);return}
        sentTo=email;view("code");
      }else{
        const token=$("gateC").value.replace(/\s/g,"");
        if(!/^\d{6,10}$/.test(token)){err("Enter the code from the email.");return}
        const {data,error}=await sb.auth.verifyOtp({email:sentTo,token,type:"email"});
        if(error){err(/expired|invalid/i.test(error.message)?"That code is wrong or has expired. Check it, or go back and send a new one.":error.message);return}
        await enter(data.session);
      }
    }finally{b.disabled=false}
  };

  async function enter(session){
    if(!session){view("email");return}
    const {data:ok,error}=await sb.rpc("is_pro");
    if(error||!ok){
      await sb.auth.signOut();view("email");
      err(error?"Couldn't check your access. Try again.":"This account doesn't have Pro access yet.");return;
    }
    window.SSSPro={sb,user:session.user,json:name=>sb.storage.from("pro").download(name).then(({data,error})=>{if(error)throw error;return data.text()}).then(t=>JSON.parse(t))};
    await syncState(session.user.id);
    start(session.user.email,async()=>{await flush();await sb.auth.signOut();location.reload()});
  }

  /* ---------- Saved state sync (localStorage "sssPro.*" <-> pro_state) ---------- */
  const PFX="sssPro.";let uid=null,timer=null,busy=false;
  const localState=()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(PFX))o[k]=localStorage.getItem(k)}return o};
  async function push(){
    if(!uid)return;busy=true;
    try{await sb.from("pro_state").upsert({user_id:uid,data:localState(),updated_at:new Date().toISOString()})}
    catch(e){console.error(e)}finally{busy=false}
  }
  const queue=()=>{clearTimeout(timer);timer=setTimeout(push,1500)};
  const flush=()=>{if(timer){clearTimeout(timer);timer=null;return push()}return Promise.resolve()};
  async function syncState(id){
    uid=id;
    try{
      const {data}=await sb.from("pro_state").select("data").eq("user_id",id).maybeSingle();
      const remote=(data&&data.data)||{};
      if(Object.keys(remote).length){
        Object.keys(localState()).forEach(k=>{if(!(k in remote))localStorage.removeItem(k)});
        Object.entries(remote).forEach(([k,v])=>localStorage.setItem(k,v));
      }else if(Object.keys(localState()).length){await push()} // first sign-in: keep what this browser already had
    }catch(e){console.error(e)}
    const set=Storage.prototype.setItem,del=Storage.prototype.removeItem;
    Storage.prototype.setItem=function(k,v){set.call(this,k,v);if(this===localStorage&&String(k).startsWith(PFX))queue()};
    Storage.prototype.removeItem=function(k){del.call(this,k);if(this===localStorage&&String(k).startsWith(PFX))queue()};
    addEventListener("pagehide",()=>{if(timer)push()});
  }

  /* ---------- Start ---------- */
  // A session already in this tab (or from clicking the link in the email instead of typing the code) goes straight in.
  sb.auth.getSession().then(({data})=>{
    if(location.hash.includes("access_token"))history.replaceState(null,"",location.pathname+location.search);
    if(data.session)enter(data.session);else view("email");
  });
})();

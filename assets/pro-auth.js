/* Partnership Pro sign-in (pro.html).
   With Supabase set up (assets/pro-config.js filled in):
     - members sign in with email + password; invites and password resets land back here to set a password
     - access = an active row in pro_members (supabase/schema.sql), checked by is_pro()
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
  const APP=["assets/logos.js?v=9","assets/pills.js?v=2","assets/data.js?v=4","assets/pro.js?v=14"];
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
    $("gateEm").hidden=true;msg("Enter the password to open the partnerships desk.");$("gateB").textContent="Enter";
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
  const hashType=(new URLSearchParams(location.hash.slice(1))).get("type");
  let mode=(hashType==="invite"||hashType==="recovery")?"setpw":"signin";

  function view(m){
    mode=m;err("");
    const em=$("gateEm"),pw=$("gateP"),b=$("gateB"),f=$("gateForgot");
    if(m==="signin"){msg("Sign in to open the partnerships desk.");em.hidden=false;pw.hidden=false;pw.placeholder="Password";pw.autocomplete="current-password";b.textContent="Sign in";f.hidden=false;f.textContent="Forgot your password?"}
    if(m==="forgot"){msg("We'll email you a link to set a new password.");em.hidden=false;pw.hidden=true;b.textContent="Send link";f.hidden=false;f.textContent="Back to sign in"}
    if(m==="setpw"){msg("Choose a password for Partnership Pro (8+ characters).");em.hidden=true;pw.hidden=false;pw.value="";pw.placeholder="New password";pw.autocomplete="new-password";b.textContent="Save password";f.hidden=true}
    (m==="setpw"?pw:em).focus();
  }
  $("gateForgot").onclick=()=>view(mode==="forgot"?"signin":"forgot");

  $("gateF").onsubmit=async e=>{
    e.preventDefault();err("");const b=$("gateB");b.disabled=true;
    try{
      const email=$("gateEm").value.trim(),password=$("gateP").value;
      if(mode==="signin"){
        const {data,error}=await sb.auth.signInWithPassword({email,password});
        if(error){err(error.message==="Invalid login credentials"?"Wrong email or password.":error.message);return}
        await enter(data.session);
      }else if(mode==="forgot"){
        if(!email){err("Enter your email.");return}
        const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
        if(error){err(error.message);return}
        msg("Check your inbox for a link to set your password.");
      }else if(mode==="setpw"){
        if(password.length<8){err("Use at least 8 characters.");return}
        const {error}=await sb.auth.updateUser({password});
        if(error){err(error.message);return}
        history.replaceState(null,"",location.pathname+location.search);
        const {data}=await sb.auth.getSession();
        await enter(data.session);
      }
    }finally{b.disabled=false}
  };

  async function enter(session){
    if(!session){view("signin");return}
    const {data:ok,error}=await sb.rpc("is_pro");
    if(error||!ok){
      await sb.auth.signOut();view("signin");
      err(error?"Couldn't check your access. Try again.":"This account doesn't have Partnership Pro yet.");return;
    }
    window.SSSPro={json:name=>sb.storage.from("pro").download(name).then(({data,error})=>{if(error)throw error;return data.text()}).then(t=>JSON.parse(t))};
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
  sb.auth.getSession().then(({data})=>{
    if(mode==="setpw"&&data.session)view("setpw");
    else if(data.session)enter(data.session);
    else view("signin");
  });
})();

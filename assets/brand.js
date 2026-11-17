/* Brand switch. One place to flip the site from Sport Sport Sport to Parade Sport.
   Keep ACTIVE as "sss" until the trade mark search is done, then change it to "parade".
   Preview the new name locally with ?brand=parade on any page that loads this file.
   Anything with data-brand="name|short|platform|tagline|signoff" gets its text from here;
   .brand-logo holds the header and footer wordmark. */
(function(){
  var ACTIVE="sss";
  var BRANDS={
    sss:{name:"Sport Sport Sport",short:"SSS",platform:"Pro",domain:"sportsportsport.com.au",
      tagline:"Every partnership in ANZ sport. Dated, sourced, live.",signoff:"Who backs who in sport.",
      logo:'<img src="assets/wordmark-black.svg" alt="Sport Sport Sport" width="56" height="42">'},
    parade:{name:"Parade Sport",short:"Parade",platform:"Pro",domain:"paradesport.com.au",
      tagline:"Every partnership in ANZ sport. Dated, sourced, live.",signoff:"Who backs who in sport.",
      logo:'<span class="wm-parade" aria-label="Parade Sport">Parade<span>Sport</span></span>'}
  };
  try{var q=new URLSearchParams(location.search).get("brand");if(q&&BRANDS[q])ACTIVE=q}catch(e){}
  var B=BRANDS[ACTIVE];
  window.SSSBrand=B;
  function apply(){
    document.documentElement.setAttribute("data-brand-mode",ACTIVE);
    document.querySelectorAll("[data-brand]").forEach(function(el){var k=el.getAttribute("data-brand");if(B[k])el.textContent=B[k]});
    document.querySelectorAll(".brand-logo").forEach(function(el){el.innerHTML=B.logo;el.setAttribute("aria-label",B.name+" home")});
    if(document.title.indexOf("Sport Sport Sport")>-1)document.title=document.title.replace("Sport Sport Sport",B.name);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply);else apply();
})();

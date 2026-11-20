/* Brand. The site is Parade.
   Anything with data-brand="name|short|platform|tagline|signoff" gets its text from here;
   .brand-logo holds the header and footer wordmark. */
(function(){
  var ACTIVE="parade";
  var BRANDS={
    parade:{name:"Parade",short:"Parade",platform:"Partnership Pro",domain:"sportsportsport.com.au",
      tagline:"Every partnership in sport. Dated, sourced, live.",signoff:"Who backs who in sport.",
      logo:'<img src="assets/wordmark-black.svg" alt="Parade" width="136" height="24">'}
  };
  try{var q=new URLSearchParams(location.search).get("brand");if(q&&BRANDS[q])ACTIVE=q}catch(e){}
  var B=BRANDS[ACTIVE];
  window.ParadeBrand=B;
  function apply(){
    document.documentElement.setAttribute("data-brand-mode",ACTIVE);
    document.querySelectorAll("[data-brand]").forEach(function(el){var k=el.getAttribute("data-brand");if(B[k])el.textContent=B[k]});
    document.querySelectorAll(".brand-logo").forEach(function(el){el.innerHTML=B.logo;el.setAttribute("aria-label",B.name+" home")});
    
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply);else apply();
})();

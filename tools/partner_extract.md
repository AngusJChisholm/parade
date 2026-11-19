# Chrome snippets for partner checks

Run with javascript_tool, then get_page_text (the snippet writes its output into the page body, because
javascript_tool output is cut at about 1000 characters). Reload the page before running a second snippet.
Strip query strings from URLs in output, or the extension blocks the result.

## 1. Partner section on any page (headings + logos after the first "partner/sponsor" heading)
Best first try on a club homepage or partners page. Uses img alt, else the file name, plus the link host.

```js
window.scrollTo(0,document.body.scrollHeight);await new Promise(r=>setTimeout(r,2500));
const out=[location.href,...[...document.querySelectorAll('a')].filter(a=>/partner|sponsor|partenai/i.test(a.pathname)).map(a=>'LINK '+a.host+a.pathname).slice(0,4)];
let on=false;const w=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT);let n;
while(n=w.nextNode()){if(n.children.length==0&&/partner|sponsor|partenai/i.test(n.innerText||'')&&(n.innerText||'').length<50){on=true;out.push('## '+n.innerText.trim())}
else if(on&&n.tagName=='IMG'){const a=n.closest('a');out.push('- '+(n.alt||a?.title||'')+' | '+(n.currentSrc||n.src||'').split('/').pop().split('?')[0].slice(0,40)+' | '+(a?a.host.replace('www.',''):''))}}
const p=document.createElement('pre');p.textContent=out.join('\n');document.body.innerHTML='';document.body.appendChild(p);out.length
```

## 2. Whole main content (headings + every logo), for a dedicated partners page
```js
for(let y=0;y<document.body.scrollHeight;y+=900){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,200))};
const root=document.querySelector('main')||document.body;const out=[location.href];const w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT);let n;
while(n=w.nextNode()){if(n.closest('header,footer,nav'))continue;
if(n.tagName=='IMG'||n.tagName=='svg'&&n.closest('a')){const a=n.closest('a');let h='';try{h=a?new URL(a.href).host.replace('www.','')+new URL(a.href).pathname.slice(0,40):''}catch(e){}
out.push('- '+(n.getAttribute('alt')||a?.getAttribute('aria-label')||a?.title||'')+' | '+h)}else if(/^H[1-6]$/.test(n.tagName)){out.push('## '+n.innerText.trim().slice(0,60))}}
const p=document.createElement('pre');p.textContent=out.join('\n');document.body.innerHTML='';document.body.appendChild(p);out.length
```

## 3. Partner pages built from per-partner links (e.g. /partners/<slug>)
```js
const t=[...new Set([...document.querySelectorAll('a')].map(a=>a.pathname).filter(p=>/^\/partners\/./.test(p)).map(p=>p.split('/').pop()))].join(' ');
const p=document.createElement('pre');p.textContent=t;document.body.innerHTML='';document.body.appendChild(p);1
```

If logos have no alt text or useful file names, scroll the section into view, set `document.body.style.zoom=0.6`
and read the names off a screenshot (computer zoom). If JavaScript is refused on a domain, `find` + `read_page`
on the "Partners" link still gives the URL, and `get_page_text` works when names are text.

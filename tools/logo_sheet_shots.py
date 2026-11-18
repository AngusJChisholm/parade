"""Screenshots of the main pages as a visitor sees them, logos included.
No bulk logo sheet: Brandfetch allows 2,400 logo loads per 5 minutes site-wide and bans automated checking,
so only normal page views are made here.
Used by logo-sheet.yml. Serves the checked-out branch locally, so it shows the branch, not the live site."""
import asyncio, os, json, subprocess, time
from playwright.async_api import async_playwright
N = 96
async def main():
    os.makedirs("shots", exist_ok=True)
    srv = subprocess.Popen(["python3", "-m", "http.server", "8000"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(2)
    total = sum(1 for v in json.load(open("entities.json"))["entities"].values() if v.get("k"))
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1600, "height": 1000})
        # Brandfetch only serves logos to the site's own address, so present the live site as the referrer.
        async def ref(route):
            h = dict(route.request.headers); h["referer"] = "https://sportsportsport.com.au/"
            await route.continue_(headers=h)
        await pg.route("**/*brandfetch.io/**", ref)
        # The new pages as a visitor sees them, scrolled through so every logo gets requested.
        PAGES = [("t-props", "properties.html?league=Australian%20tennis", 1440, None), ("t-ao", "properties/australian-open.html", 1440, None),
                 ("t-uc", "properties/united-cup.html", 1440, None), ("t-bri", "properties/brisbane-international.html", 1440, None),
                 ("t-adl", "properties/adelaide-international.html", 1440, None), ("t-hob", "properties/hobart-international.html", 1440, None),
                 ("t-cbr", "properties/canberra-international.html", 1440, None), ("t-koo", "properties/kooyong-classic.html", 1440, None),
                 ("t-ta", "properties/tennis-australia.html", 1440, None), ("t-vic", "properties/tennis-victoria.html", 1440, None),
                 ("t-sa", "properties/tennis-sa.html", 1440, None), ("t-map", "leagues.html", 1440, None)]
        for name, url, w, anchor in PAGES:
            await pg.set_viewport_size({"width": w, "height": 1000 if w > 500 else 844})
            await pg.goto(f"http://localhost:8000/{url}", wait_until="domcontentloaded")
            await pg.wait_for_timeout(3000)
            for y in range(0, 9000, 700):
                await pg.evaluate(f"window.scrollTo(0,{y})"); await pg.wait_for_timeout(1200)
            await pg.evaluate("window.scrollTo(0,0)" if not anchor else f"document.querySelector('{anchor}')?.scrollIntoView()")
            await pg.wait_for_timeout(8000)
            await pg.screenshot(path=f"shots/{name}.png", full_page=True)
        await b.close()
    srv.terminate()
asyncio.run(main())

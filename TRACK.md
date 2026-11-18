# Track dates playbook (daily)

The daily "SSS Track dates" task follows this file. Each run researches up to 100 partnerships from the queue and
fills in when each one was signed, how long it runs, when it ends and what the partner gets. Work through every step
without waiting for input.

## Standing rules

**No approval prompts.** Only WebFetch a URL that came back in a WebSearch or WebFetch result in this run. Never type,
guess or build a URL. If a fetch is refused, skip it and use another source. Never use a browser or computer-use tool.
Give any subagent this same rule.

**Accuracy beats coverage.** A blank field beats a guessed one.
- Sources, in order: the property's own release (club, league, event, governing body), the brand's own release, then
  reputable press (SportsPro, SportBusiness, Sportcal, The Athletic, AFR, The Australian, SMH/The Age, B&T, Mumbrella,
  mi-3, Ministry of Sport, Reuters, Bloomberg). One official source is enough. Press alone: mark it reported.
- Never use Scout, Scout Sponsor Pro or any paid database as a source, and never copy their wording.
- Fan sites, forums, Wikipedia and shop pages are leads only, never the source.
- The date is the day the current agreement was announced (the latest renewal or extension, not the first ever
  signing). If only the month is known, use "month". If the release only gives a year, leave it blank.
- End year only when a source states it ("until the end of 2028") or states a term from a known announcement year
  ("three-year extension" announced 2026 = 2029). Never estimate one; tools/track.py adds the league estimate.
- If the release shows the partnership has ended, or the brand has been replaced, set "ended" (the last year) and
  "endedUrl". Never delete a row.
- Rights: what the partner actually gets (front of jersey, sleeve, back, shorts, naming rights to X, official
  category). The club's own label (Platinum, Gold) is not a right.
- Australian spelling. Write summaries in your own words. Say "partnership", never "deal", in anything people read.

## Steps

1. **Repo.** Attach AngusJChisholm/sport-sport-sport with push access (add_repo), then
   `git clone --depth 1 https://github.com/AngusJChisholm/sport-sport-sport`. Read README.md, SOURCES.md and this file.
   Never change CNAME, netlify.toml or _redirects.

2. **Queue.** Run `python3 tools/track_queue.py --stats`, then `python3 tools/track_queue.py 100`. Work the list in
   order. Group 1 rows (end year passed but not marked ended) come first: find out whether each renewed (add the new
   announcement as a new row, keep the old one) or ended (set "ended").

3. **Research.** For each partnership, search for the official announcement of the current agreement. Use parallel
   batches of searches. Spend at most 3 searches on one partnership; if nothing official or reputable turns up, set
   `"datesTried": "<today>"` on the row and move on (the queue skips it for 90 days).

4. **Write to deals.json** (edit the existing row, matched on its exact "deal" string; never create a duplicate):
   - `"date": "YYYY-MM-DD"` (or `"month": "YYYY-MM"`), `"url"`: the source, `"summary"`: one plain line on what the
     current agreement is, in your own words.
   - `"term"`: years, only if stated. `"ends"`: only if stated or worked out from a stated term, with
     `"endsLock": true` and `"endsSrc"`: the URL.
   - If the source names the rights, also add a record to `data/track_rights.json` (format in its `_help`), with
     `"status": "verified"` for an official source or `"reported"` for press.
   - Leave `"listed"` in place; `tools/enrich.py` updates the status once a date is set.

5. **Accuracy gate (mandatory).** Before committing, write a fact sheet of every date, end year and right you are
   about to write, each with its URL. Launch one independent verification subagent (Agent tool, model "sonnet") with
   only the fact sheet and the no-approval rule. It re-opens each source and marks every line PASS or FAIL (right brand
   and property, right date, end year actually stated, still current). Remove anything that fails.

6. **Rebuild and check.** Run `python3 tools/enrich.py`, `python3 tools/track.py`, then
   `python3 tools/validate.py` (must show 0 errors) and `python3 tools/track_queue.py --stats`.

7. **Publish.** Commit deals.json and data/track_rights.json as Angus:
   `git -c user.name="Angus Chisholm" -c user.email="AngusJChisholm@users.noreply.github.com" commit -m "Track dates for <date>"`,
   then `git fetch origin main`, rebase, push to main. If deals.json conflicts, take origin's file and re-apply your
   edits with a script, never by hand-merging.

8. **Report** (SendUserMessage), short, Australian voice:
   - Partnerships researched, dates found, end years found, rights found, ended partners found.
   - Accuracy check: X facts checked, Y passed, Z cut.
   - Queue left, by group.
   - Anything notable: a big partner ending, a front-of-jersey change, a partner missing from the database.

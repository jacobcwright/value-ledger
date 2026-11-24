#!/usr/bin/env node
// Edition refresh helper. For every SEC filer, finds the latest annual report (10-K / 20-F / 40-F),
// the latest proxy (DEF 14A) and the latest 10-Q, and, for every stored figure that carries an `xbrl`
// object, looks up the same concept at the new fiscal year end. Writes research/refresh-prefill/<id>.json.
// These are leads for researchers, never figures: each value still needs its verbatim line from the filing.
// Run through zsh so SEC_USER_AGENT is set: zsh -c 'node scripts/refresh-prefill.mjs [ids...]'
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const UA = process.env.SEC_USER_AGENT;
if (!UA) { console.error("SEC_USER_AGENT is not set; run through zsh -c"); process.exit(1); }
const outDir = path.join(root, "research/refresh-prefill");
fs.mkdirSync(outDir, {recursive: true});
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function sec(url) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, {headers: {"User-Agent": UA, "Accept-Encoding": "gzip"}});
    await sleep(350);
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    await sleep(2000 * (i + 1));
  }
  throw new Error("SEC fetch failed: " + url);
}

const leaderFiles = id => [
  ["records", `research/records/${id}.json`],
  ...["paidout", "fiscal", "ecosystem", "owners"].map(l => [l, `research/lenses/${l}/${id}.json`]),
].filter(([, f]) => fs.existsSync(path.join(root, f)));

function xbrlSources(node, trail, acc) {
  if (Array.isArray(node)) node.forEach((n, i) => xbrlSources(n, `${trail}[${i}]`, acc));
  else if (node && typeof node === "object") {
    if (node.xbrl?.concept && node.xbrl?.cik) acc.push({path: trail, xbrl: node.xbrl, label: node.label || null});
    for (const [k, v] of Object.entries(node)) if (k !== "xbrl") xbrlSources(v, trail ? `${trail}.${k}` : k, acc);
  }
  return acc;
}

const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;
const ids = process.argv.slice(2).length ? process.argv.slice(2)
  : [...new Set(fs.readdirSync(path.join(root, "research/lenses/paidout")).filter(f => f.endsWith(".json") && !f.startsWith("_")).map(f => f.replace(".json", "")))];

const summary = [];
for (const id of ids) {
  const files = leaderFiles(id).map(([lens, f]) => [lens, f, JSON.parse(fs.readFileSync(path.join(root, f), "utf8"))]);
  const sources = files.flatMap(([lens, f, j]) => xbrlSources(j, "", []).map(s => ({lens, file: f, ...s})));
  const cik = sources[0]?.xbrl.cik || files.map(([, , j]) => JSON.stringify(j).match(/data\/(\d{3,10})\//)?.[1]).find(Boolean);
  if (!cik) { summary.push(`${id}: no SEC CIK (non-SEC filer)`); continue; }
  const cik10 = String(cik).padStart(10, "0");
  const subs = await sec(`https://data.sec.gov/submissions/CIK${cik10}.json`);
  if (!subs) { summary.push(`${id}: submissions not found for CIK ${cik10}`); continue; }
  const r = subs.filings.recent;
  const doc = i => ({form: r.form[i], reportDate: r.reportDate[i], filed: r.filingDate[i], accession: r.accessionNumber[i],
    url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${r.accessionNumber[i].replace(/-/g, "")}/${r.primaryDocument[i]}`,
    index: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${r.accessionNumber[i].replace(/-/g, "")}/`});
  const first = forms => { const i = r.form.findIndex(f => forms.includes(f)); return i < 0 ? null : doc(i); };
  const annual = first(["10-K", "20-F", "40-F", "10-K/A"]);
  const proxy = first(["DEF 14A"]);
  const quarterly = first(["10-Q"]);
  const sixK = r.form.map((f, i) => f === "6-K" ? doc(i) : null).filter(Boolean).slice(0, 8);
  const newEnd = annual?.reportDate;

  const facts = await sec(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`);
  const leads = sources.map(s => {
    const [tax, concept] = s.xbrl.concept.split(":");
    const fact = facts?.facts?.[tax]?.[concept];
    if (!fact) return {...s, status: "concept-not-found"};
    let unit = Object.keys(fact.units).find(u => fact.units[u].some(x => x.end === s.xbrl.end && Number(x.val) === Number(s.xbrl.value))) || Object.keys(fact.units)[0];
    const old = fact.units[unit].find(x => x.end === s.xbrl.end && Number(x.val) === Number(s.xbrl.value));
    const isDuration = old ? !!old.start : fact.units[unit].some(x => x.start);
    const oldSpan = old?.start ? days(old.start, old.end) : 365;
    const cands = fact.units[unit].filter(x => x.end === newEnd && (!isDuration || (x.start && Math.abs(days(x.start, x.end) - oldSpan) < 40)))
      .filter(x => ["10-K", "20-F", "40-F", "10-K/A", "20-F/A"].includes(x.form))
      .sort((a, b) => b.filed.localeCompare(a.filed));
    const hit = cands[0];
    return {lens: s.lens, file: s.file, path: s.path, concept: s.xbrl.concept, unit,
      old: {end: s.xbrl.end, value: s.xbrl.value},
      new: hit ? {end: hit.end, start: hit.start || null, value: hit.val, form: hit.form, filed: hit.filed, accession: hit.accn} : null,
      status: hit ? "found" : "not-found-at-new-end"};
  });
  const out = {id, cik: cik10, entity: subs.name, fiscalYearEnd: subs.fiscalYearEnd, annual, proxy, quarterly, recent6K: annual?.form === "20-F" ? sixK : undefined,
    note: "Leads only. Every value still needs its verbatim line from the human-readable filing (annual.url), and the units must be checked.", leads};
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(out, null, 1));
  const found = leads.filter(l => l.status === "found").length;
  summary.push(`${id}: ${annual?.form} ${annual?.reportDate}  proxy ${proxy?.filed || "-"}  leads ${found}/${leads.length}`);
  process.stdout.write(summary.at(-1) + "\n");
}
fs.writeFileSync(path.join(outDir, "_summary.txt"), summary.join("\n") + "\n");

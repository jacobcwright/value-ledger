#!/usr/bin/env node
// Edition refresh helper for the owners lens: finds each company's row in a newer NBIM holdings file
// (matched by NBIM's own id from the old quote) and in a newer CalPERS 13F information table (matched by CUSIP).
// Adds them as leads to research/refresh-prefill/<id>.json under "owners". Researchers copy them into the lens.
// Usage: zsh -c 'node scripts/refresh-owners.mjs <nbim-date> <calpers-13f-infotable-url> <calpers-period-end>'
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [nbimDate, calpersUrl, calpersEnd] = process.argv.slice(2);
const UA = process.env.SEC_USER_AGENT;
if (!nbimDate || !calpersUrl || !UA) { console.error("usage: zsh -c 'node scripts/refresh-owners.mjs 2026-06-30 <infotable.xml url> 2026-09-30'"); process.exit(1); }

const nbimUrl = `https://www.nbim.no/api/investments/v2/${nbimDate}.json`;
const nbim = (await (await fetch(nbimUrl, {headers: {"User-Agent": "Mozilla/5.0 (compatible; ValueForHumanity research)"}})).json()).data;
const nbimById = new Map(nbim.map(row => [row.id, row]));
const xml = await (await fetch(calpersUrl, {headers: {"User-Agent": UA}})).text();
const tag = (block, name) => (block.match(new RegExp(`<(?:\\w+:)?${name}>([^<]*)</(?:\\w+:)?${name}>`)) || [])[1]?.trim();
const rows = [...xml.matchAll(/<(?:\w+:)?infoTable>([\s\S]*?)<\/(?:\w+:)?infoTable>/g)].map(m => ({
  name: tag(m[1], "nameOfIssuer"), cls: tag(m[1], "titleOfClass"), cusip: tag(m[1], "cusip"),
  value: Number(tag(m[1], "value")), shares: Number(tag(m[1], "sshPrnamt")), type: tag(m[1], "sshPrnamtType")}));

const dir = path.join(root, "research/lenses/owners");
let n = 0, c = 0, files = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json") && !f.startsWith("_"))) {
  const id = f.replace(".json", ""), lens = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const lead = {nbim: null, calpers: null};
  const nbimId = lens.nbim?.source?.quote?.match(/"id":"([^"]+)"/)?.[1];
  if (nbimId) {
    const row = nbimById.get(nbimId);
    lead.nbim = row ? {pct: row.o, marketValueUSD: Math.round(row.a.e / 1e6) / 1e3, asOf: nbimDate,
      source: {hostType: "company", url: nbimUrl, label: `NBIM equity holdings, ${nbimDate}`, quote: JSON.stringify(row)}} : {missing: `NBIM id ${nbimId} not in ${nbimDate} file (sold, renamed or merged: search by name)`};
    if (row) n++;
  }
  const cusips = [...new Set((lens.calpers?.source?.quote || "").match(/\b[0-9A-Z]{6}[0-9A-Z]{2}[0-9]\b/g) || [])];
  if (cusips.length) {
    const hits = rows.filter(r => cusips.includes(r.cusip));
    lead.calpers = hits.length ? {asOf: calpersEnd, url: calpersUrl, rows: hits.map(r => ({...r, quoteHint: `${r.name} ${r.cls} ${r.cusip} ${r.value} ${r.shares}`})),
      shares: hits.reduce((a, r) => a + r.shares, 0)} : {missing: `CUSIP ${cusips.join(",")} not in the ${calpersEnd} 13F`};
    if (hits.length) c++;
  }
  const pf = path.join(root, "research/refresh-prefill", `${id}.json`);
  const out = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, "utf8")) : {id, note: "non-SEC filer: leads for the owners lens only"};
  out.owners = lead; fs.writeFileSync(pf, JSON.stringify(out, null, 1)); files++;
}
console.log(`owners leads: ${files} files, NBIM rows ${n}, CalPERS matches ${c}`);

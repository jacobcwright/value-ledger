#!/usr/bin/env node
// Refreshes research/lenses/networth from a capture of the Forbes Real-Time Billionaires list.
// The live list changes every few minutes, so it is captured once, in pages of 1,000 (the API refuses larger pages), into
// research/snapshots/forbes-rtb-<date>-start<N>.json (not committed: ~60 MB of bios). Each quote is a verbatim
// substring of its page, and the page URL is the source; verify-quotes keeps the capture's result via manual-sources.json.
// Usage: node scripts/refresh-networth.mjs 2026-11-24
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const date = process.argv[2];
const snapDir = path.join(root, "research/snapshots");
const pages = fs.readdirSync(snapDir).filter(f => f.startsWith(`forbes-rtb-${date}-start`)).sort((a, b) => Number(a.match(/start(\d+)/)[1]) - Number(b.match(/start(\d+)/)[1]));
if (!pages.length) { console.error("no capture for " + date); process.exit(1); }
const entries = new Map();
let capturedAt = 0;
for (const page of pages) {
  const raw = fs.readFileSync(path.join(snapDir, page), "utf8");
  const start = page.match(/start(\d+)/)[1];
  const url = `https://www.forbes.com/forbesapi/person/rtb/0/position/true.json?limit=1000&start=${start}`;
  for (const p of JSON.parse(raw).personList.personsLists) {
    if (entries.has(p.uri)) continue;
    const i = raw.indexOf(`"uri":"${p.uri}","rank"`), j = raw.indexOf(`"personName":`, i);
    const end = raw.indexOf(`"`, raw.indexOf(`"`, j + 13) + 1) + 1;
    entries.set(p.uri, {p, url, quote: raw.slice(i, end)});
    capturedAt = Math.max(capturedAt, p.timestamp || 0);
  }
}
const when = new Date(capturedAt).toISOString().replace(/:\d\d\.\d+Z$/, " UTC").replace("T", " ");
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const byName = new Map([...entries.values()].map(e => [norm(e.p.personName || e.p.person?.name), e]));

const dir = path.join(root, "research/lenses/networth");
const rows = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json") && !f.startsWith("_"))) {
  const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const oldUri = rec.netWorth?.source?.quote?.match(/"uri":"([^"]+)"/)?.[1];
  const hit = (oldUri && entries.get(oldUri)) || byName.get(norm(rec.name));
  const list = "Forbes Real-Time Billionaires";
  if (rec.reason === "deceased") {
    rec.netWorth = {value: null, asOf: date, list, rank: null, source: {hostType: "publisher", url: entries.values().next().value.url, label: `${list}, captured ${when}`, quote: null}};
    rec.notes = "Deceased; Forbes lists living people only.";
  } else if (hit) {
    const {p, url, quote} = hit;
    rec.netWorth = {value: Math.round(p.finalWorthBillions * 100) / 100, asOf: date, list, rank: p.rank,
      source: {hostType: "publisher", url, label: `${list}, captured ${when}`, quote}};
    rec.reason = null;
    rec.notes = `Listed as "${p.personName}" at rank ${p.rank}, real-time net worth $${(Math.round(p.finalWorthBillions * 100) / 100).toFixed(1)}B, source "${p.source}". Forbes updates this list continuously; this is its value at the capture time.`;
  } else {
    rec.netWorth = {value: null, asOf: date, list, rank: null, source: {hostType: "publisher", url: entries.values().next().value.url, label: `${list}, captured ${when}`, quote: null}};
    rec.reason = "not on the real-time list";
    rec.notes = `No entry among the ${entries.size.toLocaleString("en-US")} people on the captured list${oldUri ? ` (previously listed as ${oldUri})` : ""}; matched by Forbes id and by name.`;
  }
  rec.researchedAt = date;
  fs.writeFileSync(path.join(dir, f), JSON.stringify(rec, null, 2) + "\n");
  rows.push(`${rec.id}: ${rec.netWorth.value ?? rec.reason}`);
}
const metaPath = path.join(dir, "_meta.json");
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
meta.list = "Forbes Real-Time Billionaires";
meta.netWorthMeasuredAsOf = date;
meta.capturedAt = new Date(capturedAt).toISOString();
meta.listData = {url: "https://www.forbes.com/forbesapi/person/rtb/0/position/true.json?limit=1000&start=0", pages: pages.length, entries: entries.size,
  notes: `Forbes' real-time list JSON (the endpoint its real-time page calls), captured ${when} in ${pages.length} pages of up to 1,000. Net worths are finalWorthBillions (USD billions), rounded to 0.01; rank is the real-time rank. Every entry carries the capture timestamp.`};
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
console.log(rows.join("\n"));

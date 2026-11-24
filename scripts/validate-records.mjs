#!/usr/bin/env node
// Validates research/records/*.json against research/SCHEMA.md.
// Usage: node scripts/validate-records.mjs [--xbrl] [--links] [ids...]
//   --xbrl   re-fetch every figure that cites an SEC XBRL fact and confirm the value
//   --links  confirm every source URL responds (HEAD/GET < 400)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "research/records");
const args = process.argv.slice(2);
const checkXbrl = args.includes("--xbrl");
const checkLinks = args.includes("--links");
const only = args.filter(a => !a.startsWith("--"));
const UA = "ValueForHumanity research validator (contact via site)";

const leaders = new Function(fs.readFileSync(path.join(root, "dist/data.js"), "utf8") + ";return leaders")();
const ids = new Set(leaders.map(l => l.id));

const RELATIONS = ["founder","co-founder","founding-family","estate","ceo","former-ceo","chair","investor"];
const STATUSES = ["holds","deceased","no-reported-stake","not-disclosed"];
const HOLDER_TYPES = ["asset-manager","index-fund","pension","sovereign","government","family","company","employees","other"];

function checkSource(src, where, errs, facts, links) {
  if (!src || typeof src !== "object") return errs.push(`${where}: missing source`);
  if (!/^https:\/\/[^\s]+$/.test(src.url || "")) errs.push(`${where}: source.url must be https`);
  if (/google\.|bing\.|duckduckgo\./.test(src.url || "")) errs.push(`${where}: source.url is a search page`);
  if (!src.label) errs.push(`${where}: source.label missing`);
  if (!src.quote || src.quote.length < 8) errs.push(`${where}: source.quote missing or too short`);
  if (src.quote && src.quote.length > 600) errs.push(`${where}: source.quote too long`);
  if (src.xbrl) facts.push({ where, ...src.xbrl });
  if (src.url) links.add(src.url);
}
function num(v, where, errs, {min = 0, max = Infinity, nullable = true} = {}) {
  if (v === null && nullable) return;
  if (typeof v !== "number" || !Number.isFinite(v)) return errs.push(`${where}: must be a number${nullable ? " or null" : ""}`);
  if (v < min || v > max) errs.push(`${where}: ${v} outside ${min}..${max}`);
}

function validate(rec, file) {
  const errs = [], warns = [], facts = [], links = new Set();
  if (!ids.has(rec.id)) errs.push(`id "${rec.id}" not in data.js`);
  if (path.basename(file, ".json") !== rec.id) errs.push("file name must equal id");
  for (const k of ["company","fiscalYear","fiscalYearEnd","currency","unit","ownership","researchedAt"]) if (rec[k] == null) errs.push(`missing ${k}`);
  if (rec.unit !== "billions") errs.push(`unit must be "billions"`);
  if (!/^[A-Z]{3}$/.test(rec.currency || "")) errs.push("currency must be an ISO code");
  const o = rec.ownership || {};
  if (o.basis !== "economic") errs.push(`ownership.basis must be "economic"`);
  const L = o.leader;
  if (!L) errs.push("ownership.leader missing");
  else {
    if (!RELATIONS.includes(L.relation)) errs.push(`leader.relation "${L.relation}" invalid`);
    if (!STATUSES.includes(L.status)) errs.push(`leader.status "${L.status}" invalid`);
    num(L.pctEconomic, "leader.pctEconomic", errs, {max: 100});
    num(L.pctVoting, "leader.pctVoting", errs, {max: 100});
    if (L.status === "deceased" && L.pctEconomic != null) errs.push("deceased leader must have pctEconomic null");
    if (L.pctEconomic != null || L.status === "holds") checkSource(L.source, "leader", errs, facts, links);
    else if (L.source) checkSource(L.source, "leader", errs, facts, links);
    if (L.family) { num(L.family.pctEconomic, "leader.family.pctEconomic", errs, {max: 100}); checkSource(L.family.source, "leader.family", errs, facts, links); }
  }
  const H = o.largestHolders || [];
  if (H.length > 3) errs.push("largestHolders max 3");
  let sum = (L?.pctEconomic || 0) + (L?.family?.pctEconomic || 0);
  H.forEach((h, i) => {
    if (!h.name) errs.push(`largestHolders[${i}].name missing`);
    if (!HOLDER_TYPES.includes(h.type)) errs.push(`largestHolders[${i}].type "${h.type}" invalid`);
    num(h.pctEconomic, `largestHolders[${i}].pctEconomic`, errs, {max: 100, nullable: false});
    sum += h.pctEconomic || 0;
    checkSource(h.source, `largestHolders[${i}]`, errs, facts, links);
  });
  if (sum > 100.5) errs.push(`leader + family + holders = ${sum.toFixed(2)}% > 100%`);
  if (o.structure && typeof o.structure.dualClass !== "boolean") errs.push("structure.dualClass must be boolean");
  for (const [k, label] of [["dividends","cash.dividends"],["buybacks","cash.buybacks"]]) {
    const f = rec.cash?.[k];
    if (f == null) { warns.push(`${label} missing`); continue; }
    num(f.value, label, errs, {max: 1e5});
    if (f.value != null && f.value > 0) checkSource(f.source, label, errs, facts, links);
    else if (f.source) checkSource(f.source, label, errs, facts, links);
  }
  const sc = rec.workers?.stockComp;
  if (sc == null) warns.push("workers.stockComp missing");
  else { num(sc.value, "workers.stockComp", errs, {max: 1e5}); if (sc.value != null) checkSource(sc.source, "workers.stockComp", errs, facts, links); }
  if (rec.workers?.plan) checkSource(rec.workers.plan.source || rec.workers.plan, "workers.plan", errs, facts, links);
  const g = rec.geography;
  if (g) {
    if (!Array.isArray(g.segments) || g.segments.length < 2) errs.push("geography.segments needs ≥2 entries");
    else {
      g.segments.forEach((s, i) => { if (!s.name) errs.push(`geography.segments[${i}].name missing`); num(s.value, `geography.segments[${i}].value`, errs, {nullable: false, max: 1e6}); });
      num(g.total, "geography.total", errs, {nullable: false, max: 1e6});
      const segSum = g.segments.reduce((t, s) => t + (s.value || 0), 0);
      if (g.total && Math.abs(segSum - g.total) / g.total > 0.02) warns.push(`geography segments sum ${segSum.toFixed(2)} vs total ${g.total} (>2% apart)`);
    }
    checkSource(g.source, "geography", errs, facts, links);
  } else warns.push("geography null");
  return {errs, warns, facts, links};
}

const factCache = new Map();
async function companyFacts(cik) {
  const padded = String(cik).replace(/\D/g, "").padStart(10, "0");
  if (!factCache.has(padded)) {
    const r = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`, {headers: {"User-Agent": UA}});
    factCache.set(padded, r.ok ? await r.json() : null);
    await new Promise(res => setTimeout(res, 150));
  }
  return factCache.get(padded);
}
async function verifyFact(f) {
  const data = await companyFacts(f.cik);
  if (!data) return `cannot load companyfacts for CIK ${f.cik}`;
  const [tax, name] = f.concept.split(":");
  const concept = data.facts?.[tax]?.[name];
  if (!concept) return `concept ${f.concept} not found`;
  const all = Object.values(concept.units).flat();
  const hit = all.find(x => x.end === f.end && Number(x.val) === Number(f.value));
  if (hit) return null;
  const near = all.filter(x => x.end === f.end).map(x => x.val);
  return `value ${f.value} for ${f.concept} @ ${f.end} not found (filed values at that date: ${[...new Set(near)].join(", ") || "none"})`;
}

const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")).filter(f => !only.length || only.includes(path.basename(f, ".json"))) : [];
let failed = 0;
for (const f of files) {
  const file = path.join(dir, f);
  let rec;
  try { rec = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { console.log(`✗ ${f}: invalid JSON (${e.message})`); failed++; continue; }
  const {errs, warns, facts, links} = validate(rec, file);
  if (checkXbrl) for (const fact of facts) { const e = await verifyFact(fact); if (e) errs.push(`xbrl ${fact.where}: ${e}`); }
  if (checkLinks) for (const url of links) {
    try { const r = await fetch(url, {method: "GET", headers: {"User-Agent": UA}, redirect: "follow"}); if (r.status >= 400) errs.push(`link ${r.status}: ${url}`); }
    catch (e) { errs.push(`link error: ${url} (${e.message})`); }
  }
  const tag = errs.length ? "✗" : "✓";
  if (errs.length) failed++;
  console.log(`${tag} ${rec.id}  (${facts.length} xbrl facts${checkXbrl ? " checked" : ""}, ${links.size} sources)`);
  errs.forEach(e => console.log("    error: " + e));
  warns.forEach(w => console.log("    warn:  " + w));
}
console.log(`\n${files.length - failed}/${files.length} records valid`);
process.exit(failed ? 1 : 0);

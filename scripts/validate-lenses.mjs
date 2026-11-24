#!/usr/bin/env node
// Validates research/lenses/ecosystem/<id>.json and research/lenses/fiscal/<id>.json against
// research/LENSES.md, with the same source rules as validate-records.mjs.
// Usage: node scripts/validate-lenses.mjs [--xbrl] [--links] [--json] [ids...]
//   --xbrl   re-fetch every figure that cites an SEC XBRL fact and confirm the value
//   --links  confirm every source URL responds (GET < 400)
//   --json   print one JSON result per leader instead of the readable report
// Each lens (ecosystem, taxes, rnd) passes or fails on its own, so the build can publish the lenses
// that pass and skip the rest. File-level errors (bad JSON, wrong id, header fields) fail every lens
// in that file. Files whose name starts with "_" (e.g. _nordhaus.json) are not leader lenses.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const lensDirs = {ecosystem: path.join(root, "research/lenses/ecosystem"), fiscal: path.join(root, "research/lenses/fiscal")};
// Which published lens keys each file carries.
export const fileLenses = {ecosystem: ["ecosystem"], fiscal: ["taxes", "rnd"]};
const UA = "ValueForHumanity research validator (contact via site)";

const leaders = new Function(fs.readFileSync(path.join(root, "dist/data.js"), "utf8") + ";return leaders")();
const ids = new Set(leaders.map(l => l.id));

const HOSTS = ["sec","company","exchange","regulator"];
const MIRRORS = /dfcfw\.com|9to5mac|seekingalpha|marketscreener|macrotrends|stockanalysis|companiesmarketcap|wsj\.com|reuters\.com|bloomberg|yahoo\.|investing\.com|wikipedia|annualreports\.com|last10k|fintel|gurufocus/;
const TIERS = ["filing","company-commissioned"];

function checkSource(src, where, errs, facts, links) {
  if (!src || typeof src !== "object") return errs.push(`${where}: missing source`);
  if (!/^https:\/\/[^\s]+$/.test(src.url || "")) errs.push(`${where}: source.url must be https`);
  // A search-results page, not a document. (Narrower than validate-records.mjs, whose /google\./ also
  // rejects Google's own documents such as services.google.com, which are company-hosted primary sources.)
  if (/^https:\/\/(www\.)?(google|bing)\.[a-z.]+\/(search|url)\b|duckduckgo\./.test(src.url || "")) errs.push(`${where}: source.url is a search page`);
  if (!src.label) errs.push(`${where}: source.label missing`);
  if (!HOSTS.includes(src.hostType)) errs.push(`${where}: source.hostType must be one of ${HOSTS.join("|")}`);
  if (MIRRORS.test(src.url || "")) errs.push(`${where}: source.url is a mirror/aggregator, not a primary document`);
  if (!src.quote || src.quote.length < 8) errs.push(`${where}: source.quote missing or too short`);
  if (src.quote && src.quote.length > 600) errs.push(`${where}: source.quote too long`);
  if (src.xbrl) facts.push({where, ...src.xbrl});
  if (src.url) links.add(src.url);
}
function num(v, where, errs, {min = 0, max = 1e6, nullable = true} = {}) {
  if (v === null && nullable) return;
  if (typeof v !== "number" || !Number.isFinite(v)) return errs.push(`${where}: must be a number${nullable ? " or null" : ""}`);
  if (v < min || v > max) errs.push(`${where}: ${v} outside ${min}..${max}`);
}
// A { label?, value, source } figure. A null figure is allowed (not disclosed); a present one must be complete.
function figure(f, where, errs, facts, links, {label = false, min = 0} = {}) {
  if (f == null) return;
  if (typeof f !== "object") return errs.push(`${where}: must be an object or null`);
  if (label && !f.label) errs.push(`${where}.label missing`);
  num(f.value, `${where}.value`, errs, {nullable: false, min});
  checkSource(f.source, where, errs, facts, links);
}

function header(rec, file, dirKey, errs) {
  if (!ids.has(rec.id)) errs.push(`id "${rec.id}" not in data.js`);
  if (path.basename(file, ".json") !== rec.id) errs.push("file name must equal id");
  for (const k of ["company","fiscalYear","fiscalYearEnd","currency","unit","researchedAt"]) if (rec[k] == null) errs.push(`missing ${k}`);
  if (rec.unit !== "billions") errs.push(`unit must be "billions"`);
  if (!/^[A-Z]{3}$/.test(rec.currency || "")) errs.push("currency must be an ISO code");
  if (rec.fiscalYearEnd != null && !/^\d{4}-\d{2}-\d{2}$/.test(rec.fiscalYearEnd)) errs.push("fiscalYearEnd must be YYYY-MM-DD");
  // Each file holds only its own lens keys.
  const foreign = Object.values(fileLenses).flat().filter(k => !fileLenses[dirKey].includes(k) && rec[k] !== undefined);
  if (foreign.length) errs.push(`${dirKey} file must not carry ${foreign.join(", ")}`);
}

function ecosystem(e, errs, warns, facts, links) {
  if (e == null) return;
  if (typeof e !== "object") return errs.push("ecosystem must be an object or null");
  if (!TIERS.includes(e.tier)) errs.push(`ecosystem.tier must be ${TIERS.join("|")}`);
  const m = e.measure;
  if (m != null) {
    if (!m.name) errs.push("ecosystem.measure.name missing");
    if (!m.definition || !m.definition.quote) errs.push("ecosystem.measure.definition.quote missing (the company's own definition)");
    else checkSource(m.definition.source, "ecosystem.measure.definition", errs, facts, links);
    figure(m, "ecosystem.measure", errs, facts, links);
  }
  figure(e.platformRevenue, "ecosystem.platformRevenue", errs, facts, links, {label: true});
  if (m && !e.platformRevenue) warns.push("ecosystem.measure without platformRevenue: no platform share can be shown");
  if (m && e.platformRevenue && typeof m.value === "number" && typeof e.platformRevenue.value === "number") {
    if (m.value <= 0) errs.push("ecosystem.measure.value must be above 0");
    else if (e.platformRevenue.value > m.value) warns.push("ecosystem.platformRevenue exceeds measure.value: the flow-through bar will not be drawn");
  }
  figure(e.payouts, "ecosystem.payouts", errs, facts, links, {label: true});
  if (e.clientAssets != null) {
    figure(e.clientAssets, "ecosystem.clientAssets", errs, facts, links, {label: true});
    if (!e.clientAssets.asOf) errs.push("ecosystem.clientAssets.asOf missing (a balance needs its date)");
  }
  if (e.studies != null && !Array.isArray(e.studies)) errs.push("ecosystem.studies must be an array");
  const studies = Array.isArray(e.studies) ? e.studies : [];
  if (studies.length > 2) errs.push("ecosystem.studies max 2");
  studies.forEach((s, i) => {
    const where = `ecosystem.studies[${i}]`;
    for (const k of ["title","publisher","commissionedBy","claim"]) if (!s?.[k]) errs.push(`${where}.${k} missing`);
    if (s?.year != null && !Number.isInteger(s.year)) errs.push(`${where}.year must be an integer`);
    num(s?.value ?? null, `${where}.value`, errs);
    if (s?.value != null && !/^[A-Z]{3}$/.test(s.currency || "")) errs.push(`${where}.currency must be an ISO code when value is set`);
    checkSource(s?.source, where, errs, facts, links);
  });
  // Optional extra filed metrics some platforms carry. Each is a figure with its own source.
  if (e.thirdPartyUnitShare != null) { figure(e.thirdPartyUnitShare, "ecosystem.thirdPartyUnitShare", errs, facts, links, {label: true}); num(e.thirdPartyUnitShare.value, "ecosystem.thirdPartyUnitShare.value", errs, {max: 100}); }
  if (e.secondaryMeasure != null) {
    if (!e.secondaryMeasure.name) errs.push("ecosystem.secondaryMeasure.name missing");
    figure(e.secondaryMeasure, "ecosystem.secondaryMeasure", errs, facts, links);
    if (e.secondaryMeasure.definition) checkSource(e.secondaryMeasure.definition.source, "ecosystem.secondaryMeasure.definition", errs, facts, links);
    figure(e.secondaryMeasure.relatedRevenue, "ecosystem.secondaryMeasure.relatedRevenue", errs, facts, links, {label: true});
  }
  if (e.squareGPV != null) figure(e.squareGPV, "ecosystem.squareGPV", errs, facts, links, {label: true});
  // ratioComparable: false means revenue and the measure are on different bases (e.g. revenue booked gross),
  // so the site must not show a "kept X%" share; ratioNote says why, in one line.
  if (e.ratioComparable != null && typeof e.ratioComparable !== "boolean") errs.push("ecosystem.ratioComparable must be boolean");
  if (e.ratioComparable === false && !e.ratioNote) errs.push("ecosystem.ratioNote missing (required when ratioComparable is false)");
  if (!m && !e.platformRevenue && !e.payouts && !e.clientAssets && !studies.length) warns.push("ecosystem has no figures");
}

// Validates one lens file. Returns {file, exists, fileErrors, lenses: {key: {errs, warns, facts, links}}}.
export function validateLensFile(dirKey, id) {
  const file = path.join(lensDirs[dirKey], id + ".json");
  const result = {dirKey, id, file, exists: fs.existsSync(file), fileErrors: [], lenses: {}};
  if (!result.exists) return result;
  let rec;
  try { rec = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { result.fileErrors.push(`invalid JSON (${e.message})`); return result; }
  result.record = rec;
  header(rec, file, dirKey, result.fileErrors);
  for (const key of fileLenses[dirKey]) {
    const errs = [], warns = [], facts = [], links = new Set();
    if (key === "ecosystem") ecosystem(rec.ecosystem, errs, warns, facts, links);
    if (key === "taxes" && rec.taxes != null) figure(rec.taxes.cashTaxesPaid, "taxes.cashTaxesPaid", errs, facts, links, {min: -1e6});
    if (key === "rnd" && rec.rnd != null) figure(rec.rnd.expense, "rnd.expense", errs, facts, links);
    if (rec[key] === undefined) warns.push(`${key} missing (use null when not disclosed)`);
    result.lenses[key] = {errs, warns, facts, links: [...links], present: rec[key] != null};
  }
  return result;
}

const factCache = new Map();
async function companyFacts(cik) {
  const padded = String(cik).replace(/\D/g, "").padStart(10, "0");
  if (!factCache.has(padded)) {
    const r = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`, {headers: {"User-Agent": process.env.SEC_USER_AGENT || UA}});
    factCache.set(padded, r.ok ? await r.json() : null);
    await new Promise(res => setTimeout(res, 150));
  }
  return factCache.get(padded);
}
async function verifyFact(f) {
  const data = await companyFacts(f.cik);
  if (!data) return `cannot load companyfacts for CIK ${f.cik}`;
  const [tax, name] = String(f.concept || "").split(":");
  const concept = data.facts?.[tax]?.[name];
  if (!concept) return `concept ${f.concept} not found`;
  const all = Object.values(concept.units).flat();
  if (all.find(x => x.end === f.end && Number(x.val) === Number(f.value))) return null;
  const near = all.filter(x => x.end === f.end).map(x => x.val);
  return `value ${f.value} for ${f.concept} @ ${f.end} not found (filed values at that date: ${[...new Set(near)].join(", ") || "none"})`;
}

// Every leader id that has at least one lens file.
export function lensIds() {
  const found = new Set();
  for (const dir of Object.values(lensDirs)) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".json") && !f.startsWith("_")) found.add(path.basename(f, ".json"));
  }
  return [...found].sort();
}

async function main() {
  const args = process.argv.slice(2);
  const checkXbrl = args.includes("--xbrl"), checkLinks = args.includes("--links"), asJson = args.includes("--json");
  const only = args.filter(a => !a.startsWith("--"));
  const targets = only.length ? only : lensIds();
  let failed = 0, files = 0;
  for (const id of targets) {
    for (const dirKey of Object.keys(lensDirs)) {
      const r = validateLensFile(dirKey, id);
      if (!r.exists) continue;
      files++;
      for (const lens of Object.values(r.lenses)) {
        if (checkXbrl) for (const fact of lens.facts) { const e = await verifyFact(fact); if (e) lens.errs.push(`xbrl ${fact.where}: ${e}`); }
        if (checkLinks) for (const url of lens.links) {
          try { const res = await fetch(url, {headers: {"User-Agent": UA}, redirect: "follow"}); if (res.status >= 400) lens.errs.push(`link ${res.status}: ${url}`); }
          catch (e) { lens.errs.push(`link error: ${url} (${e.message})`); }
        }
      }
      const bad = r.fileErrors.length || Object.values(r.lenses).some(l => l.errs.length);
      if (bad) failed++;
      if (asJson) {
        console.log(JSON.stringify({id, file: dirKey, fileErrors: r.fileErrors, lenses: Object.fromEntries(Object.entries(r.lenses).map(([k, l]) => [k, {ok: !r.fileErrors.length && !l.errs.length, present: l.present, errs: l.errs, warns: l.warns}]))}));
        continue;
      }
      console.log(`${bad ? "✗" : "✓"} ${dirKey}/${id}`);
      r.fileErrors.forEach(e => console.log("    error: " + e));
      for (const [key, l] of Object.entries(r.lenses)) {
        const facts = l.facts.length ? `, ${l.facts.length} xbrl facts${checkXbrl ? " checked" : ""}` : "";
        console.log(`  ${l.errs.length || r.fileErrors.length ? "✗" : "✓"} ${key}${l.present ? "" : " (null)"}  (${l.links.length} sources${facts})`);
        l.errs.forEach(e => console.log("      error: " + e));
        l.warns.forEach(w => console.log("      warn:  " + w));
      }
    }
  }
  if (!asJson) console.log(`\n${files - failed}/${files} lens files valid`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

#!/usr/bin/env node
// Publishes each leader's research to dist/companies/<id>.json and writes dist/companies.json and
// dist/coverage.json. Run by `npm run deploy` before the site check.
//
// - research/records/<id>.json is published when it passes scripts/validate-records.mjs. Amazon
//   (jeff-bezos) has its own case study, so its record is never published.
// - research/lenses/ecosystem/<id>.json (key `ecosystem`) and research/lenses/fiscal/<id>.json
//   (keys `taxes`, `rnd`) are merged into the same file, each lens only when it passes
//   scripts/validate-lenses.mjs. A failing lens is skipped; the record and the other lenses still publish.
//   A leader with lenses but no publishable record (always Amazon) gets a minimal header plus its lenses.
// - Gate: when research/verified.json exists ({ "sources": { "<url>": { "ok": true|false } } }), only
//   sources listed there with ok:true are published. A figure whose source is not verified is published
//   with its value set to null and no source. Without the file, everything that validates is published.
// - research/lenses/footprint/<id>.json (key `footprint`, see research/FOOTPRINT.md) is checked by
//   scripts/validate-footprint.mjs and gated row by row: a row whose source URL is not verified ok in
//   research/verified.json is dropped, as is a row that fails validation; the rest of the file still
//   publishes. Metrics no surviving row uses are left out, and so is the key when no row survives.
//   FOOTPRINT_GATE=off skips the verified.json check for footprint rows only (local previews; never
//   commit output built that way). Amazon keeps its own footprint panel, so its file is not published.
// - research/lenses/ecosystem/_nordhaus.json, when present and sourced, is published inside coverage.json.
// Files in dist/companies that this run did not publish are deleted. Exits 0 even when things are
// skipped, so a half-researched set never blocks a deploy.
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {validateLensFile, lensDirs, fileLenses} from "./validate-lenses.mjs";
import {validateFootprintFile, metricScale, FOOTPRINT_LAYERS} from "./validate-footprint.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recordsDir = path.join(root, "research/records");
const outDir = path.join(root, "dist/companies");
const validator = path.join(root, "scripts/validate-records.mjs");
const verifiedFile = path.join(root, "research/verified.json");
const nordhausFile = path.join(lensDirs.ecosystem, "_nordhaus.json");
const SKIP_RECORD = new Set(["jeff-bezos"]);
const MIRRORS = /dfcfw\.com|9to5mac|seekingalpha|marketscreener|macrotrends|stockanalysis|companiesmarketcap|wsj\.com|reuters\.com|bloomberg|yahoo\.|investing\.com|wikipedia|annualreports\.com|last10k|fintel|gurufocus/;
// Record lenses (from research/records) and the added lenses, in the order the profile shows them.
const RECORD_LENSES = ["ownership", "workers", "cash", "geography"];
const ADDED_LENSES = ["ecosystem", "taxes", "rnd", "footprint"];
const SKIP_FOOTPRINT = new Set(["jeff-bezos"]);
const FOOTPRINT_GATE = process.env.FOOTPRINT_GATE !== "off";
const MAX_SITES = 12;

const leaders = new Function(fs.readFileSync(path.join(root, "dist/data.js"), "utf8") + ";return leaders")();

// ---- Gate ------------------------------------------------------------------------------------
let verified = null;
if (fs.existsSync(verifiedFile)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(verifiedFile, "utf8"));
    verified = parsed && typeof parsed.sources === "object" && parsed.sources ? parsed.sources : {};
  } catch (error) {
    // A broken gate file must not open the gate: publish no sources at all.
    console.log(`research/verified.json is not valid JSON (${error.message}); no sources pass the gate`);
    verified = {};
  }
}
const isSource = value => value && typeof value === "object" && typeof value.url === "string";
const passes = source => !verified || verified[source.url]?.ok === true;
// Text that comes from a source and must go with it.
const SOURCED_TEXT = new Set(["quote", "text", "claim"]);
function gate(node, stats) {
  if (!verified || node == null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(child => gate(child, stats));
  // A derived figure is only as good as all of its inputs.
  if (Array.isArray(node.inputs) && node.inputs.some(isSource)) {
    if (node.inputs.every(source => !isSource(source) || passes(source))) return node;
    stats.blocked++;
    return null;
  }
  if (isSource(node.source) && !passes(node.source)) {
    stats.blocked++;
    return strip(node, stats);
  }
  const out = {};
  for (const [key, value] of Object.entries(node)) out[key] = gate(value, stats);
  return out;
}
// The figure behind an unverified source: numbers and sourced text become null, the source goes,
// names and labels stay. Children with their own source are gated on their own.
function strip(node, stats) {
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "source" || key === "segments") out[key] = null;
    else if (typeof value === "number" || SOURCED_TEXT.has(key)) out[key] = null;
    else if (value && typeof value === "object") {
      const own = !Array.isArray(value) && (isSource(value.source) || Array.isArray(value.inputs));
      out[key] = own ? gate(value, stats) : Array.isArray(value) ? value.map(item => item && typeof item === "object" ? strip(item, stats) : null) : strip(value, stats);
    } else out[key] = value;
  }
  return out;
}

// ---- Coverage --------------------------------------------------------------------------------
// The renderer's own rule: a figure counts when it has a number (or sourced text) and an https source
// that is not a mirror, and is not marked not-sourced.
const publishable = source => isSource(source) && /^https:\/\/\S+$/.test(source.url) && !MIRRORS.test(source.url);
// Published but not shown on the site (optional detail), so not counted as coverage.
const NOT_SHOWN = new Set(["squareGPV"]);
const finite = value => typeof value === "number" && Number.isFinite(value);
function countFigures(node) {
  if (node == null || typeof node !== "object") return 0;
  if (Array.isArray(node)) return node.reduce((sum, child) => sum + countFigures(child), 0);
  if (node.status === "not-sourced") return 0;
  let count = 0;
  if (Array.isArray(node.inputs) && finite(node.pctEconomic) && node.inputs.some(publishable)) count++;
  else if (publishable(node.source) && (["value", "pctEconomic", "total", "shares"].some(key => finite(node[key])) || node.text || node.claim)) count++;
  for (const [key, value] of Object.entries(node)) if (key !== "source" && key !== "inputs" && !NOT_SHOWN.has(key) && value && typeof value === "object") count += countFigures(value);
  return count;
}

// ---- Records ---------------------------------------------------------------------------------
function validRecord(id) {
  const file = path.join(recordsDir, id + ".json");
  if (!fs.existsSync(file)) return {record: null, reasons: null};
  if (SKIP_RECORD.has(id)) return {record: null, reasons: ["Amazon has its own case study"]};
  const run = spawnSync(process.execPath, [validator, id], {cwd: root, encoding: "utf8"});
  if (run.status !== 0) {
    const reasons = (run.stdout + run.stderr).split("\n")
      .filter(line => /^\s*error:|invalid JSON/.test(line))
      .map(line => line.replace(/^\s*(error:\s*|✗\s*)/, "").trim());
    return {record: null, reasons: reasons.length ? reasons : [`validator exited ${run.status}`]};
  }
  return {record: JSON.parse(fs.readFileSync(file, "utf8")), reasons: null};
}

// ---- Footprint -------------------------------------------------------------------------------
// The published lens: only rows that validate and (with the gate on) cite a verified source, each with
// only the fields the site shows. Returns {footprint, stats} or null when there is no file.
const footprintStats = {files: 0, published: 0, rows: 0, unverified: 0, invalid: 0, metricsDropped: 0, skipped: []};
const cleanSource = source => ({hostType: source.hostType, url: source.url, label: String(source.label), quote: String(source.quote)});
function footprintFor(id) {
  if (SKIP_FOOTPRINT.has(id)) return null;
  const result = validateFootprintFile(id);
  if (!result.exists) return null;
  footprintStats.files++;
  if (result.fileErrors.length) { footprintStats.skipped.push([id, result.fileErrors]); return null; }
  const rec = result.record;
  const badMetrics = new Set(Object.keys(result.metricErrors));
  footprintStats.metricsDropped += badMetrics.size;
  const out = {};
  const used = new Set();
  let rows = 0;
  for (const layer of FOOTPRINT_LAYERS) {
    const checks = result.rows[layer];
    if (!checks) continue;
    const kept = [];
    for (const {index, errs, drops} of checks) {
      const row = rec[layer][index];
      if (errs.length) { footprintStats.invalid++; continue; }
      if (verified && FOOTPRINT_GATE && !passes(row.source)) { footprintStats.unverified++; continue; }
      const values = {}, plus = {};
      for (const [key, value] of Object.entries(row.values || {})) {
        if (badMetrics.has(key) || drops.includes(key) || typeof value !== "number" || !Number.isFinite(value)) continue;
        values[key] = value;
        if (row.plus?.[key] === true) plus[key] = true;
        used.add(key);
      }
      // A row may carry its own period when its source is dated differently from the metric's.
      const base = {...(typeof row.period === "string" && row.period ? {period: row.period} : {}), source: cleanSource(row.source)};
      if (layer === "sites") {
        if (kept.length >= MAX_SITES) continue;
        kept.push({name: String(row.name), place: row.place ? String(row.place) : null, state: row.state ?? null, iso2: row.iso2 ?? (row.state ? "US" : null),
          type: row.type ? String(row.type) : null, description: String(row.description), ...(Object.keys(values).length ? {values, plus} : {}), ...base});
        continue;
      }
      if (!Object.keys(values).length) { footprintStats.invalid++; continue; }
      if (layer === "usStates") kept.push({state: row.state, values, plus, ...base});
      if (layer === "countries") kept.push({iso2: row.iso2, name: String(row.name), values, plus, ...base});
      if (layer === "regions") kept.push({name: String(row.name), ...(row.country ? {country: row.country} : {}), countries: Array.isArray(row.countries) ? row.countries : null, values, plus, ...base});
    }
    if (kept.length) { out[layer] = kept; rows += kept.length; }
  }
  if (!rows) return null;
  const metrics = {};
  for (const [key, metric] of Object.entries(rec.metrics)) {
    if (!used.has(key)) continue;
    // scale: what one stored unit is worth in plain units (explicit, from the unit, or from a label like "(millions)").
    metrics[key] = {label: String(metric.label), unit: metric.unit, scale: metricScale(metric), ...(metric.currency ? {currency: metric.currency} : {}),
      period: metric.period ? String(metric.period) : null, tier: metric.tier, definition: metric.definition ? String(metric.definition) : null};
  }
  footprintStats.published++;
  footprintStats.rows += rows;
  return {metrics, ...out, notes: rec.notes ? String(rec.notes) : null, researchedAt: rec.researchedAt || null};
}
// Coverage counts each number a footprint row shows, and each site.
function countFootprint(footprint) {
  if (!footprint) return 0;
  let count = 0;
  for (const layer of FOOTPRINT_LAYERS) for (const row of footprint[layer] || []) count += layer === "sites" ? 1 : Object.keys(row.values).length;
  return count;
}

const published = [], skipped = [], lensSkipped = [], coverage = [];
let blockedTotal = 0;
const recordCount = fs.existsSync(recordsDir) ? fs.readdirSync(recordsDir).filter(f => f.endsWith(".json")).length : 0;
fs.mkdirSync(outDir, {recursive: true});

for (const leader of leaders) {
  const {id} = leader;
  const {record, reasons} = validRecord(id);
  if (reasons) skipped.push([id, reasons]);

  // Lenses: each one passes or fails on its own.
  const lenses = {};
  let header = null;
  for (const dirKey of Object.keys(lensDirs)) {
    const result = validateLensFile(dirKey, id);
    if (!result.exists) continue;
    for (const key of fileLenses[dirKey]) {
      const lens = result.lenses[key];
      const errors = [...result.fileErrors, ...(lens?.errs || [])];
      if (errors.length) { lensSkipped.push([`${dirKey}/${id}`, key, errors]); continue; }
      if (!lens.present) continue;
      const rec = result.record;
      const period = {fiscalYear: rec.fiscalYear, fiscalYearEnd: rec.fiscalYearEnd, currency: rec.currency, unit: rec.unit, researchedAt: rec.researchedAt};
      lenses[key] = {...rec[key], period, ...(dirKey === "fiscal" && rec.notes ? {notes: String(rec.notes)} : {})};
      header ??= {company: rec.company, fiscalYear: rec.fiscalYear, fiscalYearEnd: rec.fiscalYearEnd, currency: rec.currency, unit: rec.unit};
    }
  }

  const footprint = footprintFor(id);
  if (!record && !Object.keys(lenses).length && !footprint) continue;
  // Amazon (and any leader whose record failed) publishes only its lenses under a minimal header.
  let out = record ? {...record, ...lenses} : {id, ...(header || {company: leader.company}), lensesOnly: true, ...lenses};
  const stats = {blocked: 0};
  out = gate(out, stats);
  blockedTotal += stats.blocked;
  // Gated row by row above, so it joins after the generic gate (which would null figures, not drop rows).
  if (footprint) out.footprint = footprint;
  fs.writeFileSync(path.join(outDir, id + ".json"), JSON.stringify(out) + "\n");
  published.push(id);

  const counts = {};
  for (const key of [...RECORD_LENSES, ...ADDED_LENSES]) {
    let n = key === "footprint" ? countFootprint(out.footprint) : countFigures(out[key]);
    // The site shows no Ecosystem tab for platform revenue alone, so it doesn't count as coverage either.
    if (key === "ecosystem" && out.ecosystem && n === countFigures(out.ecosystem.platformRevenue)) n = 0;
    if (n) counts[key] = n;
  }
  coverage.push({id, name: leader.name, company: leader.company, lenses: counts, ...(stats.blocked ? {unverified: stats.blocked} : {})});
}

// The list of published ids, so the site only requests files that exist (no 404s in the console).
// It lives outside dist/companies, which must hold only <leader-id>.json files.
fs.writeFileSync(path.join(root, "dist/companies.json"), JSON.stringify({published}) + "\n");

// ---- Nordhaus finding (methodology page) -------------------------------------------------------
// Shape assumed (not yet specified in LENSES.md): { "title", "author", "year", "claim", "quote",
// "source": { "url", "label", "quote" } }. Published only with an https, non-mirror source, a label
// and a verbatim quote (top-level or in the source), and only when it passes the gate.
let nordhaus = null;
if (fs.existsSync(nordhausFile)) {
  try {
    const raw = JSON.parse(fs.readFileSync(nordhausFile, "utf8"));
    const source = raw?.source;
    const quote = String(raw?.quote || source?.quote || "");
    if (publishable(source) && source.label && quote.length >= 8 && passes(source)) {
      nordhaus = {
        title: raw.title ? String(raw.title) : null, author: raw.author ? String(raw.author) : null,
        year: Number.isInteger(raw.year) ? raw.year : null, claim: raw.claim ? String(raw.claim) : null,
        quote, source: {url: source.url, label: String(source.label)}
      };
    } else console.log("research/lenses/ecosystem/_nordhaus.json: not published (needs an https source with a label and a verbatim quote, verified when the gate is on)");
  } catch (error) {
    console.log(`research/lenses/ecosystem/_nordhaus.json: invalid JSON (${error.message})`);
  }
}

// ---- Coverage --------------------------------------------------------------------------------
fs.writeFileSync(path.join(root, "dist/coverage.json"), JSON.stringify({
  lenses: [...RECORD_LENSES, ...ADDED_LENSES],
  gated: Boolean(verified),
  leaders: leaders.map(leader => coverage.find(entry => entry.id === leader.id) || {id: leader.id, name: leader.name, company: leader.company, lenses: {}}),
  ...(nordhaus ? {nordhaus} : {})
}) + "\n");

// Remove anything in dist/companies that this run did not publish.
const removed = [];
for (const file of fs.readdirSync(outDir)) {
  if (file.endsWith(".json") && published.includes(path.basename(file, ".json"))) continue;
  fs.rmSync(path.join(outDir, file), {recursive: true, force: true});
  removed.push(file);
}
if (!fs.readdirSync(outDir).length) fs.rmdirSync(outDir);

const withLens = key => coverage.filter(entry => entry.lenses[key]).length;
console.log(`Published ${published.length} leaders to dist/companies/ (${recordCount} records found)`);
console.log(`  lenses: ${[...RECORD_LENSES, ...ADDED_LENSES].map(key => `${key} ${withLens(key)}`).join(" · ")}`);
console.log(verified ? `  gate: research/verified.json, ${blockedTotal} unverified figure${blockedTotal === 1 ? "" : "s"} published as null` : "  gate: off (no research/verified.json)");
if (footprintStats.files) {
  const gateNote = !verified ? "no gate file" : FOOTPRINT_GATE ? `${footprintStats.unverified} rows dropped as unverified` : "GATE OFF (FOOTPRINT_GATE=off): do not commit this output";
  console.log(`  footprint: ${footprintStats.published}/${footprintStats.files} files published, ${footprintStats.rows} rows; ${gateNote}; ${footprintStats.invalid} invalid rows dropped${footprintStats.metricsDropped ? `, ${footprintStats.metricsDropped} invalid metrics dropped` : ""} (details: node scripts/validate-footprint.mjs)`);
  for (const [id, reasons] of footprintStats.skipped) console.log(`  ✗ footprint/${id}: ${reasons.slice(0, 3).join("; ")}`);
}
if (nordhaus) console.log("  nordhaus: published in coverage.json");
if (skipped.length) {
  console.log(`Records skipped ${skipped.length}:`);
  for (const [id, reasons] of skipped) {
    const shown = reasons.slice(0, 4);
    console.log(`  ✗ ${id}: ${shown.join("; ")}${reasons.length > shown.length ? `; +${reasons.length - shown.length} more` : ""}`);
  }
}
if (lensSkipped.length) {
  console.log(`Lenses skipped ${lensSkipped.length}:`);
  for (const [file, key, reasons] of lensSkipped) {
    const shown = reasons.slice(0, 3);
    console.log(`  ✗ ${file} ${key}: ${shown.join("; ")}${reasons.length > shown.length ? `; +${reasons.length - shown.length} more` : ""}`);
  }
}
if (removed.length) console.log(`Removed stale: ${removed.join(", ")}`);

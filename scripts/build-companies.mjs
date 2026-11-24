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
import {validateLensFile, lensDirs, fileLenses, validatePaidoutFile, validateOwnersFile, figureSources, paidOutFrom, altPaidOutFrom, lendingGrowth, salesEnabledFrom, sameAmount, fxYear, fxRates, managersList} from "./validate-lenses.mjs";
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
const ADDED_LENSES = ["ecosystem", "taxes", "rnd", "paidout", "footprint"];
// Amazon keeps its own ownership case study, so its owners file is not published.
const SKIP_OWNERS = new Set(["jeff-bezos"]);
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
const footprintStats = {files: 0, published: 0, rows: 0, unverified: 0, stale: 0, invalid: 0, metricsDropped: 0, skipped: []};
// A footprint row usually cites a document the records already cite (a 10-K), which verified.json may mark ok
// from an earlier run that never saw the footprint quotes. So a footprint row also needs verified.json's quote
// count for its URL to equal the number of quotes citing that URL now (counted the way verify-quotes.mjs counts
// them); otherwise its quote has not been checked yet and the row waits for the next verify-quotes run.
const citedQuotes = new Map();
function countQuotes(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { countQuotes(full); continue; }
    if (!entry.name.endsWith(".json")) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(full, "utf8")); } catch { continue; }
    (function walk(node) {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      if (typeof node.url === "string" && typeof node.quote === "string") citedQuotes.set(node.url, (citedQuotes.get(node.url) || 0) + 1);
      Object.values(node).forEach(walk);
    })(data);
  }
}
countQuotes(path.join(root, "research/records"));
countQuotes(path.join(root, "research/lenses"));
const quotesChecked = source => verified?.[source.url]?.quotes === citedQuotes.get(source.url);
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
      if (verified && FOOTPRINT_GATE && !quotesChecked(row.source)) { footprintStats.stale++; continue; }
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

// ---- Paid out & sales enabled, and owners ------------------------------------------------------
// research/lenses/paidout/<id>.json (research/PAIDOUT.md) publishes as `paidout`, and every comparable figure
// is recomputed here from its inputs: the build throws (exit 1) if the file's own paidOut, altPaidOut or
// salesEnabled disagrees with the arithmetic. research/lenses/owners/<id>.json publishes as `owners`.
// Both use the strict gate (like footprint rows): a source must be verified ok AND verified.json's quote count
// for its URL must equal the number of quotes citing it now. A figure that fails is null, and so is anything
// computed from it (paid out from its inputs, USD from the FX rate, sales enabled from the ecosystem inputs).
// dist/paidout.json carries the list-level figures in USD (id → { usd, adjustedUsd, salesEnabledUsd,
// comparable, caveats, fiscalYear }), so the ranking table doesn't fetch 100 files. It is never summed.
const strictPasses = source => !verified || (isSource(source) && passes(source) && quotesChecked(source));
const paidoutStats = {files: 0, published: 0, blocked: 0, skipped: []};
const ownersStats = {files: 0, published: 0, blocked: 0, skipped: []};
const paidoutList = {};
const round6 = value => typeof value === "number" ? Math.round(value * 1e6) / 1e6 : null;
// A figure with all its backing documents (own source or summed components), or null when one fails the gate.
function gatedFigure(field, stats, extra = {}) {
  if (!field || typeof field !== "object" || typeof field.value !== "number") return null;
  const backing = figureSources(field);
  if (!backing.length) return null;
  if (!backing.every(item => strictPasses(item.source))) { stats.blocked++; return null; }
  // Unlabelled components take their name from the matching "components" entry ("intangible assets 354.196").
  const named = (item, index) => item.label || (backing.length > 1 && Array.isArray(field.components) && field.components.length === backing.length ? String(field.components[index]).replace(/\s+[-−]?[\d.,]+$/, "") : "");
  return {value: field.value, ...extra, sources: backing.map((item, index) => ({...cleanSource(item.source), ...(named(item, index) ? {part: named(item, index)} : {}), ...(backing.length > 1 && typeof item.value === "number" ? {partValue: item.value} : {})}))};
}
const sectorFlags = {payments: "payments company", exchange: "exchange operator", "asset-manager": "asset manager"};
function paidoutFor(id) {
  const result = validatePaidoutFile(id);
  if (!result.exists) return null;
  paidoutStats.files++;
  // A stored total that disagrees with its own inputs fails the build; other problems skip the file.
  const mismatches = result.errs.filter(error => error.includes("≠"));
  if (mismatches.length) throw new Error(`paidout/${id}: ${mismatches.join("; ")}`);
  if (result.errs.length) { paidoutStats.skipped.push([id, result.errs]); return null; }
  const rec = result.record, inputs = rec.inputs, stats = paidoutStats;
  const period = {fiscalYear: rec.fiscalYear, fiscalYearEnd: rec.fiscalYearEnd, currency: rec.currency, unit: rec.unit, researchedAt: rec.researchedAt};
  const caveats = [];
  // FX: the calendar-year average that covers most of the fiscal year.
  let fx = null, perUSD = rec.currency === "USD" ? 1 : null;
  if (rec.currency !== "USD") {
    const year = fxYear(rec.fiscalYearEnd), rate = fxRates().rates[rec.currency][String(year)];
    if (!(rate.usedFor || []).some(entry => String(entry).startsWith(id + " "))) throw new Error(`paidout/${id}: _fx.json ${rec.currency} ${year} does not list ${id} in usedFor; the fiscal-year rule and the FX file disagree`);
    if (strictPasses(rate.source)) {
      perUSD = rate.perUSD;
      fx = {perUSD, calendarYear: year, statedBasis: rate.statedBasis || null, stated: rate.stated || null, derivation: rate.derivation || null, source: cleanSource(rate.source)};
    } else stats.blocked++;
  }
  const usd = value => typeof value === "number" && perUSD ? round6(value / perUSD) : null;
  const out = {sector: rec.sector, comparable: rec.comparable, period};
  const revenue = gatedFigure(inputs.revenue, stats);
  const ocf = gatedFigure(inputs.operatingCashFlow, stats);
  out.revenue = revenue;
  out.operatingCashFlow = ocf;
  if (rec.comparable) {
    const capex = gatedFigure(inputs.capex, stats, Array.isArray(inputs.capex.components) ? {components: inputs.capex.components.map(String)} : {});
    out.capex = capex;
    // Interest and income taxes paid are added only where the filer classifies them outside operating cash flow.
    out.addBacks = [];
    let addBacksOk = true;
    for (const key of ["interestPaid", "taxesPaid"]) {
      const field = inputs[key];
      if (!field || field.inOCF !== false) continue;
      if (typeof field.value !== "number") { caveats.push({code: key === "interestPaid" ? "interest-not-separable" : "taxes-not-separable"}); continue; }
      const figure = gatedFigure(field, stats);
      if (!figure) { addBacksOk = false; continue; }
      out.addBacks.push({key, ...figure, ...(field.location ? {location: String(field.location)} : {})});
    }
    // Recompute from the raw inputs first: a file whose stored paidOut disagrees with its own inputs fails the build.
    const raw = paidOutFrom({revenue: inputs.revenue.value, operatingCashFlow: inputs.operatingCashFlow.value, capex: inputs.capex.value,
      interestPaid: inputs.interestPaid?.value, interestInOCF: inputs.interestPaid?.inOCF, taxesPaid: inputs.taxesPaid?.value, taxesInOCF: inputs.taxesPaid?.inOCF});
    if (!sameAmount(raw, rec.paidOut)) throw new Error(`paidout/${id}: stored paidOut ${rec.paidOut} ≠ recomputed ${raw} (revenue − operating cash flow + capex + add-backs)`);
    const gated = revenue && ocf && capex && addBacksOk ? revenue.value - ocf.value + capex.value + out.addBacks.reduce((sum, item) => sum + item.value, 0) : null;
    out.paidOut = round6(gated);
    // Customer lending inside operating cash flow.
    const lending = lendingGrowth(rec);
    if (lending.status === "adjusted") {
      const parts = lending.parts.map(part => ({label: part.label, effect: round6(part.effect), source: part.source}));
      if (parts.every(part => strictPasses(part.source))) {
        out.lending = {status: "adjusted", effect: round6(lending.effect), parts: parts.map(part => ({label: part.label, effect: part.effect, sources: [cleanSource(part.source)]})),
          adjusted: out.paidOut == null ? null : round6(out.paidOut - lending.effect)};
      } else {
        stats.blocked++;
        out.lending = {status: "not-disclosed", effect: null, parts: [], adjusted: null};
        caveats.push({code: "lending-not-disclosed"});
      }
    } else if (lending.status !== "none") {
      out.lending = {status: lending.status, effect: null, parts: [], adjusted: null};
      caveats.push(lending.status === "not-separable" ? {code: "lending-not-separable", text: lending.note} : {code: "lending-not-disclosed"});
    } else out.lending = null;
    // Sales enabled: marketplaces only, from the ecosystem lens's own figures.
    out.salesEnabled = null;
    if (rec.salesEnabled) {
      const se = rec.salesEnabled;
      const eco = JSON.parse(fs.readFileSync(path.join(lensDirs.ecosystem, id + ".json"), "utf8")).ecosystem;
      const recomputed = salesEnabledFrom({measureValue: eco.measure.value, platformRevenue: eco.platformRevenue.value, firstPartySales: se.firstPartySales ? se.firstPartySales.value : 0});
      if (!sameAmount(recomputed, se.value)) throw new Error(`paidout/${id}: stored salesEnabled ${se.value} ≠ ecosystem measure − platform revenue${se.firstPartySales ? " − first-party sales" : ""} = ${recomputed}`);
      const measure = gatedFigure(eco.measure, stats), platform = gatedFigure(eco.platformRevenue, stats);
      const firstParty = se.firstPartySales ? gatedFigure(se.firstPartySales, stats) : null;
      const definition = eco.measure.definition?.source && strictPasses(eco.measure.definition.source) ? {quote: String(eco.measure.definition.quote), source: cleanSource(eco.measure.definition.source)} : null;
      if (measure && platform && (!se.firstPartySales || firstParty)) {
        out.salesEnabled = {value: round6(measure.value - platform.value - (firstParty ? firstParty.value : 0)), measure: String(se.measure || eco.measure.name),
          measureValue: measure, platformRevenue: {...platform, label: String(se.platformRevenueLabel || eco.platformRevenue.label || "Revenue")}, firstPartySales: firstParty, definition,
          ...(se.note ? {note: String(se.note)} : {})};
      }
    }
    // Caveats from the flags, each with its amount when a sourced figure states it.
    const flagAmount = key => {
      const flag = rec.flags[key];
      const value = typeof flag === "number" ? flag : flag && typeof flag === "object" && typeof flag.value === "number" ? flag.value : null;
      if (value == null) return null;
      // The amount's own document: the flag object, or the input that states the same amount.
      const candidates = [flag, ...Object.values(inputs), ...Object.values(inputs.otherNamedItems || {})].filter(item => item && typeof item === "object" && sameAmount(item.value, value));
      const figure = candidates.map(item => gatedFigure(item, {blocked: 0})).find(Boolean);
      return figure ? {value, sources: figure.sources} : {value: null};
    };
    const nonCash = flagAmount("nonCashRevenue");
    if (nonCash) caveats.push({code: "non-cash-revenue", ...nonCash});
    const received = flagAmount("interestDividendsReceivedInOCF");
    if (received) caveats.push({code: "interest-dividends-received", ...received});
    if (rec.flags.revenueIncludesExcise === true) caveats.push({code: "revenue-includes-excise"});
    if (rec.sector === "conglomerate-insurance") caveats.push({code: "insurance"});
    if (sectorFlags[rec.sector]) caveats.push({code: "financial-sector", text: sectorFlags[rec.sector]});
    const base = out.lending?.adjusted ?? out.paidOut;
    if (base != null && revenue && base > revenue.value) caveats.push({code: "exceeds-revenue", negativeOCF: ocf ? ocf.value < 0 : false});
    out.total = base == null ? null : round6(base + (out.salesEnabled ? out.salesEnabled.value : 0));
  } else {
    // Banks and brokers: not comparable. Operating costs paid, excluding interest, plus interest paid shown apart.
    const parts = {noninterestExpense: gatedFigure(inputs.noninterestExpense, stats), depreciationAmortization: gatedFigure(inputs.depreciationAmortization || inputs.da, stats),
      stockComp: gatedFigure(inputs.stockComp, stats), taxesPaid: gatedFigure(inputs.taxesPaid, stats)};
    const raw = altPaidOutFrom({noninterestExpense: inputs.noninterestExpense.value, depreciationAmortization: (inputs.depreciationAmortization || inputs.da).value, stockComp: inputs.stockComp.value, taxesPaid: inputs.taxesPaid.value});
    if (!sameAmount(raw, rec.altPaidOut)) throw new Error(`paidout/${id}: stored altPaidOut ${rec.altPaidOut} ≠ recomputed ${raw}`);
    const ok = Object.values(parts).every(Boolean);
    out.alt = {value: ok ? round6(altPaidOutFrom(Object.fromEntries(Object.entries(parts).map(([key, figure]) => [key, figure.value])))) : null, ...parts};
    out.interestPaid = gatedFigure(inputs.interestPaid, stats);
    out.paidOut = null;
    out.total = null;
  }
  out.fx = fx;
  out.usd = {paidOut: usd(out.paidOut), adjusted: usd(out.lending?.adjusted ?? null), salesEnabled: usd(out.salesEnabled?.value ?? null), total: usd(out.total),
    alt: usd(out.alt?.value ?? null), interestPaid: usd(out.interestPaid?.value ?? null)};
  out.caveats = caveats;
  out.notes = rec.notes ? String(rec.notes) : null;
  paidoutStats.published++;
  paidoutList[id] = {usd: out.usd.paidOut, adjustedUsd: out.usd.adjusted, salesEnabledUsd: out.usd.salesEnabled, comparable: rec.comparable,
    caveats: caveats.map(caveat => caveat.code), fiscalYear: rec.fiscalYear};
  return out;
}
// Figures behind the Paid out tab, for coverage.
const countPaidout = p => !p ? 0 : [p.revenue, p.operatingCashFlow, p.capex, ...(p.addBacks || []), ...(p.lending?.parts || []), p.salesEnabled?.measureValue, p.salesEnabled?.platformRevenue,
  p.salesEnabled?.firstPartySales, ...(p.alt ? [p.alt.noninterestExpense, p.alt.depreciationAmortization, p.alt.stockComp, p.alt.taxesPaid, p.interestPaid] : [])].filter(Boolean).length;

const managers = managersList();
const holderKey = name => String(name).trim().toLowerCase();
const managerByHolder = new Map(managers.flatMap(manager => manager.matches.map(name => [holderKey(name), manager])));
function ownersFor(id, record) {
  if (SKIP_OWNERS.has(id)) return null;
  const result = validateOwnersFile(id);
  if (!result.exists) return null;
  ownersStats.files++;
  if (result.errs.length) { ownersStats.skipped.push([id, result.errs]); return null; }
  const rec = result.record, stats = ownersStats;
  const ok = source => { if (strictPasses(source)) return true; stats.blocked++; return false; };
  const nbim = rec.nbim && ok(rec.nbim.source) ? {pct: rec.nbim.pct, marketValueUSD: rec.nbim.marketValueUSD ?? null, asOf: rec.nbim.asOf, source: cleanSource(rec.nbim.source)} : null;
  const c = rec.calpers;
  const calpers = c && ok(c.source) && c.derived.inputs.every(ok)
    ? {pct: c.derived.pct, shares: c.shares, asOf: c.asOf, method: String(c.derived.method), ...(c.basis === "class" ? {basis: "class", classLabel: String(c.classLabel)} : {}),
      source: cleanSource(c.source), inputs: c.derived.inputs.map(cleanSource)}
    : null;
  const hor = rec.holdersOfRecord && ok(rec.holdersOfRecord.source) ? {count: rec.holdersOfRecord.count, asOf: rec.holdersOfRecord.asOf, source: cleanSource(rec.holdersOfRecord.source)} : null;
  // Managers for this company's named holders, keyed by the holder's name as the record spells it.
  const named = {};
  for (const holder of record?.ownership?.largestHolders || []) {
    const manager = holder?.name && managerByHolder.get(holderKey(holder.name));
    if (manager && ok(manager.source)) named[holder.name] = {name: manager.name, investsFor: String(manager.investsFor), source: cleanSource(manager.source)};
  }
  if (!nbim && !calpers && !hor && !Object.keys(named).length) return null;
  ownersStats.published++;
  return {nbim, calpers, holdersOfRecord: hor, managers: named, notes: rec.notes ? String(rec.notes) : null, researchedAt: rec.researchedAt || null};
}
const countOwners = o => !o ? 0 : [o.nbim, o.calpers, o.holdersOfRecord].filter(Boolean).length + Object.keys(o.managers).length;

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
  const paidout = paidoutFor(id);
  const owners = ownersFor(id, record);
  if (!record && !Object.keys(lenses).length && !footprint && !paidout) continue;
  // Amazon (and any leader whose record failed) publishes only its lenses under a minimal header.
  let out = record ? {...record, ...lenses} : {id, ...(header || {company: leader.company}), lensesOnly: true, ...lenses};
  const stats = {blocked: 0};
  out = gate(out, stats);
  blockedTotal += stats.blocked;
  // Gated row by row above, so it joins after the generic gate (which would null figures, not drop rows).
  if (footprint) out.footprint = footprint;
  // Gated with the strict rule inside paidoutFor and ownersFor, so they too join after the generic gate.
  if (paidout) out.paidout = paidout;
  if (owners && out.ownership) out.owners = owners;
  fs.writeFileSync(path.join(outDir, id + ".json"), JSON.stringify(out) + "\n");
  published.push(id);

  const counts = {};
  for (const key of [...RECORD_LENSES, ...ADDED_LENSES]) {
    let n = key === "footprint" ? countFootprint(out.footprint) : key === "paidout" ? countPaidout(out.paidout) : countFigures(out[key]);
    if (key === "ownership" && n) n += countOwners(out.owners);
    // The site shows no Ecosystem tab for platform revenue alone, so it doesn't count as coverage either.
    if (key === "ecosystem" && out.ecosystem && n === countFigures(out.ecosystem.platformRevenue)) n = 0;
    if (n) counts[key] = n;
  }
  coverage.push({id, name: leader.name, company: leader.company, lenses: counts, ...(stats.blocked ? {unverified: stats.blocked} : {})});
}

// The list of published ids, so the site only requests files that exist (no 404s in the console).
// It lives outside dist/companies, which must hold only <leader-id>.json files.
fs.writeFileSync(path.join(root, "dist/companies.json"), JSON.stringify({published}) + "\n");
// The ranking's "Paid out & sales enabled" column, in USD, for every leader with a paid-out file.
fs.writeFileSync(path.join(root, "dist/paidout.json"), JSON.stringify(paidoutList) + "\n");

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
  const gateNote = !verified ? "no gate file" : FOOTPRINT_GATE ? `${footprintStats.unverified} rows dropped as unverified, ${footprintStats.stale} more whose quotes verify-quotes has not checked yet` : "GATE OFF (FOOTPRINT_GATE=off): do not commit this output";
  console.log(`  footprint: ${footprintStats.published}/${footprintStats.files} files published, ${footprintStats.rows} rows; ${gateNote}; ${footprintStats.invalid} invalid rows dropped${footprintStats.metricsDropped ? `, ${footprintStats.metricsDropped} invalid metrics dropped` : ""} (details: node scripts/validate-footprint.mjs)`);
  for (const [id, reasons] of footprintStats.skipped) console.log(`  ✗ footprint/${id}: ${reasons.slice(0, 3).join("; ")}`);
}
console.log(`  paidout: ${paidoutStats.published}/${paidoutStats.files} files published (recomputed from inputs), ${paidoutStats.blocked} figures null by the strict gate; dist/paidout.json has ${Object.keys(paidoutList).length} leaders`);
console.log(`  owners: ${ownersStats.published}/${ownersStats.files} files published, ${ownersStats.blocked} sources null by the strict gate`);
for (const [label, list] of [["paidout", paidoutStats.skipped], ["owners", ownersStats.skipped]]) for (const [id, reasons] of list) console.log(`  ✗ ${label}/${id}: ${reasons.slice(0, 3).join("; ")}`);
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

#!/usr/bin/env node
// Validates research/lenses/ecosystem/<id>.json and research/lenses/fiscal/<id>.json against
// research/LENSES.md, research/lenses/paidout/<id>.json against research/PAIDOUT.md (including its
// arithmetic), research/lenses/owners/<id>.json, research/lenses/networth/<id>.json (a third-party estimate of
// the leader's net worth: the one lens whose source may have hostType "publisher"), and the shared _fx.json and _managers.json, all with the
// same source rules as validate-records.mjs.
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

// Net worth is a third-party estimate (the Forbes list), published by the list's publisher, not by the company
// or a regulator. "publisher" is accepted for that lens only; every other lens keeps HOSTS.
const NETWORTH_HOSTS = [...HOSTS, "publisher"];

function checkSource(src, where, errs, facts, links, hosts = HOSTS, maxQuote = 600) {
  if (!src || typeof src !== "object") return errs.push(`${where}: missing source`);
  if (!/^https:\/\/[^\s]+$/.test(src.url || "")) errs.push(`${where}: source.url must be https`);
  // A search-results page, not a document. (Narrower than validate-records.mjs, whose /google\./ also
  // rejects Google's own documents such as services.google.com, which are company-hosted primary sources.)
  if (/^https:\/\/(www\.)?(google|bing)\.[a-z.]+\/(search|url)\b|duckduckgo\./.test(src.url || "")) errs.push(`${where}: source.url is a search page`);
  if (!src.label) errs.push(`${where}: source.label missing`);
  if (!hosts.includes(src.hostType)) errs.push(`${where}: source.hostType must be one of ${hosts.join("|")}`);
  if (MIRRORS.test(src.url || "")) errs.push(`${where}: source.url is a mirror/aggregator, not a primary document`);
  if (!src.quote || src.quote.length < 8) errs.push(`${where}: source.quote missing or too short`);
  if (src.quote && src.quote.length > maxQuote) errs.push(`${where}: source.quote too long`);
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

// ---- Paid out & sales enabled (research/PAIDOUT.md) and owners (NBIM, CalPERS, holders of record) ----
// These two lenses have their own file shapes, so they are validated here but not through lensDirs and
// fileLenses (whose header rules and one-key-per-lens layout they don't follow). The build publishes them
// with its own functions; the arithmetic helpers below are shared so the validator and the build agree.
export const extraLensDirs = {paidout: path.join(root, "research/lenses/paidout"), owners: path.join(root, "research/lenses/owners"), networth: path.join(root, "research/lenses/networth"), marketcap: path.join(root, "research/lenses/marketcap"), pay: path.join(root, "research/lenses/pay")};
const fxFile = path.join(extraLensDirs.paidout, "_fx.json");
const managersFile = path.join(extraLensDirs.owners, "_managers.json");
const BANK_LIKE = ["bank", "broker", "insurer"];
// Equal within rounding: research files store billions to at most 6 decimals.
export const sameAmount = (a, b) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= Math.max(1e-6, 1e-7 * Math.abs(b));

// Every {url} object anywhere in a node (sources, derived inputs, definitions) must pass the source rules.
function sourcesIn(node, where, errs, facts, links) {
  if (Array.isArray(node)) return node.forEach((child, i) => sourcesIn(child, `${where}[${i}]`, errs, facts, links));
  if (!node || typeof node !== "object") return;
  if (typeof node.url === "string") return checkSource(node, where, errs, facts, links);
  for (const [key, value] of Object.entries(node)) sourcesIn(value, `${where}.${key}`, errs, facts, links);
}
// A sourced number: { value, source }. Negative values allowed where a cash flow can be negative.
// The documents behind one figure, as [{label, value, source}]: its own source, or the components it is
// summed from (derived.inputs or parts). Empty when nothing backs it.
export function figureSources(f) {
  if (!f || typeof f !== "object") return [];
  if (f.source && typeof f.source === "object") return [{label: "", value: f.value, source: f.source}];
  const items = Array.isArray(f.parts) && f.parts.length ? f.parts : Array.isArray(f.derived?.inputs) ? f.derived.inputs : [];
  return items.filter(item => item && typeof item === "object")
    .map(item => typeof item.url === "string" ? {label: "", value: null, source: item} : {label: String(item.label || item.component || ""), value: typeof item.value === "number" ? item.value : null, source: item.source})
    .filter(item => item.source && typeof item.source === "object");
}
// A sourced number: { value, source } or { value, derived: { inputs } } or { value, parts }. Negative values
// allowed where a cash flow can be negative. Summed components must add up to the value.
function sourcedNumber(f, where, errs, {min = 0, nullable = false} = {}) {
  if (f == null) { if (!nullable) errs.push(`${where} missing`); return; }
  if (typeof f !== "object") return errs.push(`${where} must be an object`);
  if (f.value === null && nullable) return;
  num(f.value, `${where}.value`, errs, {nullable: false, min, max: 1e7});
  const backing = figureSources(f);
  if (!backing.length) return errs.push(`${where}: no source (source, derived.inputs or parts)`);
  if (!f.source && backing.every(item => typeof item.value === "number") && /sum|\+/.test(String(f.derived?.method || "+")) && !f.derived?.method?.includes("−")) {
    const total = backing.reduce((sum, item) => sum + item.value, 0);
    if (!sameAmount(total, f.value) && Math.abs(total - f.value) > 0.0005 * Math.max(1, Math.abs(f.value))) errs.push(`${where}: components add up to ${total}, not ${f.value}`);
  }
}
const depreciation = inputs => inputs.depreciationAmortization || inputs.da;

// Paid out = revenue − operating cash flow + capex (+ interest and/or income taxes paid, only where the filer
// classifies them outside operating cash flow). Takes {revenue, operatingCashFlow, capex, interestPaid, taxesPaid}
// as plain numbers or null, plus the inOCF flags. Returns null when an input is missing.
export function paidOutFrom({revenue, operatingCashFlow, capex, interestPaid, interestInOCF, taxesPaid, taxesInOCF}) {
  if (![revenue, operatingCashFlow, capex].every(v => typeof v === "number")) return null;
  let total = revenue - operatingCashFlow + capex;
  // An add-back the filer doesn't state separately (BYD merges interest with dividends) is left out; the
  // build shows a caveat that paid out is understated by it.
  if (interestInOCF === false && typeof interestPaid === "number") total += interestPaid;
  if (taxesInOCF === false && typeof taxesPaid === "number") total += taxesPaid;
  return total;
}
// Banks and brokers: operating costs paid, excluding interest = noninterest expense − D&A − stock comp + income taxes paid.
export function altPaidOutFrom({noninterestExpense, depreciationAmortization, stockComp, taxesPaid}) {
  if (![noninterestExpense, depreciationAmortization, stockComp, taxesPaid].every(v => typeof v === "number")) return null;
  return noninterestExpense - depreciationAmortization - stockComp + taxesPaid;
}
const OCF_DIRECTION = text => {
  const lowers = /\b(lower|lowers|lowering)\s+(OCF|operating cash flow)\b/i.test(text), raises = /\b(raise|raises|raising)\s+(OCF|operating cash flow)\b/i.test(text);
  return lowers === raises ? null : lowers ? "lowers" : "raises";
};
// A part's label, or the line name its quote starts with ("- Loan receivables in the financial services segment (276) …").
const lineName = quote => {
  let line = String(quote || "").replace(/^[\s\-–•]+/, "");
  const figure = line.match(/\s+\(?\s*[–-]?\d[\d,.]*\s*\)?(?=\s|$)/);
  if (figure) line = line.slice(0, figure.index);
  line = line.trim();
  return line ? line.charAt(0).toUpperCase() + line.slice(1) : "";
};
const partLabel = part => part.label ? String(part.label) : lineName(part.source?.quote) || "Customer financing inside operating cash flow";
// Judgement calls, named here so they are visible: the disclosed line is not customer lending alone.
const LENDING_NOT_SEPARABLE = {"ginni-rometty": "IBM reports financing receivables in one line with trade receivables, so the lending part can't be separated."};
// Customer lending (finance receivables, lease fleets, loan books) booked inside operating cash flow, read from
// whichever of the three shapes a file uses. Returns {status, effect, parts, note}:
//   status "none": not flagged · "adjusted": amount disclosed · "not-disclosed": flagged, no amount · "not-separable": see above.
//   effect: how much the lending flows RAISED paid out (positive when they lowered operating cash flow); adjusted = paidOut − effect.
//   parts: [{label, effect, source}], one per disclosed line.
// Throws when a flagged file matches no known shape, so a new shape can't slip through unadjusted and uncaveated.
export function lendingGrowth(rec) {
  const id = rec.id, flag = rec.flags?.financeReceivablesInOCF;
  const fromInputs = rec.inputs?.financeReceivablesChangeInOCF;
  const fromOther = rec.inputs?.otherNamedItems?.financingReceivablesChangeInOCF;
  if (!flag) return {status: "none", effect: 0, parts: [], note: ""};
  if (LENDING_NOT_SEPARABLE[id]) return {status: "not-separable", effect: null, parts: [], note: LENDING_NOT_SEPARABLE[id]};
  // 1. inputs.financeReceivablesChangeInOCF: a magnitude plus effectOnOCF.
  if (flag === true && fromInputs && typeof fromInputs === "object") {
    if (typeof fromInputs.value !== "number") return {status: "not-disclosed", effect: null, parts: [], note: String(fromInputs.note || "")};
    const direction = fromInputs.effectOnOCF;
    if (direction !== "lowers" && direction !== "raises") throw new Error(`paidout/${id}: inputs.financeReceivablesChangeInOCF.effectOnOCF must be "lowers" or "raises"`);
    const effect = direction === "lowers" ? Math.abs(fromInputs.value) : -Math.abs(fromInputs.value);
    const label = fromInputs.derivation || fromInputs.computedFrom ? "Loan originations net of repayments" : lineName(fromInputs.source?.quote) || "Customer financing inside operating cash flow";
    return {status: "adjusted", effect, parts: [{label, effect, source: fromInputs.source}], note: String(fromInputs.note || "")};
  }
  // 2. inputs.otherNamedItems.financingReceivablesChangeInOCF: signed as in the cash-flow statement (an outflow is negative).
  if (flag === true && fromOther && typeof fromOther === "object" && typeof fromOther.value === "number") {
    const effect = -fromOther.value;
    const stated = OCF_DIRECTION(String(fromOther.note || ""));
    if (stated && (stated === "lowers") !== (effect > 0)) throw new Error(`paidout/${id}: financingReceivablesChangeInOCF sign disagrees with its note`);
    return {status: "adjusted", effect, parts: [{label: lineName(fromOther.source?.quote) || "Financing receivables", effect, source: fromOther.source}], note: String(fromOther.note || "")};
  }
  // 3. An object in flags: { value, parts?, note }. No direction field, so the note states it; signed parts
  //    (any negative) follow the cash-flow statement, unsigned parts are magnitudes in the note's direction.
  if (flag && typeof flag === "object") {
    if (typeof flag.value !== "number") return {status: "not-disclosed", effect: null, parts: [], note: String(flag.note || "")};
    const direction = OCF_DIRECTION(String(flag.note || ""));
    if (!direction) throw new Error(`paidout/${id}: flags.financeReceivablesInOCF has an amount but its note doesn't say whether it lowers or raises operating cash flow`);
    const effect = direction === "lowers" ? Math.abs(flag.value) : -Math.abs(flag.value);
    const raw = Array.isArray(flag.parts) ? flag.parts : [];
    const signed = raw.some(part => part.value < 0);
    const parts = raw.length
      ? raw.map(part => ({label: partLabel(part), effect: signed ? -part.value : (direction === "lowers" ? 1 : -1) * Math.abs(part.value), source: part.source}))
      : [{label: lineName(flag.source?.quote) || "Customer financing inside operating cash flow", effect, source: flag.source}];
    if (!sameAmount(parts.reduce((sum, part) => sum + part.effect, 0), effect)) throw new Error(`paidout/${id}: flags.financeReceivablesInOCF parts don't add up to its value in the note's direction`);
    return {status: "adjusted", effect, parts, note: String(flag.note || "")};
  }
  if (flag === true) return {status: "not-disclosed", effect: null, parts: [], note: ""};
  throw new Error(`paidout/${id}: flags.financeReceivablesInOCF has an unknown shape`);
}
// Sales enabled: the marketplace's own gross volume − its revenue (− its own first-party sales where stated).
export function salesEnabledFrom({measureValue, platformRevenue, firstPartySales = 0}) {
  if (![measureValue, platformRevenue, firstPartySales].every(v => typeof v === "number")) return null;
  return measureValue - platformRevenue - firstPartySales;
}
// Calendar year whose average rate applies: fiscal years ending January–June use the prior year (_fx.json notes).
export const fxYear = fiscalYearEnd => { const [y, m] = String(fiscalYearEnd).split("-").map(Number); return m <= 6 ? y - 1 : y; };
let fxCache;
export function fxRates() {
  fxCache ??= JSON.parse(fs.readFileSync(fxFile, "utf8"));
  return fxCache;
}
export const managersList = () => JSON.parse(fs.readFileSync(managersFile, "utf8"));

export function validatePaidoutFile(id) {
  const file = path.join(extraLensDirs.paidout, id + ".json");
  const result = {dirKey: "paidout", id, file, exists: fs.existsSync(file), errs: [], warns: [], facts: [], links: []};
  if (!result.exists) return result;
  const {errs, warns, facts} = result, links = new Set();
  let rec;
  try { rec = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { errs.push(`invalid JSON (${e.message})`); return result; }
  result.record = rec;
  if (!ids.has(rec.id)) errs.push(`id "${rec.id}" not in data.js`);
  if (path.basename(file, ".json") !== rec.id) errs.push("file name must equal id");
  for (const k of ["company", "fiscalYear", "fiscalYearEnd", "currency", "unit", "researchedAt", "sector"]) if (rec[k] == null) errs.push(`missing ${k}`);
  if (rec.unit !== "billions") errs.push(`unit must be "billions"`);
  if (!/^[A-Z]{3}$/.test(rec.currency || "")) errs.push("currency must be an ISO code");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.fiscalYearEnd || "")) errs.push("fiscalYearEnd must be YYYY-MM-DD");
  if (typeof rec.comparable !== "boolean") errs.push("comparable must be true or false");
  if (BANK_LIKE.includes(rec.sector) && rec.comparable !== false) errs.push(`sector ${rec.sector} must have comparable:false`);
  const inputs = rec.inputs && typeof rec.inputs === "object" ? rec.inputs : (errs.push("inputs missing"), {});
  sourcedNumber(inputs.revenue, "inputs.revenue", errs);
  sourcedNumber(inputs.operatingCashFlow, "inputs.operatingCashFlow", errs, {min: -1e7});
  for (const key of ["interestPaid", "taxesPaid"]) {
    const f = inputs[key];
    if (f == null) continue;
    sourcedNumber(f, `inputs.${key}`, errs, {min: -1e7, nullable: true});
    if (typeof f.value === "number" && typeof f.inOCF !== "boolean") errs.push(`inputs.${key}.inOCF must be true or false`);
  }
  if (rec.comparable) {
    sourcedNumber(inputs.capex, "inputs.capex", errs);
    if (typeof rec.paidOut !== "number") errs.push("paidOut must be a number when comparable");
    const computed = paidOutFrom({revenue: inputs.revenue?.value, operatingCashFlow: inputs.operatingCashFlow?.value, capex: inputs.capex?.value,
      interestPaid: inputs.interestPaid?.value, interestInOCF: inputs.interestPaid?.inOCF, taxesPaid: inputs.taxesPaid?.value, taxesInOCF: inputs.taxesPaid?.inOCF});
    if (computed == null) errs.push("paidOut cannot be computed from the inputs");
    else if (!sameAmount(computed, rec.paidOut)) errs.push(`paidOut ${rec.paidOut} ≠ revenue − operating cash flow + capex (+ add-backs) = ${computed}`);
  } else {
    if (rec.paidOut !== null) errs.push("paidOut must be null when not comparable");
    for (const [key, f] of [["noninterestExpense", inputs.noninterestExpense], ["depreciationAmortization (or da)", depreciation(inputs)], ["stockComp", inputs.stockComp], ["taxesPaid", inputs.taxesPaid], ["interestPaid", inputs.interestPaid]]) sourcedNumber(f, `inputs.${key}`, errs);
    const computed = altPaidOutFrom({noninterestExpense: inputs.noninterestExpense?.value, depreciationAmortization: depreciation(inputs)?.value, stockComp: inputs.stockComp?.value, taxesPaid: inputs.taxesPaid?.value});
    if (typeof rec.altPaidOut !== "number") errs.push("altPaidOut must be a number when not comparable");
    else if (computed == null || !sameAmount(computed, rec.altPaidOut)) errs.push(`altPaidOut ${rec.altPaidOut} ≠ noninterest expense − D&A − stock comp + taxes paid = ${computed}`);
  }
  if (!rec.flags || typeof rec.flags !== "object") errs.push("flags missing");
  else {
    for (const k of ["interestDividendsReceivedInOCF", "nonCashRevenue"]) {
      const v = rec.flags[k];
      if (v != null && v !== false && typeof v !== "number" && !(typeof v === "object" && (v.value === null || typeof v.value === "number"))) errs.push(`flags.${k} must be a number, { value, source } or null`);
    }
    if (rec.flags.revenueIncludesExcise != null && typeof rec.flags.revenueIncludesExcise !== "boolean") errs.push("flags.revenueIncludesExcise must be boolean");
    if (rec.comparable) { try { lendingGrowth(rec); } catch (e) { errs.push(e.message.replace(/^paidout\/[^:]+: /, "")); } }
  }
  const se = rec.salesEnabled;
  if (se != null) {
    if (rec.sector !== "marketplace") errs.push("salesEnabled is for marketplaces only (sector: marketplace)");
    for (const k of ["value", "measureValue", "platformRevenue"]) num(se[k], `salesEnabled.${k}`, errs, {nullable: false, max: 1e7});
    if (!se.measure) errs.push("salesEnabled.measure missing");
    const computed = salesEnabledFrom({measureValue: se.measureValue, platformRevenue: se.platformRevenue, firstPartySales: se.firstPartySales ? se.firstPartySales.value : 0});
    if (computed == null || !sameAmount(computed, se.value)) errs.push(`salesEnabled.value ${se.value} ≠ measure − platform revenue${se.firstPartySales ? " − first-party sales" : ""} = ${computed}`);
    const eco = path.join(lensDirs.ecosystem, rec.id + ".json");
    if (!fs.existsSync(eco)) errs.push("salesEnabled needs research/lenses/ecosystem/<id>.json");
    else {
      const e = JSON.parse(fs.readFileSync(eco, "utf8")).ecosystem || {};
      if (!sameAmount(e.measure?.value, se.measureValue)) errs.push(`salesEnabled.measureValue ${se.measureValue} ≠ ecosystem.measure.value ${e.measure?.value}`);
      if (!sameAmount(e.platformRevenue?.value, se.platformRevenue)) errs.push(`salesEnabled.platformRevenue ${se.platformRevenue} ≠ ecosystem.platformRevenue.value ${e.platformRevenue?.value}`);
    }
  }
  if (rec.currency !== "USD") {
    const rate = fxRates().rates?.[rec.currency]?.[String(fxYear(rec.fiscalYearEnd))];
    if (!rate || typeof rate.perUSD !== "number" || !(rate.perUSD > 0)) errs.push(`no ${rec.currency} rate for ${fxYear(rec.fiscalYearEnd)} in _fx.json`);
  }
  sourcesIn(rec, "", errs, facts, links);
  if (rec.researchedAt && !/^\d{4}-\d{2}-\d{2}$/.test(rec.researchedAt)) warns.push("researchedAt should be YYYY-MM-DD");
  result.links = [...links];
  return result;
}

export function validateOwnersFile(id) {
  const file = path.join(extraLensDirs.owners, id + ".json");
  const result = {dirKey: "owners", id, file, exists: fs.existsSync(file), errs: [], warns: [], facts: [], links: []};
  if (!result.exists) return result;
  const {errs, facts} = result, links = new Set();
  let rec;
  try { rec = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { errs.push(`invalid JSON (${e.message})`); return result; }
  result.record = rec;
  if (!ids.has(rec.id)) errs.push(`id "${rec.id}" not in data.js`);
  if (path.basename(file, ".json") !== rec.id) errs.push("file name must equal id");
  if (!rec.company) errs.push("missing company");
  for (const k of ["nbim", "calpers", "holdersOfRecord"]) if (rec[k] === undefined) errs.push(`${k} missing (use null when there is none)`);
  const date = (v, where) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) errs.push(`${where} must be YYYY-MM-DD`); };
  if (rec.nbim) {
    num(rec.nbim.pct, "nbim.pct", errs, {nullable: false, max: 100});
    date(rec.nbim.asOf, "nbim.asOf");
    if (!rec.nbim.source) errs.push("nbim.source missing");
  }
  if (rec.calpers) {
    const c = rec.calpers;
    if (!Number.isInteger(c.shares) || c.shares <= 0) errs.push("calpers.shares must be a positive integer");
    date(c.asOf, "calpers.asOf");
    if (!c.source) errs.push("calpers.source missing");
    if (!c.derived || typeof c.derived !== "object") errs.push("calpers.derived missing");
    else {
      num(c.derived.pct, "calpers.derived.pct", errs, {nullable: false, max: 100});
      if (!c.derived.method) errs.push("calpers.derived.method missing");
      if (!Array.isArray(c.derived.inputs) || !c.derived.inputs.length) errs.push("calpers.derived.inputs must list the share-count source");
    }
    if (c.basis != null && c.basis !== "class") errs.push(`calpers.basis must be "class" or absent`);
    if (c.basis === "class" && !c.classLabel) errs.push("calpers.classLabel missing (required with basis: class)");
  }
  if (rec.holdersOfRecord) {
    if (!Number.isInteger(rec.holdersOfRecord.count) || rec.holdersOfRecord.count <= 0) errs.push("holdersOfRecord.count must be a positive integer");
    date(rec.holdersOfRecord.asOf, "holdersOfRecord.asOf");
    if (!rec.holdersOfRecord.source) errs.push("holdersOfRecord.source missing");
  }
  sourcesIn(rec, "", errs, facts, links);
  result.links = [...links];
  return result;
}

// research/lenses/networth/<id>.json: a third-party estimate of the leader's personal net worth.
// { "id", "name", "netWorth": { "value": <billions USD>, "currency": "USD", "asOf": "YYYY-MM-DD" | "YYYY-MM",
//   "publisher": "Forbes" (optional; else read from the source URL), "list": "<the list's name>" (optional),
//   "rank": <list rank> (optional), "source": { "hostType": "publisher", "url", "label", "quote" } } | null,
//   "reason": "deceased" | "not on the 2025 list" | null, "notes", "researchedAt" }
// netWorth null, or a null value with a reason, means no estimate; the profile then omits the line. Never a
// figure from memory. A list entry named "… & family" (in the quote) is a family fortune and is labelled so.
export const NETWORTH_PUBLISHERS = {"forbes.com": "Forbes"};
export function networthPublisher(netWorth) {
  if (netWorth?.publisher) return String(netWorth.publisher);
  if (netWorth?.source?.publisher) return String(netWorth.source.publisher);
  let host = "";
  try { host = new URL(netWorth?.source?.url || "").hostname.replace(/^www\./, ""); } catch {}
  return NETWORTH_PUBLISHERS[host] || "";
}
export function validateNetworthFile(id) {
  const file = path.join(extraLensDirs.networth, id + ".json");
  const result = {dirKey: "networth", id, file, exists: fs.existsSync(file), errs: [], warns: [], facts: [], links: []};
  if (!result.exists) return result;
  const {errs, warns, facts} = result, links = new Set();
  let rec;
  try { rec = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { errs.push(`invalid JSON (${e.message})`); return result; }
  result.record = rec;
  if (!ids.has(rec.id)) errs.push(`id "${rec.id}" not in data.js`);
  if (path.basename(file, ".json") !== rec.id) errs.push("file name must equal id");
  if (rec.netWorth === undefined) errs.push("netWorth missing (use null when no estimate was found)");
  // A leader not on the list (or deceased) has a null value and a reason; nothing is published for them.
  const nw = rec.netWorth;
  if (nw != null && nw.value == null && !rec.reason) errs.push("netWorth.value is null without a reason");
  if (nw != null && nw.value != null) {
    if (typeof nw !== "object") errs.push("netWorth must be an object or null");
    else {
      num(nw.value, "netWorth.value", errs, {nullable: false, min: 0.001, max: 5000});
      if (nw.currency != null && nw.currency !== "USD") errs.push(`netWorth.currency must be "USD" (value in billions of USD)`);
      if (nw.unit != null && nw.unit !== "billions") errs.push(`netWorth.unit must be "billions"`);
      if (!/^\d{4}-\d{2}(-\d{2})?$/.test(nw.asOf || "")) errs.push("netWorth.asOf must be YYYY-MM-DD or YYYY-MM");
      // The quote is the person's verbatim record in the list's JSON, which can include a long bio before the name.
      checkSource(nw.source, "netWorth", errs, facts, links, NETWORTH_HOSTS, 1500);
      if (!networthPublisher(nw)) errs.push("netWorth.publisher missing (and the source URL is not a known publisher)");
    }
  }
  for (const key of Object.keys(rec)) if (!["id", "name", "netWorth", "reason", "notes", "researchedAt"].includes(key)) warns.push(`unknown key ${key}`);
  if (rec.researchedAt && !/^\d{4}-\d{2}-\d{2}$/.test(rec.researchedAt)) warns.push("researchedAt should be YYYY-MM-DD");
  result.links = [...links];
  return result;
}

// The shared files: FX rates and the asset-manager list.
// Market value inputs: shares outstanding per share class, each priced from one listed line on the edition date.
// The build computes value = Σ shares × perListedUnit × close(pricedAs) ÷ FX, using _prices.json.
export function validateMarketcapFile(id) {
  const file = path.join(extraLensDirs.marketcap, id + ".json");
  const result = {dirKey: "marketcap", id, file, exists: fs.existsSync(file), errs: [], warns: [], facts: [], links: []};
  if (!result.exists) return result;
  const {errs, warns, facts} = result, links = new Set();
  let rec;
  try { rec = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { errs.push(`invalid JSON (${e.message})`); return result; }
  result.record = rec;
  if (!ids.has(rec.id)) errs.push(`id "${rec.id}" not in data.js`);
  if (path.basename(file, ".json") !== rec.id) errs.push("file name must equal id");
  if (!Array.isArray(rec.classes) || !rec.classes.length) errs.push("classes must be a non-empty array");
  for (const [i, c] of (rec.classes || []).entries()) {
    const w = `classes[${i}]`;
    if (!c.label) errs.push(`${w}.label missing`);
    num(c.shares, `${w}.shares`, errs, {nullable: false, min: 1, max: 1e13});
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.sharesAsOf || "")) errs.push(`${w}.sharesAsOf must be YYYY-MM-DD`);
    else if (c.sharesAsOf < "2025-12-01") warns.push(`${w}.sharesAsOf ${c.sharesAsOf} is old: use the latest filing cover page or exchange return`);
    if (!c.pricedAs || typeof c.pricedAs !== "string") errs.push(`${w}.pricedAs missing (the market symbol whose close prices this class)`);
    num(c.perListedUnit ?? 1, `${w}.perListedUnit`, errs, {nullable: false, min: 1e-6, max: 1e6});
    if (c.pricedAs && c.pricedAsReason == null && c.perListedUnit != null && c.perListedUnit !== 1) warns.push(`${w}: perListedUnit ≠ 1 without pricedAsReason`);
    if (c.computedFrom) { if (!Array.isArray(c.computedFrom) || c.computedFrom.length < 2) errs.push(`${w}.computedFrom must list the quoted parts`); else c.computedFrom.forEach((part, k) => checkSource(part.source, `${w}.computedFrom[${k}]`, errs, facts, links)); }
    else checkSource(c.source, w, errs, facts, links);
  }
  for (const key of Object.keys(rec)) if (!["id", "company", "classes", "notes", "researchedAt"].includes(key)) warns.push(`unknown key ${key}`);
  result.links = [...links];
  return result;
}

// Employees and pay. payroll.method: "personnel-expense" (total staff costs as reported, billions of currency)
// or "median-pay" (the CEO pay ratio disclosure's median employee pay, in units of currency; the build multiplies it by employees).
const PAY_METHODS = ["personnel-expense", "median-pay"];
export function validatePayFile(id) {
  const file = path.join(extraLensDirs.pay, id + ".json");
  const result = {dirKey: "pay", id, file, exists: fs.existsSync(file), errs: [], warns: [], facts: [], links: []};
  if (!result.exists) return result;
  const {errs, warns, facts} = result, links = new Set();
  let rec;
  try { rec = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { errs.push(`invalid JSON (${e.message})`); return result; }
  result.record = rec;
  if (!ids.has(rec.id)) errs.push(`id "${rec.id}" not in data.js`);
  if (path.basename(file, ".json") !== rec.id) errs.push("file name must equal id");
  for (const k of ["company", "fiscalYear", "fiscalYearEnd", "currency", "researchedAt"]) if (rec[k] == null) errs.push(`missing ${k}`);
  const e = rec.employees;
  if (!e) errs.push("employees missing");
  else {
    num(e.value, "employees.value", errs, {nullable: false, min: 1, max: 1e8});
    if (!e.basis) errs.push("employees.basis missing (the company's own wording, e.g. 'full-time equivalent employees')");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.asOf || "")) errs.push("employees.asOf must be YYYY-MM-DD");
    checkSource(e.source, "employees", errs, facts, links);
  }
  const p = rec.payroll;
  if (p != null) {
    if (!PAY_METHODS.includes(p.method)) errs.push(`payroll.method must be one of ${PAY_METHODS.join("|")}`);
    if (!p.label) errs.push("payroll.label missing (the line's own name)");
    if (p.method === "personnel-expense") num(p.value, "payroll.value", errs, {nullable: false, min: 0.0001, max: 1e7});
    if (p.method === "median-pay") num(p.value, "payroll.value", errs, {nullable: false, min: 1000, max: 1e9});
    if (p.period != null && !/^FY/.test(String(p.period))) warns.push("payroll.period should be the fiscal-year label, e.g. FY2025");
    if (p.computedFrom) { if (!Array.isArray(p.computedFrom) || p.computedFrom.length < 2) errs.push("payroll.computedFrom must list the quoted parts"); else p.computedFrom.forEach((part, k) => checkSource(part.source, `payroll.computedFrom[${k}]`, errs, facts, links)); }
    else checkSource(p.source, "payroll", errs, facts, links);
  } else if (!rec.notes) errs.push("payroll is null without notes saying why");
  for (const key of Object.keys(rec)) if (!["id", "company", "fiscalYear", "fiscalYearEnd", "currency", "employees", "payroll", "notes", "researchedAt"].includes(key)) warns.push(`unknown key ${key}`);
  result.links = [...links];
  return result;
}

export function validateSharedFiles() {
  const out = [];
  for (const [label, file, check] of [
    ["paidout/_fx", fxFile, (data, errs, facts, links) => {
      for (const [currency, years] of Object.entries(data.rates || {})) for (const [year, rate] of Object.entries(years)) {
        if (!(typeof rate.perUSD === "number" && rate.perUSD > 0)) errs.push(`${currency} ${year}: perUSD must be a positive number`);
        if (rate.calendarYear !== Number(year)) errs.push(`${currency} ${year}: calendarYear must equal its key`);
        sourcesIn(rate.source, `${currency}.${year}.source`, errs, facts, links);
        if (rate.source?.hostType !== "regulator") errs.push(`${currency} ${year}: FX source must be a regulator (Federal Reserve or IRS)`);
      }
    }],
    ["owners/_managers", managersFile, (data, errs, facts, links) => {
      if (!Array.isArray(data)) return errs.push("must be an array");
      data.forEach((m, i) => {
        if (!m.name || !m.investsFor) errs.push(`[${i}] name and investsFor required`);
        if (!Array.isArray(m.matches) || !m.matches.length) errs.push(`[${i}] matches must list holder names`);
        sourcesIn(m.source, `[${i}].source`, errs, facts, links);
        if (!m.source) errs.push(`[${i}] source missing`);
      });
    }]
  ]) {
    const errs = [], facts = [], links = new Set();
    if (!fs.existsSync(file)) { out.push({label, errs: ["missing"], facts, links: []}); continue; }
    try { check(JSON.parse(fs.readFileSync(file, "utf8")), errs, facts, links); } catch (e) { errs.push(`invalid JSON (${e.message})`); }
    out.push({label, errs, facts, links: [...links]});
  }
  return out;
}

// Every leader id that has at least one lens file.
export function lensIds() {
  const found = new Set();
  for (const dir of [...Object.values(lensDirs), ...Object.values(extraLensDirs)]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".json") && !f.startsWith("_")) found.add(path.basename(f, ".json"));
  }
  return [...found].sort();
}

async function extraChecks(r, checkXbrl, checkLinks) {
  if (checkXbrl) for (const fact of r.facts) { const e = await verifyFact(fact); if (e) r.errs.push(`xbrl ${fact.where}: ${e}`); }
  if (checkLinks) for (const url of r.links) {
    try { const res = await fetch(url, {headers: {"User-Agent": UA}, redirect: "follow"}); if (res.status >= 400) r.errs.push(`link ${res.status}: ${url}`); }
    catch (e) { r.errs.push(`link error: ${url} (${e.message})`); }
  }
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
    // Paid out, owners and net worth: one lens per file.
    for (const [dirKey, validate] of [["paidout", validatePaidoutFile], ["owners", validateOwnersFile], ["networth", validateNetworthFile], ["marketcap", validateMarketcapFile], ["pay", validatePayFile]]) {
      const r = validate(id);
      if (!r.exists) continue;
      files++;
      await extraChecks(r, checkXbrl, checkLinks);
      if (r.errs.length) failed++;
      if (asJson) { console.log(JSON.stringify({id, file: dirKey, ok: !r.errs.length, errs: r.errs, warns: r.warns})); continue; }
      const facts = r.facts.length ? `, ${r.facts.length} xbrl facts${checkXbrl ? " checked" : ""}` : "";
      console.log(`${r.errs.length ? "✗" : "✓"} ${dirKey}/${id}  (${r.links.length} sources${facts})`);
      r.errs.forEach(e => console.log("    error: " + e));
      r.warns.forEach(w => console.log("    warn:  " + w));
    }
  }
  if (!only.length) for (const r of validateSharedFiles()) {
    files++;
    await extraChecks(r, checkXbrl, checkLinks);
    if (r.errs.length) failed++;
    if (asJson) { console.log(JSON.stringify({file: r.label, ok: !r.errs.length, errs: r.errs})); continue; }
    console.log(`${r.errs.length ? "✗" : "✓"} ${r.label}  (${r.links.length} sources)`);
    r.errs.forEach(e => console.log("    error: " + e));
  }
  if (!asJson) console.log(`\n${files - failed}/${files} lens files valid`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

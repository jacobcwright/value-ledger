#!/usr/bin/env node
// Validates research/lenses/footprint/<id>.json against research/FOOTPRINT.md, with the same source rules
// as validate-records.mjs and validate-lenses.mjs (hostType, https, label, verbatim quote, no mirrors).
// Usage: node scripts/validate-footprint.mjs [--json] [ids...]
//
// Errors come in two kinds, so the build can publish what is sound:
// - file errors (bad JSON, wrong id, a malformed metric, a layer that is not an array or null) skip the file;
// - row errors (a bad source, an unknown metric key, an invalid state or country code, a number missing
//   from its quote) drop only that row.
// The CLI exits 1 when any file has an error of either kind.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const footprintDir = path.join(root, "research/lenses/footprint");

const leaders = new Function(fs.readFileSync(path.join(root, "dist/data.js"), "utf8") + ";return leaders")();
const ids = new Set(leaders.map(l => l.id));

// Same source rules as the other validators.
const HOSTS = ["sec","company","exchange","regulator"];
const MIRRORS = /dfcfw\.com|9to5mac|seekingalpha|marketscreener|macrotrends|stockanalysis|companiesmarketcap|wsj\.com|reuters\.com|bloomberg|yahoo\.|investing\.com|wikipedia|annualreports\.com|last10k|fintel|gurufocus/;
// The five units FOOTPRINT.md names, plus scaled forms researchers have used. A metric with any other unit is
// dropped with its values, not the whole file. UNIT_SCALE turns a unit's numbers into plain units.
export const FOOTPRINT_UNITS = ["count","people","currency-millions","currency-billions","percent",
  "count-thousands","people-thousands","currency","currency-thousands","currency-per-hour","square-feet","square-feet-millions"];
export const UNIT_SCALE = {"count-thousands":1e3, "people-thousands":1e3, "currency-thousands":1e3, "currency-millions":1e6, "currency-billions":1e9, "square-feet-millions":1e6};
// What one stored unit is worth in plain units. An explicit metrics[key].scale (1e3, 1e6…) wins; then the
// unit's own scale; then a label such as "MAUs (millions)" or "RGUs, in thousands" for numbers stored as filed.
// The same rule is in dist/company-footprint.js (cfScaleOf).
export function metricScale(metric) {
  if (Number.isFinite(metric?.scale) && metric.scale > 0) return metric.scale;
  if (UNIT_SCALE[metric?.unit]) return UNIT_SCALE[metric.unit];
  const label = String(metric?.label || "");
  if (/\((?:in )?millions\)|\bin millions\b/i.test(label)) return 1e6;
  if (/\((?:in )?thousands\)|\bin thousands\b/i.test(label)) return 1e3;
  if (/\((?:in )?billions\)|\bin billions\b/i.test(label)) return 1e9;
  return 1;
}
export const FOOTPRINT_TIERS = ["filing","company-published","company-commissioned","regulator"];
export const FOOTPRINT_LAYERS = ["usStates","countries","regions","sites"];
export const US_STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));
// ISO 3166-1 alpha-2 officially assigned codes, plus XK (Kosovo, user-assigned but widely used, and the code Natural Earth gives it).
export const ISO2 = new Set(("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK").split(" "));
const MAX_SITES = 12;

export function checkSource(src, where, errs) {
  if (!src || typeof src !== "object") return errs.push(`${where}: missing source`);
  if (!/^https:\/\/[^\s]+$/.test(src.url || "")) errs.push(`${where}: source.url must be https`);
  if (/^https:\/\/(www\.)?(google|bing)\.[a-z.]+\/(search|url)\b|duckduckgo\./.test(src.url || "")) errs.push(`${where}: source.url is a search page`);
  if (!src.label) errs.push(`${where}: source.label missing`);
  if (!HOSTS.includes(src.hostType)) errs.push(`${where}: source.hostType must be one of ${HOSTS.join("|")}`);
  if (MIRRORS.test(src.url || "")) errs.push(`${where}: source.url is a mirror/aggregator, not a primary document`);
  if (!src.quote || src.quote.length < 8) errs.push(`${where}: source.quote missing or too short`);
  if (src.quote && src.quote.length > 600) errs.push(`${where}: source.quote too long`);
}

// ---- Numbers in quotes ----------------------------------------------------------------------
// Every number a row reports must appear in its quote as a whole number token (136 never matches inside
// 1,136), written plainly ("56,000", "56 000", "1.234,5") or scaled ("$3.4 billion" for 3,400 in
// currency-millions, "$187 million" for 0.187 in currency-billions, "$183,718" for 0.183718 in
// currency-millions, "12K"). A zero may be written as a dash or "none". Text in [square brackets] is the
// researcher's annotation, not quoted text (as in scripts/verify-quotes.mjs), so it never counts.
// A bracket holding a double quote is quoted JSON (an API or chart-data row), not an annotation.
const stripNotes = quote => String(quote || "").replace(/\[[^\]"]*\]/g, " ");
const SCALES = {thousand:1e3, k:1e3, million:1e6, mn:1e6, m:1e6, mio:1e6, billion:1e9, bn:1e9, b:1e9, trillion:1e12, tn:1e12, t:1e12, crore:1e7, lakh:1e5};
function readings(token) {
  // A token such as "1,234.5", "1.234,5", "56 000" or "2,1". Return every plausible numeric reading.
  const out = new Set();
  const add = text => { const n = Number(text); if (Number.isFinite(n)) out.add(n); };
  const compact = token.replace(/[\s   ]/g, "");
  add(compact.replace(/,/g, ""));                              // 1,234.5 -> 1234.5
  add(compact.replace(/\./g, "").replace(",", "."));            // 1.234,5 -> 1234.5
  if (/^\d+,\d{1,2}$/.test(compact)) add(compact.replace(",", ".")); // 2,1 -> 2.1
  return out;
}
export function quoteNumbers(quote) {
  const text = stripNotes(quote);
  const found = [];
  // Digits with internal separators; a space joins only groups of exactly three digits ("56 000").
  const re = /\d+(?:(?:[.,]|[\s   ](?=\d{3}(?!\d)))\d+)*/g;
  for (const match of text.matchAll(re)) {
    // Not part of a longer alphanumeric token (e.g. "FY2024" stays a number, "A320neo" too: harmless).
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 16);
    const scaleWord = /^\s?(thousand|million|billion|trillion|crore|lakh|mio|mn|bn|tn|[kmbt])\b/i.exec(after);
    const scale = scaleWord ? SCALES[scaleWord[1].toLowerCase()] : 1;
    // A run such as "117,927 120,756 125,297" (table columns) is also read one column at a time.
    const pieces = new Set([match[0], ...match[0].split(/[\s   ]+/)]);
    for (const piece of pieces) for (const n of readings(piece)) found.push({raw: n, abs: n * scale});
  }
  return found;
}
// Small counts are often spelled out ("nine of our fabs").
const NUMBER_WORDS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");
const close = (a, b) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-9);
export function numberInQuote(value, scale, quote) {
  const v = Math.abs(value);
  const abs = v * (typeof scale === "number" ? scale : UNIT_SCALE[scale] || 1);
  if (v === 0 && /(^|[\s(|])(?:[-–—]|none|nil|zero)(?=$|[\s)|,.;])/i.test(stripNotes(quote))) return true;
  // A table "in thousands" (or an API field in $ thousands, explained in a bracketed note) states its
  // scale once rather than next to each number: then a token may be the value in thousands, millions or billions.
  const text = String(quote || "");
  const scaled = /thousand|million|billion|\$\s?000s?\b|\b000s\b/i.test(text);
  const factors = [1e3, 1e6, 1e9, ...(/ten[-\s]thousands?/i.test(text) ? [1e4] : [])];
  if (Number.isInteger(v) && v <= 20 && new RegExp(`\\b${NUMBER_WORDS[v]}\\b`, "i").test(stripNotes(quote))) return true;
  return quoteNumbers(quote).some(n => close(n.raw, v) || close(n.abs, abs) || (scaled && factors.some(k => close(n.raw * k, abs))));
}

// ---- Rows -----------------------------------------------------------------------------------
function checkValues(row, where, metrics, bad, errs, drops, {needsValue = true} = {}) {
  if (row.values == null || typeof row.values !== "object" || Array.isArray(row.values)) {
    if (needsValue) errs.push(`${where}.values must be an object`);
    return;
  }
  let numbers = 0;
  for (const [key, value] of Object.entries(row.values)) {
    if (!metrics[key]) { errs.push(`${where}.values.${key}: no such metric in metrics`); continue; }
    // A metric that failed is reported once, under metrics; its values are dropped, not the row.
    if (value === null || bad.has(key)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) { errs.push(`${where}.values.${key}: must be a number or null`); continue; }
    const unit = metrics[key].unit;
    if (value < 0 && !String(unit).startsWith("currency")) errs.push(`${where}.values.${key}: ${value} is negative`);
    if (unit === "percent" && value > 100) errs.push(`${where}.values.${key}: ${value}% is over 100`);
    // A number missing from its quote is dropped on its own; the row's other numbers can still publish.
    if (row.source?.quote && !numberInQuote(value, metricScale(metrics[key]), row.source.quote)) { drops.push([key, `${where}.values.${key}: ${value} not found in the quote`]); continue; }
    numbers++;
  }
  if (needsValue && !numbers) errs.push(`${where}: no values${drops.length ? " found in the quote" : Object.keys(row.values).some(key => bad.has(key)) ? " (its metrics failed)" : ""}`);
  if (row.plus != null) {
    if (typeof row.plus !== "object" || Array.isArray(row.plus)) errs.push(`${where}.plus must be an object`);
    else for (const [key, flag] of Object.entries(row.plus)) {
      if (!metrics[key]) errs.push(`${where}.plus.${key}: no such metric in metrics`);
      if (typeof flag !== "boolean") errs.push(`${where}.plus.${key}: must be true or false`);
    }
  }
}
const iso2 = code => typeof code === "string" && ISO2.has(code);

// A place may have several rows (one per quote). The site merges them and shows the first figure for a
// measure; a later figure for the same measure is kept and listed in "How we got these numbers". Repeats are
// noted as warnings so a researcher can check they are intended.
function checkRepeat(place, row, where, seen, warns) {
  const keys = seen.get(place) || new Set();
  const repeated = Object.keys(row.values && typeof row.values === "object" ? row.values : {}).filter(key => keys.has(key));
  if (repeated.length) warns.push(`${where}: ${place} already has ${repeated.join(", ")} in an earlier row (the site shows the first)`);
  Object.keys(row.values || {}).forEach(key => keys.add(key));
  seen.set(place, keys);
}

function checkRow(layer, row, index, metrics, bad, seen, warns, drops) {
  const where = `${layer}[${index}]`;
  const errs = [];
  if (!row || typeof row !== "object") return [`${where}: must be an object`];
  checkSource(row.source, where, errs);
  if (layer === "usStates") {
    if (!US_STATES.has(row.state)) errs.push(`${where}.state "${row.state}" is not a U.S. state or DC postal code`);
    else checkRepeat(row.state, row, where, seen, warns);
    checkValues(row, where, metrics, bad, errs, drops);
  } else if (layer === "countries") {
    if (!iso2(row.iso2)) errs.push(`${where}.iso2 "${row.iso2}" is not an ISO 3166-1 alpha-2 code`);
    else checkRepeat(row.iso2, row, where, seen, warns);
    if (!row.name) errs.push(`${where}.name missing`);
    checkValues(row, where, metrics, bad, errs, drops);
  } else if (layer === "regions") {
    if (!row.name) errs.push(`${where}.name missing`);
    else checkRepeat(row.name, row, where, seen, warns);
    // A sub-national region (a Canadian province, a Mexican state) is tagged with its country.
    if (row.country != null && !iso2(row.country)) errs.push(`${where}.country "${row.country}" is not an ISO 3166-1 alpha-2 code`);
    if (row.countries != null) {
      if (!Array.isArray(row.countries) || !row.countries.length) errs.push(`${where}.countries must be a list of ISO codes or null`);
      else row.countries.filter(code => !iso2(code)).forEach(code => errs.push(`${where}.countries: "${code}" is not an ISO 3166-1 alpha-2 code`));
    }
    checkValues(row, where, metrics, bad, errs, drops);
  } else if (layer === "sites") {
    if (!row.name) errs.push(`${where}.name missing`);
    if (!row.description) errs.push(`${where}.description missing (the company's own words)`);
    if (row.state != null && !US_STATES.has(row.state)) errs.push(`${where}.state "${row.state}" is not a U.S. state or DC postal code`);
    if (row.iso2 != null && !iso2(row.iso2)) errs.push(`${where}.iso2 "${row.iso2}" is not an ISO 3166-1 alpha-2 code`);
    if (row.state != null && row.iso2 != null && row.iso2 !== "US") errs.push(`${where}: state ${row.state} with iso2 ${row.iso2}`);
    if (row.values != null) checkValues(row, where, metrics, bad, errs, drops, {needsValue: false});
  }
  return errs;
}

// Validates one file. Returns {id, file, exists, record, fileErrors, metricErrors: {key: [errs]}, warnings,
// rows: {layer: [{index, errs, drops}]}}. A metric with errors is dropped with its values, a row with errors is
// dropped, and a value listed in drops (its number is not in the quote) is dropped from an otherwise sound row.
export function validateFootprintFile(id) {
  const file = path.join(footprintDir, id + ".json");
  const result = {id, file, exists: fs.existsSync(file), record: null, fileErrors: [], metricErrors: {}, warnings: [], rows: {}};
  if (!result.exists) return result;
  let rec;
  try { rec = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { result.fileErrors.push(`invalid JSON (${e.message})`); return result; }
  result.record = rec;
  const fileErrors = result.fileErrors;
  if (!rec || typeof rec !== "object") { fileErrors.push("must be an object"); return result; }
  if (!ids.has(rec.id)) fileErrors.push(`id "${rec.id}" not in data.js`);
  if (rec.id !== id) fileErrors.push("file name must equal id");
  if (!rec.company) fileErrors.push("company missing");
  if (!rec.researchedAt) result.warnings.push("researchedAt missing");
  const metrics = rec.metrics && typeof rec.metrics === "object" && !Array.isArray(rec.metrics) ? rec.metrics : null;
  if (!metrics) fileErrors.push("metrics must be an object (use {} when nothing is published)");
  for (const [key, metric] of Object.entries(metrics || {})) {
    const where = `metrics.${key}`, errs = [];
    if (!metric || typeof metric !== "object") errs.push(`${where} must be an object`);
    else {
      if (!metric.label) errs.push(`${where}.label missing`);
      if (!FOOTPRINT_UNITS.includes(metric.unit)) errs.push(`${where}.unit "${metric.unit}" must be one of ${FOOTPRINT_UNITS.join("|")}`);
      if (!FOOTPRINT_TIERS.includes(metric.tier)) errs.push(`${where}.tier must be one of ${FOOTPRINT_TIERS.join("|")}`);
      if (String(metric.unit).startsWith("currency") && !/^[A-Z]{3}$/.test(metric.currency || "")) errs.push(`${where}.currency must be an ISO code for a currency unit`);
      if (metric.scale != null && !(Number.isFinite(metric.scale) && metric.scale > 0 && Number.isInteger(Math.log10(metric.scale)))) errs.push(`${where}.scale must be a power of ten such as 1000 or 1000000`);
      if (metric.scale != null && metric.scale !== 1 && UNIT_SCALE[metric.unit] && metric.scale !== UNIT_SCALE[metric.unit]) errs.push(`${where}.scale ${metric.scale} contradicts unit ${metric.unit}`);
      if (!metric.period) result.warnings.push(`${where}.period missing`);
      if (!metric.definition) result.warnings.push(`${where}.definition missing`);
    }
    if (errs.length) result.metricErrors[key] = errs;
  }
  const bad = new Set(Object.keys(result.metricErrors));
  for (const layer of FOOTPRINT_LAYERS) {
    const rows = rec[layer];
    if (rows === undefined) { result.warnings.push(`${layer} missing (use null when nothing is published)`); continue; }
    if (rows === null) continue;
    if (!Array.isArray(rows)) { fileErrors.push(`${layer} must be an array or null`); continue; }
    if (layer === "sites" && rows.length > MAX_SITES) result.warnings.push(`sites: ${rows.length} listed, only the first ${MAX_SITES} are published`);
    const seen = new Map();
    result.rows[layer] = rows.map((row, index) => {
      const drops = [];
      const errs = metrics ? checkRow(layer, row, index, metrics, bad, seen, result.warnings, drops) : [];
      return {index, errs, drops: drops.map(([key]) => key), dropErrors: drops.map(([, message]) => message)};
    });
  }
  return result;
}

export function footprintIds() {
  if (!fs.existsSync(footprintDir)) return [];
  return fs.readdirSync(footprintDir).filter(f => f.endsWith(".json") && !f.startsWith("_")).map(f => path.basename(f, ".json")).sort();
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const only = args.filter(a => !a.startsWith("--"));
  const targets = only.length ? only : footprintIds();
  let failed = 0, files = 0;
  for (const id of targets) {
    const r = validateFootprintFile(id);
    if (!r.exists) { console.log(`- ${id}: no footprint file`); continue; }
    files++;
    const rowErrors = Object.entries(r.rows).flatMap(([, rows]) => rows.flatMap(row => [...row.errs, ...row.dropErrors.map(e => e + " (value dropped)")]));
    const metricErrors = Object.values(r.metricErrors).flat();
    const bad = r.fileErrors.length || metricErrors.length || rowErrors.length;
    if (bad) failed++;
    const counts = Object.fromEntries(Object.entries(r.rows).map(([layer, rows]) => [layer, {rows: rows.length, ok: rows.filter(row => !row.errs.length).length}]));
    if (asJson) { console.log(JSON.stringify({id, ok: !bad, fileErrors: r.fileErrors, metricErrors, rowErrors, warnings: r.warnings, counts})); continue; }
    console.log(`${bad ? "✗" : "✓"} footprint/${id}  ${Object.entries(counts).map(([layer, c]) => `${layer} ${c.ok}/${c.rows}`).join(" · ") || "no rows"}`);
    r.fileErrors.forEach(e => console.log("    error: " + e));
    metricErrors.forEach(e => console.log("    metric error (metric dropped): " + e));
    rowErrors.forEach(e => console.log("    row error: " + e));
    r.warnings.forEach(w => console.log("    warn:  " + w));
  }
  if (!asJson) console.log(`\n${files - failed}/${files} footprint files valid`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

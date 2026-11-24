#!/usr/bin/env node
// Stamps the edition's ranking figures into dist/data.js from the research lenses:
//   cap      Σ shares × perListedUnit × close ÷ divisor ÷ (currency per USD)   research/lenses/marketcap + _prices.json
//   jobs     employees.value                                                   research/lenses/pay
//   payroll  personnel expense ÷ FX (fiscal-year average)                      research/lenses/pay + paidout/_fx.json
//            or median pay × employees ÷ FX                                    (labelled by payBasis)
// It also writes the `edition` object (research/edition.json) at the top of data.js.
// --strict fails when any leader lacks a marketcap or pay lens (the release build uses it).
import fs from "node:fs";
import path from "node:path";
import {fxRates, fxYear} from "./validate-lenses.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const strict = process.argv.includes("--strict");
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const edition = read("research/edition.json");
const prices = fs.existsSync(path.join(root, "research/lenses/marketcap/_prices.json")) ? read("research/lenses/marketcap/_prices.json") : {symbols: {}, fx: {}};
const fx = fxRates().rates;
const dataPath = path.join(root, "dist/data.js");
const src = fs.readFileSync(dataPath, "utf8");
const lines = src.split("\n");
const problems = [], stats = {cap: 0, pay: 0, payNull: 0};

function capFor(id) {
  const f = `research/lenses/marketcap/${id}.json`;
  if (!fs.existsSync(path.join(root, f))) return null;
  const rec = read(f);
  let usd = 0;
  for (const c of rec.classes) {
    const p = prices.symbols[c.pricedAs];
    if (!p || p.error) throw new Error(`${id}: no ${edition.pricesAsOf} close for ${c.pricedAs} in _prices.json (run scripts/refresh-prices.mjs)`);
    const perUSD = p.currency === "USD" ? 1 : prices.fx[p.currency]?.perUSD;
    if (!perUSD) throw new Error(`${id}: no H.10 rate for ${p.currency}`);
    usd += c.shares * (c.perListedUnit ?? 1) * (p.close / (p.divisor || 1)) / perUSD;
  }
  return {cap: Math.round(usd / 1e8) / 10, capUrl: rec.classes[0].source?.url || rec.classes[0].computedFrom?.[0]?.source?.url};
}
function payFor(id) {
  const f = `research/lenses/pay/${id}.json`;
  if (!fs.existsSync(path.join(root, f))) return null;
  const rec = read(f);
  const out = {jobs: rec.employees.value, jobsUrl: rec.employees.source.url, payBasis: rec.payroll?.method || null, payroll: null, wage: null};
  if (rec.payroll) {
    const perUSD = rec.currency === "USD" ? 1 : fx[rec.currency]?.[String(fxYear(rec.fiscalYearEnd))]?.perUSD;
    if (!perUSD) throw new Error(`${id}: no ${rec.currency} rate for ${fxYear(rec.fiscalYearEnd)} in _fx.json`);
    const local = rec.payroll.method === "personnel-expense" ? rec.payroll.value * 1e9 : rec.payroll.value * rec.employees.value;
    out.payroll = Math.round(local / perUSD / 1e7) / 100;   // USD billions, 2 decimals
    out.wage = Math.round(local / perUSD / rec.employees.value / 100) * 100;
    if (rec.payroll.method === "median-pay") out.wage = Math.round(rec.payroll.value / perUSD / 100) * 100;
  }
  return out;
}

// _fx.json lists, for each currency-year, the paid-out files converted with it (build-companies checks this),
// so it is rewritten here from the paid-out files themselves: one fiscal-year rule, one place.
{
  const fxPath = path.join(root, "research/lenses/paidout/_fx.json");
  const fxFile = JSON.parse(fs.readFileSync(fxPath, "utf8"));
  for (const years of Object.values(fxFile.rates)) for (const r of Object.values(years)) r.usedFor = [];
  const dir = path.join(root, "research/lenses/paidout");
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json") && !f.startsWith("_")).sort()) {
    const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (!rec.currency || rec.currency === "USD" || !rec.fiscalYearEnd) continue;
    const rate = fxFile.rates[rec.currency]?.[String(fxYear(rec.fiscalYearEnd))];
    if (rate) rate.usedFor.push(`${rec.id} (${rec.fiscalYear}, FYE ${rec.fiscalYearEnd})`);
    else problems.push(`${rec.id}: no ${rec.currency} ${fxYear(rec.fiscalYearEnd)} rate in _fx.json`);
  }
  fs.writeFileSync(fxPath, JSON.stringify(fxFile, null, 1) + "\n");
}

const out = lines.map(line => {
  const m = line.match(/^(\s*)(\{"id":"[^"]+".*\})(,?)\s*$/);
  if (!m) return line;
  const leader = JSON.parse(m[2]);
  let cap = null, pay = null;
  try { cap = capFor(leader.id); } catch (e) { if (strict) throw e; problems.push(e.message); }
  try { pay = payFor(leader.id); } catch (e) { if (strict) throw e; problems.push(e.message); }
  if (cap) { Object.assign(leader, cap, {capAsOf: edition.pricesAsOf}); stats.cap++; } else if (!problems.some(p => p.startsWith(leader.id))) problems.push(`${leader.id}: no marketcap lens`);
  if (pay) {
    Object.assign(leader, pay); stats.pay++; if (pay.payroll == null) stats.payNull++;
  } else problems.push(`${leader.id}: no pay lens`);
  return m[1] + JSON.stringify(leader) + m[3];
});
let text = out.join("\n");
const editionLine = `const edition = ${JSON.stringify({label: edition.label, eyebrow: edition.eyebrow, pricesAsOf: edition.pricesAsOf, pricesAsOfLabel: edition.pricesAsOfLabel, netWorthAsOf: edition.netWorthAsOf, netWorthList: edition.netWorthList})};`;
text = /^const edition = .*;$/m.test(text) ? text.replace(/^const edition = .*;$/m, editionLine) : text.replace(/^(\/\/[^\n]*\n)/, `$1${editionLine}\n`);
// payroll is reported (or reported median × employees) and may be null where nothing is disclosed
text = text.replace(/^for \(const leader of leaders\) leader\.payroll = .*$/m, "for (const leader of leaders) if (leader.payroll === undefined) leader.payroll = leader.jobs * leader.wage / 1e9;");
fs.writeFileSync(dataPath, text);

// The list-wide headline figures in the pages' <head> copy and the share card, rounded exactly as app.js's
// headlineFigure() rounds the key line, so the meta copy and the page always agree.
const leaders = new Function(text + ";return leaders")();
const oneDecimal = n => n.toFixed(1).replace(/\.0$/, "");
const total = key => leaders.reduce((t, l) => t + (Number.isFinite(l[key]) ? l[key] : 0), 0);
const capT = oneDecimal(total("cap") / 1e3), jobsM = oneDecimal(total("jobs") / 1e6), payB = String(Math.round(total("payroll")));
for (const page of ["dist/index.html", "dist/methodology.html", "design/og-card.html"]) {
  const file = path.join(root, page);
  const before = fs.readFileSync(file, "utf8");
  const after = before
    .replace(/\$[\d.]+ trillion/g, `$${capT} trillion`)
    .replace(/[\d.]+ million(?= people|<\/strong><span>People employed)/g, `${jobsM} million`)
    .replace(/\$[\d,]+ billion(?= a year|<\/strong><span>Annual pay)/g, `$${payB} billion`);
  if (after !== before) fs.writeFileSync(file, after);
}
console.log(`headline: $${capT} trillion value created · ${jobsM} million people · $${payB} billion pay to workers`);
console.log(`edition ${edition.label}: market value for ${stats.cap}/100, pay lens for ${stats.pay}/100 (${stats.payNull} with no disclosed payroll)`);
if (problems.length) { console.log((strict ? "✗ " : "  pending: ") + problems.length + " leaders without lenses" + (strict ? ":\n  " + problems.join("\n  ") : "")); if (strict) process.exit(1); }

#!/usr/bin/env node
// Offline check: every stored figure must match a number printed in its own quote, allowing for
// units (records store billions; filings print units, thousands or millions) and stated rounding.
// Usage: node scripts/check-values.mjs  → lists mismatches; exit 1 if any.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const files = [];
const walk = dir => { if (!fs.existsSync(dir)) return; for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
  const full = path.join(dir, e.name); if (e.isDirectory()) walk(full); else if (e.name.endsWith(".json") && !e.name.startsWith("_")) files.push(full);
}};
walk(path.join(root, "research/records")); walk(path.join(root, "research/lenses"));

// Indian numbering (6,86,534) and plain grouping both collapse to digits.
const numbersIn = rawQuote => {
  const quote = rawQuote.replace(/\[[^\]]*\]/g, " ").replace(/(\d+) 1\/3/g, "$1.333");
  const plain = (quote.match(/\(?-?\d[\d,]*(?:\.\d+)?\)?/g) || []).map(t => Number(t.replace(/[(),]/g, "")));
  // European / SI grouping: "1 710", "7 624", "1 307" (space, nbsp or thin space as thousands separator)
  const spaced = (quote.match(/(?<![\d,.])\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?![\d,])/g) || []).map(t => Number(t.replace(/\D/g, "")));
  return [...plain, ...spaced].filter(Number.isFinite);
};
const scales = [1, 1e3, 1e6, 1e9, 1e-3, 100, 1e-6, 1e-9, 1e4, 1e-4];
function matches(value, quote) {
  const nums = numbersIn(quote);
  for (const n of nums) for (const k of scales) {
    const scaled = n / k;
    const tol = Math.max(Math.abs(value) * 0.006, 0.0051);
    if (Math.abs(Math.abs(scaled) - Math.abs(value)) <= tol) return true;
  }
  return false;
}

const WORDS = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20};
function matchesRaw(value, rawQuote) {
  // number words ("eight stockholders") and single-digit decimal commas ("1,9 miljarder")
  const quote = rawQuote.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gi, w => String(WORDS[w.toLowerCase()])) + " " + rawQuote.replace(/(\d),(\d)(?!\d)/g, "$1.$2");
  const nums = (quote.replace(/(\d) (\d{3})(?!\d)/g, "$1$2").match(/-?\d[\d,]*(?:\.\d+)?/g) || []).map(t => Number(t.replace(/,/g, "")));
  return nums.some(n => scales.some(k => Math.abs(n / k - value) <= Math.max(Math.abs(value) * 0.006, 0.0051)));
}
const problems = [];
const visit = (node, file, trail) => {
  if (Array.isArray(node)) return node.forEach((n, i) => visit(n, file, `${trail}[${i}]`));
  if (!node || typeof node !== "object") return;
  const src = node.source;
  // footprint rows: { values: { metric: number }, source }
  if (src && typeof src.quote === "string" && node.values && typeof node.values === "object" && !Array.isArray(node.values)) {
    for (const [metric, v] of Object.entries(node.values)) {
      if (typeof v !== "number" || v === 0) continue;
      // bracketed notes are allowed to carry the scale for footprint rows ("[USD millions]"), so check against the raw quote too
      if (!matches(v, src.quote) && !matchesRaw(v, src.quote)) problems.push(`${path.relative(root, file)} ${trail}.values.${metric} = ${v} not found in quote: "${src.quote.slice(0, 140)}"`);
    }
  }
  if (src && typeof src.quote === "string") {
    for (const key of ["value", "pctEconomic", "pctVoting", "pct", "shares", "count"]) {
      const v = node[key];
      if (typeof v !== "number" || v === 0) continue;            // zero is usually "none paid", stated in words
      if (trail.includes("derived")) continue;                    // computed from quoted inputs by design
      if (node.computedFrom && key !== "pct") continue;          // a documented sum of quoted parts
      if (!matches(v, src.quote) && !matchesRaw(v, src.quote)) problems.push(`${path.relative(root, file)} ${trail}.${key} = ${v} not found in quote: "${src.quote.slice(0, 140)}"`);
    }
  }
  for (const [k, v] of Object.entries(node)) if (k !== "source") visit(v, file, trail ? `${trail}.${k}` : k);
};
for (const f of files) visit(JSON.parse(fs.readFileSync(f, "utf8")), f, "");
// Exchange rates: perUSD must equal a rate printed in its quote, or its inverse (the Fed prints EUR, GBP, AUD, NZD as USD per unit).
const fxPath = path.join(root, "research/lenses/paidout/_fx.json");
if (fs.existsSync(fxPath)) {
  const fx = JSON.parse(fs.readFileSync(fxPath, "utf8"));
  for (const [cur, years] of Object.entries(fx.rates || {})) for (const [year, rate] of Object.entries(years)) {
    const nums = (rate.source?.quote?.match(/\d[\d,]*\.\d+/g) || []).map(t => Number(t.replace(/,/g, "")));
    const ok = nums.some(n => Math.abs(n - rate.perUSD) / rate.perUSD < 5e-4 || Math.abs(1 / n - rate.perUSD) / rate.perUSD < 5e-4);
    if (!ok) problems.push(`_fx.json ${cur} ${year} perUSD ${rate.perUSD} not found (directly or inverted) in its quote`);
  }
}
problems.forEach(p => console.log("✗ " + p));
console.log(`\n${problems.length} figure(s) whose value is not visible in their quote`);
process.exit(problems.length ? 1 : 0);

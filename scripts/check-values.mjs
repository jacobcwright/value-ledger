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
const scales = [1, 1e3, 1e6, 1e9, 1e-3, 100];
function matches(value, quote) {
  const nums = numbersIn(quote);
  for (const n of nums) for (const k of scales) {
    const scaled = n / k;
    const tol = Math.max(Math.abs(value) * 0.006, 0.0051);
    if (Math.abs(Math.abs(scaled) - Math.abs(value)) <= tol) return true;
  }
  return false;
}

const problems = [];
const visit = (node, file, trail) => {
  if (Array.isArray(node)) return node.forEach((n, i) => visit(n, file, `${trail}[${i}]`));
  if (!node || typeof node !== "object") return;
  const src = node.source;
  if (src && typeof src.quote === "string") {
    for (const key of ["value", "pctEconomic", "pctVoting"]) {
      const v = node[key];
      if (typeof v !== "number" || v === 0) continue;            // zero is usually "none paid", stated in words
      if (trail.includes("derived")) continue;                    // computed from quoted inputs by design
      if (!matches(v, src.quote)) problems.push(`${path.relative(root, file)} ${trail}.${key} = ${v} not found in quote: "${src.quote.slice(0, 140)}"`);
    }
  }
  for (const [k, v] of Object.entries(node)) if (k !== "source") visit(v, file, trail ? `${trail}.${k}` : k);
};
for (const f of files) visit(JSON.parse(fs.readFileSync(f, "utf8")), f, "");
problems.forEach(p => console.log("✗ " + p));
console.log(`\n${problems.length} figure(s) whose value is not visible in their quote`);
process.exit(problems.length ? 1 : 0);

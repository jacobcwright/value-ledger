#!/usr/bin/env node
// Edition prices for "Value created": the closing price of every symbol named in research/lenses/marketcap/*.json
// (classes[].pricedAs) on the edition date, and the Federal Reserve H.10 noon buying rate for each currency that day.
// Writes research/lenses/marketcap/_prices.json. Market value = Σ shares × perListedUnit × close ÷ (currency per USD).
// Usage: node scripts/refresh-prices.mjs 2026-11-20 https://www.federalreserve.gov/releases/h10/20261123/
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [date, h10Url] = process.argv.slice(2);
if (!date || !h10Url) { console.error("usage: node scripts/refresh-prices.mjs <YYYY-MM-DD> <H.10 release url>"); process.exit(1); }
const dir = path.join(root, "research/lenses/marketcap");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const symbols = new Set();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json") && !f.startsWith("_")))
  for (const c of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).classes || []) if (c.pricedAs) symbols.add(c.pricedAs);

const out = {asOf: date, about: "Closing prices on the edition date (Yahoo Finance chart data, the exchange's official close for that session) and Federal Reserve H.10 noon buying rates in New York for the same day. Pence-quoted London lines (GBp) are divided by 100.", symbols: {}, fx: {}};
const day0 = Date.parse(date + "T00:00:00Z") / 1000;
for (const sym of [...symbols].sort()) {
  // ±1 day around the date, then keep the bar whose exchange-local date is the edition date
  const probe = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${day0 - 86400}&period2=${day0 + 2 * 86400}&interval=1d`;
  let j;
  for (let i = 0; i < 3 && !j; i++) { try { const r = await fetch(probe, {headers: {"User-Agent": UA}}); if (r.ok) j = await r.json(); } catch {} await sleep(800 * (i + 1)); }
  const res = j?.chart?.result?.[0];
  if (!res?.timestamp) { out.symbols[sym] = {error: "no data"}; console.log(`✗ ${sym} no data`); continue; }
  const off = res.meta.gmtoffset || 0;
  const k = res.timestamp.findIndex(t => new Date((t + off) * 1000).toISOString().slice(0, 10) === date);
  if (k < 0) { out.symbols[sym] = {error: `no session on ${date}`}; console.log(`✗ ${sym} no session on ${date}`); continue; }
  // re-request exactly that session so the quote is a one-bar response
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${res.timestamp[k]}&period2=${res.timestamp[k] + 3600}&interval=1d`;
  const raw = await (await fetch(url, {headers: {"User-Agent": UA}})).text(); await sleep(600);
  const m = raw.match(/"close":\[[^\]]*\]/);
  const close = res.indicators.quote[0].close[k];
  let currency = res.meta.currency, divisor = 1;
  if (currency === "GBp" || currency === "GBX") { currency = "GBP"; divisor = 100; }
  if (currency === "ILA") { currency = "ILS"; divisor = 100; }
  out.symbols[sym] = {close, currency, divisor, exchange: res.meta.fullExchangeName || res.meta.exchangeName, session: date,
    source: {hostType: "market-data", url, label: `Yahoo Finance chart data, ${sym} close on ${date}`, quote: m ? m[0] : null}};
  console.log(`✓ ${sym} ${close} ${res.meta.currency}`);
}

// H.10: rows read "JAPAN YEN 159.6500 159.2700 …" under day headers "Nov. 16 … Nov. 20"; asterisked rows are USD per unit.
const html = await (await fetch(h10Url, {headers: {"User-Agent": "Mozilla/5.0 (compatible; ValueForHumanity research)"}})).text();
const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const days = [...text.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\. (\d{1,2})\b/g)].map(m => m[0]);
const want = new Date(date + "T12:00:00Z").toLocaleString("en-US", {month: "short", timeZone: "UTC"}) + ". " + Number(date.slice(8));
const col = [...new Set(days)].indexOf(want);
const ROWS = {EUR: "\\*?EURO", JPY: "JAPAN YEN", CHF: "SWITZERLAND FRANC", DKK: "DENMARK KRONE", HKD: "HONG KONG DOLLAR", KRW: "SOUTH KOREA WON", TWD: "TAIWAN DOLLAR",
  INR: "INDIA RUPEE", GBP: "\\*?UNITED KINGDOM POUND", AUD: "\\*?AUSTRALIA DOLLAR", MXN: "MEXICO PESO", CNY: "CHINA, P\\.R\\. YUAN", SEK: "SWEDEN KRONA", SGD: "SINGAPORE DOLLAR", BRL: "BRAZIL REAL", CAD: "CANADA DOLLAR", NOK: "NORWAY KRONE", ZAR: "SOUTH AFRICA RAND"};
const needed = new Set(Object.values(out.symbols).map(s => s.currency).filter(c => c && c !== "USD"));
for (const cur of needed) {
  const re = new RegExp(`(${ROWS[cur] || cur})((?: \\d+\\.\\d+| ND){5})`);
  const m = ROWS[cur] && text.match(re);
  if (!m || col < 0) { out.fx[cur] = {error: "row not found"}; console.log(`✗ FX ${cur}`); continue; }
  const vals = m[2].trim().split(" "), stated = Number(vals[col]);
  const usdPerUnit = ["EUR", "GBP", "AUD", "NZD"].includes(cur);  // H.10 quotes these as USD per unit (asterisked)
  out.fx[cur] = {perUSD: usdPerUnit ? Number((1 / stated).toFixed(6)) : stated, stated, statedBasis: usdPerUnit ? `USD per ${cur}` : `${cur} per USD`, day: date,
    source: {hostType: "regulator", url: h10Url, label: `Federal Reserve Board, H.10 Foreign Exchange Rates, noon buying rates in New York, ${want}`, quote: `${m[1]}${m[2]}`.trim()}};
  console.log(`✓ FX ${cur} ${out.fx[cur].perUSD}`);
}
fs.writeFileSync(path.join(dir, "_prices.json"), JSON.stringify(out, null, 1) + "\n");

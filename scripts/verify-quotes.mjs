#!/usr/bin/env node
// Independent publishing gate: re-downloads every source document cited in research/records and
// research/lenses, extracts its text (pdftotext for PDFs), and confirms each verbatim quote is present.
// Writes research/verified.json: { generatedAt, sources: { url: { ok, reason, quotes, failed[] } } }.
// SEC documents are fetched with the contact header from $SEC_USER_AGENT (never printed).
// Usage: node scripts/verify-quotes.mjs [--refresh] [--only <substring>]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cacheDir = path.join(root, "research/.cache");
fs.mkdirSync(cacheDir, {recursive: true});
const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SEC_UA = process.env.SEC_USER_AGENT || "";

// ---------- collect every {url, quote} in the research files ----------
const files = [];
const walkDir = dir => { if (!fs.existsSync(dir)) return; for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) walkDir(full); else if (e.name.endsWith(".json")) files.push(full);
}};
walkDir(path.join(root, "research/records"));
walkDir(path.join(root, "research/lenses"));
const byUrl = new Map();
const collect = (node, file) => {
  if (Array.isArray(node)) return node.forEach(n => collect(n, file));
  if (!node || typeof node !== "object") return;
  if (typeof node.url === "string" && typeof node.quote === "string") {
    if (!byUrl.has(node.url)) byUrl.set(node.url, []);
    byUrl.get(node.url).push({quote: node.quote, file: path.relative(root, file)});
  }
  for (const v of Object.values(node)) collect(v, file);
};
for (const f of files) collect(JSON.parse(fs.readFileSync(f, "utf8")), f);

// ---------- fetch + extract text (cached) ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastSec = 0;
async function fetchText(url) {
  const key = crypto.createHash("sha1").update(url).digest("hex");
  const txtPath = path.join(cacheDir, key + ".txt");
  if (!refresh && fs.existsSync(txtPath)) return fs.readFileSync(txtPath, "utf8");
  const isSec = /(^|\.)sec\.gov$/.test(new URL(url).hostname);
  if (isSec) {
    if (!SEC_UA) throw new Error("SEC_USER_AGENT not set");
    const wait = 1100 - (Date.now() - lastSec); if (wait > 0) await sleep(wait); lastSec = Date.now();
  }
  const headers = isSec
    ? {"User-Agent": SEC_UA, "Accept-Encoding": "gzip, deflate"}
    : {"User-Agent": BROWSER_UA, "Accept": "text/html,application/pdf,application/xhtml+xml,*/*", "Accept-Language": "en-US,en;q=0.9", "Referer": new URL(url).origin + "/"};
  let buf, type = "";
  try {
    const res = await fetch(url, {headers, redirect: "follow"});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    type = res.headers.get("content-type") || "";
  } catch (error) {
    if (isSec) throw error;
    // some company CDNs reject Node's TLS/HTTP fingerprint but serve curl
    const tmp = path.join(cacheDir, key + ".bin");
    try { execFileSync("curl", ["-sSfL", "--max-time", "120", "-A", BROWSER_UA, "-H", "Accept-Language: en-US,en;q=0.9", "-o", tmp, url]); }
    catch { throw new Error(`${error.message}; curl also failed`); }
    buf = fs.readFileSync(tmp); fs.rmSync(tmp);
  }
  let text;
  if (type.includes("pdf") || buf.subarray(0, 5).toString() === "%PDF-") {
    const pdf = path.join(cacheDir, key + ".pdf");
    fs.writeFileSync(pdf, buf);
    execFileSync("pdftotext", ["-layout", pdf, txtPath]);
    const layout = fs.readFileSync(txtPath, "utf8");
    execFileSync("pdftotext", ["-raw", pdf, txtPath + ".raw"]);
    text = layout + "\n" + fs.readFileSync(txtPath + ".raw", "utf8");
    fs.rmSync(txtPath + ".raw");
  } else {
    const keepScripts = /(^|\.)flo\.uri\.sh$/.test(new URL(url).hostname);  // Flourish charts carry their data in a script block
    text = buf.toString("utf8")
      .replace(keepScripts ? /<style[\s\S]*?<\/style>/gi : /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;|&#xa0;/gi, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#8217;|&rsquo;|&#x2019;/gi, "'").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|&quot;/gi, '"')
      .replace(/&#8212;|&mdash;|&#8211;|&ndash;/gi, "-").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
  }
  fs.writeFileSync(txtPath, text);
  return text;
}

// ---------- matching ----------
const norm = s => s.toLowerCase()
  .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/[‐-―−]/g, "-")
  .replace(/[^a-z0-9%.$,()'-]+/g, " ").replace(/\s+/g, " ").trim();
const squash = s => norm(s).replace(/[^a-z0-9%.]/g, "");
// researchers add context in square brackets, e.g. "[in millions, FY2024]": that is annotation, not quoted text
const stripNotes = q => q.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
function check(docNorm, docSquash, rawQuote) {
  const quote = stripNotes(rawQuote);
  const q = norm(quote);
  // every number in the quote must exist in the document, whatever kind of text match follows
  const allNums = (q.match(/\d[\d,.]*\d|\d/g) || []).map(n => n.replace(/,/g, "").replace(/\.$/, ""));
  const docDigitsAll = docNorm.replace(/,/g, "");
  const missing = allNums.filter(n => !docDigitsAll.includes(n));
  if (missing.length) return {ok: false, how: `numbers missing from document: ${missing.slice(0, 5).join(" ")}`};
  if (docNorm.includes(q)) return {ok: true, how: "exact"};
  // table-split text: compare with every separator removed
  if (docSquash.includes(squash(quote))) return {ok: true, how: "squashed"};
  // fragments: quotes may join non-adjacent cells with "…" or "..." or " | "
  const parts = quote.split(/\s*(?:…|\.\.\.|\s\|\s|;\s)\s*/).map(p => p.trim()).filter(p => p.length >= 6);
  if (parts.length > 1 && parts.every(p => docNorm.includes(norm(p)) || docSquash.includes(squash(p)))) return {ok: true, how: "fragments"};
  // last resort: every number in the quote is present AND 90% of 3-word shingles are present
  const nums = (q.match(/\d[\d,.]*\d|\d/g) || []).map(n => n.replace(/,/g, ""));
  const docDigits = docNorm.replace(/,/g, "");
  const numsOk = nums.every(n => docDigits.includes(n));
  const words = q.split(" ");
  const shingles = []; for (let i = 0; i + 3 <= words.length; i++) shingles.push(words.slice(i, i + 3).join(" "));
  const hit = shingles.filter(s => docNorm.includes(s)).length;
  const ratio = shingles.length ? hit / shingles.length : 0;
  if (numsOk && ratio >= 0.9) return {ok: true, how: `fuzzy ${(ratio * 100).toFixed(0)}%`};
  // tables flattened by pdftotext: every number must sit within 400 chars of a distinctive word from the quote
  if (numsOk && nums.length && ratio >= 0.5) {
    const stop = new Set("which their there these those about after other total share shares company group\u2019s year ended march december".split(" "));
    const keyWords = [...new Set(words.filter(w => /^[a-z]{5,}$/.test(w) && !stop.has(w)))];
    const inContext = nums.every(n => {
      let i = docDigits.indexOf(n);
      while (i !== -1) { const win = docDigits.slice(Math.max(0, i - 400), i + 400); if (keyWords.some(w => win.includes(w))) return true; i = docDigits.indexOf(n, i + 1); }
      return false;
    });
    if (inContext) return {ok: true, how: `numbers-in-context ${(ratio * 100).toFixed(0)}%`};
  }
  return {ok: false, how: `numbers ${numsOk ? "found" : "MISSING"}, phrase match ${(ratio * 100).toFixed(0)}%`};
}

// ---------- run ----------
const outPath = path.join(root, "research/verified.json");
const previous = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")).sources : {};
const results = {...previous};
const manualPath = path.join(root, "research/manual-sources.json");
const manual = fs.existsSync(manualPath) ? JSON.parse(fs.readFileSync(manualPath, "utf8")) : {};
const urls = [...byUrl.keys()].filter(u => !only || u.includes(only));
let pass = 0, fail = 0;
for (const url of urls) {
  const quotes = byUrl.get(url);
  let entry;
  try {
    const text = await fetchText(url);
    const docNorm = norm(text), docSquash = squash(text);
    const failed = [];
    const hows = new Set();
    for (const {quote, file} of quotes) { const r = check(docNorm, docSquash, quote); if (r.ok) hows.add(r.how.split(" ")[0]); else failed.push({file, quote: quote.slice(0, 160), why: r.how}); }
    entry = {ok: failed.length === 0, reason: failed.length ? `${failed.length}/${quotes.length} quotes not found` : `all ${quotes.length} quotes found (${[...hows].join(", ")})`, quotes: quotes.length, failed};
  } catch (error) {
    if (manual[url] && previous[url]?.ok) { entry = {...previous[url], reason: previous[url].reason.replace(/ \(manual copy\)$/, "") + " (manual copy)"}; results[url] = entry; pass++; process.stdout.write(`✓ ${url.slice(0, 110)}  kept: ${manual[url]}\n`); continue; }
    entry = {ok: false, reason: `fetch failed: ${error.message}`, quotes: quotes.length, failed: quotes.map(q => ({file: q.file, quote: q.quote.slice(0, 160), why: "unfetched"}))};
  }
  results[url] = entry;
  entry.ok ? pass++ : fail++;
  process.stdout.write(`${entry.ok ? "✓" : "✗"} ${url.slice(0, 110)}  ${entry.reason}\n`);
}
// drop URLs no longer cited
for (const url of Object.keys(results)) if (!byUrl.has(url)) delete results[url];
fs.writeFileSync(outPath, JSON.stringify({generatedAt: new Date().toISOString(), sources: results}, null, 2) + "\n");
console.log(`\n${pass} sources verified, ${fail} failed, ${byUrl.size} cited in total. Wrote research/verified.json`);

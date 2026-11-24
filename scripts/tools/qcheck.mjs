// Local quote check mirroring scripts/verify-quotes.mjs matching, against documents already downloaded.
// Usage: node qcheck.mjs <urlmap.json> <json files...>
// urlmap: { "<url>": "/abs/path/to/local/file" }  (html, pdf->txt, xml, json)
import fs from "node:fs";
import {execFileSync} from "node:child_process";
const [mapPath, ...files] = process.argv.slice(2);
const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const textCache = new Map();
function docText(url) {
  const p = map[url];
  if (!p) return null;
  if (textCache.has(p)) return textCache.get(p);
  const buf = fs.readFileSync(p);
  let text;
  if (buf.subarray(0, 5).toString() === "%PDF-") {
    text = execFileSync("pdftotext", ["-layout", p, "-"], {maxBuffer: 1 << 28}).toString() + "\n" + execFileSync("pdftotext", ["-raw", p, "-"], {maxBuffer: 1 << 28}).toString();
  } else {
    text = buf.toString("utf8")
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;|&#xa0;/gi, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#8217;|&rsquo;|&#x2019;/gi, "'").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|&quot;/gi, '"')
      .replace(/&#8212;|&mdash;|&#8211;|&ndash;/gi, "-").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
  }
  textCache.set(p, text);
  return text;
}
const norm = s => s.toLowerCase()
  .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/[‐-―−]/g, "-")
  .replace(/[^a-z0-9%.$,()'-]+/g, " ").replace(/\s+/g, " ").trim();
const squash = s => norm(s).replace(/[^a-z0-9%.]/g, "");
const stripNotes = q => q.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
function check(docNorm, docSquash, rawQuote) {
  const quote = stripNotes(rawQuote);
  const q = norm(quote);
  const allNums = (q.match(/\d[\d,.]*\d|\d/g) || []).map(n => n.replace(/,/g, "").replace(/\.$/, ""));
  const docDigitsAll = docNorm.replace(/,/g, "");
  const missing = allNums.filter(n => !docDigitsAll.includes(n));
  if (missing.length) return {ok: false, how: `numbers missing: ${missing.slice(0, 5).join(" ")}`};
  if (docNorm.includes(q)) return {ok: true, how: "exact"};
  if (docSquash.includes(squash(quote))) return {ok: true, how: "squashed"};
  const parts = quote.split(/\s*(?:…|\.\.\.|\s\|\s|;\s)\s*/).map(p => p.trim()).filter(p => p.length >= 6);
  if (parts.length > 1 && parts.every(p => docNorm.includes(norm(p)) || docSquash.includes(squash(p)))) return {ok: true, how: "fragments"};
  const bad = parts.filter(p => !(docNorm.includes(norm(p)) || docSquash.includes(squash(p))));
  return {ok: false, how: `no match; failing parts: ${JSON.stringify(bad.length ? bad : [quote]).slice(0, 300)}`};
}
let fails = 0, n = 0;
const visit = (node, file, trail) => {
  if (Array.isArray(node)) return node.forEach((c, i) => visit(c, file, `${trail}[${i}]`));
  if (!node || typeof node !== "object") return;
  if (typeof node.url === "string" && typeof node.quote === "string") {
    n++;
    const t = docText(node.url);
    if (t == null) { console.log(`?  ${file} ${trail}: no local copy for ${node.url}`); fails++; }
    else {
      const dn = norm(t), r = check(dn, dn.replace(/[^a-z0-9%.]/g, ""), node.quote);
      if (!r.ok) { fails++; console.log(`✗  ${file} ${trail}: ${r.how}`); }
      else if (process.env.VERBOSE) console.log(`✓  ${file} ${trail}: ${r.how}`);
    }
  }
  for (const [k, v] of Object.entries(node)) visit(v, file, trail ? `${trail}.${k}` : k);
};
for (const f of files) visit(JSON.parse(fs.readFileSync(f, "utf8")), f.split("/research/")[1] || f, "");
console.log(`${n} quotes, ${fails} failing`);

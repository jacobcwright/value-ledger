#!/usr/bin/env node
// Pre-deploy checks for the static site in dist/. Fails (exit 1) on anything that would ship broken.
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dist = path.join(root, "dist");
const errors = [];
const fail = message => errors.push(message);

// 1. Every JavaScript file parses.
const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const files = walk(dist);
for (const file of files.filter(f => f.endsWith(".js"))) {
  try { execFileSync(process.execPath, ["--check", file], {stdio: "pipe"}); }
  catch (error) { fail(`syntax error in ${path.relative(root, file)}: ${String(error.stderr).split("\n").slice(0, 4).join(" ")}`); }
}
// 2. Every JSON file parses.
for (const file of files.filter(f => f.endsWith(".json") || f.endsWith(".webmanifest"))) {
  try { JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { fail(`invalid JSON in ${path.relative(root, file)}: ${error.message}`); }
}

// 3. Each page references only files that exist, and has no inline scripts (the CSP forbids them).
// Extensionless links ("/methodology") resolve the way Workers Static Assets serves them: <path>.html or <path>/index.html.
const resolves = local => {
  const target = path.join(dist, local);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return true;
  return !path.extname(local) && [target + ".html", path.join(target, "index.html")].some(file => fs.existsSync(file));
};
for (const page of ["index.html", "methodology.html", "404.html"]) {
  const file = path.join(dist, page);
  if (!fs.existsSync(file)) { fail(`${page} is missing`); continue; }
  const html = fs.readFileSync(file, "utf8");
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"#:]+?)"/g)) {
    const local = ref.replace(/^\//, "").split("?")[0];
    if (local && !resolves(local)) fail(`${page} references missing file: ${ref}`);
  }
  for (const [tag] of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/g)) fail(`inline script in ${page}: ${tag}`);
  if (/\son[a-z]+="/i.test(html)) fail(`inline event handler attribute in ${page}`);
}
// Pages listed in the sitemap exist.
for (const [, loc] of fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8").matchAll(/<loc>https:\/\/valueforhumanity\.com\/([^<]*)<\/loc>/g)) {
  if (loc && !resolves(loc)) fail(`sitemap.xml lists a missing page: /${loc}`);
}

// 4. The data snapshot loads and every leader is complete.
const leaders = new Function(fs.readFileSync(path.join(dist, "data.js"), "utf8") + ";return leaders")();
if (leaders.length !== 100) fail(`expected 100 leaders, found ${leaders.length}`);
const seen = new Set();
for (const leader of leaders) {
  if (seen.has(leader.id)) fail(`duplicate leader id ${leader.id}`);
  seen.add(leader.id);
  // wage and payroll may be null together: the company reports neither staff costs nor median pay ("Not disclosed").
  if (leader.wage == null && leader.payroll != null) fail(`${leader.id}: payroll without wage`);
  for (const key of ["id","name","company","sector","ticker","cap","jobs","image","photo","license","capUrl","jobsUrl"]) {
    if (leader[key] == null || leader[key] === "") fail(`${leader.id}: missing ${key}`);
  }
  if (!fs.existsSync(path.join(dist, leader.image))) fail(`${leader.id}: portrait not found (${leader.image})`);
  if (!Array.isArray(leader.sites) || !leader.sites.length) fail(`${leader.id}: no operating sites`);
}

// 5. Company data shipped to the site (if any) is one file per known leader, listed in companies.json,
// and coverage.json covers every leader.
const companiesDir = path.join(dist, "companies");
const shipped = fs.existsSync(companiesDir) ? fs.readdirSync(companiesDir).map(file => path.basename(file, ".json")) : [];
for (const id of shipped) if (!seen.has(id)) fail(`dist/companies/${id}.json does not match a leader id`);
try {
  const listed = JSON.parse(fs.readFileSync(path.join(dist, "companies.json"), "utf8")).published || [];
  for (const id of listed) if (!shipped.includes(id)) fail(`companies.json lists ${id} but dist/companies/${id}.json is missing`);
  for (const id of shipped) if (!listed.includes(id)) fail(`dist/companies/${id}.json is not listed in companies.json`);
} catch (error) { fail(`dist/companies.json unreadable: ${error.message}`); }
try {
  const coverage = JSON.parse(fs.readFileSync(path.join(dist, "coverage.json"), "utf8"));
  const covered = new Set((coverage.leaders || []).map(entry => entry.id));
  for (const id of seen) if (!covered.has(id)) fail(`coverage.json is missing ${id}`);
} catch (error) { fail(`dist/coverage.json unreadable: ${error.message}`); }

if (errors.length) {
  console.error(`Site check failed (${errors.length}):\n` + errors.map(e => "  ✗ " + e).join("\n"));
  process.exit(1);
}
console.log(`Site check passed: ${files.length} files, ${leaders.length} leaders.`);

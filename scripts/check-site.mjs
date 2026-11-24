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

// 3. index.html references only files that exist, and has no inline scripts (the CSP forbids them).
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
for (const [, ref] of html.matchAll(/(?:src|href)="([^"#:]+?)"/g)) {
  const local = ref.replace(/^\//, "").split("?")[0];
  if (local && !fs.existsSync(path.join(dist, local))) fail(`index.html references missing file: ${ref}`);
}
for (const [tag] of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/g)) fail(`inline script in index.html: ${tag}`);
if (/\son[a-z]+="/i.test(html)) fail("inline event handler attribute in index.html");

// 4. The data snapshot loads and every leader is complete.
const leaders = new Function(fs.readFileSync(path.join(dist, "data.js"), "utf8") + ";return leaders")();
if (leaders.length !== 100) fail(`expected 100 leaders, found ${leaders.length}`);
const seen = new Set();
for (const leader of leaders) {
  if (seen.has(leader.id)) fail(`duplicate leader id ${leader.id}`);
  seen.add(leader.id);
  for (const key of ["id","name","company","sector","ticker","cap","jobs","wage","image","photo","license","capUrl","jobsUrl"]) {
    if (leader[key] == null || leader[key] === "") fail(`${leader.id}: missing ${key}`);
  }
  if (!fs.existsSync(path.join(dist, leader.image))) fail(`${leader.id}: portrait not found (${leader.image})`);
  if (!Array.isArray(leader.sites) || !leader.sites.length) fail(`${leader.id}: no operating sites`);
}

// 5. Company value-sharing data shipped to the site (if any) is one file per known leader.
const companiesDir = path.join(dist, "companies");
if (fs.existsSync(companiesDir)) {
  for (const file of fs.readdirSync(companiesDir)) {
    const id = path.basename(file, ".json");
    if (!seen.has(id)) fail(`dist/companies/${file} does not match a leader id`);
  }
}

if (errors.length) {
  console.error(`Site check failed (${errors.length}):\n` + errors.map(e => "  ✗ " + e).join("\n"));
  process.exit(1);
}
console.log(`Site check passed: ${files.length} files, ${leaders.length} leaders.`);

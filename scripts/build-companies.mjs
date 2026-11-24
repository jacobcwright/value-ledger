#!/usr/bin/env node
// Publishes research/records/<id>.json to dist/companies/<id>.json for every record that passes
// scripts/validate-records.mjs, and lists the published ids in dist/companies.json. Amazon (jeff-bezos) has its own case study and is never published here.
// Files in dist/companies that no longer correspond to a passing record are deleted.
// Exits 0 even when records are skipped, so a half-researched set never blocks a deploy.
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const recordsDir = path.join(root, "research/records");
const outDir = path.join(root, "dist/companies");
const validator = path.join(root, "scripts/validate-records.mjs");
const SKIP = new Set(["jeff-bezos"]);

const files = fs.existsSync(recordsDir) ? fs.readdirSync(recordsDir).filter(f => f.endsWith(".json")).sort() : [];
const published = [], skipped = [];

for (const file of files) {
  const id = path.basename(file, ".json");
  if (SKIP.has(id)) { skipped.push([id, ["Amazon has its own case study"]]); continue; }
  const run = spawnSync(process.execPath, [validator, id], {cwd: root, encoding: "utf8"});
  if (run.status !== 0) {
    const reasons = (run.stdout + run.stderr).split("\n")
      .filter(line => /^\s*error:|invalid JSON/.test(line))
      .map(line => line.replace(/^\s*(error:\s*|✗\s*)/, "").trim());
    skipped.push([id, reasons.length ? reasons : [`validator exited ${run.status}`]]);
    continue;
  }
  const record = JSON.parse(fs.readFileSync(path.join(recordsDir, file), "utf8"));
  fs.mkdirSync(outDir, {recursive: true});
  fs.writeFileSync(path.join(outDir, id + ".json"), JSON.stringify(record) + "\n");
  published.push(id);
}

// The list of published ids, so the site only requests records that exist (no 404s in the console).
// It lives outside dist/companies, which must hold only <leader-id>.json files.
fs.writeFileSync(path.join(root, "dist/companies.json"), JSON.stringify({published}) + "\n");

// Remove anything in dist/companies that this run did not publish.
const removed = [];
if (fs.existsSync(outDir)) {
  for (const file of fs.readdirSync(outDir)) {
    if (published.includes(path.basename(file, ".json")) && file.endsWith(".json")) continue;
    fs.rmSync(path.join(outDir, file), {recursive: true, force: true});
    removed.push(file);
  }
  if (!fs.readdirSync(outDir).length) fs.rmdirSync(outDir);
}

console.log(`Published ${published.length} of ${files.length} records to dist/companies/`);
for (const id of published) console.log(`  ✓ ${id}`);
if (skipped.length) {
  console.log(`Skipped ${skipped.length}:`);
  for (const [id, reasons] of skipped) {
    const shown = reasons.slice(0, 4);
    console.log(`  ✗ ${id}: ${shown.join("; ")}${reasons.length > shown.length ? `; +${reasons.length - shown.length} more` : ""}`);
  }
}
if (removed.length) console.log(`Removed stale: ${removed.join(", ")}`);

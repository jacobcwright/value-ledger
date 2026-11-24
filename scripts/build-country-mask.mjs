#!/usr/bin/env node
// Builds dist/country-mask.js: which land dots of the globe (dist/globe.js) belong to which country, plus
// country and U.S. state centroids for pins. Run once; the output is committed. Needs network access
// unless --from points at local copies of the three GeoJSON files named below.
//
// Data: Natural Earth (public domain, https://www.naturalearthdata.com), from the official repository
// github.com/nvkelso/natural-earth-vector:
//   ne_110m_admin_0_countries        country polygons: the dot mask and country centroids
//   ne_50m_admin_0_countries         centroids only, for countries too small for the 110m set (SG, HK, BH…)
//   ne_110m_admin_1_states_provinces U.S. states and DC: state centroids
// Country codes use ISO_A2_EH, which fills the codes ISO_A2 leaves as -99 (France, Norway, Kosovo).
// The globe's land dots were sampled from Natural Earth 110m land, so every dot is tested against the
// same-scale country polygons; the result matches dist/amazon-market-mask.js for US, DE, GB and JP exactly.
//
// Usage: node scripts/build-country-mask.mjs [--from <dir with the three .geojson files>]
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const FILES = {countries110: "ne_110m_admin_0_countries", countries50: "ne_50m_admin_0_countries", states110: "ne_110m_admin_1_states_provinces"};
const args = process.argv.slice(2);
const from = args.includes("--from") ? args[args.indexOf("--from") + 1] : null;

async function load(name) {
  if (from) return JSON.parse(fs.readFileSync(path.join(from, name + ".geojson"), "utf8"));
  const response = await fetch(BASE + name + ".geojson");
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.json();
}

const land = new Function(fs.readFileSync(path.join(root, "dist/globe.js"), "utf8").split("\n").find(line => line.startsWith("const land")) + ";return land")();

// ---- Geometry helpers (planar, in degrees; fine at this scale) ----
const polygons = feature => !feature.geometry ? [] : feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.type === "MultiPolygon" ? feature.geometry.coordinates : [];
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygon = (x, y, polygon) => inRing(x, y, polygon[0]) && !polygon.slice(1).some(hole => inRing(x, y, hole));
function ringCentroid(ring) {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1], cross = x0 * y1 - x1 * y0;
    area += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
  }
  return {area: area / 2, x: cx / (3 * area), y: cy / (3 * area)};
}
// Centroid of the largest polygon, so a country's pin sits on its main territory (France, not French Guiana).
function centroid(feature) {
  let best = null;
  for (const polygon of polygons(feature)) {
    const c = ringCentroid(polygon[0]);
    if (Number.isFinite(c.x) && (!best || Math.abs(c.area) > Math.abs(best.area))) best = c;
  }
  return best && [Math.round(best.y * 100) / 100, Math.round(best.x * 100) / 100];
}
const iso2 = feature => {
  const code = feature.properties.ISO_A2_EH || feature.properties.ISO_A2;
  return /^[A-Z]{2}$/.test(code || "") ? code : null;
};

const [countries110, countries50, states110] = await Promise.all(Object.values(FILES).map(load));

// ---- Dot mask ----
const mask = {};
let unmatched = 0;
land.forEach(([lat, lon], index) => {
  const feature = countries110.features.find(f => iso2(f) && polygons(f).some(polygon => inPolygon(lon, lat, polygon)));
  if (!feature) { unmatched++; return; }
  (mask[iso2(feature)] ??= []).push(index);
});

// ---- Centroids ----
const centroids = {};
for (const feature of countries110.features) if (iso2(feature) && !centroids[iso2(feature)]) centroids[iso2(feature)] = centroid(feature);
let added50 = 0;
for (const feature of countries50.features) if (iso2(feature) && !centroids[iso2(feature)]) { centroids[iso2(feature)] = centroid(feature); added50++; }
const states = {};
for (const feature of states110.features) {
  const postal = feature.properties.postal;
  if (feature.properties.iso_a2 === "US" && /^[A-Z]{2}$/.test(postal || "")) states[postal] = centroid(feature);
}

const sorted = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
const out = `// Built by scripts/build-country-mask.mjs from Natural Earth (public domain): 1:110m admin-0 country polygons
// sampled on the globe land grid (countryMask: ISO 3166-1 alpha-2 -> land dot indexes in globe.js), centroids of
// each country's largest polygon (1:110m, or 1:50m for countries too small for 110m), and U.S. state and DC
// centroids from 1:110m admin-1. Centroids are [lat, lon].
const countryMask = ${JSON.stringify(sorted(mask))};
const countryCentroids = ${JSON.stringify(sorted(centroids))};
const usStateCentroids = ${JSON.stringify(sorted(states))};
`;
fs.writeFileSync(path.join(root, "dist/country-mask.js"), out);
console.log(`dist/country-mask.js: ${Object.keys(mask).length} countries with dots (${land.length - unmatched}/${land.length} dots matched), ${Object.keys(centroids).length} centroids (${added50} from 1:50m), ${Object.keys(states).length} state centroids`);

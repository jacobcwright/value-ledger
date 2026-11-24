// "Where {Company} creates value" for every leader except Amazon (which keeps its bespoke panel).
// Data: the `footprint` key of dist/companies/<id>.json, written by scripts/build-companies.mjs from
// research/lenses/footprint/<id>.json (see research/FOOTPRINT.md). It arrives with the company file that
// company-value.js already loads when a profile opens (cvLoad), so nothing extra is fetched.
// Layers appear only when the file has rows for them:
//   Countries: the canvas globe (globe.js) with country heat (country-mask.js) and a ranked list.
//              Regions with a country list shade their countries; regions without one are listed only.
//   U.S. states: a choropleth on the state shapes in amazon-state-data.js (read from its global, not copied),
//              with legend bands computed from the data.
//   Sites: pins at the state or country centroid (country-mask.js), since sites carry only a place name.
// Every number links to its source, and every figure joins "How we got these numbers" (companyFootprintProof).
// A leader with no footprint rows keeps the simple "Operating footprint" globe from app.js.
//
// On-demand map scripts. The home page loads only this file and amazon-footprint.js; the globe (globe.js),
// the country and market masks and the U.S. state shapes (amazon-state-data.js, amazon-state-map.js) are
// injected with <script src> the first time a profile needs them (the CSP allows same-origin scripts).
// app.js calls createGlobe() synchronously for the simple globe, so until globe.js arrives createGlobe is a
// stand-in that loads it and then draws; globe.js's own declaration replaces the stand-in when it runs.

const mapScriptLoads = new Map();
function mapScript(file) {
  if (!mapScriptLoads.has(file)) mapScriptLoads.set(file,new Promise((resolve,reject) => {
    const script = document.createElement("script");
    script.src = file;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => { mapScriptLoads.delete(file); script.remove(); reject(new Error(`Could not load ${file}`)); };
    document.head.append(script);
  }));
  return mapScriptLoads.get(file);
}
// Each file at most once, fetched in parallel, run in the order given.
const mapScripts = files => Promise.all(files.map(mapScript));
if (typeof createGlobe === "undefined") {
  window.createGlobe = function lazyGlobe(canvas, sites, choose, options) {
    let real = null, dead = false;
    const queued = [];
    mapScripts(["globe.js"]).then(() => {
      if (dead || !canvas.isConnected || window.createGlobe === lazyGlobe) return;
      real = window.createGlobe(canvas,sites,choose,options);
      for (const call of queued.splice(0)) call(real);
    }).catch(error => console.error(error));
    const later = name => (...args) => { if (real) real[name](...args); else queued.push(globe => globe[name](...args)); };
    return {select:later("select"),magnify:later("magnify"),destroy() { dead = true; real?.destroy(); }};
  };
}

const cfScale = {"count-thousands":1e3,"people-thousands":1e3,"currency-thousands":1e3,"currency-millions":1e6,"currency-billions":1e9,"square-feet-millions":1e6};
const cfCompact = new Intl.NumberFormat("en-US",{notation:"compact",maximumFractionDigits:1});
// Gold ramp for the dark map (the same steps as stateHeatRamp in amazon-state-map.js, which loads on demand).
// The globe skips the darkest step, which would read as missing land among the cream dots.
const cfRamp = ["#665041","#8c6443","#b07b48","#cf9557","#e8b374","#ffd298"];
const cfGlobeRamp = cfRamp.slice(1);
const cfSiteColors = ["#ffd084","#b5a5f5","#82d7d4","#f2a7c3"];
const cfOtherColor = "#c4d4cc";
const cfHostTier = {sec:"filing",exchange:"filing",company:"company-published",regulator:"regulator"};
// Washington, D.C. has no shape in the state map: it is drawn as a dot offshore, with a leader line to its
// position (albersUsa, the projection of the state paths, puts it at 827.4, 267.5).
const cfDC = {x:880,y:286,r:6.5,at:[827.4,267.5]};

// ---- Formatting ------------------------------------------------------------------------------
// What one stored unit is worth: an explicit metric.scale (the build always writes one), else the unit's own
// scale, else a label such as "MAUs (millions)" for numbers stored as filed. Same rule as metricScale() in
// scripts/validate-footprint.mjs.
const cfScaleWords = /\s*\((?:in )?(millions|thousands|billions)\)|,?\s+in (millions|thousands|billions)\b/i;
function cfScaleOf(metric) {
  if (Number.isFinite(metric.scale) && metric.scale > 0) return metric.scale;
  if (cfScale[metric.unit]) return cfScale[metric.unit];
  const word = (cfScaleWords.exec(metric.label || "") || []).slice(1).find(Boolean);
  return {millions:1e6,thousands:1e3,billions:1e9}[String(word).toLowerCase()] || 1;
}
const cfAbs = (metric, value) => value * metric.scale;
// Periods: the latest year a period names, an "Older data" tag before 2023, and "periods differ" when a
// metric's rows come from sources of different dates.
const cfLatestYear = text => { const years = (String(text || "").match(/\b(?:19|20)\d{2}\b/g) || []).map(Number); return years.length ? Math.max(...years) : null; };
const cfShortPeriod = period => !period ? "" : period.length <= 48 ? period : period.split(/[:;(]/)[0].trim();
function cfPeriodsDiffer(metric, cells) {
  if (/\bdiffer|\bvar(?:y|ies)\b|as stated in each|each (?:release|report|state|country)/i.test(metric.period)) return true;
  return new Set(cells.map(cell => cell.period || cfLatestYear(cell.source.label)).filter(Boolean)).size > 1;
}
function cfPeriodTags(metric, cells) {
  const year = cfLatestYear(metric.period);
  return `${metric.period ? `<span class="cf-period">${escapeHtml(cfShortPeriod(metric.period))}</span>` : ""}`
    + (year != null && year < 2023 ? `<span class="cf-tag cf-older" title="The latest year in this period is ${year}">Older data</span>` : "")
    + (cfPeriodsDiffer(metric,cells) ? '<span class="cf-tag">periods differ</span>' : "");
}
// The period, set after a takeaway line.
function cfWhen(metric, cells) {
  const tags = cfPeriodTags(metric,cells);
  return tags ? `<span class="cf-when"> · ${tags}</span>` : "";
}
const cfSummable = metric => metric.unit !== "percent" && metric.unit !== "currency-per-hour" && metric.unit !== "currency-per-user";
function cfFormat(metric, value, plus = false) {
  const unit = metric.unit, abs = cfAbs(metric,value);
  let text;
  if (unit === "currency-per-hour") text = cvUnitMoney(value,metric.currency,2) + "/hr";
  else if (unit === "currency-per-user") text = cvUnitMoney(value,metric.currency,2) + " per user";
  else if (unit === "square-meters") text = integer.format(Math.round(abs)) + " m²";
  else if (unit.startsWith("currency")) text = cvMoney(abs / 1e9,metric.currency);
  else if (unit === "percent") text = decimal.format(value) + "%";
  else if (unit.startsWith("square-feet")) text = (abs >= 1e6 ? decimal.format(abs / 1e6) + "M" : integer.format(Math.round(abs))) + " sq ft";
  else text = abs >= 1e6 ? cfCompact.format(abs) : integer.format(Math.round(abs * 10) / 10);
  return text + (plus ? "+" : "");
}
// Short form for legend ticks.
function cfTick(metric, value) {
  const unit = metric.unit, abs = cfAbs(metric,value);
  if (unit === "currency-per-hour" || unit === "currency-per-user") return cvUnitMoney(value,metric.currency,value < 10 ? 2 : 0);
  if (unit.startsWith("currency")) return cvMoney(abs / 1e9,metric.currency);
  if (unit === "percent") return decimal.format(value) + "%";
  return cfCompact.format(abs);
}
// Mid-sentence form of a label: "Retail units" -> "retail units", but "U.S. stores", "AWS regions" and a
// label that starts with a proper noun keep their capitals: the company's name ("Apple employees" for Apple), or a
// word its definition capitalizes mid-sentence ("Google Cloud regions" for Alphabet).
const cfLower = (label, company = "", definition = "") => {
  const words = label.split(/[\s,]+/), first = words[0].replace(/['’]s$/,"");
  if (!/^[A-Z][a-z]/.test(label) || label.startsWith(company) || (!/\s/.test(company.trim()) && first === company.trim())) return label;
  // The first two words as the definition writes them mid-sentence ("… in Google Cloud regions").
  const lead = [first,words[1]].filter(Boolean).map(word => word.replace(/[^A-Za-z]/g,"")).join("\\s+");
  if (new RegExp(`[a-z0-9,;:(] ${lead}\\b`).test(definition)) return label;
  return label[0].toLowerCase() + label.slice(1);
};
// "all 50 states and DC", "19 states and DC", "38 states": the places a measure covers.
function cfScopeText(list) {
  const dc = list.some(state => state.id === "DC"), n = list.length - (dc ? 1 : 0);
  if (n === 50) return dc ? "all 50 states and DC" : "all 50 states";
  if (!n) return "DC";
  return `${n} ${n === 1 ? "state" : "states"}${dc ? " and DC" : ""}`;
}
const cfTypeLabel = type => type ? String(type).replace(/[-_]+/g," ").replace(/^./,c => c.toUpperCase()) : "Site";
const cfRgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i + 2),16)).join(", ");
const cfNum = (cell, text = cfFormat(cell.metric,cell.value,cell.plus)) => cell.source
  ? `<a class="cf-num" href="${escapeHtml(cell.source.url)}" target="_blank" rel="noopener noreferrer" title="Source: ${escapeHtml(cell.source.label)}">${escapeHtml(text)}</a>`
  : escapeHtml(text);
const cfSourceLink = (source, tier) => `<p class="cf-source-line">${tier ? cvTag(tier) : ""}${externalLink(source.url,source.label)}</p>`;
// After a tap on a map, the chosen state's or pin's card can open below the fold (on a phone, under the map or
// under its row in the list). Scroll it into view, only when it is mostly off-screen. The Amazon panel uses it too.
function mapReveal(element) {
  const hidden = () => {
    if (!element || !element.isConnected) return false;
    const box = element.getBoundingClientRect(), view = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    return box.top > view - 120 || box.bottom < 80;
  };
  if (!hidden()) return;
  const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({block:"nearest",behavior:still ? "auto" : "smooth"});
  // A smooth scroll can be dropped (another scroll or input interrupts it); make sure the card did arrive.
  if (!still) setTimeout(() => { if (hidden()) element.scrollIntoView({block:"nearest"}); },700);
}
// On a narrow panel (amazon-map.css sets --fp-stacked) the detail card follows the selected row in the list, so
// it opens where the thumb is; otherwise it sits under the list. Moving the one card keeps its id and live region.
function mapPlaceDetail(panel, list, detail, index) {
  if (!panel || !list || !detail) return;
  const stacked = getComputedStyle(panel).getPropertyValue("--fp-stacked").trim() === "1";
  const row = stacked && index >= 0 ? list.querySelector(`button[data-entry="${index}"]`) : null;
  if (row) { if (row.nextElementSibling !== detail) row.after(detail); }
  else if (detail.parentElement !== panel) panel.append(detail);
}

// One label standing for many rows from one document ("Google, 2024 U.S. Google Economic Impact Report, state
// page: Alabama" … "…: Wyoming" -> "Google, 2024 U.S. Google Economic Impact Report").
function cfSharedLabel(labels) {
  if (labels.length === 1) return labels[0];
  let prefix = labels[0];
  for (const label of labels) while (!label.startsWith(prefix)) prefix = prefix.slice(0,-1);
  const cut = Math.max(prefix.lastIndexOf(", "),prefix.lastIndexOf(": "),prefix.lastIndexOf(" ("));
  return (cut > 8 ? prefix.slice(0,cut) : labels[0].split(",")[0]).replace(/[\s,:;(–-]+$/,"");
}
function cfSourcesFor(cells) {
  const byUrl = new Map();
  for (const cell of cells) {
    if (!cell.source) continue;
    if (!byUrl.has(cell.source.url)) byUrl.set(cell.source.url,new Set());
    byUrl.get(cell.source.url).add(cell.source.label);
  }
  const links = [...byUrl].map(([url,labels]) => externalLink(url,cfSharedLabel([...labels])));
  return links.length > 3 ? `${links.slice(0,3).join(" · ")} and ${links.length - 3} more; each figure links to its own source.` : links.join(" · ");
}

// ---- Legend bands from the data: quantiles rounded to two significant figures -------------------
function cfBands(values, ramp) {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a - b);
  const unique = [...new Set(sorted)];
  const wanted = Math.min(5,unique.length);
  if (wanted <= 1) return [{min:-Infinity,color:ramp.at(-1)}];
  const quantile = q => {
    const at = (sorted.length - 1) * q, low = Math.floor(at);
    return sorted[low] + (sorted[Math.min(low + 1,sorted.length - 1)] - sorted[low]) * (at - low);
  };
  const breaks = [];
  for (let i = 1; i < wanted; i++) {
    const nice = Number(quantile(i / wanted).toPrecision(2));
    if (nice > sorted[0] && nice <= sorted.at(-1) && !breaks.includes(nice)) breaks.push(nice);
  }
  const mins = [-Infinity,...breaks.sort((a,b) => a - b)];
  return mins.map((min,i) => ({min,color:ramp[Math.round(i * (ramp.length - 1) / Math.max(1,mins.length - 1))]}));
}
const cfBandOf = (bands, value) => Number.isFinite(value) ? bands.findLast(band => band.min <= value) : null;
function cfBandLabel(bands, index, metric) {
  if (bands.length === 1) return "All reported";
  const next = bands[index + 1];
  if (index === 0) return `Under ${cfTick(metric,next.min)}`;
  if (!next) return `${cfTick(metric,bands[index].min)} and up`;
  return `${cfTick(metric,bands[index].min)} to under ${cfTick(metric,next.min)}`;
}

// ---- Model --------------------------------------------------------------------------------
// Postal code -> name, kept here (not read from amazon-state-data.js) because the model also feeds "How we got
// these numbers", which renders before the map scripts load. Same names as amazonStateData, plus DC.
const cfStateNames = {AK:"Alaska",AL:"Alabama",AR:"Arkansas",AZ:"Arizona",CA:"California",CO:"Colorado",CT:"Connecticut",DC:"District of Columbia",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",IA:"Iowa",ID:"Idaho",IL:"Illinois",IN:"Indiana",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",MA:"Massachusetts",MD:"Maryland",ME:"Maine",MI:"Michigan",MN:"Minnesota",MO:"Missouri",MS:"Mississippi",MT:"Montana",NC:"North Carolina",ND:"North Dakota",NE:"Nebraska",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NV:"Nevada",NY:"New York",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VA:"Virginia",VT:"Vermont",WA:"Washington",WI:"Wisconsin",WV:"West Virginia",WY:"Wyoming"};

function companyFootprintModel(record, leader) {
  const fp = record && typeof record === "object" ? record.footprint : null;
  if (!fp || typeof fp !== "object") return null;
  const metrics = {};
  for (const [key,metric] of Object.entries(fp.metrics || {})) {
    if (!metric || !metric.label || typeof metric.unit !== "string") continue;
    const scale = cfScaleOf(metric);
    // Once the scale is applied, a "(millions)" in the label would mislead: "498M" is already in millions.
    const label = String(metric.label).replace(cfScaleWords,"").trim() || String(metric.label);
    metrics[key] = {key,label,phrase:cfLower(label,String(leader.company),String(metric.definition || "")),unit:metric.unit,scale,currency:metric.currency || "USD",period:metric.period ? String(metric.period) : "",tier:metric.tier,definition:metric.definition ? String(metric.definition) : ""};
  }
  const keys = Object.keys(metrics);
  const sourceOf = row => {
    const source = cvSource(row && row.source);
    return source ? {...source,hostType:row.source.hostType} : null;
  };
  // Rows for one place merge (each quote is its own row); each value keeps its own source. The first row to
  // report a measure is shown; a later figure for the same measure is kept in `alternates` for the provenance list.
  function places(rows, idOf, make) {
    const out = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const source = sourceOf(row), id = row && idOf(row);
      if (!source || !id || !row.values || typeof row.values !== "object") continue;
      const place = out.get(id) || make(row,id);
      for (const [key,value] of Object.entries(row.values)) {
        if (!metrics[key] || !Number.isFinite(value)) continue;
        const cell = {metric:metrics[key],value,plus:row.plus?.[key] === true,source,period:typeof row.period === "string" ? row.period : ""};
        if (place.values[key]) place.alternates.push(cell);
        else place.values[key] = cell;
      }
      if (Object.keys(place.values).length) out.set(id,place);
    }
    return [...out.values()];
  }
  const blank = {values:{},alternates:[]};
  const states = places(fp.usStates,row => cfStateNames[row.state] ? row.state : null,(row,id) => ({...structuredClone(blank),id,name:cfStateNames[id]}));
  const countries = places(fp.countries,row => /^[A-Z]{2}$/.test(row.iso2 || "") ? row.iso2 : null,(row,id) => ({...structuredClone(blank),id,iso2:id,name:String(row.name || id),kind:"country"}));
  // A region inside one country (a Canadian province, a Mexican state) is listed under that country and never
  // painted: it is tagged with `country`, or its only member is a country the file also reports on its own.
  const parentOf = row => /^[A-Z]{2}$/.test(row.country || "") ? row.country
    : Array.isArray(row.countries) && row.countries.length === 1 && countries.some(country => country.iso2 === row.countries[0]) ? row.countries[0] : null;
  const regions = places(fp.regions,row => row.name ? String(row.name) + (parentOf(row) ? "|" + parentOf(row) : "") : null,(row,id) => ({...structuredClone(blank),id:"region:" + id,name:String(row.name),kind:"region",
    parent:parentOf(row),
    members:!parentOf(row) && Array.isArray(row.countries) ? row.countries.filter(code => /^[A-Z]{2}$/.test(code)) : null}));
  const sites = (Array.isArray(fp.sites) ? fp.sites : []).map(site => {
    const source = sourceOf(site);
    if (!source || !site.name) return null;
    const state = cfStateNames[site.state] ? site.state : null;
    const iso2 = /^[A-Z]{2}$/.test(site.iso2 || "") ? site.iso2 : state ? "US" : null;
    return {name:String(site.name),place:site.place ? String(site.place) : "",state,iso2,type:site.type ? String(site.type) : "",description:site.description ? String(site.description) : "",source,tier:cfHostTier[site.hostType || source.hostType] || "company-published"};
  }).filter(Boolean);
  const keysWith = list => keys.filter(key => list.some(place => place.values[key]));
  const model = {leader,company:leader.company,metrics,states,countries,regions,sites,
    stateKeys:keysWith(states),placeKeys:keysWith([...countries,...regions]),notes:fp.notes ? String(fp.notes) : ""};
  model.layers = [
    model.placeKeys.length && ["countries",countries.length ? "Countries" : "Regions"],
    model.stateKeys.length && ["states","U.S. states"],
    sites.length && ["sites","Sites"]
  ].filter(Boolean);
  return model.layers.length ? model : null;
}

// ---- "How we got these numbers" -------------------------------------------------------------
// Never throws: company-value.js builds the whole provenance block (and the lens tabs) around this call.
function companyFootprintProof(record, leader) {
  if (!leader || leader.id === "jeff-bezos") return [];
  try { return cfProofGroups(record,leader); } catch (error) { console.error(error); return []; }
}
function cfProofGroups(record, leader) {
  const model = companyFootprintModel(record,leader);
  if (!model) return [];
  const title = `Where ${leader.company} creates value`;
  const definitions = keys => keys.map(key => {
    const metric = model.metrics[key];
    return cvProof(`How ${leader.company} counts “${metric.label}”`,"Definition",metric.period,metric.tier,[],metric.definition);
  });
  const say = cell => `${cfFormat(cell.metric,cell.value,cell.plus)} ${cell.metric.phrase}`;
  // One entry per place, with every row's source (including later rows whose figure is not the one shown).
  const placeEntry = place => {
    const cells = Object.values(place.values), all = [...cells,...place.alternates];
    const sources = [...new Map(all.map(cell => [cell.source.url + "\n" + cell.source.quote,cell.source])).values()];
    const notes = [
      place.kind === "region" ? (place.parent ? `A region of ${place.parent}, as the company reports it.` : place.members ? `Region as defined in the source: ${place.members.join(", ")}.` : "Region as the company reports it.") : "",
      place.alternates.length ? `Also reported, not shown: ${place.alternates.map(cell => `${say(cell)} (${cell.source.label})`).join("; ")}.` : ""
    ].filter(Boolean).join(" ");
    return cvProof(place.name,cells.map(say).join(" · "),[...new Set(cells.map(cell => cell.period || cell.metric.period).filter(Boolean))].join("; "),
      [...new Set(cells.map(cell => cell.metric.tier))],sources,notes);
  };
  const byName = (a,b) => a.name.localeCompare(b.name);
  const groups = [];
  if (model.placeKeys.length) groups.push({label:`${title}: ${model.countries.length ? "countries" : "regions"}${model.countries.length && model.regions.length ? " and regions" : ""}`,
    proof:[...definitions(model.placeKeys),...[...model.countries].sort(byName).map(placeEntry),...model.regions.map(placeEntry)]});
  if (model.stateKeys.length) groups.push({label:`${title}: U.S. states`,proof:[...definitions(model.stateKeys),...[...model.states].sort(byName).map(placeEntry)]});
  if (model.sites.length) groups.push({label:`${title}: sites`,proof:model.sites.map(site => cvProof(site.name,[site.place,cfTypeLabel(site.type)].filter(Boolean).join(" · "),"",site.tier,[site.source],site.description))});
  return groups;
}

// ---- Markup -----------------------------------------------------------------------------------
function cfStateShapes(model) {
  const shapes = (typeof amazonStateData !== "undefined" ? amazonStateData : []).map(state => ({id:statePostal[state.id],name:state.name,d:state.path,centroid:stateCentroid(state.path)}));
  if (model.states.some(state => state.id === "DC")) {
    const {x,y,r} = cfDC;
    shapes.push({id:"DC",name:"District of Columbia",d:`M${x - r},${y}A${r},${r} 0 1,0 ${x + r},${y}A${r},${r} 0 1,0 ${x - r},${y}Z`,centroid:{x,y},dot:true});
  }
  return shapes;
}
function cfStatesView(model, shapes) {
  const options = keys => keys.map(key => `<option value="${escapeHtml(key)}">${escapeHtml(model.metrics[key].label)}</option>`).join("");
  const dc = shapes.find(shape => shape.dot);
  return `
    <div id="cf-states-view" class="amazon-states-view cf-states-view" hidden>
      <div class="amazon-states-map">
        <p class="amazon-states-summary" id="cf-states-summary"></p>
        <div class="amazon-states-canvas" id="cf-states-canvas">
          <svg viewBox="-64 0 1030 620" tabindex="-1" role="radiogroup" aria-label="Map of the U.S. states${dc ? " and DC" : ""}. Use the arrow keys to move between states." aria-describedby="cf-states-summary">
            <defs>
              <pattern id="cf-state-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" fill="#2b3a3c"></rect><line x1="0" y1="0" x2="0" y2="7" stroke="#5a6d6b" stroke-width="2"></line>
              </pattern>
            </defs>
            ${dc ? `<g class="cf-dc-mark" aria-hidden="true"><line x1="${cfDC.at[0]}" y1="${cfDC.at[1]}" x2="${cfDC.x - cfDC.r}" y2="${cfDC.y}"></line><circle cx="${cfDC.at[0]}" cy="${cfDC.at[1]}" r="1.6"></circle><text x="${cfDC.x + cfDC.r + 5}" y="${cfDC.y + 4}">DC</text></g>` : ""}
            <g class="amazon-state-shapes">
              ${shapes.map(shape => `<path data-state="${shape.id}" d="${shape.d}" role="radio" aria-checked="false" tabindex="-1"></path>`).join("")}
            </g>
            <g class="amazon-state-rings" aria-hidden="true">
              <path class="ring-hover" d=""></path>
              <path class="ring-casing" d=""></path>
              <path class="ring-selected" d=""></path>
            </g>
          </svg>
          <div class="amazon-state-tip" id="cf-state-tip" aria-hidden="true" hidden></div>
        </div>
        <div class="state-heat-legend" id="cf-state-legend" role="img">
          <p class="state-heat-title" id="cf-state-legend-title"></p>
          <div class="state-heat-scale"></div>
          <div class="state-heat-ticks"></div>
          <p class="state-heat-missing" hidden><i></i>Not reported</p>
        </div>
        <p class="amazon-state-inset">Alaska and Hawaii are shown as insets.${dc ? " DC is the dot beside Maryland." : ""}</p>
      </div>
      <div class="amazon-state-panel">
        <div class="amazon-state-controls">
          <div${model.stateKeys.length > 1 ? "" : " hidden"}>
            <label for="cf-state-metric">Shade states by</label>
            <select id="cf-state-metric">${options(model.stateKeys)}</select>
          </div>
          <div>
            <label for="cf-state-picker">State</label>
            <select id="cf-state-picker">${[...shapes].sort((a,b) => a.name.localeCompare(b.name)).map(shape => `<option value="${shape.id}">${escapeHtml(shape.name)}</option>`).join("")}</select>
          </div>
        </div>
        <div id="cf-state-detail" class="amazon-map-detail amazon-state-detail" aria-live="polite"></div>
      </div>
    </div>`;
}
function cfPanel(model, shapes) {
  const company = escapeHtml(model.company);
  const globe = model.layers.some(([layer]) => layer !== "states");
  return `
    <section class="amazon-footprint company-footprint" id="company-footprint" aria-labelledby="cf-title" data-leader="${escapeHtml(model.leader.id)}">
      <header class="amazon-map-header">
        <div class="amazon-map-heading">
          <p class="amazon-map-kicker">Reach</p>
          <h3 id="cf-title" tabindex="-1">Where ${company} creates value</h3>
          <p class="amazon-map-lede" id="cf-lede"></p>
          <p class="amazon-map-takeaway" id="cf-takeaway"></p>
        </div>
        <div class="amazon-map-switch" role="group" aria-label="Map layer" style="--active:0;--count:${model.layers.length}"${model.layers.length > 1 ? "" : " hidden"}>
          ${model.layers.map(([layer,label],index) => `<button type="button" data-layer="${layer}" aria-pressed="${index === 0}">${label}</button>`).join("")}
        </div>
      </header>
      ${globe ? `<div class="amazon-map-layout" id="cf-layout">
        <div class="amazon-world">
          <canvas id="cf-globe" tabindex="0" aria-label="${company} globe. Use the arrow keys to rotate, plus or minus to zoom, or choose an entry in the list."></canvas>
          <div class="amazon-heat-legend" id="cf-legend"></div>
          <div class="zoom" aria-label="Globe zoom">
            <button type="button" data-zoom="-1" aria-label="Zoom out">−</button><button type="button" data-zoom="1" aria-label="Zoom in">+</button>
          </div>
        </div>
        <div class="amazon-map-panel">
          <div class="cf-measure" id="cf-place-measure-wrap" hidden>
            <label for="cf-place-measure">Rank by</label>
            <select id="cf-place-measure">${model.placeKeys.map(key => `<option value="${escapeHtml(key)}">${escapeHtml(model.metrics[key].label)}</option>`).join("")}</select>
          </div>
          <div id="cf-list" class="amazon-map-list" role="group" aria-label="Globe locations"></div>
          <div id="cf-detail" class="amazon-map-detail" aria-live="polite"></div>
        </div>
      </div>` : ""}
      ${model.stateKeys.length ? cfStatesView(model,shapes) : ""}
      <footer class="amazon-map-notes">
        <p id="cf-note"></p>
        <div id="cf-source" class="amazon-map-source"></div>
      </footer>
    </section>`;
}

// ---- U.S. states ----------------------------------------------------------------------------
function cfBindStates(root, model, shapes, api) {
  const picker = root.querySelector("#cf-state-picker");
  const metric = root.querySelector("#cf-state-metric");
  const detail = root.querySelector("#cf-state-detail");
  const summary = root.querySelector("#cf-states-summary");
  const tip = root.querySelector("#cf-state-tip");
  const svg = root.querySelector("svg");
  const canvas = root.querySelector("#cf-states-canvas");
  const paths = [...root.querySelectorAll(".amazon-state-shapes path[data-state]")];
  const rings = {hover:root.querySelector(".ring-hover"),casing:root.querySelector(".ring-casing"),selected:root.querySelector(".ring-selected")};
  const legend = root.querySelector("#cf-state-legend");
  const legendTitle = root.querySelector("#cf-state-legend-title");
  const legendScale = legend.querySelector(".state-heat-scale");
  const legendTicks = legend.querySelector(".state-heat-ticks");
  const legendMissing = legend.querySelector(".state-heat-missing");
  const byState = new Map(model.states.map(state => [state.id,state]));
  const indexOf = id => shapes.findIndex(shape => shape.id === id);
  let hovered = -1, bands = [], marker = null;

  const cell = (id,key) => byState.get(id)?.values[key] || null;
  const amount = (id,key) => { const c = cell(id,key); return c ? cfFormat(c.metric,c.value,c.plus) : "Not reported"; };
  const reported = key => model.states.filter(state => state.values[key]);
  function rank(id,key) {
    const c = cell(id,key);
    if (!c) return null;
    const all = reported(key);
    return {position:1 + all.filter(state => state.values[key].value > c.value).length,tied:all.filter(state => state.values[key].value === c.value).length > 1,total:all.length,scope:cfScopeText(all).replace(/^all /,"")};
  }
  const rankText = r => r ? `${r.tied ? "Tied for " : ""}#${r.position} of ${r.scope}` : "Not reported";
  const shortRank = r => r ? `#${r.position} of ${r.total}${r.tied ? ", tied" : ""}` : "";

  function renderLegend(key) {
    const m = model.metrics[key];
    bands = cfBands(reported(key).map(state => state.values[key].value),cfRamp);
    legendTitle.innerHTML = `${escapeHtml(m.label)} by state${m.period ? " · " : ""}${cfPeriodTags(m,reported(key).map(state => state.values[key]))}`;
    legendScale.style.setProperty("--bands",bands.length);
    legendScale.innerHTML = bands.map(band => `<i style="--swatch:${band.color}"></i>`).join("") + '<b class="state-heat-marker" hidden></b>';
    marker = legendScale.querySelector(".state-heat-marker");
    legendTicks.innerHTML = bands.slice(1).map((band,i) => `<span style="--at:${(i + 1) / bands.length}">${escapeHtml(cfTick(m,band.min))}</span>`).join("");
    legendMissing.hidden = !shapes.some(shape => !cell(shape.id,key));
    legend.setAttribute("aria-label",`Map key for ${m.phrase}: ${bands.map((band,i) => cfBandLabel(bands,i,m)).join(", ")}${legendMissing.hidden ? "" : ", not reported"}.`);
  }
  function placeMarker(id,key) {
    const band = cfBandOf(bands,cell(id,key)?.value);
    marker.hidden = !band;
    if (band) marker.style.setProperty("--at",(bands.indexOf(band) + .5) / bands.length);
  }
  function renderSummary(key) {
    const m = model.metrics[key], all = reported(key);
    const sorted = [...all].sort((a,b) => a.values[key].value - b.values[key].value);
    const low = sorted[0], high = sorted.at(-1);
    const complete = all.length >= 50;
    const badge = complete ? (all.length === 51 ? "50 states and DC" : "Every state") : `${all.length} of ${shapes.length} ${shapes.length === 51 ? "states and DC" : "states"}`;
    let total = "";
    if (cfSummable(m)) {
      const sum = all.reduce((s,state) => s + state.values[key].value,0);
      total = `<span><strong>${escapeHtml(cfFormat(m,sum,all.some(state => state.values[key].plus)))}</strong> ${escapeHtml(m.phrase)} across ${cfScopeText(all)}</span>`;
    }
    summary.innerHTML = `<span class="amazon-states-every">${badge}</span>${total}
      <span class="amazon-states-range">${cfSummable(m) ? "Sum of reported state figures. " : ""}${all.length > 1 ? `Ranges from ${escapeHtml(amount(low.id,key))} in ${escapeHtml(low.name)} to ${escapeHtml(amount(high.id,key))} in ${escapeHtml(high.name)}.` : ""}</span>`;
  }
  const ring = (name,index) => rings[name].setAttribute("d",index < 0 ? "" : paths[index].getAttribute("d"));

  function render() {
    const selectedIndex = indexOf(picker.value), selected = shapes[selectedIndex], key = metric.value, m = model.metrics[key];
    renderLegend(key);
    paths.forEach((path,index) => {
      const shape = shapes[index], band = cfBandOf(bands,cell(shape.id,key)?.value);
      path.style.fill = band ? band.color : "url(#cf-state-hatch)";
      const isSelected = index === selectedIndex;
      path.setAttribute("aria-checked",String(isSelected));
      path.tabIndex = isSelected ? 0 : -1;
      path.setAttribute("aria-label",`${shape.name}: ${amount(shape.id,key)} ${m.phrase}`);
    });
    ring("casing",selectedIndex);
    ring("selected",selectedIndex);
    renderSummary(key);
    placeMarker(selected.id,key);
    const primary = cell(selected.id,key), primaryRank = rank(selected.id,key);
    const others = model.stateKeys.filter(other => other !== key && cell(selected.id,other));
    const sitesHere = model.sites.filter(site => site.state === selected.id).length;
    const sources = [primary,...others.map(other => cell(selected.id,other))].filter(Boolean);
    const uniqueSources = [...new Map(sources.map(c => [c.source.url,c])).values()];
    detail.innerHTML = `<h4><i aria-hidden="true"></i>${escapeHtml(selected.name)}</h4>
      <strong${primary ? "" : ' class="is-missing"'}>${primary ? cfNum(primary) : "Not reported"}</strong>
      <p>${escapeHtml(m.label)}${m.period ? ` · ${escapeHtml(m.period)}` : ""} ${cvTag(m.tier)}</p>
      ${primaryRank ? `<p class="amazon-state-rank">${primaryRank.tied ? "Tied for " : ""}<b>#${primaryRank.position}</b> of ${primaryRank.scope} by ${escapeHtml(m.phrase)}</p>` : ""}
      ${others.length ? `<dl>${others.map(other => {
        const c = cell(selected.id,other);
        return `<div><dt>${escapeHtml(c.metric.label)}</dt><dd>${cfNum(c)}<small>${shortRank(rank(selected.id,other))}</small></dd></div>`;
      }).join("")}</dl>` : ""}
      ${uniqueSources.map(c => cfSourceLink(c.source,null)).join("")}
      ${sitesHere ? `<button type="button" class="map-scope-link" data-sites-state="${selected.id}">Explore ${sitesHere === 1 ? "the site" : `${sitesHere} sites`} in ${escapeHtml(selected.name)}</button>` : ""}`;
    if (hovered >= 0) showTip(hovered);
    api.changed();
  }

  function svgPointToCanvas(x,y) {
    const matrix = svg.getScreenCTM(), box = canvas.getBoundingClientRect();
    if (!matrix) return {x:0,y:0};
    return {x:matrix.a * x + matrix.c * y + matrix.e - box.left,y:matrix.b * x + matrix.d * y + matrix.f - box.top};
  }
  function showTip(index,point) {
    const shape = shapes[index], key = metric.value, r = rank(shape.id,key);
    tip.innerHTML = `<b>${escapeHtml(shape.name)}</b><strong>${escapeHtml(amount(shape.id,key))}</strong><span>${escapeHtml(model.metrics[key].label)}</span>${r ? `<span>${rankText(r)}</span>` : ""}`;
    tip.hidden = false;
    const at = point || svgPointToCanvas(shape.centroid.x,shape.centroid.y);
    const width = canvas.clientWidth, tipWidth = tip.offsetWidth, tipHeight = tip.offsetHeight;
    let left = at.x + 14, top = at.y - tipHeight - 12;
    if (left + tipWidth > width - 4) left = at.x - tipWidth - 14;
    if (left < 4) left = Math.max(4,Math.min(width - tipWidth - 4,at.x - tipWidth / 2));
    if (top < 4) top = at.y + 16;
    tip.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
  }
  function hover(index,point) {
    hovered = index;
    ring("hover",index);
    marker?.classList.toggle("is-hover",index >= 0);
    if (index < 0) { tip.hidden = true; placeMarker(picker.value,metric.value); return; }
    placeMarker(shapes[index].id,metric.value);
    showTip(index,point);
  }
  function select(index,{focus = false} = {}) {
    if (index < 0) return;
    picker.value = shapes[index].id;
    render();
    if (focus) paths[index].focus();
  }
  // Arrow keys move to the nearest state in that direction (as on Amazon's map).
  function neighbour(index,dx,dy) {
    const from = shapes[index].centroid;
    let best = -1, bestScore = Infinity;
    shapes.forEach((shape,i) => {
      if (i === index) return;
      const to = shape.centroid, vx = to.x - from.x, vy = to.y - from.y;
      const along = vx * dx + vy * dy, across = Math.abs(vx * dy - vy * dx);
      if (along <= 0 || across > along * 2.2) return;
      const score = along + across * 2.5;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    return best;
  }
  const order = [...shapes.keys()].sort((a,b) => shapes[a].name.localeCompare(shapes[b].name));
  svg.addEventListener("keydown",event => {
    const index = paths.indexOf(event.target);
    if (index < 0) return;
    const moves = {ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    let next = -1;
    if (moves[event.key]) next = neighbour(index,...moves[event.key]);
    else if (event.key === "Home") next = order[0];
    else if (event.key === "End") next = order.at(-1);
    else if (event.key === "Escape") { hover(-1); return; }
    else return;
    event.preventDefault();
    if (next >= 0) select(next,{focus:true});
  });
  svg.addEventListener("focusin",event => {
    const index = paths.indexOf(event.target);
    if (index >= 0 && event.target.matches(":focus-visible")) { svg.classList.add("keyboard"); hover(index); }
  });
  svg.addEventListener("focusout",() => { svg.classList.remove("keyboard"); hover(-1); });
  svg.addEventListener("pointermove",event => {
    const path = event.target.closest?.(".amazon-state-shapes path");
    if (!path) { if (hovered >= 0) hover(-1); return; }
    const box = canvas.getBoundingClientRect();
    hover(paths.indexOf(path),{x:event.clientX - box.left,y:event.clientY - box.top});
  });
  svg.addEventListener("pointerleave",() => hover(-1));
  svg.addEventListener("click",event => {
    const path = event.target.closest("[data-state]");
    if (!path) return;
    const index = paths.indexOf(path);
    select(index);
    if (event.pointerType === "mouse") path.blur();
    if (event.pointerType && event.pointerType !== "mouse") hover(index);
    mapReveal(detail);
  });
  // Hovering a legend band highlights the states in it.
  legendScale.addEventListener("pointerover",event => {
    const swatch = event.target.closest("i");
    if (!swatch) return;
    const band = bands[[...legendScale.querySelectorAll("i")].indexOf(swatch)];
    svg.classList.add("filtering");
    paths.forEach((path,index) => path.classList.toggle("in-band",cfBandOf(bands,cell(shapes[index].id,metric.value)?.value) === band));
  });
  legendScale.addEventListener("pointerleave",() => svg.classList.remove("filtering"));
  picker.addEventListener("change",render);
  metric.addEventListener("change",render);
  // Start on the measure most states report (the first in the file on a tie), at the state that leads it.
  metric.value = model.stateKeys.reduce((best,key) => reported(key).length > reported(best).length ? key : best,model.stateKeys[0]);
  const first = reported(metric.value).sort((a,b) => b.values[metric.value].value - a.values[metric.value].value)[0];
  picker.value = first ? first.id : shapes[0].id;
  render();
  return {key:() => metric.value,focus:() => metric.closest("[hidden]") ? picker.focus() : metric.focus()};
}

// ---- Panel ----------------------------------------------------------------------------------
function cfBindPanel(root, model, shapes, initialLayer) {
  const $ = selector => root.querySelector(selector);
  const canvas = $("#cf-globe"), list = $("#cf-list"), detail = $("#cf-detail"), layout = $("#cf-layout");
  const statesView = $("#cf-states-view"), switcher = $(".amazon-map-switch");
  const lede = $("#cf-lede"), takeaway = $("#cf-takeaway"), note = $("#cf-note"), source = $("#cf-source");
  const measureWrap = $("#cf-place-measure-wrap"), measure = $("#cf-place-measure"), panel = $(".amazon-map-panel");
  const layers = model.layers.map(([layer]) => layer);
  const company = escapeHtml(model.company);
  let layer, globe = null, entries = [], positions = [], globeIndex = [], entryOfGlobe = [], states = null, scope = {}, mappable = true, current = -1;
  if (measureWrap) measureWrap.hidden = model.placeKeys.length < 2;

  function enter(element) {
    element.classList.remove("amazon-enter");
    void element.offsetWidth;
    element.classList.add("amazon-enter");
  }
  function updateListFade() {
    if (list) list.classList.toggle("has-more",list.scrollHeight - list.scrollTop - list.clientHeight > 4);
  }
  list?.addEventListener("scroll",updateListFade,{passive:true});
  // The list resizes when the panel crosses its narrow breakpoint: move the card to match.
  const listObserver = list ? new ResizeObserver(() => { updateListFade(); mapPlaceDetail(panel,list,detail,current); }) : null;
  listObserver?.observe(list);

  const regionName = (() => {
    let names = null;
    try { names = new Intl.DisplayNames(["en"],{type:"region"}); } catch {}
    return code => model.countries.find(country => country.iso2 === code)?.name || names?.of(code) || code;
  })();
  // Countries and regions for one measure, ranked, with band colors and globe positions. Regions tagged with a
  // country are listed under it (after it, or under its name when it has no row) and are never painted.
  // Country rows are never added up: a territory may also be inside another row's total.
  function placeEntries(key) {
    const value = place => place.values[key].value;
    const tops = [...model.countries,...model.regions.filter(region => !region.parent)].filter(place => place.values[key]).sort((a,b) => value(b) - value(a));
    const subs = model.regions.filter(region => region.parent && region.values[key]).sort((a,b) => value(b) - value(a));
    const metric = model.metrics[key];
    // Percent shares are mapped only when they read as parts of one total (they add up to no more than 100%).
    const mappable = metric.unit !== "percent" || tops.reduce((sum,place) => sum + value(place),0) <= 100.5;
    const bands = cfBands(tops.map(value),cfGlobeRamp);
    const max = Math.max(...tops.map(value),0);
    const dots = code => (typeof countryMask !== "undefined" && countryMask[code]) || [];
    const centroid = code => (typeof countryCentroids !== "undefined" && countryCentroids[code]) || null;
    const entry = (place, extra) => {
      const band = cfBandOf(bands,value(place));
      return {...place,cell:place.values[key],color:band.color,bandIndex:bands.indexOf(band),...extra};
    };
    const rows = [];
    const nested = parent => {
      const kids = subs.filter(sub => sub.parent === parent), kidMax = Math.max(...kids.map(value),0);
      return kids.map((kid,i) => entry(kid,{sub:true,parentName:regionName(parent),position:i + 1,of:kids.length,share:kidMax > 0 ? 100 * value(kid) / kidMax : 0,at:null}));
    };
    tops.forEach((place,i) => {
      // A region pin sits on its largest member country.
      const anchor = place.kind === "country" ? place.iso2 : place.members ? [...place.members].sort((a,b) => dots(b).length - dots(a).length)[0] : null;
      rows.push(entry(place,{position:i + 1,of:tops.length,share:max > 0 ? 100 * value(place) / max : 0,at:mappable && anchor ? centroid(anchor) : null}));
      if (place.kind === "country") rows.push(...nested(place.iso2));
    });
    const orphans = [...new Set(subs.map(sub => sub.parent))].filter(code => !tops.some(place => place.iso2 === code));
    for (const code of orphans) rows.push(...nested(code).map((kid,i) => ({...kid,groupStart:i === 0})));
    return {bands,rows,tops,mappable};
  }

  function chooseEntry(index, focus = false, reveal = false) {
    const item = entries[index];
    if (!item) return;
    current = index;
    list.querySelectorAll("button[data-entry]").forEach((button,i) => {
      button.setAttribute("aria-pressed",String(i === index));
      if (i === index && focus) button.focus();
    });
    if (layer === "countries") {
      const key = measure.value, m = model.metrics[key];
      const others = model.placeKeys.filter(other => other !== key && item.values[other]);
      const statesLink = item.iso2 === "US" && model.stateKeys.length;
      const sitesHere = item.iso2 ? model.sites.filter(site => site.iso2 === item.iso2).length : 0;
      const where = item.kind !== "region" ? "" : item.sub ? `A region of ${item.parentName}, as the company reports it; listed under it, not shaded on the globe.`
        : item.members ? `Region as the source defines it: ${item.members.join(", ")}.` : "A region as the company reports it; it has no country list, so it is not shaded on the globe.";
      detail.innerHTML = `<p class="amazon-detail-kicker"><i aria-hidden="true" style="--dot:${item.color}"></i>${escapeHtml(m.label)}</p>
        <h4>${escapeHtml(item.name)}</h4><strong>${cfNum(item.cell)}</strong>
        <span class="amazon-detail-share" aria-hidden="true" style="--share:${item.share}%;--dot:${item.color}"><span></span></span>
        <p>${m.period ? escapeHtml(m.period) + " · " : ""}#${item.position} of ${item.of}${item.sub ? ` in ${escapeHtml(item.parentName)}` : ""} ${cvTag(m.tier)}</p>
        ${where ? `<p class="amazon-detail-basis">${escapeHtml(where)}</p>` : ""}
        ${!item.sub && !mappable ? `<p class="amazon-detail-basis">These shares are not parts of one total, so they are listed but not mapped.</p>` : ""}
        ${others.length ? `<dl class="cf-dl">${others.map(other => `<div><dt>${escapeHtml(item.values[other].metric.label)}</dt><dd>${cfNum(item.values[other])}</dd></div>`).join("")}</dl>` : ""}
        ${[...new Map([item.cell,...others.map(other => item.values[other])].map(c => [c.source.url,c])).values()].map(c => cfSourceLink(c.source,null)).join("")}
        ${statesLink || sitesHere ? `<div class="amazon-detail-actions">
          ${statesLink ? `<button type="button" class="map-scope-link" data-open-states>Explore ${model.states.length >= 50 ? (model.states.length === 51 ? "all 50 states and DC" : "all 50 states") : `${model.states.length} U.S. ${model.states.length === 1 ? "state" : "states"}`}</button>` : ""}
          ${sitesHere ? `<button type="button" class="map-scope-link" data-sites-in="${item.iso2}">Explore ${sitesHere === 1 ? "the site" : `${sitesHere} sites`} in this country</button>` : ""}
        </div>` : ""}`;
    } else {
      detail.innerHTML = `<p class="amazon-detail-kicker"><i aria-hidden="true" style="--dot:${item.color}"></i>${escapeHtml(cfTypeLabel(item.type))}${item.place ? ` · ${escapeHtml(item.place)}` : ""}</p>
        <h4>${escapeHtml(item.name)}</h4>
        ${item.description ? `<p class="cf-site-words">${escapeHtml(item.description)}</p>` : ""}
        ${item.at ? "" : `<p class="amazon-detail-basis">No state or country is given for this site, so it has no pin.</p>`}
        ${cfSourceLink(item.source,item.tier)}`;
    }
    mapPlaceDetail(panel,list,detail,index);
    enter(detail);
    globe?.select(globeIndex[index] ?? -1);
    if (reveal) mapReveal(detail);
  }

  function setTakeaway() {
    if (layer === "countries") {
      const key = measure.value, m = model.metrics[key], tops = entries.filter(entry => !entry.sub).length ? entries.filter(entry => !entry.sub) : entries;
      // When a measure exists only for provinces or states inside a country, those are what it ranks.
      const top = [...tops].sort((a,b) => b.cell.value - a.cell.value)[0];
      const countries = tops.filter(entry => entry.kind === "country").length, regions = tops.length - countries;
      const among = [countries && `${countries} ${countries === 1 ? "country" : "countries"}`,regions && `${regions} ${regions === 1 ? "region" : "regions"}`].filter(Boolean).join(" and ");
      lede.textContent = `${m.label} by ${countries ? "country" : "region"}${countries && regions ? " and region" : ""}`;
      takeaway.innerHTML = (tops.length === 1
        ? `${escapeHtml(top.name)}: <b>${cfNum(top.cell)}</b> ${escapeHtml(m.phrase)}`
        : `${escapeHtml(top.name)} leads with <b>${cfNum(top.cell)}</b> ${escapeHtml(m.phrase)}, among <b>${among}</b> ${company} reports`)
        + cfWhen(m,entries.map(entry => entry.cell));
    } else if (layer === "states") {
      const key = states.key(), m = model.metrics[key];
      const all = model.states.filter(state => state.values[key]);
      const top = [...all].sort((a,b) => b.values[key].value - a.values[key].value)[0];
      const dc = all.some(state => state.id === "DC");
      const scopeText = cfScopeText(all);
      lede.textContent = `${m.label} by state`;
      const when = cfWhen(m,all.map(state => state.values[key]));
      if (cfSummable(m) && all.length > 1) {
        const sum = all.reduce((s,state) => s + state.values[key].value,0);
        takeaway.innerHTML = `<b>${escapeHtml(cfFormat(m,sum,all.some(state => state.values[key].plus)))}</b> ${m.unit.startsWith("currency") ? "in " : ""}${escapeHtml(m.phrase)} across ${scopeText}, led by ${escapeHtml(top.name)} with <b>${cfNum(top.values[key])}</b>${when}`;
      } else {
        takeaway.innerHTML = `${escapeHtml(top.name)} leads with <b>${cfNum(top.values[key])}</b> ${escapeHtml(m.phrase)}, across ${scopeText}${when}`;
      }
    } else {
      const count = entries.length, countries = new Set(entries.map(site => site.iso2).filter(Boolean)).size;
      const scopeName = scope.state ? cfStateNames[scope.state] : scope.country ? (model.countries.find(c => c.iso2 === scope.country)?.name || scope.country) : "";
      lede.textContent = `Selected sites, as ${model.company} describes them`;
      takeaway.innerHTML = scopeName
        ? `<b>${count}</b> selected ${count === 1 ? "site" : "sites"} in ${escapeHtml(scopeName)}.`
        : countries ? `<b>${count}</b> selected ${count === 1 ? "site" : "sites"} in <b>${countries}</b> ${countries === 1 ? "country" : "countries"}.` : `<b>${count}</b> selected ${count === 1 ? "site" : "sites"}.`;
    }
  }

  function setNotes() {
    if (layer === "states") {
      const key = states.key(), m = model.metrics[key];
      const cells = model.states.map(state => state.values[key]).filter(Boolean);
      note.textContent = [m.definition,cfShortPeriod(m.period) !== m.period ? `Period: ${m.period}.` : "",cells.some(c => c.plus) ? "A plus sign marks a lower bound (“more than”)." : "",
        "States without a figure are hatched; nothing is estimated."].filter(Boolean).join(" ");
      source.innerHTML = cfSourcesFor(cells);
    } else if (layer === "countries") {
      const key = measure.value, m = model.metrics[key];
      const unlisted = entries.some(entry => entry.kind === "region" && !entry.sub && !entry.members);
      const nested = entries.some(entry => entry.sub);
      const mixed = entries.some(entry => entry.kind === "region") && entries.some(entry => entry.kind === "country");
      note.textContent = [m.definition,cfShortPeriod(m.period) !== m.period ? `Period: ${m.period}.` : "",mixed ? "Countries and regions are as the company reports them and may overlap; they are never added together." : "",
        unlisted ? "Regions without a country list appear in the list only, not on the globe." : "",
        nested ? "Provinces and states the company reports are listed under their country and not shaded." : ""].filter(Boolean).join(" ");
      source.innerHTML = cfSourcesFor(entries.map(entry => entry.cell));
    } else {
      note.textContent = `Pins mark the state or country each site is in, not its exact location. Descriptions are ${cvPossessive(model.company)} own words.`;
      source.innerHTML = "";
    }
  }

  // Sites in one place share a pin position, so later ones are nudged around it.
  function sitePositions(sites) {
    const used = new Map();
    return sites.map(site => {
      const base = site.state && typeof usStateCentroids !== "undefined" && usStateCentroids[site.state]
        || site.iso2 && typeof countryCentroids !== "undefined" && countryCentroids[site.iso2] || null;
      if (!base) return null;
      const id = base.join(","), n = used.get(id) || 0;
      used.set(id,n + 1);
      if (!n) return base;
      const angle = n * 2.4, step = .8 + .25 * n;
      return [base[0] + step * Math.sin(angle),base[1] + step * Math.cos(angle) / Math.max(.3,Math.cos(base[0] * Math.PI / 180))];
    });
  }
  function siteTypes() {
    const counts = new Map();
    for (const site of model.sites) counts.set(site.type,(counts.get(site.type) || 0) + 1);
    const ordered = [...counts].sort((a,b) => b[1] - a[1]).map(([type]) => type);
    const colors = new Map(ordered.map((type,i) => [type,i < cfSiteColors.length && (i < cfSiteColors.length - 1 || ordered.length === cfSiteColors.length) ? cfSiteColors[i] : cfOtherColor]));
    return {ordered,colors};
  }
  const types = siteTypes();

  function show(next, nextScope = {}) {
    globe?.destroy();
    globe = null;
    layer = next;
    scope = nextScope;
    root.querySelectorAll("[data-layer]").forEach(button => button.setAttribute("aria-pressed",String(button.dataset.layer === layer)));
    switcher.style.setProperty("--active",layers.indexOf(layer));
    const isStates = layer === "states";
    if (layout) layout.hidden = isStates;
    if (statesView) statesView.hidden = !isStates;
    enter(isStates ? statesView : layout);
    if (isStates) { setTakeaway(); setNotes(); return; }

    const isPlaces = layer === "countries";
    measureWrap.hidden = !isPlaces || model.placeKeys.length < 2;
    let markers;
    if (isPlaces) {
      const placed = placeEntries(measure.value), {bands,rows,tops} = placed;
      mappable = placed.mappable;
      entries = rows;
      positions = rows.map(row => row.at);
      const m = model.metrics[measure.value];
      $("#cf-legend").innerHTML = `<span class="amazon-legend-title">${escapeHtml(m.label)}</span>
        ${m.period || cfPeriodsDiffer(m,rows.map(row => row.cell)) ? `<span class="cf-legend-period">${cfPeriodTags(m,rows.map(row => row.cell))}</span>` : ""}
        ${mappable ? `<span class="cf-legend-steps" style="--bands:${bands.length}">${bands.map(band => `<i style="--dot:${band.color}"></i>`).join("")}</span>
        ${bands.length > 1 ? `<span class="amazon-legend-range"><span>${escapeHtml(cfTick(m,Math.min(...rows.filter(r => !r.sub).map(r => r.cell.value))))}</span><span>${escapeHtml(cfTick(m,Math.max(...rows.filter(r => !r.sub).map(r => r.cell.value))))}</span></span>` : ""}`
        : '<span class="cf-legend-note">Listed, not mapped: these shares are not parts of one total.</span>'}`;
      markers = rows.map(row => ({color:row.color,rgb:cfRgb(row.color),glow:.22 + .08 * row.bandIndex,radius:3.4 + .55 * row.bandIndex}));
    } else {
      entries = model.sites.filter(site => (!scope.country || site.iso2 === scope.country) && (!scope.state || site.state === scope.state))
        .map(site => ({...site,color:types.colors.get(site.type)}));
      positions = sitePositions(entries);
      entries.forEach((entry,i) => entry.at = positions[i]);
      const item = (color, label, count) => `<span class="amazon-legend-item${count ? "" : " is-empty"}"><i style="--dot:${color}"></i>${escapeHtml(label)}<em>${count}</em></span>`;
      const named = types.ordered.filter(type => types.colors.get(type) !== cfOtherColor);
      const other = entries.filter(site => types.colors.get(site.type) === cfOtherColor).length;
      $("#cf-legend").innerHTML = `<span class="amazon-legend-title">Site type</span>`
        + named.map(type => item(types.colors.get(type),cfTypeLabel(type),entries.filter(site => site.type === type).length)).join("")
        + (named.length < types.ordered.length ? item(cfOtherColor,"Other",other) : "");
      markers = entries.map(site => ({color:site.color,radius:3.6}));
    }
    setTakeaway();
    setNotes();
    const scopeName = scope.state ? cfStateNames[scope.state] : scope.country ? (model.countries.find(c => c.iso2 === scope.country)?.name || scope.country) : "";
    list.setAttribute("aria-label",isPlaces ? `Ranked by ${model.metrics[measure.value].phrase}` : scopeName ? `Selected sites in ${scopeName}` : "Selected sites");
    list.classList.toggle("is-markets",isPlaces && entries.length <= 6);
    current = -1;
    mapPlaceDetail(panel,list,detail,-1);
    list.innerHTML = (scopeName ? `<div class="amazon-list-scope"><span>Showing <strong>${escapeHtml(scopeName)}</strong></span><button type="button" data-all-sites>Show all sites</button></div>` : "") + entries.map((item,index) => {
      if (isPlaces) return `${item.groupStart ? `<p class="cf-sub-head">In ${escapeHtml(item.parentName)}</p>` : ""}<button type="button" data-entry="${index}" aria-pressed="false" class="${item.sub ? "cf-sub" : ""}" style="--dot:${item.color};--share:${item.share}%">
          <i aria-hidden="true"></i><strong>${escapeHtml(item.name)}${item.kind === "region" && !item.sub ? '<small class="cf-region-tag">Region</small>' : ""}${item.sub ? `<span class="amazon-sr"> in ${escapeHtml(item.parentName)}</span>` : ""}</strong><b>${escapeHtml(cfFormat(item.cell.metric,item.cell.value,item.cell.plus))}</b>
          <span class="amazon-row-bar" aria-hidden="true"><span></span></span><small class="amazon-row-share">#${item.position}</small></button>`;
      return `<button type="button" data-entry="${index}" aria-pressed="false" style="--dot:${item.color}">
        <i aria-hidden="true"></i><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml([item.place,cfTypeLabel(item.type)].filter(Boolean).join(" · "))}</small></span></button>`;
    }).join("");
    list.scrollTop = 0;
    updateListFade();
    // Globe markers only for entries with a position; the list keeps every entry.
    globeIndex = [];
    entryOfGlobe = [];
    const pins = [], pinStyles = [];
    entries.forEach((entry,index) => {
      if (!positions[index]) return;
      globeIndex[index] = pins.length;
      entryOfGlobe.push(index);
      pins.push([entry.name,positions[index][0],positions[index][1]]);
      pinStyles.push(markers[index]);
    });
    let heat = null;
    if (isPlaces && mappable) {
      heat = new Map();
      const masks = typeof countryMask !== "undefined" ? countryMask : {};
      for (const entry of entries) if (entry.kind === "country") for (const dot of masks[entry.iso2] || []) heat.set(dot,{color:entry.color});
      // A region shades its member countries, unless a country has its own figure. Sub-national regions never paint.
      for (const entry of entries) if (entry.kind === "region" && !entry.sub && entry.members) for (const code of entry.members) {
        if (entries.some(other => other.kind === "country" && other.iso2 === code)) continue;
        for (const dot of masks[code] || []) if (!heat.has(dot)) heat.set(dot,{color:entry.color});
      }
    }
    globe = createGlobe(canvas,pins,index => chooseEntry(entryOfGlobe[index],false,true),{arcs:false,heat,ringColor:"#ffd298",markers:pinStyles});
    chooseEntry(0);
  }

  const api = {changed() { if (layer === "states") { setTakeaway(); setNotes(); } }};
  if (statesView) states = cfBindStates(statesView,model,shapes,api);
  measure?.addEventListener("change",() => { if (layer === "countries") show("countries"); });

  root.addEventListener("click",event => {
    const target = event.target.closest("button");
    if (!target || !root.contains(target)) return;
    if (target.dataset.layer && target.dataset.layer !== layer) show(target.dataset.layer);
    if (target.dataset.entry != null) chooseEntry(Number(target.dataset.entry),false,true);
    if (target.hasAttribute("data-open-states")) { show("states"); states.focus(); }
    if (target.dataset.sitesIn) show("sites",{country:target.dataset.sitesIn});
    if (target.dataset.sitesState) show("sites",{state:target.dataset.sitesState});
    if (target.hasAttribute("data-all-sites")) show("sites");
    if (target.dataset.zoom) globe?.magnify(Number(target.dataset.zoom) * .15);
    if (target.dataset.sitesIn || target.dataset.sitesState || target.hasAttribute("data-all-sites")) list.querySelector("[data-entry]")?.focus();
  });
  // Arrow keys move between layers in the switch and between rows in the list.
  switcher.addEventListener("keydown",event => {
    const step = {ArrowLeft:-1,ArrowRight:1}[event.key];
    if (!step) return;
    event.preventDefault();
    const next = layers[(layers.indexOf(layer) + step + layers.length) % layers.length];
    show(next);
    switcher.querySelector(`[data-layer="${next}"]`).focus();
  });
  list?.addEventListener("keydown",event => {
    const current = event.target.closest("button[data-entry]");
    if (!current) return;
    const index = Number(current.dataset.entry), last = entries.length - 1;
    const next = {ArrowDown:Math.min(last,index + 1),ArrowUp:Math.max(0,index - 1),Home:0,End:last}[event.key];
    if (next == null) return;
    event.preventDefault();
    chooseEntry(next,true);
  });

  // A company with state figures opens on its U.S. map, the richest view; otherwise on the first layer.
  show(layers.includes(initialLayer) ? initialLayer : layers.includes("states") ? "states" : layers[0]);
  return {
    destroy() { globe?.destroy(); globe = null; listObserver?.disconnect(); },
    focusTarget: () => layers.length > 1 ? switcher.querySelector("[aria-pressed='true']") : $("#cf-title")
  };
}

// Replaces the simple "Operating footprint" section with the panel once the company file has loaded.
// Resolves {root, controller, focusTarget} when it did, or null (no footprint rows, or the profile moved on).
async function bindCompanyFootprint(simple, leader, section) {
  if (!simple || leader.id === "jeff-bezos" || typeof cvLoad !== "function") return null;
  const record = await cvLoad(leader.id);
  if (!simple.isConnected || !record || record.id !== leader.id) return null;
  let model;
  try { model = companyFootprintModel(record,leader); } catch { model = null; }
  if (!model) return null;
  const globeLayers = model.layers.some(([layer]) => layer !== "states");
  await mapScripts([...globeLayers ? ["globe.js","country-mask.js"] : [],...model.stateKeys.length ? ["amazon-state-data.js","amazon-state-map.js"] : []]);
  if (!simple.isConnected) return null;
  const shapes = model.stateKeys.length ? cfStateShapes(model) : [];
  const holder = document.createElement("div");
  holder.innerHTML = cfPanel(model,shapes);
  const root = holder.firstElementChild;
  simple.replaceWith(root);
  let controller;
  try {
    controller = cfBindPanel(root,model,shapes,section === "states" ? "states" : null);
  } catch (error) {
    // Data the panel can't draw: put the simple globe (still running) back rather than leave an empty panel.
    console.error(error);
    root.replaceWith(simple);
    return null;
  }
  return {root,controller,focusTarget:controller.focusTarget};
}

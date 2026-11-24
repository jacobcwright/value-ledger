const amazonStateSource = "https://www.aboutamazon.com/news/community/how-amazon-is-investing-in-the-us";
// Sequential ramp for the dark map surface: evenly spaced in OKLCH lightness, ending on --gold (#ffd298).
const stateHeatRamp = ["#665041","#8c6443","#b07b48","#cf9557","#e8b374","#ffd298"];
const stateHeatBands = [
  {min:0,  label:"Under $1B",   tick:"",      color:stateHeatRamp[0]},
  {min:1,  label:"$1B–<$5B",    tick:"$1B",   color:stateHeatRamp[1]},
  {min:5,  label:"$5B–<$20B",   tick:"$5B",   color:stateHeatRamp[2]},
  {min:20, label:"$20B–<$50B",  tick:"$20B",  color:stateHeatRamp[3]},
  {min:50, label:"$50B–<$100B", tick:"$50B",  color:stateHeatRamp[4]},
  {min:100,label:"$100B+",      tick:"$100B", color:stateHeatRamp[5]}
];
const statePeopleBands = [
  {min:0,    label:"Under 1,000",     tick:"",    color:stateHeatRamp[0]},
  {min:1000, label:"1,000–<5,000",    tick:"1K",  color:stateHeatRamp[1]},
  {min:5000, label:"5,000–<10,000",   tick:"5K",  color:stateHeatRamp[2]},
  {min:10000,label:"10,000–<25,000",  tick:"10K", color:stateHeatRamp[3]},
  {min:25000,label:"25,000–<50,000",  tick:"25K", color:stateHeatRamp[4]},
  {min:50000,label:"50,000+",         tick:"50K", color:stateHeatRamp[5]}
];
const stateMeasures = {
  gdp:{label:"Estimated GDP contribution",phrase:"estimated GDP contribution",period:"2010–2025",bands:stateHeatBands},
  investment:{label:"Amazon investment",phrase:"Amazon investment",period:"2010–2025",bands:stateHeatBands},
  employees:{label:"People employed",phrase:"people employed",period:"",bands:statePeopleBands}
};
const statePostal = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"};

// Centroid of the largest ring of an absolute M/L/Z path, in SVG user units.
function stateCentroid(d) {
  let best = null;
  for (const ring of d.split(/M/).filter(Boolean)) {
    const points = ring.replace(/Z/g,"").split("L").map(pair => pair.split(",").map(Number));
    let area = 0, cx = 0, cy = 0;
    points.forEach(([x0,y0],i) => {
      const [x1,y1] = points[(i + 1) % points.length];
      const cross = x0 * y1 - x1 * y0;
      area += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
    });
    if (!best || Math.abs(area) > Math.abs(best.area)) best = {area,x:cx / (3 * area),y:cy / (3 * area)};
  }
  return best;
}

function amazonStatesView() {
  const legendScale = bands => bands.map(band => `<i style="--swatch:${band.color}"></i>`).join("");
  return `
    <div id="amazon-states-view" class="amazon-states-view" hidden>
      <div class="amazon-states-map">
        <p class="amazon-states-summary" id="amazon-states-summary"></p>
        <div class="amazon-states-canvas">
          <svg viewBox="-64 0 1030 620" tabindex="-1" role="radiogroup" aria-label="Map of the ${amazonStateData.length} U.S. states. Use the arrow keys to move between states." aria-describedby="amazon-states-summary">
            <defs>
              <pattern id="amazon-state-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" fill="#2b3a3c"></rect><line x1="0" y1="0" x2="0" y2="7" stroke="#5a6d6b" stroke-width="2"></line>
              </pattern>
            </defs>
            <g class="amazon-state-shapes">
              ${amazonStateData.map(state => `<path data-state="${state.id}" d="${state.path}" role="radio" aria-checked="false" tabindex="-1"></path>`).join("")}
            </g>
            <g class="amazon-state-rings" aria-hidden="true">
              <path class="ring-hover" d=""></path>
              <path class="ring-casing" d=""></path>
              <path class="ring-selected" d=""></path>
            </g>
          </svg>
          <div class="amazon-state-tip" id="amazon-state-tip" aria-hidden="true" hidden></div>
        </div>
        <div class="state-heat-legend" id="amazon-state-legend" role="img">
          <p class="state-heat-title" id="amazon-state-legend-title"></p>
          <div class="state-heat-scale">${legendScale(stateHeatBands)}<b class="state-heat-marker" hidden></b></div>
          <div class="state-heat-ticks"></div>
          <p class="state-heat-missing" hidden><i></i>Not reported</p>
        </div>
        <p class="amazon-state-inset">Alaska and Hawaii are shown as insets.</p>
      </div>
      <div class="amazon-state-panel">
        <div class="amazon-state-controls">
          <div>
            <label for="amazon-state-metric">Shade states by</label>
            <select id="amazon-state-metric">${Object.entries(stateMeasures).map(([key,measure]) => `<option value="${key}">${measure.label}</option>`).join("")}</select>
          </div>
          <div>
            <label for="amazon-state-picker">State</label>
            <select id="amazon-state-picker">${amazonStateData.map(state => `<option value="${state.id}">${state.name}</option>`).join("")}</select>
          </div>
        </div>
        <div id="amazon-state-detail" class="amazon-map-detail amazon-state-detail" aria-live="polite"></div>
      </div>
    </div>`;
}

function bindAmazonStates(root) {
  const picker = byId("amazon-state-picker");
  const metric = byId("amazon-state-metric");
  const detail = byId("amazon-state-detail");
  const summary = byId("amazon-states-summary");
  const tip = byId("amazon-state-tip");
  const svg = root.querySelector("svg");
  const canvas = root.querySelector(".amazon-states-canvas");
  const paths = [...root.querySelectorAll(".amazon-state-shapes path[data-state]")];
  const rings = {
    hover:root.querySelector(".ring-hover"),
    casing:root.querySelector(".ring-casing"),
    selected:root.querySelector(".ring-selected")
  };
  const legend = byId("amazon-state-legend");
  const legendTitle = byId("amazon-state-legend-title");
  const legendScale = legend.querySelector(".state-heat-scale");
  const legendTicks = legend.querySelector(".state-heat-ticks");
  const legendMarker = legend.querySelector(".state-heat-marker");
  const legendMissing = legend.querySelector(".state-heat-missing");
  const centroids = amazonStateData.map(state => stateCentroid(state.path));
  const indexOf = id => amazonStateData.findIndex(state => state.id === id);
  let hovered = -1;

  const has = (state,key) => state[key] != null;
  const amount = (state,key) => {
    if (!has(state,key)) return "Not reported";
    const plus = state[key + "Plus"] ? "+" : "";
    return (key === "employees" ? integer.format(state[key]) : compactMoney(state[key])) + plus;
  };
  const measureLabel = (state,key) => key === "employees" && state.employeeDate
    ? `${stateMeasures[key].label} · ${state.employeeDate}` : stateMeasures[key].label;
  function rank(state,key) {
    const reported = amazonStateData.filter(entry => has(entry,key));
    if (!has(state,key)) return null;
    const position = 1 + reported.filter(entry => entry[key] > state[key]).length;
    const tied = reported.filter(entry => entry[key] === state[key]).length > 1;
    return {position,tied,total:reported.length};
  }
  const rankText = (r,suffix = "") => r ? `${r.tied ? "Tied for " : ""}#${r.position} of ${r.total} states${suffix}` : "Not reported";
  const shortRank = r => `#${r.position} of ${r.total}${r.tied ? ", tied" : ""}`;
  const bandOf = (state,key) => has(state,key) ? stateMeasures[key].bands.findLast(band => band.min <= state[key]) : null;

  function renderLegend(key) {
    const {bands,label,period} = stateMeasures[key];
    legendTitle.textContent = period ? `${label}, ${period}` : `${label}, latest snapshot`;
    legendTicks.innerHTML = bands.slice(1).map((band,i) => `<span style="--at:${(i + 1) / bands.length}">${band.tick}</span>`).join("");
    legendScale.querySelectorAll("i").forEach((swatch,i) => swatch.style.setProperty("--swatch",bands[i].color));
    legendMissing.hidden = !amazonStateData.some(state => !has(state,key));
    legend.setAttribute("aria-label",`Map key for ${label.toLowerCase()}: ${bands.map(band => band.label).join(", ")}${legendMissing.hidden ? "" : ", not reported"}.`);
  }

  function placeMarker(state,key) {
    const band = bandOf(state,key);
    legendMarker.hidden = !band;
    if (band) legendMarker.style.setProperty("--at",(stateMeasures[key].bands.indexOf(band) + .5) / stateMeasures[key].bands.length);
  }

  function renderSummary(key) {
    const reported = amazonStateData.filter(state => has(state,key));
    const sorted = [...reported].sort((a,b) => a[key] - b[key]);
    const low = sorted[0], high = sorted.at(-1);
    const total = reported.reduce((sum,state) => sum + state[key],0);
    const totalText = key === "employees" ? integer.format(total) + "+" : compactMoney(total) + "+";
    const scope = reported.length === amazonStateData.length ? `all ${reported.length} states` : `the ${reported.length} states that report it`;
    const what = key === "employees" ? "people employed" : stateMeasures[key].phrase;
    const badge = reported.length === amazonStateData.length ? "Every state" : `${reported.length} of ${amazonStateData.length} states`;
    summary.innerHTML = `<span class="amazon-states-every">${badge}</span>
      <span><strong>${totalText}</strong> ${what} across ${scope}</span>
      <span class="amazon-states-range">Sum of reported state figures${stateMeasures[key].period ? ", " + stateMeasures[key].period : ", latest snapshot"}. Ranges from ${amount(low,key)} in ${low.name} to ${amount(high,key)} in ${high.name}.</span>`;
  }

  function ring(name,index) {
    rings[name].setAttribute("d",index < 0 ? "" : paths[index].getAttribute("d"));
  }

  function render() {
    const selectedIndex = indexOf(picker.value);
    const selected = amazonStateData[selectedIndex];
    const key = metric.value;
    paths.forEach((path,index) => {
      const state = amazonStateData[index];
      const band = bandOf(state,key);
      path.style.fill = band ? band.color : "url(#amazon-state-hatch)";
      const isSelected = index === selectedIndex;
      path.setAttribute("aria-checked",String(isSelected));
      path.tabIndex = isSelected ? 0 : -1;
      path.setAttribute("aria-label",`${state.name}: ${amount(state,key)} ${stateMeasures[key].phrase}`);
    });
    ring("casing",selectedIndex);
    ring("selected",selectedIndex);
    svg.dataset.measure = key;
    renderLegend(key);
    renderSummary(key);
    placeMarker(selected,key);

    const others = Object.keys(stateMeasures).filter(other => other !== key && has(selected,other));
    const primaryRank = rank(selected,key);
    detail.innerHTML = `<h4><i aria-hidden="true"></i>${selected.name}</h4>
      <strong${has(selected,key) ? "" : ' class="is-missing"'}>${amount(selected,key)}</strong>
      <p>${measureLabel(selected,key)}${stateMeasures[key].period ? ` · ${stateMeasures[key].period}` : ""}</p>
      ${primaryRank ? `<p class="amazon-state-rank">${primaryRank.tied ? "Tied for " : ""}<b>#${primaryRank.position}</b> of ${primaryRank.total} states by ${stateMeasures[key].phrase}</p>` : ""}
      <dl>${others.map(other => `<div><dt>${measureLabel(selected,other)}</dt><dd>${amount(selected,other)}<small>${shortRank(rank(selected,other))}</small></dd></div>`).join("")}</dl>
      ${externalLink(selected.url,`${selected.name} fact sheet`)}
      ${amazonSites.some(site => site.state === selected.id) ? `<button type="button" class="map-scope-link" data-sites-state="${selected.id}">Explore selected sites in ${selected.name}</button>` : ""}`;
    if (hovered >= 0) showTip(hovered);
  }

  // Tooltip, positioned inside the map so it stays within the dialog.
  function svgPointToCanvas(x,y) {
    const matrix = svg.getScreenCTM();
    const box = canvas.getBoundingClientRect();
    if (!matrix) return {x:0,y:0};
    return {x:matrix.a * x + matrix.c * y + matrix.e - box.left,y:matrix.b * x + matrix.d * y + matrix.f - box.top};
  }
  function showTip(index,point) {
    const state = amazonStateData[index], key = metric.value;
    const r = rank(state,key);
    tip.innerHTML = `<b>${state.name}</b><strong>${amount(state,key)}</strong><span>${measureLabel(state,key)}</span>${r ? `<span>${rankText(r)}</span>` : ""}`;
    tip.hidden = false;
    const at = point || svgPointToCanvas(centroids[index].x,centroids[index].y);
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
    legendMarker.classList.toggle("is-hover",index >= 0);
    if (index < 0) { tip.hidden = true; placeMarker(amazonStateData[indexOf(picker.value)],metric.value); return; }
    placeMarker(amazonStateData[index],metric.value);
    showTip(index,point);
  }

  function select(index,{focus = false} = {}) {
    if (index < 0) return;
    picker.value = amazonStateData[index].id;
    render();
    if (focus) paths[index].focus();
  }

  // Arrow keys move to the nearest state in that direction.
  function neighbour(index,dx,dy) {
    const from = centroids[index];
    let best = -1, bestScore = Infinity;
    centroids.forEach((to,i) => {
      if (i === index) return;
      const vx = to.x - from.x, vy = to.y - from.y;
      const along = vx * dx + vy * dy, across = Math.abs(vx * dy - vy * dx);
      if (along <= 0 || across > along * 2.2) return;
      const score = along + across * 2.5;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    return best;
  }
  svg.addEventListener("keydown",event => {
    const index = paths.indexOf(event.target);
    if (index < 0) return;
    const moves = {ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    let next = -1;
    if (moves[event.key]) next = neighbour(index,...moves[event.key]);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = paths.length - 1;
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
    // On a narrow panel the card sits under the map: bring it into view if the tap left it off-screen.
    if (typeof mapReveal === "function") mapReveal(detail);
  });

  // Hovering a legend band highlights the states in it.
  legendScale.addEventListener("pointerover",event => {
    const swatch = event.target.closest("i");
    if (!swatch) return;
    const band = stateMeasures[metric.value].bands[[...legendScale.children].indexOf(swatch)];
    svg.classList.add("filtering");
    paths.forEach((path,index) => path.classList.toggle("in-band",bandOf(amazonStateData[index],metric.value) === band));
  });
  legendScale.addEventListener("pointerleave",() => svg.classList.remove("filtering"));

  picker.addEventListener("change",render);
  metric.addEventListener("change",render);
  picker.value = "06";
  render();
}

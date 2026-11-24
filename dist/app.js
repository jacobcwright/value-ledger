const byId = id => document.getElementById(id);
const integer = new Intl.NumberFormat("en-US");
const decimal = new Intl.NumberFormat("en-US",{maximumFractionDigits:1});
const dollars = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
function compactMoney(billions) {
  if (billions >= 1000) return "$" + (billions / 1000).toFixed(2) + "T";
  if (billions >= 1) return "$" + decimal.format(billions) + "B";
  return "$" + decimal.format(billions * 1000) + "M";
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
}
function portrait(leader, eager = false) {
  return `<img class="portrait" src="${leader.image}" alt="" width="160" height="160" loading="${eager ? "eager" : "lazy"}" decoding="async">`;
}
function externalLink(url, label) {
  if (!url?.startsWith("https://")) return escapeHtml(label);
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}
const metrics = {cap:"Value created",jobs:"People employed",payroll:"Estimated annual pay to workers"};
const sortedByCap = [...leaders].sort((a,b) => b.cap - a.cap);
byId("cover").innerHTML = sortedByCap.slice(0,3).map((leader,index) => `
  <a href="#leader/${leader.id}" class="cover-card">
    ${portrait(leader,true)}
    <span class="cover-rank">${index + 1}</span>
    <span class="cover-caption"><strong>${escapeHtml(leader.name)}</strong><small>${escapeHtml(leader.company)}</small></span>
  </a>`).join("");
const stats = [
  [leaders.length,"Leaders profiled"],
  [compactMoney(leaders.reduce((total,leader) => total + leader.cap,0)),"Combined value created"],
  [decimal.format(leaders.reduce((total,leader) => total + leader.jobs,0) / 1e6) + "M",metrics.jobs],
  [compactMoney(leaders.reduce((total,leader) => total + leader.payroll,0)),metrics.payroll]
];
byId("stats").innerHTML = stats.map(([value,label]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");

const rows = byId("rows"), query = byId("query"), sort = byId("sort"), sector = byId("sector");
for (const industry of [...new Set(leaders.map(leader => leader.sector))].sort()) {
  sector.add(new Option(industry,industry));
}
function searchable(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase();
}
const metricFormat = {cap:compactMoney,jobs:value => integer.format(value),payroll:compactMoney};
const searchIndex = new Map(leaders.map(leader => [leader,searchable([leader.name,leader.company,leader.ticker,leader.sector].join(" "))]));
// Each ranking is computed once from data.js; ties fall back to value created.
const rankings = Object.fromEntries(Object.keys(metrics).map(metric => {
  const ranked = [...leaders].sort((a,b) => b[metric] - a[metric] || b.cap - a.cap);
  return [metric,{ranked,top:ranked[0][metric]}];
}));
function activeMetric() {
  return sort.querySelector("input:checked").value;
}
function render() {
  const search = searchable(query.value.trim());
  const metric = activeMetric();
  const {ranked,top} = rankings[metric];
  document.querySelectorAll("th[data-col]").forEach(header => {
    const active = header.dataset.col === metric;
    header.classList.toggle("active-col",active);
    if (active) header.setAttribute("aria-sort","descending");
    else header.removeAttribute("aria-sort");
  });
  let html = "", total = 0;
  ranked.forEach((leader,index) => {
    if (sector.value && leader.sector !== sector.value) return;
    if (search && !searchIndex.get(leader).includes(search)) return;
    total++;
    const rank = index + 1;
    const cells = Object.keys(metrics).map(key => {
      if (key !== metric) return `<td class="number" data-label="${metrics[key]}"><span class="figure">${metricFormat[key](leader[key])}</span></td>`;
      const share = Math.max(leader[key] / top * 100,.6).toFixed(1);
      return `<td class="number active-col" data-label="${metrics[key]}"><span class="figure">${metricFormat[key](leader[key])}</span><span class="bar" aria-hidden="true"><i style="width:${share}%"></i></span></td>`;
    }).join("");
    html += `<tr data-id="${leader.id}"${rank <= 3 ? ' class="podium"' : ""}>
      <td class="rank">${rank}</td>
      <td class="leader-cell"><a class="leader" href="#leader/${leader.id}">${portrait(leader)}<span class="leader-text"><strong>${escapeHtml(leader.name)}</strong><small><span class="company">${escapeHtml(leader.company)}</span><span class="ticker">${escapeHtml(leader.ticker)}</span><span class="sector">${escapeHtml(leader.sector)}</span></small></span></a></td>
      ${cells}
    </tr>`;
  });
  rows.innerHTML = html;
  rows.dataset.metric = metric;
  const filtered = total !== leaders.length;
  const scope = sector.value ? " in " + sector.value : "";
  byId("result-count").innerHTML = (filtered ? `<strong>${total}</strong> of ${leaders.length} leaders${escapeHtml(scope)}` : `All <strong>${total}</strong> leaders`) + `, ranked by ${metrics[metric].toLowerCase()}`;
  byId("empty").hidden = total > 0;
  if (!total) byId("empty-detail").textContent = query.value.trim()
    ? `Nothing on the list matches “${query.value.trim()}”${scope}. Try another name, company or ticker.`
    : "Try another name, company or industry.";
}
function setSort(metric) {
  const input = sort.querySelector(`input[value="${metric}"]`);
  if (!input || input.checked) return;
  input.checked = true;
  render();
}
query.addEventListener("input",render);
sort.addEventListener("change",render);
sector.addEventListener("change",render);
document.querySelector(".ranking thead").addEventListener("click",event => {
  const button = event.target.closest("button[data-sort]");
  if (button) setSort(button.dataset.sort);
});
byId("clear-filters").addEventListener("click",() => {
  query.value = "";
  sector.value = "";
  render();
  query.focus();
});
rows.addEventListener("click",event => {
  const row = event.target.closest("tr[data-id]");
  if (!row || event.target.closest("a") || window.getSelection()?.toString()) return;
  const link = row.querySelector("a.leader");
  if (event.metaKey || event.ctrlKey) window.open(link.href,"_blank","noopener");
  else link.click();
});
render();

const dialog = byId("profile");
let profileGlobe, previousHash = "#ranking";
function openProfile(leader, section) {
  profileGlobe?.destroy();
  const isAmazon = leader.id === "jeff-bezos";
  const figures = [
    [compactMoney(leader.cap),metrics.cap],[integer.format(leader.jobs),metrics.jobs],
    [compactMoney(leader.payroll),metrics.payroll]
  ];
  byId("profile-body").innerHTML = `
    <div class="profile-title">${portrait(leader,true)}<div><p class="eyebrow">NO. ${sortedByCap.indexOf(leader)+1} BY VALUE CREATED</p><h2 id="profile-title">${escapeHtml(leader.name)}</h2><p>${escapeHtml(leader.role)} · ${escapeHtml(leader.company)}</p></div></div>
    <div class="profile-stats">${figures.map(([value,label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("")}</div>
    ${isAmazon ? '<p class="amazon-profile-links"><button type="button" id="show-amazon-map">Explore where Amazon creates value</button></p>' : ""}
    ${isAmazon ? amazonDistribution(leader) : ""}
    ${isAmazon ? amazonFootprint() : `<section class="footprint" aria-labelledby="footprint-title">
      <div class="map-pane">
        <div class="map-heading"><h3 id="footprint-title">Operating footprint</h3><p>Drag to rotate · Select a location</p></div>
        <canvas id="profile-globe" tabindex="0" aria-label="${escapeHtml(leader.company)} globe. Use arrow keys to rotate and plus or minus to zoom. Location buttons are also available."></canvas>
        <div class="zoom" aria-label="Globe zoom"><button id="zoom-out" type="button" aria-label="Zoom out">−</button><button id="zoom-in" type="button" aria-label="Zoom in">+</button></div>
      </div>
      <div class="places">
        <h3>${leader.sites.length === 1 ? "Principal location" : "Selected locations"}</h3>
        <div id="place-list">${leader.sites.map(([city,,,description],index) => `<button type="button" data-place="${index}" aria-pressed="${index === 0}"><i></i><span><strong>${escapeHtml(city)}</strong><small>${escapeHtml(description)}</small></span></button>`).join("")}</div>
        <p>Employment and estimated pay figures cover people worldwide.</p>
      </div>
    </section>`}
    <div class="profile-bottom">
      <section><h3>What workers could earn together</h3><p>Adjust the assumed yearly pay per person to see how the total changes.</p>
        <label for="wage">Assumed yearly pay per person <output id="wage-label" for="wage">${dollars.format(leader.wage)}</output></label>
        <input id="wage" type="range" min="75" max="125" step="1" value="100" aria-valuetext="${dollars.format(leader.wage)}">
        <div class="scenario"><span>${metrics.payroll}</span><strong id="scenario-total" aria-live="polite">${compactMoney(leader.payroll)}</strong></div>
      </section>
      <section><h3>Sources</h3><p>Employment figures are from ${escapeHtml(leader.fy)}. Value created uses the company’s market capitalization at year-end 2024.</p>
        <div class="sources">${externalLink(leader.jobsUrl,"Employment source")}${externalLink(leader.capUrl,"Company value source")}${externalLink(leader.bio,"Biography")}</div>
        <p class="photo-credit">Portrait cropped for display. ${externalLink(leader.photo,leader.artist)} · ${externalLink(leader.licenseUrl,leader.license)}</p>
      </section>
    </div>`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  const distribution = byId("amazon-distribution");
  if (distribution) bindAmazonDistribution(distribution);
  if (section === "distribution" && distribution) {
    distribution.scrollIntoView({block:"start"});
    byId("distribution-tab-ownership").focus({preventScroll:true});
  }
  if (isAmazon) {
    const footprint = byId("amazon-footprint");
    profileGlobe = bindAmazonFootprint(footprint,section === "states" ? "states" : "markets");
    const showMap = () => {
      footprint.scrollIntoView({block:"start"});
      footprint.querySelector("[data-layer][aria-pressed='true']").focus({preventScroll:true});
    };
    byId("show-amazon-map").addEventListener("click",showMap);
    if (section === "footprint" || section === "states") showMap();
  } else {
    function select(index) {
      byId("place-list").querySelectorAll("button").forEach((button,i) => button.setAttribute("aria-pressed",String(i === index)));
      profileGlobe.select(index);
    }
    profileGlobe = createGlobe(byId("profile-globe"),leader.sites,select);
    byId("place-list").addEventListener("click",event => {
      const button = event.target.closest("button[data-place]");
      if (button) select(Number(button.dataset.place));
    });
    byId("zoom-in").addEventListener("click",() => profileGlobe.magnify(.12));
    byId("zoom-out").addEventListener("click",() => profileGlobe.magnify(-.12));
  }
  byId("wage").addEventListener("input",event => {
    const wage = leader.wage * Number(event.target.value) / 100;
    const wageText = dollars.format(wage);
    byId("wage-label").textContent = wageText;
    event.target.setAttribute("aria-valuetext",wageText);
    byId("scenario-total").textContent = compactMoney(leader.jobs * wage / 1e9);
  });
}
let lastHash = location.hash;
function route() {
  const [,id,section] = location.hash.match(/^#leader\/([^/]+)(?:\/(distribution|footprint|states))?$/) || [];
  const leader = leaders.find(item => item.id === id);
  if (leader) {
    if (lastHash && !lastHash.startsWith("#leader/")) previousHash = lastHash;
    openProfile(leader,section);
  } else if (dialog.open) dialog.close();
  lastHash = location.hash;
}
byId("close").addEventListener("click",() => dialog.close());
dialog.addEventListener("click",event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
});
dialog.addEventListener("close",() => {
  profileGlobe?.destroy();
  profileGlobe = null;
  if (location.hash.startsWith("#leader/")) {
    history.replaceState(null,"",previousHash);
    lastHash = location.hash;
  }
});
window.addEventListener("hashchange",route);
route();

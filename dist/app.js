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
// List-wide headline figures ("$35.5 trillion", "15 million", "$985 billion"). The key line under the
// title, the "How value spreads" story and the <head> meta copy all use this one rounding, so they always match.
function headlineFigure(value, prefix = "") {
  const oneDecimal = number => number.toFixed(1).replace(/\.0$/,"");
  return value >= 1e12 ? [prefix + oneDecimal(value / 1e12),"trillion"]
    : value >= 1e9 ? [prefix + Math.round(value / 1e9),"billion"]
    : [prefix + oneDecimal(value / 1e6),"million"];
}
const headlineShort = ([number,unit]) => number + {trillion:"T",billion:"B",million:"M"}[unit];
{
  // The key line under the title, computed from data.js: "100 builders · $35.5T value created · …".
  const keyLine = byId("key-line");
  if (keyLine) {
    const sum = key => leaders.reduce((total,leader) => total + leader[key],0);
    keyLine.innerHTML = [
      `${leaders.length} builders`,
      `${headlineShort(headlineFigure(sum("cap") * 1e9,"$"))} value created`,
      `${headlineShort(headlineFigure(sum("jobs")))} people employed`,
      `${headlineShort(headlineFigure(sum("payroll") * 1e9,"$"))} estimated annual pay`
    ].map(item => `<li>${item}</li>`).join("");
  }
}

const rows = byId("rows"), query = byId("query"), sort = byId("sort"), sector = byId("sector");
for (const industry of [...new Set(leaders.map(leader => leader.sector))].sort()) {
  sector.add(new Option(industry,industry));
}
function searchable(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase();
}
const metricFormat = {cap:compactMoney,jobs:value => integer.format(value),payroll:compactMoney};
const searchIndex = new Map(leaders.map(leader => [leader,searchable([leader.name,leader.company,leader.ticker,leader.sector].join(" "))]));
// Each ranking is computed once from data.js; ties fall back to market value.
const rankings = Object.fromEntries(Object.keys(metrics).map(metric => [metric,[...leaders].sort((a,b) => b[metric] - a[metric] || b.cap - a.cap)]));
// One expanded row at a time, like the Forbes list. It stays open across re-renders while it is still shown.
let openId = null;
function rankingRow(leader,rank,metric) {
  const open = leader.id === openId;
  const figures = Object.keys(metrics).map(key => `<td class="number${key === metric ? " active-col" : ""}">${metricFormat[key](leader[key])}</td>`).join("");
  return `<tr class="entry${open ? " is-open" : ""}" data-id="${leader.id}">
      <td class="rank">${rank}</td>
      <td class="name"><button type="button" class="row-toggle" aria-expanded="${open}" aria-controls="detail-${leader.id}"><span class="name-text">${escapeHtml(leader.name)}</span><span class="name-company">${escapeHtml(leader.company)}</span></button></td>
      ${figures}
      <td class="company">${escapeHtml(leader.company)}</td>
      <td class="industry">${escapeHtml(leader.sector)}</td>
    </tr>
    <tr class="detail" id="detail-${leader.id}"${open ? "" : " hidden"}><td colspan="7"><div class="detail-panel">
      <img class="portrait" src="${leader.image}" alt="" width="96" height="96" loading="lazy" decoding="async">
      <div class="detail-text"><p class="detail-name">${escapeHtml(leader.name)}</p><p class="detail-role">${escapeHtml(leader.role)} · ${escapeHtml(leader.company)}</p><p class="detail-line">Employs ${integer.format(leader.jobs)} people who earn an estimated ${compactMoney(leader.payroll)} a year.</p></div>
      <a class="detail-profile" href="#leader/${leader.id}">View profile</a>
    </div></td></tr>`;
}
function render() {
  const search = searchable(query.value.trim());
  const metric = sort.value;
  document.querySelectorAll(".ranking th[data-col]").forEach(header => {
    const active = header.dataset.col === metric;
    header.classList.toggle("active-col",active);
    if (active) header.setAttribute("aria-sort","descending");
    else header.removeAttribute("aria-sort");
  });
  let html = "", total = 0, openShown = false;
  rankings[metric].forEach((leader,index) => {
    if (sector.value && leader.sector !== sector.value) return;
    if (search && !searchIndex.get(leader).includes(search)) return;
    total++;
    if (leader.id === openId) openShown = true;
    html += rankingRow(leader,index + 1,metric);
  });
  if (!openShown) openId = null;
  rows.innerHTML = html;
  fitPanel();
  const scope = sector.value ? " in " + sector.value : "";
  byId("result-count").textContent = (total !== leaders.length ? `${total} of ${leaders.length} leaders${scope}` : `${total} leaders`) + ` · Ranked by ${sort.selectedOptions[0].text.toLowerCase()} · Figures in USD`;
  byId("empty").hidden = total > 0;
  if (!total) byId("empty-detail").textContent = query.value.trim()
    ? `Nothing on the list matches “${query.value.trim()}”${scope}. Try another name, company or ticker.`
    : "Try another name, company or industry.";
}
function setSort(metric) {
  if (sort.value === metric) return;
  sort.value = metric;
  render();
}
// Narrow screens hide columns, and a colspan wider than the visible columns adds phantom ones,
// so the open panel spans exactly the columns on screen.
const headers = [...document.querySelectorAll(".ranking thead th")];
function fitPanel() {
  const cell = rows.querySelector("tr.detail:not([hidden]) > td");
  if (cell) cell.colSpan = headers.filter(header => header.offsetWidth).length || headers.length;
}
function setOpen(row,open) {
  row.classList.toggle("is-open",open);
  row.querySelector(".row-toggle").setAttribute("aria-expanded",String(open));
  row.nextElementSibling.hidden = !open;
  if (open) fitPanel();
}
function toggleRow(row) {
  const current = openId && rows.querySelector(`tr.entry[data-id="${openId}"]`);
  if (current) setOpen(current,false);
  openId = current === row ? null : row.dataset.id;
  if (openId) setOpen(row,true);
}
query.addEventListener("input",render);
window.addEventListener("resize",fitPanel);
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
// A click anywhere on a row toggles its panel. The toggle button in the Name cell gives Enter and Space for free.
rows.addEventListener("click",event => {
  const row = event.target.closest("tr.entry");
  if (!row || (!event.target.closest(".row-toggle") && window.getSelection()?.toString())) return;
  toggleRow(row);
  const toggle = row.querySelector(".row-toggle");
  if (!toggle.contains(event.target)) toggle.focus({preventScroll:true,focusVisible:false});
});
// Escape closes the open panel and returns focus to its row.
rows.addEventListener("keydown",event => {
  if (event.key !== "Escape" || !openId) return;
  const row = rows.querySelector(`tr.entry[data-id="${openId}"]`);
  if (!row) return;
  toggleRow(row);
  row.querySelector(".row-toggle").focus();
});
render();

const dialog = byId("profile");
let profileGlobe, previousHash = "#ranking";
// Previous/next leader links live in the sticky bar. They are created once and updated in place,
// so keyboard focus survives paging. Paging replaces the hash so Back and Close still leave the profile.
const profileNav = document.createElement("nav");
profileNav.className = "profile-nav";
profileNav.setAttribute("aria-label","Browse the ranking");
profileNav.innerHTML = ["prev","next"].map(step => `<a class="profile-step" data-step="${step}" href="#ranking">${step === "prev" ? '<span class="step-arrow" aria-hidden="true">←</span>' : ""}<span class="step-text"><small></small><span class="step-name"></span></span>${step === "next" ? '<span class="step-arrow" aria-hidden="true">→</span>' : ""}</a>`).join("");
dialog.querySelector(".profile-top").insertBefore(profileNav,byId("close"));
byId("close").autofocus = true;
profileNav.addEventListener("click",event => {
  const link = event.target.closest("a.profile-step");
  if (!link || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  location.replace(link.getAttribute("href"));
});
function updateProfileNav(leader) {
  const rank = sortedByCap.indexOf(leader);
  const focused = profileNav.contains(document.activeElement) ? document.activeElement : null;
  for (const link of profileNav.querySelectorAll(".profile-step")) {
    const isPrev = link.dataset.step === "prev";
    const target = sortedByCap[rank + (isPrev ? -1 : 1)];
    link.hidden = !target;
    if (!target) continue;
    link.href = "#leader/" + target.id;
    link.querySelector("small").textContent = "No. " + (sortedByCap.indexOf(target) + 1);
    link.querySelector(".step-name").textContent = target.name;
    link.setAttribute("aria-label",(isPrev ? "Previous leader: " : "Next leader: ") + "No. " + (sortedByCap.indexOf(target) + 1) + ", " + target.name);
  }
  if (focused?.hidden) (profileNav.querySelector(".profile-step:not([hidden])") || byId("close")).focus();
}
function openProfile(leader, section) {
  profileGlobe?.destroy();
  const isAmazon = leader.id === "jeff-bezos";
  const rank = sortedByCap.indexOf(leader) + 1;
  const figures = [
    ["cap",metrics.cap,compactMoney(leader.cap),"Market capitalization, year-end 2024"],
    ["jobs",metrics.jobs,integer.format(leader.jobs),"Directly, worldwide · " + escapeHtml(leader.fy)],
    ["payroll",metrics.payroll,compactMoney(leader.payroll),"At " + dollars.format(leader.wage) + " per person"]
  ];
  updateProfileNav(leader);
  byId("profile-body").innerHTML = `
    <header class="profile-title">${portrait(leader,true)}<div class="profile-heading"><p class="eyebrow">NO. ${rank} BY VALUE CREATED <span aria-hidden="true">·</span> ${escapeHtml(leader.sector.toUpperCase())}</p><h2 id="profile-title">${escapeHtml(leader.name)}</h2><p class="profile-role">${escapeHtml(leader.role)} · <strong>${escapeHtml(leader.company)}</strong> <span class="profile-ticker">${escapeHtml(leader.ticker)}</span></p></div></header>
    <dl class="profile-stats">${figures.map(([key,label,value,note]) => `<div class="stat-${key}"><dt>${label}</dt><dd><strong>${value}</strong><span>${note}</span></dd></div>`).join("")}</dl>
    <p class="profile-lenses">Value created is measured here as market value, which counts only what owners keep. The sections below show more of the value ${escapeHtml(leader.company)} created; each stands on its own and they are never added together. <a href="/methodology">Methodology</a></p>
    ${!isAmazon && typeof companyValueSlot === "function" ? companyValueSlot(leader) : ""}
    ${isAmazon ? '<p class="amazon-profile-links"><button type="button" id="show-amazon-map">Explore where Amazon creates value</button></p>' : ""}
    ${isAmazon ? amazonDistribution(leader) : ""}
    ${isAmazon && typeof companyValueSlot === "function" ? companyValueSlot(leader) : ""}
    ${isAmazon ? amazonFootprint() : `<section class="footprint" aria-labelledby="footprint-title">
      <div class="map-pane">
        <div class="map-heading"><p class="map-kicker">${escapeHtml(leader.company.toUpperCase())}</p><h3 id="footprint-title">Operating footprint</h3></div>
        <canvas id="profile-globe" tabindex="0" aria-label="${escapeHtml(leader.company)} globe. Use arrow keys to rotate and plus or minus to zoom. Location buttons are also available."></canvas>
        <div class="zoom" aria-label="Globe zoom"><button id="zoom-out" type="button" aria-label="Zoom out">−</button><button id="zoom-in" type="button" aria-label="Zoom in">+</button></div>
      </div>
      <div class="places">
        <h3>${leader.sites.length === 1 ? "Principal location" : "Selected locations"}</h3>
        <div id="place-list">${leader.sites.map(([city,,,description],index) => `<button type="button" data-place="${index}" aria-pressed="${index === 0}"><i></i><span><strong>${escapeHtml(city)}</strong><small>${escapeHtml(description)}</small></span></button>`).join("")}</div>
      </div>
    </section>`}
    <div class="profile-bottom">
      <section class="profile-scenario" aria-labelledby="scenario-title"><h3 id="scenario-title">What workers could earn together</h3>
        <div class="scenario"><span>${metrics.payroll}</span><strong id="scenario-total" aria-live="polite">${compactMoney(leader.payroll)}</strong></div>
        <label for="wage">Assumed yearly pay per person <output id="wage-label" for="wage">${dollars.format(leader.wage)}</output></label>
        <input id="wage" type="range" min="75" max="125" step="1" value="100" style="--fill:50%" aria-valuetext="${dollars.format(leader.wage)}">
        <div class="range-scale" aria-hidden="true"><span>−25%</span><span>Our estimate</span><span>+25%</span></div>
        <button class="scenario-reset" id="wage-reset" type="button" hidden>Reset to our estimate</button>
      </section>
      <section class="profile-sources" aria-labelledby="sources-title"><h3 id="sources-title">Sources</h3>
        <div class="sources">${externalLink(leader.jobsUrl,"Employment source")}${externalLink(leader.capUrl,"Value created source")}${externalLink(leader.bio,"Biography")}</div>
        <p class="photo-credit">Photo (cropped): ${externalLink(leader.photo,leader.artist)} · ${externalLink(leader.licenseUrl,leader.license)}</p>
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
  const valueSlot = byId("company-value");
  if (valueSlot) bindCompanyValue(valueSlot,leader).then(shown => {
    if (!shown || section !== "value") return;
    valueSlot.scrollIntoView({block:"start"});
    valueSlot.querySelector('[role="tab"][aria-selected="true"], .cv-provenance > summary')?.focus({preventScroll:true});
  });
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
  const wageInput = byId("wage"), wageReset = byId("wage-reset");
  function updateWage() {
    const percent = Number(wageInput.value);
    const wage = leader.wage * percent / 100;
    const wageText = dollars.format(wage);
    byId("wage-label").textContent = wageText;
    wageInput.setAttribute("aria-valuetext",wageText);
    wageInput.style.setProperty("--fill",(percent - 75) * 2 + "%");
    byId("scenario-total").textContent = compactMoney(leader.jobs * wage / 1e9);
    wageReset.hidden = percent === 100;
  }
  wageInput.addEventListener("input",updateWage);
  wageReset.addEventListener("click",() => {
    wageInput.value = 100;
    updateWage();
    wageInput.focus();
  });
}
let lastHash = location.hash;
function route() {
  const [,id,section] = location.hash.match(/^#leader\/([^/]+)(?:\/(distribution|footprint|states|value))?$/) || [];
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
// The first route runs once every deferred script has run, including company-value.js (loaded after this file).
document.addEventListener("DOMContentLoaded",route);

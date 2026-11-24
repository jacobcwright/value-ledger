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
const metrics = {cap:"Value created",jobs:"People employed",paidout:"Paid out & sales enabled",multiple:"Value multiple",payroll:"Annual pay to workers"};
// The ranking's columns, in table order. Estimated pay is no longer a column: it sits inside paid out,
// so it is shown on its own in each profile and never added to it.
const columns = ["cap","multiple","jobs","paidout"];
// How the pay figure was measured: reported staff costs, or the proxy's median pay × people employed.
function payNote(leader, insidePaidOut) {
  if (!finiteNumber(leader.payroll)) return "The company reports no staff-cost total or median pay";
  const basis = leader.payBasis === "median-pay" ? "Median pay " + dollars.format(leader.wage) + " × people employed" : "Reported staff costs · " + dollars.format(leader.wage) + " per person";
  return basis + (insidePaidOut ? " · part of paid out, never added to it" : "");
}
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
    const sum = key => leaders.reduce((total,leader) => total + (leader[key] || 0),0);
    keyLine.innerHTML = [
      `${leaders.length} builders`,
      `${headlineShort(headlineFigure(sum("cap") * 1e9,"$"))} value created`,
      `${headlineShort(headlineFigure(sum("jobs")))} people employed`,
      `${headlineShort(headlineFigure(sum("payroll") * 1e9,"$"))} pay to workers`
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
// "Paid out & sales enabled" comes from dist/paidout.json (written by scripts/build-companies.mjs), in USD:
// paid out, adjusted for customer lending where the company discloses it, plus sales enabled for marketplaces.
// Banks and brokers are not comparable. The column is never summed across the 100: one company's payment is
// another's revenue.
let paidOut = null;
const paidOutReady = fetch("paidout.json")
  .then(response => response.ok ? response.json() : null)
  .catch(() => null)
  .then(list => { paidOut = list && typeof list === "object" ? list : {}; return paidOut; });
const finiteNumber = value => typeof value === "number" && Number.isFinite(value);
// {comparable, total, base, sales, adjusted, fiscalYear} for a leader, or null while loading or when there is no figure.
function paidOutFor(leader) {
  const entry = paidOut && paidOut[leader.id];
  if (!entry) return null;
  if (entry.comparable === false) return {comparable:false,total:null,fiscalYear:entry.fiscalYear || ""};
  const adjusted = finiteNumber(entry.adjustedUsd);
  const base = adjusted ? entry.adjustedUsd : entry.usd;
  if (!finiteNumber(base)) return null;
  const sales = finiteNumber(entry.salesEnabledUsd) ? entry.salesEnabledUsd : 0;
  return {comparable:true,total:base + sales,base,sales,adjusted,fiscalYear:entry.fiscalYear || ""};
}
// The profile headline (dist/headline.json, written by scripts/build-companies.mjs): value created, held by
// others, paid out & sales enabled and their stake, per leader, in billions of USD. The ownership figures use
// the same function as the profile's ownership section (ownership-headline.js), run by the build.
let headline = null;
const headlineReady = fetch("headline.json")
  .then(response => response.ok ? response.json() : null)
  .catch(() => null)
  .then(list => { headline = list && typeof list === "object" ? list : {}; return headline; });
const headlinePercent = value => value.toFixed(1) + "%";
const cvPossessiveName = name => escapeHtml(/s$/i.test(name) ? name + "’" : name + "’s");
// "Held by others" for the home row: exact, or a bound that says so ("more than", "at least").
function heldByOthersPhrase(entry) {
  if (!finiteNumber(entry.heldByOthersUsd)) return "";
  const prefix = entry.heldByOthersBound === "gt99" ? "more than " : entry.heldByOthersBound === "gte95" ? "at least " : "";
  return `Held by others ${prefix}${compactMoney(entry.heldByOthersUsd)}`;
}
// "2025-03-07" → "March 2025".
function monthYear(value) {
  const match = /^(\d{4})-(\d{2})/.exec(value || "");
  return match ? new Date(Date.UTC(+match[1],+match[2] - 1,1)).toLocaleDateString("en-US",{timeZone:"UTC",month:"long",year:"numeric"}) : "";
}
// The stake in one phrase, for the home row: "Their stake $202B", "Walton family stake $330B", "Their stake under $532.7M".
function stakePhrase(entry) {
  if (["own","derived","family"].includes(entry.stakeBasis) && finiteNumber(entry.stakeUsd)) return `${escapeHtml(entry.stakeLabel)} ${compactMoney(entry.stakeUsd)}`;
  if (entry.stakeBasis === "under1" && finiteNumber(entry.stakeBelowUsd)) return `Their stake under ${compactMoney(entry.stakeBelowUsd)}`;
  return "";
}
// Value multiple (headline.json): value created ÷ what the leader kept of it. Bounds ("at least") sort by their bound.
const multipleFor = leader => headline?.[leader.id]?.valueMultiple || null;
const multipleText = m => m.atLeast ? integer.format(m.value) + "×+" : (m.value >= 100 ? integer.format(Math.round(m.value)) : decimal.format(m.value)) + "×";
const MULTIPLE_BASIS = {stake:"Value created ÷ their stake in the company",family:"Value created ÷ the family’s stake in the company",networth:"Value created ÷ their net worth (no stake disclosed; net worth also includes wealth from elsewhere)",bound:"A floor from the ownership disclosure"};
function multipleCell(leader) {
  if (!headline) return '<span class="po-pending" aria-label="Loading">…</span>';
  const m = multipleFor(leader);
  if (!m) return headline?.[leader.id]?.founder === false ? '<span class="po-none" title="Founders only" aria-label="Founders only">—</span>' : '<span class="po-none" aria-label="Not available">—</span>';
  return `<span title="${escapeHtml(MULTIPLE_BASIS[m.basis] || "")}">${multipleText(m)}</span>` + (m.basis === "networth" ? '<sup class="po-mark" title="Based on net worth">‡</sup><span class="visually-hidden"> (based on net worth)</span>' : "");
}
const metricValue = (leader,metric) => metric === "paidout" ? paidOutFor(leader)?.total ?? null : metric === "multiple" ? multipleFor(leader)?.value ?? null : leader[metric];
function paidOutCell(leader) {
  const figure = paidOutFor(leader);
  if (!paidOut) return '<span class="po-pending" aria-label="Loading">…</span>';
  if (figure && !figure.comparable) return '<span class="po-nc">Not comparable</span>';
  if (!figure) return '<span class="po-none" aria-label="Not available">—</span>';
  return compactMoney(figure.total) + (figure.sales ? '<sup class="po-mark" title="Includes sales enabled on its platform">†</sup><span class="visually-hidden"> (includes sales enabled)</span>' : "");
}
const metricFormat = {cap:leader => compactMoney(leader.cap),multiple:multipleCell,jobs:leader => integer.format(leader.jobs),paidout:paidOutCell};
const searchIndex = new Map(leaders.map(leader => [leader,searchable([leader.name,leader.company,leader.ticker,leader.sector].join(" "))]));
// Each ranking is computed from data.js (and paidout.json, once it arrives); ties fall back to market value.
// Leaders without a figure (not comparable, or not available) sort last.
const rankBy = metric => [...leaders].sort((a,b) => {
  const x = metricValue(a,metric), y = metricValue(b,metric);
  if (x == null || y == null) return (x == null) - (y == null) || b.cap - a.cap;
  return y - x || b.cap - a.cap;
});
// Value multiple ranks founders only (the same rule the build uses: "founder" in the role, current or not);
// every other ranking is the full list of 100.
const isFounder = leader => /founder/i.test(leader.role || "");
const founders = leaders.filter(isFounder);
const rankings = Object.fromEntries(columns.map(metric => [metric,rankBy(metric)]));
rankings.multiple = rankings.multiple.filter(isFounder);
// One expanded row at a time, like the Forbes list. It stays open across re-renders while it is still shown.
let openId = null;
function rankingRow(leader,rank,metric) {
  const open = leader.id === openId;
  const figures = columns.map(key => `<td class="number${key === metric ? " active-col" : ""}">${metricFormat[key](leader)}</td>`).join("");
  return `<tr class="entry${open ? " is-open" : ""}" data-id="${leader.id}">
      <td class="rank">${rank}</td>
      <td class="name"><button type="button" class="row-toggle" aria-expanded="${open}" aria-controls="detail-${leader.id}"><span class="name-text">${escapeHtml(leader.name)}</span><span class="name-company">${escapeHtml(leader.company)}</span></button></td>
      ${figures}
      <td class="company">${escapeHtml(leader.company)}</td>
      <td class="industry">${escapeHtml(leader.sector)}</td>
    </tr>
    <tr class="detail" id="detail-${leader.id}"${open ? "" : " hidden"}><td colspan="7"><div class="detail-panel">
      <img class="portrait" src="${leader.image}" alt="" width="96" height="96" loading="lazy" decoding="async">
      <div class="detail-text"><p class="detail-name">${escapeHtml(leader.name)}</p><p class="detail-role">${escapeHtml(leader.role)} · ${escapeHtml(leader.company)}</p>${detailHeadline(leader)}<p class="detail-line">${detailLine(leader)}</p></div>
      <a class="detail-profile" href="#leader/${leader.id}">View profile</a>
    </div></td></tr>`;
}
// The open row's headline: "Value created $2.35T · Held by others $2.15T · Their stake $202B", from headline.json.
function detailHeadline(leader) {
  const entry = headline && headline[leader.id];
  if (!entry) return "";
  const items = [`Value created ${compactMoney(leader.cap)}`,
    heldByOthersPhrase(entry),
    stakePhrase(entry)].filter(Boolean);
  return `<p class="detail-headline">${items.join(' <span aria-hidden="true">·</span> ')}</p>`;
}
// The open row's one line: what the company paid out, in USD, in its own fiscal year.
function detailLine(leader) {
  const figure = paidOutFor(leader);
  if (figure?.comparable) {
    const year = figure.fiscalYear ? ` in ${escapeHtml(figure.fiscalYear)}` : "";
    return `Paid ${compactMoney(figure.base)} to employees, suppliers, partners, lenders and governments${year}${figure.adjusted ? ", adjusted for customer lending" : ""}.`
      + (figure.sales ? ` Its platform enabled ${compactMoney(figure.sales)} in sales for others.` : "");
  }
  return `Employs ${integer.format(leader.jobs)} people` + (finiteNumber(leader.payroll) ? ` who earn ${compactMoney(leader.payroll)} a year${leader.payBasis === "median-pay" ? " (median pay × people employed)" : ""}.` : ".");
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
  const pool = metric === "multiple" ? founders.length : leaders.length, noun = metric === "multiple" ? "founders" : "leaders";
  byId("result-count").textContent = (total !== pool ? `${total} of ${pool} ${noun}${scope}` : `${total} ${noun}`) + ` · Ranked by ${sort.selectedOptions[0].text.toLowerCase()}` + (metric === "multiple" ? " (founders only)" : "") + " · Figures in USD";
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
  if (openId) {
    setOpen(row,true);
    // The panel's "View profile" is likely next: fetch the profile-only scripts now.
    loadProfileScripts().catch(() => {});
  }
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
// paidout.json arrives after the first render: rank by it, then redraw the table.
paidOutReady.then(() => {
  rankings.paidout = rankBy("paidout");
  render();
});
// headline.json fills each row panel's headline line and the value multiple column.
headlineReady.then(() => {
  rankings.multiple = rankBy("multiple").filter(isFounder);
  render();
});

const dialog = byId("profile");
let profileGlobe, previousHash = "#ranking", profileToken = 0;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const scrollMode = () => reducedMotion.matches ? "auto" : "smooth";

// Previous/next leader links: one copy in the sticky bar (wide screens) and one at the foot of the profile
// (every width, and the only one on phones). Both are created once and updated in place, so keyboard focus
// survives paging. Paging replaces the hash so Back and Close still leave the profile.
function makeProfileNav(place) {
  const nav = document.createElement("nav");
  nav.className = "profile-nav profile-nav-" + place;
  nav.setAttribute("aria-label",place === "top" ? "Browse the ranking" : "Browse the ranking from the end of this profile");
  nav.innerHTML = ["prev","next"].map(step => `<a class="profile-step" data-step="${step}" href="#ranking">${step === "prev" ? '<span class="step-arrow" aria-hidden="true">←</span>' : ""}<span class="step-text"><small></small><span class="step-name"></span></span>${step === "next" ? '<span class="step-arrow" aria-hidden="true">→</span>' : ""}</a>`).join("");
  nav.addEventListener("click",event => {
    const link = event.target.closest("a.profile-step");
    if (!link || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    location.replace(link.getAttribute("href"));
  });
  return nav;
}
const profileNavs = [makeProfileNav("top"),makeProfileNav("foot")];
dialog.querySelector(".profile-top").insertBefore(profileNavs[0],byId("close"));
byId("profile-foot").append(profileNavs[1]);
byId("close").autofocus = true;
function updateProfileNav(leader) {
  const rank = sortedByCap.indexOf(leader);
  const focused = profileNavs.find(nav => nav.contains(document.activeElement)) ? document.activeElement : null;
  for (const link of dialog.querySelectorAll(".profile-step")) {
    const isPrev = link.dataset.step === "prev";
    const target = sortedByCap[rank + (isPrev ? -1 : 1)];
    link.hidden = !target;
    if (!target) continue;
    link.href = "#leader/" + target.id;
    link.querySelector("small").textContent = "No. " + (sortedByCap.indexOf(target) + 1);
    link.querySelector(".step-name").textContent = target.name;
    link.setAttribute("aria-label",(isPrev ? "Previous leader: " : "Next leader: ") + "No. " + (sortedByCap.indexOf(target) + 1) + ", " + target.name);
  }
  if (focused?.hidden) (focused.closest("nav").querySelector(".profile-step:not([hidden])") || byId("close")).focus();
  // The bar's identity (shown on phones): thumbnail, name and rank.
  const thumb = byId("profile-id-thumb");
  if (thumb.getAttribute("src") !== leader.image) thumb.src = leader.image;
  byId("profile-id-name").textContent = leader.name;
  byId("profile-id-rank").textContent = "No. " + (rank + 1);
}

// Section chips: one sticky, horizontally scrolling row of every section the profile shows, in page order.
// Sections declare themselves with data-chip. The first lens of a group scrolls to the group's heading.
// Chips are buttons, never links: a hash change would re-route the profile.
const chipRow = byId("profile-chips");
let chips = [], chipObserver = null, footObserver = null, chipLock = 0, activeChip = -1;
function chipTarget(section) {
  const group = section.closest(".distribution");
  return group && group.querySelector("[data-chip]") === section ? group : section;
}
function chipLine() {
  return dialog.getBoundingClientRect().top + (parseFloat(getComputedStyle(dialog).scrollPaddingTop) || 0) + 24;
}
function updateActiveChip() {
  if (!chips.length || Date.now() < chipLock) return;
  const line = chipLine();
  let index = 0;
  chips.forEach((chip,i) => { if (chip.target.getBoundingClientRect().top <= line) index = i; });
  if (dialog.scrollTop > 0 && dialog.scrollTop + dialog.clientHeight >= dialog.scrollHeight - 4) index = chips.length - 1;
  setActiveChip(index);
}
function setActiveChip(index) {
  if (index === activeChip) return;
  activeChip = index;
  const buttons = [...chipRow.children];
  buttons.forEach((button,i) => i === index ? button.setAttribute("aria-current","true") : button.removeAttribute("aria-current"));
  const chip = buttons[index];
  // Scroll the chip row only when the active chip is out of view, so leading chips are never half cut off.
  if (chip) {
    const pad = 24, left = chip.offsetLeft, right = left + chip.offsetWidth, viewLeft = chipRow.scrollLeft, viewRight = viewLeft + chipRow.clientWidth;
    const target = left - pad < viewLeft ? Math.max(0, left - pad) : right + pad > viewRight ? right + pad - chipRow.clientWidth : null;
    if (target !== null) chipRow.scrollTo({left:target,behavior:scrollMode()});
  }
}
function observeChips() {
  chipObserver?.disconnect();
  footObserver?.disconnect();
  if (!dialog.open || !chips.length) return;
  // A one-pixel band just under the sticky bar and chips: a callback fires whenever a section edge crosses it.
  const line = Math.round(chipLine() - dialog.getBoundingClientRect().top);
  const below = Math.max(0,dialog.clientHeight - line - 1);
  chipObserver = new IntersectionObserver(updateActiveChip,{root:dialog,rootMargin:`-${line}px 0px -${below}px 0px`});
  chips.forEach(chip => chipObserver.observe(chip.target));
  // A short last section never reaches the band, so reaching the foot selects it.
  footObserver = new IntersectionObserver(updateActiveChip,{root:dialog,threshold:[0,1]});
  footObserver.observe(byId("profile-foot"));
}
// The heading that takes focus when a section is reached from a chip or a deep link.
function sectionHeading(section) {
  const heading = section?.querySelector("h2,h3,h4");
  if (heading && !heading.hasAttribute("tabindex")) heading.tabIndex = -1;
  return heading;
}
function buildChips() {
  const sections = [...byId("profile-body").querySelectorAll("[data-chip]")];
  chips = sections.map(section => ({label:section.dataset.chip,target:chipTarget(section)}));
  chipRow.innerHTML = chips.map((chip,i) => `<button type="button" class="profile-chip" data-chip-index="${i}">${escapeHtml(chip.label)}</button>`).join("");
  activeChip = -1;
  observeChips();
  updateActiveChip();
}
chipRow.addEventListener("click",event => {
  const button = event.target.closest(".profile-chip");
  if (!button) return;
  const index = Number(button.dataset.chipIndex);
  const target = chips[index]?.target;
  if (!target) return;
  setActiveChip(index);
  // Hold the chosen chip while the smooth scroll passes the sections in between.
  chipLock = Date.now() + 1000;
  target.scrollIntoView({block:"start",behavior:scrollMode()});
  if (event.detail === 0) sectionHeading(target)?.focus({preventScroll:true});
});
dialog.addEventListener("scrollend",() => { chipLock = 0; updateActiveChip(); });
window.addEventListener("resize",() => { if (dialog.open) observeChips(); });

// The four headline figures, side by side: value created · held by others · paid out & sales enabled · their
// stake. Before headline.json arrives the last three show a placeholder; a leader missing from it shows "—".
function headlineStats(leader) {
  const loading = !headline;
  const entry = headline ? headline[leader.id] : null;
  const pending = '<span class="stat-pending" aria-label="Loading">…</span>';
  const cell = (key, label, value, notes, text = false) => `<div class="stat-${key}"><dt>${label}</dt><dd><strong${text ? ' class="is-text"' : ""}>${value}</strong>${notes.filter(Boolean).map(note => `<span>${note}</span>`).join("")}</dd></div>`;
  const cells = [cell("cap",metrics.cap,compactMoney(leader.cap),["Market value, " + edition.pricesAsOfLabel])];
  // Held by others: value created × the ownership headline's "Everyone else".
  if (loading) cells.push(cell("others","Held by others",pending,[""]));
  else if (entry && finiteNumber(entry.heldByOthersUsd) && entry.heldByOthersBound) {
    // A bound, never shown as an exact figure: "More than" / "At least" sits inside the figure itself.
    const gt99 = entry.heldByOthersBound === "gt99";
    cells.push(cell("others","Held by others",`<span class="stat-bound">${gt99 ? "More than" : "At least"} </span>${compactMoney(entry.heldByOthersUsd)}`,
      [gt99 ? `More than 99% of shares; ${escapeHtml(leader.name)} holds under 1%` : `No 5% stake by ${escapeHtml(leader.name)} or family is reported in ${cvPossessiveName(leader.company)} proxy`]));
  }
  else if (entry && finiteNumber(entry.heldByOthersUsd)) cells.push(cell("others","Held by others",compactMoney(entry.heldByOthersUsd),[`${headlinePercent(entry.heldByOthersPct)} of shares, owned by index funds, pensions, savers and others`]));
  else cells.push(cell("others","Held by others","—",[escapeHtml(entry?.heldByOthersNote || "No stake disclosed")]));
  // Paid out & sales enabled, per year (the company's fiscal year), in USD.
  let paid, paidNote, paidText = false;
  if (loading) { paid = "…"; paidNote = "To employees, suppliers, partners, lenders and governments"; }
  else if (entry?.comparable === false) { paid = "Not comparable"; paidText = true; paidNote = "A bank’s or broker’s cash flows are mostly customers’ deposits and loans"; }
  else if (!entry || !finiteNumber(entry.paidOutUsd)) { paid = "—"; paidText = true; paidNote = "Not available"; }
  else {
    const sales = finiteNumber(entry.salesEnabledUsd) ? entry.salesEnabledUsd : 0;
    paid = compactMoney(entry.paidOutUsd + sales);
    paidNote = [`Per year${entry.paidOutFy ? ", " + escapeHtml(entry.paidOutFy) : ""}`,entry.paidOutAdjusted ? "adjusted for customer lending" : "",sales ? `incl. ${compactMoney(sales)} sales enabled` : ""].filter(Boolean).join(" · ");
  }
  cells.push(cell("paidout",metrics.paidout,`<span id="stat-paidout">${paid}</span>`,[`<span id="stat-paidout-note">${paidNote}</span>`],paidText));
  // Their stake: own or derived stake × value created; the family's (so labelled) where the headline is family-based.
  const label = escapeHtml(entry?.stakeLabel || "Their stake");
  const netWorth = entry?.netWorth && finiteNumber(entry.netWorth.value) && /^https:\/\//.test(entry.netWorth.sourceUrl || "")
    ? `<span class="stat-networth">${entry.netWorth.withFamily ? "Net worth (with family)" : "Net worth"}: ${compactMoney(entry.netWorth.value)} (${externalLink(entry.netWorth.sourceUrl,(entry.netWorth.sourceLabel || "Third-party") + " estimate")}${monthYear(entry.netWorth.asOf) ? ", " + monthYear(entry.netWorth.asOf) : ""}) <span class="cv-tier">Third-party estimate</span></span>`
    : "";
  if (loading) cells.push(cell("stake",label,pending,[""]));
  else if (["own","derived","family"].includes(entry?.stakeBasis) && finiteNumber(entry.stakeUsd)) {
    const derived = entry.stakeBasis === "derived" ? ` <span class="cv-derived"${entry.stakeMethod ? ` title="${escapeHtml(entry.stakeMethod)}"` : ""}>derived</span>` : "";
    const includes = entry.stakeIncludesLeader ? ` · includes ${escapeHtml(leader.name)}’s own` : "";
    cells.push(cell("stake",label,compactMoney(entry.stakeUsd),[`${headlinePercent(entry.stakePct)} of shares${includes}${derived}`,netWorth]));
  } else if (entry?.stakeBasis === "under1" && finiteNumber(entry.stakeBelowUsd)) {
    cells.push(cell("stake",label,`Under 1% (&lt;&nbsp;${compactMoney(entry.stakeBelowUsd)})`,["Exact stake not disclosed",netWorth],true));
  } else cells.push(cell("stake",label,"—",[escapeHtml(entry?.stakeNote || "No stake disclosed"),netWorth]));
  // Value multiple: value created ÷ what the leader kept of it (their stake; or net worth where no stake is disclosed).
  const m = entry?.valueMultiple;
  if (loading) cells.push(cell("multiple",metrics.multiple,pending,[""]));
  else if (m) {
    const kept = m.basis === "stake" ? "their stake" : m.basis === "family" ? "the family’s stake" : m.basis === "networth" ? "their net worth" : "";
    const note = m.basis === "bound" ? (m.value >= 100 ? `${escapeHtml(leader.name)} holds under 1%, so value created is more than 100× their stake` : `${escapeHtml(leader.name)} holds under 5%, so value created is at least 20× their stake`)
      : `Value created for every $1 of ${kept}` + (m.basis === "networth" ? " (no stake disclosed; net worth includes wealth from elsewhere)" : "");
    const extra = m.basis !== "networth" && finiteNumber(entry.netWorthMultiple) && entry.netWorthMultiple >= 1 ? `${multipleText({value:entry.netWorthMultiple})} their net worth` : "";
    cells.push(cell("multiple",metrics.multiple,multipleText(m),[note,extra]));
  } else if (entry?.founder === false) cells.push(cell("multiple",metrics.multiple,"—",[`Founders only. ${escapeHtml(leader.name)} didn’t found ${escapeHtml(leader.company)}, so owning little of it says nothing about what they kept`]));
  else cells.push(cell("multiple",metrics.multiple,"—",[entry?.netWorthMultiple != null && entry.netWorthMultiple < 1 ? "Their net worth is larger than this company’s value, so most of it comes from elsewhere" : "No stake or net worth to compare"]));
  return cells.join("");
}

function openProfile(leader, section) {
  profileGlobe?.destroy();
  const token = ++profileToken;
  const isAmazon = leader.id === "jeff-bezos";
  const rank = sortedByCap.indexOf(leader) + 1;
  // Workers, under the headline: people employed and pay as reported (inside paid out, never added to it).
  const workerFigures = [
    ["jobs",metrics.jobs,integer.format(leader.jobs),"Directly, worldwide · " + escapeHtml(leader.fy)],
    ["payroll",metrics.payroll,finiteNumber(leader.payroll) ? compactMoney(leader.payroll) : "Not disclosed",payNote(leader,true)]
  ];
  updateProfileNav(leader);
  dialog.dataset.leader = leader.id;
  byId("profile-body").innerHTML = `
    <div class="profile-section profile-overview" id="profile-overview" data-chip="Overview">
      <header class="profile-title">${portrait(leader,true)}<div class="profile-heading"><p class="eyebrow">NO. ${rank} BY VALUE CREATED <span aria-hidden="true">·</span> ${escapeHtml(leader.sector.toUpperCase())}</p><h2 id="profile-title">${escapeHtml(leader.name)}</h2><p class="profile-role">${escapeHtml(leader.role)} · <strong>${escapeHtml(leader.company)}</strong> <span class="profile-ticker">${escapeHtml(leader.ticker)}</span></p></div></header>
      <dl class="profile-stats profile-headline" id="profile-headline" aria-label="The headline">${headlineStats(leader)}</dl>
      <dl class="profile-stats profile-stats-workers" aria-label="Workers">${workerFigures.map(([key,label,value,note]) => `<div class="stat-${key}"><dt>${label}</dt><dd><strong>${value}</strong><span>${note}</span></dd></div>`).join("")}</dl>
      <div class="profile-overview-more">
        <div class="profile-lenses-wrap">
          <p class="profile-lenses">Value created is measured here as market value, which counts only what owners keep. Everything on this page is value created through the business; ${escapeHtml(leader.name)}’s philanthropy and work outside it aren’t counted. The sections below show more of the value ${escapeHtml(leader.company)} created, each on its own. Only paid out combines figures, and only its own parts; it never adds pay to workers, market value or another lens. <a href="/methodology">Methodology</a></p>
          ${isAmazon ? '<p class="amazon-profile-links"><button type="button" id="show-amazon-map">Explore where Amazon creates value</button></p>' : ""}
        </div>
      </div>
    </div>
    ${!isAmazon && typeof companyValueSlot === "function" ? companyValueSlot(leader) : ""}
    ${isAmazon ? amazonDistribution(leader) : ""}
    ${isAmazon && typeof companyValueSlot === "function" ? companyValueSlot(leader) : ""}
    <div class="profile-section profile-map" id="profile-map" data-chip="Where it creates value">
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
    </div>
    <section class="profile-section profile-sources" id="profile-sources" data-chip="Sources" aria-labelledby="sources-title">
      <h3 id="sources-title">Sources</h3>
      <div class="sources">${externalLink(leader.jobsUrl,"Employment source")}${externalLink(leader.capUrl,"Share count source")}${externalLink(leader.bio,"Biography")}</div>
      <p class="photo-credit">Photo (cropped): ${externalLink(leader.photo,leader.artist)} · ${externalLink(leader.licenseUrl,leader.license)}</p>
      <div id="profile-provenance" class="profile-provenance"></div>
    </section>`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTo({top:0,behavior:"instant"});
  buildChips();
  // The headline renders from headline.json on open; if that file is still on its way, it fills in on arrival.
  const fillHeadline = () => {
    const list = byId("profile-headline");
    if (!list || dialog.dataset.leader !== leader.id) return;
    list.innerHTML = headlineStats(leader);
    // Pay sits inside paid out only where paid out is shown.
    const entry = headline[leader.id];
    if (!(entry?.comparable && finiteNumber(entry.paidOutUsd))) document.querySelector("#profile-body .stat-payroll dd span").textContent = payNote(leader,false);
  };
  if (headline) fillHeadline();
  else headlineReady.then(fillHeadline);

  // Deep links scroll once the sections above their target have loaded, so the target doesn't move after.
  const jump = (target, focusTarget) => {
    if (token !== profileToken || !target?.isConnected) return;
    target.scrollIntoView({block:"start",behavior:"instant"});
    focusTarget?.focus({preventScroll:true,focusVisible:false});
    activeChip = -1;
    updateActiveChip();
  };
  const mapSection = byId("profile-map");
  const distribution = byId("amazon-distribution");
  if (distribution) bindAmazonDistribution(distribution);
  if (section === "distribution" && distribution) jump(distribution,sectionHeading(distribution));
  const valueSlot = byId("company-value");
  const valueShown = valueSlot ? bindCompanyValue(valueSlot,leader,byId("profile-provenance")).then(shown => {
    if (token === profileToken) buildChips();
    return shown;
  }) : Promise.resolve(false);
  valueShown.then(shown => {
    if (section !== "value" || !shown) return;
    const provenance = byId("profile-provenance").querySelector(".cv-provenance");
    if (shown === true) jump(valueSlot,sectionHeading(valueSlot));
    else jump(provenance,provenance?.querySelector("summary"));
  });
  if (isAmazon) {
    const footprint = byId("amazon-footprint");
    profileGlobe = bindAmazonFootprint(footprint,section === "states" ? "states" : "markets");
    const showMap = () => {
      mapSection.scrollIntoView({block:"start",behavior:scrollMode()});
      footprint.querySelector("[data-layer][aria-pressed='true']").focus({preventScroll:true,focusVisible:false});
    };
    byId("show-amazon-map").addEventListener("click",showMap);
    if (section === "footprint" || section === "states") valueShown.then(() => jump(mapSection,footprint.querySelector("[data-layer][aria-pressed='true']")));
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
    // When the company file (already loaded for the lenses above) has footprint rows, company-footprint.js
    // replaces this section with "Where {Company} creates value"; otherwise the simple globe stays.
    const simple = mapSection.querySelector("section.footprint");
    const deepLink = section === "footprint" || section === "states";
    const footprint = typeof bindCompanyFootprint === "function" ? bindCompanyFootprint(simple,leader,section).catch(error => { console.error(error); return null; }) : Promise.resolve(null);
    footprint.then(panel => {
      if (panel) {
        profileGlobe?.destroy();
        profileGlobe = panel.controller;
      }
    });
    if (deepLink) Promise.all([valueShown,footprint]).then(([,panel]) => jump(mapSection,panel ? panel.focusTarget() : byId("profile-globe")));
  }
}

// company-value.js and amazon-distribution.js are needed only inside a profile, so they load on the first
// open, not with the page. One promise per file, so each runs once; a file that failed to load is retried
// on the next open.
const profileScripts = new Map();
function loadProfileScripts() {
  return Promise.all(["amazon-distribution.js","ownership-headline.js","company-value.js"].map(src => {
    if (!profileScripts.has(src)) profileScripts.set(src,new Promise((resolve,reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => { script.remove(); profileScripts.delete(src); reject(new Error("Could not load " + src)); };
      document.head.append(script);
    }));
    return profileScripts.get(src);
  }));
}
let lastHash = location.hash;
function route() {
  const [,id,section] = location.hash.match(/^#leader\/([^/]+)(?:\/(distribution|footprint|states|value))?$/) || [];
  const leader = leaders.find(item => item.id === id);
  if (leader) {
    if (lastHash && !lastHash.startsWith("#leader/")) previousHash = lastHash;
    lastHash = location.hash;
    const hash = location.hash;
    loadProfileScripts().then(() => { if (location.hash === hash) openProfile(leader,section); },console.error);
    return;
  }
  if (dialog.open) dialog.close();
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
  chipObserver?.disconnect();
  footObserver?.disconnect();
  profileToken++;
  if (location.hash.startsWith("#leader/")) {
    history.replaceState(null,"",previousHash);
    lastHash = location.hash;
  }
});
window.addEventListener("hashchange",route);
// The first route runs once every deferred script has run.
document.addEventListener("DOMContentLoaded",route);

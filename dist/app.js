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
  <a href="#leader/${leader.id}" class="cover-card" aria-label="Number ${index + 1}: ${escapeHtml(leader.name)}, ${escapeHtml(leader.company)}, ${compactMoney(leader.cap)} value created">
    ${portrait(leader,true)}
    <span class="cover-rank">${index + 1}</span>
    <span class="cover-caption"><strong>${escapeHtml(leader.name)}</strong><small>${escapeHtml(leader.company)} <span>${compactMoney(leader.cap)}</span></small></span>
  </a>`).join("");
{
  // Headline figures for the dark band, all computed from the data files.
  const sum = key => leaders.reduce((total,leader) => total + leader[key],0);
  const oneDecimal = value => value.toFixed(1).replace(/\.0$/,"");
  const scaled = (value, prefix = "") => value >= 1e12 ? [prefix + oneDecimal(value / 1e12),"trillion"]
    : value >= 1e9 ? [prefix + Math.round(value / 1e9),"billion"]
    : [prefix + oneDecimal(value / 1e6),"million"];
  const figure = ([number,unit]) => `${number}<small> ${unit}</small>`;
  const stats = [
    {value:figure(scaled(sum("cap") * 1e9,"$")),label:"in value created, at year-end 2024"},
    {value:figure(scaled(sum("jobs"))),label:"people employed directly"},
    {value:figure(scaled(sum("payroll") * 1e9,"$")),label:"estimated pay to workers each year"}
  ];
  const founder = typeof amazonOwnership !== "undefined" && amazonOwnership.holders.find(holder => holder.color === "founder");
  if (founder) {
    const outside = 100 * (1 - founder.shares / amazonOwnership.sharesOutstanding);
    stats.push({value:outside.toFixed(1) + "%",label:"of Amazon held outside Jeff Bezos’s direct stake",href:"#leader/jeff-bezos/distribution",kicker:"Amazon case study"});
  }
  byId("stats").innerHTML = stats.map(({value,label,href,kicker}) => href
    ? `<a class="stat stat-shared" href="${href}"><span class="stat-kicker">${kicker}</span><strong>${value}</strong><span>${label}</span><span class="stat-more">Read the case study <span aria-hidden="true">→</span></span></a>`
    : `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
}

const rows = byId("rows"), query = byId("query"), sort = byId("sort"), sector = byId("sector");
for (const industry of [...new Set(leaders.map(leader => leader.sector))].sort()) {
  sector.add(new Option(industry,industry));
}
function searchable(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase();
}
function render() {
  const search = searchable(query.value.trim());
  const metric = sort.value;
  document.querySelectorAll("th[data-col]").forEach(header => {
    const active = header.dataset.col === metric;
    header.classList.toggle("active-col",active);
    if (active) header.setAttribute("aria-sort","descending");
    else header.removeAttribute("aria-sort");
  });
  const ranked = [...leaders].sort((a,b) => b[metric] - a[metric] || b.cap - a.cap);
  rows.innerHTML = ranked.map((leader,index) => {
    if (sector.value && leader.sector !== sector.value) return "";
    if (!searchable([leader.name,leader.company,leader.ticker].join(" ")).includes(search)) return "";
    const cols = [["cap",compactMoney(leader.cap)],["jobs",integer.format(leader.jobs)],["payroll",compactMoney(leader.payroll)]];
    return `<tr data-id="${leader.id}">
      <td class="rank">${String(index + 1).padStart(2,"0")}</td>
      <td><a class="leader" href="#leader/${leader.id}">${portrait(leader)}<span><strong>${escapeHtml(leader.name)}</strong><small>${escapeHtml(leader.company)} <span class="ticker">· ${escapeHtml(leader.ticker)}</span></small></span></a></td>
      ${cols.map(([key,value]) => `<td class="number ${key === metric ? "active-col" : ""}" data-label="${metrics[key]}">${value}</td>`).join("")}
    </tr>`;
  }).join("");
  const total = rows.children.length;
  byId("result-count").textContent = total === leaders.length ? "All " + total + " leaders" : total + " of " + leaders.length + " leaders";
  byId("empty").hidden = total > 0;
}
query.addEventListener("input",render);
sort.addEventListener("change",render);
sector.addEventListener("change",render);
rows.addEventListener("click",event => {
  const row = event.target.closest("tr[data-id]");
  if (row && !event.target.closest("a") && !window.getSelection()?.toString()) row.querySelector("a").click();
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

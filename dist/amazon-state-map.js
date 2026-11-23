const amazonStateSource = "https://www.aboutamazon.com/news/community/how-amazon-is-investing-in-the-us";
const stateHeatBands = [
  {min:0, label:"Under $1B",color:"#634e4e"},
  {min:1, label:"$1B–<$5B",color:"#88604e"},
  {min:5, label:"$5B–<$20B",color:"#ad6d50"},
  {min:20,label:"$20B–<$50B",color:"#d48254"},
  {min:50,label:"$50B–<$100B",color:"#f4a263"},
  {min:100,label:"$100B+",color:"#ffd28f"}
];
function amazonStatesView() {
  return `
    <div id="amazon-states-view" class="amazon-states-view" hidden>
      <div class="amazon-states-map">
        <svg viewBox="-64 0 1030 620" aria-hidden="true">
          ${amazonStateData.map(state => `<path data-state="${state.id}" d="${state.path}"><title>${state.name}</title></path>`).join("")}
        </svg>
        <div class="state-heat-legend" aria-label="Heat map key">
          ${stateHeatBands.map(band => `<span><i style="--dot:${band.color}"></i>${escapeHtml(band.label)}</span>`).join("")}
        </div>
        <p class="amazon-state-inset">Alaska and Hawaii are shown as insets.</p>
      </div>
      <div class="amazon-state-panel">
        <label for="amazon-state-metric">Shade states by</label>
        <select id="amazon-state-metric"><option value="gdp">Estimated GDP contribution</option><option value="investment">Amazon investment</option></select>
        <label for="amazon-state-picker">Explore a state</label>
        <select id="amazon-state-picker">${amazonStateData.map(state => `<option value="${state.id}">${state.name}</option>`).join("")}</select>
        <div id="amazon-state-detail" class="amazon-map-detail" aria-live="polite"></div>
      </div>
    </div>`;
}
function bindAmazonStates(root) {
  const picker = byId("amazon-state-picker");
  const metric = byId("amazon-state-metric");
  const detail = byId("amazon-state-detail");
  const paths = root.querySelectorAll("path[data-state]");
  const amount = (state,key) => compactMoney(state[key]) + (state[key+"Plus"] ? "+" : "");

  function render() {
    const selected = amazonStateData.find(state => state.id === picker.value);
    const key = metric.value;
    const field = key === "gdp" ? "estimated GDP contribution" : "Amazon investment";
    paths.forEach((path,index) => {
      const state = amazonStateData[index];
      const band = stateHeatBands.findLast(entry => entry.min <= state[key]);
      path.setAttribute("fill",band.color);
      path.classList.toggle("selected",state === selected);
      path.querySelector("title").textContent = `${state.name}: ${amount(state,key)} ${field}`;
    });
    const primary = key === "gdp" ? "Estimated GDP contribution" : "Amazon investment";
    const secondaryKey = key === "gdp" ? "investment" : "gdp";
    const secondary = secondaryKey === "gdp" ? "Estimated GDP contribution" : "Amazon investment";
    detail.innerHTML = `<h4>${selected.name}</h4>
      <strong>${amount(selected,key)}</strong><p>${primary} · 2010–2025</p>
      <dl><div><dt>${secondary}</dt><dd>${amount(selected,secondaryKey)}</dd></div>
        ${selected.employees == null ? "" : `<div><dt>People employed${selected.employeeDate ? ` · ${selected.employeeDate}` : ""}</dt><dd>${integer.format(selected.employees)}${selected.employeesPlus ? "+" : ""}</dd></div>`}
      </dl>
      ${externalLink(selected.url,"State fact sheet")}
      ${amazonSites.some(site => site.state === selected.id) ? `<button type="button" class="map-scope-link" data-sites-state="${selected.id}">Explore selected sites in ${selected.name}</button>` : ""}`;
  }
  root.querySelector("svg").addEventListener("click",event => {
    const path = event.target.closest("[data-state]");
    if (!path) return;
    picker.value = path.dataset.state;
    render();
  });
  picker.addEventListener("change",render);
  metric.addEventListener("change",render);
  picker.value = "06";
  render();
}

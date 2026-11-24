// Methodology page: the coverage table and the Nordhaus finding, both from coverage.json
// (written by scripts/build-companies.mjs). The Nordhaus paragraph appears only when the build
// published that finding; otherwise the page omits it.
(() => {
  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const names = {ownership:"Ownership",workers:"Workers",cash:"Cash to shareholders",paidout:"Paid out",geography:"Sales by region",ecosystem:"Ecosystem",taxes:"Taxes",rnd:"R&D",footprint:"Footprint"};
  const rows = byId("coverage-rows");

  function renderCoverage(coverage) {
    const order = Array.isArray(coverage.lenses) ? coverage.lenses.filter(key => names[key]) : Object.keys(names);
    const leaders = Array.isArray(coverage.leaders) ? coverage.leaders : [];
    const count = key => leaders.filter(leader => leader.lenses && leader.lenses[key] > 0).length;
    byId("coverage-summary").innerHTML = order.map(key => `<span><strong>${escapeHtml(names[key])}</strong> ${count(key)} of ${leaders.length}</span>`).join("");
    rows.innerHTML = leaders.map(leader => {
      const href = "/#leader/" + encodeURIComponent(leader.id) + "/value";
      const lenses = order.filter(key => leader.lenses && leader.lenses[key] > 0);
      const cells = lenses.length
        ? lenses.map(key => {
          const figures = leader.lenses[key];
          return `<a class="mp-chip" href="${key === "footprint" ? href.replace(/\/value$/,"/footprint") : href}" aria-label="${escapeHtml(leader.name)}: ${escapeHtml(names[key])}, ${figures} sourced figure${figures === 1 ? "" : "s"}">${escapeHtml(names[key])}<small>${figures}</small></a>`;
        }).join("")
        : `<a class="mp-chip is-empty" href="${href}">Ranking figures only</a>`;
      return `<tr><th scope="row"><a href="${href}">${escapeHtml(leader.name)}</a><small>${escapeHtml(leader.company)}</small></th><td><div class="mp-chips">${cells}</div></td></tr>`;
    }).join("");
    if (coverage.gated) byId("gate-note").hidden = false;
  }

  function renderNordhaus(finding) {
    const source = finding && finding.source;
    if (!source || !/^https:\/\//.test(source.url || "") || !finding.quote) return;
    const box = byId("nordhaus");
    const byline = [finding.author, finding.title ? `“${finding.title}”` : "", finding.year].filter(Boolean).map(escapeHtml).join(", ");
    box.innerHTML = `<h3>How much of the value do innovators keep?</h3>
      ${finding.claim ? `<p>${escapeHtml(finding.claim)}</p>` : ""}
      <blockquote><p>${escapeHtml(finding.quote)}</p>${byline ? `<footer>${byline}</footer>` : ""}</blockquote>
      <p class="mp-finding-source"><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label || source.url)}</a></p>`;
    box.hidden = false;
  }

  fetch("/coverage.json")
    .then(response => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
    .then(coverage => {
      renderCoverage(coverage);
      if (coverage.nordhaus) renderNordhaus(coverage.nordhaus);
    })
    .catch(() => {
      rows.innerHTML = '<tr><td colspan="2" class="mp-loading">Coverage is not available right now. Every profile lists its own sources.</td></tr>';
    });
})();

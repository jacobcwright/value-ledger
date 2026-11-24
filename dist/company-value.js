// "Who shares in the value?" for every leader except Amazon (which has its own case study).
// Data: dist/companies/<leader-id>.json, written by scripts/build-companies.mjs from research/records
// (see research/SCHEMA.md). Values are billions of the record's currency. A leader without a
// published record keeps today's profile: the slot is removed silently.
// Defensive by design: records written by other researchers may predate the schema, so every
// figure is shown only when it has a number and an https source, and never when it is not-sourced.
const companyValueRecords = new Map();
// Same mirror/aggregator list as scripts/validate-records.mjs: never link a figure to these.
const companyValueMirrors = /dfcfw\.com|9to5mac|seekingalpha|marketscreener|macrotrends|stockanalysis|companiesmarketcap|wsj\.com|reuters\.com|bloomberg|yahoo\.|investing\.com|wikipedia|annualreports\.com|last10k|fintel|gurufocus/;
const companyValueHosts = ["sec","company","exchange","regulator"];
const companyValueViews = [
  ["ownership","Who owns it"],
  ["cash","Cash to shareholders"],
  ["workers","Workers"],
  ["geography","Where sales come from"]
];
const companyHolderTypes = {"asset-manager":"Asset manager","index-fund":"Index fund",pension:"Pension",sovereign:"Sovereign fund",government:"Government",family:"Family",company:"Company",employees:"Employees",other:"Other"};
const companyRelations = {founder:"Founder","co-founder":"Co-founder","founding-family":"Founding family",estate:"Estate",ceo:"CEO","former-ceo":"Former CEO",chair:"Chair",investor:"Investor"};

function companyValueSlot(leader) {
  return `<section id="company-value" class="distribution company-value" aria-labelledby="company-value-title" data-leader="${escapeHtml(leader.id)}" hidden></section>`;
}

const cvNumber = value => typeof value === "number" && Number.isFinite(value);
const cvHidden = item => !item || item.status === "not-sourced";
// A source is publishable when it is an https document link with a label, on an allowed host type
// (when the record states one) and not a known mirror.
function cvSource(source) {
  if (!source || typeof source !== "object") return null;
  const url = typeof source.url === "string" ? source.url : "";
  if (!/^https:\/\/\S+$/.test(url) || companyValueMirrors.test(url) || !source.label) return null;
  if (source.hostType != null && !companyValueHosts.includes(source.hostType)) return null;
  return {url,label:String(source.label),quote:source.quote ? String(source.quote) : ""};
}
// A figure with a value: shown when it has a number and a publishable source (0 may stand alone).
function cvFigure(field) {
  if (cvHidden(field) || !cvNumber(field.value) || field.value < 0) return null;
  const source = cvSource(field.source);
  if (!source && field.value !== 0) return null;
  return {value:field.value,sources:source ? [source] : []};
}
function cvMoney(billions, currency) {
  // Same rounding as compactMoney(): trillions to two decimals, billions and millions to one.
  const trillions = Math.abs(billions) >= 1000;
  try {
    const code = currency === "CNY";
    const text = new Intl.NumberFormat("en-US",{style:"currency",currency,currencyDisplay:code ? "code" : "symbol",notation:"compact",minimumFractionDigits:trillions ? 2 : 0,maximumFractionDigits:trillions ? 2 : 1}).format(billions * 1e9);
    return code ? text.replace(/CNY\s?/,"RMB ") : text;
  } catch {
    return `${escapeHtml(currency)} ${decimal.format(billions)}B`;
  }
}
const cvPercent = (value, digits = 1) => value.toFixed(digits) + "%";
// ISO dates ("2025-04-01" or "2025-06") as "Apr 1, 2025" / "Jun 2025", in UTC so they never shift a day.
function cvDate(value) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value || "");
  if (!match) return "";
  const date = new Date(Date.UTC(+match[1],+match[2] - 1,+(match[3] || 1)));
  return date.toLocaleDateString("en-US",match[3] ? {timeZone:"UTC",year:"numeric",month:"short",day:"numeric"} : {timeZone:"UTC",year:"numeric",month:"short"});
}
const cvPossessive = name => name + "’s";
// One compact "Sources" row per tab: unique documents by URL. When one document backs several
// figures, its shared title (the label before the first comma) stands for all of them.
function cvSourcesRow(sources) {
  const byUrl = new Map();
  for (const source of sources) {
    if (!source) continue;
    const entry = byUrl.get(source.url);
    if (entry) entry.labels.add(source.label);
    else byUrl.set(source.url,{url:source.url,labels:new Set([source.label]),quote:source.quote});
  }
  if (!byUrl.size) return "";
  const links = [...byUrl.values()].map(({url,labels,quote}) => {
    const all = [...labels];
    const label = all.length === 1 ? all[0] : all[0].split(",")[0];
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${quote && all.length === 1 ? ` title="${escapeHtml(quote)}"` : ""}>${escapeHtml(label)}</a>`;
  });
  return `<div class="cv-sources"><span class="cv-sources-label">Sources</span>${links.join("")}</div>`;
}
function cvPanelHead(title, meta, total = "") {
  return `<div class="distribution-subhead"><div><h4>${title}</h4>${meta ? `<p>${meta}</p>` : ""}</div>${total}</div>`;
}
function cvYearLine(record, withCurrency = true) {
  const end = cvDate(record.fiscalYearEnd);
  return [escapeHtml(record.fiscalYear || ""),end ? "year ended " + end : "",withCurrency && record.currency ? "in " + escapeHtml(record.currency) : ""].filter(Boolean).join(" · ");
}

function cvOwnership(record, leader) {
  const ownership = record.ownership || {};
  const person = ownership.leader && typeof ownership.leader === "object" ? ownership.leader : {};
  const showPerson = !cvHidden(person) && person.name;
  const name = escapeHtml(person.name || leader.name);
  const company = escapeHtml(leader.company);
  const sources = [];
  let self = null;
  if (showPerson && person.status === "holds") {
    const source = cvSource(person.source);
    if (cvNumber(person.pctEconomic) && source) {
      self = {pct:person.pctEconomic,derived:null};
      sources.push(source);
    } else if (person.derived && cvNumber(person.derived.pctEconomic) && person.derived.method) {
      const inputs = (Array.isArray(person.derived.inputs) ? person.derived.inputs : []).map(cvSource).filter(Boolean);
      const backing = inputs.length ? inputs : source ? [source] : [];
      if (backing.length) {
        self = {pct:person.derived.pctEconomic,derived:String(person.derived.method)};
        sources.push(...backing);
      }
    }
  }
  let family = null;
  if (showPerson && person.family && !cvHidden(person.family) && cvNumber(person.family.pctEconomic)) {
    const source = cvSource(person.family.source);
    const full = String(person.family.label || "");
    const label = full.replace(/\s*\(.*\)\s*$/,"").trim();
    const inner = /\((.*)\)\s*$/.exec(full);
    if (source && label) {
      family = {pct:person.family.pctEconomic,label,detail:inner ? inner[1] : "Founding family",headline:/^the\s/i.test(label) || !/family$/i.test(label) ? label : "The " + label};
      sources.push(source);
    }
  }
  const holders = (Array.isArray(ownership.largestHolders) ? ownership.largestHolders : [])
    .filter(holder => holder && !cvHidden(holder) && holder.name && cvNumber(holder.pctEconomic) && cvSource(holder.source))
    .sort((a,b) => b.pctEconomic - a.pctEconomic)
    .slice(0,3);
  holders.forEach(holder => sources.push(cvSource(holder.source)));
  if (!self && !family && !holders.length) return null;

  const selfPct = (self?.pct || 0) + (family?.pct || 0);
  const listed = selfPct + holders.reduce((sum,holder) => sum + holder.pctEconomic,0);
  const rest = listed <= 100.5 ? Math.max(0,100 - listed) : null;
  const othersPct = 100 - selfPct;
  const derivedTag = self?.derived ? ` <span class="cv-derived" title="${escapeHtml(self.derived)}">derived</span>` : "";

  // Plain statement of the leader's position when no percentage can be shown for them.
  let status = "";
  if (showPerson && !self) {
    // The schema has no field for "less than 1%" (a * in the proxy), so it is read from the record's notes.
    const notes = String(record.notes || "");
    const source = cvSource(person.source);
    const sourced = person.status === "holds" && source && (/less than 1\s?%/i.test(notes) || cvNumber(person.shares));
    status = person.status === "deceased" ? `${name} is deceased; no personal stake is reported.`
      : person.status === "no-reported-stake" ? `${name}: no reported stake.`
      : sourced && /less than 1\s?%/i.test(notes) ? `${name} holds less than 1%.`
      : sourced ? `${name} holds ${integer.format(person.shares)} shares; no percentage is disclosed.`
      : person.status === "not-disclosed" || person.status === "holds" ? `${name}: stake not disclosed.` : "";
    if (sourced) sources.push(source);
  }

  // The blue swatch marks the remainder, so it sits beside "Everyone else" only when that is the remainder.
  const othersLine = `<span class="cv-headline-rest">${holders.length ? "" : '<i class="cv-key cv-c-rest" aria-hidden="true"></i>'}Everyone else: <strong>${cvPercent(othersPct)}</strong></span>`;
  let headline;
  if (self) {
    headline = `<span>${name} holds <strong>${cvPercent(self.pct)}</strong>${derivedTag} of ${cvPossessive(company)} shares.</span>`
      + (family ? `<span>${escapeHtml(family.headline)} holds <strong>${cvPercent(family.pct)}</strong>.</span>` : "")
      + othersLine;
  } else if (family) {
    headline = `<span>${escapeHtml(family.headline)} holds <strong>${cvPercent(family.pct)}</strong> of ${cvPossessive(company)} shares.</span>`
      + othersLine;
  } else {
    const named = holders.slice(0,2).map(holder => `${escapeHtml(holder.name)} <strong>${cvPercent(holder.pctEconomic)}</strong>`);
    headline = `<span>${holders.length === 1 ? "Largest disclosed holder" : "Largest disclosed holders"}: ${named.join(" and ")}.</span>`;
  }

  // Bar and legend share one list of entries; colour follows the entity.
  const entries = [];
  if (self) entries.push({key:"self",name,detail:escapeHtml(companyRelations[person.relation] || "Leader") + (self.derived ? " · derived" : ""),pct:self.pct});
  if (family) entries.push({key:"self",name:escapeHtml(family.label),detail:escapeHtml(family.detail),pct:family.pct});
  const selfCount = entries.length;
  holders.forEach((holder,index) => {
    const asOf = cvDate(holder.asOf);
    entries.push({key:String(index + 1),name:escapeHtml(holder.name),detail:[escapeHtml(companyHolderTypes[holder.type] || "Holder"),asOf ? "as of " + asOf : ""].filter(Boolean).join(" · "),pct:holder.pctEconomic});
  });
  // With no named holders the remainder is everyone else; otherwise it sits inside an "Everyone else" group.
  const restName = selfCount && !holders.length ? "Everyone else" : "All other shareholders";
  if (rest !== null) entries.push({key:"rest",name:restName,detail:"100% minus the holdings listed",pct:rest});
  const row = entry => `<li><i class="cv-key cv-c-${entry.key}" aria-hidden="true"></i><span class="cv-holder-name"><strong>${entry.name}</strong><small>${entry.detail}</small></span><span class="cv-holder-pct">${cvPercent(entry.pct,2)}</span></li>`;
  const list = selfCount && holders.length
    ? entries.slice(0,selfCount).map(row).join("") + `<li class="cv-group"><span>Everyone else</span><span>${cvPercent(othersPct)}</span></li>` + entries.slice(selfCount).map(row).join("")
    : entries.map(row).join("");
  const bar = rest !== null ? `<div class="cv-bar" aria-hidden="true">${entries.map(entry => `<span class="cv-c-${entry.key}" style="flex-grow:${entry.pct.toFixed(3)}" title="${entry.name.replace(/<[^>]*>/g,"")}: ${cvPercent(entry.pct,2)}"></span>`).join("")}</div>` : "";

  const structure = ownership.structure && typeof ownership.structure === "object" ? ownership.structure : null;
  const structureParts = [];
  if (structure?.dualClass === true) structureParts.push("Dual-class shares");
  if (structure?.dualClass === false) structureParts.push("One share class");
  if (showPerson && cvNumber(person.pctVoting)) structureParts.push(`${name} holds ${decimal.format(person.pctVoting)}% of votes`);
  if (structure?.controlled === true) structureParts.push("Controlled company: one holder has a majority of votes");
  if (structure?.controlled === false) structureParts.push("No holder has a majority of votes");

  const asOf = cvDate(ownership.asOf);
  const method = [
    self?.derived ? `<p><strong>Derived stake.</strong> ${escapeHtml(self.derived)}</p>` : "",
    rest !== null ? "<p>“All other shareholders” is 100% minus the holdings listed. Percentages are of all shares outstanding, as each filing states them.</p>" : ""
  ].join("");
  return {
    sources,
    html:`${cvPanelHead(`Who owns ${company}?`,["Share of all shares outstanding",asOf ? "as of " + asOf : ""].filter(Boolean).join(" · "))}
      <p class="cv-headline">${headline}</p>
      ${status ? `<p class="cv-status">${status}</p>` : ""}
      ${bar}
      <ul class="cv-holders" aria-label="Disclosed holdings">${list}</ul>
      ${structureParts.length ? `<p class="distribution-note cv-structure">${structureParts.join(" · ")}.</p>` : ""}
      ${method ? `<details class="distribution-method"><summary>Method</summary>${method}</details>` : ""}`
  };
}

function cvCash(record, leader) {
  const cash = record.cash || {};
  const dividends = cvFigure(cash.dividends), buybacks = cvFigure(cash.buybacks);
  if (!dividends && !buybacks) return null;
  const money = value => cvMoney(value,record.currency);
  const cell = figure => `<td${figure.value === 0 ? ' class="is-zero"' : ""}>${money(figure.value)}</td>`;
  const total = dividends && buybacks ? `<div class="distribution-total"><strong>${money(dividends.value + buybacks.value)}</strong><span>Total cash returned in ${escapeHtml(record.fiscalYear || "the year")}</span></div>` : "";
  return {
    sources:[...(dividends?.sources || []),...(buybacks?.sources || [])],
    html:`${cvPanelHead(`What did ${escapeHtml(leader.company)} pay to shareholders?`,cvYearLine(record),total)}
      <table class="distribution-table">
        <thead><tr><th scope="col">Year</th>${dividends ? '<th scope="col">Cash dividends</th>' : ""}${buybacks ? '<th scope="col">Stock buybacks</th>' : ""}</tr></thead>
        <tbody><tr><th scope="row">${escapeHtml(record.fiscalYear || "")}</th>${dividends ? cell(dividends) : ""}${buybacks ? cell(buybacks) : ""}</tr></tbody>
      </table>
      ${buybacks ? `<p class="distribution-note">Buybacks pay whoever sells shares back to ${escapeHtml(leader.company)}.</p>` : ""}`
  };
}

function cvWorkers(record, leader) {
  const workers = record.workers || {};
  const stock = cvFigure(workers.stockComp);
  const plan = workers.plan && !cvHidden(workers.plan) && workers.plan.text ? {text:String(workers.plan.text),source:cvSource(workers.plan.source || workers.plan)} : null;
  const planShown = plan?.source ? plan : null;
  if (!stock && !planShown) return null;
  return {
    sources:[...(stock?.sources || []),planShown?.source],
    html:`${cvPanelHead(`How did ${cvPossessive(escapeHtml(leader.company))} workers share?`,cvYearLine(record,Boolean(stock)))}
      <div class="cv-totals">
        ${stock ? `<div><strong>${cvMoney(stock.value,record.currency)}</strong><span>Stock-based compensation expense, ${escapeHtml(record.fiscalYear || "")}</span></div>` : ""}
        <div><strong>${compactMoney(leader.payroll)}</strong><span>${metrics.payroll}</span></div>
      </div>
      ${planShown ? `<p class="cv-plan">${escapeHtml(planShown.text)}</p>` : ""}
      ${stock ? `<p class="distribution-note">Pay is our ${record.currency === "USD" ? "" : "USD "}estimate; stock pay is ${cvPossessive(escapeHtml(leader.company))} reported expense${record.currency === "USD" ? "" : " in " + escapeHtml(record.currency)}. The bases differ.</p>` : ""}`
  };
}

function cvGeography(record, leader) {
  const geography = record.geography;
  if (cvHidden(geography) || !cvNumber(geography.total) || geography.total <= 0) return null;
  const source = cvSource(geography.source);
  const segments = (Array.isArray(geography.segments) ? geography.segments : []).filter(segment => segment && segment.name && cvNumber(segment.value) && segment.value >= 0);
  if (!source || !segments.length) return null;
  const money = value => cvMoney(value,record.currency);
  return {
    sources:[source],
    html:`${cvPanelHead(`Where did ${cvPossessive(escapeHtml(leader.company))} sales come from?`,cvYearLine(record),`<div class="distribution-total"><strong>${money(geography.total)}</strong><span>Total reported</span></div>`)}
      <ul class="cv-segments" aria-label="Revenue by reported geography">
        ${segments.map(segment => {
          const share = 100 * segment.value / geography.total;
          return `<li><span class="cv-segment-name">${escapeHtml(segment.name)}</span><span class="cv-track" aria-hidden="true"><span style="width:${Math.min(100,share).toFixed(2)}%"></span></span><span class="cv-segment-figures"><strong>${cvPercent(share)}</strong><small>${money(segment.value)}</small></span></li>`;
        }).join("")}
      </ul>
      ${geography.basis ? `<p class="cv-caption">${escapeHtml(geography.basis)}</p>` : ""}`
  };
}

function cvRender(record, leader) {
  const panels = {ownership:cvOwnership,cash:cvCash,workers:cvWorkers,geography:cvGeography};
  const views = companyValueViews.map(([key,label]) => ({key,label,panel:panels[key](record,leader)})).filter(view => view.panel);
  if (!views.length) return "";
  return `
      <header class="distribution-heading">
        <p class="eyebrow">${escapeHtml(leader.company.toUpperCase())}</p>
        <h3 id="company-value-title">Who shares in the value?</h3>
      </header>
      <div class="distribution-tabs" role="tablist" aria-label="Explore ${escapeHtml(cvPossessive(leader.company))} value">
        ${views.map((view,index) => `<button id="cv-tab-${view.key}" type="button" role="tab" aria-controls="cv-${view.key}" aria-selected="${index === 0}" tabindex="${index === 0 ? "0" : "-1"}">${view.label}</button>`).join("")}
      </div>
      ${views.map((view,index) => `<div id="cv-${view.key}" class="distribution-panel" role="tabpanel" aria-labelledby="cv-tab-${view.key}" tabindex="0"${index ? " hidden" : ""}>
        ${view.panel.html}
        ${cvSourcesRow(view.panel.sources)}
      </div>`).join("")}`;
}

// companies.json lists the published ids (written by the build next to dist/companies/), so leaders
// without a record never trigger a 404 in the console. If the list itself is missing, fall back to
// asking for the record directly; a 404 or network error then hides the slot all the same.
let companyValueIndex;
function cvPublished() {
  companyValueIndex ??= fetch("companies.json")
    .then(response => response.ok ? response.json() : null)
    .then(index => Array.isArray(index?.published) ? new Set(index.published) : null)
    .catch(() => null);
  return companyValueIndex;
}
function cvLoad(id) {
  if (!companyValueRecords.has(id)) {
    companyValueRecords.set(id,cvPublished().then(published => published && !published.has(id) ? null
      : fetch(`companies/${encodeURIComponent(id)}.json`).then(response => response.ok ? response.json() : null))
      .catch(() => null));
  }
  return companyValueRecords.get(id);
}

// Fills the slot, or removes it when there is no publishable record. Resolves true when shown.
async function bindCompanyValue(root, leader) {
  if (!root) return false;
  const record = await cvLoad(leader.id);
  // The profile may have moved on to another leader while the record loaded.
  if (!root.isConnected || root.dataset.leader !== leader.id) return false;
  let html = "";
  try {
    if (record && typeof record === "object" && record.id === leader.id) html = cvRender(record,leader);
  } catch {
    html = "";
  }
  if (!html) {
    root.remove();
    return false;
  }
  root.innerHTML = html;
  root.hidden = false;
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  function activate(index, focus = false) {
    tabs.forEach((tab,i) => {
      const active = i === index;
      tab.setAttribute("aria-selected",String(active));
      tab.tabIndex = active ? 0 : -1;
      root.querySelector("#" + tab.getAttribute("aria-controls")).hidden = !active;
    });
    if (focus) tabs[index].focus();
  }
  tabs.forEach((tab,index) => {
    tab.addEventListener("click",() => activate(index));
    tab.addEventListener("keydown",event => {
      const indices = {ArrowLeft:(index + tabs.length - 1) % tabs.length,ArrowRight:(index + 1) % tabs.length,Home:0,End:tabs.length - 1};
      if (!(event.key in indices)) return;
      event.preventDefault();
      activate(indices[event.key],true);
    });
  });
  return true;
}

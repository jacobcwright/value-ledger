// "Who shares in the value?" in every profile, plus "How we got these numbers".
// Data: dist/companies/<leader-id>.json, written by scripts/build-companies.mjs from research/records and
// research/lenses (see research/SCHEMA.md and research/LENSES.md). Values are billions of the stated currency.
// Each lens is shown on its own and never added to another or to market value.
// Amazon keeps its bespoke case study; its file carries only the added lenses (ecosystem, taxes, R&D),
// which mount as a small standalone section after the case study.
// Defensive by design: every figure is shown only when it has a number and an https source, and never
// when it is not-sourced. A leader with no publishable file still gets the provenance block for the
// ranking's own figures (market value, people employed, estimated pay).
const companyValueRecords = new Map();
// Same mirror/aggregator list as scripts/validate-records.mjs: never link a researched figure to these.
const companyValueMirrors = /dfcfw\.com|9to5mac|seekingalpha|marketscreener|macrotrends|stockanalysis|companiesmarketcap|wsj\.com|reuters\.com|bloomberg|yahoo\.|investing\.com|wikipedia|annualreports\.com|last10k|fintel|gurufocus/;
const companyValueHosts = ["sec","company","exchange","regulator"];
const companyValueViews = [
  ["ownership","Who owns it"],
  ["workers","Workers"],
  ["cash","Cash to shareholders"],
  ["ecosystem","Ecosystem"],
  ["fiscal","Taxes & R&D"],
  ["geography","Where sales come from"]
];
// Amazon's own case study already covers ownership, workers, cash and sales by market.
const companyLensViews = ["ecosystem","fiscal"];
const companyHolderTypes = {"asset-manager":"Asset manager","index-fund":"Index fund",pension:"Pension",sovereign:"Sovereign fund",government:"Government",family:"Family",company:"Company",employees:"Employees",other:"Other"};
const companyRelations = {founder:"Founder","co-founder":"Co-founder","founding-family":"Founding family",estate:"Estate",ceo:"CEO","former-ceo":"Former CEO",chair:"Chair",executive:"Executive",investor:"Investor"};
// Evidence tiers, as named on the methodology page.
const cvTiers = {filing:"From the 10-K/annual report","company-commissioned":"Company-commissioned",derived:"Derived from filings",market:"Market data",estimate:"Our estimate",record:"Filing",company:"Company-reported"};

function companyValueSlot(leader) {
  return `<section id="company-value" class="distribution company-value${leader.id === "jeff-bezos" ? " company-lenses" : ""}" aria-labelledby="company-value-title" data-leader="${escapeHtml(leader.id)}" hidden></section>`;
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
function cvFigure(field, {negative = false} = {}) {
  if (cvHidden(field) || !cvNumber(field.value) || (!negative && field.value < 0)) return null;
  const source = cvSource(field.source);
  if (!source && field.value !== 0) return null;
  return {value:field.value,label:field.label ? String(field.label) : "",sources:source ? [source] : []};
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
// A plain amount of currency ("$1", "$32", "₹4.21") for the per-dollar line.
function cvUnitMoney(amount, currency, digits) {
  try {
    const text = new Intl.NumberFormat("en-US",{style:"currency",currency,currencyDisplay:currency === "CNY" ? "code" : "symbol",minimumFractionDigits:digits,maximumFractionDigits:digits}).format(amount);
    return currency === "CNY" ? text.replace(/CNY\s?/,"RMB ") : text;
  } catch {
    return `${escapeHtml(currency)} ${amount.toFixed(digits)}`;
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
const cvPossessive = name => /s$/i.test(name) ? name + "’" : name + "’s";
const cvLink = (source, text = source.label) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
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
// The fiscal year of a record or of a lens's own period.
const cvPeriod = (record, lens) => lens && lens.period && typeof lens.period === "object" ? {...record,...lens.period} : record;
function cvYearLine(period, withCurrency = true) {
  const end = cvDate(period.fiscalYearEnd);
  return [escapeHtml(period.fiscalYear || ""),end ? "year ended " + end : "",withCurrency && period.currency ? "in " + escapeHtml(period.currency) : ""].filter(Boolean).join(" · ");
}
const cvFy = period => [period.fiscalYear,cvDate(period.fiscalYearEnd) ? "year ended " + cvDate(period.fiscalYearEnd) : ""].filter(Boolean).join(", ");
// Provenance entry: one published figure with how it was reached.
const cvProof = (label, value, when, tier, sources, note = "") => ({label,value,when,tier,sources:sources.filter(Boolean),note});
const cvTag = tier => `<span class="cv-tier${tier === "company-commissioned" ? " is-commissioned" : ""}">${cvTiers[tier] || escapeHtml(tier)}</span>`;

function cvOwnership(record, leader) {
  const ownership = record.ownership || {};
  const person = ownership.leader && typeof ownership.leader === "object" ? ownership.leader : {};
  const showPerson = !cvHidden(person) && person.name;
  const name = escapeHtml(person.name || leader.name);
  const company = escapeHtml(leader.company);
  const asOfOwnership = cvDate(ownership.asOf);
  const sources = [], proof = [];
  let self = null;
  if (showPerson && person.status === "holds") {
    const source = cvSource(person.source);
    if (cvNumber(person.pctEconomic) && source) {
      self = {pct:person.pctEconomic,derived:null};
      sources.push(source);
      proof.push(cvProof(`${person.name}’s stake`,cvPercent(person.pctEconomic,2),asOfOwnership,"record",[source]));
    } else if (person.derived && cvNumber(person.derived.pctEconomic) && person.derived.method) {
      const inputs = (Array.isArray(person.derived.inputs) ? person.derived.inputs : []).map(cvSource).filter(Boolean);
      const backing = inputs.length ? inputs : source ? [source] : [];
      if (backing.length) {
        self = {pct:person.derived.pctEconomic,derived:String(person.derived.method)};
        sources.push(...backing);
        proof.push(cvProof(`${person.name}’s stake`,cvPercent(person.derived.pctEconomic,2),asOfOwnership,"derived",backing,String(person.derived.method)));
      }
    }
  }
  let family = null;
  if (showPerson && person.family && !cvHidden(person.family) && cvNumber(person.family.pctEconomic)) {
    const source = cvSource(person.family.source);
    const full = String(person.family.label || "");
    // Labels are written for readers of the filing, sometimes as a paragraph ("X (largest shareholder) and
    // its related parties: A, B, C. Includes …"). The short name is the text before any colon, without
    // parentheticals; the rest becomes the detail line.
    const colon = full.indexOf(":");
    const head = colon > 0 ? full.slice(0,colon) : full;
    const label = head.replace(/\s*\([^)]*\)/g,"").replace(/\s*\(.*$/,"").trim();
    const inner = colon > 0 ? [null,full.slice(colon + 1).trim()] : /\((.*)\)\s*$/.exec(full);
    if (source && label) {
      family = {pct:person.family.pctEconomic,label,detail:inner && inner[1] ? inner[1] : "Founding family",headline:/^the\s/i.test(label) || !/(family|group)$/i.test(label) ? label : "The " + label,includesLeader:person.family.includesLeader === true};
      sources.push(source);
      proof.push(cvProof(full,cvPercent(family.pct,2),asOfOwnership,"record",[source]));
    }
  }
  const holders = (Array.isArray(ownership.largestHolders) ? ownership.largestHolders : [])
    .filter(holder => holder && !cvHidden(holder) && holder.name && cvNumber(holder.pctEconomic) && cvSource(holder.source))
    .sort((a,b) => b.pctEconomic - a.pctEconomic);
  // Class-basis holders are a share of one class only: listed, never in the bar or in "everyone else".
  const barHolders = holders.filter(holder => holder.basis !== "class").slice(0,3);
  const classHolders = holders.filter(holder => holder.basis === "class").slice(0,3);
  const classOf = holder => holder.classLabel ? String(holder.classLabel) : "one class";
  for (const holder of [...barHolders,...classHolders]) {
    const source = cvSource(holder.source);
    sources.push(source);
    proof.push(cvProof(holder.name + (holder.basis === "class" ? ` (% of ${classOf(holder)})` : ""),cvPercent(holder.pctEconomic,2),cvDate(holder.asOf) || asOfOwnership,"record",[source]));
  }
  if (!self && !family && !holders.length) return null;

  // A family or promoter-group total that already includes the leader is never added to the leader's own stake.
  const selfPct = family?.includesLeader ? family.pct : (self?.pct || 0) + (family?.pct || 0);
  const listed = selfPct + barHolders.reduce((sum,holder) => sum + holder.pctEconomic,0);
  const rest = listed <= 100.5 ? Math.max(0,100 - listed) : null;
  // Rounded from the displayed stake, so the two headline figures always sum to 100.0%.
  const r1 = value => Math.round(value * 10) / 10;
  const othersPct = 100 - (family?.includesLeader ? r1(family.pct) : r1(self?.pct || 0) + r1(family?.pct || 0));
  const derivedTag = self?.derived ? ` <span class="cv-derived" title="${escapeHtml(self.derived)}">derived</span>` : "";

  // Plain statement of the leader's position when no percentage can be shown for them.
  let status = "";
  // A stake that counts shares the person doesn't own outright (options, proxy votes, deemed interests) carries its caveat beside the headline.
  if (self && person.caveat) status = String(person.caveat);
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
    if (sourced) {
      sources.push(source);
      proof.push(cvProof(`${person.name}’s stake`,/less than 1\s?%/i.test(notes) ? "Less than 1%" : integer.format(person.shares) + " shares",asOfOwnership,"record",[source]));
    }
  }

  // The blue swatch marks the remainder, so it sits beside "Everyone else" only when that is the remainder.
  const othersLine = `<span class="cv-headline-rest">${barHolders.length ? "" : '<i class="cv-key cv-c-rest" aria-hidden="true"></i>'}Everyone else: <strong>${cvPercent(othersPct)}</strong></span>`;
  let headline;
  if (family?.includesLeader) {
    headline = `<span>${escapeHtml(family.headline)} holds <strong>${cvPercent(family.pct)}</strong> of ${cvPossessive(company)} shares${self ? `, including ${cvPossessive(name)} own <strong>${cvPercent(self.pct,2)}</strong>${derivedTag}` : ""}.</span>` + othersLine;
  } else if (self) {
    headline = `<span>${name} holds <strong>${cvPercent(self.pct)}</strong>${derivedTag} of ${cvPossessive(company)} shares.</span>`
      + (family ? `<span>${escapeHtml(family.headline)} holds <strong>${cvPercent(family.pct)}</strong>.</span>` : "")
      + othersLine;
  } else if (family) {
    headline = `<span>${escapeHtml(family.headline)} holds <strong>${cvPercent(family.pct)}</strong> of ${cvPossessive(company)} shares.</span>`
      + othersLine;
  } else {
    const named = holders.slice(0,2).map(holder => `${escapeHtml(holder.name)} <strong>${cvPercent(holder.pctEconomic)}</strong>${holder.basis === "class" ? ` (of ${escapeHtml(classOf(holder))})` : ""}`);
    headline = `<span>${holders.length === 1 ? "Largest disclosed holder" : "Largest disclosed holders"}: ${named.join(" and ")}.</span>`;
  }

  // Bar and legend share one list of entries; colour follows the entity.
  const entries = [];
  const leaderRow = self ? {key:"self",name,detail:escapeHtml(companyRelations[person.relation] || "Leader") + (self.derived ? " · derived" : ""),pct:self.pct} : null;
  if (family?.includesLeader) {
    entries.push({key:"self",name:escapeHtml(family.label),detail:escapeHtml(family.detail),pct:family.pct});
  } else {
    if (leaderRow) entries.push(leaderRow);
    if (family) entries.push({key:"self",name:escapeHtml(family.label),detail:escapeHtml(family.detail),pct:family.pct});
  }
  const selfCount = entries.length;
  barHolders.forEach((holder,index) => {
    const asOf = cvDate(holder.asOf);
    entries.push({key:String(index + 1),name:escapeHtml(holder.name),detail:[escapeHtml(companyHolderTypes[holder.type] || "Holder"),asOf ? "as of " + asOf : ""].filter(Boolean).join(" · "),pct:holder.pctEconomic});
  });
  // With no named holders the remainder is everyone else; otherwise it sits inside an "Everyone else" group.
  const restName = selfCount && !barHolders.length ? "Everyone else" : "All other shareholders";
  if (rest !== null) entries.push({key:"rest",name:restName,detail:"100% minus the holdings listed",pct:rest});
  const row = entry => `<li><i class="cv-key cv-c-${entry.key}" aria-hidden="true"></i><span class="cv-holder-name"><strong>${entry.name}</strong><small>${entry.detail}</small></span><span class="cv-holder-pct">${cvPercent(entry.pct,2)}</span></li>`;
  // Rows that are listed but not drawn: the leader inside a family total, and class-basis holders.
  const unbarred = (title, detail, pct, basis = "") => `<li class="cv-unbarred"><i class="cv-key cv-key-none" aria-hidden="true"></i><span class="cv-holder-name"><strong>${title}</strong><small>${detail}</small></span><span class="cv-holder-pct">${pct}${basis ? `<small>${basis}</small>` : ""}</span></li>`;
  const includedRow = family?.includesLeader && leaderRow ? unbarred(leaderRow.name,`${leaderRow.detail} · included in the ${escapeHtml(family.label)} total`,cvPercent(leaderRow.pct,2)) : "";
  const classRows = classHolders.map(holder => {
    const asOf = cvDate(holder.asOf);
    return unbarred(escapeHtml(holder.name),[escapeHtml(companyHolderTypes[holder.type] || "Holder"),asOf ? "as of " + asOf : ""].filter(Boolean).join(" · "),cvPercent(holder.pctEconomic,2),`(% of ${escapeHtml(classOf(holder))})`);
  }).join("");
  const grouped = selfCount && (barHolders.length || classHolders.length);
  const list = grouped
    ? entries.slice(0,selfCount).map(row).join("") + includedRow
      + (barHolders.length ? `<li class="cv-group"><span>Everyone else</span><span>${cvPercent(othersPct)}</span></li>` + entries.slice(selfCount).map(row).join("") : entries.slice(selfCount).map(row).join(""))
      + (classRows ? `<li class="cv-group cv-group-sub"><span>Within everyone else: largest holders of one class</span></li>` + classRows : "")
    : entries.map(row).join("") + includedRow + classRows;
  const bar = rest !== null && entries.length ? `<div class="cv-bar" aria-hidden="true">${entries.map(entry => `<span class="cv-c-${entry.key}" style="flex-grow:${entry.pct.toFixed(3)}" title="${entry.name.replace(/<[^>]*>/g,"")}: ${cvPercent(entry.pct,2)}"></span>`).join("")}</div>` : "";

  const structure = ownership.structure && typeof ownership.structure === "object" ? ownership.structure : null;
  const structureParts = [];
  if (structure?.dualClass === true) structureParts.push("Dual-class shares");
  if (structure?.dualClass === false) structureParts.push("One share class");
  if (showPerson && cvNumber(person.pctVoting)) structureParts.push(`${name} holds ${decimal.format(person.pctVoting)}% of votes`);
  if (structure?.controlled === true) structureParts.push("Controlled company: one holder has a majority of votes");
  if (structure?.controlled === false) structureParts.push("No holder has a majority of votes");

  const method = [
    self?.derived ? `<p><strong>Derived stake.</strong> ${escapeHtml(self.derived)}</p>` : "",
    family?.includesLeader ? `<p>The ${escapeHtml(family.label)} total already includes ${cvPossessive(name)} own stake, so the two are never added together.</p>` : "",
    rest !== null ? "<p>“All other shareholders” is 100% minus the holdings listed. Percentages are of all shares outstanding, as each filing states them.</p>" : "",
    classHolders.length ? "<p>Holdings marked “% of Class A” (or another class) are a share of that class only. They are listed, but not drawn in the bar or subtracted from “everyone else”.</p>" : ""
  ].join("");
  return {
    sources,proof,
    html:`${cvPanelHead(`Who owns ${company}?`,["Share of all shares outstanding",asOfOwnership ? "as of " + asOfOwnership : ""].filter(Boolean).join(" · "))}
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
  const fy = cvFy(record);
  return {
    sources:[...(dividends?.sources || []),...(buybacks?.sources || [])],
    proof:[dividends && cvProof("Cash dividends",money(dividends.value),fy,"record",dividends.sources),buybacks && cvProof("Stock buybacks",money(buybacks.value),fy,"record",buybacks.sources)].filter(Boolean),
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
  const fy = cvFy(record);
  return {
    sources:[...(stock?.sources || []),planShown?.source],
    proof:[stock && cvProof("Stock-based compensation expense",cvMoney(stock.value,record.currency),fy,"record",stock.sources),planShown && cvProof("Employee share plan",planShown.text,fy,"record",[planShown.source])].filter(Boolean),
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
    proof:[cvProof(`Revenue by geography (${segments.length} segments)`,money(geography.total) + " total",cvFy(record),"record",[source],segments.map(segment => `${segment.name}: ${money(segment.value)}`).join(" · "))],
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

// Ecosystem (platforms only): the volume that flows through the platform next to what the platform keeps.
// Never calls the rest "partner earnings"; payouts appear only when the filing reports them.
// - The "kept X%" bar and the per-dollar line need a measure and revenue on comparable bases
//   (ratioComparable !== false); otherwise the two are separate stats with the file's ratioNote.
// - Client assets are a balance and are never compared with revenue.
// - With no filed measure and a company-commissioned tier (or nothing but studies), the studies lead.
// - Evidence: the measure carries the file's tier; revenue, payouts, client assets and the other filed
//   metrics come from filings; studies are always "Company-commissioned".
function cvEcosystem(record, leader) {
  const ecosystem = record.ecosystem;
  if (cvHidden(ecosystem) || typeof ecosystem !== "object") return null;
  const period = cvPeriod(record,ecosystem);
  const currency = period.currency || record.currency;
  const money = value => cvMoney(value,currency);
  const company = escapeHtml(leader.company);
  const tier = ecosystem.tier === "company-commissioned" ? "company-commissioned" : "filing";
  const fy = cvFy(period);
  const measure = ecosystem.measure && ecosystem.measure.name ? cvFigure(ecosystem.measure) : null;
  const measureName = measure ? escapeHtml(ecosystem.measure.name) : "";
  const definitionSource = measure && ecosystem.measure.definition ? cvSource(ecosystem.measure.definition.source) : null;
  const definition = definitionSource && ecosystem.measure.definition.quote ? String(ecosystem.measure.definition.quote) : "";
  const revenue = cvFigure(ecosystem.platformRevenue);
  const payouts = cvFigure(ecosystem.payouts);
  const assets = cvFigure(ecosystem.clientAssets);
  const assetsAsOf = cvDate(ecosystem.clientAssets?.asOf);
  // A second volume the company reports (e.g. MercadoLibre's payment volume). It overlaps the measure.
  const secondary = ecosystem.secondaryMeasure && ecosystem.secondaryMeasure.name ? cvFigure(ecosystem.secondaryMeasure) : null;
  const secondaryRevenue = secondary ? cvFigure(ecosystem.secondaryMeasure.relatedRevenue) : null;
  // Amazon's third-party unit share: a percentage of units for one quarter, not dollars.
  const unitShare = ecosystem.thirdPartyUnitShare && ecosystem.thirdPartyUnitShare.value <= 100 ? cvFigure(ecosystem.thirdPartyUnitShare) : null;
  const studies = (Array.isArray(ecosystem.studies) ? ecosystem.studies : [])
    .filter(study => study && !cvHidden(study) && study.title && study.claim && study.commissionedBy && cvSource(study.source)).slice(0,2);
  // Platform revenue alone says nothing about the ecosystem, so it never makes a tab by itself.
  if (!measure && !payouts && !assets && !unitShare && !secondary && !studies.length) return null;

  const sources = [], proof = [];
  const comparable = ecosystem.ratioComparable !== false;
  const flows = comparable && measure && revenue && measure.value > 0 && revenue.value > 0 && revenue.value <= measure.value;
  let headline = "";
  if (flows) {
    const kept = 100 * revenue.value / measure.value;
    const perDollar = measure.value / revenue.value;
    const keptText = cvPercent(kept,kept < 1 ? 2 : 1);
    const restText = cvPercent(100 - kept,kept < 1 ? 2 : 1);
    headline = `<p class="cv-headline">${company} kept <strong>${keptText}</strong> of the ${measureName} that flowed through it.</p>
      <div class="cv-bar cv-flow" aria-hidden="true"><span class="cv-c-self" style="flex-grow:${kept.toFixed(3)}"></span><span class="cv-c-rest" style="flex-grow:${(100 - kept).toFixed(3)}"></span></div>
      <ul class="cv-holders cv-flow-legend" aria-label="${measureName} split">
        <li><i class="cv-key cv-c-self" aria-hidden="true"></i><span class="cv-holder-name"><strong>Kept by ${company}</strong><small>${escapeHtml(revenue.label || "Revenue")} · ${money(revenue.value)}</small></span><span class="cv-holder-pct">${keptText}</span></li>
        <li><i class="cv-key cv-c-rest" aria-hidden="true"></i><span class="cv-holder-name"><strong>The rest of the ${measureName}</strong><small>${money(measure.value - revenue.value)} · the value of the transactions themselves, not anyone’s earnings</small></span><span class="cv-holder-pct">${restText}</span></li>
      </ul>
      <p class="cv-per-dollar">For every ${cvUnitMoney(1,currency,0)} ${company} earned, ${cvUnitMoney(perDollar,currency,perDollar >= 10 ? 0 : 2)} flowed through its platform.</p>`;
  }
  const caveat = !comparable && ecosystem.ratioNote ? `<p class="cv-caveat">${escapeHtml(String(ecosystem.ratioNote))}</p>` : "";
  const stat = (value, label, note, figureTier) => `<div><strong>${value}</strong><span>${label}</span>${note ? `<span>${note}</span>` : ""}${cvTag(figureTier)}</div>`;
  const stats = [];
  if (measure) {
    stats.push(stat(money(measure.value),measureName,"",tier));
    sources.push(...measure.sources);
    proof.push(cvProof(ecosystem.measure.name,money(measure.value),fy,tier,measure.sources));
    if (definition) {
      sources.push(definitionSource);
      proof.push(cvProof(`How ${leader.company} defines ${ecosystem.measure.name}`,"Definition",fy,tier,[{...definitionSource,quote:definition}]));
    }
  }
  if (revenue) {
    stats.push(stat(money(revenue.value),escapeHtml(revenue.label || "Platform revenue"),"","filing"));
    sources.push(...revenue.sources);
    proof.push(cvProof(revenue.label || "Platform revenue",money(revenue.value),fy,"filing",revenue.sources));
  }
  if (payouts) {
    stats.push(stat(money(payouts.value),"Paid to partners",escapeHtml(payouts.label),"filing"));
    sources.push(...payouts.sources);
    proof.push(cvProof(`Paid to partners: ${payouts.label}`,money(payouts.value),fy,"filing",payouts.sources));
  }
  if (unitShare) {
    const quarter = ecosystem.thirdPartyUnitShare.period ? String(ecosystem.thirdPartyUnitShare.period) : "";
    stats.push(stat(cvPercent(unitShare.value,0),"of paid units sold by third-party sellers",[quarter,"units, not dollars"].filter(Boolean).map(escapeHtml).join(" · "),"company"));
    sources.push(...unitShare.sources);
    proof.push(cvProof(unitShare.label || "Third-party unit share",cvPercent(unitShare.value,0),quarter,"company",unitShare.sources,"A share of units, not dollars, for one quarter."));
  }
  let secondaryBlock = "";
  if (secondary) {
    const name = escapeHtml(ecosystem.secondaryMeasure.name);
    sources.push(...secondary.sources,...(secondaryRevenue?.sources || []));
    proof.push(cvProof(ecosystem.secondaryMeasure.name,money(secondary.value),fy,"filing",secondary.sources,measure ? `Overlaps ${ecosystem.measure.name}; never added to it.` : ""));
    if (secondaryRevenue) proof.push(cvProof(secondaryRevenue.label || "Related revenue",money(secondaryRevenue.value),fy,"filing",secondaryRevenue.sources));
    secondaryBlock = `<div class="cv-secondary"><p class="cv-secondary-title">Also reported${measure ? `, overlapping ${measureName}` : ""}</p>
      <div class="cv-totals">${stat(money(secondary.value),name,measure ? `Overlaps ${measureName}; never added to it` : "","filing")}${secondaryRevenue ? stat(money(secondaryRevenue.value),escapeHtml(secondaryRevenue.label || "Related revenue"),"","filing") : ""}</div></div>`;
  }
  const assetStat = assets ? `<div class="cv-balance"><div><strong>${money(assets.value)}</strong><span>held for clients${assetsAsOf ? ", as of " + assetsAsOf : ""}</span><span>${escapeHtml(assets.label)}. A balance, not a yearly flow: shown on its own and never compared with revenue.</span>${cvTag("filing")}</div></div>` : "";
  if (assets) {
    sources.push(...assets.sources);
    proof.push(cvProof(`Held for clients: ${assets.label}`,money(assets.value),assetsAsOf ? "as of " + assetsAsOf : fy,"filing",assets.sources,"A balance at one date, not a flow."));
  }
  const studyBlock = studies.length ? `<div class="cv-studies">${studies.map(study => {
    const source = cvSource(study.source);
    sources.push(source);
    // A study's figure is in its own currency, which can differ from the file's (Spotify: EUR file, USD study).
    // Claims that aren't in billions have value null: the claim text stands on its own.
    const value = cvNumber(study.value) && /^[A-Z]{3}$/.test(study.currency || "") && (!study.unit || study.unit === "billions") ? cvMoney(study.value,String(study.currency)) : "";
    proof.push(cvProof(study.title,value || "Claim",study.year ? String(study.year) : "","company-commissioned",[{...source,quote:source.quote || String(study.claim)}],`Commissioned by: ${study.commissionedBy}. Published by: ${study.publisher || "not stated"}. Claim: “${study.claim}”`));
    return `<article class="cv-study">
        <p class="cv-study-tag"><span class="cv-tier is-commissioned">${/self-published/i.test(study.commissionedBy || "") ? "Company-published report" : "Company-commissioned study"}</span></p>
        <h5>${escapeHtml(study.title)}</h5>
        <p class="cv-study-meta">${[study.publisher ? "By " + escapeHtml(study.publisher) : "","Commissioned by: " + escapeHtml(study.commissionedBy),study.year ? escapeHtml(String(study.year)) : ""].filter(Boolean).join(" · ")}</p>
        ${value ? `<p class="cv-study-value"><strong>${value}</strong></p>` : ""}
        <blockquote>${escapeHtml(study.claim)}</blockquote>
        <p class="cv-study-link">${cvLink(source)}</p>
      </article>`;
  }).join("")}</div>` : "";
  const leadStudies = studies.length && !measure && (tier === "company-commissioned" || (!revenue && !payouts && !assets && !unitShare));
  const title = measure ? `How much flowed through ${company}?`
    : assets && !payouts ? `What does ${company} hold for its clients?`
    : payouts ? `What did ${company} pay its partners?`
    : leadStudies ? `What do studies of ${cvPossessive(company)} ecosystem say?`
    : `${cvPossessive(company)} platform`;
  const statsBlock = stats.length ? `<div class="cv-totals">${stats.join("")}</div>` : "";
  return {
    sources,proof,
    html:`${cvPanelHead(title,cvYearLine(period))}
      ${leadStudies ? studyBlock : ""}
      ${headline}
      ${statsBlock}
      ${caveat}
      ${definition ? `<p class="cv-definition"><strong>How ${company} defines ${measureName}:</strong> “${escapeHtml(definition)}”</p>` : ""}
      ${secondaryBlock}
      ${assetStat}
      ${leadStudies ? "" : studyBlock}
      ${measure ? `<p class="distribution-note">Market value counts only what owners keep. ${measureName} is the value of the sales or payments on the platform, as ${company} reports it; it overlaps with other companies’ figures and is never added to them.</p>` : ""}`
  };
}

function cvFiscal(record, leader) {
  const taxes = record.taxes && typeof record.taxes === "object" ? cvFigure(record.taxes.cashTaxesPaid,{negative:true}) : null;
  const rnd = record.rnd && typeof record.rnd === "object" ? cvFigure(record.rnd.expense) : null;
  if (!taxes && !rnd) return null;
  const period = cvPeriod(record,taxes ? record.taxes : record.rnd);
  const currency = period.currency || record.currency;
  const fy = cvFy(period);
  const company = escapeHtml(leader.company);
  const notes = String((record.taxes && record.taxes.notes) || (record.rnd && record.rnd.notes) || "");
  const title = taxes && rnd ? `What did ${company} pay in taxes and spend on research?` : taxes ? `What did ${company} pay in income taxes?` : `What did ${company} spend on research?`;
  const stats = [
    taxes && `<div><strong>${cvMoney(taxes.value,currency)}</strong><span>Cash income taxes paid</span><span>${escapeHtml(period.fiscalYear || "")} · in ${escapeHtml(currency)}</span></div>`,
    rnd && `<div><strong>${cvMoney(rnd.value,currency)}</strong><span>Research and development expense</span><span>${escapeHtml(period.fiscalYear || "")} · in ${escapeHtml(currency)}</span></div>`
  ].filter(Boolean);
  return {
    sources:[...(taxes?.sources || []),...(rnd?.sources || [])],
    // The fiscal file's notes are the researcher's account of how each figure was read: they belong
    // in "How we got these numbers", not in the tab.
    proof:[taxes && cvProof("Cash income taxes paid",cvMoney(taxes.value,currency),fy,"record",taxes.sources,notes),rnd && cvProof("Research and development expense",cvMoney(rnd.value,currency),fy,"record",rnd.sources,taxes ? "" : notes)].filter(Boolean),
    html:`${cvPanelHead(title,cvYearLine(period))}
      <div class="cv-totals">${stats.join("")}</div>
      <p class="distribution-note">${taxes ? "Income taxes the company paid in cash during the year, as its cash-flow statement or notes report them." : ""}${taxes && rnd ? " " : ""}${rnd ? "Research and development is the reported expense, not a measure of what the research is worth." : ""}</p>`
  };
}

// The ranking's own figures (dist/data.js). They are not filings: market value is market data, the
// employment count comes from the linked source, and pay is our estimate.
function cvRankingProof(leader) {
  const jobsTier = /sec\.gov/.test(leader.jobsUrl || "") ? "record" : "market";
  const link = (url, label) => url && /^https:\/\//.test(url) ? [{url,label,quote:""}] : [];
  return [
    cvProof(metrics.cap,compactMoney(leader.cap),"Year-end 2024","market",link(leader.capUrl,"CompaniesMarketCap"),"Market capitalization: shares outstanding × share price at year-end 2024. A snapshot of what owners hold."),
    cvProof(metrics.jobs,integer.format(leader.jobs),leader.fy,jobsTier,link(leader.jobsUrl,"Employment source"),"Direct employees worldwide, as reported."),
    cvProof(metrics.payroll,compactMoney(leader.payroll),leader.fy,"estimate",[],`${integer.format(leader.jobs)} people × ${dollars.format(leader.wage)} assumed yearly pay per person. An estimate, not a reported figure.`)
  ];
}
const cvPanels = {ownership:cvOwnership,cash:cvCash,workers:cvWorkers,geography:cvGeography,ecosystem:cvEcosystem,fiscal:cvFiscal};
function cvProvenance(groups) {
  const item = entry => `<li class="cv-proof">
      <div class="cv-proof-head"><strong>${escapeHtml(entry.label)}</strong><span class="cv-proof-value">${escapeHtml(entry.value)}</span></div>
      <p class="cv-proof-meta">${[entry.when ? escapeHtml(entry.when) : "",cvTag(entry.tier)].filter(Boolean).join(" · ")}</p>
      ${entry.note ? `<p class="cv-proof-note">${escapeHtml(entry.note)}</p>` : ""}
      ${entry.sources.map(source => `${source.quote ? `<blockquote>${escapeHtml(source.quote)}</blockquote>` : ""}<p class="cv-proof-source">${cvLink(source)}</p>`).join("")}
    </li>`;
  return `<details class="cv-provenance">
      <summary>How we got these numbers</summary>
      <p class="cv-proof-intro">Every figure in this profile, with its date, its evidence and the line it came from. <a href="/methodology">Methodology</a></p>
      ${groups.filter(group => group.proof.length).map(group => `<h4>${escapeHtml(group.label)}</h4><ol class="cv-proof-list">${group.proof.map(item).join("")}</ol>`).join("")}
    </details>`;
}

function cvRender(record, leader) {
  const lensOnly = leader.id === "jeff-bezos";
  const allowed = lensOnly ? companyLensViews : companyValueViews.map(([key]) => key);
  const views = record ? companyValueViews.filter(([key]) => allowed.includes(key)).map(([key,label]) => ({key,label,panel:cvPanels[key](record,leader)})).filter(view => view.panel) : [];
  const provenance = cvProvenance([{label:"The ranking",proof:cvRankingProof(leader)},...views.map(view => ({label:view.label,proof:view.panel.proof || []}))]);
  if (!views.length) return `<div class="cv-provenance-only">${provenance}</div>`;
  const company = escapeHtml(leader.company);
  return `
      <header class="distribution-heading">
        <p class="eyebrow">${lensOnly ? `${escapeHtml(leader.company.toUpperCase())} · MORE LENSES` : escapeHtml(leader.company.toUpperCase())}</p>
        <h3 id="company-value-title">${lensOnly ? (views.length > 1 ? "Platform and taxes" : views[0].key === "ecosystem" ? "Platform" : "Taxes") : "Who shares in the value?"}</h3>
        ${lensOnly ? `<p>More ways to see the value ${company} created, each on its own.</p>` : ""}
      </header>
      <div class="distribution-tabs${views.length > 4 ? " cv-tabs-many" : ""}" role="tablist" aria-label="Explore ${escapeHtml(cvPossessive(leader.company))} value">
        ${views.map((view,index) => `<button id="cv-tab-${view.key}" type="button" role="tab" aria-controls="cv-${view.key}" aria-selected="${index === 0}" tabindex="${index === 0 ? "0" : "-1"}">${escapeHtml(view.label)}</button>`).join("")}
      </div>
      ${views.map((view,index) => `<div id="cv-${view.key}" class="distribution-panel" role="tabpanel" aria-labelledby="cv-tab-${view.key}" tabindex="0"${index ? " hidden" : ""}>
        ${view.panel.html}
        ${cvSourcesRow(view.panel.sources)}
      </div>`).join("")}
      ${provenance}`;
}

// companies.json lists the published ids (written by the build next to dist/companies/), so leaders
// without a file never trigger a 404 in the console. If the list itself is missing, fall back to
// asking for the file directly; a 404 or network error then leaves only the provenance block.
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

// Fills the slot. Resolves true when it shows tabs, "provenance" when it shows only the provenance
// block, and false when nothing could be shown.
async function bindCompanyValue(root, leader) {
  if (!root) return false;
  const record = await cvLoad(leader.id);
  // The profile may have moved on to another leader while the record loaded.
  if (!root.isConnected || root.dataset.leader !== leader.id) return false;
  let html = "";
  try {
    html = cvRender(record && typeof record === "object" && record.id === leader.id ? record : null,leader);
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
  if (!tabs.length) {
    root.classList.add("is-provenance-only");
    root.removeAttribute("aria-labelledby");
    root.setAttribute("aria-label","How we got these numbers");
    return "provenance";
  }
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

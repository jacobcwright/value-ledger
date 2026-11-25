// "Who shares in the value?" in every profile, plus "How we got these numbers".
// Data: dist/companies/<leader-id>.json, written by scripts/build-companies.mjs from research/records and
// research/lenses (see research/SCHEMA.md and research/LENSES.md). Values are billions of the stated currency.
// Each lens is shown on its own and never added to another or to market value. Paid out is the one lens
// that adds figures together, and only its own parts (revenue − operating cash flow + capex, then sales
// enabled for marketplaces); pay to workers is inside it and never added to it.
// Amazon keeps its bespoke case study; its file carries only the added lenses (ecosystem, taxes, R&D),
// which mount as a small standalone section after the case study.
// Defensive by design: every figure is shown only when it has a number and an https source, and never
// when it is not-sourced. A leader with no publishable file still gets the provenance block for the
// ranking's own figures (market value, people employed, pay to workers).
const companyValueRecords = new Map();
// The mirror/aggregator list and allowed host types (same as scripts/validate-records.mjs) live in
// ownership-headline.js, which loads first: never link a researched figure to a mirror.
// [key, section label, short chip label]. Every lens is its own section of the profile, in this order,
// with a chip in the profile's section row.
const companyValueViews = [
  ["ownership","Who owns it","Who owns it"],
  ["paidout","Paid out","Paid out"],
  ["workers","Workers","Workers"],
  ["cash","Cash to shareholders","Cash"],
  ["ecosystem","Ecosystem","Ecosystem"],
  ["fiscal","Taxes & R&D","Taxes & R&D"],
  ["geography","Where sales come from","Sales"]
];
// Amazon's own case study already covers ownership, workers, cash and sales by market.
const companyLensViews = ["paidout","ecosystem","fiscal"];
const companyHolderTypes = {"asset-manager":"Asset manager","index-fund":"Index fund",pension:"Pension",sovereign:"Sovereign fund",government:"Government",family:"Family",company:"Company",employees:"Employees",other:"Other"};
const companyRelations = {founder:"Founder","co-founder":"Co-founder","founding-family":"Founding family",estate:"Estate",ceo:"CEO","former-ceo":"Former CEO",chair:"Chair",executive:"Executive",investor:"Investor"};
// Evidence tiers, as named on the methodology page.
const cvTiers = {filing:"From the 10-K/annual report","company-commissioned":"Company-commissioned",derived:"Derived from filings",market:"Market data",estimate:"Our estimate",record:"Filing",company:"Company-reported","company-published":"Company-published",regulator:"Regulator data","third-party":"Third-party estimate"};

function companyValueSlot(leader) {
  return `<section id="company-value" class="distribution company-value${leader.id === "jeff-bezos" ? " company-lenses" : ""}" aria-labelledby="company-value-title" data-leader="${escapeHtml(leader.id)}" hidden></section>`;
}

const cvNumber = value => typeof value === "number" && Number.isFinite(value);
const cvHidden = item => !item || item.status === "not-sourced";
// A source is publishable when it is an https document link with a label, on an allowed host type
// (when the record states one) and not a known mirror. One rule, in ownership-headline.js.
const cvSource = ownershipSource;
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
  // The stakes, "everyone else" and the leader's status come from ownership-headline.js, which the build
  // also runs to write dist/headline.json, so the profile's top figures always match this section.
  const stakes = ownershipHeadline(record);
  const {person,showPerson,self,family,holders,barHolders,classHolders} = stakes;
  const name = escapeHtml(person.name || leader.name);
  const company = escapeHtml(leader.company);
  const asOfOwnership = cvDate(ownership.asOf);
  const sources = [], proof = [];
  if (self) {
    sources.push(...self.sources);
    proof.push(self.derived
      ? cvProof(`${person.name}’s stake`,cvPercent(self.pct,2),asOfOwnership,"derived",self.sources,self.derived)
      : cvProof(`${person.name}’s stake`,cvPercent(self.pct,2),asOfOwnership,"record",self.sources));
  }
  if (family) {
    sources.push(family.source);
    proof.push(cvProof(family.full,cvPercent(family.pct,2),asOfOwnership,"record",[family.source]));
  }
  const classOf = holder => holder.classLabel ? String(holder.classLabel) : "one class";
  // Who stands behind "everyone else" (research/lenses/owners): which named holders are index funds and asset
  // managers (and who they invest for), and two public funds, Norway's NBIM and CalPERS, which file separately
  // from the managers. A fund already named in the filing's holder list is not added a second time.
  const owners = record.owners && typeof record.owners === "object" ? record.owners : {};
  const managerFor = holder => {
    const manager = owners.managers && typeof owners.managers === "object" ? owners.managers[holder.name] : null;
    const source = manager && manager.investsFor ? cvSource(manager.source) : null;
    return source ? {name:String(manager.name || holder.name),investsFor:String(manager.investsFor),source} : null;
  };
  // Only holders actually listed count: a fund named further down the filing's list isn't shown, so it is added here.
  const named = pattern => [...barHolders,...classHolders].some(holder => pattern.test(holder.name));
  const nbimSource = owners.nbim && cvNumber(owners.nbim.pct) && owners.nbim.pct > 0 ? cvSource(owners.nbim.source) : null;
  const nbim = nbimSource && !named(/norges bank|government of norway|government pension fund|\bnbim\b/i) ? {pct:owners.nbim.pct,asOf:owners.nbim.asOf,source:nbimSource} : null;
  const calpersData = owners.calpers && cvNumber(owners.calpers.pct) && owners.calpers.pct > 0 ? owners.calpers : null;
  const calpersSources = calpersData ? [cvSource(calpersData.source),...(Array.isArray(calpersData.inputs) ? calpersData.inputs : []).map(cvSource)] : [];
  const calpers = calpersData && calpersSources.length > 1 && calpersSources.every(Boolean) && !named(/calpers|california public employees/i)
    ? {pct:calpersData.pct,shares:calpersData.shares,asOf:calpersData.asOf,method:String(calpersData.method || ""),classLabel:calpersData.basis === "class" ? String(calpersData.classLabel || "one class") : "",sources:calpersSources}
    : null;
  const recordHolders = owners.holdersOfRecord && Number.isInteger(owners.holdersOfRecord.count) && cvSource(owners.holdersOfRecord.source) ? {...owners.holdersOfRecord,source:cvSource(owners.holdersOfRecord.source)} : null;
  for (const holder of [...barHolders,...classHolders]) {
    const source = cvSource(holder.source);
    sources.push(source);
    proof.push(cvProof(holder.name + (holder.basis === "class" ? ` (% of ${classOf(holder)})` : ""),cvPercent(holder.pctEconomic,2),cvDate(holder.asOf) || asOfOwnership,"record",[source]));
    const manager = managerFor(holder);
    if (manager) {
      sources.push(manager.source);
      proof.push(cvProof(`Who ${manager.name} invests for`,manager.investsFor,"","company",[manager.source],`Matched to the filing’s holder “${holder.name}”.`));
    }
  }
  if (!self && !family && !holders.length) return null;

  // A family or promoter-group total that already includes the leader is never added to the leader's own stake.
  const selfPct = family?.includesLeader ? family.pct : (self?.pct || 0) + (family?.pct || 0);
  const listedNamed = selfPct + barHolders.reduce((sum,holder) => sum + holder.pctEconomic,0);
  // The pension and sovereign group joins the bar only when every listed segment still fits within 100%;
  // otherwise it stays in the list, undrawn. CalPERS's class-basis stake (Berkshire: % of Class B) is never drawn.
  const pensionPct = (nbim?.pct || 0) + (calpers && !calpers.classLabel ? calpers.pct : 0);
  const pensionInBar = pensionPct > 0 && listedNamed <= 100.5 && listedNamed + pensionPct <= 100;
  const listed = listedNamed + (pensionInBar ? pensionPct : 0);
  const rest = listed <= 100.5 ? Math.max(0,100 - listed) : null;
  if (nbim) {
    sources.push(nbim.source);
    proof.push(cvProof("Norway’s Government Pension Fund Global (NBIM)",cvPercent(nbim.pct,2),cvDate(nbim.asOf),"company",[nbim.source],"Norway’s sovereign wealth fund. The ownership percentage as NBIM’s own holdings list publishes it. A separate legal holder from the asset managers listed; minor overlap is possible where an external manager runs part of a fund’s money."));
  }
  if (calpers) {
    sources.push(...calpers.sources);
    proof.push(cvProof(`CalPERS${calpers.classLabel ? ` (% of ${calpers.classLabel})` : ""}`,cvPercent(calpers.pct,2),cvDate(calpers.asOf),"derived",calpers.sources,
      [`${integer.format(calpers.shares)} shares in its Form 13F.`,calpers.method ? calpers.method + "." : "",calpers.classLabel ? `A share of ${calpers.classLabel} only, so it is listed but not drawn in the bar.` : "","A separate legal holder from the asset managers listed; minor overlap is possible where an external manager runs part of CalPERS’s money."].filter(Boolean).join(" ")));
  }
  if (recordHolders) {
    sources.push(recordHolders.source);
    proof.push(cvProof("Holders of record",integer.format(recordHolders.count),cvDate(recordHolders.asOf),"record",[recordHolders.source],"Counts registered holders. Shares held through a brokerage or fund are usually registered in a nominee’s name, so one record can stand for many owners."));
  }
  // Rounded from the displayed stake, so the two headline figures always sum to 100.0% (ownership-headline.js).
  const othersPct = stakes.othersPct;
  const derivedTag = self?.derived ? ` <span class="cv-derived" title="${escapeHtml(self.derived)}">derived</span>` : "";

  // Plain statement of the leader's position when no percentage can be shown for them.
  let status = "";
  // A stake that counts shares the person doesn't own outright (options, proxy votes, deemed interests) carries its caveat beside the headline.
  if (self && person.caveat) status = String(person.caveat);
  if (showPerson && !self) {
    status = {
      deceased:`${name} is deceased; no personal stake is reported.`,
      "no-reported-stake":`${name}: no reported stake.`,
      under1:`${name} holds less than 1%.`,
      shares:`${name} holds ${integer.format(person.shares)} shares; no percentage is disclosed.`,
      "not-disclosed":`${name}: stake not disclosed.`
    }[stakes.leaderStatus] || "";
    if (stakes.statusSource) {
      sources.push(stakes.statusSource);
      proof.push(cvProof(`${person.name}’s stake`,stakes.leaderStatus === "under1" ? "Less than 1%" : integer.format(person.shares) + " shares",asOfOwnership,"record",[stakes.statusSource]));
    }
  }

  // The blue swatch marks the remainder, so it sits beside "Everyone else" only when that is the remainder.
  const othersLine = `<span class="cv-headline-rest">${barHolders.length || pensionInBar ? "" : '<i class="cv-key cv-c-rest" aria-hidden="true"></i>'}Everyone else: <strong>${cvPercent(othersPct)}</strong></span>`;
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

  // Bar and legend share one list of entries; colour follows the entity: the leader and family in --share-self,
  // named holders in --share-1/2 (alternating), the pension and sovereign group in --share-3, the rest in blue.
  const entries = [];
  const leaderRow = self ? {key:"self",name,detail:escapeHtml(companyRelations[person.relation] || "Leader") + (self.derived ? " · derived" : ""),pct:self.pct} : null;
  if (family?.includesLeader) {
    entries.push({key:"self",name:escapeHtml(family.label),detail:escapeHtml(family.detail),pct:family.pct});
  } else {
    if (leaderRow) entries.push(leaderRow);
    if (family) entries.push({key:"self",name:escapeHtml(family.label),detail:escapeHtml(family.detail),pct:family.pct});
  }
  const selfCount = entries.length;
  const holderDetail = holder => [escapeHtml(companyHolderTypes[holder.type] || "Holder"),cvDate(holder.asOf) ? "as of " + cvDate(holder.asOf) : ""].filter(Boolean).join(" · ");
  const managerLine = manager => `Invests for ${cvLink(manager.source,manager.investsFor)}`;
  // Managers first, then the other named holders, so the bar reads in the same order as the list.
  const barManagers = barHolders.filter(managerFor), barOthers = barHolders.filter(holder => !managerFor(holder));
  const namedEntries = [...barManagers,...barOthers].map((holder,index) => {
    const manager = managerFor(holder);
    return {key:String(index % 2 + 1),name:escapeHtml(holder.name),detail:holderDetail(holder) + (manager ? `<span class="cv-invests">${managerLine(manager)}</span>` : ""),pct:holder.pctEconomic,manager:Boolean(manager)};
  });
  const pensionEntry = pensionInBar ? {key:"3",name:"Pensions &amp; sovereign funds",pct:pensionPct} : null;
  // With no named holders the remainder is everyone else; otherwise it sits inside an "Everyone else" group.
  const restName = selfCount && !barHolders.length && !pensionInBar ? "Everyone else" : "All other shareholders";
  const restEntry = rest !== null ? {key:"rest",name:restName,detail:"100% minus the holdings listed",pct:rest} : null;
  const barEntries = [...entries,...namedEntries,...(pensionEntry ? [pensionEntry] : []),...(restEntry ? [restEntry] : [])];

  const row = entry => `<li><i class="cv-key cv-c-${entry.key}" aria-hidden="true"></i><span class="cv-holder-name"><strong>${entry.name}</strong><small>${entry.detail}</small></span><span class="cv-holder-pct">${cvPercent(entry.pct,2)}</span></li>`;
  // Rows that are listed but not drawn: the leader inside a family total, class-basis holders, and the
  // pension group when drawing it would take the listed segments past 100%.
  const unbarred = (title, detail, pct, basis = "", key = "none") => `<li class="cv-unbarred"><i class="cv-key ${key === "none" ? "cv-key-none" : `cv-c-${key}`}" aria-hidden="true"></i><span class="cv-holder-name"><strong>${title}</strong><small>${detail}</small></span><span class="cv-holder-pct">${pct}${basis ? `<small>${basis}</small>` : ""}</span></li>`;
  const includedRow = family?.includesLeader && leaderRow ? unbarred(leaderRow.name,`${leaderRow.detail} · included in the ${escapeHtml(family.label)} total`,cvPercent(leaderRow.pct,2)) : "";
  const classRow = holder => {
    const manager = managerFor(holder);
    return unbarred(escapeHtml(holder.name),holderDetail(holder) + (manager ? `<span class="cv-invests">${managerLine(manager)}</span>` : ""),cvPercent(holder.pctEconomic,2),`(% of ${escapeHtml(classOf(holder))})`);
  };
  const classManagers = classHolders.filter(managerFor), classOthers = classHolders.filter(holder => !managerFor(holder));
  const sub = (title, pct = "") => `<li class="cv-group cv-group-sub"><span>${title}</span>${pct ? `<span>${pct}</span>` : ""}</li>`;

  // Pensions and sovereign funds: each a row inside the group; the group is one segment in the bar.
  const pensionRows = [];
  if (nbim) pensionRows.push(`<li class="cv-pension"><i class="cv-key ${pensionInBar ? "cv-c-3" : "cv-key-none"}" aria-hidden="true"></i><span class="cv-holder-name"><strong>Norway’s Government Pension Fund Global</strong><small>Norway’s sovereign wealth fund · ${cvLink(nbim.source,"NBIM holdings list")}${cvDate(nbim.asOf) ? " · as of " + cvDate(nbim.asOf) : ""}</small></span><span class="cv-holder-pct">${cvPercent(nbim.pct,2)}</span></li>`);
  if (calpers) {
    const detail = `Pension fund for California public employees · ${integer.format(calpers.shares)} shares, ${cvLink(calpers.sources[0],"Form 13F")}${cvDate(calpers.asOf) ? " · as of " + cvDate(calpers.asOf) : ""}`;
    pensionRows.push(calpers.classLabel
      ? unbarred("CalPERS",detail,cvPercent(calpers.pct,2),`(% of ${escapeHtml(calpers.classLabel)})`)
      : `<li class="cv-pension"><i class="cv-key ${pensionInBar ? "cv-c-3" : "cv-key-none"}" aria-hidden="true"></i><span class="cv-holder-name"><strong>CalPERS</strong><small>${detail}</small></span><span class="cv-holder-pct">${cvPercent(calpers.pct,2)}</span></li>`);
  }
  const pensionNote = pensionPct > 0 && !pensionInBar ? `<li class="cv-note">Not drawn in the bar: with the holdings above, the listed segments would pass 100%.</li>` : "";

  // Holders of record, in the filing's own words. Registered counts miss owners who hold through a nominee.
  let restDetail = restEntry ? restEntry.detail : "";
  if (recordHolders) {
    const quote = String(recordHolders.source.quote || "");
    const terms = [[/shareowner accounts of record/i,"shareowner accounts of record"],[/shareholder accounts of record/i,"shareholder accounts of record"],[/record holders/i,"record holders"],
      [/holders of common stock of record/i,"holders of record"],[/(?:common\s+)?(stockholders|shareholders|holders) of record/i,match => match[1].toLowerCase() + " of record"],
      [/registered\s+(?:common\s+)?(shareholders|stockholders|holders)/i,match => "registered " + match[1].toLowerCase()]];
    let term = "";
    for (const [pattern,label] of terms) { const match = pattern.exec(quote); if (match) { term = typeof label === "function" ? label(match) : label; break; } }
    // The class the count covers, when the words right after the number name one ("16,800 record holders of its Class B common stock").
    const digits = String(recordHolders.count).split("").join("[,.\\s\\u00a0\\u202f]?");
    const at = new RegExp(`(?<![\\d,])${digits}(?![\\d])`).exec(quote);
    // Only the clause the count sits in: stop at the next sentence, bullet or number, and require "of/for … Class X".
    const after = at ? quote.slice(at.index + at[0].length).split(/[\d.•;]/)[0] : "";
    const shareClass = /\b(?:of|for)\b.*?\bclass\s+([a-z])\b/i.exec(after);
    const counted = `${integer.format(recordHolders.count)} ${term || "shareholders on the register"}${shareClass ? ` of Class ${shareClass[1].toUpperCase()}` : ""}${cvDate(recordHolders.asOf) ? ` (${cvDate(recordHolders.asOf)})` : ""}`;
    restDetail = `${cvLink(recordHolders.source,counted)}, plus everyone who owns shares through a brokerage, a fund or a pension.${term ? " Holders of record undercount owners: a broker’s clients can appear as a single record." : ""}`;
  }
  const restRow = restEntry ? row({...restEntry,detail:restDetail}).replace("<li>",'<li class="cv-rest">') : "";
  const groups = [
    barManagers.length || classManagers.length ? sub("Index funds &amp; asset managers") + namedEntries.filter(entry => entry.manager).map(row).join("") + classManagers.map(classRow).join("") : "",
    barOthers.length ? (barManagers.length || classManagers.length || pensionRows.length ? sub("Other large holders") : "") + namedEntries.filter(entry => !entry.manager).map(row).join("") : "",
    classOthers.length ? sub("Largest holders of one class") + classOthers.map(classRow).join("") : "",
    pensionRows.length ? sub("Pensions &amp; sovereign funds",pensionInBar ? cvPercent(pensionPct,2) : "") + pensionRows.join("") + pensionNote : "",
    restRow
  ].join("");
  const anyGroup = barHolders.length || classHolders.length || pensionRows.length;
  const list = entries.map(row).join("") + includedRow
    + (selfCount && anyGroup ? `<li class="cv-group"><span>Everyone else</span><span>${cvPercent(othersPct)}</span></li>` : "")
    + groups;
  const bar = rest !== null && barEntries.length ? `<div class="cv-bar" aria-hidden="true">${barEntries.map(entry => `<span class="cv-c-${entry.key}" style="flex-grow:${entry.pct.toFixed(3)}" title="${entry.name.replace(/<[^>]*>/g,"")}: ${cvPercent(entry.pct,2)}"></span>`).join("")}</div>` : "";

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
    rest !== null ? `<p>“All other shareholders” is 100% minus the holdings listed${pensionInBar ? ", including the pension and sovereign funds" : ""}. Percentages are of all shares outstanding, as each filing states them.</p>` : "",
    classHolders.length || calpers?.classLabel ? "<p>Holdings marked “% of Class A” (or another class) are a share of that class only. They are listed, but not drawn in the bar or subtracted from “everyone else”.</p>" : "",
    barManagers.length || classManagers.length ? "<p>Index funds and asset managers invest on behalf of others; who they invest for is in each firm’s own words, linked to its source.</p>" : "",
    nbim || calpers ? `<p>${[nbim ? "Norway’s Government Pension Fund Global (from NBIM’s year-end holdings list)" : "",calpers ? "CalPERS (its Form 13F shares ÷ shares outstanding)" : ""].filter(Boolean).join(" and ")} ${nbim && calpers ? "are separate legal holders" : "is a separate legal holder"} from the asset managers listed, so ${nbim && calpers ? "they are" : "it is"} listed on ${nbim && calpers ? "their" : "its"} own. Minor overlap is possible where an external manager runs part of a pension’s money.${pensionPct > 0 && !pensionInBar ? " Drawing the group would take the listed segments past 100%, so it is listed but not drawn." : ""}</p>` : "",
    recordHolders ? "<p>Holders of record count registered holders, in the filing’s own words. Shares held through a brokerage or fund are usually registered in a nominee’s name, so the count understates how many people own shares.</p>" : ""
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
        <div><strong>${finiteNumber(leader.payroll) ? compactMoney(leader.payroll) : "Not disclosed"}</strong><span>${metrics.payroll}${leader.payBasis === "median-pay" ? " (median pay × people employed)" : ""}</span></div>
      </div>
      ${planShown ? `<p class="cv-plan">${escapeHtml(planShown.text)}</p>` : ""}
      ${stock ? `<p class="distribution-note">Pay is ${leader.payBasis === "median-pay" ? "median pay × people employed" : "reported staff costs"}, in USD; stock pay is ${cvPossessive(escapeHtml(leader.company))} reported expense${record.currency === "USD" ? "" : " in " + escapeHtml(record.currency)}. The bases differ.</p>` : ""}`
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

// Paid out & sales enabled (research/PAIDOUT.md): what the company paid other people and businesses in one
// fiscal year, shown as its arithmetic. The build recomputes every total from these inputs and nulls any
// input whose source fails the gate (and everything computed from it), so a missing line means no total.
// This is the one lens that adds figures together, and only its own parts. Estimated pay is already inside
// it and is never added; neither is market value or any other lens.
const cvSectorWords = {bank:"a bank’s",broker:"a broker’s",insurer:"an insurer’s"};
const cvCap = text => text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
const cvAddBackLabels = {interestPaid:"Interest paid (outside operating cash flow)",taxesPaid:"Income taxes paid (outside operating cash flow)"};
// A sourced line: {value, sources:[{url,label,quote,part?,partValue?}]} with publishable sources only.
function cvLine(field) {
  if (!field || !cvNumber(field.value)) return null;
  const sources = (Array.isArray(field.sources) ? field.sources : []).map(source => {
    const clean = cvSource(source);
    return clean ? {...clean,part:source.part ? String(source.part) : "",partValue:cvNumber(source.partValue) ? source.partValue : null} : null;
  });
  if (!sources.length || sources.some(source => !source)) return null;
  return {value:field.value,sources};
}
function cvPaidout(record, leader) {
  const lens = record.paidout;
  if (!lens || typeof lens !== "object" || !lens.period) return null;
  const period = lens.period;
  const currency = period.currency || "USD";
  const money = value => cvMoney(value,currency);
  const usdMoney = value => cvNumber(value) ? compactMoney(value) : "";
  const native = currency !== "USD";
  const company = escapeHtml(leader.company);
  const fy = cvFy(period);
  const sources = [], proof = [];
  const fx = lens.fx && cvNumber(lens.fx.perUSD) ? {...lens.fx,source:cvSource(lens.fx.source)} : null;
  // One waterfall row. sign: "", "−", "+", "=". Each input links to its document; summed inputs list their parts.
  const row = (sign, label, value, line, kind = "") => {
    const links = line ? line.sources.map(source => cvLink(source,line.sources.length > 1 && source.part ? cvCap(source.part) : "Source")).join(" · ") : "";
    return `<li class="cv-po-row${kind ? " is-" + kind : ""}"><span class="cv-po-sign" aria-hidden="true">${sign}</span><span class="cv-po-label">${label}${links ? `<small>${links}</small>` : ""}</span><span class="cv-po-value">${sign === "−" ? '<span class="visually-hidden">minus </span>' : sign === "+" ? '<span class="visually-hidden">plus </span>' : ""}${value}</span></li>`;
  };
  const prove = (label, line, note = "") => {
    sources.push(...line.sources);
    const parts = line.sources.length > 1 ? line.sources.filter(source => source.part).map(source => `${cvCap(source.part)}: ${cvNumber(source.partValue) ? money(source.partValue) : ""}`).join(" · ") : "";
    proof.push(cvProof(label,money(line.value),fy,"record",line.sources,[parts ? "Sum of " + parts + "." : "",note].filter(Boolean).join(" ")));
  };

  // Banks and brokers: not comparable, so no paid-out total; operating costs and interest paid are shown apart.
  if (lens.comparable === false) {
    const alt = lens.alt || {};
    const lines = {noninterestExpense:cvLine(alt.noninterestExpense),depreciationAmortization:cvLine(alt.depreciationAmortization),stockComp:cvLine(alt.stockComp),taxesPaid:cvLine(alt.taxesPaid)};
    const interest = cvLine(lens.interestPaid);
    const complete = cvNumber(alt.value) && Object.values(lines).every(Boolean);
    if (!complete && !interest) return null;
    const whose = cvSectorWords[lens.sector] || "a financial company’s";
    const html = `${cvPanelHead(`What did ${company} pay out?`,cvYearLine(period))}
      <p class="cv-caveat cv-po-nc"><strong>Not comparable:</strong> ${whose} cash flows are mostly customers’ deposits and loans, so the paid-out formula doesn’t apply and ${company} is ranked last in that column.</p>
      <div class="cv-totals">
        ${complete ? `<div><strong>${money(alt.value)}</strong><span>Operating costs paid, excluding interest</span>${native && fx ? `<span>${usdMoney(lens.usd?.alt)} in USD</span>` : ""}</div>` : ""}
        ${interest ? `<div><strong>${money(interest.value)}</strong><span>Interest paid to depositors and lenders</span>${native && fx ? `<span>${usdMoney(lens.usd?.interestPaid)} in USD</span>` : ""}</div>` : ""}
      </div>
      ${complete ? `<ol class="cv-po-steps" aria-label="How operating costs paid are calculated">
        ${row("","Noninterest expense",money(lines.noninterestExpense.value),lines.noninterestExpense)}
        ${row("−","Depreciation and amortization (not a payment)",money(lines.depreciationAmortization.value),lines.depreciationAmortization)}
        ${row("−","Stock-based compensation (not paid in cash)",money(lines.stockComp.value),lines.stockComp)}
        ${row("+","Income taxes paid",money(lines.taxesPaid.value),lines.taxesPaid)}
        ${row("=","Operating costs paid, excluding interest",money(alt.value),null,"total")}
      </ol>` : ""}
      <p class="distribution-note">The two are shown side by side and never added: interest is what ${company} paid depositors and lenders for the use of their money.</p>`;
    if (complete) {
      prove("Noninterest expense",lines.noninterestExpense);
      prove("Depreciation and amortization",lines.depreciationAmortization);
      prove("Stock-based compensation",lines.stockComp);
      prove("Income taxes paid",lines.taxesPaid);
      proof.push(cvProof("Operating costs paid, excluding interest",money(alt.value),fy,"derived",[],"Noninterest expense − depreciation and amortization − stock-based compensation + income taxes paid."));
    }
    if (interest) prove("Interest paid to depositors and lenders",interest,"Shown apart; never added to operating costs.");
    return {sources,proof,html};
  }

  const revenue = cvLine(lens.revenue), ocf = cvLine(lens.operatingCashFlow), capex = cvLine(lens.capex);
  const addBacks = (Array.isArray(lens.addBacks) ? lens.addBacks : []).map(item => ({key:item.key,location:item.location ? String(item.location) : "",line:cvLine(item)})).filter(item => item.line);
  if (!revenue || !ocf || !capex || !cvNumber(lens.paidOut) || !cvNumber(lens.total)) return null;
  const lending = lens.lending && lens.lending.status === "adjusted" && cvNumber(lens.lending.adjusted)
    ? {...lens.lending,parts:(lens.lending.parts || []).map(part => ({label:String(part.label || ""),effect:part.effect,line:cvLine({value:part.effect,sources:part.sources})})).filter(part => part.line && cvNumber(part.effect))}
    : null;
  const adjusted = lending && lending.parts.length ? lending : null;
  const se = lens.salesEnabled && cvNumber(lens.salesEnabled.value) ? lens.salesEnabled : null;
  const measure = se ? cvLine(se.measureValue) : null, platform = se ? cvLine(se.platformRevenue) : null;
  const firstParty = se && se.firstPartySales ? cvLine(se.firstPartySales) : null;
  const sales = se && measure && platform && (!se.firstPartySales || firstParty) ? se : null;
  const base = adjusted ? adjusted.adjusted : lens.paidOut;
  const measureName = sales ? escapeHtml(sales.measure) : "";

  // The waterfall.
  const steps = [
    row("","Revenue",money(revenue.value),revenue),
    // A negative operating cash flow is subtracted as a negative, so it adds to paid out.
    ocf.value < 0 ? row("+",`Operating cash flow was negative (${money(ocf.value)}), so it adds`,money(-ocf.value),ocf) : row("−","Operating cash flow",money(ocf.value),ocf),
    row("+","Capital spending",money(capex.value),capex),
    ...addBacks.map(item => row("+",cvAddBackLabels[item.key] || escapeHtml(item.key),money(item.line.value),item.line)),
    row("=","Paid out",money(lens.paidOut),null,adjusted || sales ? "subtotal" : "total")
  ];
  if (adjusted) {
    for (const part of adjusted.parts) steps.push(row(part.effect >= 0 ? "−" : "+",`${escapeHtml(cvCap(part.label))} <em>(${/deposit/i.test(part.label) ? "customer deposits" : "customer lending"} inside operating cash flow)</em>`,money(Math.abs(part.effect)),part.line));
    steps.push(row("=","Paid out, adjusted for customer lending",money(adjusted.adjusted),null,sales ? "subtotal" : "total"));
  }
  if (sales) {
    const tagged = (line, part) => line.sources.map(source => ({...source,part}));
    const salesLine = {value:sales.value,sources:[...tagged(measure,sales.measure),...tagged(platform,sales.platformRevenue.label || "Revenue"),...(firstParty ? tagged(firstParty,"Own product sales") : [])]};
    steps.push(row("+",`Sales enabled for others: ${measureName} − ${escapeHtml(sales.platformRevenue.label || "revenue")}${firstParty ? ` − ${company}’s own product sales` : ""}`,money(sales.value),salesLine));
    steps.push(row("=","Paid out & sales enabled",money(lens.total),null,"total"));
  }

  // Caveats in plain words.
  const caveatText = caveat => {
    const amount = cvNumber(caveat.value) ? money(caveat.value) : "";
    switch (caveat.code) {
      case "lending-not-disclosed": return `${company} books growth in customer loans or leases inside operating cash flow and doesn’t disclose the amount, so paid out is not adjusted for it and may be overstated.`;
      case "lending-not-separable": return `${caveat.text ? escapeHtml(caveat.text) + " " : ""}Paid out is not adjusted for customer lending.`;
      case "interest-not-separable": return "Interest paid is reported only together with other financing payments, so it isn’t added and paid out is understated by it.";
      case "taxes-not-separable": return "Income taxes paid are reported only together with other payments, so they aren’t added and paid out is understated by them.";
      case "non-cash-revenue": return `Revenue includes ${amount || "non-cash income"}${amount ? " of non-cash income" : ""}, which raises paid out by that amount.`;
      case "interest-dividends-received": return `${amount ? amount + " of interest" : "Interest"} and dividends ${company} received sit inside operating cash flow but not revenue, which lowers paid out${amount ? " by that amount" : ""}.`;
      case "revenue-includes-excise": return "Revenue includes excise duties, which count here as paid to governments.";
      case "insurance": return "Insurance claims paid count as payouts, and income taxes paid include tax on investment gains outside revenue.";
      case "financial-sector": {
        const kind = caveat.text ? String(caveat.text) : "financial company";
        return `${company} is ${/^[aeiou]/i.test(kind) ? "an" : "a"} ${escapeHtml(kind)}. Its operating cash flow works like other companies’, so the formula applies, but customer balances can still move it.`;
      }
      case "exceeds-revenue": return `Paid out is higher than revenue this year because capital spending${addBacks.length ? " plus the payments added back" : ""} was larger than operating cash flow${caveat.negativeOCF ? ", which was negative" : ""}.`;
      default: return "";
    }
  };
  const caveats = (Array.isArray(lens.caveats) ? lens.caveats : []).map(caveat => ({caveat,text:caveatText(caveat)})).filter(item => item.text);
  const caveatSources = caveats.flatMap(item => (Array.isArray(item.caveat.sources) ? item.caveat.sources : []).map(cvSource).filter(Boolean));

  // Provenance: every input, both totals, the FX rate.
  prove("Revenue",revenue);
  prove("Operating cash flow",ocf);
  prove("Capital spending",capex,Array.isArray(lens.capex.components) && lens.capex.components.length ? "Components as researched: " + lens.capex.components.join("; ") + "." : "");
  for (const item of addBacks) prove(cvAddBackLabels[item.key] || item.key,item.line,item.location);
  proof.push(cvProof("Paid out",money(lens.paidOut),fy,"derived",[],`Revenue − operating cash flow + capital spending${addBacks.length ? " + " + addBacks.map(item => (cvAddBackLabels[item.key] || item.key).toLowerCase()).join(" + ") : ""}. Before any adjustment for customer lending.`));
  if (adjusted) {
    for (const part of adjusted.parts) prove(cvCap(part.label),part.line,part.effect >= 0 ? "Lowered operating cash flow, so it raised paid out; subtracted." : "Raised operating cash flow, so it lowered paid out; added back.");
    proof.push(cvProof("Paid out, adjusted for customer lending",money(adjusted.adjusted),fy,"derived",[],`Paid out ${money(lens.paidOut)} ${adjusted.effect >= 0 ? "−" : "+"} ${money(Math.abs(adjusted.effect))} of customer lending flows inside operating cash flow. This is the figure ranked.`));
  }
  if (sales) {
    prove(sales.measure,measure,sales.definition?.quote ? `How ${leader.company} defines it: “${sales.definition.quote}”` : "");
    prove(sales.platformRevenue.label || "Revenue",platform);
    if (firstParty) prove(`${leader.company}’s own product sales`,firstParty,"Subtracted: first-party sales are the company’s own, not third parties’.");
    proof.push(cvProof("Sales enabled",money(sales.value),fy,"derived",[],`${sales.measure} − ${sales.platformRevenue.label || "revenue"}${firstParty ? " − first-party product sales" : ""}.${sales.note ? " " + sales.note : ""}`));
    proof.push(cvProof("Paid out & sales enabled",money(lens.total),fy,"derived",[],`${adjusted ? "Adjusted paid out" : "Paid out"} + sales enabled.`));
  }
  if (native && fx && fx.source) {
    sources.push(fx.source);
    proof.push(cvProof(`USD rate: ${currency} per dollar, ${fx.calendarYear} average`,String(fx.perUSD),String(fx.calendarYear),"regulator",[fx.source],[fx.derivation || "",`Ranked in USD: ${money(lens.total)} ÷ ${fx.perUSD} = ${usdMoney(lens.usd?.total)}.`].filter(Boolean).join(" ")));
  }
  caveats.forEach(item => {
    const own = (Array.isArray(item.caveat.sources) ? item.caveat.sources : []).map(cvSource).filter(Boolean);
    if (own.length && cvNumber(item.caveat.value)) proof.push(cvProof(item.caveat.code === "non-cash-revenue" ? "Non-cash revenue (caveat)" : "Interest and dividends received inside operating cash flow (caveat)",money(item.caveat.value),fy,"record",own));
  });
  sources.push(...caveatSources);

  const totalLabel = sales ? "Paid out & sales enabled" : adjusted ? "Paid out, adjusted for customer lending" : "Paid out";
  const usdLine = native && cvNumber(lens.usd?.total) ? `<span>${usdMoney(lens.usd.total)} in USD, at the ${fx.calendarYear} average rate</span>` : "";
  return {
    sources,proof,
    html:`${cvPanelHead(`What did ${company} pay out?`,cvYearLine(period),`<div class="distribution-total"><strong>${money(lens.total)}</strong><span>${totalLabel}</span>${usdLine}</div>`)}
      <p class="cv-po-covers">Paid out is the money ${company} paid to employees, suppliers, partners, lenders and governments, and to builders and equipment makers for its capital spending.</p>
      <ol class="cv-po-steps" aria-label="How paid out is calculated">${steps.join("")}</ol>
      ${sales ? `<p class="distribution-note">Sales enabled is the part of ${measureName} that ${company} didn’t keep as revenue: sales made by others on its platform. It is the one addition beyond what ${company} itself paid.</p>` : ""}
      ${caveats.length ? `<ul class="cv-po-caveats" aria-label="Caveats">${caveats.map(item => `<li><span class="cv-tier">Caveat</span> ${item.text}</li>`).join("")}</ul>` : ""}
      <p class="distribution-note">Pay to workers${finiteNumber(leader.payroll) ? " (" + compactMoney(leader.payroll) + ")" : ""} is already inside paid out and is never added to it. Paid out is never totaled across the list: one company’s payment is another’s revenue.</p>`
  };
}

// The ranking's own figures (dist/data.js, stamped by scripts/build-edition.mjs from the record's `ranking`):
// market value = reported shares × the edition-date close (÷ FX); people employed and pay as reported.
function cvRankingProof(leader, record) {
  const r = record?.ranking || {};
  const src = s => s?.url ? [{url:s.url,label:s.label || "",quote:s.quote || ""}] : [];
  const mc = r.marketcap, pay = r.pay;
  const shareSources = mc ? mc.classes.flatMap(c => c.computedFrom ? c.computedFrom.flatMap(part => src(part.source)) : src(c.source)) : [];
  const priceSources = mc ? [...mc.prices.flatMap(p => src(p.source)),...mc.fx.flatMap(f => src(f.source))] : [];
  const classes = mc ? mc.classes.map(c => `${integer.format(c.shares)} ${escapeHtml(c.label)} (as of ${cvDate(c.sharesAsOf) || c.sharesAsOf}) priced as ${escapeHtml(c.pricedAs)}${(c.perListedUnit ?? 1) !== 1 ? " × " + c.perListedUnit : ""}`).join("; ") : "";
  const payText = !finiteNumber(leader.payroll) ? "The company reports no staff-cost total, and no median pay."
    : leader.payBasis === "median-pay" ? `${integer.format(leader.jobs)} people × ${dollars.format(leader.wage)} median pay (the proxy statement’s CEO pay ratio disclosure). The median is not an average, so this understates total pay where pay is skewed.`
    : `Total staff costs as reported (${escapeHtml(pay?.payroll?.label || "personnel expense")}), converted to USD at the fiscal year’s average rate.`;
  const vs = r.ventures;
  const ventureSources = vs ? vs.list.flatMap(v => [...src(v.founded?.source),...v.classes.flatMap(c => c.computedFrom ? c.computedFrom.flatMap(part => src(part.source)) : src(c.source)),...src(v.leaderStake?.source),...v.prices.flatMap(p => src(p.source))]) : [];
  const ventureText = vs ? ` Also founded and counted: ${vs.list.map(v => `${escapeHtml(v.company)}${v.includes ? " (" + escapeHtml(v.includes) + ")" : ""}`).join(", ")}, valued the same way.` + (vs.notCounted.length ? ` Not counted, because they have no market price: ${vs.notCounted.map(n => escapeHtml(n.company)).join(", ")}.` : "") : "";
  return [
    cvProof(metrics.cap,compactMoney(leader.cap),edition.pricesAsOfLabel,mc ? "derived" : "market",[...shareSources,...priceSources,...ventureSources],
      (mc ? `Market value: shares outstanding × closing price on ${edition.pricesAsOfLabel}, in USD at that day’s Federal Reserve rate. ${classes}.` : "Market capitalization.") + ventureText),
    cvProof(metrics.jobs,integer.format(leader.jobs),leader.fy,"record",pay ? src(pay.employees.source) : [],pay ? `${escapeHtml(pay.employees.basis || "Employees")}, as reported.` : "Direct employees worldwide, as reported."),
    cvProof(metrics.payroll,finiteNumber(leader.payroll) ? compactMoney(leader.payroll) : "Not disclosed",pay?.payroll?.period || leader.fy,finiteNumber(leader.payroll) ? (leader.payBasis === "median-pay" ? "derived" : "record") : "record",pay?.payroll ? src(pay.payroll.source) : [],payText)
  ];
}
// Net worth (research/lenses/networth): a third-party estimate of the leader's personal wealth, from the list's
// publisher (hostType "publisher", which cvSource doesn't accept, so its link is checked here). Shown under
// "Their stake" in the profile headline; never added to value created or to any lens.
function cvNetworthProof(record) {
  const nw = record && record.networth;
  const url = nw && nw.source && typeof nw.source.url === "string" ? nw.source.url : "";
  if (!nw || !cvNumber(nw.value) || !/^https:\/\/\S+$/.test(url) || ownershipMirrors.test(url)) return [];
  // Named by publisher and year (the voice rules keep the list's own title off the page).
  const year = /\b(?:19|20)\d{2}\b/.exec(nw.list || "")?.[0] || "";
  const publisher = nw.publisher || "The publisher";
  // No quote: the list's raw record is checked by verify-quotes but not reprinted (it carries the publisher's own bio).
  const source = {url,label:`${publisher}${year ? " " + year : ""} list data`,quote:""};
  return [cvProof(nw.withFamily ? "Net worth (with family)" : "Net worth",compactMoney(nw.value),monthYear(nw.asOf),"third-party",[source],
    [`${publisher}’s ${/real-time/i.test(nw.list || "") ? "real-time " : ""}estimate${year ? " in its " + year + " list" : ""}, measured as of ${cvDate(nw.asOf) || nw.asOf}.`,
      nw.withFamily ? "The list names this entry “& family”, so it covers wealth it attributes to the family, not one person alone." : "",
      "A third-party estimate of personal wealth, not a company filing. Shown beside the stake, never added to value created or to any lens."].filter(Boolean).join(" "))];
}
const cvPanels = {ownership:cvOwnership,paidout:cvPaidout,cash:cvCash,workers:cvWorkers,geography:cvGeography,ecosystem:cvEcosystem,fiscal:cvFiscal};
function cvProvenance(groups) {
  const item = entry => `<li class="cv-proof">
      <div class="cv-proof-head"><strong>${escapeHtml(entry.label)}</strong><span class="cv-proof-value">${escapeHtml(entry.value)}</span></div>
      <p class="cv-proof-meta">${[entry.when ? escapeHtml(entry.when) : "",[].concat(entry.tier).map(cvTag).join(" ")].filter(Boolean).join(" · ")}</p>
      ${entry.note ? `<p class="cv-proof-note">${escapeHtml(entry.note)}</p>` : ""}
      ${entry.sources.map(source => `${source.quote ? `<blockquote>${escapeHtml(source.quote)}</blockquote>` : ""}<p class="cv-proof-source">${cvLink(source)}</p>`).join("")}
    </li>`;
  return `<details class="cv-provenance">
      <summary>How we got these numbers</summary>
      <p class="cv-proof-intro">Every figure in this profile, with its date, its evidence and the line it came from. <a href="/methodology">Methodology</a></p>
      ${groups.filter(group => group.proof.length).map(group => `<h4>${escapeHtml(group.label)}</h4><ol class="cv-proof-list">${group.proof.map(item).join("")}</ol>`).join("")}
    </details>`;
}

// Amazon's standalone lens section is named after the lenses it shows ("Paid out, platform and taxes").
function cvLensTitle(views) {
  const names = views.map(view => ({paidout:"paid out",ecosystem:"platform",fiscal:"taxes"})[view.key]).filter(Boolean);
  const text = names.length > 1 ? names.slice(0,-1).join(", ") + " and " + names[names.length - 1] : names[0] || "more lenses";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function cvRender(record, leader) {
  const lensOnly = leader.id === "jeff-bezos";
  const allowed = lensOnly ? companyLensViews : companyValueViews.map(([key]) => key);
  const views = record ? companyValueViews.filter(([key]) => allowed.includes(key)).map(([key,label,chip]) => ({key,label,chip,panel:cvPanels[key](record,leader)})).filter(view => view.panel) : [];
  // The footprint panel (company-footprint.js) sits further down the profile; its figures are listed here too.
  const footprint = record && !lensOnly && typeof companyFootprintProof === "function" ? companyFootprintProof(record,leader) : [];
  const provenance = cvProvenance([{label:"The ranking",proof:cvRankingProof(leader,record)},...views.map(view => ({label:view.label,proof:view.panel.proof || []})),...footprint,{label:"Net worth",proof:cvNetworthProof(record)}]);
  if (!views.length) return {body:"",provenance};
  const company = escapeHtml(leader.company);
  return {provenance,body:`
      <header class="distribution-heading">
        <p class="eyebrow">${lensOnly ? `${escapeHtml(leader.company.toUpperCase())} · MORE LENSES` : escapeHtml(leader.company.toUpperCase())}</p>
        <h3 id="company-value-title">${lensOnly ? cvLensTitle(views) : "Who shares in the value?"}</h3>
        ${lensOnly ? `<p>More ways to see the value ${company} created, each on its own.</p>` : ""}
      </header>
      ${views.map(view => `<section id="cv-${view.key}" class="distribution-panel cv-view" data-chip="${escapeHtml(view.chip)}" aria-labelledby="cv-label-${view.key}">
        <p class="section-kicker" id="cv-label-${view.key}">${escapeHtml(view.label)}</p>
        ${view.panel.html}
        ${cvSourcesRow(view.panel.sources)}
      </section>`).join("")}`};
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

// Fills the slot with one section per lens, and "How we got these numbers" into provenanceSlot (the
// profile's Sources section) when one is given, otherwise at the end of the slot. Resolves true when it
// shows lenses, "provenance" when it shows only the provenance block, and false when nothing could be shown.
async function bindCompanyValue(root, leader, provenanceSlot = null) {
  if (!root) return false;
  const record = await cvLoad(leader.id);
  // The profile may have moved on to another leader while the record loaded.
  if (!root.isConnected || root.dataset.leader !== leader.id) return false;
  let rendered = null;
  try {
    rendered = cvRender(record && typeof record === "object" && record.id === leader.id ? record : null,leader);
  } catch {
    rendered = null;
  }
  const slot = provenanceSlot && provenanceSlot.isConnected ? provenanceSlot : null;
  if (rendered?.provenance) {
    if (slot) slot.innerHTML = rendered.provenance;
    else root.insertAdjacentHTML("beforeend",rendered.provenance);
  }
  if (!rendered?.body) {
    if (slot || !rendered?.provenance) root.remove();
    else {
      root.hidden = false;
      root.classList.add("is-provenance-only");
      root.removeAttribute("aria-labelledby");
      root.setAttribute("aria-label","How we got these numbers");
    }
    return rendered?.provenance ? "provenance" : false;
  }
  root.insertAdjacentHTML("afterbegin",rendered.body);
  root.hidden = false;
  return true;
}

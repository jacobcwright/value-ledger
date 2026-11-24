// The ownership headline's arithmetic, shared by the profile (company-value.js, which renders it) and the
// build (scripts/build-companies.mjs, which evaluates this file in Node to write dist/headline.json). Pure:
// no DOM, no other globals, so both run exactly the same rules and rounding.
// Input: a published company record (dist/companies/<id>.json). Output: see ownershipHeadline() below.
const ownershipMirrors = /dfcfw\.com|9to5mac|seekingalpha|marketscreener|macrotrends|stockanalysis|companiesmarketcap|wsj\.com|reuters\.com|bloomberg|yahoo\.|investing\.com|wikipedia|annualreports\.com|last10k|fintel|gurufocus/;
const ownershipHosts = ["sec","company","exchange","regulator"];
const ownershipNumber = value => typeof value === "number" && Number.isFinite(value);
const ownershipHidden = item => !item || item.status === "not-sourced";
// A source is publishable when it is an https document link with a label, on an allowed host type
// (when the record states one) and not a known mirror.
function ownershipSource(source) {
  if (!source || typeof source !== "object") return null;
  const url = typeof source.url === "string" ? source.url : "";
  if (!/^https:\/\/\S+$/.test(url) || ownershipMirrors.test(url) || !source.label) return null;
  if (source.hostType != null && !ownershipHosts.includes(source.hostType)) return null;
  return {url,label:String(source.label),quote:source.quote ? String(source.quote) : ""};
}
// One decimal, as the headline prints it.
const ownershipRound1 = value => Math.round(value * 10) / 10;

// Returns null without an ownership record, otherwise:
//   person, showPerson     the record's leader entry, and whether it may be shown
//   self                   {pct, derived (method text or null), sources} — the leader's own stake, or null
//   family                 {pct, label, full, detail, headline, includesLeader, source} or null
//   holders                named holders with a number and a source, largest first
//   barHolders             the first three that are a share of all shares (drawn and subtracted)
//   classHolders           the first three that are a share of one class (listed only)
//   shown                  whether the ownership section has anything to show
//   othersPct              "Everyone else": 100 − the displayed (one-decimal) leader and family stakes
//   hasOthers              whether the headline prints "Everyone else" (only with an own stake or a family)
//   familyBased            whether the headline leads with the family (it includes the leader, or there is no own stake)
//   leaderStatus           when no own stake can be shown: "deceased" | "no-reported-stake" | "under1" |
//                          "shares" | "not-disclosed" | null; with statusSource, the source behind under1/shares
function ownershipHeadline(record) {
  if (!record || typeof record !== "object") return null;
  const ownership = record.ownership && typeof record.ownership === "object" ? record.ownership : {};
  const person = ownership.leader && typeof ownership.leader === "object" ? ownership.leader : {};
  const showPerson = Boolean(!ownershipHidden(person) && person.name);
  let self = null;
  if (showPerson && person.status === "holds") {
    const source = ownershipSource(person.source);
    if (ownershipNumber(person.pctEconomic) && source) {
      self = {pct:person.pctEconomic,derived:null,sources:[source]};
    } else if (person.derived && ownershipNumber(person.derived.pctEconomic) && person.derived.method) {
      const inputs = (Array.isArray(person.derived.inputs) ? person.derived.inputs : []).map(ownershipSource).filter(Boolean);
      const backing = inputs.length ? inputs : source ? [source] : [];
      if (backing.length) self = {pct:person.derived.pctEconomic,derived:String(person.derived.method),sources:backing};
    }
  }
  let family = null;
  if (showPerson && person.family && !ownershipHidden(person.family) && ownershipNumber(person.family.pctEconomic)) {
    const source = ownershipSource(person.family.source);
    const full = String(person.family.label || "");
    // Labels are written for readers of the filing, sometimes as a paragraph ("X (largest shareholder) and
    // its related parties: A, B, C. Includes …"). The short name is the text before any colon, without
    // parentheticals; the rest becomes the detail line.
    const colon = full.indexOf(":");
    const head = colon > 0 ? full.slice(0,colon) : full;
    const label = head.replace(/\s*\([^)]*\)/g,"").replace(/\s*\(.*$/,"").trim();
    const inner = colon > 0 ? [null,full.slice(colon + 1).trim()] : /\((.*)\)\s*$/.exec(full);
    if (source && label) {
      family = {pct:person.family.pctEconomic,label,full,detail:inner && inner[1] ? inner[1] : "Founding family",
        headline:/^the\s/i.test(label) || !/(family|group)$/i.test(label) ? label : "The " + label,
        includesLeader:person.family.includesLeader === true,source};
    }
  }
  const holders = (Array.isArray(ownership.largestHolders) ? ownership.largestHolders : [])
    .filter(holder => holder && !ownershipHidden(holder) && holder.name && ownershipNumber(holder.pctEconomic) && ownershipSource(holder.source))
    .sort((a,b) => b.pctEconomic - a.pctEconomic);
  // Class-basis holders are a share of one class only: listed, never in the bar or in "everyone else".
  const barHolders = holders.filter(holder => holder.basis !== "class").slice(0,3);
  const classHolders = holders.filter(holder => holder.basis === "class").slice(0,3);
  // Rounded from the displayed stake, so the two headline figures always sum to 100.0%. A family or
  // promoter-group total that already includes the leader is never added to the leader's own stake.
  const r1 = ownershipRound1;
  const othersPct = 100 - (family?.includesLeader ? r1(family.pct) : r1(self?.pct || 0) + r1(family?.pct || 0));
  // The schema has no field for "less than 1%" (a * in the proxy), so it is read from the record's notes.
  let leaderStatus = null, statusSource = null;
  if (showPerson && !self) {
    const lessThan1 = /less than 1\s?%/i.test(String(record.notes || ""));
    const source = ownershipSource(person.source);
    const sourced = person.status === "holds" && source && (lessThan1 || ownershipNumber(person.shares));
    leaderStatus = person.status === "deceased" ? "deceased"
      : person.status === "no-reported-stake" ? "no-reported-stake"
      : sourced && lessThan1 ? "under1"
      : sourced ? "shares"
      : person.status === "not-disclosed" || person.status === "holds" ? "not-disclosed" : null;
    if (sourced) statusSource = source;
  }
  return {person,showPerson,self,family,holders,barHolders,classHolders,
    shown:Boolean(self || family || holders.length),
    othersPct,hasOthers:Boolean(self || family),
    familyBased:Boolean(family && (family.includesLeader || !self)),
    leaderStatus,statusSource};
}

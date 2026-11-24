// "How value spreads": fills the story figures from data.js and the Amazon data files.
// Loaded after app.js, so it reuses compactMoney and decimal. No figure is written by hand.
{
  const root = document.getElementById("story");
  const sum = key => leaders.reduce((total,leader) => total + leader[key],0);
  const listJoin = items => items.length < 2 ? items.join("") : items.slice(0,-1).join(", ") + " and " + items.at(-1);
  const pct = share => decimal.format(100 * share) + "%";

  const {sharesOutstanding,yearEndPrice,holders} = amazonOwnership;
  const founderShares = holders[0].shares;
  const othersShares = sharesOutstanding - founderShares;
  const founderShare = founderShares / sharesOutstanding;
  const namedMarkets = amazonMarkets.filter(market => market.id !== "other").map(market => market.name);
  const hasOtherMarkets = amazonMarkets.some(market => market.id === "other");

  const figures = {
    "count":String(new Set(leaders.map(leader => leader.company)).size),
    "cap":compactMoney(sum("cap")),
    "jobs":decimal.format(sum("jobs") / 1e6) + "M",
    "payroll":compactMoney(sum("payroll")),
    "others-pct":pct(1 - founderShare),
    "founder-pct":pct(founderShare),
    "founder-value":compactMoney(founderShares * yearEndPrice / 1e9),
    "others-value":compactMoney(othersShares * yearEndPrice / 1e9),
    "sales":compactMoney(amazonSalesTotal),
    "markets":listJoin(namedMarkets) + (hasOtherMarkets ? ", plus all other markets combined" : ""),
    "states":String(amazonStateData.length)
  };
  root.querySelectorAll("[data-story]").forEach(slot => { slot.textContent = figures[slot.dataset.story] ?? ""; });
  root.querySelector('[data-story-bar="founder"]').style.flexGrow = founderShares;
  root.querySelector('[data-story-bar="others"]').style.flexGrow = othersShares;
}

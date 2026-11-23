// Amazon case study. Ownership and company reporting figures are fixed snapshots.
const amazonSources = {
  annual:"https://www.sec.gov/Archives/edgar/data/1018724/000101872425000004/amzn-20241231.htm",
  founder:"https://www.sec.gov/Archives/edgar/data/1043298/000104329824000002/xslF345X05/wk-form4_1732226837.xml",
  proxy:"https://www.sec.gov/Archives/edgar/data/1018724/000110465925033442/tm252295-1_def14a.htm",
  totalMarket:"https://www.sec.gov/Archives/edgar/data/36405/000175272425048292/xslFormNPORT-P_X01/primary_doc.xml",
  fiveHundred:"https://www.sec.gov/Archives/edgar/data/36405/000175272425048295/xslFormNPORT-P_X01/primary_doc.xml",
  pension:"https://www.sec.gov/Archives/edgar/data/919079/000091907925000003/xslForm13F_X02/informationtable.xml",
  ipo:"https://www.sec.gov/Archives/edgar/data/1018724/000089102097000868/0000891020-97-000868.txt"
};
const amazonOwnership = {
  sharesOutstanding:10_593_000_000,
  yearEndPrice:219.39,
  registeredShareholders:12_135,
  holders:[
    {
      name:"Jeff Bezos", type:"Founder’s direct shares", shares:909_709_895, color:"founder",
      description:"Bezos reported this direct stake in November 2024. His separately disclosed voting authority over shares held by someone else is excluded from his stake here.",
      sources:[[amazonSources.founder,"Bezos’s Form 4"],[amazonSources.proxy,"Amazon’s proxy statement, footnote 1"]]
    },
    {
      name:"Vanguard Total Stock Market Index Fund", type:"Index fund", shares:296_490_142, color:"total-market",
      description:"The fund held Amazon stock alongside thousands of other U.S. companies. People who own this fund have indirect exposure to its Amazon stake, including through retirement accounts.",
      sources:[[amazonSources.totalMarket,"Fund holdings filing"]]
    },
    {
      name:"Vanguard 500 Index Fund", type:"Index fund", shares:253_323_924, color:"five-hundred",
      description:"The fund tracks the S&P 500. Its reported holding is the fund’s Amazon position. The filing gives the size of the position without a breakdown by type of investor.",
      sources:[[amazonSources.fiveHundred,"Fund holdings filing"]]
    },
    {
      name:"CalPERS", type:"Public pension system", shares:16_319_369, color:"pension",
      description:"The California Public Employees’ Retirement System reported this Amazon position under its own investment discretion. It is one example of how retirement savings can be exposed to Amazon’s share price.",
      sources:[[amazonSources.pension,"CalPERS Form 13F holdings"]]
    }
  ]
};
const amazonHistory = [
  {year:2022,buybacks:6,dividends:0,stockPay:19.621,unitsVested:113.3},
  {year:2023,buybacks:0,dividends:0,stockPay:24.023,unitsVested:139.9},
  {year:2024,buybacks:0,dividends:0,stockPay:22.011,unitsVested:209.7}
];
const distributionViews = [
  ["ownership","Who holds shares"],
  ["cash","Cash to shareholders"],
  ["workers","How workers shared"]
];
function distributionMoney(billions) {
  return billions === 0 ? "$0" : compactMoney(billions);
}

function amazonDistribution(leader) {
  const {sharesOutstanding,yearEndPrice,registeredShareholders,holders} = amazonOwnership;
  const otherShares = sharesOutstanding - holders.reduce((sum,holder) => sum + holder.shares,0);
  const entries = [...holders,{
    name:"All remaining shares",type:"Other holdings",shares:otherShares,color:"other",
    description:"This remainder includes other funds and institutions, individuals, and any employees or former employees who still hold shares. The filings here do not identify the people behind these holdings.",
    sources:[[amazonSources.annual,"Amazon’s annual report"]]
  }];
  const equityValue = shares => distributionMoney(shares * yearEndPrice / 1e9);
  const percent = shares => (100 * shares / sharesOutstanding).toFixed(2) + "%";
  const sources = links => links.map(([url,label]) => externalLink(url,label)).join("");
  const cashReturned = amazonHistory.reduce((sum,row) => sum + row.buybacks + row.dividends,0);
  const last = amazonHistory.at(-1);
  const highestStockPay = Math.max(...amazonHistory.map(year => year.stockPay));
  return `
    <section id="amazon-distribution" class="distribution" aria-labelledby="distribution-title">
      <header class="distribution-heading">
        <p class="eyebrow">AMAZON CASE STUDY</p>
        <h3 id="distribution-title">Who shares in the value?</h3>
        <p>Follow Amazon’s shares, the cash it returned, and the ways workers participated in its growth.</p>
      </header>
      <div class="distribution-tabs" role="tablist" aria-label="Explore Amazon’s value">
        ${distributionViews.map(([key,label],index) => `<button id="distribution-tab-${key}" type="button" role="tab" aria-controls="distribution-${key}" aria-selected="${index === 0}" tabindex="${index === 0 ? "0" : "-1"}">${label}</button>`).join("")}
      </div>
      <div id="distribution-ownership" class="distribution-panel" role="tabpanel" aria-labelledby="distribution-tab-ownership" tabindex="0">
        <div class="distribution-subhead">
          <div><h4>Who held Amazon shares?</h4><p>Year-end 2024 · ${equityValue(sharesOutstanding)} in total equity value</p></div>
          <div class="distribution-total"><strong>${equityValue(sharesOutstanding - holders[0].shares)}</strong><span>Held outside Bezos’s direct stake</span></div>
        </div>
        <div class="ownership-bar" aria-hidden="true">
          ${entries.map((holder,index) => `<span data-owner="${index}" class="ownership-${holder.color}" style="flex-grow:${holder.shares}" title="${holder.name}: ${percent(holder.shares)}"></span>`).join("")}
        </div>
        <div class="ownership-breakdown">
          <div class="ownership-choices" aria-label="Select a holding">
            ${entries.map((holder,index) => `<button type="button" data-owner="${index}" aria-pressed="false">
              <span class="ownership-key ownership-${holder.color}" aria-hidden="true"></span>
              <span class="holding-name"><strong>${holder.name}</strong><small>${holder.type}</small></span>
              <span class="holding-amount"><strong>${equityValue(holder.shares)}</strong><small>${percent(holder.shares)}</small></span>
            </button>`).join("")}
          </div>
          <div class="ownership-detail" aria-live="polite">
            ${entries.map((holder,index) => `<div data-owner-detail="${index}" hidden>
              <h5>${holder.name}</h5>
              <strong class="ownership-share-count">${integer.format(holder.shares)} shares</strong>
              <p>${holder.description}</p>
              <div class="sources">${sources(holder.sources)}</div>
            </div>`).join("")}
          </div>
        </div>
        <p class="distribution-note"><strong>${integer.format(registeredShareholders)} registered shareholders</strong> as of January 29, 2025. A brokerage can appear as a single registered holder for many customers, so the number of people with indirect stakes is higher. ${externalLink(amazonSources.annual,"Amazon’s annual report")}</p>
        <details class="distribution-method"><summary>How we estimated these holdings</summary>
          <p>We multiply the reported share counts by the December 31 price of $219.39. Amazon reported about 10.593 billion shares outstanding at year-end. The founder’s latest 2024 Form 4 is from November, and the following proxy confirms the same stake after excluding voting-only shares. Each named fund or pension shows its reported position only. These are values at one point in time. The leaderboard uses a separate CompaniesMarketCap estimate.</p>
          <div class="sources">${sources([[amazonSources.annual,"Shares outstanding"],[amazonSources.fiveHundred,"Year-end fund valuation"]])}</div>
        </details>
      </div>
      <div id="distribution-cash" class="distribution-panel" role="tabpanel" aria-labelledby="distribution-tab-cash" tabindex="0" hidden>
        <div class="distribution-subhead">
          <div><h4>What did Amazon pay to shareholders?</h4><p>Cash dividends and stock buybacks · Fiscal years 2022–2024</p></div>
          <div class="distribution-total"><strong>${distributionMoney(cashReturned)}</strong><span>Cash returned over three years</span></div>
        </div>
        <table class="distribution-table">
          <thead><tr><th scope="col">Year</th><th scope="col">Cash dividends</th><th scope="col">Stock buybacks</th></tr></thead>
          <tbody>${amazonHistory.map(row => `<tr><th scope="row">${row.year}</th><td>${distributionMoney(row.dividends)}</td><td>${distributionMoney(row.buybacks)}</td></tr>`).join("")}</tbody>
        </table>
        <p class="distribution-note">Buybacks pay the investors who sell shares back to Amazon. The cash flow statement reports the total spent on buybacks, and the identities of those sellers are generally unavailable. Sales between investors can turn share value into cash for the seller and happen outside these figures.</p>
        <div class="sources">${sources([[amazonSources.annual,"Amazon’s annual report and cash flow statement"]])}</div>
      </div>
      <div id="distribution-workers" class="distribution-panel" role="tabpanel" aria-labelledby="distribution-tab-workers" tabindex="0" hidden>
        <div class="distribution-subhead">
          <div><h4>How did workers participate?</h4><p>Employment, estimated pay, and reported stock awards</p></div>
        </div>
        <div class="worker-totals">
          <div><strong>${integer.format(leader.jobs)}</strong><span>People employed at year-end 2024</span></div>
          <div><strong>${distributionMoney(leader.payroll)}</strong><span>${metrics.payroll}</span></div>
          <div><strong>${distributionMoney(last.stockPay)}</strong><span>Stock-based compensation expense in 2024</span></div>
        </div>
        <p class="distribution-note">Yearly pay is the site's wage estimate. Stock-based compensation is the amount Amazon recorded as an expense. The figures have different bases and should be read individually. An employee’s proceeds depend on what vested and when they sold.</p>
        <h5 class="distribution-mini-heading">Stock-based compensation expense</h5>
        <ul class="worker-equity" aria-label="Annual stock-based compensation expense in billions of US dollars">
          ${amazonHistory.map(row => `<li><span>${row.year}</span><span class="worker-track" aria-hidden="true"><span style="width:${100 * row.stockPay / highestStockPay}%"></span></span><strong>${distributionMoney(row.stockPay)}</strong></li>`).join("")}
        </ul>
        <ol class="distribution-timeline" aria-label="Selected moments in Amazon’s employee equity history">
          <li><time datetime="1994">1994</time><div><h5>Stock options for early employees</h5><p>Amazon’s 1994 plan let employees and other eligible contributors participate in the company’s growth through options. By May 1997, holders had exercised options covering about 1.8 million shares under that plan.</p>${externalLink(amazonSources.ipo,"IPO prospectus, employee benefit plans")}</div></li>
          <li><time datetime="1997-05">May 1997</time><div><h5>Amazon goes public</h5><p>The IPO priced shares at $18 before later stock splits. Some early holders faced a 180-day lockup. Their eventual proceeds depended on when they were able to sell and what they received.</p>${externalLink(amazonSources.ipo,"IPO prospectus, shares eligible for future sale")}</div></li>
          <li><time datetime="2024">2024</time><div><h5>${decimal.format(last.unitsVested)} million restricted stock units vested</h5><p>This is the number of units that finished vesting during the year. Public company totals leave individual employee holdings and sale proceeds unknown.</p>${externalLink(amazonSources.annual,"Amazon’s annual report, stock-based compensation")}</div></li>
        </ol>
      </div>
    </section>`;
}

function bindAmazonDistribution(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  function activateTab(index, focus = false) {
    tabs.forEach((tab,i) => {
      const active = i === index;
      tab.setAttribute("aria-selected",String(active));
      tab.tabIndex = active ? 0 : -1;
      byId(tab.getAttribute("aria-controls")).hidden = !active;
    });
    if (focus) tabs[index].focus();
  }
  tabs.forEach((tab,index) => {
    tab.addEventListener("click",() => activateTab(index));
    tab.addEventListener("keydown",event => {
      const indices = {ArrowLeft:(index+tabs.length-1)%tabs.length,ArrowRight:(index+1)%tabs.length,Home:0,End:tabs.length-1};
      if (!(event.key in indices)) return;
      event.preventDefault();
      activateTab(indices[event.key],true);
    });
  });

  const holderButtons = root.querySelectorAll(".ownership-choices button");
  const holderDetails = root.querySelectorAll("[data-owner-detail]");
  function selectHolder(index) {
    holderButtons.forEach((button,i) => button.setAttribute("aria-pressed",String(i === index)));
    holderDetails.forEach((detail,i) => { detail.hidden = i !== index; });
  }
  root.addEventListener("click",event => {
    const selector = event.target.closest("[data-owner]");
    if (selector) selectHolder(Number(selector.dataset.owner));
  });
  selectHolder(0);
}

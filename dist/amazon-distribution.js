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
  const founder = holders[0];
  const otherShares = sharesOutstanding - holders.reduce((sum,holder) => sum + holder.shares,0);
  const outsideFounder = sharesOutstanding - founder.shares;
  const entries = [...holders,{
    name:"All remaining shares",type:"Other holdings",shares:otherShares,color:"other",
    description:"This remainder includes other funds and institutions, individuals, and any employees or former employees who still hold shares. The filings here do not identify the people behind these holdings.",
    sources:[[amazonSources.annual,"Amazon’s annual report"]]
  }];
  const equityValue = shares => distributionMoney(shares * yearEndPrice / 1e9);
  const percent = shares => (100 * shares / sharesOutstanding).toFixed(2) + "%";
  const roundPercent = shares => (100 * shares / sharesOutstanding).toFixed(1) + "%";
  const sources = links => links.map(([url,label]) => externalLink(url,label)).join("");
  // Centre of each bar segment, used to point the marker at the selected holding.
  let running = 0;
  const centres = entries.map(holder => {
    const centre = 100 * (running + holder.shares / 2) / sharesOutstanding;
    running += holder.shares;
    return centre;
  });
  const holdingButton = (holder,index) => `<button type="button" data-owner="${index}" aria-pressed="false">
              <span class="ownership-key ownership-${holder.color}" aria-hidden="true"></span>
              <span class="holding-name"><strong>${holder.name}</strong><small>${holder.type}</small></span>
              <span class="holding-amount"><strong>${equityValue(holder.shares)}</strong><small>${percent(holder.shares)}</small></span>
            </button>`;

  const firstYear = amazonHistory[0].year;
  const last = amazonHistory.at(-1);
  const years = `${firstYear}–${last.year}`;
  const cashReturned = amazonHistory.reduce((sum,row) => sum + row.buybacks + row.dividends,0);
  const dividendsPaid = amazonHistory.reduce((sum,row) => sum + row.dividends,0);
  const buybackYears = amazonHistory.filter(row => row.buybacks > 0);
  const cashSummary = [
    dividendsPaid === 0 ? `Amazon paid no cash dividends in ${years}.` : "",
    buybackYears.length === 1 ? `Its only buyback spending in these years was ${distributionMoney(buybackYears[0].buybacks)} in ${buybackYears[0].year}.` : ""
  ].join(" ").trim();
  const highestStockPay = Math.max(...amazonHistory.map(year => year.stockPay));
  const totalStockPay = amazonHistory.reduce((sum,row) => sum + row.stockPay,0);

  return `
    <section id="amazon-distribution" class="distribution" aria-labelledby="distribution-title">
      <header class="distribution-heading">
        <p class="eyebrow">AMAZON CASE STUDY</p>
        <h3 id="distribution-title">Who shares in the value?</h3>
      </header>
      <div class="distribution-tabs" role="tablist" aria-label="Explore Amazon’s value">
        ${distributionViews.map(([key,label],index) => `<button id="distribution-tab-${key}" type="button" role="tab" aria-controls="distribution-${key}" aria-selected="${index === 0}" tabindex="${index === 0 ? "0" : "-1"}">${label}</button>`).join("")}
      </div>
      <div id="distribution-ownership" class="distribution-panel" role="tabpanel" aria-labelledby="distribution-tab-ownership" tabindex="0">
        <div class="distribution-subhead">
          <div><h4>Who held Amazon shares?</h4><p>Year-end 2024 · ${equityValue(sharesOutstanding)} equity value (reported shares × year-end price). The ${compactMoney(leader.cap)} market value above is CompaniesMarketCap’s estimate.</p></div>
        </div>
        <div class="ownership-takeaway">
          <p class="ownership-headline"><span>Jeff Bezos held <strong class="is-founder">${roundPercent(founder.shares)}</strong> of Amazon directly.</span> <span>Everyone else held <strong>${roundPercent(outsideFounder)}</strong>.</span></p>
          <p>Worth <strong>${equityValue(outsideFounder)}</strong> at the year-end price, held by index funds, pension systems such as CalPERS, other institutions, individuals, and employees or former employees who still hold shares.</p>
        </div>
        <div class="ownership-figure" aria-hidden="true">
          <span class="ownership-marker"></span>
          <div class="ownership-bar">
            ${entries.map((holder,index) => `<span data-owner="${index}" data-centre="${centres[index].toFixed(3)}" class="ownership-${holder.color}" style="flex-grow:${holder.shares}" title="${holder.name}: ${percent(holder.shares)} · ${equityValue(holder.shares)}"></span>`).join("")}
          </div>
          <div class="ownership-scale">
            <div class="scale-founder" style="flex-grow:${founder.shares}"><span>Jeff Bezos <b>${roundPercent(founder.shares)}</b></span></div>
            <div class="scale-others" style="flex-grow:${outsideFounder}"><span>Everyone else <b>${roundPercent(outsideFounder)}</b></span></div>
          </div>
        </div>
        <div class="ownership-breakdown">
          <div class="ownership-choices" role="group" aria-label="Select a holding">
            <p class="ownership-group"><span>Founder</span></p>
            ${holdingButton(entries[0],0)}
            <p class="ownership-group ownership-group-others"><span>Everyone else</span><span>${equityValue(outsideFounder)} · ${roundPercent(outsideFounder)}</span></p>
            ${entries.slice(1).map((holder,index) => holdingButton(holder,index + 1)).join("")}
          </div>
          <div class="ownership-detail" aria-live="polite">
            ${entries.map((holder,index) => `<div data-owner-detail="${index}" class="ownership-${holder.color}" hidden>
              <p class="ownership-detail-type">${holder.type}</p>
              <h5>${holder.name}</h5>
              <p class="ownership-detail-figures"><strong>${equityValue(holder.shares)}</strong><span>${percent(holder.shares)} of shares outstanding</span></p>
              <p class="ownership-share-count">${integer.format(holder.shares)} shares</p>
              <p>${holder.description}</p>
              <div class="sources">${sources(holder.sources)}</div>
            </div>`).join("")}
          </div>
        </div>
        <p class="distribution-note"><strong>${integer.format(registeredShareholders)} registered shareholders</strong> as of January 29, 2025. One brokerage can be a single registered holder for many customers, so more people hold indirect stakes. ${externalLink(amazonSources.annual,"Amazon’s annual report")}</p>
        <details class="distribution-method"><summary>Method</summary>
          <p>Reported share counts × the December 31 price of ${'$' + yearEndPrice.toFixed(2)}, with about ${(sharesOutstanding / 1e9).toFixed(3)} billion shares outstanding at year-end. The founder’s stake is from his November 2024 Form 4, confirmed by the following proxy after excluding voting-only shares. Each fund or pension shows its reported position only, at one point in time.</p>
          <div class="sources">${sources([[amazonSources.annual,"Shares outstanding"],[amazonSources.fiveHundred,"Year-end fund valuation"]])}</div>
        </details>
      </div>
      <div id="distribution-cash" class="distribution-panel" role="tabpanel" aria-labelledby="distribution-tab-cash" tabindex="0" hidden>
        <div class="distribution-subhead">
          <div><h4>What did Amazon pay to shareholders?</h4><p>Cash dividends and stock buybacks · Fiscal years ${years}</p></div>
          <div class="distribution-total"><strong>${distributionMoney(cashReturned)}</strong><span>Total cash returned</span></div>
        </div>
        ${cashSummary ? `<p class="distribution-lede">${cashSummary}</p>` : ""}
        <table class="distribution-table">
          <thead><tr><th scope="col">Year</th><th scope="col">Cash dividends</th><th scope="col">Stock buybacks</th></tr></thead>
          <tbody>${amazonHistory.map(row => `<tr><th scope="row">${row.year}</th><td${row.dividends === 0 ? ' class="is-zero"' : ""}>${distributionMoney(row.dividends)}</td><td${row.buybacks === 0 ? ' class="is-zero"' : ""}>${distributionMoney(row.buybacks)}</td></tr>`).join("")}</tbody>
          <tfoot><tr><th scope="row">Total</th><td>${distributionMoney(dividendsPaid)}</td><td>${distributionMoney(cashReturned - dividendsPaid)}</td></tr></tfoot>
        </table>
        <p class="distribution-note">Buybacks pay whoever sells shares back to Amazon, generally unidentified. Sales between investors also turn shares into cash, outside these figures.</p>
        <div class="sources">${sources([[amazonSources.annual,"Amazon’s annual report and cash flow statement"]])}</div>
      </div>
      <div id="distribution-workers" class="distribution-panel" role="tabpanel" aria-labelledby="distribution-tab-workers" tabindex="0" hidden>
        <div class="distribution-subhead">
          <div><h4>How did workers participate?</h4></div>
        </div>
        <div class="worker-totals">
          <div><strong>${integer.format(leader.jobs)}</strong><span>People employed at year-end 2024</span></div>
          <div><strong>${distributionMoney(leader.payroll)}</strong><span>${metrics.payroll}</span></div>
          <div><strong>${distributionMoney(last.stockPay)}</strong><span>Stock-based compensation expense in 2024</span></div>
        </div>
        <p class="distribution-note">Pay is our estimate (people employed × assumed yearly pay); stock-based compensation is Amazon’s recorded expense. The bases differ, and what an employee received depends on what vested and when they sold.</p>
        <div class="worker-equity-head">
          <h5 class="distribution-mini-heading">Stock-based compensation expense</h5>
          <p>${distributionMoney(totalStockPay)} over ${years}</p>
        </div>
        <ul class="worker-equity" aria-label="Annual stock-based compensation expense in billions of US dollars">
          ${amazonHistory.map(row => `<li><span class="worker-year">${row.year}</span><span class="worker-track" aria-hidden="true"><span style="width:${100 * row.stockPay / highestStockPay}%"></span></span><strong>${distributionMoney(row.stockPay)}</strong></li>`).join("")}
        </ul>
        <h5 class="distribution-mini-heading distribution-timeline-heading">Employee ownership over time</h5>
        <ol class="distribution-timeline" aria-label="Selected moments in Amazon’s employee equity history">
          <li><time datetime="1994">1994</time><div><h5>Stock options for early employees</h5><p>Amazon’s 1994 plan let employees and other eligible contributors share in the company’s growth through options. By May 1997, holders had exercised options covering about 1.8 million shares under that plan.</p>${externalLink(amazonSources.ipo,"IPO prospectus, employee benefit plans")}</div></li>
          <li><time datetime="1997-05">May 1997</time><div><h5>Amazon goes public</h5><p>The IPO priced shares at $18 before later stock splits. Some early holders faced a 180-day lockup.</p>${externalLink(amazonSources.ipo,"IPO prospectus, shares eligible for future sale")}</div></li>
          <li><time datetime="2024">2024</time><div><h5>${decimal.format(last.unitsVested)} million restricted stock units vested</h5><p>Company-wide totals don’t show individual employees’ holdings or what they received when they sold.</p>${externalLink(amazonSources.annual,"Amazon’s annual report, stock-based compensation")}</div></li>
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

  const holderButtons = [...root.querySelectorAll(".ownership-choices button")];
  const holderDetails = root.querySelectorAll("[data-owner-detail]");
  const segments = [...root.querySelectorAll(".ownership-bar [data-owner]")];
  const figure = root.querySelector(".ownership-figure");
  const marker = root.querySelector(".ownership-marker");
  function selectHolder(index) {
    holderButtons.forEach(button => button.setAttribute("aria-pressed",String(Number(button.dataset.owner) === index)));
    holderDetails.forEach((detail,i) => { detail.hidden = i !== index; });
    segments.forEach((segment,i) => segment.classList.toggle("is-selected",i === index));
    marker.style.left = segments[index].dataset.centre + "%";
    marker.className = "ownership-marker " + segments[index].classList[0];
  }
  // Light up one holding across the bar and the list while it is hovered or focused.
  function highlight(index) {
    const lit = index === null ? null : Number(index);
    figure.classList.toggle("is-highlighting",lit !== null);
    segments.forEach((segment,i) => segment.classList.toggle("is-lit",i === lit));
    holderButtons.forEach(button => button.classList.toggle("is-lit",Number(button.dataset.owner) === lit));
  }
  root.addEventListener("click",event => {
    const selector = event.target.closest("[data-owner]");
    if (selector) selectHolder(Number(selector.dataset.owner));
  });
  root.addEventListener("pointerover",event => {
    const target = event.target.closest(".ownership-bar [data-owner], .ownership-choices [data-owner]");
    highlight(target ? target.dataset.owner : null);
  });
  root.addEventListener("pointerleave",() => highlight(null));
  holderButtons.forEach((button,position) => {
    button.addEventListener("focus",() => highlight(button.dataset.owner));
    button.addEventListener("blur",() => highlight(null));
    button.addEventListener("keydown",event => {
      const last = holderButtons.length - 1;
      const next = {ArrowDown:Math.min(position + 1,last),ArrowUp:Math.max(position - 1,0),Home:0,End:last}[event.key];
      if (next === undefined) return;
      event.preventDefault();
      holderButtons[next].focus();
      selectHolder(Number(holderButtons[next].dataset.owner));
    });
  });
  selectHolder(0);
}

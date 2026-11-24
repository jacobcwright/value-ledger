const amazonMarkets = [
  {id:"US",name:"United States",lat:39,lon:-98,sales:438.015},
  {id:"DE",name:"Germany",lat:51,lon:10.2,sales:40.856},
  {id:"GB",name:"United Kingdom",lat:53.5,lon:-2.4,sales:37.855},
  {id:"JP",name:"Japan",lat:36.5,lon:138,sales:27.401},
  {id:"other",name:"Other markets",sales:93.832}
];
const amazonSiteTypes = {
  fulfillment:{label:"Fulfillment",color:"#ffd084"},
  cloud:{label:"Cloud infrastructure",color:"#b5a5f5"},
  office:{label:"Offices",color:"#82d7d4"}
};
const amazonSites = [
  {
    name:"Shreveport fulfillment center",place:"Louisiana, US",country:"US",state:"22",lat:32.47,lon:-93.92,type:"fulfillment",
    metric:"3M+ sq ft",basis:"Facility floor area reported in 2024",
    description:"Workers and robotics receive, store, pick, pack, and ship customer orders across five floors.",
    url:"https://www.aboutamazon.com/news/operations/amazon-fulfillment-center-robotics-ai"
  },
  {
    name:"Mount Juliet fulfillment center",place:"Tennessee, US",country:"US",state:"47",lat:36.18,lon:-86.47,type:"fulfillment",
    metric:"Up to 500,000 packages a day",basis:"Daily handling capacity reported in 2024",
    description:"Workers pick, pack, and ship books, electronics, and other small items. Amazon reported more than 2,500 full-time staff at the site in 2024.",
    url:"https://assets.aboutamazon.com/dc/38/245151b84f21ac394f80819c5124/delivering-the-future-2024-fact-sheet.pdf"
  },
  {
    name:"Spokane fulfillment center",place:"Washington, US",country:"US",state:"53",lat:47.64,lon:-117.57,type:"fulfillment",
    metric:"600,000+ sq ft",basis:"Facility size announced in 2018",
    description:"Workers pick, pack, and ship small products such as games, school supplies, and pet products.",
    url:"https://press.aboutamazon.com/2018/7/amazon-announces-new-fulfillment-center-in-spokane"
  },
  {
    name:"Kansas City fulfillment center",place:"Kansas, US",country:"US",state:"20",lat:39.14,lon:-94.81,type:"fulfillment",
    metric:"1M sq ft",basis:"Facility size announced in 2020",
    description:"This warehouse handles large goods including patio furniture, outdoor equipment, and rugs.",
    url:"https://press.aboutamazon.com/news-releases/news-release-details/amazon-announces-two-new-fulfillment-centers-kansas/"
  },
  {
    name:"AWS Ohio region",place:"Ohio, US",country:"US",state:"39",lat:40.0,lon:-83.0,type:"cloud",
    metric:">$23B",basis:"Data center expansion investment forecast by 2030, reported in December 2024",
    description:"AWS data centers in Ohio provide computing and storage. Amazon estimates its Ohio cloud infrastructure investment contributed $3.8B to state GDP through 2023. The pin represents the wider Ohio region.",
    url:"https://www.aboutamazon.com/news/aws/aws-continues-to-invest-in-ohio"
  },
  {
    name:"HQ2 at Metropolitan Park",place:"Arlington, US",country:"US",state:"51",lat:38.86,lon:-77.05,type:"office",
    metric:"$2.5B",basis:"Announced HQ2 and surrounding-area investment commitment",
    description:"Metropolitan Park, which opened in 2023, is the first phase of Amazon’s second headquarters. The commitment includes the wider HQ2 development.",
    url:"https://assets.aboutamazon.com/eb/00/2f455a504615981e0417848a5d56/amazon-community-impact-report-capital-region-v2.pdf"
  },
  {
    name:"Tilbury fulfillment center",place:"Essex, UK",country:"GB",lat:51.46,lon:0.38,type:"fulfillment",
    metric:"2M sq ft",basis:"Operating space reported in 2020",
    description:"The robotics warehouse opened in 2017 and prepares customer orders for shipment.",
    url:"https://www.aboutamazon.co.uk/news/sustainability/amazon-unveils-its-largest-fulfilment-centre-solar-panel-installation-in-europe"
  },
  {
    name:"Achim fulfillment center",place:"Lower Saxony, Germany",country:"DE",lat:53.04,lon:9.04,type:"fulfillment",
    metric:"1,900 people",basis:"Non-holiday-season employment reported in 2021",
    description:"The fulfillment center opened near Bremen in 2021. Staff work with robots to move stock and prepare orders.",
    url:"https://www.aboutamazon.de/news/logistik-und-zustellung/jahresrueckblick-2021-ueber-3-000-neue-feste-stellen-in-der-logistik"
  },
  {
    name:"Großenkneten fulfillment center",place:"Lower Saxony, Germany",country:"DE",lat:52.94,lon:8.26,type:"fulfillment",
    metric:"1,500+ jobs",basis:"Jobs reported around six months after opening in 2023",
    description:"Amazon’s BRE2 warehouse processes customer orders with the help of transport robots.",
    url:"https://www.aboutamazon.de/news/logistik-und-zustellung/arbeiten-bei-amazon-10-gute-gruende-fuer-jobs-in-grossenkneten"
  },
  {
    name:"Chiba Minato fulfillment center",place:"Chiba, Japan",country:"JP",lat:35.6,lon:140.08,type:"fulfillment",
    metric:"17M+ items",basis:"Designed storage capacity reported in 2023",
    description:"A 120,000-square-metre facility stores goods and prepares orders. Robots bring shelves to workers, who pick products for shipment.",
    url:"https://www.aboutamazon.jp/news/delivery-and-logistics/how-to-build-one-of-the-largest-fulfilment-centers-in-japan"
  },
  {
    name:"AWS Tokyo and Osaka",place:"Japan",country:"JP",lat:35.68,lon:139.67,type:"cloud",
    metric:"¥2.26T",basis:"Cloud infrastructure investment plan through 2027, announced in 2024",
    description:"This announcement covered both the Tokyo and Osaka cloud regions. The pin marks Tokyo.",
    url:"https://press.aboutamazon.com/aws/2024/1/aws-plans-to-invest-2-26-trillion-yen-into-its-japanese-cloud-infrastructure-by-2027"
  },
  {
    name:"Cajamar distribution center",place:"São Paulo, Brazil",country:"other",lat:-23.36,lon:-46.88,type:"fulfillment",
    description:"Amazon opened a new logistics center here in 2025 to improve delivery speed. The launch brought its Brazilian distribution network to 12 centers at that time.",
    url:"https://www.aboutamazon.com.br/noticias/noticias-da-empresa/aumentando-velocidade-de-entrega-em-todo-o-brasil-amazon-inaugura-centro-de-distribuicao-em-sao-paulo"
  }
];
const marketHeat = {
  US:{color:"#ff6f3d",rgb:"255, 98, 58",glow:.72},
  DE:{color:"#ffbc6c",rgb:"255, 182, 91",glow:.44},
  GB:{color:"#ffae6c",rgb:"255, 171, 100",glow:.39},
  JP:{color:"#ffd087",rgb:"255, 198, 118",glow:.35}
};
const amazonSalesTotal = amazonMarkets.reduce((sum,market) => sum + market.sales,0);

const amazonLayers = ["markets","states","sites"];
const amazonShare = sales => 100 * sales / amazonSalesTotal;
const amazonSiteCountry = site => site.place.split(", ").pop();

function amazonFootprint() {
  return `
    <section class="amazon-footprint" id="amazon-footprint" aria-labelledby="amazon-footprint-title">
      <header class="amazon-map-header">
        <div class="amazon-map-heading">
          <p class="amazon-map-kicker">Reach</p>
          <h3 id="amazon-footprint-title">Where Amazon creates value</h3>
          <p class="amazon-map-lede"><span id="amazon-layer-description">Amazon’s 2024 net sales by market</span></p>
          <p class="amazon-map-takeaway" id="amazon-layer-takeaway"></p>
        </div>
        <div class="amazon-map-switch" role="group" aria-label="Globe layer" style="--active:0">
          <button type="button" data-layer="markets" aria-pressed="true">Markets</button>
          <button type="button" data-layer="states" aria-pressed="false">U.S. states</button>
          <button type="button" data-layer="sites" aria-pressed="false">Sites</button>
        </div>
      </header>
      <div class="amazon-map-layout" id="amazon-map-layout">
        <div class="amazon-world">
          <canvas id="amazon-globe" tabindex="0" aria-label="Amazon globe. Use the arrow keys to rotate, plus or minus to zoom, or choose an entry in the list."></canvas>
          <div class="amazon-heat-legend" id="amazon-legend"></div>
          <div class="zoom" aria-label="Globe zoom">
            <button type="button" data-zoom="-1" aria-label="Zoom out">−</button><button type="button" data-zoom="1" aria-label="Zoom in">+</button>
          </div>
        </div>
        <div class="amazon-map-panel">
          <div id="amazon-map-list" class="amazon-map-list" role="group" aria-label="Globe locations"></div>
          <div id="amazon-map-detail" class="amazon-map-detail" aria-live="polite"></div>
        </div>
      </div>
      ${typeof amazonStatesView === "function" ? amazonStatesView() : '<div id="amazon-states-view" class="amazon-states-view" hidden></div>'}
      <footer class="amazon-map-notes">
        <p id="amazon-map-note">Sales are by country storefront, or by selling entity for AWS. Other markets are grouped in Amazon’s filing.</p>
        <div id="amazon-map-source" class="amazon-map-source">${externalLink(amazonSources.annual,"2024 annual report, Note 10")}</div>
      </footer>
    </section>`;
}

// The globe, market mask and state map load on demand (mapScripts in company-footprint.js); the header, layer
// switch and panel shell render at once, so app.js can scroll to the panel and focus the switch straight away.
// Returns the controller synchronously, as app.js expects; it binds once the scripts have arrived.
function bindAmazonFootprint(root, initialLayer = "markets") {
  let controller = null, dead = false;
  const files = ["globe.js","amazon-market-mask.js","amazon-state-data.js","amazon-state-map.js"];
  const ready = typeof mapScripts === "function" ? mapScripts(files) : Promise.resolve();
  ready.then(() => {
    if (dead || !root.isConnected) return;
    const placeholder = byId("amazon-states-view");
    if (placeholder && !placeholder.firstElementChild) placeholder.outerHTML = amazonStatesView();
    const focused = root.contains(document.activeElement) && document.activeElement.matches("[data-layer]");
    controller = amazonBindFootprint(root,initialLayer);
    // A deep link focused the switch before the panel was bound: keep focus on the layer now shown.
    if (focused) root.querySelector("[data-layer][aria-pressed='true']")?.focus({preventScroll:true});
  }).catch(error => console.error(error));
  return {destroy() { dead = true; controller?.destroy(); }};
}

function amazonBindFootprint(root, initialLayer) {
  const canvas = root.querySelector("canvas");
  const list = byId("amazon-map-list");
  const detail = byId("amazon-map-detail");
  const note = byId("amazon-map-note");
  const source = byId("amazon-map-source");
  const statesView = byId("amazon-states-view");
  const layout = byId("amazon-map-layout");
  const switcher = root.querySelector(".amazon-map-switch");
  const takeaway = byId("amazon-layer-takeaway");
  const panel = root.querySelector(".amazon-map-panel");
  let layer, globe, entries, current = -1;
  // Shared with company-footprint.js (always loaded): on a narrow panel the card follows the selected row, and a
  // tap on the globe scrolls it into view. Without that file the card simply stays under the list.
  const place = index => typeof mapPlaceDetail === "function" && mapPlaceDetail(panel,list,detail,index);
  const reveal = () => typeof mapReveal === "function" && mapReveal(detail);

  // Restart a short CSS entrance animation on an element.
  function enter(element) {
    element.classList.remove("amazon-enter");
    void element.offsetWidth;
    element.classList.add("amazon-enter");
  }

  function choose(index, focus = false, fromTap = false) {
    const item = entries[index];
    if (!item) return;
    current = index;
    list.querySelectorAll("button[data-entry]").forEach((button,i) => {
      button.setAttribute("aria-pressed",String(i === index));
      if (i === index && focus) button.focus();
    });
    if (layer === "markets") {
      const share = amazonShare(item.sales);
      const color = marketHeat[item.id]?.color || "#82908c";
      detail.innerHTML = `<p class="amazon-detail-kicker"><i aria-hidden="true" style="--dot:${color}"></i>2024 net sales</p>
        <h4>${item.name}</h4><strong>${compactMoney(item.sales)}</strong>
        <span class="amazon-detail-share" aria-hidden="true" style="--share:${share}%;--dot:${color}"><span></span></span>
        <p>${decimal.format(share)}% of Amazon’s 2024 net sales.</p>
          <div class="amazon-detail-actions">
          ${item.id === "US" ? `<button type="button" class="map-scope-link" data-open-states>Explore all ${amazonStateData.length} states</button>` : ""}
          <button type="button" class="map-scope-link" data-sites-in="${item.id}">Explore sites in ${item.id === "other" ? "other markets" : "this market"}</button>
        </div>`;
    } else {
      const type = amazonSiteTypes[item.type];
      detail.innerHTML = `<p class="amazon-detail-kicker"><i aria-hidden="true" style="--dot:${type.color}"></i>${type.label} · ${item.place}</p>
        <h4>${item.name}</h4>
        ${item.metric ? `<strong>${item.metric}</strong><p class="amazon-detail-basis">${item.basis}</p>` : ""}
        <p>${item.description}</p>
        ${externalLink(item.url,"Site source")}`;
    }
    place(index);
    enter(detail);
    globe.select(item.lat == null ? -1 : index);
    if (fromTap) reveal();
  }

  // Fade the bottom edge of the list while more rows are hidden below it.
  function updateListFade() {
    list.classList.toggle("has-more",list.scrollHeight - list.scrollTop - list.clientHeight > 4);
  }
  list.addEventListener("scroll",updateListFade,{passive:true});
  // The list resizes when the panel crosses its narrow breakpoint: move the card to match.
  const listObserver = new ResizeObserver(() => { updateListFade(); place(current); });
  listObserver.observe(list);

  function setTakeaway(scope, scopeName) {
    if (layer === "markets") {
      const outside = amazonMarkets.filter(market => market.id !== "US").reduce((sum,market) => sum + market.sales,0);
      takeaway.innerHTML = `<b>${compactMoney(amazonSalesTotal)}</b> in 2024 net sales, with <b>${decimal.format(amazonShare(outside))}%</b> from markets outside the United States.`;
    } else if (layer === "states") {
      const key = root.querySelector("#amazon-state-metric")?.value || "gdp";
      const measure = stateMeasures[key];
      const top = amazonStateData.filter(state => state[key] != null).reduce((best,state) => state[key] > best[key] ? state : best);
      const value = (key === "employees" ? integer.format(top[key]) : compactMoney(top[key])) + (top[key + "Plus"] ? "+" : "");
      const period = measure.period ? ` from ${measure.period.replace("–"," through ")}` : "";
      takeaway.innerHTML = `${top.name} leads with <b>${value}</b> ${key === "employees" ? "" : "in "}${measure.phrase}${period}.`;
    } else {
      const count = entries.length, plural = count === 1 ? "" : "s";
      const countries = new Set(entries.map(amazonSiteCountry)).size;
      takeaway.innerHTML = scopeName
        ? `<b>${count}</b> selected site${plural} in ${scope.country === "other" ? "other markets" : scopeName}.`
        : `<b>${count}</b> selected sites in <b>${countries}</b> countries, from fulfillment centers to cloud regions and offices.`;
    }
  }

  function show(next, scope = {}) {
    globe?.destroy();
    globe = null;
    layer = next;
    const isMarket = layer === "markets", isStates = layer === "states";
    root.querySelectorAll("[data-layer]").forEach(button => button.setAttribute("aria-pressed",String(button.dataset.layer === layer)));
    switcher.style.setProperty("--active",amazonLayers.indexOf(layer));
    layout.hidden = isStates;
    statesView.hidden = !isStates;
    enter(isStates ? statesView : layout);
    if (isStates) {
      byId("amazon-layer-description").textContent = `Amazon’s economic impact across all ${amazonStateData.length} states`;
      setTakeaway();
      note.textContent = "Dollar figures cover 2010 through December 2025; employment figures are snapshots. GDP contribution is an estimate from Amazon’s study with Keystone Strategy, using U.S. Bureau of Economic Analysis methods. A plus sign marks a rounded lower bound.";
      source.innerHTML = externalLink(amazonStateSource,"Amazon’s state investment and impact report");
      return;
    }
    entries = isMarket ? amazonMarkets : amazonSites.filter(site => (
      (!scope.country || site.country === scope.country) && (!scope.state || site.state === scope.state)
    ));
    const scopeName = scope.state ? amazonStateData.find(state => state.id === scope.state).name : amazonMarkets.find(market => market.id === scope.country)?.name;
    byId("amazon-layer-description").textContent = isMarket ? "Amazon’s 2024 net sales by market" : "Selected warehouses, cloud regions, and offices";
    setTakeaway(scope,scopeName);
    const mapped = amazonMarkets.filter(market => marketHeat[market.id]);
    const low = Math.min(...mapped.map(market => market.sales)), high = Math.max(...mapped.map(market => market.sales));
    byId("amazon-legend").innerHTML = isMarket
      ? `<span class="amazon-legend-title">2024 net sales</span><span class="amazon-heat-scale"></span>
        <span class="amazon-legend-range"><span>${compactMoney(low)}</span><span>${compactMoney(high)}</span></span>`
      : `<span class="amazon-legend-title">Site type</span>` + Object.entries(amazonSiteTypes).map(([key,type]) => {
          const count = entries.filter(site => site.type === key).length;
          return `<span class="amazon-legend-item${count ? "" : " is-empty"}"><i style="--dot:${type.color}"></i>${type.label}<em>${count}</em></span>`;
        }).join("");
    note.textContent = isMarket
      ? "Sales are by country storefront, or by selling entity for AWS. Other markets are grouped in Amazon’s filing."
      : "Each site shows the measure Amazon disclosed, such as capacity, jobs or investment; dates and scopes differ.";
    source.innerHTML = isMarket ? externalLink(amazonSources.annual,"2024 annual report, Note 10") : "";
    list.setAttribute("aria-label",isMarket ? "Markets by 2024 net sales" : scopeName ? `Selected sites in ${scopeName}` : "Selected sites");
    list.classList.toggle("is-markets",isMarket);
    current = -1;
    place(-1);
    list.innerHTML = (scopeName ? `<div class="amazon-list-scope"><span>Showing <strong>${scopeName}</strong></span><button type="button" data-all-sites>Show all sites</button></div>` : "") + entries.map((item,index) => {
      const color = isMarket ? marketHeat[item.id]?.color || "#82908c" : amazonSiteTypes[item.type].color;
      if (isMarket) {
        const share = amazonShare(item.sales);
        return `<button type="button" data-entry="${index}" aria-pressed="false" style="--dot:${color};--share:${share}%">
          <i aria-hidden="true"></i><strong>${item.name}</strong><b>${compactMoney(item.sales)}</b>
          <span class="amazon-row-bar" aria-hidden="true"><span></span></span><small class="amazon-row-share">${decimal.format(share)}%<span class="amazon-sr"> of net sales</span></small></button>`;
      }
      return `<button type="button" data-entry="${index}" aria-pressed="false" style="--dot:${color}">
        <i aria-hidden="true"></i><span><strong>${item.name}</strong><small>${item.place} · ${amazonSiteTypes[item.type].label}</small></span></button>`;
    }).join("");
    list.scrollTop = 0;
    updateListFade();
    const heat = isMarket ? new Map(amazonMarkets.flatMap(market => (amazonMarketMask[market.id] || []).map(index => [index,marketHeat[market.id]]))) : null;
    const markers = entries.filter(item => item.lat != null).map(item => [item.name,item.lat,item.lon]);
    globe = createGlobe(canvas,markers,index => choose(index,false,true),{
      arcs:false,heat,ringColor:"#ffd298",
      markers:entries.filter(item => item.lat != null).map(item => isMarket
        ? {...marketHeat[item.id],radius:item.id === "US" ? 6 : 4.1}
        : {color:amazonSiteTypes[item.type].color,radius:3.6})
    });
    choose(0);
  }

  root.addEventListener("change",event => {
    if (event.target.id === "amazon-state-metric" && layer === "states") setTakeaway();
  });
  root.addEventListener("click",event => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.layer && target.dataset.layer !== layer) show(target.dataset.layer);
    if (target.dataset.entry != null) choose(Number(target.dataset.entry),false,true);
    if (target.hasAttribute("data-open-states")) {
      show("states");
      byId("amazon-state-metric").focus();
    }
    if (target.dataset.sitesIn) show("sites",{country:target.dataset.sitesIn});
    if (target.dataset.sitesState) show("sites",{state:target.dataset.sitesState});
    if (target.hasAttribute("data-all-sites")) show("sites");
    if (target.dataset.zoom) globe.magnify(Number(target.dataset.zoom) * .15);
    if (target.dataset.sitesIn || target.dataset.sitesState || target.hasAttribute("data-all-sites")) list.querySelector("[data-entry]")?.focus();
  });

  // Arrow keys move between layers in the switch and between rows in the list.
  switcher.addEventListener("keydown",event => {
    const step = {ArrowLeft:-1,ArrowRight:1}[event.key];
    if (!step) return;
    event.preventDefault();
    const next = amazonLayers[(amazonLayers.indexOf(layer) + step + amazonLayers.length) % amazonLayers.length];
    show(next);
    switcher.querySelector(`[data-layer="${next}"]`).focus();
  });
  list.addEventListener("keydown",event => {
    const current = event.target.closest("button[data-entry]");
    if (!current) return;
    const index = Number(current.dataset.entry), last = entries.length - 1;
    const next = {ArrowDown:Math.min(last,index + 1),ArrowUp:Math.max(0,index - 1),Home:0,End:last}[event.key];
    if (next == null) return;
    event.preventDefault();
    choose(next,true);
  });

  bindAmazonStates(statesView);
  show(initialLayer);
  return {destroy() { globe?.destroy(); listObserver.disconnect(); }};
}

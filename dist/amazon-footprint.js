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

function amazonFootprint() {
  return `
    <section class="amazon-footprint" id="amazon-footprint" aria-labelledby="amazon-footprint-title">
      <header class="amazon-map-header">
        <div><h3 id="amazon-footprint-title">Where Amazon creates value</h3><p id="amazon-layer-description">Amazon’s 2024 net sales by market</p></div>
        <div class="amazon-map-switch" role="group" aria-label="Globe layer">
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
          <div id="amazon-map-list" class="amazon-map-list" aria-label="Globe locations"></div>
          <div id="amazon-map-detail" class="amazon-map-detail" aria-live="polite"></div>
        </div>
      </div>
      ${amazonStatesView()}
      <footer class="amazon-map-notes">
        <p id="amazon-map-note">Hotter colors show higher net sales. Amazon reports sales by country storefront or, for AWS, by selling entity. Site output figures are shown where disclosed in the Sites layer.</p>
        <div id="amazon-map-source">${externalLink(amazonSources.annual,"2024 annual report, Note 10")}</div>
      </footer>
    </section>`;
}

function bindAmazonFootprint(root, initialLayer = "markets") {
  const canvas = root.querySelector("canvas");
  const list = byId("amazon-map-list");
  const detail = byId("amazon-map-detail");
  const note = byId("amazon-map-note");
  const source = byId("amazon-map-source");
  const statesView = byId("amazon-states-view");
  let layer, globe, entries;

  function choose(index) {
    const item = entries[index];
    if (!item) return;
    list.querySelectorAll("button[data-entry]").forEach((button,i) => button.setAttribute("aria-pressed",String(i === index)));
    if (layer === "markets") {
      detail.innerHTML = `<h4>${item.name}</h4><strong>${compactMoney(item.sales)}</strong>
        <p>${decimal.format(100 * item.sales / amazonSalesTotal)}% of Amazon’s 2024 net sales.</p>
        ${item.id === "other" ? "<p>Amazon reports these markets as a group in its annual report.</p>" : ""}
        ${item.id === "US" ? '<button type="button" class="map-scope-link" data-open-states>Explore all 50 states</button>' : ""}
        <button type="button" class="map-scope-link" data-sites-in="${item.id}">Explore sites in ${item.id === "other" ? "other markets" : "this market"}</button>`;
    } else {
      detail.innerHTML = `<h4>${item.name}</h4>
        ${item.metric ? `<strong>${item.metric}</strong><p>${item.basis}</p>` : ""}
        <p>${item.description}</p>
        ${externalLink(item.url,"Site source")}`;
    }
    globe.select(item.lat == null ? -1 : index);
  }

  function show(next, scope = {}) {
    globe?.destroy();
    globe = null;
    layer = next;
    const isMarket = layer === "markets", isStates = layer === "states";
    root.querySelectorAll("[data-layer]").forEach(button => button.setAttribute("aria-pressed",String(button.dataset.layer === layer)));
    byId("amazon-map-layout").hidden = isStates;
    statesView.hidden = !isStates;
    if (isStates) {
      byId("amazon-layer-description").textContent = "Amazon’s economic impact across all 50 states";
      note.textContent = "Dollar figures cover 2010 through December 2025. Employment figures are snapshots. GDP contribution is an estimate from Amazon’s economic-impact study with Keystone Strategy, based on U.S. Bureau of Economic Analysis methods. A plus sign indicates a rounded lower bound.";
      source.innerHTML = externalLink(amazonStateSource,"Amazon’s state investment and impact report");
      return;
    }
    entries = isMarket ? amazonMarkets : amazonSites.filter(site => (
      (!scope.country || site.country === scope.country) && (!scope.state || site.state === scope.state)
    ));
    const scopeName = scope.state ? amazonStateData.find(state => state.id === scope.state).name : amazonMarkets.find(market => market.id === scope.country)?.name;
    byId("amazon-layer-description").textContent = isMarket ? "Amazon’s 2024 net sales by market" : "Selected warehouses, cloud regions, and offices";
    byId("amazon-legend").innerHTML = isMarket
      ? '<span class="amazon-heat-scale"></span><span>Lower to higher net sales</span>'
      : Object.values(amazonSiteTypes).map(type => `<span><i style="--dot:${type.color}"></i>${type.label}</span>`).join("");
    note.textContent = isMarket
      ? "Hotter colors show higher net sales. Amazon reports sales by country storefront or, for AWS, by selling entity. Other markets are grouped in its filing."
      : "Site figures show the measure Amazon disclosed, such as shipping capacity, jobs, or an investment commitment. The figures cover different dates and scopes.";
    source.innerHTML = isMarket ? externalLink(amazonSources.annual,"2024 annual report, Note 10") : "";
    list.innerHTML = (scopeName ? `<div class="amazon-list-scope"><span>${scopeName}</span><button type="button" data-all-sites>Show all sites</button></div>` : "") + entries.map((item,index) => {
      const color = isMarket ? marketHeat[item.id]?.color || "#82908c" : amazonSiteTypes[item.type].color;
      return `<button type="button" data-entry="${index}" aria-pressed="false" style="--dot:${color}">
        <i aria-hidden="true"></i><span><strong>${item.name}</strong>${isMarket ? "" : `<small>${item.place} · ${amazonSiteTypes[item.type].label}</small>`}</span>
        ${isMarket ? `<b>${compactMoney(item.sales)}</b>` : ""}</button>`;
    }).join("");
    list.scrollTop = 0;
    const heat = isMarket ? new Map(amazonMarkets.flatMap(market => (amazonMarketMask[market.id] || []).map(index => [index,marketHeat[market.id]]))) : null;
    const markers = entries.filter(item => item.lat != null).map(item => [item.name,item.lat,item.lon]);
    globe = createGlobe(canvas,markers,choose,{
      arcs:false,heat,
      markers:entries.filter(item => item.lat != null).map(item => isMarket
        ? {...marketHeat[item.id],radius:item.id === "US" ? 6 : 4.1}
        : {color:amazonSiteTypes[item.type].color,radius:3.6})
    });
    choose(0);
  }

  root.addEventListener("click",event => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.layer && target.dataset.layer !== layer) show(target.dataset.layer);
    if (target.dataset.entry != null) choose(Number(target.dataset.entry));
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
  bindAmazonStates(statesView);
  show(initialLayer);
  return {destroy() { globe?.destroy(); }};
}

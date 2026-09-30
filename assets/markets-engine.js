(() => {
  const root = document.getElementById('europe-apac-market-heatmap');
  const data = JSON.parse(document.getElementById('europe-apac-heatmap-data').textContent);
  const mode = data.mode || 'apac';
  const control = name => root.querySelector('[data-control="' + name + '"]');
  const fmt = new Intl.NumberFormat('en-US');
  const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const compact = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'm' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : fmt.format(n);
  const OTHER = '__others__';
  const TOTAL = '__total__';
  const cities = data.cities.map((city, id) => ({ id, name: city[0], regions: city[1], apac: Boolean(city[2]), airports: city[3], country: city[4], continent: city[5], subregions: city[6] || [] }));
  const nonstopRoutes = city => (data.nonstopAirports || []).filter(route =>
    !route.status.startsWith('Future') &&
    (city.airports.includes(route.destination_airport) ||
     (city.country === 'KH' && city.name.startsWith('Phnom Penh') && route.destination_airport === 'KTI')));
  const researchedCityIds = new Set(data.nonstopOrigins || []);
  const servedCityIds = new Set(mode === 'singapore' ? cities.filter(city => nonstopRoutes(city).length).map(city => city.id) : []);
  const inRegion = (city, region) => Array.isArray(region) ? !region.length || region.some(id => inRegion(city, id)) : typeof region === 'string' && region.startsWith('c:') ? city.country === region.slice(2) : !region || (region < 0 ? city.subregions.includes(region) : Boolean(city.regions & region));
  const selectedRegions = () => [...control('region').selectedOptions].map(option => option.value.startsWith('c:') ? option.value : Number(option.value));
  const setRegions = values => { for (const option of control('region').options) option.selected = values.includes(option.value.startsWith('c:') ? option.value : Number(option.value)); };
  const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const countries = new Map();
  for (const city of cities) {
    if (!countries.has(city.country)) countries.set(city.country, { name: countryNames.of(city.country), count: 0 });
    countries.get(city.country).count += 1;
  }
  const groupLevel = axis => control(axis + '-group').value;
  const groupKey = (city, axis) => {
    const level = groupLevel(axis);
    return level === 'country' ? 'c:' + city.country : level === 'region' ? 'r:' + city.regions : level === 'subregion' ? 's:' + city.subregions[0] : city.id;
  };
  const market = key => {
    if (typeof key === 'number') return cities[key];
    if (key.startsWith('c:')) return countries.get(key.slice(2));
    const id = Number(key.slice(2));
    return { name: data.regionOptions.find(option => option[1] === id)[0] };
  };
  const matrixCache = new Map();
  let rowSort = { key: null, dir: -1 };
  let colSort = { key: TOTAL, dir: -1 };
  let listSort = { key: 'metric', dir: -1 };
  let listLimit = 30;
  const serviceStatus = key => {
    if (typeof key !== 'number') return 'group';
    const routes = nonstopRoutes(cities[key]);
    return !routes.length ? 'unserved' : routes.every(r => r.status.startsWith('Seasonal')) ? 'seasonal' : 'year-round';
  };
  let shareAxis = 'total';
  let search = null;
  let beforeSearch = null;
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const countryAliases = { usa: 'US', 'united states of america': 'US', america: 'US', uk: 'GB', britain: 'GB', 'great britain': 'GB', uae: 'AE', korea: 'KR', 'south korea': 'KR', vietnam: 'VN', 'russia': 'RU' };
  const cityCodes = {
    nyc: ['New York', 'US'], tyo: ['Tokyo', 'JP'], lon: ['London', 'GB'],
    par: ['Paris', 'FR'], chi: ['Chicago', 'US'], was: ['Washington, DC', 'US'],
    mil: ['Milan', 'IT'], rom: ['Rome', 'IT'], osa: ['Osaka', 'JP'],
    sel: ['Seoul', 'KR'], bjs: ['Beijing', 'CN'], sto: ['Stockholm', 'SE'],
    mow: ['Moscow', 'RU'], yto: ['Toronto', 'CA'], ymq: ['Montreal', 'CA'],
    bue: ['Buenos Aires', 'AR'], sao: ['São Paulo', 'BR'], rio: ['Rio de Janeiro', 'BR'],
    jkt: ['Jakarta', 'ID'], rek: ['Reykjavík', 'IS'], dtt: ['Detroit', 'US'], yea: ['Edmonton', 'CA']
  };
  function resolveTerm(term) {
    const q = normalize(term);
    if (!q) return { ids: new Set(), label: 'Enter a city, country or airport code' };
    const country = countryAliases[q] || [...countries.keys()].find(code => normalize(code) === q || normalize(countries.get(code).name) === q);
    if (country && countries.has(country)) return { country, ids: new Set(cities.filter(city => city.country === country).map(city => city.id)), label: countries.get(country).name };
    const state = (data.states || []).find(state => {
      const name = normalize(state.name);
      return [normalize(state.code), normalize(state.code.slice(3)), name + ' state', name + ' us', 'state of ' + name].includes(q) || (q === name && name !== 'new york');
    });
    if (state) return { ids: new Set(state.cityIds), label: state.name + ' (US state)' };
    const regionAliases = { all: 0, global: 0, worldwide: 0, 'russia and central asia': 256, europe: 1, eu: 1, 'north america': 2, africa: 4, 'sub saharan africa': 4, latam: 8, 'latin america': 8, mena: 16, 'middle east': 16, 'middle east and north africa': 16, oceania: 32, 'south pacific': 32, 'oceania and south pacific': 32, asia: 64, apac: 96, 'asia pacific': 96, 'asia and pacific': 96, 'asia and the pacific': 96, 'indian subcontinent': -22, subcontinent: -22 };
    const regionOption = data.regionOptions.find(([name]) => normalize(name) === q);
    const subregion = (data.subregions || []).find(sub => sub.aliases.some(alias => normalize(alias) === q));
    const region = regionOption ? regionOption[1] : subregion ? subregion.id : regionAliases[q];
    if (region !== undefined) return { region, ids: new Set(cities.filter(city => inRegion(city, region)).map(city => city.id)), label: region === 96 ? 'Asia Pacific (Asia + Oceania)' : data.regionOptions.find(option => option[1] === region)[0] };
    if (cityCodes[q]) {
      const [name, countryCode] = cityCodes[q];
      const matches = cities.filter(city => city.name === name && city.country === countryCode);
      return { ids: new Set(matches.map(city => city.id)), label: name };
    }
    const airportMatches = cities.filter(city => city.airports.some(code => normalize(code) === q));
    if (airportMatches.length) return { ids: new Set(airportMatches.map(city => city.id)), label: airportMatches.map(city => city.name).join(', ') };
    const exact = cities.filter(city => normalize(city.name) === q);
    const matches = exact.length ? exact : cities.filter(city => normalize(city.name).includes(q));
    return { ids: new Set(matches.map(city => city.id)), label: exact.length === 1 ? exact[0].name : term.trim() };
  }
  function resolveTerms(text) {
    // Preserve city names containing commas, such as Washington, DC.
    if (cities.some(city => normalize(city.name) === normalize(text))) return resolveTerm(text);
    const terms = text.split(',').map(term => term.trim()).filter(Boolean);
    if (terms.length <= 1) return resolveTerm(text);
    const matches = terms.map(resolveTerm);
    return {
      ids: new Set(matches.flatMap(match => [...match.ids])),
      label: [...new Set(matches.map(match => match.label))].join(', ')
    };
  }
  function resolveSearchSide(text) {
    const parts = text.split(/\s+(?:ex|excluding|except)\s+/i);
    const included = resolveTerms(parts[0]);
    if (parts.length === 1) return included;
    const excluded = parts.slice(1).map(resolveTerms);
    const excludedIds = new Set(excluded.flatMap(match => [...match.ids]));
    return {
      ids: new Set([...included.ids].filter(id => !excludedIds.has(id))),
      label: included.label + ' excluding ' + excluded.map(match => match.label).join(', ')
    };
  }
  function matchesSearch(a, b, includeServed = false) {
    if (!search) return true;
    if (search.service === 'year-round' || search.service === 'seasonal') {
      const routes = mode === 'singapore' ? nonstopRoutes(b) : null;
      const service = mode === 'singapore'
        ? (routes.length ? { seasonal: routes.every(route => route.status.startsWith('Seasonal')) } : null)
        : data.nonstopPairs?.[[a.id, b.id].sort((a, b) => a - b).join('|')];
      if (!service || service.seasonal !== (search.service === 'seasonal')) return false;
    }
    if (search.unserved) {
      if (mode === 'singapore') {
        if (!includeServed && servedCityIds.has(b.id)) return false;
      } else {
        if (!researchedCityIds.has(a.id) && !researchedCityIds.has(b.id)) return false;
        if (!includeServed && data.nonstopPairs?.[[a.id, b.id].sort((a, b) => a - b).join('|')]) return false;
      }
    }
    if (search.to) {
      const forward = search.from.ids.has(a.id) && search.to.ids.has(b.id);
      return forward || (mode !== 'global' && search.to.ids.has(a.id) && search.from.ids.has(b.id));
    }
    if (mode === 'singapore') return search.from.ids.has(b.id);
    return mode === 'global' ? search.from.ids.has(a.id) : search.from.ids.has(a.id) || search.from.ids.has(b.id);
  }

  const configs = {
    share: { total: 'Total (annual pax)', name: 'Passenger demand share (%)', note: 'Sort by displayed percentages · Totals: annual passengers' },
    pax: { total: 'Total (annual pax)', name: 'Annual passengers, both directions', note: 'Annual passengers · Both directions' },
    annual_one: { total: 'Total (annual pax)', name: 'Annual passengers, one direction', note: 'One direction = annual passengers ÷ 2' },
    daily_both: { total: 'Total (daily pax)', name: 'Daily passengers, both directions', note: 'Daily passengers = annual passengers ÷ 365' },
    daily_one: { total: 'Total (daily pax)', name: 'Daily passengers, one direction', note: 'Daily, one direction = annual passengers ÷ 730' },
    fare: { total: 'Overall fare ($)', name: 'Average fare (USD)', note: 'Passenger-weighted one-way fare · USD' },
    rpm: { total: 'Overall RPM', name: 'RPM (USD per mile)', note: 'Estimated fare revenue ÷ passenger-miles · USD/mile' }
  };

  const empty = () => ({ pax: 0, cents: 0, miles: 0 });
  const add = (a, b) => { a.pax += b.pax; a.cents += b.cents; a.miles += b.miles; return a; };
  const stats = pair => ({ pax: pair[2], cents: pair[3], miles: pair[4] });
  const cityLabel = key => {
    if (key === OTHER) return 'Others';
    if (key === TOTAL) return configs[control('metric').value].total;
    const item = market(key);
    return item.name;
  };
  const airportLabel = key => typeof key === 'number' ? cities[key].airports.join(' + ') : market(key).name;
  const node = (tag, text) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el; };
  const tip = (el, text) => { el.setAttribute('data-tooltip', text); el.setAttribute('aria-label', text); };

  function measure(s, metric) {
    if (!s || !s.pax) return null;
    if (metric === 'annual_one') return s.pax / 2;
    if (metric === 'daily_both') return s.pax / 365;
    if (metric === 'daily_one') return s.pax / 730;
    if (metric === 'fare') return s.cents / 100 / s.pax;
    if (metric === 'rpm') return s.miles ? s.cents / 100 / s.miles : null;
    return s.pax;
  }

  function formatted(n, metric) {
    if (n === null || !Number.isFinite(n)) return '—';
    if (metric === 'fare') return money.format(n);
    if (metric === 'rpm') return '$' + n.toFixed(4);
    if (metric.startsWith('daily')) return fmt.format(Math.round(n));
    return compact(n);
  }

  function detail(s, share) {
    if (!s || !s.pax) return 'no matching data under current filters';
    const rpm = s.miles ? '$' + (s.cents / 100 / s.miles).toFixed(4) : '—';
    return fmt.format(s.pax) + ' annual passengers (both directions) · ' +
      decimal.format(s.pax / 2) + ' annual (one direction) · ' +
      fmt.format(Math.round(s.pax / 365)) + ' daily (both directions) · ' +
      fmt.format(Math.round(s.pax / 730)) + ' daily (one direction) · Average fare ' +
      money.format(s.cents / 100 / s.pax) + ' · RPM ' + rpm +
      (share === undefined ? '' : ' · ' + share.toFixed(2) + (shareAxis === 'total' ? '% of total filtered market' : '% of this market ' + shareAxis + ' total'));
  }

  function put(matrix, row, col, value) {
    if (!matrix.has(row)) matrix.set(row, new Map());
    const rowMap = matrix.get(row);
    if (!rowMap.has(col)) rowMap.set(col, empty());
    add(rowMap.get(col), value);
  }

  const cityPairKey = (a, b) => a < b ? a + ':' + b : b + ':' + a;
  const cityPairPax = new Map();
  for (const [a, b, pax] of data.pairs) {
    const key = cityPairKey(a, b);
    cityPairPax.set(key, (cityPairPax.get(key) || 0) + pax);
  }
  const benchmarkPairPax = new Map();
  for (const [a, b, pax] of data.insightPairs || data.pairs) {
    const key = cityPairKey(a, b);
    benchmarkPairPax.set(key, (benchmarkPairPax.get(key) || 0) + pax);
  }
  const minimumPax = () => Math.max(0, Number(control('min-pax').value) || 0);

  function buildMatrix(regionBit, benchmark = null, includeServed = false) {
    const rowRegion = mode === 'global' ? Number(control('row-region').value) : 0;
    const eligibleRow = city => benchmark ? inRegion(city, benchmark.region) : mode === 'global' ? inRegion(city, rowRegion) : mode === 'singapore' ? city.name === 'Singapore' : city.apac;
    const exclusion = control('exclusion').value;
    const minimum = minimumPax();
    const cacheKey = rowRegion + ':' + regionBit + ':' + groupLevel('row') + ':' + groupLevel('col') + ':' + exclusion + ':' + minimum + ':' + (search ? search.query : '') + ':' + includeServed;
    if (!benchmark && matrixCache.has(cacheKey)) return matrixCache.get(cacheKey);
    const entries = [];
    const rowCandidates = cities.filter(eligibleRow);
    const destinationIds = new Set(cities.filter(city => inRegion(city, regionBit) && (benchmark ? benchmark.destinations.has(city.id) : !search ? true : mode === 'global' ? (!search.to || search.to.ids.has(city.id)) : rowCandidates.some(row => matchesSearch(row, city, includeServed)))).map(city => city.id));
    const accepts = (a, b) => benchmark ? benchmark.destinations.has(b.id) : matchesSearch(a, b, includeServed);
    const rowTotals = new Map();
    const colTotals = new Map();
    let includedPairs = 0;

    for (const pair of benchmark ? (data.insightPairs || data.pairs) : data.pairs) {
      const a = cities[pair[0]];
      const b = cities[pair[1]];
      if (a.id === b.id) continue;
      if ((benchmark ? benchmarkPairPax : cityPairPax).get(cityPairKey(a.id, b.id)) < minimum) continue;
      if (exclusion === 'region' && a.regions === b.regions) continue;
      if (exclusion === 'subregion' && a.subregions.some(id => b.subregions.includes(id))) continue;
      if (exclusion === 'country' && a.country === b.country) continue;
      const placements = [];
      if (eligibleRow(a) && inRegion(b, regionBit) && accepts(a, b)) { placements.push([groupKey(a, 'row'), groupKey(b, 'col')]); destinationIds.add(b.id); }
      if (eligibleRow(b) && inRegion(a, regionBit) && accepts(b, a)) {
        destinationIds.add(a.id);
        const r = groupKey(b, 'row'), c = groupKey(a, 'col');
        if (!placements.some(([row, col]) => row === r && col === c)) placements.push([r, c]);
      }
      if (!placements.length) continue;
      const value = stats(pair);
      entries.push({ placements, value, sourceCities: [a.id, b.id] });
      const seenRows = new Set(), seenCols = new Set();
      for (const [row, col] of placements) {
        if (!rowTotals.has(row)) rowTotals.set(row, empty());
        if (!colTotals.has(col)) colTotals.set(col, empty());
        if (!seenRows.has(row)) { add(rowTotals.get(row), value); seenRows.add(row); }
        if (!seenCols.has(col)) { add(colTotals.get(col), value); seenCols.add(col); }
      }
      includedPairs += 1;
    }

    const result = { entries, rowTotals, colTotals, includedPairs, destinationIds };
    if (!benchmark) matrixCache.set(cacheKey, result);
    return result;
  }

  let insightRegion = 96;
  let insightMinimum = 10000;
  let insightSort = { over: { key: 'index', dir: -1 }, leader: { key: 'wins', dir: -1 } };
  let insightCache = null;

  function insightModel(built, region, minimum) {
    const cells = new Map();
    for (const entry of built.entries) for (const [r, c] of entry.placements) put(cells, r, c, entry.value);
    const reference = buildMatrix(0, { region, destinations: built.destinationIds });
    const referenceTotal = reference.entries.reduce((sum, entry) => sum + entry.value.pax, 0);
    const over = [];
    for (const [r, row] of cells) for (const [c, value] of row) {
      const baseline = (reference.colTotals.get(c)?.pax || 0) / referenceTotal;
      const share = value.pax / built.rowTotals.get(r).pax;
      if (value.pax >= minimum && baseline > 0) over.push({ row: r, col: c, name: cityLabel(r) + ' → ' + cityLabel(c), pax: value.pax, share, baseline, index: share / baseline, difference: (share - baseline) * 100 });
    }
    const columns = [...built.colTotals.keys()].sort((a, b) => built.colTotals.get(b).pax - built.colTotals.get(a).pax || cityLabel(a).localeCompare(cityLabel(b))).slice(0, 30);
    const leaders = new Map();
    for (const c of columns) {
      const ranked = [...cells].map(([r, row]) => ({ row: r, col: c, pax: row.get(c)?.pax || 0 })).filter(item => item.pax > 0).sort((a, b) => b.pax - a.pax || cityLabel(a.row).localeCompare(cityLabel(b.row)));
      let rank = 0, previous = -1;
      ranked.forEach((item, i) => {
        if (item.pax !== previous) rank = i + 1;
        previous = item.pax;
        if (rank > 3) return;
        if (!leaders.has(item.row)) leaders.set(item.row, { name: cityLabel(item.row), wins: 0, top3: 0, pax: built.rowTotals.get(item.row).pax, destinations: [] });
        const leader = leaders.get(item.row);
        if (rank === 1) leader.wins++;
        leader.top3++;
        leader.destinations.push({ ...item, rank });
      });
    }
    return { over, leaders: [...leaders.values()], columnCount: columns.length, referenceTotal };
  }

  function renderInsights(built) {
    const host = root.querySelector('[data-insights]');
    if (!host) return;
    if (!insightCache || insightCache.built !== built || insightCache.region !== insightRegion || insightCache.minimum !== insightMinimum) {
      insightCache = { built, region: insightRegion, minimum: insightMinimum, model: insightModel(built, insightRegion, insightMinimum) };
    }
    const model = insightCache.model;
    host.replaceChildren();
    host.append(node('h3', 'Market insights'), node('p', 'Passenger-based comparisons for the current search and filters. Heatmap sorting and cell-value choices do not change these rankings.'));
    const toolbar = node('div'); toolbar.className = 'insight-toolbar';
    const benchmarkLabel = node('label', 'Compare row markets with');
    const benchmarkSelect = node('select'); benchmarkSelect.className = 'form-select';
    const choices = [['APAC (Asia + Oceania)', 96], ...data.regionOptions];
    for (const [name, id] of choices) { const option = node('option', name); option.value = String(id); benchmarkSelect.append(option); }
    benchmarkSelect.value = String(insightRegion);
    benchmarkSelect.addEventListener('change', () => { insightRegion = Number(benchmarkSelect.value); renderInsights(built); });
    benchmarkLabel.append(benchmarkSelect);
    const minLabel = node('label', 'Over-index minimum annual passengers');
    const minInput = node('input'); minInput.type = 'number'; minInput.min = '0'; minInput.step = '1000'; minInput.value = String(insightMinimum);
    minInput.addEventListener('change', () => { insightMinimum = Math.max(0, Number(minInput.value) || 0); renderInsights(built); });
    minLabel.append(minInput); toolbar.append(benchmarkLabel, minLabel); host.append(toolbar);
    const referenceName = choices.find(choice => choice[1] === insightRegion)[0];
    host.append(node('p', 'Benchmark: ' + referenceName + ' to the same destination cities, including markets in Others. Current city-pair exclusions and minimum size apply. ' + ' ' + 'Benchmark volume: ' + compact(model.referenceTotal) + ' annual passengers.'));
    const grid = node('div'); grid.className = 'insight-grid'; host.append(grid);
    const percent = n => n > 0 && n < 0.001 ? '<0.1%' : (n * 100).toFixed(1) + '%';
    const makeTable = (kind, title, explanation, records, columns) => {
      const card = node('section'); card.className = 'insight-card'; card.append(node('h4', title), node('p', explanation));
      const scroller = node('div'); scroller.className = 'insight-scroll';
      const t = node('table'); t.className = 'insight-table';
      const h = node('thead'), b = node('tbody'), tr = node('tr');
      for (const [key, label] of columns) {
        const th = node('th'), active = insightSort[kind].key === key;
        th.setAttribute('scope', 'col'); th.setAttribute('aria-sort', active ? (insightSort[kind].dir < 0 ? 'descending' : 'ascending') : 'none');
        const button = node('button', label + (active ? (insightSort[kind].dir < 0 ? ' ↓' : ' ↑') : ''));
        button.type = 'button'; button.onclick = () => { insightSort[kind] = { key, dir: active ? -insightSort[kind].dir : (key === 'name' ? 1 : -1) }; renderInsights(built); };
        th.append(button); tr.append(th);
      }
      h.append(tr);
      const { key, dir } = insightSort[kind];
      const sorted = records.slice().sort((a, b) => dir * (typeof a[key] === 'string' ? a[key].localeCompare(b[key]) : a[key] - b[key]) || b.pax - a.pax || a.name.localeCompare(b.name));
      for (const record of sorted.slice(0, 30)) {
        const row = node('tr');
        for (const [key] of columns) {
          const cell = node('td');
          if (kind === 'leader' && ['wins', 'top3'].includes(key)) {
            const details = node('details'), summary = node('summary', record[key] + ' / ' + model.columnCount); details.append(summary);
            const list = node('ul');
            for (const item of record.destinations.filter(item => key === 'top3' || item.rank === 1).sort((a, b) => b.pax - a.pax)) list.append(node('li', cityLabel(item.col) + ' · #' + item.rank + ' · ' + compact(item.pax) + ' pax'));
            if (!list.children.length) list.append(node('li', 'No #1 destinations'));
            details.append(list); cell.append(details);
          } else cell.textContent = key === 'share' || key === 'baseline' ? percent(record[key]) : key === 'index' ? record.index.toFixed(2) + '×' : key === 'difference' ? (record.difference > 0 ? '+' : '') + record.difference.toFixed(1) + ' pp' : key === 'pax' ? compact(record.pax) : record[key];
          row.append(cell);
        }
        b.append(row);
      }
      t.append(h, b); scroller.append(t); card.append(scroller);
      card.append(node('p', records.length ? 'Showing ' + Math.min(30, records.length) + ' of ' + records.length + ' markets.' : 'No eligible markets under these filters.'));
      grid.append(card);
    };
    makeTable('over', 'Market over-index', 'Destination share within each row ÷ benchmark destination share. 1× matches the benchmark; 2× is twice the share. Minimum applies to each displayed market pair; all eligible destinations remain in the denominators.', model.over, [['name', 'Market pair'], ['share', 'Row share'], ['baseline', 'Benchmark'], ['index', 'Index'], ['difference', 'Gap'], ['pax', 'Annual pax']]);
    makeTable('leader', 'Market leadership', 'Ranks all matching row markets by passengers for each of the ' + model.columnCount + ' largest destination markets. Click a count to see destinations. Equal volumes share a rank. Counts are within the current search, so a single-row search wins every destination.', model.leaders, [['name', 'Row market'], ['wins', '#1 destinations'], ['top3', 'Top 3 destinations'], ['pax', 'Annual pax']]);
  }

  function choose(axis, key) {
    control('share-basis').value = axis === 'row' ? 'column' : 'row';
    const state = axis === 'row' ? rowSort : colSort;
    if (state.key === key) state.dir *= -1;
    else { state.key = key; state.dir = -1; }
    if (axis === 'row') {
      colSort = { key: null, dir: -1 };
    } else {
      rowSort = { key: null, dir: -1 };
    }
    draw();
  }

  function sortButton(axis, key, tooltip) {
    const state = axis === 'row' ? rowSort : colSort;
    const active = state.key === key;
    const arrow = axis === 'column' ? (state.dir === -1 ? '→ ' : '← ') : (state.dir === -1 ? '↓ ' : '↑ ');
    const button = node('button', (active ? arrow : '') + cityLabel(key));
    button.style.whiteSpace = 'normal';
    button.style.overflowWrap = 'anywhere';
    button.type = 'button';
    button.className = 'btn btn-ghost';
    button.setAttribute('aria-pressed', String(active));
    tip(button, tooltip);
    if (key !== TOTAL && key !== OTHER) button.setAttribute('data-tooltip', airportLabel(key));
    button.onclick = () => choose(axis, key);
    return button;
  }

  function draw() {

    const units = 'markets';
    const metric = control('metric').value;
    const config = configs[metric];
    control('share-basis').disabled = metric !== 'share';
    const filters = [];
    const exclusionLabels = { country: 'Same-country pairs excluded', subregion: 'Same-subregion pairs excluded', region: 'Same-region pairs excluded' };
    if (exclusionLabels[control('exclusion').value]) filters.push(exclusionLabels[control('exclusion').value]);
    if (minimumPax()) filters.push('Minimum ' + fmt.format(minimumPax()) + ' annual passengers per city pair');
    root.querySelector('[data-filter-summary]').textContent = filters.join(' · ') || 'No extra filters';

    const regionBit = selectedRegions();
    const built = buildMatrix(regionBit);
    const allMarkets = mode === 'global' || search ? built : buildMatrix(0);
    const allRows = [...allMarkets.rowTotals.keys()].sort((a, b) => allMarkets.rowTotals.get(b).pax - allMarkets.rowTotals.get(a).pax || cityLabel(a).localeCompare(cityLabel(b)));
    const allCols = [...built.colTotals.keys()].sort((a, b) => built.colTotals.get(b).pax - built.colTotals.get(a).pax || cityLabel(a).localeCompare(cityLabel(b)));
    shareAxis = control('share-basis').value;
    // Rank the full candidate axis before choosing the displayed 30 markets.
    const rankCandidates = (candidates, state, rowAxis) => {
      if (state.key === null) return;
      const opposite = rowAxis ? allCols : allRows;
      if (![TOTAL, OTHER].includes(state.key) && !opposite.includes(state.key)) return;
      const totals = rowAxis ? built.rowTotals : built.colTotals;
      const selected = new Map();
      const oppositeTop = new Set(opposite.slice(0, 30));
      const collect = (matrix, result) => {
        for (const { placements, value } of matrix.entries) {
          const seen = new Set();
          for (const [r, c] of placements) {
            const key = rowAxis ? r : c, other = rowAxis ? c : r;
            if ((state.key === OTHER ? !oppositeTop.has(other) : other === state.key) && !seen.has(key)) {
              if (!result.has(key)) result.set(key, empty());
              add(result.get(key), value); seen.add(key);
            }
          }
        }
      };
      collect(built, selected);
      const basis = search?.unserved ? buildMatrix(regionBit, null, true) : built;
      const basisSelected = new Map();
      collect(basis, basisSelected);
      const grand = basis.entries.reduce((sum, entry) => sum + entry.value.pax, 0);
      const score = key => {
        if (state.key === TOTAL) return measure(totals.get(key), metric) || 0;
        const stats = selected.get(key);
        if (metric !== 'share') return measure(stats, metric) || 0;
        const varyingBasis = rowAxis ? shareAxis === 'row' : shareAxis === 'column';
        const denom = shareAxis === 'total' ? grand : varyingBasis
          ? (rowAxis ? basis.rowTotals : basis.colTotals).get(key)?.pax
          : state.key === OTHER ? [...basisSelected.values()].reduce((sum, s) => sum + s.pax, 0)
          : (rowAxis ? basis.colTotals : basis.rowTotals).get(state.key)?.pax;
        return denom ? (stats?.pax || 0) / denom * 100 : 0;
      };
      candidates.sort((a, b) => state.dir * (score(a) - score(b)) || (totals.get(b)?.pax || 0) - (totals.get(a)?.pax || 0) || cityLabel(a).localeCompare(cityLabel(b)));
    };
    rankCandidates(allRows, rowSort, true);
    const sortScore = key => listSort.key === 'destination' ? cityLabel(key)
      : listSort.key === 'service' ? serviceStatus(key)
      : measure(built.colTotals.get(key), ['fare', 'rpm'].includes(listSort.key) ? listSort.key : metric);
    allCols.sort((a, b) => {
      const av = sortScore(a), bv = sortScore(b);
      if (av == null || bv == null) return av == null && bv == null ? cityLabel(a).localeCompare(cityLabel(b)) : av == null ? 1 : -1;
      const difference = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return listSort.dir * difference || built.colTotals.get(b).pax - built.colTotals.get(a).pax || cityLabel(a).localeCompare(cityLabel(b));
    });
    const topRows = allRows.slice(0, 30);
    const topCols = allCols.slice(0, listLimit || allCols.length);
    // Keep a selected market on its own axis when switching sort direction/axis.
    const retainSelection = (top, candidates, key) => {
      if (candidates.includes(key) && !top.includes(key)) {
        if (top.length === 30) top.pop();
        top.push(key);
      }
    };
    retainSelection(topRows, allRows, colSort.key);
    retainSelection(topCols, allCols, rowSort.key);
    const otherRows = allRows.filter(row => !topRows.includes(row));
    const otherCols = allCols.filter(col => !topCols.includes(col));

    if (!topCols.includes(rowSort.key) && ![TOTAL, OTHER].includes(rowSort.key)) rowSort = { key: null, dir: -1 };
    if (!topRows.includes(colSort.key) && ![null, TOTAL, OTHER].includes(colSort.key)) colSort = { key: null, dir: -1 };

    shareAxis = control('share-basis').value;

    const topRowSet = new Set(topRows);
    const topColSet = new Set(topCols);
    const visibleRows = mode === 'singapore' ? [...topRows] : [...topRows, OTHER];
    const visibleCols = [...topCols, OTHER];
    const cells = new Map(visibleRows.map(row => [row, new Map(visibleCols.map(col => [col, empty()]))]));

    const rowStats = new Map(visibleRows.map(row => [row, empty()]));
    const colStats = new Map(visibleCols.map(col => [col, empty()]));
    const grandStats = empty();
    for (const { placements, value: pairStats } of built.entries) {
      const seenCells = new Set(), seenRows = new Set(), seenCols = new Set();
      for (const [row, col] of placements) {
        const r = topRowSet.has(row) ? row : OTHER;
        const c = topColSet.has(col) ? col : OTHER;
        const key = r + ':' + c;
        if (!seenCells.has(key)) { add(cells.get(r).get(c), pairStats); seenCells.add(key); }
        if (!seenRows.has(r)) { add(rowStats.get(r), pairStats); seenRows.add(r); }
        if (!seenCols.has(c)) { add(colStats.get(c), pairStats); seenCols.add(c); }
      }
      add(grandStats, pairStats);
    }
    // Retain served city-pair values as context without adding them to rankings/totals.
    const contextCells = new Map(visibleRows.map(row => [row, new Map(visibleCols.map(col => [col, empty()]))]));
    const contextRows = new Map(visibleRows.map(row => [row, empty()]));
    const contextCols = new Map(visibleCols.map(col => [col, empty()]));
    const contextTotal = empty();
    if (search?.unserved) for (const { placements, value: pairStats } of buildMatrix(regionBit, null, true).entries) {
      const seenCells = new Set(), seenRows = new Set(), seenCols = new Set();
      for (const [row, col] of placements) {
        const r = topRowSet.has(row) ? row : OTHER, c = topColSet.has(col) ? col : OTHER;
        const key = r + ':' + c;
        if (!seenCells.has(key)) { add(contextCells.get(r).get(c), pairStats); seenCells.add(key); }
        if (!seenRows.has(r)) { add(contextRows.get(r), pairStats); seenRows.add(r); }
        if (!seenCols.has(c)) { add(contextCols.get(c), pairStats); seenCols.add(c); }
      }
      add(contextTotal, pairStats);
    }
    const rowPax = row => rowStats.get(row).pax;
    const colPax = col => colStats.get(col).pax;
    const shareOf = (row, col) => {
      const denominator = search?.unserved
        ? (shareAxis === 'total' ? contextTotal.pax : shareAxis === 'row' ? contextRows.get(row).pax : contextCols.get(col).pax)
        : (shareAxis === 'total' ? grandStats.pax : shareAxis === 'row' ? rowPax(row) : colPax(col));
      return denominator ? cells.get(row).get(col).pax / denominator * 100 : 0;
    };
    const rowValue = row => {
      if (rowSort.key === TOTAL) return measure(rowStats.get(row), metric) || 0;
      if (rowSort.key === null) return 0;
      const s = cells.get(row).get(rowSort.key);
      return metric === 'share' ? shareOf(row, rowSort.key) : measure(s, metric) || 0;
    };
    const colValue = col => {
      if (colSort.key === TOTAL) return measure(colStats.get(col), metric) || 0;
      if (colSort.key === null) return 0;
      const s = cells.get(colSort.key).get(col);
      return metric === 'share' ? shareOf(colSort.key, col) : measure(s, metric) || 0;
    };
    const rows = rowSort.key === null ? topRows.slice() : topRows.slice().sort((a, b) => rowSort.dir * (rowValue(a) - rowValue(b)) || rowPax(b) - rowPax(a) || cityLabel(a).localeCompare(cityLabel(b)));
    const cols = topCols.slice();
    if (mode !== 'singapore') rows.push(OTHER);
    cols.push(OTHER);

    const value = (row, col) => metric === 'share' ? shareOf(row, col) : measure(cells.get(row).get(col), metric);
    const matchedCities = new Set();
    const matchedCityPairs = new Set();
    const unservedCityDemand = new Map();
    for (const entry of built.entries) {
      const [a,b] = entry.sourceCities;
      const destination = cities[a].name === 'Singapore' ? b : a;
      matchedCities.add(destination);
      matchedCityPairs.add(cityPairKey(a,b));
      if (!servedCityIds.has(destination)) unservedCityDemand.set(destination, (unservedCityDemand.get(destination) || 0) + entry.value.pax);
    }
    const servedCities = [...matchedCities].filter(id => servedCityIds.has(id));
    const qualifyingUnservedDemand = [...unservedCityDemand.values()].filter(pax => pax > 20000);
    const coverage = {
      cityPairs: matchedCityPairs.size,
      servedCities: servedCities.length,
      unservedCities: qualifyingUnservedDemand.length,
      seasonalCities: servedCities.filter(id => nonstopRoutes(cities[id]).every(r => r.status.startsWith('Seasonal'))).length,
      unservedDemand: qualifyingUnservedDemand.reduce((sum, pax) => sum + pax, 0)
    };
    root.dispatchEvent(new CustomEvent('marketupdate', {detail: {
      limit: listLimit, total: grandStats, metric, coverage, sort: {...listSort}, count: [...built.colTotals.values()].filter(s => s.pax > 0).length,
      maxAnnualPax: Math.max(0, ...allCols.map(col => built.colTotals.get(col)?.pax || 0)),
      unit: groupLevel('col'), unserved: Boolean(search?.unserved),
      items: cols.map(col => { const s = colStats.get(col); const city = typeof col === 'number' ? cities[col] : null;
        const routes = city ? nonstopRoutes(city) : [];
        return { key: col, label: cityLabel(col), country: city ? countryNames.of(city.country) : '',
          codes: city?.airports || [], stats: s, value: rows.length ? value(rows[0], col) : 0, share: (search?.unserved ? contextTotal.pax : grandStats.pax) ? 100 * s.pax / (search?.unserved ? contextTotal.pax : grandStats.pax) : 0,
          status: !city ? 'group' : !routes.length ? 'unserved' : routes.every(r => r.status.startsWith('Seasonal')) ? 'seasonal' : 'year-round',
          airlines: [...new Set(routes.flatMap(r => r.airlines))].sort() };
      })
    }}));

    for (const status of ['all', 'year-round', 'seasonal', 'unserved']) {
      root.querySelector('[data-service-filter="' + status + '"]')?.setAttribute('aria-pressed', String((search?.service || 'all') === status));
    }
    const searchNote = root.querySelector('[data-search-note]');
    searchNote.hidden = !search;
    searchNote.textContent = search ? (built.includedPairs ? 'Showing ' + search.from.label + (search.to ? ' → ' + search.to.label : '') + (search.unserved ? ' · No listed nonstop service' + (search.topUnserved && listSort.key === 'metric' && listSort.dir === -1 && metric === 'pax' ? ' · Ranked by annual passengers' : '') : search.service === 'seasonal' ? ' · Seasonal nonstop only' : search.service === 'year-round' ? ' · Year-round nonstop' : '') : 'No matching routes under the current filters. Adjust your search or filters.') : '';
  }

  for (const option of data.regionOptions) {
    const el = node('option', (option[1] < 0 ? '↳ ' : '') + option[0]);
    el.value = String(option[1]);
    control('region').append(el);
    if (mode === 'global') {
      const rowOption = node('option', (option[1] < 0 ? '↳ ' : '') + option[0]); rowOption.value = String(option[1]);
      control('row-region').append(rowOption);
    }
  }

  setRegions([0]);

  function updateSearch() {
    const query = control('search').value.trim();
    if (query) {
      if (!beforeSearch) beforeSearch = { exclusion: control('exclusion').value, region: selectedRegions(), rowRegion: mode === 'global' ? control('row-region').value : null };
      const unserved = /\bunserved\b/i.test(query);
      const topUnserved = unserved && /\btop\b/i.test(query);
      const service = unserved ? 'unserved' : /\byear-round\b/i.test(query) ? 'year-round' : /\bseasonal\b/i.test(query) ? 'seasonal' : 'all';
      const marketQuery = query.replace(/\b(?:top|unserved|year-round|seasonal)\b/gi, '').trim() || 'all';
      const parts = marketQuery.replace(/\bUS-([A-Z]{2})\b/gi, 'US $1').split(/\s+to\s+|\s*[→↔–—]\s*|\s*-\s*/i);
      const from = resolveSearchSide(parts[0]);
      const to = parts.length > 1 ? resolveSearchSide(parts.slice(1).join(' ')) : null;
      search = { query, from, to, unserved, topUnserved, service };

      if (service === 'all' || marketQuery !== 'all') {
        if (from.ids.size && (!to || to.ids.size)) control('exclusion').value = 'none';
        setRegions([0]);
        if (mode === 'global') control('row-region').value = '0';
      }
    } else {
      search = null;
      if (beforeSearch) {
        control('exclusion').value = beforeSearch.exclusion;
        setRegions(beforeSearch.region);
        if (mode === 'global') control('row-region').value = beforeSearch.rowRegion;
        beforeSearch = null;
      }
    }
    matrixCache.clear();
    listSort = { key: 'metric', dir: -1 };
    rowSort = { key: null, dir: -1 };
    colSort = { key: TOTAL, dir: -1 };
    control('share-basis').value = 'total';
    draw();
  }
  root.addEventListener('marketlimit', ({detail}) => {
    if (![0, 30, 50].includes(detail.limit)) return;
    listLimit = detail.limit;
    draw();
  });
  root.addEventListener('marketsort', ({detail}) => {
    if (!['destination', 'metric', 'daily', 'share', 'fare', 'rpm', 'service'].includes(detail.key)) return;
    listSort = {key: detail.key, dir: detail.dir === -1 || detail.dir === 1 ? detail.dir : listSort.key === detail.key ? -listSort.dir : ['destination', 'service'].includes(detail.key) ? 1 : -1};
    draw();
  });
  control('search').addEventListener('input', updateSearch);
  control('min-pax').addEventListener('input', draw);
  for (const status of ['all', 'year-round', 'seasonal', 'unserved']) {
    root.querySelector('[data-service-filter="' + status + '"]')?.addEventListener('click', () => {
      const active = search?.service || 'all';
      const next = active === status ? 'all' : status;
      const geography = control('search').value.replace(/\b(?:top|unserved|year-round|seasonal)\b/gi, '').trim();
      control('search').value = [geography, next === 'all' ? '' : next].filter(Boolean).join(' ');
      updateSearch();
    });
  }
  const definitions = root.querySelector('[data-region-definitions]');
  for (const [label, id] of data.regionOptions) {
    if (!id) continue;
    const codes = id < 0 ? data.subregions.find(sub => sub.id === id).countries.split(' ') : [...new Set(cities.filter(city => inRegion(city, id)).map(city => city.country))];
    const line = node('p');
    line.style.marginLeft = id < 0 ? '16px' : '0';
    line.append(node('strong', label + ': '), node('span', codes.map(code => countryNames.of(code)).sort().join(', ')));
    definitions.append(line);
  }
  for (const name of ['metric', 'share-basis', 'region', 'row-group', 'col-group', 'exclusion', 'size-filter', 'min-pax', ...(mode === 'global' ? ['row-region'] : [])]) {
    control(name).addEventListener('change', () => {

      if (!['metric', 'share-basis'].includes(name)) {
        rowSort = { key: null, dir: -1 };
        colSort = { key: TOTAL, dir: -1 };
    control('share-basis').value = 'total';
          }
      draw();
    });
  }
  draw();
})();

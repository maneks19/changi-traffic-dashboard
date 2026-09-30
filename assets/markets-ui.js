(() => {
  const root = document.getElementById('europe-apac-market-heatmap');
  const tabs = [...document.querySelectorAll('[data-dashboard-tab]')];
  const subtitle = document.getElementById('dashboard-subtitle');
  const yearFilters = document.querySelector('header .filters');
  function activate(name, updateHash = true) {
    tabs.forEach(tab => {
      const active = tab.dataset.dashboardTab === name;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    });
    yearFilters.hidden = name === 'markets';
    yearFilters.style.display = name === 'markets' ? 'none' : '';
    subtitle.textContent = name === 'markets' ? 'Singapore market demand & nonstop connectivity' : 'Monthly passenger traffic & aircraft movements';
    document.querySelector('.footer').hidden = name === 'markets';
    if (updateHash) history.replaceState(null, '', name === 'markets' ? '#markets' : '#traffic');
    if (name === 'traffic') window.dispatchEvent(new Event('resize'));
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(tab.dataset.dashboardTab));
    tab.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault(); const next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs.at(-1) : tabs[1-i];
      activate(next.dataset.dashboardTab); next.focus();
    });
  });
  window.addEventListener('hashchange', () => activate(location.hash === '#markets' ? 'markets' : 'traffic', false));
  activate(location.hash === '#markets' ? 'markets' : 'traffic', false);

  const number = new Intl.NumberFormat('en-US');
  const money = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:2});
  const compact = n => n >= 1e6 ? (n/1e6).toFixed(2)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : number.format(Math.round(n));
  const el = (tag, text, className) => { const e = document.createElement(tag); if(text !== undefined)e.textContent=text; if(className)e.className=className; return e; };
  const group = root.querySelector('[data-control="col-group"]');
  group.closest('label').hidden = true;
  const region = root.querySelector('[data-control="region"]');
  region.closest('.region-controls').hidden = true;
  region.multiple = true;
  const metric = root.querySelector('[data-control="metric"]');
  const legend = root.querySelector('.nonstop-legend');
  const groupingRow = el('div', undefined, 'selector-row');
  const serviceToolbar = el('div', undefined, 'service-toolbar');
  const serviceNote = legend.querySelector(':scope > span');
  const directionControl=el('div',undefined,'passenger-direction');
  directionControl.setAttribute('role','group');directionControl.setAttribute('aria-label','Passenger direction');
  [['pax','Both ways'],['annual_one','One way']].forEach(([value,label])=>{
    const button=el('button',label);button.type='button';button.dataset.direction=value;
    button.title=value==='annual_one'?'Estimated as half of demand in both directions':'Demand in both directions';
    button.addEventListener('click',()=>{metric.value=value;metric.dispatchEvent(new Event('change'));directionControl.querySelector('[data-direction="'+value+'"]').focus({preventScroll:true});});
    directionControl.append(button);
  });
  serviceToolbar.append(legend, groupingRow);
  document.getElementById('market-list').before(serviceToolbar, serviceNote);
  serviceNote.classList.add('service-snapshot-note');

  const panel = root.querySelector('.controls-panel');
  const compactFilters = el('div',undefined,'compact-filters');

  const regionPills=el('div',undefined,'region-pill-browser');
  const regionChoices=el('div',undefined,'selector-choices region-main-pills');
  regionPills.append(regionChoices);compactFilters.append(regionPills);
  let openRegion=null;
  const expandedSubregions=new Set();
  const refinements=regionChoices;
  document.addEventListener('click',event=>{if(!event.target.closest('.region-pill-browser, .region-refinement, [data-region-pill]')){openRegion=null;refinements.querySelectorAll('details[open]').forEach(d=>d.open=false);}});
  regionPills.addEventListener('keydown',event=>{if(event.key==='Escape'){openRegion=null;refinements.querySelectorAll('details[open]').forEach(d=>d.open=false);event.target.closest('.region-refinement')?.querySelector('summary')?.focus();}});
  const geography=JSON.parse(document.getElementById('europe-apac-heatmap-data').textContent);
  const countryNames=new Intl.DisplayNames(['en'],{type:'region'});
  const countryCodes=[...new Set(geography.cities.map(city=>city[4]))];
  const subCountries=id=>countryCodes.filter(code=>geography.cities.some(city=>city[4]===code&&(city[6]||[]).includes(Number(id))));
  const more=root.querySelector('.more-filters'); more.hidden=true;
  const minimumInput=root.querySelector('[data-control="min-pax"]');
  minimumInput.value='0';minimumInput.disabled=false;
  panel.prepend(compactFilters);
  const selectedRegionValues=()=>new Set([...region.selectedOptions].map(option=>option.value).filter(value=>value!=='0'));
  function applyRegions(values,focusValue) {
    for(const option of region.options)option.selected=values.size?values.has(option.value):option.value==='0';
    region.dispatchEvent(new Event('change'));
    if(focusValue)regionPills.querySelector('[data-region-pill="'+focusValue+'"]')?.focus({preventScroll:true});
  }
  function renderPills(host, label, options, selected, control, fallback) {
    host.replaceChildren(el('span',label,'selector-label'));
    const choices = el('div',undefined,'selector-choices'); choices.setAttribute('role','group'); choices.setAttribute('aria-label',label);
    options.forEach(option => {
      const button = el('button',option.text.replace(/^↳\s*/,'')); button.type='button';
      button.dataset.pill=control.dataset.control+'-'+option.value;
      button.setAttribute('aria-pressed',String(option.value === selected));
      button.addEventListener('click', () => {
        control.value = fallback !== undefined && control.value === option.value ? fallback : option.value;
        control.dispatchEvent(new Event('change'));
        root.querySelector('[data-pill="'+button.dataset.pill+'"]').focus({preventScroll:true});
      });
      choices.append(button);
    });
    host.append(choices);
  }
  function syncSelectors() {
    renderPills(groupingRow,'Group by',[...group.options],group.value,group);
    for(const code of countryCodes)if(![...region.options].some(o=>o.value==='c:'+code)){const option=el('option',countryNames.of(code));option.value='c:'+code;region.append(option);}
    const selected=selectedRegionValues(),families=[];let family;
    for(const option of region.options){if(option.value==='0'||option.value.startsWith('c:'))continue;if(Number(option.value)>0){family={parent:option,children:[]};families.push(family);}else family.children.push(option);}
    regionChoices.replaceChildren();refinements.replaceChildren();
    const pill=(label,value,pressed,action)=>{const button=el('button',label);button.type='button';button.dataset.regionPill=value;button.setAttribute('aria-pressed',String(pressed));button.addEventListener('click',action);return button;};
    regionChoices.append(pill('All regions','0',!selected.size,()=>{openRegion=null;applyRegions(new Set(),'0');}));
    for(const {parent,children} of families){
      const countryKeys=[...new Set(children.flatMap(child=>subCountries(child.value)))].map(c=>'c:'+c);
      const whole=selected.has(parent.value);
      const partial=children.some(child=>selected.has(child.value))||countryKeys.some(key=>selected.has(key));
      const familyNode=el('div',undefined,'geography-branch');
      familyNode.append(pill(parent.text,parent.value,whole||partial,()=>{
        const next=selectedRegionValues();next.delete(parent.value);
        children.forEach(c=>next.delete(c.value));countryKeys.forEach(key=>next.delete(key));
        if(!whole&&!partial)next.add(parent.value);
        openRegion=parent.value;applyRegions(next,parent.value);
      }));
      if(!whole&&!partial){regionChoices.append(familyNode);continue;}
      const dropdown=el('details',undefined,'region-refinement');dropdown.open=openRegion===parent.value;
      const count=children.filter(c=>selected.has(c.value)).length+countryKeys.filter(c=>selected.has(c)).length;
      const summary=el('summary',parent.text+(whole?'':' · '+count));
      summary.dataset.regionPill=parent.value;summary.setAttribute('aria-label',parent.text+' — '+(whole?'all areas selected':count+' areas selected'));
      summary.append(el('span','⌄','hierarchy-chevron'));dropdown.append(summary);
      dropdown.addEventListener('toggle',()=>{if(!dropdown.isConnected)return;if(dropdown.open){openRegion=parent.value;for(const other of refinements.querySelectorAll('.region-refinement'))if(other!==dropdown)other.open=false;}else if(openRegion===parent.value)openRegion=null;});
      const menu=el('div',undefined,'geography-menu');menu.setAttribute('aria-label',parent.text+' areas');
      menu.append(el('div','Subregions & countries','geography-menu-help'));
      const update=(next,key)=>{openRegion=parent.value;applyRegions(next);refinements.querySelector('[data-geo-check="'+key+'"]')?.focus({preventScroll:true});};
      const checkbox=(label,key,checked,mixed,action)=>{const row=el('label',undefined,'geography-check');const input=el('input');input.type='checkbox';input.checked=checked;input.indeterminate=mixed;input.dataset.geoCheck=key;input.addEventListener('change',()=>action(input.checked));row.append(input,el('span',label));return row;};
      menu.append(checkbox('All '+parent.text,parent.value,whole,partial&&!whole,checked=>{
        const next=selectedRegionValues();next.delete(parent.value);children.forEach(c=>next.delete(c.value));countryKeys.forEach(c=>next.delete(c));if(checked)next.add(parent.value);update(next,parent.value);
      }));
      for(const child of children){
        const codes=subCountries(child.value).sort((a,b)=>countryNames.of(a).localeCompare(countryNames.of(b)));
        const subWhole=whole||selected.has(child.value),subPartial=codes.some(c=>selected.has('c:'+c));
        const section=el('div',undefined,'geography-menu-section');
        const line=el('div',undefined,'geography-menu-subregion');
        line.append(checkbox(child.text.replace(/^↳\s*/,''),child.value,subWhole,subPartial&&!subWhole,checked=>{
          const next=selectedRegionValues();
          if(next.delete(parent.value))children.forEach(c=>next.add(c.value));
          next.delete(child.value);codes.forEach(c=>next.delete('c:'+c));if(checked)next.add(child.value);update(next,child.value);
        }));
        const expand=el('button',undefined,'country-disclosure');expand.type='button';expand.setAttribute('aria-label','Countries in '+child.text.replace(/^↳\s*/,''));expand.setAttribute('aria-expanded',String(expandedSubregions.has(child.value)));
        expand.addEventListener('click',()=>{if(!expandedSubregions.delete(child.value))expandedSubregions.add(child.value);syncSelectors();refinements.querySelector('[data-subregion="'+child.value+'"]')?.focus({preventScroll:true});});expand.dataset.subregion=child.value;line.append(expand);section.append(line);
        if(expandedSubregions.has(child.value)){
          const countries=el('div',undefined,'geography-menu-countries');
          for(const code of codes)countries.append(checkbox(countryNames.of(code),'c:'+code,subWhole||selected.has('c:'+code),false,checked=>{
            const next=selectedRegionValues();
            if(next.delete(parent.value))children.forEach(c=>next.add(c.value));
            if(next.delete(child.value))codes.forEach(c=>next.add('c:'+c));
            if(checked)next.add('c:'+code);else next.delete('c:'+code);update(next,'c:'+code);
          }));section.append(countries);
        }
        menu.append(section);
      }
      dropdown.append(menu);
      const selectedPill=el('div',undefined,'region-selected-pill');
      const remove=el('button','×','remove-region');remove.type='button';remove.setAttribute('aria-label','Clear '+parent.text);remove.title='Clear '+parent.text;
      remove.addEventListener('click',()=>{
        const next=selectedRegionValues();next.delete(parent.value);children.forEach(c=>next.delete(c.value));countryKeys.forEach(c=>next.delete(c));
        openRegion=null;applyRegions(next,parent.value);
      });
      selectedPill.append(dropdown,remove);refinements.append(selectedPill);
    }
  }

  root.querySelector('.more-filters').open = false;
  const caption = el('div', '', 'list-caption');
  const listToolbar=el('div',undefined,'list-toolbar');
  const limitControl=el('div',undefined,'row-limit-control');limitControl.setAttribute('role','group');limitControl.setAttribute('aria-label','Destinations shown');
  limitControl.append(el('span','Rows','selector-label'));
  [30,50,0].forEach(limit=>{
    const button=el('button',limit?String(limit):'All');button.type='button';button.dataset.limit=limit;
    button.setAttribute('aria-label','Show '+(limit||'all')+' destinations');
    button.addEventListener('click',()=>root.dispatchEvent(new CustomEvent('marketlimit',{detail:{limit}})));
    limitControl.append(button);
  });
  listToolbar.append(caption,limitControl);document.getElementById('market-list').before(listToolbar);
  let directionAlignment;
  root.addEventListener('marketupdate', ({detail:d}) => {
    directionAlignment?.disconnect();
    syncSelectors();
    limitControl.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.limit)===d.limit)));
    directionControl.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.direction===d.metric)));
    const divisor = d.metric === 'annual_one' ? 2 : 1;
    const direction = divisor === 2 ? 'One way · estimated' : 'Both directions';

    const summary = document.getElementById('market-summary'); summary.replaceChildren();
    const first = d.items.find(i => i.key !== '__others__' && i.stats.pax);
    const cards = [
      ['Annual passenger demand', compact(d.total.pax / divisor), 'Passengers · '+direction.toLowerCase()],
      ['City pairs', number.format(d.coverage.cityPairs), 'Unique Singapore–destination pairs'],
      ['Cities served', number.format(d.coverage.servedCities), 'Year-round + seasonal nonstop'],
      ['Cities unserved', number.format(d.coverage.unservedCities), '>20K annual passengers · both directions'],
      ['Demand to unserved cities', compact(d.coverage.unservedDemand / divisor), direction+' · cities >20K both ways'],
      ['Seasonal-only cities', number.format(d.coverage.seasonalCities), 'Included in cities served'],
      ['Average one-way fare', d.total.pax ? money.format(d.total.cents / 100 / d.total.pax) : '—', 'Passenger-weighted · USD'],
      ['Top ranked market', first?.label || '—', first ? compact(first.stats.pax / divisor)+' annual passengers · '+direction.toLowerCase() : 'No matching data']
    ];
    cards.forEach(([label,value,note]) => {
      const card = el('div', undefined, 'kpi'); card.append(el('div',label,'summary-label'),el('div',value,'value'),el('div',note,'summary-detail')); summary.append(card);
    });
    const host = document.getElementById('market-list'); host.replaceChildren();
    const table = el('table'); table.setAttribute('aria-label','Singapore destination demand');
    const columns = el('colgroup');
    ['210px', '250px', '110px', '140px', '140px', '120px', '150px'].forEach(width => { const col = el('col'); col.style.width = width; columns.append(col); });
    table.append(columns);
    const head = el('thead'), passengerRow=el('tr');
    const headers = [['destination','Market'], ['metric','Annual passengers'], ['daily','Daily passengers'], ['share','Demand share'], ['fare','Average fare'], ['rpm','Fare per mile'], ['service','Nonstop service']];
    headers.forEach(([key,text],i) => {
      const th = el('th'); th.scope='col';
      const active = d.sort.key === key;
      th.setAttribute('aria-sort', active ? d.sort.dir === -1 ? 'descending' : 'ascending' : 'none');
      const button = el('button', text, 'column-sort'); button.type='button'; button.dataset.sort=key;
      button.setAttribute('aria-label','Sort by '+text);
      const arrow=el('span',active ? d.sort.dir === -1 ? '↓' : '↑' : '↕','sort-arrow'); arrow.setAttribute('aria-hidden','true'); button.append(arrow);
      button.addEventListener('click', () => {
        root.dispatchEvent(new CustomEvent('marketsort', {detail:{key}}));
        root.querySelector('[data-sort="'+key+'"]').focus({preventScroll:true});
      });
      th.append(button);
      if(i===1){
        const header=el('div',undefined,'passenger-header');
        const passengerTitle=el('button','Passengers','passenger-title');passengerTitle.type='button';
        passengerTitle.setAttribute('aria-label','Sort passengers highest to lowest');
        passengerTitle.addEventListener('click',()=>{
          root.dispatchEvent(new CustomEvent('marketsort',{detail:{key:'metric',dir:-1}}));
          root.querySelector('.passenger-title').focus({preventScroll:true});
        });
        header.append(passengerTitle,button);th.replaceChildren(header,directionControl);

      }
      if(i===1||i===2)button.firstChild.textContent=i===1?'Annual':'Daily';
      passengerRow.append(th);
      if(i===5)button.setAttribute('data-tooltip','USD per passenger-mile. Estimated fare revenue divided by passenger-miles (RPM).');
      if(i===6)th.className='service-column';
      if(i>=1 && i<=5)th.className=i===1?'num direction-anchor':'num';
    });
    head.append(passengerRow); table.append(head);
    const body = el('tbody');
    const max = Math.max(1, d.maxAnnualPax || 0);
    let rank = 0;
    for (const item of d.items) {
      if(!item.stats.pax) continue;
      const tr=el('tr', undefined, item.key === '__others__' ? 'others-row' : ''), label=el('td');
      const identity=el('div',undefined,'destination-identity');
      identity.append(el('span',item.key === '__others__' ? '—' : String(++rank),'destination-rank'),el('span',item.label,'destination-name'));
      if(item.country) identity.append(el('span',item.country,'destination-meta'));
      label.append(identity);
      label.title=item.codes.length ? item.label+' · '+item.codes.join(' / ') : item.key === '__others__' ? 'Remaining matching destinations' : item.label;
      const formatted = compact(item.stats.pax / divisor);
      const td=el('td',undefined,'num market-value'+(['daily','share'].includes(d.sort.key)?'':' passenger-emphasis')); td.style.setProperty('--bar', (item.key==='__others__' ? 0 : 100*item.stats.pax/max).toFixed(4)+'%');
      const valueWrap=el('div',undefined,'value-with-bar'), track=el('span',undefined,'demand-bar-track'); track.setAttribute('aria-hidden','true'); track.append(el('span',undefined,'demand-bar-fill')); valueWrap.append(track,el('span',formatted,'demand-number')); td.append(valueWrap);
      td.title=number.format(Math.round(item.stats.pax / divisor))+' annual passengers · '+direction.toLowerCase();
      const daily=el('td',number.format(Math.round(item.stats.pax / divisor / 365)),'num'+(d.sort.key==='daily'?' passenger-emphasis':''));
      daily.title='Annual passengers ÷ 365 · '+direction.toLowerCase();
      const share=el('td',item.share.toFixed(1)+'%','num'+(d.sort.key==='share'?' passenger-emphasis':''));
      share.title=d.unserved ? 'Share of all matching demand, including served markets' : 'Share of total filtered Singapore demand';
      const fare=el('td',money.format(item.stats.cents/100/item.stats.pax),'num');
      const yieldPerMile = item.stats.miles > 0 ? item.stats.cents / 100 / item.stats.miles : null;
      const rpm=el('td',yieldPerMile === null ? '—' : '$'+yieldPerMile.toFixed(4),'num');
      rpm.title='Estimated fare revenue divided by passenger-miles (USD per mile)';
      const service=el('td',undefined,'service-column');
      if(item.status==='group') service.append(el('span','—'));
      else {
        const text={'year-round':'Year-round', seasonal:'Seasonal only', unserved:'Unserved'}[item.status];
        const badge=el('button',undefined,'service-label '+item.status); badge.type='button'; const dot=el('i');dot.setAttribute('aria-hidden','true');badge.append(dot);
        badge.setAttribute('data-tooltip',item.label+' ↔ Singapore · '+text+'\n'+(item.airlines.length ? item.airlines.join(', ') : 'No listed nonstop service')+'\nNonstop status as of 30 September 2026');
        badge.setAttribute('aria-label',text+' for '+item.label+'. '+item.airlines.join(', ')); service.append(badge);
      }
      tr.append(label,td,daily,share,fare,rpm,service); body.append(tr);
    }
    table.append(body); host.append(table);
    // Center on the visible labels, rather than the unequal column boundary.
    directionAlignment=new ResizeObserver(()=>{
      const annual=table.querySelector('[data-sort="metric"]').getBoundingClientRect();
      const daily=table.querySelector('[data-sort="daily"]').getBoundingClientRect();
      const anchor=table.querySelector('.direction-anchor').getBoundingClientRect();
      directionControl.style.left=((annual.left+annual.right+daily.left+daily.right)/4-anchor.left)+'px';
    });
    directionAlignment.observe(table);
    if(!d.count) host.replaceChildren(el('p','No matching markets. Adjust the region or service filters.','empty-markets'));
    caption.textContent = d.count ? number.format(d.count)+' destinations · Showing '+number.format(d.limit?Math.min(d.limit,d.count):d.count) : 'No matching destinations';
  });
  const tooltip=el('div',undefined,'market-tooltip'); tooltip.hidden=true; tooltip.setAttribute('role','tooltip'); document.body.append(tooltip);
  function show(target) {
    const node=target.closest('[data-tooltip]'); if(!node)return;
    tooltip.textContent=node.dataset.tooltip; tooltip.hidden=false;
    const b=node.getBoundingClientRect();
    tooltip.style.left=Math.max(8,Math.min(b.left,innerWidth-tooltip.offsetWidth-12))+'px';
    tooltip.style.top=Math.max(8,Math.min(b.bottom+8,innerHeight-tooltip.offsetHeight-12))+'px';
  }
  root.addEventListener('pointerover',e=>show(e.target)); root.addEventListener('focusin',e=>show(e.target));
  root.addEventListener('pointerout',()=>tooltip.hidden=true); root.addEventListener('focusout',()=>tooltip.hidden=true);
  root.addEventListener('keydown',e=>{if(e.key==='Escape')tooltip.hidden=true;});
  window.addEventListener('scroll',()=>tooltip.hidden=true,true);
})();

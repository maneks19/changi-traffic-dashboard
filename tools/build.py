"""Rebuild the two entry points; no deployment is performed."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / 'tools/traffic-template.html').read_text()
page = page.replace('</head>', '<link rel="stylesheet" href="assets/markets.css">\n</head>')
page = page.replace('<p>Monthly passenger traffic &amp; aircraft movements</p>', '<p id="dashboard-subtitle">Monthly passenger traffic &amp; aircraft movements</p>')
tabs = '''<nav class="dashboard-tabs" role="tablist" aria-label="Dashboard sections">
<button id="traffic-tab" role="tab" aria-selected="true" aria-controls="traffic-panel" data-dashboard-tab="traffic">Airport traffic</button>
<button id="markets-tab" role="tab" aria-selected="false" tabindex="-1" aria-controls="markets-panel" data-dashboard-tab="markets">O&amp;D Markets</button>
</nav>
<section id="traffic-panel" role="tabpanel" aria-labelledby="traffic-tab">'''
page = page.replace('    <section class="kpis" id="kpis">', tabs + '\n    <section class="kpis" id="kpis">', 1)
fragment = (ROOT / 'tools/markets-fragment.html').read_text()
data = (ROOT / 'assets/singapore-data.json').read_text().replace('</', '<\\/')
markets = '''</section><section id="markets-panel" role="tabpanel" aria-labelledby="markets-tab" hidden>
<div class="market-intro"><div><span class="market-eyebrow">SINGAPORE ORIGIN–DESTINATION DEMAND</span><h2>Explore Singapore’s markets</h2>
<p>Compare demand, fares and nonstop coverage across destinations.</p></div><span class="period-tag">Annual data · 2025–26</span></div>
<p class="market-context">Includes connecting journeys in both directions. These market estimates are separate from Changi’s monthly airport traffic figures.</p>
''' + fragment + '<script type="application/json" id="europe-apac-heatmap-data">' + data + '</script></section>'
page = page.replace('    <div class="footer">', markets + '\n    <div class="footer">', 1)
page = page.replace('</body>', '<script src="assets/markets-ui.js"></script><script src="assets/markets-engine.js"></script>\n</body>')
for name in ['index.html', 'changi_dashboard.html']:
    (ROOT / name).write_text(page)
print('Built Changi dashboard with Singapore markets tab')

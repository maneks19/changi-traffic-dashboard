Local Singapore markets integration

Preview: python3 -m http.server 8874 --bind 127.0.0.1
Open: http://127.0.0.1:8874/#markets

Build: python3 tools/build.py
The build updates both index.html and changi_dashboard.html.
No deploy command is run. Pushing main triggers the existing Vercel deployment.

Edit the existing monthly traffic dashboard in tools/traffic-template.html.
Edit Singapore markup in tools/markets-fragment.html and styling in assets/markets.css.
The copied market engine retains search, grouping, filters and demand calculations.
assets/markets-ui.js supplies the Changi tab navigation, summary cards and destination list.
The engine emits marketupdate after each calculation to update the destination list and eight summary tiles. The heatmap has been removed.

assets/singapore-data.json is a local snapshot from the existing Singapore dashboard,
limited to airport-pair records involving Singapore (SIN). Full city and region lookup
metadata is retained for search aliases. Nonstop coverage retains the existing
30 September 2026 snapshot and airline information; no fresh research was performed.
Refresh this dataset from the Singapore source before rebuilding when its data changes.

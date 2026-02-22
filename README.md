# ZIP

ZIP is an MVP decision-support platform for strategic single-family housing investment at the U.S. ZIP (ZCTA) level.

## Problem And Challenge Statement
Housing developers need a defensible way to identify where demand from high-income, prime homebuying households is growing fastest. The challenge is converting fragmented demographic and growth data into a clear, explainable market ranking that business teams can use quickly.

Core challenge:
- Identify ZIP codes with strong current demand and strong projected demand through 2030.
- Present findings in a map-first interface that supports filtering, comparison, and drilldown.

## How This Project Solves The Problem
ZIP converts demographic/model output into ranked, map-ready investment intelligence.

The application provides:
- National ZIP-level visualization (choropleth + heatmap modes).
- Search by address and ZIP code.
- ZIP boundary highlighting and zoom-based zoning overlays.
- Top opportunity table with direct drilldown modal.
- Drilldown analytics view with score context and supporting charts.

For MVP speed, the app is designed to ingest model outputs from CSV and keep scoring logic transparent.

## Project Architecture
Data flow:
- Model output CSV files are dropped into `data/csv/`.
- `lib/csv-stitch.js` parses and merges CSV rows by ZIP/ZCTA.
- `pages/api/top-zips.js` serves stitched data to the frontend.
- `components/Map.js` renders map layers and interactions.
- `components/ZipDrilldown.js` renders ZIP-level detail analytics.

System components:
- Frontend layer: Next.js pages + React components + global CSS.
- API layer: Next.js API routes for ZIP data and boundary lookup.
- Geospatial layer: Mapbox GL + Turf.js for map rendering and polygon/zone operations.
- External data layer: U.S. Census TIGERweb boundary endpoint for ZIP geometry fallback.

## Scoring Model
The dashboard is built around a weighted composite score (normalized inputs):

`ZIP Score = 0.40 * projected_target_household_growth + 0.30 * current_target_household_size + 0.20 * income_strength + 0.10 * total_population_growth`

Output usage:
- Rank ZIPs nationally or within filters.
- Highlight top opportunity markets.
- Support Invest / Watch / Avoid categorization logic in the drilldown.

## Tools And Frameworks
Frontend:
- Next.js 16 (Pages Router)
- React 18
- SWR
- Recharts
- Custom CSS

Backend/API:
- Next.js API routes (Node runtime)

Geospatial:
- Mapbox GL JS
- Turf.js
- us-zips (ZIP centroid fallback)

Data:
- CSV-based ingestion and stitching pipeline (`lib/csv-stitch.js`)
- Optional remote JSON source via `DATA_SOURCE_URL`

Deployment:
- Vercel

## Local Development
Prerequisites:
- Node.js 18+

Setup:
1. Install dependencies:
   - `npm install`
2. Create `.env.local`:
   - `NEXT_PUBLIC_MAPBOX_TOKEN=<your_mapbox_public_token>`
3. Run locally:
   - `npm run dev`
4. Open:
   - `http://localhost:3000`

## Data Input Notes
Expected minimum columns for map rendering:
- `zip` or `zcta`
- `lat`
- `lon`

Common optional columns:
- `score`
- `projected_2030_count`
- `current_target_households`
- `growth_pct`
- `median_income`
- `state`

See `data/csv/README.md` for CSV structure details.

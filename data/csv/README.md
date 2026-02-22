# CSV data for the heat map (Person 2)

Drop your model output CSV files here. The app will:

1. **Stitch** – Read all `.csv` files in this folder and merge by ZIP (later files override earlier for the same ZIP).
2. **Display** – Use the result to drive the heat map and choropleth.

## Required columns

At minimum each row must have:

| Column (any of these names) | Purpose |
|-----------------------------|--------|
| `zip`, `zcta`, `zip_code`   | ZIP / ZCTA code |
| `lat`, `latitude`           | Latitude |
| `lon`, `lng`, `longitude`   | Longitude |

## Optional columns (for coloring and table)

| Column (examples) | Used for |
|-------------------|----------|
| `score`, `zip_score` | Ranking and display |
| `projected_2030_count`, `projected_2030` | Heat intensity, “Projected 2030” |
| `current_target_households`, `current_households` | Fallback intensity, “Current target households” |
| `growth_pct`, `growth` | Growth % |
| `median_income`, `median_household_income` | Median income |
| `state`, `state_code` | State filter |
| `buffer_radius`, `buffer-radius` | Optional buffer (default 6) |

Column names are case-insensitive; underscores and hyphens are treated the same.

## Example one-row CSV

```csv
zip,zcta,lat,lon,score,projected_2030_count,current_target_households,growth_pct,median_income,state
95814,95814,38.5816,-121.4944,0.92,710,420,0.69,135000,CA
```

After adding or changing CSVs, refresh the dashboard; the API will reload from these files.

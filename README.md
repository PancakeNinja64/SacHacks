# ZIP  
UC Davis MSBA – Strategic Housing Development Challenge

---

## 📌 Project Objective

Build a data-driven decision tool to identify U.S. ZIP codes (ZCTA level) with the highest potential for new **single-family home development** targeting:

- Households aged **25–45**
- Household income **>$100,000**
- Projected growth through **2030**

Deliver an executive-ready dashboard that ranks ZIP codes and provides clear, defensible investment recommendations.

This is a 24-hour MVP build.

---

## 🧠 Core Investment Question

Where will the concentration of high-income young households grow the most by 2030, creating strong demand for new single-family housing?

---

## 🏗 Project Architecture

Census Data → Feature Engineering → Growth Analysis → ZIP Scoring → Dashboard → Executive Recommendation

This is a strategic demand-side site selection model.

---

## 👥 Team Roles

### 🧠 Person 1 – Data & Modeling Lead
Responsible for:
- Census data extraction (ACS, ZCTA level)
- Cleaning and merging datasets
- Creating demand and growth metrics
- Projecting growth to 2030 (simple linear projection)
- Building composite ZIP scoring model
- Outputting ranked ZIP list

---

### 📊 Person 2 – Dashboard & Business Strategy Lead
Responsible for:
- Building interactive heatmap dashboard
- Creating ZIP drilldown view
- Designing ranking table
- Framing executive insights
- Creating final presentation slides

**Using your model CSV data:** Place your training/output CSV files in **`data/csv/`**. The app will stitch all `.csv` files together (by ZIP), then drive the heat map and choropleth. Required columns: `zip` (or `zcta`), `lat`, `lon`; optional: `score`, `projected_2030_count`, `current_target_households`, `growth_pct`, `median_income`, `state`. See `data/csv/README.md` for details. Use the **State** and **Min score** filters on the dashboard to change what’s displayed.

---

## 📊 Required Data (MVP Scope)

### Must-Have (ACS 5-Year Estimates, ZCTA Level)
- Population by age group (25–34, 35–44)
- Household income distribution (>$100k buckets)
- Total households
- Median household income
- Historical data (minimum 2–3 time points)

### Optional (If Time Permits)
- Zillow Home Value Index (ZIP level)
- Median home price trends

No zoning, land-use, or complex urban planning data for MVP.

---

## 📈 Feature Engineering

### Current Demand Metrics
- % households aged 25–45
- # households earning >$100k
- Median household income

### Growth Metrics
- % growth in 25–45 population
- % growth in >$100k households
- Total population growth

Growth formula:
(Current − Past) / Past

---

## 🔮 2030 Projection (Simple)

Use linear projection:

Projected_2030 = Current + (Recent Growth Rate × Years to 2030)

No advanced forecasting models for MVP.

---

## 🧮 ZIP Scoring Model

All components normalized (min-max scaling).

ZIP Score =  
(40%) Projected Growth in Target Households  
+ (30%) Current Target Household Size  
+ (20%) Median Income Strength  
+ (10%) Total Population Growth  

Output:
- Ranked ZIP list
- Top 25 investment candidates
- Invest / Watch / Avoid categorization

---

## 📊 Dashboard Requirements

### View 1 – National Heatmap
- Color by ZIP Score
- Filters:
  - State
  - Income threshold (future enhancement)
  - Age range (future enhancement)

### View 2 – ZIP Drilldown
For selected ZIP:
- Current target households
- Historical growth trend
- Projected 2030 target households
- Median income
- Score breakdown

### View 3 – Investment Ranking Table
Columns:
- ZIP
- State
- Current Target Households
- Growth %
- Projected 2030 Count
- ZIP Score
- Category (Invest / Watch / Avoid)

---

## 🧠 Investment Classification Logic

Top 15% → Invest  
Next 20% → Watch  
Bottom 25% → Avoid  

---

## 📋 Executive Output

Final deliverable must clearly answer:

1. Where should the firm invest?
2. Why these ZIP codes?
3. What is the projected growth in target buyers?
4. What risks or assumptions exist?

---

## ⚠ MVP Constraints

- No overengineering
- No deep learning
- No complex zoning analysis
- No unnecessary variables
- Must remain explainable and defensible

---

## 🎯 Success Criteria

The model should:

✔ Rank ZIP codes clearly  
✔ Use demographic growth as core driver  
✔ Include projection to 2030  
✔ Be business-focused, not purely technical  
✔ Support strategic investment decisions  

---

## 🤖 Agentic Model Instructions

If using an AI agent to assist development:

The agent should:

1. Stay aligned to the core investment objective.
2. Avoid introducing unnecessary complexity.
3. Suggest efficient data pipelines.
4. Ensure scoring logic remains interpretable.
5. Prioritize clarity and executive usability.
6. Flag potential data quality issues.
7. Continuously tie analysis back to housing demand growth.

The agent should not:
- Add deep learning models
- Add zoning simulation layers
- Expand scope beyond MVP

---

## 🏁 Final Goal

Deliver a clean, strategic, data-driven housing development recommendation engine within 24 hours.

The output should resemble a lightweight Zillow-style investment intelligence tool focused on demographic growth and income strength.

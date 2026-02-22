import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'

const CHART_COLORS = ['#110e08', '#35322d', '#005f32', '#9c947f']
const AXIS_STYLE = { fontSize: 12, fill: '#625b52' }
const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid rgba(17, 14, 8, 0.2)',
  borderRadius: 0,
  boxShadow: '0 4px 12px rgba(17, 14, 8, 0.08)',
  color: '#110e08',
  fontSize: 12
}

const RADIAN = Math.PI / 180

const recommendationText = {
  Invest: 'High growth potential with strong income demographics.',
  Watch: 'Moderate growth potential. Monitor trends before committing.',
  Avoid: 'Limited growth prospects at this time. Consider other opportunities.'
}

const ACTION_OPTIONS = ['Invest', 'Watch', 'Avoid']

export default function ZipDrilldown({ record, modal = false, onClose }) {
  if (!record) return null

  const score = toNumber(record.score)
  const currentHouseholds = toNumber(record.current_target_households)
  const projected2030 = toNumber(record.projected_2030_count)
  const medianIncome = toNumber(record.median_income)
  const growthPct = toNumber(record.growth_pct)

  const category = getCategory(score)

  // Sample data for projections
  const householdProjection = [
    { year: 2020, households: Math.floor(currentHouseholds * 0.7) },
    { year: 2023, households: currentHouseholds },
    { year: 2025, households: Math.floor(currentHouseholds * 1.15) },
    { year: 2030, households: projected2030 }
  ]

  // Score breakdown (placeholder values—Person 1 to replace with real percentages)
  const scoreBreakdown = [
    { name: 'Growth', value: 40, fill: CHART_COLORS[0] },
    { name: 'Current Size', value: 30, fill: '#d2b48c' },
    { name: 'Income', value: 20, fill: CHART_COLORS[2] },
    { name: 'Population', value: 10, fill: CHART_COLORS[3] }
  ]

  return (
    <div className={modal ? 'zip-modal-content' : 'zip-detail-page'}>
      <header className={modal ? 'zip-modal-header' : 'zip-detail-header'}>
        {modal ? (
          <div className="zip-modal-title-wrap">
            <h2 className="zip-detail-title">ZIP Code {record.zip}</h2>
            <p className="zip-detail-subtitle">{record.state}</p>
          </div>
        ) : (
          <div>
            <Link href="/" className="zip-back-link">Back to dashboard</Link>
            <h1 className="zip-detail-title">ZIP Code {record.zip}</h1>
            <p className="zip-detail-subtitle">{record.state}</p>
          </div>
        )}
        {modal && (
          <button type="button" className="zip-modal-close" onClick={onClose}>
            Close
          </button>
        )}
      </header>

      <section className="zip-metrics-grid">
        <article className={`zip-metric-card zip-score-card ${category.tone}`}>
          <div className="zip-metric-label">Investment Score</div>
          <div className="zip-metric-value">{score.toFixed(2)}</div>
        </article>
        <article className="zip-metric-card">
          <div className="zip-metric-label">Median Income</div>
          <div className="zip-metric-value">${(medianIncome / 1000).toFixed(0)}k</div>
        </article>
        <article className="zip-metric-card">
          <div className="zip-metric-label">Growth Rate (to 2030)</div>
          <div className="zip-metric-value">{(growthPct * 100).toFixed(1)}%</div>
        </article>
        <article className="zip-metric-card">
          <div className="zip-metric-label">Target Households (Current)</div>
          <div className="zip-metric-value">{currentHouseholds.toLocaleString()}</div>
        </article>
      </section>

      <section className="zip-decision-card" aria-label="Recommended investment action">
        <div className="zip-decision-header">
          <h3 className="zip-panel-title">Decision Signal</h3>
        </div>
        <div className="zip-decision-options" role="list">
          {ACTION_OPTIONS.map((option) => {
            const optionTone = option.toLowerCase()
            const active = option === category.label
            return (
              <div
                key={option}
                role="listitem"
                className={`zip-decision-option ${optionTone} ${active ? 'active' : ''}`}
              >
                <span className="zip-decision-name">{option}</span>
                {active && <span className="zip-decision-check">Recommended</span>}
              </div>
            )
          })}
        </div>
        <p className="zip-decision-text">{recommendationText[category.label]}</p>
      </section>

      <section className="zip-panels-grid">
        <article className="zip-panel-card">
          <h3 className="zip-panel-title">Target Household Projection (Sample Data)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={householdProjection} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: 'rgba(17, 14, 8, 0.2)' }} />
              <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: 'rgba(17, 14, 8, 0.2)' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val) => Number(val).toLocaleString()} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#625b52' }} />
              <Line type="monotone" dataKey="households" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 2 }} name="Households" />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="zip-panel-card">
          <h3 className="zip-panel-title">Score Breakdown (Weights)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={scoreBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderPercentLabel}
                outerRadius="72%"
                innerRadius="38%"
                dataKey="value"
              >
                {scoreBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val) => `${val}%`} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: '#625b52' }}
                formatter={(value) => value}
              />
            </PieChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className="zip-panel-card zip-wide-card">
        <h3 className="zip-panel-title">Current vs Projected 2030</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={[
              { category: 'Target Households', current: currentHouseholds, projected: projected2030 }
            ]}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis dataKey="category" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: 'rgba(17, 14, 8, 0.2)' }} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: 'rgba(17, 14, 8, 0.2)' }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val) => Number(val).toLocaleString()} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#625b52' }} />
            <Bar dataKey="current" fill={CHART_COLORS[1]} name="Current" />
            <Bar dataKey="projected" fill={CHART_COLORS[2]} name="2030 Projected" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="zip-panel-card zip-wide-card">
        <h3 className="zip-panel-title">Additional Metrics</h3>
        <div className="zip-additional-grid">
          <div><strong>ZCTA:</strong> {record.zcta}</div>
          <div><strong>State:</strong> {record.state}</div>
          <div><strong>Growth %:</strong> {(growthPct * 100).toFixed(1)}%</div>
        </div>
      </section>
    </div>
  )
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getCategory(score) {
  if (score >= 0.75) return { label: 'Invest', tone: 'invest' }
  if (score >= 0.55) return { label: 'Watch', tone: 'watch' }
  return { label: 'Avoid', tone: 'avoid' }
}

function renderPercentLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent
}) {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  const value = `${Math.round(percent * 100)}%`
  const fontSize = outerRadius < 45 ? 10 : 12

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={fontSize}
      fontWeight={600}
    >
      {value}
    </text>
  )
}

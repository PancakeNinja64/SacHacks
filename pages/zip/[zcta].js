import { useRouter } from 'next/router'
import useSWR from 'swr'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

const fetcher = (url) => fetch(url).then(r => r.json())

export default function ZipDetail() {
  const router = useRouter()
  const { zcta } = router.query
  const { data, error } = useSWR('/api/top-zips', fetcher)

  if (error) return <div style={{padding:20}}>Failed to load</div>
  if (!data) return <div style={{padding:20}}>Loading...</div>
  if (!zcta) return <div style={{padding:20}}>Loading ZIP...</div>

  const record = data.find(r => String(r.zcta) === String(zcta))
  if (!record) return <div style={{padding:20}}>ZIP not found: {zcta}</div>

  // Sample data for projections
  const householdProjection = [
    { year: 2020, households: Math.floor(record.current_target_households * 0.7) },
    { year: 2023, households: record.current_target_households },
    { year: 2025, households: Math.floor(record.current_target_households * 1.15) },
    { year: 2030, households: record.projected_2030_count }
  ]

  // Score breakdown (placeholder values—Person 1 to replace with real percentages)
  const scoreBreakdown = [
    { name: 'Growth', value: 40, fill: '#8884d8' },
    { name: 'Current Size', value: 30, fill: '#82ca9d' },
    { name: 'Income', value: 20, fill: '#ffc658' },
    { name: 'Population', value: 10, fill: '#ff7c7c' }
  ]

  // Investment category
  const getCategory = (score) => {
    if (score >= 0.75) return { label: 'Invest', color: '#22c55e' }
    if (score >= 0.55) return { label: 'Watch', color: '#eab308' }
    return { label: 'Avoid', color: '#ef4444' }
  }
  const category = getCategory(record.score)

  return (
    <div style={{padding:20, maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif'}}>
      {/* Header */}
      <div style={{marginBottom:20, borderBottom: '1px solid #eee', paddingBottom:16}}>
        <Link href="/">← Back to Dashboard</Link>
        <h1 style={{marginTop:12, marginBottom:4}}>ZIP Code {record.zip}</h1>
        <p style={{margin:0, color: '#666'}}>{record.state}</p>
      </div>

      {/* Key metrics cards */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom:24}}>
        <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:16, background:'#f9fafb'}}>
          <div style={{fontSize:'0.875rem', color:'#666', marginBottom:4}}>Investment Score</div>
          <div style={{fontSize:'2rem', fontWeight:'bold', color:'#1f2937'}}>{record.score.toFixed(2)}</div>
          <div style={{fontSize:'0.875rem', fontWeight:600, color:category.color, marginTop:4}}>{category.label}</div>
        </div>
        <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:16, background:'#f9fafb'}}>
          <div style={{fontSize:'0.875rem', color:'#666', marginBottom:4}}>Median Income</div>
          <div style={{fontSize:'1.75rem', fontWeight:'bold'}}>${(record.median_income / 1000).toFixed(0)}k</div>
        </div>
        <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:16, background:'#f9fafb'}}>
          <div style={{fontSize:'0.875rem', color:'#666', marginBottom:4}}>Growth Rate (to 2030)</div>
          <div style={{fontSize:'1.75rem', fontWeight:'bold'}}>{(record.growth_pct * 100).toFixed(1)}%</div>
        </div>
        <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:16, background:'#f9fafb'}}>
          <div style={{fontSize:'0.875rem', color:'#666', marginBottom:4}}>Target Households (Current)</div>
          <div style={{fontSize:'1.75rem', fontWeight:'bold'}}>{record.current_target_households.toLocaleString()}</div>
        </div>
      </div>

      {/* Charts section */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:24, marginBottom:24}}>
        {/* Projection chart */}
        <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:16}}>
          <h3 style={{marginTop:0, marginBottom:12}}>Target Household Projection (Sample Data)</h3>
          <p style={{fontSize:'0.875rem', color:'#666', marginBottom:8}}>Person 1: replace with historical + projected data</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={householdProjection}>
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(val) => val.toLocaleString()} />
              <Legend />
              <Line type="monotone" dataKey="households" stroke="#8884d8" strokeWidth={2} name="Households" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Score breakdown pie */}
        <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:16}}>
          <h3 style={{marginTop:0, marginBottom:12}}>Score Breakdown (Weights)</h3>
          <p style={{fontSize:'0.875rem', color:'#666', marginBottom:8}}>Person 1: replace with actual score component values</p>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={scoreBreakdown} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name} ${value}%`} outerRadius={80} dataKey="value">
                {scoreBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => `${val}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Current vs Projected */}
      <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:16, marginBottom:24}}>
        <h3 style={{marginTop:0, marginBottom:12}}>Current vs Projected 2030</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={[
            { category: 'Target Households', current: record.current_target_households, projected: record.projected_2030_count }
          ]}>
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip formatter={(val) => val.toLocaleString()} />
            <Legend />
            <Bar dataKey="current" fill="#8884d8" name="Current" />
            <Bar dataKey="projected" fill="#82ca9d" name="2030 Projected" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Investment Recommendation */}
      <div style={{border:`2px solid ${category.color}`, borderRadius:8, padding:16, background: category.color + '08', marginBottom:24}}>
        <h3 style={{marginTop:0, marginBottom:8, color: category.color}}>Investment Recommendation: {category.label}</h3>
        <p style={{margin:'0 0 8px 0', color:'#666'}}>
          {category.label === 'Invest' && 'High growth potential with strong income demographics. Recommended for investment.'}
          {category.label === 'Watch' && 'Moderate growth potential. Monitor trends before committing.'}
          {category.label === 'Avoid' && 'Limited growth prospects at this time. Consider other opportunities.'}
        </p>
        <p style={{margin:0, fontSize:'0.875rem', color:'#666'}}>Person 1: Add custom recommendation logic here based on additional analysis.</p>
      </div>

      {/* Data Details */}
      <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:16, marginBottom:24}}>
        <h3 style={{marginTop:0, marginBottom:12}}>Additional Metrics</h3>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12}}>
          <div><strong>ZCTA:</strong> {record.zcta}</div>
          <div><strong>State:</strong> {record.state}</div>
          <div><strong>Growth %:</strong> {(record.growth_pct * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>
  )
}

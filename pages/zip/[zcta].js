import { useRouter } from 'next/router'
import useSWR from 'swr'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const fetcher = (url) => fetch(url).then(r => r.json())

export default function ZipDetail() {
  const router = useRouter()
  const { zcta } = router.query
  const { data, error } = useSWR('/api/top-zips', fetcher)

  if (error) return <div>Failed to load</div>
  if (!data) return <div>Loading...</div>
  if (!zcta) return <div>Loading ZIP...</div>

  const record = data.find(r => String(r.zcta) === String(zcta))
  if (!record) return <div>ZIP not found: {zcta}</div>

  const chartData = [
    { name: 'Current', value: record.current_target_households },
    { name: 'Projected 2030', value: record.projected_2030_count }
  ]

  return (
    <div style={{padding:20}}>
      <div style={{marginBottom:12}}>
        <Link href="/"><a>← Back</a></Link>
      </div>
      <h2>ZIP {record.zip} — {record.state}</h2>
      <div>Score: {record.score.toFixed(2)}</div>
      <div>Median income: ${record.median_income.toLocaleString()}</div>
      <div>Growth %: {(record.growth_pct*100).toFixed(1)}%</div>

      <div style={{height:240, marginTop:16}}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{marginTop:20}}>
        <h3>Score Breakdown (placeholder)</h3>
        <ul>
          <li>Projected Growth in Target Households: 40%</li>
          <li>Current Target Household Size: 30%</li>
          <li>Median Income Strength: 20%</li>
          <li>Total Population Growth: 10%</li>
        </ul>
      </div>
    </div>
  )
}

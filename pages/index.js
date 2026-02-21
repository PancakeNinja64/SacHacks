import useSWR from 'swr'
import Map from '../components/Map'
import { useState } from 'react'

const fetcher = (url) => fetch(url).then(r => r.json())

export default function Home() {
  const { data, error } = useSWR('/api/top-zips', fetcher)
  const [heatmap, setHeatmap] = useState(true)
  const [selected, setSelected] = useState(null)

  if (error) return <div>Failed to load data</div>
  if (!data) return <div>Loading...</div>

  return (
    <div className="container">
      <div className="sidebar">
        <h2>Strategic Housing Dashboard (Person 2)</h2>
        <div className="toggle">
          <label>
            <input type="checkbox" checked={heatmap} onChange={(e) => setHeatmap(e.target.checked)} />{' '}
            Heatmap
          </label>
        </div>

        <h3>Top ZIPs</h3>
        <table>
          <thead>
            <tr><th>ZIP</th><th>Score</th><th>Projected 2030</th></tr>
          </thead>
          <tbody>
            {data.sort((a,b)=>b.score-a.score).slice(0,25).map(z => (
              <tr key={z.zcta} style={{cursor:'pointer'}} onClick={()=>setSelected(z)}>
                <td>{z.zip}</td>
                <td>{z.score.toFixed(2)}</td>
                <td>{z.projected_2030_count}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {selected && (
          <div style={{marginTop:12}}>
            <h4>Details — {selected.zip}</h4>
            <div>Score: {selected.score.toFixed(2)}</div>
            <div>Current target households: {selected.current_target_households}</div>
            <div>Projected 2030: {selected.projected_2030_count}</div>
            <div>Median income: ${selected.median_income.toLocaleString()}</div>
          </div>
        )}
      </div>

      <Map points={data} heatmap={heatmap} onSelect={(p)=>setSelected(p)} />
    </div>
  )
}

import useSWR from 'swr'
import Map from '../components/Map'
import Search from '../components/Search'
import Link from 'next/link'
import { useState, useRef } from 'react'

const fetcher = (url) => fetch(url).then(r => r.json())

export default function Home() {
  const { data, error } = useSWR('/api/top-zips', fetcher)
  const [heatmap, setHeatmap] = useState(true)
  const [visualization, setVisualization] = useState('polygon') // 'polygon' or 'circle'
  const [selected, setSelected] = useState(null)
  const [center, setCenter] = useState(null)
  const mapRef = useRef(null)

  if (error) return <div>Failed to load data</div>
  if (!data) return <div>Loading...</div>

  const handleZipSearch = (zipCode) => {
    if (mapRef.current && mapRef.current.searchByZip) {
      const found = mapRef.current.searchByZip(zipCode)
      if (!found) {
        alert(`ZIP code ${zipCode} not found in our database`)
      }
    }
  }

  const exportCsv = () => {
    if (!data || !data.length) return
    const keys = Object.keys(data[0])
    const rows = [keys.join(','), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))]
    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'top_zips.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container">
      <div className="sidebar">
        <h2>Strategic Housing Dashboard (Person 2)</h2>
        <Search onSelect={(s)=>{ setCenter({ lon: s.lon, lat: s.lat, zoom:12 }); setSelected({zip: s.place_name, zcta:'', score:0}) }} onZipSearch={handleZipSearch} />

        <div className="toggle">
          <label>
            <input type="checkbox" checked={heatmap} onChange={(e) => setHeatmap(e.target.checked)} />{' '}
            Heatmap
          </label>
        </div>

        <div className="toggle">
          <label>
            <input 
              type="radio" 
              name="viz" 
              value="polygon" 
              checked={visualization === 'polygon'} 
              onChange={(e) => setVisualization(e.target.value)} 
            />{' '}
            Polygon
          </label>
          <label style={{marginLeft: 12}}>
            <input 
              type="radio" 
              name="viz" 
              value="circle" 
              checked={visualization === 'circle'} 
              onChange={(e) => setVisualization(e.target.value)} 
            />{' '}
            Circle Buffer
          </label>
        </div>

        <div style={{display:'flex', gap:8, marginBottom:12}}>
          <button onClick={exportCsv}>Export CSV</button>
        </div>

        <h3>Top ZIPs</h3>
        <table>
          <thead>
            <tr><th>ZIP</th><th>Score</th><th>Projected 2030</th></tr>
          </thead>
          <tbody>
            {data.sort((a,b)=>b.score-a.score).slice(0,25).map(z => (
              <tr key={z.zcta} style={{cursor:'pointer'}} onClick={()=>setSelected(z)}>
                <td>
                  <Link href={`/zip/${encodeURIComponent(z.zcta)}`}>{z.zip}</Link>
                </td>
                <td>{z.score.toFixed(2)}</td>
                <td>{z.projected_2030_count}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {selected && (
          <div style={{marginTop:12}}>
            <h4>Details — {selected.zip}</h4>
            {selected.score !== undefined && <div>Score: {selected.score.toFixed(2)}</div>}
            {selected.current_target_households !== undefined && <div>Current target households: {selected.current_target_households}</div>}
            {selected.projected_2030_count !== undefined && <div>Projected 2030: {selected.projected_2030_count}</div>}
            {selected.median_income !== undefined && <div>Median income: ${selected.median_income.toLocaleString()}</div>}
            {selected.zcta && (
              <div style={{marginTop:8}}>
                <Link href={`/zip/${encodeURIComponent(selected.zcta)}`}>Open Drilldown</Link>
              </div>
            )}
          </div>
        )}
      </div>

      <Map points={data} heatmap={heatmap} onSelect={(p)=>setSelected(p)} center={center} ref={mapRef} visualization={visualization} />
    </div>
  )
}

import useSWR from 'swr'
import Map from '../components/Map'
import Search from '../components/Search'
import Link from 'next/link'
import { useState, useRef } from 'react'

const fetcher = (url) => fetch(url).then(r => r.json())

export default function Home() {
  const { data, error } = useSWR('/api/top-zips', fetcher)
  const [heatmap, setHeatmap] = useState(false)
  const [selected, setSelected] = useState(null)
  const [center, setCenter] = useState(null)
  const mapRef = useRef(null)

  if (error) return <div>Failed to load data</div>
  if (!data) return <div>Loading...</div>

  const focusZip = (zipCode) => {
    if (mapRef.current && mapRef.current.searchByZip) {
      const found = mapRef.current.searchByZip(zipCode)
      if (found === null) {
        alert('ZIP boundaries are still loading. Try again in a moment.')
        return false
      }
      if (!found) {
        alert(`ZIP code ${zipCode} not found in our database`)
        return false
      }
      return true
    }
    return false
  }

  const handleZipSearch = (zipCode) => {
    focusZip(zipCode)
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

  const topZips = [...data].sort((a, b) => b.score - a.score).slice(0, 25)
  const averageScore = data.reduce((sum, zip) => sum + Number(zip.score || 0), 0) / Math.max(1, data.length)
  const projectedTotal = data.reduce((sum, zip) => sum + Number(zip.projected_2030_count || 0), 0)

  return (
    <div className="dashboard-shell">
      <aside className="side-panel">
        <div className="panel-top">
          <div className="brand-block">
            <div className="brand-badge">HS</div>
            <div>
              <h1 className="panel-title">HomeScope Intelligence</h1>
              <p className="panel-subtitle">ZIP-level demand scouting for strategic housing investments.</p>
            </div>
          </div>
          <button className="export-btn" onClick={exportCsv}>Export CSV</button>
        </div>

        <Search
          onSelect={(s) => {
            setCenter({ lon: s.lon, lat: s.lat, zoom: 12 })
            setSelected({ zip: s.place_name, zcta: '', score: 0 })
          }}
          onZipSearch={handleZipSearch}
        />

        <div className="mode-switch">
          <button
            className={`mode-btn ${!heatmap ? 'active' : ''}`}
            onClick={() => setHeatmap(false)}
            type="button"
          >
            Choropleth
          </button>
          <button
            className={`mode-btn ${heatmap ? 'active' : ''}`}
            onClick={() => setHeatmap(true)}
            type="button"
          >
            Heatmap
          </button>
        </div>

        <div className="hint-text">
          Select any ZIP, then zoom in to reveal zoning hexes clipped to that boundary.
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-label">Tracked ZIPs</div>
            <div className="stat-value">{data.length}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Avg Score</div>
            <div className="stat-value">{averageScore.toFixed(2)}</div>
          </article>
          <article className="stat-card stat-wide">
            <div className="stat-label">Projected 2030 Households</div>
            <div className="stat-value">{projectedTotal.toLocaleString()}</div>
          </article>
        </div>

        <section className="table-card">
          <div className="section-head">
            <h3>Top ZIP Opportunities</h3>
            <span>{topZips.length} markets</span>
          </div>
          <div className="table-wrap">
            <table className="zip-table">
              <thead>
                <tr>
                  <th>ZIP</th>
                  <th>Score</th>
                  <th>Projected 2030</th>
                </tr>
              </thead>
              <tbody>
                {topZips.map((z) => (
                  <tr
                    key={z.zcta}
                    onClick={() => {
                      focusZip(z.zcta)
                      setSelected(z)
                    }}
                  >
                    <td>
                      <Link href={`/zip/${encodeURIComponent(z.zcta)}`}>{z.zip}</Link>
                    </td>
                    <td>{z.score.toFixed(2)}</td>
                    <td>{Number(z.projected_2030_count || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {selected && (
          <section className="detail-card">
            <div className="section-head">
              <h3>{selected.zip}</h3>
              {selected.score !== undefined && <span className="score-pill">Score {selected.score.toFixed(2)}</span>}
            </div>
            {selected.current_target_households !== undefined && (
              <div className="detail-row">
                <span>Current target households</span>
                <strong>{Number(selected.current_target_households || 0).toLocaleString()}</strong>
              </div>
            )}
            {selected.projected_2030_count !== undefined && (
              <div className="detail-row">
                <span>Projected 2030</span>
                <strong>{Number(selected.projected_2030_count || 0).toLocaleString()}</strong>
              </div>
            )}
            {selected.median_income !== undefined && (
              <div className="detail-row">
                <span>Median income</span>
                <strong>${Number(selected.median_income || 0).toLocaleString()}</strong>
              </div>
            )}
            {selected.zcta && (
              <div className="detail-link">
                <Link href={`/zip/${encodeURIComponent(selected.zcta)}`}>Open Drilldown</Link>
              </div>
            )}
          </section>
        )}
      </aside>

      <section className="map-panel">
        <Map points={data} heatmap={heatmap} onSelect={(p) => setSelected(p)} center={center} ref={mapRef} />
      </section>
    </div>
  )
}

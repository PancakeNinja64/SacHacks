import { useState } from 'react'

export default function Search({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

  const search = async (q) => {
    setQuery(q)
    if (!q || q.length < 3) {
      setResults([])
      return
    }
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?autocomplete=true&types=address,place,locality,neighborhood&limit=6&access_token=${token}`
      const res = await fetch(url)
      const j = await res.json()
      setResults(j.features || [])
    } catch (err) {
      console.error('geocode error', err)
      setResults([])
    }
  }

  return (
    <div style={{marginBottom:12}}>
      <input
        placeholder="Search address, city, ZIP..."
        value={query}
        onChange={(e) => search(e.target.value)}
        style={{width:'100%', padding:8, boxSizing:'border-box'}}
      />
      {results.length > 0 && (
        <div style={{background:'#fff', border:'1px solid #eee', maxHeight:200, overflow:'auto'}}>
          {results.map(r => (
            <div key={r.id} style={{padding:8, cursor:'pointer'}} onClick={() => {
              const [lon, lat] = r.center
              setResults([])
              setQuery(r.place_name)
              if (onSelect) onSelect({ lon, lat, place_name: r.place_name })
            }}>
              {r.place_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

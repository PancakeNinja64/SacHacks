import { useState } from 'react'

export default function Search({ onSelect, onZipSearch }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

  const search = async (q) => {
    setQuery(q)
    
    // Detect 5-digit ZIP code
    if (/^\d{5}$/.test(q)) {
      if (onZipSearch) {
        onZipSearch(q)
      }
      setResults([])
      return
    }
    
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
    <div className="search-block">
      <input
        placeholder="Search address, city, ZIP code..."
        value={query}
        onChange={(e) => search(e.target.value)}
        className="search-input"
      />
      {results.length > 0 && (
        <div className="search-results">
          {results.map(r => (
            <button key={r.id} className="search-result-item" type="button" onClick={() => {
              const [lon, lat] = r.center
              setResults([])
              setQuery(r.place_name)
              if (onSelect) onSelect({ lon, lat, place_name: r.place_name })
            }}>
              {r.place_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

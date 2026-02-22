import { useState } from 'react'

const ZIP_REGEX = /^\d{5}(?:-\d{4})?$/

export default function Search({ onSelect, onZipSearch }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

  const geocodeZip = async (zip) => {
    if (!token) return false
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(zip)}.json?types=postcode&country=us&limit=1&access_token=${token}`
      const res = await fetch(url)
      const data = await res.json()
      const feature = data?.features?.[0]
      if (!feature || !Array.isArray(feature.center)) return false

      const [lon, lat] = feature.center
      setQuery(feature.place_name || zip)
      if (onSelect) onSelect({ lon, lat, place_name: feature.place_name || zip })
      return true
    } catch (err) {
      console.error('zip geocode error', err)
      return false
    }
  }

  const search = async (q) => {
    setQuery(q)

    const trimmed = q.trim()

    // Detect ZIP and search local boundaries first, then geocode fallback
    if (ZIP_REGEX.test(trimmed)) {
      const zip = trimmed.slice(0, 5)
      let foundInDataset = false
      if (onZipSearch) {
        foundInDataset = Boolean(await onZipSearch(zip))
      }

      if (!foundInDataset) {
        await geocodeZip(zip)
      }
      setResults([])
      return
    }

    if (!trimmed || trimmed.length < 3) {
      setResults([])
      return
    }
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?autocomplete=true&types=address,place,locality,neighborhood&limit=6&access_token=${token}`
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

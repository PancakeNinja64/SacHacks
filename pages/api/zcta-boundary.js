function normalizeZip(value) {
  if (value === null || value === undefined) return ''
  const raw = String(value).trim()
  if (!/^\d{5}(?:-\d{4})?$/.test(raw)) return ''
  return raw.slice(0, 5)
}

async function fetchBoundaryFromCensus(zip) {
  const whereClause = `ZCTA5='${zip}'`
  const query = new URLSearchParams({
    where: whereClause,
    outFields: 'ZCTA5,GEOID',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson'
  })
  const url = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/2/query?${query.toString()}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`boundary query failed (${response.status})`)
  }
  const geojson = await response.json()
  const feature = geojson?.features?.[0]
  if (!feature) return null

  return {
    type: 'FeatureCollection',
    features: [{
      ...feature,
      properties: {
        ...feature.properties,
        zcta: zip,
        zip
      }
    }]
  }
}

export default async function handler(req, res) {
  const zip = normalizeZip(req.query?.zcta)
  if (!zip) {
    res.status(400).json({ error: 'invalid zcta (expected 5-digit ZIP)' })
    return
  }

  try {
    const boundary = await fetchBoundaryFromCensus(zip)
    if (!boundary) {
      res.status(404).json({ error: `boundary not found for ZIP ${zip}` })
      return
    }
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    res.status(200).json(boundary)
  } catch (err) {
    res.status(502).json({ error: 'failed to fetch ZIP boundary', details: err.message })
  }
}

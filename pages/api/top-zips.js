import { loadAndStitchCsv } from '../../lib/csv-stitch'

async function fetchRemote(url) {
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`Bad response ${resp.status}`)
    return await resp.json()
  } catch (err) {
    throw err
  }
}

export default async function handler(req, res) {
  const dataSource = process.env.DATA_SOURCE_URL
  let data = null

  // 1) Prefer stitched CSV from data/csv (Person 2 model output)
  const csvData = loadAndStitchCsv()
  if (csvData && csvData.length > 0) {
    data = csvData
  }

  // 2) Else remote URL if set
  if (!data && dataSource) {
    try {
      data = await fetchRemote(dataSource)
    } catch (err) {
      console.warn('Failed to fetch DATA_SOURCE_URL:', err.message)
      data = null
    }
  }

  // 3) No placeholder fallback. Return an explicit error when no real data source is available.
  if (!data) {
    res.status(500).json({
      error: 'No ZIP data source available',
      details: 'Add CSV files under data/csv or set DATA_SOURCE_URL.'
    })
    return
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
  res.status(200).json(data)
}

import fs from 'fs'
import path from 'path'
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
      console.warn('Failed to fetch DATA_SOURCE_URL, falling back to sample:', err.message)
      data = null
    }
  }

  // 3) Fallback to sample JSON
  if (!data) {
    try {
      const p = path.join(process.cwd(), 'public', 'sample', 'top_zips.json')
      const raw = fs.readFileSync(p, 'utf8')
      data = JSON.parse(raw)
    } catch (err) {
      res.status(500).json({ error: 'failed to read sample data', details: err.message })
      return
    }
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
  res.status(200).json(data)
}


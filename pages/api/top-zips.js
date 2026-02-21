import fs from 'fs'
import path from 'path'

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

  if (dataSource) {
    try {
      data = await fetchRemote(dataSource)
    } catch (err) {
      console.warn('Failed to fetch DATA_SOURCE_URL, falling back to sample:', err.message)
      data = null
    }
  }

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


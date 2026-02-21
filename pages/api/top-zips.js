import fs from 'fs'
import path from 'path'

export default function handler(req, res) {
  try {
    const p = path.join(process.cwd(), 'public', 'sample', 'top_zips.json')
    const raw = fs.readFileSync(p, 'utf8')
    const data = JSON.parse(raw)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: 'failed to read sample data', details: err.message })
  }
}

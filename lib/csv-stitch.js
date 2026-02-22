/**
 * Reads and stitches CSV files from data/csv into the format expected by the map.
 * Supports multiple CSVs; rows are merged by zip/zcta (last file wins for conflicts).
 *
 * Expected columns (case-insensitive, flexible names):
 *   - zip or zcta or zip_code
 *   - lat or latitude
 *   - lon or lng or longitude
 *   - score, projected_2030_count, current_target_households, growth_pct, median_income, state
 *   - buffer_radius or buffer-radius
 */

const fs = require('fs')
const path = require('path')

const CSV_DIR = path.join(process.cwd(), 'data', 'csv')

const COLUMN_ALIASES = {
  zip: ['zip', 'zcta', 'zip_code', 'zcta5'],
  zcta: ['zip', 'zcta', 'zip_code', 'zcta5'],
  lat: ['lat', 'latitude', 'y'],
  lon: ['lon', 'lng', 'long', 'longitude', 'x'],
  score: ['score', 'zip_score', 'composite_score'],
  projected_2030_count: ['projected_2030_count', 'projected_2030', 'proj_2030', 'households_2030', 'target_proxy_2030_projection'],
  current_target_households: ['current_target_households', 'current_households', 'target_households', 'households', 'target_proxy_2023'],
  growth_pct: ['growth_pct', 'growth', 'growth_pct_2030', 'pct_growth'],
  median_income: ['median_income', 'median_household_income', 'income_median', 'median_hh_income_2019'],
  state: ['state', 'state_code', 'st', 'state_abbr'],
  buffer_radius: ['buffer_radius', 'buffer-radius', 'buffer_radius_km']
}

function findColumnIndex(headers, targetKey) {
  const normalized = (h) => String(h || '').trim().toLowerCase().replace(/\s+/g, '_')
  const aliases = COLUMN_ALIASES[targetKey] || [targetKey]
  const headerList = headers.map(normalized)
  for (const alias of aliases) {
    const i = headerList.indexOf(alias.toLowerCase())
    if (i !== -1) return i
  }
  return -1
}

function parseCsvRow(line, headers, indices) {
  const values = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && (c === ',' || c === '\t')) {
      values.push(current.trim())
      current = ''
      continue
    }
    current += c
  }
  values.push(current.trim())

  const row = {}
  headers.forEach((h, i) => {
    const v = values[i]
    if (v === undefined || v === '') return
    row[h] = v
  })
  return row
}

function normalizeRow(raw, headers) {
  const get = (key) => {
    const i = findColumnIndex(headers, key)
    if (i === -1) return undefined
    const v = raw[headers[i]]
    if (v === undefined || v === '') return undefined
    return String(v).trim()
  }
  const num = (key) => {
    const v = get(key)
    if (v === undefined) return undefined
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : undefined
  }

  const zip = get('zip') || get('zcta')
  if (!zip) return null

  const digits = String(zip).replace(/\D/g, '').slice(0, 5)
  const zcta = digits.length >= 5 ? digits : digits.padStart(5, '0')
  let lat = num('lat')
  let lon = num('lon')
  if (lat == null || !Number.isFinite(lat)) lat = undefined
  if (lon == null || !Number.isFinite(lon)) lon = undefined

  const current = num('current_target_households')
  const projected = num('projected_2030_count')
  // growth_pct must be a decimal (e.g. 0.35 = 35%). Your CSV has projected_delta_2023_2030 (absolute change);
  // derive percentage as (2030 - 2023) / 2023 so the UI shows e.g. "34.8%" not "250079%".
  let growth_pct = num('growth_pct')
  if (growth_pct == null && current != null && current > 0 && projected != null) {
    growth_pct = (projected - current) / current
  }

  return {
    zip: zcta,
    zcta: zcta,
    lat,
    lon,
    score: num('score'),
    projected_2030_count: projected,
    current_target_households: current,
    growth_pct,
    median_income: num('median_income'),
    state: get('state'),
    'buffer-radius': num('buffer_radius') ?? 6
  }
}

function getZipLookup() {
  try {
    return require('us-zips')
  } catch (e) {
    return null
  }
}

function parseCsvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const headerLine = lines[0]
  const headers = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < headerLine.length; i++) {
    const c = headerLine[i]
    if (c === '"') {
      inQ = !inQ
      continue
    }
    if (!inQ && (c === ',' || c === '\t')) {
      headers.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  headers.push(cur.trim())

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const raw = parseCsvRow(lines[i], headers, null)
    const norm = normalizeRow(raw, headers)
    if (norm) rows.push(norm)
  }
  return rows
}

/**
 * Load all CSV files from data/csv, merge by zip (last file wins), return array for map.
 * @returns {Array<object>} Array of { zip, zcta, lat, lon, score, projected_2030_count, ... }
 */
function loadAndStitchCsv() {
  if (!fs.existsSync(CSV_DIR)) return null
  const entries = fs.readdirSync(CSV_DIR, { withFileTypes: true })
  const csvFiles = entries
    .filter((e) => e.isFile() && /\.csv$/i.test(e.name))
    .map((e) => path.join(CSV_DIR, e.name))
    .sort()
  if (csvFiles.length === 0) return null

  const byZip = new Map()
  for (const file of csvFiles) {
    try {
      const rows = parseCsvFile(file)
      for (const row of rows) {
        const key = (row.zcta || row.zip || '').toString().padStart(5, '0')
        if (!key) continue
        if (row.lat == null || row.lon == null) {
          const lookup = getZipLookup()
          if (lookup && lookup[key]) {
            row.lat = lookup[key].latitude
            row.lon = lookup[key].longitude
          }
        }
        if (row.lat != null && row.lon != null && Number.isFinite(row.lat) && Number.isFinite(row.lon)) {
          byZip.set(key, row)
        }
      }
    } catch (err) {
      console.warn(`[csv-stitch] Skip ${path.basename(file)}:`, err.message)
    }
  }

  const result = Array.from(byZip.values())
  return result.length ? result : null
}

module.exports = { loadAndStitchCsv, parseCsvFile, CSV_DIR }

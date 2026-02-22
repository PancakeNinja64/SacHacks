import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'

const EMPTY_FEATURE_COLLECTION = turf.featureCollection([])
const ZONE_ZOOM_THRESHOLD = 11.5
const ZONE_DROP_FRACTION = 0.18

const Map = forwardRef(function Map({ points = [], heatmap = false, onSelect, center }, ref) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)
  const markerRef = useRef(null)
  const polygonDataRef = useRef(null)
  const rawPolygonDataRef = useRef(null)
  const pointDataRef = useRef(toFeatureCollection(points))
  const polygonsReadyRef = useRef(false)
  const selectedZipFeatureRef = useRef(null)
  const heatmapRef = useRef(heatmap)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
  if (!token) {
    return (
      <div className="map-area" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{padding:20, maxWidth:420, textAlign:'center', border:'1px solid #eee', borderRadius:8, background:'#fff'}}>
          <strong>Mapbox token not set</strong>
          <div style={{marginTop:8}}>Set `NEXT_PUBLIC_MAPBOX_TOKEN` in <code>.env.local</code> and restart the dev server.</div>
        </div>
      </div>
    )
  }

  const refreshVisibility = (map) => {
    applyLayerVisibility(map, heatmapRef.current, {
      hasSelectedZip: Boolean(selectedZipFeatureRef.current),
      zoom: map.getZoom()
    })
  }

  const refreshSelectedZipZones = (map) => {
    const selectedFeature = selectedZipFeatureRef.current
    const zoneSource = map.getSource('zcta-zones')
    if (!zoneSource) {
      refreshVisibility(map)
      return
    }

    if (!selectedFeature) {
      zoneSource.setData(EMPTY_FEATURE_COLLECTION)
      refreshVisibility(map)
      return
    }

    const zones = buildChoroplethZones(selectedFeature, pointDataRef.current)
    zoneSource.setData(zones)
    refreshVisibility(map)
  }

  const applySelection = (map, feature) => {
    selectedZipFeatureRef.current = feature || null
    const selectedZcta = normalizeZip(feature?.properties?.zcta || feature?.properties?.zip)
    const emptyFilter = ['==', ['get', 'zcta'], '']
    const selectedFilter = selectedZcta
      ? ['==', ['get', 'zcta'], selectedZcta]
      : emptyFilter

    if (map.getLayer('zcta-fill-highlight')) {
      map.setFilter('zcta-fill-highlight', selectedFilter)
    }
    if (map.getLayer('zcta-outline-highlight')) {
      map.setFilter('zcta-outline-highlight', selectedFilter)
    }

    refreshSelectedZipZones(map)
  }

  useImperativeHandle(ref, () => ({
    isBoundaryReady: () => polygonsReadyRef.current,
    searchByZip: (zipCode) => {
      const map = mapRef.current
      const data = polygonDataRef.current
      if (!map || !data || !polygonsReadyRef.current) return null

      const normalizedZip = normalizeZip(zipCode)
      const feature = data.features.find((f) => {
        const featureZip = normalizeZip(f.properties?.zip)
        const featureZcta = normalizeZip(f.properties?.zcta)
        return featureZip === normalizedZip || featureZcta === normalizedZip
      })
      if (!feature) return false

      const bounds = turf.bbox(feature)
      map.fitBounds(bounds, { padding: 60 })
      applySelection(map, feature)
      if (onSelect) onSelect(feature.properties)
      return true
    }
  }), [onSelect])

  useEffect(() => {
    if (!containerRef.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-98.5795, 39.8283],
      zoom: 3.2
    })
    mapRef.current = map

    let isCancelled = false

    map.on('load', async () => {
      const pointCollection = toFeatureCollection(points)
      pointDataRef.current = pointCollection

      // Point-based source
      map.addSource('zips', {
        type: 'geojson',
        data: pointCollection
      })

      // Smooth heatmap source (point density + weighted score)
      map.addLayer({
        id: 'zips-heat',
        type: 'heatmap',
        source: 'zips',
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'projected_2030_count'], ['get', 'current_target_households'], 0],
            0, 0,
            800, 1
          ],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 9, 1.2, 13, 1.8],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 14, 9, 32, 13, 48],
          'heatmap-opacity': 0.82,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(255,255,178,0)',
            0.2, '#fff7bc',
            0.4, '#fee391',
            0.6, '#fe9929',
            0.8, '#ec7014',
            1, '#cc4c02'
          ]
        }
      })

      map.on('zoom', () => {
        refreshVisibility(map)
      })

      refreshVisibility(map)

      try {
        const response = await fetch('/sample/zcta_polygons.geojson')
        const geojson = await response.json()
        if (isCancelled) return

        rawPolygonDataRef.current = geojson
        const mergedGeojson = mergePolygonMetrics(geojson, points)
        polygonDataRef.current = mergedGeojson
        polygonsReadyRef.current = true

        map.addSource('zcta-polygons', {
          type: 'geojson',
          data: mergedGeojson
        })

        map.addSource('zcta-zones', {
          type: 'geojson',
          data: EMPTY_FEATURE_COLLECTION
        })

        // polygon fill layer colored by score
        map.addLayer({
          id: 'zcta-fill',
          type: 'fill',
          source: 'zcta-polygons',
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'projected_2030_count'], ['get', 'current_target_households'], 0],
              0, '#ead6f3',
              150, '#d8b8ea',
              300, '#c998df',
              500, '#b274d2',
              800, '#9f56c2'
            ],
            'fill-opacity': 0.22
          }
        })

        // highlight layer for selected polygon
        map.addLayer({
          id: 'zcta-fill-highlight',
          type: 'fill',
          source: 'zcta-polygons',
          paint: {
            'fill-color': '#ffffff',
            'fill-opacity': 0.3
          },
          filter: ['==', ['get', 'zcta'], ''] // empty filter, updated on click
        })

        // polygon outline layer
        map.addLayer({
          id: 'zcta-outline',
          type: 'line',
          source: 'zcta-polygons',
          paint: {
            'line-color': '#7b2c83',
            'line-width': 2.2,
            'line-opacity': 0.85
          }
        })

        // highlight line for selected polygon
        map.addLayer({
          id: 'zcta-outline-highlight',
          type: 'line',
          source: 'zcta-polygons',
          paint: {
            'line-color': '#7b2c83',
            'line-width': 4,
            'line-opacity': 0.95
          },
          filter: ['==', ['get', 'zcta'], '']
        })

        // sub-zone fill, only shown when zoomed in on selected ZIP
        map.addLayer({
          id: 'zcta-zones-fill',
          type: 'fill',
          source: 'zcta-zones',
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'zone_intensity'], 0],
              0, '#72e66a',
              0.45, '#b4ec67',
              0.65, '#ece45f',
              0.82, '#f5a563',
              1, '#e1464c'
            ],
            'fill-opacity': 0.74
          }
        })

        map.addLayer({
          id: 'zcta-zones-outline',
          type: 'line',
          source: 'zcta-zones',
          paint: {
            'line-color': '#4ebf55',
            'line-width': 1,
            'line-opacity': 0.55
          }
        })

        map.on('click', 'zcta-fill', (e) => {
          const features = e.features
          if (!features || !features.length) return
          const f = features[0]
          const props = f.properties
          const bounds = turf.bbox(f)
          map.fitBounds(bounds, { padding: 40 })
          applySelection(map, f)
          if (onSelect) onSelect(props)
        })

        map.on('mouseenter', 'zcta-fill', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'zcta-fill', () => { map.getCanvas().style.cursor = '' })
        map.on('mouseenter', 'zcta-zones-fill', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'zcta-zones-fill', () => { map.getCanvas().style.cursor = '' })

        map.on('click', 'zcta-zones-fill', (e) => {
          const features = e.features
          if (!features || !features.length) return
          const f = features[0]
          const props = f.properties || {}
          const centerPoint = turf.centroid(f).geometry.coordinates
          new mapboxgl.Popup()
            .setLngLat(centerPoint)
            .setHTML(`<strong>Zone</strong><br/>Count: ${Number(props.zone_count || 0).toFixed(0)}`)
            .addTo(map)
        })

        refreshSelectedZipZones(map)
        refreshVisibility(map)
      } catch (err) {
        console.error('Failed to load boundary polygons', err)
      }
    })

    return () => {
      isCancelled = true
      map.remove()
    }
  }, [])

  // update source & toggle
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const pointCollection = toFeatureCollection(points)
    pointDataRef.current = pointCollection
    heatmapRef.current = heatmap
    const src = map.getSource('zips')
    if (src) src.setData(pointCollection)

    const polygonSrc = map.getSource('zcta-polygons')
    if (polygonSrc && rawPolygonDataRef.current) {
      const mergedGeojson = mergePolygonMetrics(rawPolygonDataRef.current, points)
      polygonDataRef.current = mergedGeojson
      polygonSrc.setData(mergedGeojson)

      const selectedZip = normalizeZip(
        selectedZipFeatureRef.current?.properties?.zcta ||
        selectedZipFeatureRef.current?.properties?.zip
      )
      if (selectedZip) {
        const refreshedSelectedFeature = mergedGeojson.features.find((feature) => {
          const featureZcta = normalizeZip(feature?.properties?.zcta || feature?.properties?.zip)
          return featureZcta === selectedZip
        })
        if (refreshedSelectedFeature) {
          selectedZipFeatureRef.current = refreshedSelectedFeature
        }
      }
    }

    refreshSelectedZipZones(map)
  }, [points, heatmap])

  // fly to external center requests (from search)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !center) return
    const { lon, lat, zoom } = center
    map.flyTo({ center: [lon, lat], zoom: zoom || 12 })

    // add marker
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
    markerRef.current = new mapboxgl.Marker({ color: '#ff3333' })
      .setLngLat([lon, lat])
      .addTo(map)
  }, [center])

  return <div className="map-area" style={{ position: 'relative' }}>
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  </div>
})

export default Map

function normalizeZip(value) {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim()
  if (/^\d+$/.test(normalized)) return normalized.padStart(5, '0')
  return normalized
}

function mergePolygonMetrics(geojson, points) {
  if (!geojson || !Array.isArray(geojson.features)) return geojson

  const metricsByZip = new globalThis.Map(
    (points || [])
      .map((point) => [normalizeZip(point?.zcta || point?.zip), point])
      .filter(([zip]) => zip)
  )

  return {
    ...geojson,
    features: geojson.features.map((feature) => {
      const featureZip = normalizeZip(feature?.properties?.zcta || feature?.properties?.zip)
      const metric = metricsByZip.get(featureZip)
      const mergedProperties = {
        ...feature.properties,
        ...(metric || {})
      }
      if (featureZip) {
        mergedProperties.zcta = featureZip
        mergedProperties.zip = normalizeZip(mergedProperties.zip || featureZip)
      }
      return { ...feature, properties: mergedProperties }
    })
  }
}

function setLayerVisibility(map, layerId, visibility) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, 'visibility', visibility)
  }
}

function applyLayerVisibility(map, heatmap, viewState = {}) {
  const { hasSelectedZip = false, zoom = 0 } = viewState
  const showHeatmap = heatmap
  const showChoropleth = !heatmap
  const showZoneChoropleth = showChoropleth && hasSelectedZip && zoom >= ZONE_ZOOM_THRESHOLD
  const showZipChoropleth = showChoropleth && !showZoneChoropleth

  setLayerVisibility(map, 'zips-heat', showHeatmap ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-fill', showZipChoropleth ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-fill-highlight', showZipChoropleth ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-zones-fill', showZoneChoropleth ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-zones-outline', showZoneChoropleth ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-outline', (showHeatmap || showChoropleth) ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-outline-highlight', (showChoropleth && hasSelectedZip) ? 'visible' : 'none')
}

function buildChoroplethZones(selectedZipFeature, pointCollection) {
  if (!selectedZipFeature || !pointCollection?.features?.length) {
    return EMPTY_FEATURE_COLLECTION
  }

  const selectedZip = normalizeZip(
    selectedZipFeature?.properties?.zcta || selectedZipFeature?.properties?.zip
  )
  const zipBbox = turf.bbox(selectedZipFeature)
  const zipAreaKm2 = turf.area(selectedZipFeature) / 1_000_000
  const cellSideKm = clamp(Math.sqrt(zipAreaKm2 / 120), 0.18, 0.85)
  const selectedZipMagnitude = Number(
    selectedZipFeature?.properties?.projected_2030_count ??
    selectedZipFeature?.properties?.current_target_households ??
    0
  )
  const selectedZipCenter = turf.centroid(selectedZipFeature)
  const validPoints = pointCollection.features.filter((feature) => {
    const coords = feature?.geometry?.coordinates
    return Array.isArray(coords) && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
  })

  const grid = turf.hexGrid(zipBbox, cellSideKm, { units: 'kilometers' })
  const weightedZones = grid.features
    .map((cell) => {
      const clippedCell = safeIntersect(cell, selectedZipFeature)
      if (!clippedCell) return null

      const centroid = turf.centroid(clippedCell)
      const influenceRadiusKm = Math.max(1.2, cellSideKm * 6)
      let zoneCount = 0
      let contributors = 0

      for (const point of validPoints) {
        const distanceKm = turf.distance(centroid, point, { units: 'kilometers' })
        if (!Number.isFinite(distanceKm) || distanceKm > influenceRadiusKm) continue
        const pointZip = normalizeZip(point?.properties?.zcta || point?.properties?.zip)
        const magnitude = Number(
          point?.properties?.projected_2030_count ??
          point?.properties?.current_target_households ??
          0
        )
        const normalizedDistance = distanceKm / influenceRadiusKm
        const falloff = Math.exp(-3 * normalizedDistance * normalizedDistance)
        const zipWeight = pointZip === selectedZip ? 1.2 : 0.7
        zoneCount += magnitude * falloff * zipWeight
        contributors += 1
      }

      if (zoneCount <= 0) {
        const centerDistanceKm = turf.distance(centroid, selectedZipCenter, { units: 'kilometers' })
        const centerRadiusKm = Math.max(1.25, cellSideKm * 5)
        const centerFalloff = Math.max(0.2, 1 - (centerDistanceKm / centerRadiusKm))
        zoneCount = selectedZipMagnitude * centerFalloff * 0.35
      }

      return {
        geometry: clippedCell.geometry,
        properties: {
          zcta: selectedZip,
          zone_count_raw: zoneCount,
          zone_contributors: contributors
        }
      }
    })
    .filter(Boolean)

  if (!weightedZones.length) {
    return EMPTY_FEATURE_COLLECTION
  }

  const maxZoneCount = weightedZones.reduce((maxValue, zone) => {
    return Math.max(maxValue, Number(zone?.properties?.zone_count_raw || 0))
  }, 0)
  if (maxZoneCount <= 0) {
    return EMPTY_FEATURE_COLLECTION
  }

  const dropThreshold = maxZoneCount * ZONE_DROP_FRACTION
  const zones = weightedZones
    .filter((zone) => Number(zone?.properties?.zone_count_raw || 0) >= dropThreshold)
    .map((zone) => {
      const rawCount = Number(zone?.properties?.zone_count_raw || 0)
      const intensity = clamp(rawCount / maxZoneCount, 0, 1)
      return {
        ...zone,
        properties: {
          ...zone.properties,
          zone_count: Math.round(rawCount),
          zone_intensity: intensity
        }
      }
    })

  return turf.featureCollection(zones)
}

function safeIntersect(featureA, featureB) {
  try {
    return turf.intersect(featureA, featureB)
  } catch (err) {
    return null
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function toFeatureCollection(points) {
  return {
    type: 'FeatureCollection',
    features: (points || []).map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(p.lon), Number(p.lat)] },
      properties: {
        zip: p.zip,
        zcta: p.zcta,
        score: p.score,
        projected_2030_count: p.projected_2030_count,
        current_target_households: p.current_target_households,
        growth_pct: p.growth_pct,
        median_income: p.median_income,
        state: p.state,
        'buffer-radius': Number(p['buffer-radius'] ?? p.buffer_radius ?? 6)
      }
    }))
  }
}

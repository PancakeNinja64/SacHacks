import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'

const EMPTY_FEATURE_COLLECTION = turf.featureCollection([])
const ZONE_ZOOM_THRESHOLD = 11.5
const ZONE_DROP_FRACTION = 0.18
const BUILDINGS_LAYER_ID = 'zip-3d-buildings'

const Map = forwardRef(function Map({ points = [], heatmap = false, mapMode = 'standard', onSelect, center }, ref) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)
  const markerRef = useRef(null)
  const cameraRef = useRef({
    center: [-98.5795, 39.8283],
    zoom: 3.2,
    bearing: 0,
    pitch: 0,
    hasValue: false
  })
  const polygonDataRef = useRef(null)
  const rawPolygonDataRef = useRef(null)
  const pointDataRef = useRef(toFeatureCollection(points))
  const polygonsReadyRef = useRef(false)
  const selectedZipFeatureRef = useRef(null)
  const externalBoundaryRef = useRef(null)
  const heatmapRef = useRef(heatmap)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
  if (!token) {
    return (
      <div className="map-area map-token-empty">
        <div className="map-token-card">
          <strong className="map-token-title">Mapbox token not set</strong>
          <div className="map-token-text">Set `NEXT_PUBLIC_MAPBOX_TOKEN` in <code>.env.local</code> and restart the dev server.</div>
        </div>
      </div>
    )
  }

  const refreshVisibility = (map) => {
    if (!isUsableMapInstance(map)) return
    applyLayerVisibility(map, heatmapRef.current, {
      hasSelectedZip: Boolean(selectedZipFeatureRef.current),
      hasExternalBoundary: Boolean(externalBoundaryRef.current),
      zoom: map.getZoom()
    })
  }

  const setExternalBoundary = (map, feature) => {
    externalBoundaryRef.current = feature || null
    if (!isUsableMapInstance(map)) return
    const externalSource = map.getSource('zcta-external-boundary')
    if (!externalSource) return
    externalSource.setData(feature ? turf.featureCollection([feature]) : EMPTY_FEATURE_COLLECTION)
  }

  const fetchExternalBoundary = async (zipCode) => {
    try {
      const response = await fetch(`/api/zcta-boundary?zcta=${encodeURIComponent(zipCode)}`)
      if (!response.ok) return null
      const geojson = await response.json()
      const feature = geojson?.features?.[0]
      if (!feature) return null

      const normalizedZip = normalizeZip(
        feature?.properties?.zcta || feature?.properties?.zip || zipCode
      )
      return {
        ...feature,
        properties: {
          ...feature.properties,
          zcta: normalizedZip,
          zip: normalizedZip
        }
      }
    } catch (err) {
      return null
    }
  }

  const refreshSelectedZipZones = (map) => {
    if (!isUsableMapInstance(map)) return
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

  const applySelection = (map, feature, options = {}) => {
    if (!isUsableMapInstance(map)) return
    const { isExternal = false } = options
    setExternalBoundary(map, isExternal ? feature : null)
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
    searchByZip: async (zipCode) => {
      const activeMap = mapRef.current
      if (!isUsableMapInstance(activeMap)) return null

      const normalizedZip = normalizeZip(zipCode)

      const localData = polygonDataRef.current
      if (localData?.features?.length) {
        const localFeature = localData.features.find((f) => {
          const featureZip = normalizeZip(f.properties?.zip)
          const featureZcta = normalizeZip(f.properties?.zcta)
          return featureZip === normalizedZip || featureZcta === normalizedZip
        })

        if (localFeature) {
          const bounds = turf.bbox(localFeature)
          activeMap.fitBounds(bounds, { padding: 60 })
          applySelection(activeMap, localFeature, { isExternal: false })
          if (onSelect) onSelect(localFeature.properties)
          return true
        }
      }

      const externalFeature = await fetchExternalBoundary(normalizedZip)
      const latestMap = mapRef.current
      if (!isUsableMapInstance(latestMap)) return null
      if (externalFeature) {
        const bounds = turf.bbox(externalFeature)
        latestMap.fitBounds(bounds, { padding: 60 })
        applySelection(latestMap, externalFeature, { isExternal: true })
        if (onSelect) onSelect(externalFeature.properties)
        return true
      }

      // Fallback: ZIP in our point data (e.g. from CSV) but no boundary — fly to point and show details
      const pointData = pointDataRef.current
      if (pointData?.features?.length) {
        const pointFeature = pointData.features.find((f) => {
          const z = normalizeZip(f.properties?.zcta ?? f.properties?.zip)
          return z === normalizedZip
        })
        if (pointFeature) {
          const [lon, lat] = pointFeature.geometry?.coordinates ?? []
          if (Number.isFinite(lon) && Number.isFinite(lat)) {
            latestMap.flyTo({ center: [lon, lat], zoom: 10 })
            applySelection(latestMap, null)
            if (onSelect) onSelect(pointFeature.properties)
            return true
          }
        }
      }

      return polygonsReadyRef.current ? false : null
    }
  }), [onSelect])

  useEffect(() => {
    if (!containerRef.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
    const isThreeD = mapMode === '3d'
    const previousCamera = cameraRef.current
    const hasPreviousCamera = Boolean(previousCamera?.hasValue)
    const initialCenter = hasPreviousCamera ? previousCamera.center : [-98.5795, 39.8283]
    const initialZoom = hasPreviousCamera ? previousCamera.zoom : (isThreeD ? 4 : 3.2)
    const initialPitch = hasPreviousCamera
      ? (isThreeD ? Math.max(previousCamera.pitch || 0, 58) : 0)
      : (isThreeD ? 58 : 0)
    const initialBearing = hasPreviousCamera
      ? (isThreeD ? (previousCamera.pitch > 0 ? previousCamera.bearing : -22) : 0)
      : (isThreeD ? -22 : 0)
    const styleUrl = mapMode === 'standard'
      ? 'mapbox://styles/mapbox/light-v11'
      : 'mapbox://styles/mapbox/satellite-streets-v12'
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: initialCenter,
      zoom: initialZoom,
      pitch: initialPitch,
      bearing: initialBearing,
      antialias: true
    })
    mapRef.current = map

    map.on('style.load', () => {
      if (mapMode !== '3d') return
      add3DBuildings(map)
    })

    map.on('load', () => {
      if (mapMode === '3d' && !hasPreviousCamera) {
        map.easeTo({ pitch: 58, bearing: -22, duration: 500 })
      }
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
            0, 'rgba(0,0,255,0)',
            0.2, '#2c7bb6',
            0.4, '#00a6ca',
            0.6, '#f9d057',
            0.8, '#f98e52',
            1, '#d7191c'
          ]
        }
      })

      map.on('zoom', () => {
        refreshVisibility(map)
      })

      refreshVisibility(map)

      rawPolygonDataRef.current = EMPTY_FEATURE_COLLECTION
      polygonDataRef.current = EMPTY_FEATURE_COLLECTION
      polygonsReadyRef.current = true

      map.addSource('zcta-polygons', {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION
      })

      map.addSource('zcta-zones', {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION
      })

      map.addSource('zcta-external-boundary', {
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
            0, '#f7f6f2',
            150, '#ebe8de',
            300, '#dcd5c5',
            500, '#c8bda2',
            800, '#a58f68'
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
          'line-color': '#35322d',
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
          'line-color': '#110e08',
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
          // Low intensity -> red (no-invest), high intensity -> green (invest).
          'fill-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'zone_intensity'], 0],
            0, '#9b1c1c',
            0.45, '#d95337',
            0.65, '#e6c951',
            0.82, '#9ed64b',
            1, '#00a542'
          ],
          'fill-opacity': 0.74
        }
      })

      map.addLayer({
        id: 'zcta-zones-outline',
        type: 'line',
        source: 'zcta-zones',
        paint: {
          'line-color': '#005f32',
          'line-width': 1,
          'line-opacity': 0.55
        }
      })

      map.addLayer({
        id: 'zcta-external-fill',
        type: 'fill',
        source: 'zcta-external-boundary',
        paint: {
          'fill-color': '#ccff00',
          'fill-opacity': 0.14
        }
      })

      map.addLayer({
        id: 'zcta-external-outline',
        type: 'line',
        source: 'zcta-external-boundary',
        paint: {
          'line-color': '#110e08',
          'line-width': 3,
          'line-opacity': 0.95
        }
      })

      if (externalBoundaryRef.current) {
        setExternalBoundary(map, externalBoundaryRef.current)
      }

      if (selectedZipFeatureRef.current) {
        applySelection(map, selectedZipFeatureRef.current, {
          isExternal: Boolean(externalBoundaryRef.current)
        })
      }

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
    })

    map.on('moveend', () => {
      if (!isUsableMapInstance(map)) return
      const currentCenter = map.getCenter()
      cameraRef.current = {
        center: [currentCenter.lng, currentCenter.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        hasValue: true
      }
    })

    return () => {
      if (isUsableMapInstance(map)) {
        const currentCenter = map.getCenter()
        cameraRef.current = {
          center: [currentCenter.lng, currentCenter.lat],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
          hasValue: true
        }
      }
      map.remove()
      mapRef.current = null
    }
  }, [mapMode])

  // update source & toggle
  useEffect(() => {
    const map = mapRef.current
    if (!isUsableMapInstance(map)) return

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
    if (!isUsableMapInstance(map) || !center) return
    const { lon, lat, zoom } = center
    map.flyTo({ center: [lon, lat], zoom: zoom || 12 })

    // add marker
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
    markerRef.current = new mapboxgl.Marker({ color: '#005f32' })
      .setLngLat([lon, lat])
      .addTo(map)
  }, [center])

  return <div className="map-area map-area-frame">
    <div ref={containerRef} className="map-canvas" />
  </div>
})

export default Map

function normalizeZip(value) {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim()
  if (/^\d+$/.test(normalized)) return normalized.padStart(5, '0')
  return normalized
}

function isUsableMapInstance(map) {
  return Boolean(
    map &&
    typeof map.getSource === 'function' &&
    typeof map.getLayer === 'function' &&
    typeof map.fitBounds === 'function'
  )
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
  const { hasSelectedZip = false, hasExternalBoundary = false, zoom = 0 } = viewState
  const showHeatmap = heatmap
  const showChoropleth = !heatmap
  const showZoneChoropleth = showChoropleth && hasSelectedZip && zoom >= ZONE_ZOOM_THRESHOLD
  const showZipChoropleth = showChoropleth && !showZoneChoropleth
  // Keep typed ZIP boundary visible in both modes; only fill is choropleth-specific.
  const showExternalBoundaryFill = showChoropleth && hasExternalBoundary
  const showExternalBoundaryOutline = hasExternalBoundary

  setLayerVisibility(map, 'zips-heat', showHeatmap ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-fill', showZipChoropleth ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-fill-highlight', showZipChoropleth ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-zones-fill', showZoneChoropleth ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-zones-outline', showZoneChoropleth ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-external-fill', showExternalBoundaryFill ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-external-outline', showExternalBoundaryOutline ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-outline', (showHeatmap || showChoropleth) ? 'visible' : 'none')
  setLayerVisibility(map, 'zcta-outline-highlight', (showChoropleth && hasSelectedZip) ? 'visible' : 'none')
}

function add3DBuildings(map) {
  if (!isUsableMapInstance(map)) return
  if (map.getLayer(BUILDINGS_LAYER_ID)) return

  const layers = map.getStyle()?.layers || []
  const labelLayerId = layers.find(
    (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
  )?.id

  map.addLayer({
    id: BUILDINGS_LAYER_ID,
    source: 'composite',
    'source-layer': 'building',
    filter: ['==', ['get', 'extrude'], 'true'],
    type: 'fill-extrusion',
    minzoom: 13,
    paint: {
      'fill-extrusion-color': '#c2b59b',
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 15.05, ['get', 'height']],
      'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 13, 0, 15.05, ['get', 'min_height']],
      'fill-extrusion-opacity': 0.72
    }
  }, labelLayerId)
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

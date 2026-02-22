import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'

const Map = forwardRef(function Map({ points = [], heatmap = false, onSelect, center, visualization = 'polygon' }, ref) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)
  const markerRef = useRef(null)
  const polygonDataRef = useRef(null)
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

  useImperativeHandle(ref, () => ({
    searchByZip: (zipCode) => {
      const map = mapRef.current
      const data = polygonDataRef.current
      if (!map || !data) return false

      const feature = data.features.find(f => f.properties.zip === zipCode || f.properties.zcta === zipCode)
      if (!feature) return false

      const bounds = turf.bbox(feature)
      map.fitBounds(bounds, { padding: 60 })
      if (map.getLayer('zcta-fill-highlight')) {
        map.setFilter('zcta-fill-highlight', ['==', ['get', 'zcta'], feature.properties.zcta])
      }
      if (onSelect) onSelect(feature.properties)
      return true
    }
  }), [onSelect])
  useEffect(() => {
    if (!containerRef.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v10',
      center: [-98.5795, 39.8283],
      zoom: 3.2
    })
    mapRef.current = map

    map.on('load', () => {
      // Load polygon GeoJSON
      fetch('/sample/zcta_polygons.geojson')
        .then(r => r.json())
        .then(geojson => {
          polygonDataRef.current = geojson
          map.addSource('zcta-polygons', {
            type: 'geojson',
            data: geojson
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
                ['get', 'score'],
                0, '#ffffcc',
                0.55, '#fed976',
                0.75, '#fd8d3c',
                1, '#bd0026'
              ],
              'fill-opacity': 0.7
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
              'line-color': '#ffffff',
              'line-width': 2
            }
          })
        })

      // Point-based sources (for legacy circles/heatmap)
      map.addSource('zips', {
        type: 'geojson',
        data: toFeatureCollection(points)
      })

      // circle buffer layer (for circle visualization)
      map.addLayer({
        id: 'zips-circle-buffer',
        type: 'circle',
        source: 'zips',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3, ['*', ['get', 'buffer-radius'], 0.5],
            12, ['*', ['get', 'buffer-radius'], 2.5]
          ],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'score'],
            0, '#ffffcc',
            0.55, '#fed976',
            0.75, '#fd8d3c',
            1, '#bd0026'
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.8
        }
      })

      // circle layer for points
      map.addLayer({
        id: 'zips-circle',
        type: 'circle',
        source: 'zips',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 12, 8],
          'circle-color': ['interpolate', ['linear'], ['get', 'score'], 0, '#ffffcc', 0.5, '#fd8d3c', 1, '#bd0026'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1
        }
      })

      // popup on click
      map.on('click', 'zips-circle', (e) => {
        const features = e.features
        if (!features || !features.length) return
        const f = features[0]
        const props = f.properties
        const coordinates = f.geometry.coordinates.slice()
        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(`<strong>${props.zip} (${props.state})</strong><br/>Score: ${Number(props.score).toFixed(2)}<br/>Projected 2030: ${props.projected_2030_count}`)
          .addTo(map)
        if (onSelect) onSelect(props)
      })

      // click handler for circle buffer layer
      map.on('click', 'zips-circle-buffer', (e) => {
        const features = e.features
        if (!features || !features.length) return
        const f = features[0]
        const props = f.properties
        const coordinates = f.geometry.coordinates.slice()
        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(`<strong>${props.zip} (${props.state})</strong><br/>Score: ${Number(props.score).toFixed(2)}<br/>Projected 2030: ${props.projected_2030_count}`)
          .addTo(map)
        if (onSelect) onSelect(props)
      })

      // click handler for polygon layer
      map.on('click', 'zcta-fill', (e) => {
        const features = e.features
        if (!features || !features.length) return
        const f = features[0]
        const props = f.properties
        // fly to polygon bounds using turf.bbox
        const bounds = turf.bbox(f)
        map.fitBounds(bounds, { padding: 40 })
        // set selected zcta highlight filter
        map.setFilter('zcta-fill-highlight', ['==', ['get', 'zcta'], props.zcta])
        // call parent callback
        if (onSelect) onSelect(props)
      })

      // change cursor
      map.on('mouseenter', 'zips-circle', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'zips-circle', () => { map.getCanvas().style.cursor = '' })

      // initial visibility: polygons on, circles/heatmap off by default
      map.setLayoutProperty('zcta-fill', 'visibility', 'visible')
      map.setLayoutProperty('zcta-outline', 'visibility', 'visible')
      map.setLayoutProperty('zips-circle-buffer', 'visibility', 'none')
      map.setLayoutProperty('zips-heat', 'visibility', 'none')
      map.setLayoutProperty('zips-circle', 'visibility', 'none')
    })

    return () => map.remove()
  }, [])

  // update source & toggle
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const src = map.getSource('zips')
    if (src) src.setData(toFeatureCollection(points))
    
    // visualization toggle: 'polygon' or 'circle'
    if (visualization === 'circle') {
      // Show circle buffers, hide polygons
      if (map.getLayer('zcta-fill')) map.setLayoutProperty('zcta-fill', 'visibility', 'none')
      if (map.getLayer('zcta-outline')) map.setLayoutProperty('zcta-outline', 'visibility', 'none')
      if (map.getLayer('zips-circle-buffer')) map.setLayoutProperty('zips-circle-buffer', 'visibility', 'visible')
      if (map.getLayer('zips-heat')) map.setLayoutProperty('zips-heat', 'visibility', 'none')
      if (map.getLayer('zips-circle')) map.setLayoutProperty('zips-circle', 'visibility', 'none')
    } else {
      // Show polygons, hide circle buffers
      if (map.getLayer('zcta-fill')) map.setLayoutProperty('zcta-fill', 'visibility', heatmap ? 'visible' : 'none')
      if (map.getLayer('zcta-outline')) map.setLayoutProperty('zcta-outline', 'visibility', heatmap ? 'visible' : 'none')
      if (map.getLayer('zips-circle-buffer')) map.setLayoutProperty('zips-circle-buffer', 'visibility', 'none')
      if (map.getLayer('zips-heat')) map.setLayoutProperty('zips-heat', 'visibility', heatmap ? 'none' : 'visible')
      if (map.getLayer('zips-circle')) map.setLayoutProperty('zips-circle', 'visibility', heatmap ? 'none' : 'visible')
    }
  }, [points, heatmap, visualization])

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
        state: p.state
      }
    }))
  }
}

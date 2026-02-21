import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

export default function Map({ points = [], heatmap = false, onSelect }) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)

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
      map.addSource('zips', {
        type: 'geojson',
        data: toFeatureCollection(points)
      })

      // heatmap layer
      map.addLayer({
        id: 'zips-heat',
        type: 'heatmap',
        source: 'zips',
        maxzoom: 9,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'score'], 0, 0, 1, 1],
          'heatmap-intensity': 1,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(33,102,172,0)',
            0.2, 'rgb(103,169,207)',
            0.4, 'rgb(209,229,240)',
            0.6, 'rgb(253,219,199)',
            0.8, 'rgb(239,138,98)',
            1, 'rgb(178,24,43)'
          ]
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

      // change cursor
      map.on('mouseenter', 'zips-circle', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'zips-circle', () => { map.getCanvas().style.cursor = '' })

      // initial visibility
      map.setLayoutProperty('zips-heat', 'visibility', heatmap ? 'visible' : 'none')
      map.setLayoutProperty('zips-circle', 'visibility', heatmap ? 'none' : 'visible')
    })

    return () => map.remove()
  }, [])

  // update source & toggle
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const src = map.getSource('zips')
    if (src) src.setData(toFeatureCollection(points))
    if (map.getLayer('zips-heat')) map.setLayoutProperty('zips-heat', 'visibility', heatmap ? 'visible' : 'none')
    if (map.getLayer('zips-circle')) map.setLayoutProperty('zips-circle', 'visibility', heatmap ? 'none' : 'visible')
  }, [points, heatmap])

  return <div className="map-area" style={{ position: 'relative' }}>
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  </div>
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
        state: p.state
      }
    }))
  }
}

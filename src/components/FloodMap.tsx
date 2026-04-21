'use client'

// This component is only ever loaded client-side (ssr: false via dynamic import).
// Leaflet is safe to import at the top level here.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import type { ProcessedStation, ProcessedWarning } from '@/types/flood'

const LEVEL_COLORS: Record<string, string> = {
  normal: '#22c55e',
  typical: '#3b82f6',
  above: '#f59e0b',
  high: '#ef4444',
  unknown: '#9ca3af',
}

const LEVEL_LABELS: Record<string, string> = {
  normal: 'Below Normal',
  typical: 'Normal',
  above: 'Above Normal',
  high: 'High',
  unknown: 'Unknown',
}

const SEVERITY_COLORS: Record<number, string> = {
  1: '#7f1d1d',
  2: '#dc2626',
  3: '#f59e0b',
  4: '#9ca3af',
}

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Severe Flood Warning',
  2: 'Flood Warning',
  3: 'Flood Alert',
  4: 'No Longer in Force',
}

// Flood overlay style — transparent light blue water colour
const FLOOD_OVERLAY_FILL = '#bfdbfe'
const FLOOD_OVERLAY_STYLE: L.PathOptions = {
  fillColor: FLOOD_OVERLAY_FILL,
  fillOpacity: 0.45,
  color: '#3b82f6',
  weight: 1.5,
  opacity: 0.7,
}

const OVERLAY_PANE = 'floodOverlayPane'

interface Props {
  stations: ProcessedStation[]
  warnings: ProcessedWarning[]
  center: [number, number]
  zoom?: number
}

export default function FloodMap({ stations, warnings, center, zoom = 13 }: Props) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)
  const warningPolygonsRef = useRef<L.LayerGroup | null>(null)
  // Individual overlay GeoJSON layers tracked so we can clear them on re-render
  const overlayLayersRef = useRef<L.GeoJSON[]>([])

  // Cache fetched GeoJSON so toggling doesn't re-fetch
  const geojsonCache = useRef<Map<string, object>>(new Map())

  const [showFloodOverlay, setShowFloodOverlay] = useState(true)

  // ── Initialise map once on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return

    const map = L.map(mapEl.current).setView(center, zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | ' +
        'Flood data: <a href="https://environment.data.gov.uk/flood-monitoring/doc/reference">Environment Agency real-time API (Beta)</a>',
      maxZoom: 19,
    }).addTo(map)

    // Custom pane for the flood overlay — sits above tiles (200) but below markers (600)
    map.createPane(OVERLAY_PANE)
    const pane = map.getPane(OVERLAY_PANE)!
    pane.style.zIndex = '450'
    // Start visible (matches showFloodOverlay initial state of true)
    pane.style.display = ''

    warningPolygonsRef.current = L.layerGroup().addTo(map)
    markersRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current = null
      warningPolygonsRef.current = null
      overlayLayersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Toggle overlay visibility via the pane's display style ───────────────
  // This is the simplest and most reliable way — no LayerGroup add/remove.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const pane = map.getPane(OVERLAY_PANE)
    if (pane) pane.style.display = showFloodOverlay ? '' : 'none'
  }, [showFloodOverlay])

  // ── Station markers ───────────────────────────────────────────────────────
  useEffect(() => {
    const layer = markersRef.current
    if (!layer) return

    layer.clearLayers()

    stations.forEach((station) => {
      const color = LEVEL_COLORS[station.levelStatus] ?? LEVEL_COLORS.unknown

      const marker = L.circleMarker([station.lat, station.long], {
        radius: 9,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      })

      const levelLine =
        station.latestLevel !== undefined
          ? `<p style="font-size:13px;margin:4px 0 0">
               Level: <strong>${station.latestLevel.toFixed(2)}&nbsp;${station.unitName ?? 'm'}</strong>
             </p>
             ${
               station.typicalRangeLow !== undefined && station.typicalRangeHigh !== undefined
                 ? `<p style="font-size:11px;color:#6b7280;margin:2px 0 0">
                      Typical range: ${station.typicalRangeLow}–${station.typicalRangeHigh}&nbsp;${station.unitName ?? 'm'}
                    </p>`
                 : ''
             }
             ${
               station.lastReadingAt
                 ? `<p style="font-size:11px;color:#9ca3af;margin:4px 0 0">
                      Updated: ${new Date(station.lastReadingAt).toLocaleString('en-GB')}
                    </p>`
                 : ''
             }`
          : `<p style="font-size:11px;color:#9ca3af;margin:4px 0 0">No reading available</p>`

      marker.bindPopup(
        `<div style="font-family:system-ui,sans-serif;min-width:190px">
           <p style="font-weight:700;font-size:14px;margin:0 0 2px">${station.label}</p>
           <p style="color:#6b7280;font-size:12px;margin:0 0 6px">
             ${station.riverName}${station.town ? ` · ${station.town}` : ''}
           </p>
           ${levelLine}
           <p style="font-size:12px;font-weight:600;color:${color};margin:6px 0 0">
             ● ${LEVEL_LABELS[station.levelStatus] ?? 'Unknown'}
           </p>
         </div>`,
        { maxWidth: 260 },
      )

      layer.addLayer(marker)
    })
  }, [stations])

  // ── Flood warning polygons + overlay ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const warningLayer = warningPolygonsRef.current
    if (!map || !warningLayer) return

    // Clear severity polygons
    warningLayer.clearLayers()

    // Clear previous overlay layers from the map
    overlayLayersRef.current.forEach((l) => map.removeLayer(l))
    overlayLayersRef.current = []

    const activeWarnings = warnings.filter((w) => w.polygonUrl)

    activeWarnings.forEach((warning) => {
      const severityColor = SEVERITY_COLORS[warning.severityLevel] ?? '#9ca3af'
      const polygonUrl = warning.polygonUrl!
      const proxyUrl = `/api/flood/polygon?url=${encodeURIComponent(polygonUrl)}`

      function renderGeojson(geojson: object) {
        if (!mapRef.current || !warningPolygonsRef.current) return

        // ── Severity-coloured polygon (clickable) ──
        const severityLayer = L.geoJSON(geojson as Parameters<typeof L.geoJSON>[0], {
          style: {
            fillColor: severityColor,
            fillOpacity: 0.2,
            color: severityColor,
            weight: 2,
            opacity: 0.7,
          },
        })

        const timeLine = warning.timeRaised
          ? `<p style="font-size:11px;color:#9ca3af;margin:6px 0 0">Raised: ${new Date(warning.timeRaised).toLocaleString('en-GB')}</p>`
          : ''
        const msgLine = warning.message
          ? `<p style="font-size:12px;color:#374151;margin:4px 0 0">${warning.message.length > 240 ? warning.message.slice(0, 240) + '…' : warning.message}</p>`
          : ''

        severityLayer.bindPopup(
          `<div style="font-family:system-ui,sans-serif;min-width:200px;max-width:280px">
             <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
               <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${severityColor};flex-shrink:0"></span>
               <strong style="font-size:13px">${SEVERITY_LABELS[warning.severityLevel] ?? warning.severity}</strong>
             </div>
             <p style="font-size:13px;font-weight:600;margin:0 0 2px">${warning.description}</p>
             ${warning.riverOrSea ? `<p style="font-size:12px;color:#6b7280;margin:0">${warning.riverOrSea}${warning.county ? ` · ${warning.county}` : ''}</p>` : ''}
             ${msgLine}
             ${timeLine}
           </div>`,
          { maxWidth: 300 },
        )

        warningPolygonsRef.current!.addLayer(severityLayer)

        // ── Flood overlay layer — added directly to the map in the overlay pane ──
        const overlayLayer = L.geoJSON(geojson as Parameters<typeof L.geoJSON>[0], {
          style: FLOOD_OVERLAY_STYLE,
          interactive: false,
          pane: OVERLAY_PANE,
        })
        overlayLayer.addTo(mapRef.current!)
        overlayLayersRef.current.push(overlayLayer)
      }

      const cached = geojsonCache.current.get(polygonUrl)
      if (cached) {
        renderGeojson(cached)
      } else {
        fetch(proxyUrl)
          .then((r) => (r.ok ? r.json() : null))
          .then((geojson) => {
            if (!geojson) return
            geojsonCache.current.set(polygonUrl, geojson)
            renderGeojson(geojson)
          })
          .catch(() => {})
      }
    })
  }, [warnings])

  return (
    <div className="relative w-full h-full">
      <div ref={mapEl} className="w-full h-full" />

      {/* Map legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          right: 8,
          zIndex: 1000,
          background: 'white',
          borderRadius: 8,
          padding: '10px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          fontSize: 12,
          minWidth: 178,
        }}
      >
        {/* Flood overlay toggle */}
        <button
          onClick={() => setShowFloodOverlay((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: showFloodOverlay ? '#eff6ff' : '#f9fafb',
            border: `1px solid ${showFloodOverlay ? '#93c5fd' : '#e5e7eb'}`,
            borderRadius: 6,
            padding: '5px 8px',
            cursor: 'pointer',
            marginBottom: 10,
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 10,
                background: FLOOD_OVERLAY_FILL,
                border: '1.5px solid #b91c1c',
                borderRadius: 2,
                opacity: showFloodOverlay ? 1 : 0.3,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: showFloodOverlay ? '#1d4ed8' : '#9ca3af',
              }}
            >
              Flood Area Overlay
            </span>
          </div>
          {/* Toggle pill */}
          <span
            style={{
              display: 'inline-flex',
              width: 28,
              height: 16,
              borderRadius: 8,
              background: showFloodOverlay ? '#3b82f6' : '#d1d5db',
              position: 'relative',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: showFloodOverlay ? 14 : 2,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'white',
                transition: 'left 0.15s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              }}
            />
          </span>
        </button>

        <p
          style={{
            fontWeight: 700,
            marginBottom: 5,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#6b7280',
          }}
        >
          River Level
        </p>
        {Object.entries(LEVEL_COLORS).map(([key, color]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                border: '1.5px solid white',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.12)',
                flexShrink: 0,
              }}
            />
            <span style={{ color: '#374151' }}>{LEVEL_LABELS[key]}</span>
          </div>
        ))}
        <p
          style={{
            fontWeight: 700,
            margin: '8px 0 5px',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#6b7280',
          }}
        >
          Flood Warnings
        </p>
        {Object.entries(SEVERITY_COLORS).map(([lvl, color]) => (
          <div
            key={lvl}
            style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                background: color,
                opacity: 0.75,
                flexShrink: 0,
              }}
            />
            <span style={{ color: '#374151' }}>{SEVERITY_LABELS[parseInt(lvl)]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

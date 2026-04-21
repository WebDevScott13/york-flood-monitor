import type { NextRequest } from 'next/server'
import { fetchStationsForRiver } from '@/lib/ea-api'
import type { EAStation, EAMeasure, ProcessedStation } from '@/types/flood'

const EA_BASE = 'https://environment.data.gov.uk/flood-monitoring'

function getLevelStatus(
  level: number,
  low: number | undefined,
  high: number | undefined,
): ProcessedStation['levelStatus'] {
  if (low === undefined || high === undefined) return 'unknown'
  if (level < low) return 'normal'
  if (level > high * 1.2) return 'high'
  if (level > high) return 'above'
  return 'typical'
}

/** Fetch latest level readings for a set of station references in one request. */
async function fetchBulkReadings(stationRefs: string[]): Promise<Map<string, { value: number; dateTime: string; unitName?: string }>> {
  const url = new URL(`${EA_BASE}/data/readings`)
  url.searchParams.set('latest', '')
  url.searchParams.set('parameter', 'level')
  stationRefs.forEach((ref) => url.searchParams.append('stationReference', ref))

  const res = await fetch(url.toString(), { next: { revalidate: 60 } })
  if (!res.ok) return new Map()

  const data = await res.json()
  const map = new Map<string, { value: number; dateTime: string; unitName?: string }>()

  for (const item of data.items ?? []) {
    // measure URL pattern: .../measures/{stationRef}-level-...
    const measurePath: string = item.measure ?? ''
    const match = measurePath.match(/\/measures\/([^/]+)-level/)
    if (match) {
      const ref = match[1]
      // Keep only the first (most recent) reading per station
      if (!map.has(ref)) {
        map.set(ref, { value: item.value, dateTime: item.dateTime })
      }
    }
  }

  return map
}

export async function GET(request: NextRequest) {
  const riverName = request.nextUrl.searchParams.get('riverName') ?? 'River Ouse'

  try {
    const data = await fetchStationsForRiver(riverName)
    const stations: EAStation[] = data.items ?? []

    const filtered = stations.filter((s) => s.lat != null && s.long != null)

    // Bulk-fetch latest level readings for all stations in one request
    const stationRefs = filtered.map((s) => s.stationReference)
    const readingsMap = await fetchBulkReadings(stationRefs)

    const processed: ProcessedStation[] = filtered.map((s) => {
      const levelMeasure =
        (s.measures ?? []).find(
          (m: EAMeasure) =>
            m.parameter === 'level' || m.parameterName?.toLowerCase().includes('level'),
        ) ?? s.measures?.[0]

      // Prefer the bulk reading; fall back to any latestReading embedded in the measure
      const bulkReading = readingsMap.get(s.stationReference)
      const latestLevel = bulkReading?.value ?? levelMeasure?.latestReading?.value
      const lastReadingAt = bulkReading?.dateTime ?? levelMeasure?.latestReading?.dateTime

      const low = s.stageScale?.typicalRangeLow
      const high = s.stageScale?.typicalRangeHigh

      return {
        id: s.stationReference,
        label: s.label,
        lat: s.lat,
        long: s.long,
        riverName: s.riverName ?? riverName,
        town: s.town,
        latestLevel,
        typicalRangeLow: low,
        typicalRangeHigh: high,
        levelStatus:
          latestLevel !== undefined ? getLevelStatus(latestLevel, low, high) : 'unknown',
        unitName: levelMeasure?.unitName,
        lastReadingAt,
      }
    })

    return Response.json(processed)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}

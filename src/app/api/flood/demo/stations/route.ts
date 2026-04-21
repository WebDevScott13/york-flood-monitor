import type { NextRequest } from 'next/server'
import { fetchStationsForRiver } from '@/lib/ea-api'
import type { EAStation, EAMeasure, ProcessedStation } from '@/types/flood'

/**
 * Demo mode: returns real stations with their real stageScale data,
 * but injects simulated high flood readings so all features can be tested
 * without waiting for an actual flood event.
 */
export async function GET(request: NextRequest) {
  const riverName = request.nextUrl.searchParams.get('riverName') ?? 'River Ouse'

  try {
    const data = await fetchStationsForRiver(riverName)
    const stations: EAStation[] = data.items ?? []

    // Distribute demo stations across severity levels for a realistic-looking scenario
    const DEMO_MULTIPLIERS = [1.35, 1.25, 1.12, 1.05, 0.95, 0.85]

    const processed: ProcessedStation[] = stations
      .filter((s) => s.lat != null && s.long != null)
      .map((s, i) => {
        const levelMeasure =
          (s.measures ?? []).find(
            (m: EAMeasure) =>
              m.parameter === 'level' || m.parameterName?.toLowerCase().includes('level'),
          ) ?? s.measures?.[0]

        const low = s.stageScale?.typicalRangeLow
        const high = s.stageScale?.typicalRangeHigh

        // Generate a demo reading: cycle through multipliers of typicalRangeHigh
        // so we get a spread of high / above / typical / normal stations
        let demoLevel: number | undefined
        if (high !== undefined) {
          const multiplier = DEMO_MULTIPLIERS[i % DEMO_MULTIPLIERS.length]
          demoLevel = parseFloat((high * multiplier).toFixed(3))
        } else if (low !== undefined) {
          demoLevel = parseFloat((low * 1.5).toFixed(3))
        }

        let levelStatus: ProcessedStation['levelStatus'] = 'unknown'
        if (demoLevel !== undefined) {
          if (low !== undefined && demoLevel < low) levelStatus = 'normal'
          else if (high !== undefined && demoLevel > high * 1.2) levelStatus = 'high'
          else if (high !== undefined && demoLevel > high) levelStatus = 'above'
          else levelStatus = 'typical'
        }

        return {
          id: s.stationReference,
          label: s.label,
          lat: s.lat,
          long: s.long,
          riverName: s.riverName ?? riverName,
          town: s.town,
          latestLevel: demoLevel,
          typicalRangeLow: low,
          typicalRangeHigh: high,
          levelStatus,
          unitName: levelMeasure?.unitName ?? 'mAOD',
          lastReadingAt: new Date().toISOString(),
        }
      })

    return Response.json(processed)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}

import type { NextRequest } from 'next/server'
import type { ProcessedWarning } from '@/types/flood'

const EA_BASE = 'https://environment.data.gov.uk/flood-monitoring'

/**
 * Demo mode: fetches real EA flood area polygons near the given location and
 * returns them as simulated active flood warnings with varying severity levels.
 * The polygon URLs are real so overlays render correctly on the map.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const lat = parseFloat(searchParams.get('lat') ?? '53.9590')
  const long = parseFloat(searchParams.get('long') ?? '-1.0815')
  const dist = parseFloat(searchParams.get('dist') ?? '10')

  try {
    const url = new URL(`${EA_BASE}/id/floodAreas`)
    url.searchParams.set('lat', lat.toString())
    url.searchParams.set('long', long.toString())
    url.searchParams.set('dist', dist.toString())

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`EA floodAreas API error: ${res.status}`)

    const data = await res.json()
    const areas: Array<{
      notation?: string
      description?: string
      riverOrSea?: string
      county?: string
      polygon?: string
    }> = data.items ?? []

    // Assign severity levels cycling through 1 (Severe), 2 (Warning), 3 (Alert)
    // so the demo shows all warning types. Cap at 8 warnings to keep the map readable.
    const SEVERITY_CYCLE: Array<1 | 2 | 3> = [1, 2, 2, 3, 3, 3, 3, 3]
    const SEVERITY_LABELS: Record<number, string> = {
      1: 'Severe Flood Warning',
      2: 'Flood Warning',
      3: 'Flood Alert',
    }

    const warnings: ProcessedWarning[] = areas
      .filter((a) => a.polygon)
      .slice(0, SEVERITY_CYCLE.length)
      .map((area, i) => {
        const severityLevel = SEVERITY_CYCLE[i]
        return {
          id: area.notation ?? `demo-area-${i}`,
          description: area.description ?? `${area.riverOrSea ?? 'River'} at ${area.county ?? 'York'}`,
          severity: SEVERITY_LABELS[severityLevel],
          severityLevel,
          message:
            'DEMO DATA — This warning is simulated for testing purposes, using real Environment Agency flood area boundaries.',
          riverOrSea: area.riverOrSea,
          county: area.county,
          polygonUrl: area.polygon,
          timeRaised: new Date(Date.now() - i * 3_600_000).toISOString(),
          isTidal: false,
        }
      })

    return Response.json(warnings)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}

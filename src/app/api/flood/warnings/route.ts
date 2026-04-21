import type { NextRequest } from 'next/server'
import { fetchFloodWarnings } from '@/lib/ea-api'
import type { EAFloodWarning, ProcessedWarning } from '@/types/flood'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const lat = parseFloat(searchParams.get('lat') ?? '53.9590')
  const long = parseFloat(searchParams.get('long') ?? '-1.0815')
  const dist = parseFloat(searchParams.get('dist') ?? '20')

  try {
    const data = await fetchFloodWarnings(lat, long, dist)
    const warnings: EAFloodWarning[] = data.items ?? []

    const processed: ProcessedWarning[] = warnings.map((w) => ({
      id: w.floodAreaID,
      description: w.description,
      severity: w.severity,
      severityLevel: w.severityLevel,
      message: w.message,
      riverOrSea: w.floodArea?.riverOrSea,
      county: w.floodArea?.county,
      polygonUrl: w.floodArea?.polygon,
      timeRaised: w.timeRaised,
      isTidal: w.isTidal,
    }))

    return Response.json(processed)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}

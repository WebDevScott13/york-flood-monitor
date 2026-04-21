import type { NextRequest } from 'next/server'
import { fetchPolygon } from '@/lib/ea-api'

const ALLOWED_HOST = 'environment.data.gov.uk'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return Response.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // EA polygon URLs are returned with http:// — accept both schemes
  if (!url.startsWith(`https://${ALLOWED_HOST}`) && !url.startsWith(`http://${ALLOWED_HOST}`)) {
    return Response.json({ error: 'URL not allowed' }, { status: 403 })
  }

  try {
    const geojson = await fetchPolygon(url)
    return Response.json(geojson)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}

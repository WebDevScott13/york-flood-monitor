const EA_BASE = 'https://environment.data.gov.uk/flood-monitoring'

export async function fetchStationsForRiver(riverName: string) {
  const url = new URL(`${EA_BASE}/id/stations`)
  url.searchParams.set('riverName', riverName)
  url.searchParams.set('parameter', 'level')
  url.searchParams.set('_view', 'full')

  const res = await fetch(url.toString(), { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`EA stations API error: ${res.status}`)
  return res.json()
}

export async function fetchFloodWarnings(lat: number, long: number, dist = 20) {
  const url = new URL(`${EA_BASE}/id/floods`)
  url.searchParams.set('lat', lat.toString())
  url.searchParams.set('long', long.toString())
  url.searchParams.set('dist', dist.toString())

  const res = await fetch(url.toString(), { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`EA floods API error: ${res.status}`)
  return res.json()
}

export async function fetchPolygon(polygonUrl: string) {
  const res = await fetch(polygonUrl, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Polygon fetch error: ${res.status}`)
  return res.json()
}

import FloodDashboard from '@/components/FloodDashboard'

// York city centre coordinates
const YORK_CENTER: [number, number] = [53.959, -1.0815]

export default function Page() {
  return (
    <FloodDashboard
      riverName="River Ouse"
      center={YORK_CENTER}
      zoom={13}
    />
  )
}

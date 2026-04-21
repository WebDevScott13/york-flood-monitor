'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import type { ProcessedStation, ProcessedWarning } from '@/types/flood'

const FloodMap = dynamic(() => import('./FloodMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500 text-sm">
      Loading map…
    </div>
  ),
})

const SEVERITY_CONFIG: Record<
  number,
  { label: string; short: string; bg: string; text: string }
> = {
  1: { label: 'Severe Flood Warning', short: 'Severe', bg: '#7f1d1d', text: '#fff' },
  2: { label: 'Flood Warning', short: 'Warning', bg: '#dc2626', text: '#fff' },
  3: { label: 'Flood Alert', short: 'Alert', bg: '#f59e0b', text: '#fff' },
  4: { label: 'No Longer in Force', short: 'Expired', bg: '#9ca3af', text: '#fff' },
}

interface Props {
  riverName: string
  center: [number, number]
  zoom?: number
}

export default function FloodDashboard({ riverName, center, zoom }: Props) {
  const [stations, setStations] = useState<ProcessedStation[]>([])
  const [warnings, setWarnings] = useState<ProcessedWarning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [demoMode, setDemoMode] = useState(false)

  const fetchData = useCallback(
    async (isDemo: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const stationsUrl = isDemo
          ? `/api/flood/demo/stations?riverName=${encodeURIComponent(riverName)}`
          : `/api/flood/stations?riverName=${encodeURIComponent(riverName)}`
        const warningsUrl = isDemo
          ? `/api/flood/demo/warnings?lat=${center[0]}&long=${center[1]}&dist=10`
          : `/api/flood/warnings?lat=${center[0]}&long=${center[1]}&dist=20`

        const [stationsRes, warningsRes] = await Promise.all([
          fetch(stationsUrl),
          fetch(warningsUrl),
        ])

        if (!stationsRes.ok) throw new Error(`Failed to fetch stations (${stationsRes.status})`)
        if (!warningsRes.ok) throw new Error(`Failed to fetch warnings (${warningsRes.status})`)

        const [stationsData, warningsData] = await Promise.all([
          stationsRes.json(),
          warningsRes.json(),
        ])

        if (stationsData.error) throw new Error(stationsData.error)
        if (warningsData.error) throw new Error(warningsData.error)

        setStations(stationsData)
        setWarnings(warningsData)
        setLastUpdated(new Date())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load flood data')
      } finally {
        setLoading(false)
      }
    },
    [riverName, center],
  )

  useEffect(() => {
    fetchData(demoMode)
  }, [fetchData, demoMode])

  function toggleDemo() {
    setDemoMode((prev) => {
      const next = !prev
      fetchData(next)
      return next
    })
  }

  const warningCounts = warnings.reduce<Record<number, number>>((acc, w) => {
    acc[w.severityLevel] = (acc[w.severityLevel] ?? 0) + 1
    return acc
  }, {})

  const activeWarnings = warnings.filter((w) => w.severityLevel < 4)
  const highStations = stations.filter(
    (s) => s.levelStatus === 'high' || s.levelStatus === 'above',
  )

  function formatLastUpdated(date: Date) {
    const secs = Math.floor((Date.now() - date.getTime()) / 1000)
    if (secs < 60) return 'just now'
    if (secs < 3600) return `${Math.floor(secs / 60)} min ago`
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <header className="flex-none bg-slate-900 border-b border-slate-700 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* Title */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-blue-400 text-xl">🌊</span>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">York Flood Monitor</h1>
              <p className="text-slate-400 text-xs">{riverName}</p>
            </div>
          </div>

          {/* Warning badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {([1, 2, 3] as const).map((level) => {
              const cfg = SEVERITY_CONFIG[level]
              const count = warningCounts[level] ?? 0
              return (
                <span
                  key={level}
                  style={{
                    background: count > 0 ? cfg.bg : '#334155',
                    color: count > 0 ? cfg.text : '#94a3b8',
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                >
                  {count} {cfg.short}
                </span>
              )
            })}
          </div>

          {/* Station stats */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>
              <span className="text-white font-semibold">{stations.length}</span> stations
            </span>
            {highStations.length > 0 && (
              <span className="text-amber-400 font-semibold">
                ⚠ {highStations.length} elevated
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Controls */}
          <div className="flex items-center gap-3 text-xs">
            {lastUpdated && (
              <span className="text-slate-400">Updated {formatLastUpdated(lastUpdated)}</span>
            )}

            {/* Demo toggle */}
            <button
              onClick={toggleDemo}
              disabled={loading}
              className={`px-3 py-1.5 rounded font-semibold transition-colors disabled:cursor-not-allowed ${
                demoMode
                  ? 'bg-amber-500 hover:bg-amber-400 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}
            >
              {demoMode ? '⚠ Demo ON' : 'Demo Mode'}
            </button>

            <button
              onClick={() => fetchData(demoMode)}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded font-semibold transition-colors"
            >
              {loading ? '…' : '↺ Refresh'}
            </button>
          </div>
        </div>

        {/* Demo mode banner */}
        {demoMode && (
          <div className="mt-2 text-xs rounded px-3 py-1.5 font-medium bg-amber-950 text-amber-300 border border-amber-700">
            Demo mode — simulated flood scenario using real Environment Agency boundaries. Not live
            data.
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mt-2 text-xs text-red-300 bg-red-950 border border-red-800 rounded px-3 py-1.5">
            {error}
          </div>
        )}

        {/* Active warning banner (live mode only) */}
        {activeWarnings.length > 0 && !error && !demoMode && (
          <div
            className="mt-2 text-xs rounded px-3 py-1.5 font-medium"
            style={{
              background: warningCounts[1] ? '#450a0a' : warningCounts[2] ? '#450a0a' : '#422006',
              color: warningCounts[1] ? '#fca5a5' : warningCounts[2] ? '#fca5a5' : '#fcd34d',
              border: `1px solid ${warningCounts[1] ? '#7f1d1d' : warningCounts[2] ? '#991b1b' : '#78350f'}`,
            }}
          >
            {activeWarnings[0].description}
            {activeWarnings.length > 1 && ` (+${activeWarnings.length - 1} more)`}
          </div>
        )}
      </header>

      {/* Map */}
      <main className="flex-1 min-h-0">
        <FloodMap stations={stations} warnings={warnings} center={center} zoom={zoom} />
      </main>
    </div>
  )
}

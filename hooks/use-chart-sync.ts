'use client'

import { useCallback, useRef } from 'react'

type TimeScaleLike = {
  getVisibleLogicalRange: () => { from: number; to: number } | null
  setVisibleLogicalRange: (range: { from: number; to: number }) => void
  subscribeVisibleLogicalRangeChange: (handler: (range: any) => void) => void
  unsubscribeVisibleLogicalRangeChange: (handler: (range: any) => void) => void
}

/**
 * Syncs the time scales of multiple lightweight-charts instances.
 * When one chart is scrolled/zoomed, all others follow.
 *
 * Usage:
 *   const { registerChart } = useChartSync()
 *   // After creating each chart:
 *   registerChart('price', chart.timeScale())
 *   registerChart('rsi', chart.timeScale())
 *   registerChart('macd', chart.timeScale())
 */
export function useChartSync() {
  const chartsRef = useRef<Map<string, TimeScaleLike>>(new Map())
  const isSyncingRef = useRef(false)
  const handlersRef = useRef<Map<string, (range: any) => void>>(new Map())

  const syncOthers = useCallback((sourceId: string, range: { from: number; to: number } | null) => {
    if (isSyncingRef.current || !range) return
    isSyncingRef.current = true

    chartsRef.current.forEach((ts, id) => {
      if (id !== sourceId) {
        try {
          ts.setVisibleLogicalRange(range)
        } catch {}
      }
    })

    isSyncingRef.current = false
  }, [])

  const registerChart = useCallback((id: string, timeScale: TimeScaleLike) => {
    // Unsubscribe old handler if re-registering
    const oldHandler = handlersRef.current.get(id)
    const oldTs = chartsRef.current.get(id)
    if (oldHandler && oldTs) {
      try { oldTs.unsubscribeVisibleLogicalRangeChange(oldHandler) } catch {}
    }

    chartsRef.current.set(id, timeScale)

    const handler = (range: any) => syncOthers(id, range)
    handlersRef.current.set(id, handler)
    timeScale.subscribeVisibleLogicalRangeChange(handler)
  }, [syncOthers])

  const unregisterChart = useCallback((id: string) => {
    const handler = handlersRef.current.get(id)
    const ts = chartsRef.current.get(id)
    if (handler && ts) {
      try { ts.unsubscribeVisibleLogicalRangeChange(handler) } catch {}
    }
    chartsRef.current.delete(id)
    handlersRef.current.delete(id)
  }, [])

  return { registerChart, unregisterChart }
}
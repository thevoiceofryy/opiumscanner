'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { globalBTCPriceRef } from '@/hooks/use-btc-price'
import type { Kline, CryptoData } from '@/lib/types'

interface PriceChartProps {
  data: Kline[]
  symbol: string
  interval: string
  cryptoData?: CryptoData | null
  priceToBeat?: number | null
  livePrice?: number | null
}

export function PriceChart({
  data,
  symbol,
  interval,
  cryptoData,
  priceToBeat,
  livePrice,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const candleSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const targetLineRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const lastCandleRef = useRef<any>(null)
  const prevRafPrice = useRef<number>(0)
  const prevPriceRef = useRef<number | null>(null)
  const [displayPrice, setDisplayPrice] = useState<number>(0)
  const [priceMove, setPriceMove] = useState<'UP' | 'DOWN' | null>(null)
  const [priceUpdateTime, setPriceUpdateTime] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Build candles
  const { candles, volumes } = useMemo(() => {
    if (!data?.length) return { candles: [], volumes: [] }
    const candles: any[] = []
    const volumes: any[] = []
    data.slice(-120).forEach((k) => {
      const time = Math.floor(Number(k.openTime) / 1000)
      const open = Number(k.open)
      const high = Number(k.high)
      const low = Number(k.low)
      const close = Number(k.close)
      candles.push({ time, open, high, low, close })
      volumes.push({
        time,
        value: Number(k.volume),
        color: close >= open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
      })
    })
    return { candles, volumes }
  }, [data])

  // Keep lastCandleRef fresh
  useEffect(() => {
    if (candles.length) {
      lastCandleRef.current = candles[candles.length - 1]
      setIsLoading(false)
    }
  }, [candles])

  // Safety fallback — never stay loading more than 5 seconds
  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 5000)
    return () => clearTimeout(timeout)
  }, [interval])

  // ── Chart init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    setIsLoading(true)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    // Safe cleanup of previous chart
    try {
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
    } catch {}

    candleSeriesRef.current = null
    volumeSeriesRef.current = null
    targetLineRef.current = null
    prevRafPrice.current = 0
    lastCandleRef.current = null

    let destroyed = false
    let pollId: ReturnType<typeof setInterval>
    let resizeObserver: ResizeObserver | null = null

    const init = async () => {
      if (destroyed || !el || el.clientWidth === 0 || el.clientHeight === 0) return
      const LC = await import('lightweight-charts')
      if (destroyed) return

      const chart = LC.createChart(el, {
        layout: { background: { color: 'transparent' }, textColor: '#6b7280', fontFamily: 'monospace' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
        crosshair: { vertLine: { color: '#374151', width: 1, style: 3 }, horzLine: { color: '#374151', width: 1, style: 3 } },
        rightPriceScale: { borderColor: '#1f2937', scaleMargins: { top: 0.1, bottom: 0.25 } },
        timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
        width: el.clientWidth,
        height: el.clientHeight,
      })

      if (destroyed) {
        try { chart.remove() } catch {}
        return
      }

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#22c55e', downColor: '#ef4444',
        borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      })
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' }, priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

      chartRef.current = chart
      candleSeriesRef.current = candleSeries
      volumeSeriesRef.current = volumeSeries

      resizeObserver = new ResizeObserver(() => {
        if (el && chartRef.current) {
          try {
            chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight })
          } catch {}
        }
      })
      resizeObserver.observe(el)

      clearInterval(pollId)
    }

    if (el.clientWidth === 0 || el.clientHeight === 0) {
      pollId = setInterval(() => { if (el.clientWidth > 0 && el.clientHeight > 0) init() }, 50)
    } else {
      init()
    }

    return () => {
      destroyed = true
      clearInterval(pollId)
      if (resizeObserver) { try { resizeObserver.disconnect() } catch {} }
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try {
        if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
      } catch {}
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      targetLineRef.current = null
    }
  }, [interval])

  // ── Load candle data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!candles.length || !candleSeriesRef.current) return
    try {
      candleSeriesRef.current.setData(candles)
      volumeSeriesRef.current?.setData(volumes)
      chartRef.current?.timeScale().fitContent()
    } catch {}
  }, [candles, volumes])

  // ── Target line ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return
    if (targetLineRef.current) {
      try { candleSeriesRef.current.removePriceLine(targetLineRef.current) } catch {}
      targetLineRef.current = null
    }
    if (priceToBeat != null && priceToBeat > 0) {
      try {
        targetLineRef.current = candleSeriesRef.current.createPriceLine({
          price: priceToBeat, color: '#22c55e', lineWidth: 1,
          lineStyle: 2, axisLabelVisible: true, title: '▶ TARGET',
        })
      } catch {}
    }
  }, [priceToBeat, candles])

  // ── RAF loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const tick = () => {
      const price = globalBTCPriceRef.current
      const last = lastCandleRef.current
      const cs = candleSeriesRef.current

      if (price > 50000 && last && cs && !isLoading) {
        if (price !== prevRafPrice.current) {
          try {
            cs.update({
              time: last.time,
              open: last.open,
              high: Math.max(last.high, price),
              low: Math.min(last.low, price),
              close: price,
            })
            prevRafPrice.current = price
          } catch {}
        }

        setDisplayPrice(prev => {
          if (price !== prev) {
            if (prevPriceRef.current !== null && price !== prevPriceRef.current) {
              setPriceMove(price > prevPriceRef.current ? 'UP' : 'DOWN')
              setPriceUpdateTime(new Date())
              setTimeout(() => setPriceMove(null), 400)
            }
            prevPriceRef.current = price
            return price
          }
          return prev
        })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isLoading])

  const showPrice = displayPrice > 50000 ? displayPrice
    : livePrice && livePrice > 50000 ? livePrice
    : cryptoData?.price && cryptoData.price > 50000 ? cryptoData.price
    : Number(data?.[data.length - 1]?.close ?? 0)

  return (
    <div className="w-full h-full flex flex-col bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium font-mono">{symbol}</span>
          <span className="px-2 py-1 text-xs bg-secondary rounded font-mono">{interval}</span>
          {priceUpdateTime && (
            <span className="text-[10px] text-muted-foreground">
              🔴 {priceUpdateTime.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6 font-mono">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">CURRENT</span>
            <span className={`text-2xl font-bold tabular-nums transition-colors duration-150 ${
              priceMove === 'UP' ? 'text-emerald-400' :
              priceMove === 'DOWN' ? 'text-red-500' : 'text-foreground'
            }`}>
              ${showPrice.toLocaleString(undefined, { minimumFractionDigits: 3 })}
            </span>
          </div>
          {priceToBeat != null && priceToBeat > 0 && (
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-orange-200">TARGET</span>
              <span className="text-lg font-semibold tabular-nums text-orange-400">
                ${priceToBeat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-xs font-bold ${showPrice > priceToBeat ? 'text-emerald-400' : 'text-red-400'}`}>
                {showPrice > priceToBeat ? '▲ ABOVE' : '▼ BELOW'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 w-full relative" style={{ minHeight: 0 }}>
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-card">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs font-mono text-muted-foreground">Loading chart data...</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" style={{ minHeight: 0 }} />
      </div>
    </div>
  )
}
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
  onChartReady?: (timeScale: any) => void
  onChartDestroy?: () => void
}

function computeATR(candles: any[], period = 14): number {
  if (candles.length < period + 1) return 0
  const trs = candles.slice(1).map((c: any, i: number) => {
    const prev = candles[i]
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    )
  })
  return trs.slice(-period).reduce((a: number, b: number) => a + b, 0) / period
}

function computeBB(candles: any[], period = 20) {
  const upper: any[] = [], middle: any[] = [], lower: any[] = []
  const closes = candles.map((c: any) => c.close)
  for (let i = period - 1; i < candles.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1)
    const mean  = slice.reduce((a: number, b: number) => a + b, 0) / period
    const std   = Math.sqrt(
      slice.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / period
    )
    upper.push({ time: candles[i].time, value: mean + 2 * std })
    middle.push({ time: candles[i].time, value: mean })
    lower.push({ time: candles[i].time, value: mean - 2 * std })
  }
  return { upper, middle, lower }
}

function makeChartOptions(el: HTMLDivElement, extra?: any) {
  return {
    layout: {
      background: { color: '#0a0e14' },
      textColor: '#4b5563',
      fontFamily: 'monospace',
      fontSize: 10,
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.025)' },
      horzLines: { color: 'rgba(255,255,255,0.03)' },
    },
    crosshair: {
      mode: 0,
      vertLine:  { color: 'rgba(255,255,255,0.12)', width: 1, style: 0, labelBackgroundColor: '#1f2937' },
      horzLine:  { color: 'rgba(255,255,255,0.12)', width: 1, style: 0, labelBackgroundColor: '#1f2937' },
    },
    handleScroll: true,
    handleScale: true,
    kineticScroll: { touch: true, mouse: true },
    width:  el.clientWidth  || 800,
    height: el.clientHeight || 400,
    ...extra,
  }
}

export function PriceChart({
  data,
  symbol,
  interval,
  cryptoData,
  priceToBeat,
  livePrice,
  onChartReady,
  onChartDestroy,
}: PriceChartProps) {
  const mainRef = useRef<HTMLDivElement>(null)

  const mainChartRef    = useRef<any>(null)
  const candleSeriesRef = useRef<any>(null)
  const volSeriesRef    = useRef<any>(null)
  const bbUpperRef      = useRef<any>(null)
  const bbMidRef        = useRef<any>(null)
  const bbLowerRef      = useRef<any>(null)
  const targetLineRef   = useRef<any>(null)
  const rafRef          = useRef<number | null>(null)
  const lastCandleRef   = useRef<any>(null)
  const prevRafPrice    = useRef<number>(0)
  const prevPriceRef    = useRef<number | null>(null)

  const [displayPrice,     setDisplayPrice]     = useState<number>(0)
  const [priceMove,        setPriceMove]        = useState<'UP' | 'DOWN' | null>(null)
  const [priceUpdateTime,  setPriceUpdateTime]  = useState<Date | null>(null)
  const [isLoading,        setIsLoading]        = useState(true)
  const [chartError,       setChartError]       = useState<string | null>(null)

  const { candles, volumes, times, closes, atr, priceDelta } = useMemo(() => {
    if (!data?.length)
      return { candles: [], volumes: [], times: [], closes: [], atr: 0, priceDelta: 0 }

    const candles: any[] = []
    const volumes: any[] = []

    data.slice(-120).forEach((k) => {
      const time  = Math.floor(Number(k.openTime) / 1000)
      const open  = Number(k.open)
      const high  = Number(k.high)
      const low   = Number(k.low)
      const close = Number(k.close)
      candles.push({ time, open, high, low, close })
      volumes.push({
        time,
        value: Number(k.volume),
        color: close >= open ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)',
      })
    })

    const closes     = candles.map((c: any) => c.close)
    const times      = candles.map((c: any) => c.time)
    const atr        = computeATR(candles)
    const priceDelta = candles.length >= 2
      ? candles[candles.length - 1].close - candles[candles.length - 2].close
      : 0

    return { candles, volumes, times, closes, atr, priceDelta }
  }, [data])

  useEffect(() => {
    if (candles.length) {
      lastCandleRef.current = candles[candles.length - 1]
      setIsLoading(false)
      setChartError(null)
    }
  }, [candles])

  // Force loading off after 3s max
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 3000)
    return () => clearTimeout(t)
  }, [interval])

  // ── Init chart ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const mainEl = mainRef.current
    if (!mainEl) { setChartError('Chart container not found'); return }

    setIsLoading(true)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    try { mainChartRef.current?.remove(); mainChartRef.current = null } catch {}
    prevRafPrice.current  = 0
    lastCandleRef.current = null

    let destroyed   = false
    let resizeObs: ResizeObserver | null = null

    const init = async () => {
      try {
        if (destroyed) return
        const LC = await import('lightweight-charts')
        if (destroyed) return

        const main = LC.createChart(mainEl, {
          ...makeChartOptions(mainEl),
          leftPriceScale: {
            visible: true,
            borderColor:  '#1a2332',
            scaleMargins: { top: 0.07, bottom: 0.2 },
            textColor:    '#4b5563',
          },
          rightPriceScale: {
            visible: false,
            borderColor:  '#1a2332',
            scaleMargins: { top: 0.07, bottom: 0.2 },
            textColor:    '#4b5563',
          },
          timeScale: {
            borderColor:  '#1a2332',
            timeVisible:  false,
            textColor:    '#4b5563',
          },
        })
        mainChartRef.current = main

        candleSeriesRef.current = main.addCandlestickSeries({
          upColor:        '#10b981', downColor:        '#ef4444',
          borderUpColor:  '#10b981', borderDownColor:  '#ef4444',
          wickUpColor:    '#10b981', wickDownColor:    '#ef4444',
          priceScaleId:   'left',
        })

        volSeriesRef.current = main.addHistogramSeries({
          priceFormat:  { type: 'volume' },
          priceScaleId: 'vol',
        })
        main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

        bbUpperRef.current = main.addLineSeries({
          color: 'rgba(255,255,255,0.15)', lineWidth: 1,
          priceLineVisible: false, lastValueVisible: false,
          priceScaleId: 'left',
        })
        bbMidRef.current = main.addLineSeries({
          color: 'rgba(255,255,255,0.07)', lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
          priceScaleId: 'left',
        })
        bbLowerRef.current = main.addLineSeries({
          color: 'rgba(255,255,255,0.15)', lineWidth: 1,
          priceLineVisible: false, lastValueVisible: false,
          priceScaleId: 'left',
        })

        if (onChartReady) onChartReady(main.timeScale())

        resizeObs = new ResizeObserver(() => {
          try {
            if (mainEl && mainChartRef.current)
              mainChartRef.current.applyOptions({
                width:  mainEl.clientWidth,
                height: mainEl.clientHeight,
              })
          } catch {}
        })
        resizeObs.observe(mainEl)

        setChartError(null)
        if (!destroyed) setIsLoading(false)
      } catch (error) {
        console.error('Error initializing chart:', error)
        if (!destroyed) {
          setChartError(error instanceof Error ? error.message : 'Failed to initialize chart')
          setIsLoading(false)
        }
      }
    }

    init().catch(err => {
      console.error('Chart init failed:', err)
      if (!destroyed) setIsLoading(false)
    })

    return () => {
      destroyed = true
      if (onChartDestroy) onChartDestroy()
      resizeObs?.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try { mainChartRef.current?.remove(); mainChartRef.current = null } catch {}
    }
  }, [])

  // ── Populate data with retry ──────────────────────────────────────────────────
  useEffect(() => {
    if (!candles.length) return

    const tryPopulate = () => {
      if (!candleSeriesRef.current) {
        setTimeout(tryPopulate, 100)
        return
      }
      try {
        lastCandleRef.current = candles[candles.length - 1]
        candleSeriesRef.current?.setData(candles)
        volSeriesRef.current?.setData(volumes)
        const bb = computeBB(candles)
        bbUpperRef.current?.setData(bb.upper)
        bbMidRef.current?.setData(bb.middle)
        bbLowerRef.current?.setData(bb.lower)
        mainChartRef.current?.timeScale().fitContent()
        setIsLoading(false)
        setChartError(null)
      } catch (error) {
        console.error('Error populating chart data:', error)
        setChartError(error instanceof Error ? error.message : 'Failed to populate chart data')
      }
    }

    tryPopulate()
  }, [candles, volumes, times])

  // ── Target price line ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return
    if (targetLineRef.current) {
      try { candleSeriesRef.current.removePriceLine(targetLineRef.current) } catch {}
      targetLineRef.current = null
    }
    if (priceToBeat != null && priceToBeat > 0) {
      try {
        targetLineRef.current = candleSeriesRef.current.createPriceLine({
          price:            priceToBeat,
          color:            '#ef4444',
          lineWidth:        1,
          lineStyle:        2,
          axisLabelVisible: true,
          title:            'TARGET ◀',
        })
      } catch {}
    }
  }, [priceToBeat, candles])

  // ── Live price RAF ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = () => {
      const price = globalBTCPriceRef.current
      const last  = lastCandleRef.current
      const cs    = candleSeriesRef.current
      if (price > 50000 && last && cs && !isLoading) {
        if (price !== prevRafPrice.current) {
          try {
            cs.update({
              time:  last.time,
              open:  last.open,
              high:  Math.max(last.high, price),
              low:   Math.min(last.low,  price),
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

  const showPrice  = displayPrice > 50000
    ? displayPrice
    : livePrice && livePrice > 50000
      ? livePrice
      : cryptoData?.price && cryptoData.price > 50000
        ? cryptoData.price
        : Number(data?.[data.length - 1]?.close ?? 0)

  const priceColor = priceMove === 'UP' ? '#10b981' : priceMove === 'DOWN' ? '#ef4444' : '#e5e7eb'
  const deltaColor = priceDelta >= 0 ? '#10b981' : '#ef4444'

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0e14] overflow-hidden">

      {/* ── TOP HEADER ── */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 font-mono"
        style={{ height: '32px', borderBottom: '1px solid #1a2332' }}
      >
        <span className="text-[11px] font-bold text-white">{symbol}</span>
        <span className="text-[10px] text-[#4b5563]">·</span>
        <span className="text-[10px] text-[#9ca3af]">{interval}</span>
        <span className="text-[10px] text-[#4b5563]">·</span>
        <span className="text-[10px] text-[#9ca3af]">HA</span>
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-0.5" />
        <span
          className="text-[12px] font-bold tabular-nums ml-1 transition-colors duration-150"
          style={{ color: priceColor }}
        >
          ${showPrice > 1000
            ? showPrice.toLocaleString(undefined, { minimumFractionDigits: 0 })
            : showPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
        <span className="text-[10px] font-bold tabular-nums" style={{ color: deltaColor }}>
          {priceDelta >= 0 ? '+' : ''}${Math.abs(priceDelta).toFixed(0)}
        </span>

        <div className="flex-1" />

        {atr > 0 && (
          <span className="text-[10px] text-[#6b7280]">
            ATR <span className="text-[#9ca3af]">${Math.round(atr)}</span>
          </span>
        )}
        <span className="text-[10px] text-[#6b7280] border border-[#1f2937] px-1.5 py-0.5 rounded">
          NY_OPEN
        </span>
        <span className="text-[10px] text-[#f59e0b] border border-[#f59e0b]/30 px-1.5 py-0.5 rounded bg-[#f59e0b]/10">
          Binance ✓
        </span>
        {priceToBeat != null && priceToBeat > 0 && (
          <span className={`text-[10px] font-bold ${showPrice > priceToBeat ? 'text-emerald-400' : 'text-red-400'}`}>
            TARGET ${priceToBeat.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
            {showPrice > priceToBeat ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* ── MAIN CHART ── */}
      <div className="relative flex-1 min-h-0">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0e14]">
            <div className="flex flex-col items-center gap-2">
              <div className="w-4 h-4 border border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">Loading chart...</span>
            </div>
          </div>
        )}
        {chartError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0e14]">
            <div className="text-red-400 text-sm text-center px-4">
              <p>Chart Error: {chartError}</p>
              <p className="text-xs text-muted-foreground mt-1">Check browser console for details</p>
            </div>
          </div>
        )}
        <div ref={mainRef} className="w-full h-full" />
      </div>
    </div>
  )
}
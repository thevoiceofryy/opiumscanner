'use client'

import { useEffect, useRef, useMemo } from 'react'
import type { Kline, Indicators } from '@/lib/types'

interface IndicatorsPanelProps {
  indicators: Indicators | null
  klines: Kline[]
  onChartReady?: (id: string, timeScale: any) => void
  onChartDestroy?: (id: string) => void
}

// ── Compute RSI from closes ───────────────────────────────────────────────────
function computeRSI(closes: number[], period = 14): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = []
  if (closes.length < period + 1) return out
  for (let i = period; i < closes.length; i++) {
    const slice = closes.slice(i - period, i + 1)
    let g = 0, l = 0
    for (let j = 1; j < slice.length; j++) {
      const d = slice[j] - slice[j - 1]
      if (d > 0) g += d; else l += Math.abs(d)
    }
    const rs = l === 0 ? 100 : (g / period) / (l / period)
    out.push({ time: 0, value: 100 - 100 / (1 + rs) })
  }
  return out
}

// ── Compute Stoch RSI K/D ─────────────────────────────────────────────────────
function computeStochRSI(rsiValues: number[], period = 14): { k: number[]; d: number[] } {
  if (rsiValues.length < period) return { k: [], d: [] }
  const k: number[] = []
  for (let i = period - 1; i < rsiValues.length; i++) {
    const sl = rsiValues.slice(i - period + 1, i + 1)
    const lo = Math.min(...sl), hi = Math.max(...sl)
    k.push(hi === lo ? 50 : ((rsiValues[i] - lo) / (hi - lo)) * 100)
  }
  const d = k.map((_, i) => i < 2 ? k[i] : (k[i] + k[i - 1] + k[i - 2]) / 3)
  return { k, d }
}

// ── Compute MACD ──────────────────────────────────────────────────────────────
function computeMACD(closes: number[]) {
  if (closes.length < 35) return { macd: [], signal: [], histogram: [] }
  const ema = (data: number[], p: number) => {
    const k = 2 / (p + 1), r = [data[0]]
    for (let i = 1; i < data.length; i++) r.push(data[i] * k + r[i - 1] * (1 - k))
    return r
  }
  const macdLine   = ema(closes, 12).map((v, i) => v - ema(closes, 26)[i]).slice(26)
  const signalLine = ema(macdLine, 9)
  const histogram  = macdLine.map((v, i) => v - signalLine[i])
  return { macd: macdLine, signal: signalLine, histogram }
}

// ── Shared chart base options (accepts optional overrides via extra) ───────────
function baseChartOptions(
  el: HTMLDivElement,
  showTime = false,
  extra?: Record<string, any>
) {
  return {
    layout: {
      background:  { color: '#0a0e14' },
      textColor:   '#4a5568',
      fontFamily:  'monospace',
      fontSize:    11,
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.025)' },
      horzLines: { color: 'rgba(255,255,255,0.04)'  },
    },
    crosshair: {
      mode:     0,
      vertLine: { color: 'rgba(255,255,255,0.15)', labelBackgroundColor: '#1a2332' },
      horzLine: { color: 'rgba(255,255,255,0.15)', labelBackgroundColor: '#1a2332' },
    },
    rightPriceScale: {
      borderColor:  '#1a2332',
      scaleMargins: { top: 0.05, bottom: 0.05 },
    },
    timeScale: {
      borderColor:    '#1a2332',
      timeVisible:    showTime,
      secondsVisible: false,
    },
    handleScroll: false,
    handleScale:  false,
    width:  el.clientWidth  || 600,
    height: el.clientHeight || 120,
    // extra spreads last so it cleanly overrides any key above
    ...extra,
  }
}

// ── RSI Chart ─────────────────────────────────────────────────────────────────
function RSIChart({
  times, rsiValues, stochK, stochD, onChartReady, onChartDestroy,
}: {
  times:           number[]
  rsiValues:       number[]
  stochK:          number[]
  stochD:          number[]
  onChartReady?:   (id: string, ts: any) => void
  onChartDestroy?: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<any>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !times.length || !rsiValues.length) return
    let destroyed = false

    const init = async () => {
      if (destroyed) return
      const LC = await import('lightweight-charts')
      if (destroyed || !el) return

      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }

      const chart = LC.createChart(el, baseChartOptions(el, false))
      chartRef.current = chart

      // RSI — soft violet
      const rsiSeries = chart.addLineSeries({
        color:            '#c4b5fd',
        lineWidth:        2,
        priceLineVisible: false,
        lastValueVisible: true,
        title:            'RSI',
      })
      // Stoch K — warm orange
      const kSeries = chart.addLineSeries({
        color:            '#fb923c',
        lineWidth:        1,
        priceLineVisible: false,
        lastValueVisible: false,
        title:            'K',
      })
      // Stoch D — muted orange dashed
      const dSeries = chart.addLineSeries({
        color:            '#c2410c',
        lineWidth:        1,
        lineStyle:        2,
        priceLineVisible: false,
        lastValueVisible: false,
        title:            'D',
      })

      rsiSeries.createPriceLine({ price: 70, color: '#ef5350', lineWidth: 1, lineStyle: 2, axisLabelVisible: true,  title: '70' })
      rsiSeries.createPriceLine({ price: 50, color: '#374151', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: ''   })
      rsiSeries.createPriceLine({ price: 30, color: '#26a69a', lineWidth: 1, lineStyle: 2, axisLabelVisible: true,  title: '30' })

      const rsiOffset   = times.length - rsiValues.length
      const stochOffset = times.length - stochK.length

      rsiSeries.setData(rsiValues.map((v, i) => ({ time: times[i + rsiOffset]   as any, value: v })))
      kSeries.setData(stochK.map((v, i)      => ({ time: times[i + stochOffset] as any, value: v })))
      dSeries.setData(stochD.map((v, i)      => ({ time: times[i + stochOffset] as any, value: v })))

      chart.timeScale().fitContent()
      if (onChartReady) onChartReady('rsi', chart.timeScale())

      new ResizeObserver(() => {
        if (el && chartRef.current)
          chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight })
      }).observe(el)
    }

    init()

    return () => {
      destroyed = true
      if (onChartDestroy) onChartDestroy('rsi')
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
    }
  }, [times, rsiValues, stochK, stochD])

  return <div ref={containerRef} className="w-full h-full" />
}

// ── MACD Chart ────────────────────────────────────────────────────────────────
function MACDChart({
  times, macd, signal, histogram, onChartReady, onChartDestroy,
}: {
  times:           number[]
  macd:            number[]
  signal:          number[]
  histogram:       number[]
  onChartReady?:   (id: string, ts: any) => void
  onChartDestroy?: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<any>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !times.length || !macd.length) return
    let destroyed = false

    const init = async () => {
      if (destroyed) return
      const LC = await import('lightweight-charts')
      if (destroyed || !el) return

      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }

      // MACD — time axis visible, tighter scale margins override via extra
      const chart = LC.createChart(el, baseChartOptions(el, true, {
        rightPriceScale: {
          borderColor:  '#1a2332',
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
      }))
      chartRef.current = chart

      const offset = times.length - macd.length

      // Histogram — coloured by direction & momentum
      const histSeries = chart.addHistogramSeries({
        priceLineVisible: false,
        lastValueVisible: false,
        title:            'Hist',
      })
      // MACD line — bright blue
      const macdSeries = chart.addLineSeries({
        color:            '#42a5f5',
        lineWidth:        2,
        priceLineVisible: false,
        lastValueVisible: true,
        title:            'MACD',
      })
      // Signal line — warm orange
      const signalSeries = chart.addLineSeries({
        color:            '#ffa726',
        lineWidth:        1,
        priceLineVisible: false,
        lastValueVisible: true,
        title:            'Signal',
      })

      // Zero line
      macdSeries.createPriceLine({
        price: 0, color: '#374151', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: false, title: '',
      })

      // Colour histogram bars by direction & momentum
      const histData = histogram.map((v, i) => {
        const prev    = i > 0 ? histogram[i - 1] : v
        const growing = v >= 0 ? v >= prev : v <= prev
        const color   = v >= 0
          ? (growing ? '#26a69a' : '#1b7a72')
          : (growing ? '#ef5350' : '#b71c1c')
        return { time: times[i + offset] as any, value: v, color }
      })

      histSeries.setData(histData)
      macdSeries.setData(macd.map((v, i)     => ({ time: times[i + offset] as any, value: v })))
      signalSeries.setData(signal.map((v, i) => ({ time: times[i + offset] as any, value: v })))

      chart.timeScale().fitContent()
      if (onChartReady) onChartReady('macd', chart.timeScale())

      new ResizeObserver(() => {
        if (el && chartRef.current)
          chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight })
      }).observe(el)
    }

    init()

    return () => {
      destroyed = true
      if (onChartDestroy) onChartDestroy('macd')
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
    }
  }, [times, macd, signal, histogram])

  return <div ref={containerRef} className="w-full h-full" />
}

// ── Main export ───────────────────────────────────────────────────────────────
export function IndicatorsPanel({
  indicators, klines, onChartReady, onChartDestroy,
}: IndicatorsPanelProps) {
  const hasData = !!indicators

  const { times, rsiValues, stochK, stochD, macdData } = useMemo(() => {
    const times  = klines.map(k => Math.floor(Number(k.openTime) / 1000))
    const closes = klines.map(k => Number(k.close)).filter(Boolean)

    const rsiRaw    = computeRSI(closes)
    const rsiValues = rsiRaw.map(r => r.value)
    const { k: stochK, d: stochD } = computeStochRSI(rsiValues)
    const macdData  = computeMACD(closes)

    return { times, rsiValues, stochK, stochD, macdData }
  }, [klines])

  if (!hasData || !indicators) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0e14] text-muted-foreground text-xs font-mono">
        Syncing indicator data...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0e14]">

      {/* ── RSI panel ── */}
      <div className="flex-1 min-h-0 flex flex-col">

        {/* RSI label bar — scanner style */}
        <div
          className="flex items-center gap-3 px-3 flex-shrink-0"
          style={{ height: '22px', borderBottom: '1px solid #1a2332', background: '#080b10' }}
        >
          <span className="text-[9px] font-mono text-[#6b7280]">
            RSI 14&nbsp;
            <span
              className="font-bold text-[10px]"
              style={{
                color: (indicators.rsi ?? 0) >= 70 ? '#ef4444'
                     : (indicators.rsi ?? 0) <= 30 ? '#22c55e'
                     : '#a78bfa',
              }}
            >
              {(indicators.rsi ?? 0).toFixed(1)}
            </span>
          </span>
          <span className="text-[9px] font-mono" style={{ color: '#eab308' }}>
            K:{(indicators.stochK ?? 0).toFixed(1)}&nbsp;
            D:{(indicators.stochD ?? 0).toFixed(1)}
          </span>
          <span
            className={`ml-auto text-[9px] px-1.5 rounded font-mono ${
              indicators.rsiSignal === 'OVERBOUGHT' ? 'bg-red-950/60 text-red-400'
            : indicators.rsiSignal === 'OVERSOLD'   ? 'bg-emerald-950/60 text-emerald-400'
            : 'text-[#4b5563]'
            }`}
          >
            {indicators.rsiSignal || 'NEUTRAL'}
          </span>
        </div>

        <div className="flex-1 min-h-0">
          <RSIChart
            times={times}
            rsiValues={rsiValues}
            stochK={stochK}
            stochD={stochD}
            onChartReady={onChartReady}
            onChartDestroy={onChartDestroy}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#1a2332] flex-shrink-0" />

      {/* ── MACD panel ── */}
      <div className="flex-1 min-h-0 flex flex-col">

        {/* MACD label bar — scanner style */}
        <div
          className="flex items-center gap-2 px-3 flex-shrink-0"
          style={{ height: '22px', borderBottom: '1px solid #1a2332', background: '#080b10' }}
        >
          <span className="text-[9px] font-mono text-[#6b7280]">MACD 12-26-9</span>
          <span className="text-[9px] font-mono font-bold text-[#60a5fa]">
            MACD {(indicators.macd ?? 0).toFixed(2)}
          </span>
          <span className="text-[9px] font-mono text-[#f97316]">
            Sig {(indicators.macdSignal ?? 0).toFixed(2)}
          </span>
          <span
            className={`text-[9px] font-mono font-bold ${
              (indicators.macdHistogram ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            Hist {(indicators.macdHistogram ?? 0).toFixed(2)}
          </span>
          <span
            className={`ml-auto text-[9px] px-1.5 rounded font-mono ${
              indicators.macdTrend === 'BULLISH'
                ? 'bg-emerald-950/60 text-emerald-400'
                : 'bg-red-950/60 text-red-400'
            }`}
          >
            {indicators.macdTrend || 'NEUTRAL'}
          </span>
        </div>

        <div className="flex-1 min-h-0">
          <MACDChart
            times={times}
            macd={macdData.macd}
            signal={macdData.signal}
            histogram={macdData.histogram}
            onChartReady={onChartReady}
            onChartDestroy={onChartDestroy}
          />
        </div>
      </div>

    </div>
  )
}
'use client'

import { useEffect, useRef, useMemo } from 'react'
import type { Kline, Indicators } from '@/lib/types'

interface IndicatorsPanelProps {
  indicators: Indicators | null
  klines: Kline[]
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
  const macdLine = ema(closes, 12).map((v, i) => v - ema(closes, 26)[i]).slice(26)
  const signalLine = ema(macdLine, 9)
  const histogram = macdLine.map((v, i) => v - signalLine[i])
  return { macd: macdLine, signal: signalLine, histogram }
}

// ── RSI Chart component ───────────────────────────────────────────────────────
function RSIChart({ times, rsiValues, stochK, stochD }: {
  times: number[]
  rsiValues: number[]
  stochK: number[]
  stochD: number[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !times.length || !rsiValues.length) return

    let destroyed = false

    const init = async () => {
      if (destroyed) return
      const LC = await import('lightweight-charts')
      if (destroyed || !el) return

      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }

      const chart = LC.createChart(el, {
        layout: {
          background: { color: '#05080B' },
          textColor: '#6b7280',
          fontFamily: 'monospace',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.03)' },
          horzLines: { color: 'rgba(255,255,255,0.05)' },
        },
        crosshair: {
          vertLine: { color: '#374151', width: 1, style: 3 },
          horzLine: { color: '#374151', width: 1, style: 3 },
        },
        rightPriceScale: {
          borderColor: '#1f2937',
          scaleMargins: { top: 0.05, bottom: 0.05 },
        },
        timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
        width: el.clientWidth,
        height: el.clientHeight,
      })

      chartRef.current = chart

      // RSI line — purple/colored
      const rsiSeries = chart.addLineSeries({
        color: '#a78bfa',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'RSI',
      })

      // Stoch K — yellow solid
      const kSeries = chart.addLineSeries({
        color: '#eab308',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'K',
      })

      // Stoch D — yellow dashed (lightweight-charts doesn't support dash natively, use lower opacity)
      const dSeries = chart.addLineSeries({
        color: '#ca8a04',
        lineWidth: 1,
        lineStyle: 2, // dashed
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'D',
      })

      // Overbought/oversold lines via price lines
      rsiSeries.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '70' })
      rsiSeries.createPriceLine({ price: 50, color: '#6b7280', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' })
      rsiSeries.createPriceLine({ price: 30, color: '#22c55e', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '30' })

      // Align stoch offset to RSI times (RSI starts at index 14, stoch starts later)
      const rsiOffset = times.length - rsiValues.length
      const stochOffset = times.length - stochK.length

      rsiSeries.setData(rsiValues.map((v, i) => ({ time: times[i + rsiOffset] as any, value: v })))
      kSeries.setData(stochK.map((v, i) => ({ time: times[i + stochOffset] as any, value: v })))
      dSeries.setData(stochD.map((v, i) => ({ time: times[i + stochOffset] as any, value: v })))

      chart.timeScale().fitContent()

      new ResizeObserver(() => {
        if (el && chartRef.current) {
          chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight })
        }
      }).observe(el)
    }

    init()

    return () => {
      destroyed = true
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
    }
  }, [times, rsiValues, stochK, stochD])

  return <div ref={containerRef} className="w-full h-full" />
}

// ── MACD Chart component ──────────────────────────────────────────────────────
function MACDChart({ times, macd, signal, histogram }: {
  times: number[]
  macd: number[]
  signal: number[]
  histogram: number[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !times.length || !macd.length) return

    let destroyed = false

    const init = async () => {
      if (destroyed) return
      const LC = await import('lightweight-charts')
      if (destroyed || !el) return

      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }

      const chart = LC.createChart(el, {
        layout: {
          background: { color: '#05080B' },
          textColor: '#6b7280',
          fontFamily: 'monospace',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.03)' },
          horzLines: { color: 'rgba(255,255,255,0.05)' },
        },
        crosshair: {
          vertLine: { color: '#374151', width: 1, style: 3 },
          horzLine: { color: '#374151', width: 1, style: 3 },
        },
        rightPriceScale: {
          borderColor: '#1f2937',
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
        width: el.clientWidth,
        height: el.clientHeight,
      })

      chartRef.current = chart

      const offset = times.length - macd.length

      // Histogram — colored bars
      const histSeries = chart.addHistogramSeries({
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'Hist',
      })

      // MACD line — blue
      const macdSeries = chart.addLineSeries({
        color: '#60a5fa',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'MACD',
      })

      // Signal line — orange
      const signalSeries = chart.addLineSeries({
        color: '#f97316',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: 'Signal',
      })

      // Zero line
      macdSeries.createPriceLine({ price: 0, color: '#6b7280', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' })

      // Color histogram bars by value and momentum
      const histData = histogram.map((v, i) => {
        const prev = i > 0 ? histogram[i - 1] : v
        const growing = v >= 0 ? v >= prev : v <= prev
        const color = v >= 0
          ? (growing ? '#22c55e' : '#16a34a')
          : (growing ? '#ef4444' : '#b91c1c')
        return { time: times[i + offset] as any, value: v, color }
      })

      histSeries.setData(histData)
      macdSeries.setData(macd.map((v, i) => ({ time: times[i + offset] as any, value: v })))
      signalSeries.setData(signal.map((v, i) => ({ time: times[i + offset] as any, value: v })))

      chart.timeScale().fitContent()

      new ResizeObserver(() => {
        if (el && chartRef.current) {
          chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight })
        }
      }).observe(el)
    }

    init()

    return () => {
      destroyed = true
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
    }
  }, [times, macd, signal, histogram])

  return <div ref={containerRef} className="w-full h-full" />
}

// ── Main component ────────────────────────────────────────────────────────────
export function IndicatorsPanel({ indicators, klines }: IndicatorsPanelProps) {
  const hasData = !!indicators

  const { times, closes, rsiValues, stochK, stochD, macdData } = useMemo(() => {
    const times = klines.map(k => Math.floor(Number(k.openTime) / 1000))
    const closes = klines.map(k => Number(k.close)).filter(Boolean)

    const rsiRaw = computeRSI(closes)
    const rsiValues = rsiRaw.map(r => r.value)
    const { k: stochK, d: stochD } = computeStochRSI(rsiValues)
    const macdData = computeMACD(closes)

    return { times, closes, rsiValues, stochK, stochD, macdData }
  }, [klines])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#05080B]">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-border/30 flex items-center justify-between flex-shrink-0">
        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
          Market Indicators
        </span>
        {hasData && (
          <span className="text-[10px] font-mono text-muted-foreground">
            Trend:&nbsp;
            <span className={`font-bold ${
              indicators?.trend === 'UP' ? 'text-bullish'
              : indicators?.trend === 'DOWN' ? 'text-bearish' : ''
            }`}>
              {indicators?.trend}
            </span>
          </span>
        )}
      </div>

      {!hasData && (
        <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
          Syncing indicator data...
        </div>
      )}

      {hasData && indicators && (
        <div className="flex flex-col h-full overflow-hidden divide-y divide-border/30">

          {/* RSI panel */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-3 px-3 py-1 flex-shrink-0 bg-[#05080B] border-b border-border/20">
              <span className="text-[9px] font-mono text-muted-foreground">
                RSI (14)&nbsp;
                <span className="font-bold text-[10px]" style={{
                  color: indicators.rsi >= 70 ? '#ef4444' : indicators.rsi <= 30 ? '#22c55e' : '#a78bfa'
                }}>
                  {indicators.rsi.toFixed(1)}
                </span>
              </span>
              <span className="text-[9px] font-mono" style={{ color: '#eab308' }}>
                K:{(indicators.stochK ?? 0).toFixed(1)}&nbsp;D:{(indicators.stochD ?? 0).toFixed(1)}
              </span>
              <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-mono ${
                indicators.rsiSignal === 'OVERBOUGHT' ? 'bg-bearish/20 text-bearish'
                : indicators.rsiSignal === 'OVERSOLD'  ? 'bg-bullish/20 text-bullish'
                : 'bg-muted/20 text-muted-foreground'
              }`}>
                {indicators.rsiSignal}
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <RSIChart
                times={times}
                rsiValues={rsiValues}
                stochK={stochK}
                stochD={stochD}
              />
            </div>
          </div>

          {/* MACD panel */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-2 px-3 py-1 flex-shrink-0 bg-[#05080B] border-b border-border/20">
              <span className="text-[9px] font-mono text-muted-foreground">MACD (12,26,9)</span>
              <span className="text-[9px] font-mono font-bold text-[#60a5fa]">
                {(indicators.macd ?? 0).toFixed(2)}
              </span>
              <span className="text-[9px] font-mono text-[#f97316]">
                Sig {(indicators.macdSignal ?? 0).toFixed(2)}
              </span>
              <span className={`text-[9px] font-mono font-bold ${
                (indicators.macdHistogram ?? 0) >= 0 ? 'text-bullish' : 'text-bearish'
              }`}>
                Hist {(indicators.macdHistogram ?? 0).toFixed(2)}
              </span>
              <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-mono ${
                indicators.macdTrend === 'BULLISH' ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'
              }`}>
                {indicators.macdTrend}
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <MACDChart
                times={times}
                macd={macdData.macd}
                signal={macdData.signal}
                histogram={macdData.histogram}
              />
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

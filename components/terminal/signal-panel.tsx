'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Calculator,
} from 'lucide-react'
import type { CryptoData, MarketPrice } from '@/lib/types'

interface SignalPanelProps {
  cryptoData: CryptoData | null
  marketPrices: { yes: MarketPrice | null; no: MarketPrice | null }
}

interface ConfluenceItem {
  name: string
  signal: 'bullish' | 'bearish' | 'neutral'
  weight: number
}

export function SignalPanel({ cryptoData, marketPrices }: SignalPanelProps) {
  const indicators = cryptoData?.indicators

  // Calculate YES/NO prices (live from Polymarket)
  const yesPrice = marketPrices.yes?.midPrice ? (marketPrices.yes.midPrice * 100).toFixed(0) : '--'
  const noPrice = marketPrices.no?.midPrice ? (marketPrices.no.midPrice * 100).toFixed(0) : '--'
  const yesPriceNum = marketPrices.yes?.midPrice || 0
  const noPriceNum = marketPrices.no?.midPrice || 0

  // Simple market edge vs 50c fair
  const yesEdge = yesPriceNum ? ((yesPriceNum - 0.5) * 100).toFixed(0) : '0'
  const noEdge = noPriceNum ? ((noPriceNum - 0.5) * 100).toFixed(0) : '0'

  // Confluence from multiple indicators (live from Binance)
  const confluence = useMemo((): ConfluenceItem[] => {
    if (!indicators) return []

    return [
      {
        name: 'RSI',
        signal: indicators.rsi > 70 ? 'bearish' : indicators.rsi < 30 ? 'bullish' : 'neutral',
        weight: 1,
      },
      {
        name: 'MACD',
        signal: indicators.macdHistogram > 0 ? 'bullish' : 'bearish',
        weight: 1.5,
      },
      {
        name: 'Trend',
        signal:
          indicators.trend === 'UP'
            ? 'bullish'
            : indicators.trend === 'DOWN'
              ? 'bearish'
              : 'neutral',
        weight: 2,
      },
      {
        name: 'StochRSI',
        signal: indicators.stochK > 80 ? 'bearish' : indicators.stochK < 20 ? 'bullish' : 'neutral',
        weight: 1,
      },
      {
        name: 'VWAP',
        signal:
          indicators.vwapDeviation > 0.5
            ? 'bullish'
            : indicators.vwapDeviation < -0.5
              ? 'bearish'
              : 'neutral',
        weight: 1,
      },
      {
        name: 'SMA Cross',
        signal: indicators.sma20 > indicators.sma50 ? 'bullish' : 'bearish',
        weight: 1.5,
      },
    ]
  }, [indicators])

  // Simple position size calculator
  const [risk, setRisk] = useState(50)
  const [calcSide, setCalcSide] = useState<'YES' | 'NO'>('YES')

  // Core score filter toggles (OFI / OBI / FUND / 4H).
  // These are interactive UI chips; for now they scale the displayed
  // core score but do not change the underlying signal logic.
  const [coreFilters, setCoreFilters] = useState({
    ofi: true,
    obi: true,
    fund: true,
    h4: true,
  })

  // Apply core filters to confluence when computing overall signal
  const filteredConfluence = useMemo(() => {
    if (!confluence.length) return []

    return confluence.filter((item) => {
      if (item.name === 'RSI' || item.name === 'StochRSI') {
        return coreFilters.ofi
      }
      if (item.name === 'MACD' || item.name === 'SMA Cross') {
        return coreFilters.obi
      }
      if (item.name === 'VWAP') {
        return coreFilters.fund
      }
      if (item.name === 'Trend') {
        return coreFilters.h4
      }
      return true
    })
  }, [confluence, coreFilters])

  // Overall directional signal (now based on filtered confluence)
  const overallSignal = useMemo(() => {
    if (filteredConfluence.length === 0) {
      return { direction: 'NEUTRAL' as const, score: 0, bullish: 0, bearish: 0, totalWeight: 0 }
    }

    let bullishScore = 0
    let bearishScore = 0
    let totalWeight = 0

    filteredConfluence.forEach((item) => {
      totalWeight += item.weight
      if (item.signal === 'bullish') bullishScore += item.weight
      else if (item.signal === 'bearish') bearishScore += item.weight
    })

    const netScore = bullishScore - bearishScore
    const normalizedScore = totalWeight > 0 ? (netScore / totalWeight) * 100 : 0

    return {
      direction:
        normalizedScore > 20
          ? ('UP' as const)
          : normalizedScore < -20
          ? ('DOWN' as const)
          : ('NEUTRAL' as const),
      score: Math.round(normalizedScore),
      bullish: Math.round((bullishScore / totalWeight) * 100),
      bearish: Math.round((bearishScore / totalWeight) * 100),
      totalWeight,
    }
  }, [filteredConfluence])

  const bullishCount = filteredConfluence.filter((c) => c.signal === 'bullish').length

  // Composite signal message + "out-of-zone" logic (OOZ)
  const preferredSide =
    overallSignal.direction === 'UP' ? 'YES' : overallSignal.direction === 'DOWN' ? 'NO' : null
  const preferredPrice = preferredSide === 'YES' ? yesPriceNum : preferredSide === 'NO' ? noPriceNum : 0
  const inZone = preferredPrice > 0 && preferredPrice >= 0.35 && preferredPrice <= 0.7

  const compositeLabel =
    overallSignal.direction === 'NEUTRAL'
      ? 'SIGNAL NEUTRAL'
      : inZone
      ? `SIGNAL ${overallSignal.direction} ${preferredSide}`
      : `SIGNAL ${overallSignal.direction} BUT ${preferredSide} OOZ`

  const compositeSub =
    overallSignal.direction === 'NEUTRAL'
      ? 'Mixed signals – wait for a cleaner setup.'
      : inZone
      ? `${Math.abs(overallSignal.score)}% confidence from ${filteredConfluence.length} indicators.`
      : `Signal says ${overallSignal.direction} but ${preferredSide || 'side'} is outside 35–70c zone.`

  const activeCoreCount = Object.values(coreFilters).filter(Boolean).length || 1
  const coreScoreScaled = Math.round((overallSignal.score * activeCoreCount) / 4)

  const calcPrice = calcSide === 'YES' ? yesPriceNum : noPriceNum
  const calcSize = calcPrice > 0 ? risk / calcPrice : 0

  return (
    <div className="h-full flex flex-col p-3 space-y-3 overflow-y-auto">
      {/* SIGNAL HEADER */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Signal
          </span>
          <span className="text-[10px] text-muted-foreground">
            live • {cryptoData?.symbol || 'BTCUSDT'}
          </span>
        </div>

        {/* YES / NO CARDS */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-lg border border-bullish/40 bg-bullish/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-bullish/80 uppercase tracking-wider">YES</span>
              <span className="text-[10px] text-muted-foreground">
                edge {Number(yesEdge) >= 0 ? '+' : ''}
                {yesEdge}%
              </span>
            </div>
            <div className="text-2xl font-bold text-bullish leading-tight">{yesPrice}c</div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-bullish transition-all"
                style={{ width: `${Math.min(100, Math.max(0, yesPriceNum * 100))}%` }}
              />
            </div>
          </div>

          <div className="p-3 rounded-lg border border-bearish/40 bg-bearish/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-bearish/80 uppercase tracking-wider">NO</span>
              <span className="text-[10px] text-muted-foreground">
                edge {Number(noEdge) >= 0 ? '+' : ''}
                {noEdge}%
              </span>
            </div>
            <div className="text-2xl font-bold text-bearish leading-tight">{noPrice}c</div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-bearish transition-all"
                style={{ width: `${Math.min(100, Math.max(0, noPriceNum * 100))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* CONFLUENCE STRIP */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Confluence
          </span>
          <span className="text-xs text-muted-foreground">
            ~{bullishCount}/{confluence.length} UP
          </span>
        </div>

        <div className="flex gap-1 mb-2">
          {confluence.map((item, i) => (
            <div
              key={i}
              className={`flex-1 h-2 rounded-full ${
                item.signal === 'bullish'
                  ? 'bg-bullish'
                  : item.signal === 'bearish'
                    ? 'bg-bearish'
                    : 'bg-muted'
              }`}
              title={`${item.name}: ${item.signal}`}
            />
          ))}
        </div>

        <div className="flex h-3 rounded-full overflow-hidden text-[10px] mb-2">
          <div
            className="flex-1 bg-bullish/80 flex items-center justify-center"
            style={{ width: `${overallSignal.bullish || 50}%` }}
          >
            <span className="px-1">{overallSignal.bullish || 0}% UP</span>
          </div>
          <div
            className="flex-1 bg-bearish/80 flex items-center justify-center"
            style={{ width: `${overallSignal.bearish || 50}%` }}
          >
            <span className="px-1">{overallSignal.bearish || 0}% DN</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 text-[10px]">
          {confluence.map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              {item.signal === 'bullish' ? (
                <ArrowUp className="w-3 h-3 text-bullish" />
              ) : item.signal === 'bearish' ? (
                <ArrowDown className="w-3 h-3 text-bearish" />
              ) : (
                <Minus className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CORE SCORE + HISTORICAL EDGE (approximate, live) */}
      {confluence.length > 0 && (
        <div className="space-y-2">
          {/* Core score row (clickable chips) */}
          <div className="p-2 rounded-lg border border-border bg-secondary/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Core Score
              </span>
              <div className="flex items-center gap-1">
                <span
                  className={`text-xs font-semibold ${
                    overallSignal.direction === 'UP'
                      ? 'text-bullish'
                      : overallSignal.direction === 'DOWN'
                      ? 'text-bearish'
                      : 'text-warning'
                  }`}
                >
                  {coreScoreScaled > 0 ? '+' : ''}
                  {coreScoreScaled} / 100 {overallSignal.direction}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  ({activeCoreCount}/4 on)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[9px] mt-1">
              <button
                type="button"
                className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                  coreFilters.ofi
                    ? 'bg-secondary/60 border-border shadow-sm'
                    : 'bg-background border-border/40 text-muted-foreground opacity-40 line-through'
                }`}
                onClick={() =>
                  setCoreFilters((prev) => ({ ...prev, ofi: !prev.ofi }))
                }
              >
                OFI
              </button>
              <button
                type="button"
                className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                  coreFilters.obi
                    ? 'bg-secondary/60 border-border shadow-sm'
                    : 'bg-background border-border/40 text-muted-foreground opacity-40 line-through'
                }`}
                onClick={() =>
                  setCoreFilters((prev) => ({ ...prev, obi: !prev.obi }))
                }
              >
                OBI
              </button>
              <button
                type="button"
                className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                  coreFilters.fund
                    ? 'bg-secondary/60 border-border shadow-sm'
                    : 'bg-background border-border/40 text-muted-foreground opacity-40 line-through'
                }`}
                onClick={() =>
                  setCoreFilters((prev) => ({ ...prev, fund: !prev.fund }))
                }
              >
                FUND
              </button>
              <button
                type="button"
                className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                  coreFilters.h4
                    ? 'bg-bullish/20 border-bullish/40 shadow-sm'
                    : 'bg-background border-border/40 text-muted-foreground opacity-40 line-through'
                }`}
                onClick={() =>
                  setCoreFilters((prev) => ({ ...prev, h4: !prev.h4 }))
                }
              >
                4H {overallSignal.direction === 'UP' ? '✔' : overallSignal.direction === 'DOWN' ? '✕' : '•'}
              </button>
            </div>
          </div>

          {/* Historical edge approximation */}
          <div className="p-2 rounded-lg border border-border bg-secondary/40">
            <div className="flex items-center justify-between mb-1 text-[10px]">
              <span className="uppercase tracking-wider text-muted-foreground">
                Hist. Edge
              </span>
              <span className="text-muted-foreground">
                {overallSignal.bullish || 0}% UP / {overallSignal.bearish || 0}% DN
              </span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden mb-1">
              <div
                className="bg-bullish flex items-center justify-center text-[9px]"
                style={{ width: `${overallSignal.bullish || 50}%` }}
              >
                {overallSignal.bullish || 0}%
              </div>
              <div
                className="bg-bearish flex items-center justify-center text-[9px]"
                style={{ width: `${overallSignal.bearish || 50}%` }}
              >
                {overallSignal.bearish || 0}%
              </div>
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>RSI Mile: {indicators ? Math.round(Math.abs(indicators.rsi - 50)) : '--'}%</span>
              <span>ATR Mile: {indicators ? Math.round(indicators.atr) : '--'}</span>
            </div>
          </div>
        </div>
      )}

      {/* COMPOSITE SIGNAL CARD */}
      <div className="p-3 rounded-lg border border-border bg-secondary/40">
        <div className="flex items-center gap-2 mb-2">
          {overallSignal.direction === 'UP' ? (
            <CheckCircle className="w-5 h-5 text-bullish" />
          ) : overallSignal.direction === 'DOWN' ? (
            <XCircle className="w-5 h-5 text-bearish" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-warning" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider">
            {compositeLabel}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">{compositeSub}</div>
      </div>

      {/* ENTRY WINDOW */}
      <div className="p-3 rounded-lg border border-bullish/40 bg-bullish/5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase text-muted-foreground tracking-wider">
            Entry Window
          </span>
          <CheckCircle className="w-4 h-4 text-bullish" />
        </div>
        <div className="text-center">
          <span className="text-xs text-bullish block mb-1">ENTRY WINDOW OPEN</span>
          <EntryCountdown />
        </div>
      </div>

      {/* CALCULATOR */}
      <div className="p-3 rounded-lg border border-border bg-secondary/40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs uppercase text-muted-foreground tracking-wider">
              Calculator
            </span>
          </div>
          <div className="flex text-[10px] rounded bg-background overflow-hidden">
            <button
              type="button"
              className={`px-2 py-0.5 ${
                calcSide === 'YES' ? 'bg-bullish text-background' : 'text-muted-foreground'
              }`}
              onClick={() => setCalcSide('YES')}
            >
              YES
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 ${
                calcSide === 'NO' ? 'bg-bearish text-background' : 'text-muted-foreground'
              }`}
              onClick={() => setCalcSide('NO')}
            >
              NO
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground uppercase">Risk</span>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">$</span>
              <input
                type="number"
                min={10}
                step={10}
                className="w-20 bg-background border border-border rounded px-1 py-0.5 text-xs"
                value={risk}
                onChange={(e) => setRisk(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] text-muted-foreground uppercase">Size</span>
            <span className="text-sm font-semibold">
              {calcSize > 0 ? `${calcSize.toFixed(1)} shares` : '--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function EntryCountdown() {
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number } | null>(null)

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date()
      const minutes = now.getMinutes()
      const seconds = now.getSeconds()

      const nextMark = Math.ceil((minutes + 1) / 15) * 15
      const minutesLeft = (nextMark - minutes - 1 + 60) % 60
      const secondsLeft = 60 - seconds

      setTimeLeft({ minutes: minutesLeft, seconds: secondsLeft === 60 ? 0 : secondsLeft })
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(timer)
  }, [])

  if (!timeLeft) {
    return <div className="text-3xl font-bold text-foreground mt-1">--:--</div>
  }

  return (
    <div className="text-3xl font-bold text-foreground mt-1">
      {timeLeft.minutes.toString().padStart(2, '0')}:
      {timeLeft.seconds.toString().padStart(2, '0')}
    </div>
  )
}

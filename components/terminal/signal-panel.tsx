'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { AlertTriangle, Check, X, ChevronRight } from 'lucide-react'
import { useConvergence } from '@/hooks/use-convergence'
import { useOrderFlow } from '@/hooks/use-order-flow'
import type { CryptoData } from '@/lib/types'

interface SignalPanelProps {
  cryptoData: CryptoData | null
  marketPrices: { yes: number | null; no: number | null }
  selectedMarket: string | null
  priceToBeat: number
  btcPrice: number
  clobAskYes?: number | null
  clobAskNo?: number | null
  lastResult?: 'UP' | 'DOWN' | 'UNKNOWN'
  upRounds?: number
  downRounds?: number
  correctRounds?: number
  wrongRounds?: number
  resultsLog?: { bucket: number; result: 'UP' | 'DOWN'; predicted?: 'UP' | 'DOWN'; correct?: boolean; recordedAt: number }[]
}

function calcEV(trueProbability: number, askPrice: number): number {
  if (askPrice <= 0 || askPrice >= 1) return 0
  return (trueProbability * (1 - askPrice)) - ((1 - trueProbability) * askPrice)
}

export function SignalPanel({
  cryptoData,
  marketPrices,
  priceToBeat,
  btcPrice,
  clobAskYes = null,
  clobAskNo = null,
  correctRounds = 0,
  wrongRounds = 0,
  upRounds = 0,
  downRounds = 0,
  resultsLog = [],
}: SignalPanelProps) {
  const [remaining, setRemaining] = useState<number>(0)
  const [riskAmount, setRiskAmount] = useState<number>(50)
  const [selectedSide, setSelectedSide] = useState<'YES' | 'NO'>('YES')
  const [collapsed, setCollapsed] = useState(false)

  const confidence = marketPrices?.yes !== null ? Math.round(marketPrices.yes ?? 0) : 50
  const indicators = cryptoData?.indicators ?? null
  const { score: convergenceScore, status: convergenceStatus, direction } = useConvergence(
    indicators,
    remaining,
    confidence
  )
  const { buyVolumeRatio60s } = useOrderFlow()

  useEffect(() => {
    const update = () => {
      const now = Date.now()
      const bucketMs = 15 * 60 * 1000
      const bucketEnd = (Math.floor(now / bucketMs) + 1) * bucketMs
      setRemaining(Math.max(0, Math.floor((bucketEnd - now) / 1000)))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const ev = useMemo(() => {
    let trueProb = 0.5
    if (direction === 'UP') {
      trueProb = 0.5 + (convergenceScore / 100) * 0.49
    } else if (direction === 'DOWN') {
      trueProb = 0.5 - (convergenceScore / 100) * 0.49
    }
    trueProb = Math.min(0.99, Math.max(0.01, trueProb))

    const yesAsk = clobAskYes ?? (confidence / 100)
    const noAsk = clobAskNo ?? (clobAskYes !== null && clobAskYes !== undefined && clobAskYes < 0.98 ? (1 - clobAskYes) : ((100 - confidence) / 100))

    const yesEV = calcEV(trueProb, yesAsk)
    const noEV = calcEV(1 - trueProb, noAsk)

    const yesEdge = yesEV > 0 ? (yesEV / yesAsk) * 100 : 0
    const noEdge = noEV > 0 ? (noEV / noAsk) * 100 : 0

    let bestSide: 'YES' | 'NO' | null = null
    if (yesEV > noEV && yesEV > 0) bestSide = 'YES'
    else if (noEV > yesEV && noEV > 0) bestSide = 'NO'

    const yesInRange = yesAsk >= 0.50 && yesAsk <= 0.72

    return {
      trueProb, yesEV, noEV, bestSide,
      yesAsk, noAsk, yesEdge, noEdge, yesInRange,
    }
  }, [convergenceScore, direction, clobAskYes, clobAskNo, confidence])

  const confluenceIndicators = useMemo(() => {
    if (!indicators) return { up: 0, down: 0, total: 20 }
    let up = 0, down = 0

    if (indicators.rsi >= 70) up += 3
    else if (indicators.rsi >= 60) up += 2
    else if (indicators.rsi >= 50) up += 1
    else if (indicators.rsi <= 30) down += 3
    else if (indicators.rsi <= 40) down += 2
    else down += 1

    if (indicators.macdHistogram > 0 && indicators.macd > indicators.macdSignal) up += 3
    else if (indicators.macdHistogram > 0) up += 2
    else if (indicators.macdHistogram < 0 && indicators.macd < indicators.macdSignal) down += 3
    else down += 2

    if (indicators.stochK >= 80 && indicators.stochD >= 80) up += 3
    else if (indicators.stochK >= 60) up += 2
    else if (indicators.stochK >= 50) up += 1
    else if (indicators.stochK <= 20 && indicators.stochD <= 20) down += 3
    else if (indicators.stochK <= 40) down += 2
    else down += 1

    if (indicators.trend === 'UP') up += 3
    else if (indicators.trend === 'DOWN') down += 3

    if (indicators.vwapDeviation > 0.5) up += 2
    else if (indicators.vwapDeviation > 0) up += 1
    else if (indicators.vwapDeviation < -0.5) down += 2
    else down += 1

    if (buyVolumeRatio60s >= 0.60) up += 3
    else if (buyVolumeRatio60s >= 0.55) up += 2
    else if (buyVolumeRatio60s > 0.5) up += 1
    else if (buyVolumeRatio60s <= 0.40) down += 3
    else if (buyVolumeRatio60s <= 0.45) down += 2
    else down += 1

    if (btcPrice > 0 && priceToBeat > 0) {
      const delta = ((btcPrice - priceToBeat) / priceToBeat) * 100
      if (delta > 0.2) up += 3
      else if (delta > 0.1) up += 2
      else if (delta > 0) up += 1
      else if (delta < -0.2) down += 3
      else if (delta < -0.1) down += 2
      else down += 1
    }

    const total = up + down
    if (total < 20) {
      const rem = 20 - total
      if (up >= down) up += rem
      else down += rem
    }

    return { up: Math.min(up, 20), down: Math.min(down, 20 - up), total: 20 }
  }, [indicators, buyVolumeRatio60s, btcPrice, priceToBeat])

  const coreIndicators = useMemo(() => {
    if (!indicators) return { ofi: null, obi: null, fund: null, h4: null, total: 0, upCount: 0 }
    const ofi = buyVolumeRatio60s >= 0.52
    const obi = indicators.macdHistogram > 0
    const fund = indicators.trend === 'UP'
    const h4 = indicators.rsi >= 50 && indicators.stochK >= 50
    const checks = [ofi, obi, fund, h4]
    const upCount = checks.filter(Boolean).length
    return { ofi, obi, fund, h4, total: 10, upCount: direction === 'UP' ? upCount : -upCount }
  }, [indicators, buyVolumeRatio60s, direction])

  // Real historical edge from database
  const historicalEdge = useMemo(() => {
    const total = upRounds + downRounds
    if (total === 0) return { n: 0, upPct: 50, downPct: 50 }
    const upPct = Math.round((upRounds / total) * 100)
    return { n: total, upPct, downPct: 100 - upPct }
  }, [upRounds, downRounds])

  const compositeSignal = useMemo(() => {
    const signalDir = direction
    const yesPrice = ev.yesAsk
    const inRange = yesPrice >= 0.50 && yesPrice <= 0.72
    const hasEdge = ev.yesEV > 0.02 || ev.noEV > 0.02

    if (signalDir === 'UP' && !inRange) {
      return {
        type: 'warning' as const,
        title: `SIGNAL ${signalDir} BUT YES OUT OF ZONE`,
        subtitle: 'MODERATE',
        tags: ['CONF', 'CORE', 'HIST', '4H', '3C', 'NET'],
        message: `Signal says ${signalDir} but YES ${Math.round(yesPrice * 100)}¢ is outside 50-72¢. Can't enter.`,
      }
    } else if (hasEdge && inRange) {
      return {
        type: 'entry' as const,
        title: `SIGNAL ${signalDir} - ENTRY VALID`,
        subtitle: convergenceStatus,
        tags: ['CONF', 'CORE', 'HIST', '4H'],
        message: `Edge detected. ${signalDir} signal with valid entry price.`,
      }
    }
    return {
      type: 'wait' as const,
      title: 'WAITING FOR SIGNAL',
      subtitle: 'SCANNING',
      tags: [],
      message: 'Analyzing market conditions...',
    }
  }, [direction, ev, convergenceStatus])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const shares = selectedSide === 'YES'
    ? riskAmount / (ev.yesAsk || 1)
    : riskAmount / (ev.noAsk || 1)

  if (collapsed) {
    return (
      <div className="flex flex-col bg-card/50 backdrop-blur-sm">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center p-2 hover:bg-muted/20 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-info" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-card/50 backdrop-blur-sm text-xs font-mono overflow-y-auto">
      {/* Collapse button */}
      <div className="flex justify-end p-1">
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 hover:bg-muted/20 rounded transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180" />
        </button>
      </div>

      {/* SIGNAL Section */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            compositeSignal.type === 'entry' ? 'bg-bullish' :
            compositeSignal.type === 'warning' ? 'bg-warning' : 'bg-muted'
          }`} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Signal</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* YES/UP */}
          <div className={`p-2 rounded border ${ev.bestSide === 'YES' ? 'border-bullish/50 bg-bullish/5' : 'border-border/30 bg-muted/5'}`}>
            <div className="text-[9px] text-muted-foreground mb-1">YES = UP</div>
            <div className="text-2xl font-bold text-bullish">
              {Math.round((ev.yesAsk || 0) * 100)}¢
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">signal</span>
                <span>{convergenceScore}%</span>
              </div>
              <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-bullish rounded-full" style={{ width: `${convergenceScore}%` }} />
              </div>
              <div className="text-[10px] text-bullish font-semibold">
                edge +{ev.yesEdge.toFixed(0)}%
              </div>
            </div>
          </div>

          {/* NO/DOWN */}
          <div className={`p-2 rounded border ${ev.bestSide === 'NO' ? 'border-bearish/50 bg-bearish/5' : 'border-border/30 bg-muted/5'}`}>
            <div className="text-[9px] text-muted-foreground mb-1">NO = DOWN</div>
            <div className="text-2xl font-bold text-bearish">
              {Math.round((ev.noAsk || 0) * 100)}¢
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[9px]">
                <span className="text-muted-foreground">signal</span>
                <span>{100 - convergenceScore}%</span>
              </div>
              <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-bearish rounded-full" style={{ width: `${100 - convergenceScore}%` }} />
              </div>
              <div className="text-[10px] text-bearish font-semibold">
                edge +{ev.noEdge.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confluence */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted-foreground">Confluence</span>
          <span className="text-[11px]">
            ~{confluenceIndicators.up}/{confluenceIndicators.total} {direction}
          </span>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => {
            const isUp = i < confluenceIndicators.up
            const isDown = i >= (20 - confluenceIndicators.down)
            return (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  isUp ? 'bg-bullish' : isDown ? 'bg-bearish' : 'bg-muted/30'
                }`}
              />
            )
          })}
        </div>
      </div>

      {/* Core Score */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <span className="text-bullish">+</span>
            <span className="text-[10px] text-muted-foreground">CORE SCORE</span>
          </div>
          <span className={`text-[11px] ${coreIndicators.upCount > 0 ? 'text-bearish' : 'text-bullish'}`}>
            {coreIndicators.upCount > 0 ? '-' : ''}{Math.abs(coreIndicators.upCount)}/{coreIndicators.total} {direction}
          </span>
        </div>
        <div className="flex gap-1.5">
          <IndicatorTag label="OFI" active={coreIndicators.ofi} />
          <IndicatorTag label="OBI" active={coreIndicators.obi} />
          <IndicatorTag label="FUND" active={coreIndicators.fund} />
          <IndicatorTag label="4H" active={coreIndicators.h4} check />
        </div>
      </div>

      {/* Historical Edge */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">III</span>
            <span className="text-[10px] text-muted-foreground">
              HIST. EDGE {historicalEdge.n > 0 ? `N=${historicalEdge.n}` : 'BUILDING...'}
            </span>
          </div>
          <span className="text-[11px]">
            {historicalEdge.upPct}% UP / {historicalEdge.downPct}% DN
          </span>
        </div>
        <div className="flex gap-1 mb-1">
          <div className="flex-1 h-6 bg-bullish/80 rounded-l flex items-center justify-center text-[10px] font-bold text-background">
            {historicalEdge.upPct}%
          </div>
          <div className="flex-1 h-6 bg-bearish/80 rounded-r flex items-center justify-center text-[10px] font-bold text-background">
            {historicalEdge.downPct}%
          </div>
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>all bias: {Math.round(buyVolumeRatio60s * 100)}%</span>
          <span>avg bias: {Math.round(confidence)}%</span>
        </div>
      </div>

      {/* Composite Signal */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1 mb-2">
          <div className={`w-2 h-2 rounded-full ${compositeSignal.type === 'warning' ? 'bg-warning' : compositeSignal.type === 'entry' ? 'bg-bullish' : 'bg-muted'}`} />
          <span className="text-[10px] text-muted-foreground uppercase">Composite Signal</span>
        </div>

        <div className={`p-3 rounded border ${
          compositeSignal.type === 'warning'
            ? 'border-warning/50 bg-warning/5'
            : compositeSignal.type === 'entry'
            ? 'border-bullish/50 bg-bullish/5'
            : 'border-border/30 bg-muted/5'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {compositeSignal.type === 'warning' && <AlertTriangle className="w-4 h-4 text-warning" />}
            <span className={`text-sm font-bold ${
              compositeSignal.type === 'warning' ? 'text-warning' : 'text-bullish'
            }`}>
              {compositeSignal.title}
            </span>
          </div>
          <div className="text-[9px] text-muted-foreground mb-2">
            {compositeSignal.subtitle} - ST 0i - VOL - {minutes}:{seconds.toString().padStart(2, '0')} rem
          </div>
          <div className="flex items-center gap-1 mb-2 text-[9px]">
            <span className="text-muted-foreground">2f</span>
            {compositeSignal.tags.map((tag, i) => (
              <span key={tag} className={`px-1.5 py-0.5 rounded border ${
                i < 2 ? 'border-bullish/50 text-bullish' : 'border-border/30 text-muted-foreground'
              }`}>
                {tag} {i < 2 && <span className="text-bullish">A</span>}
              </span>
            ))}
          </div>
          <div className={`text-[10px] ${compositeSignal.type === 'warning' ? 'text-bearish' : 'text-muted-foreground'}`}>
            {compositeSignal.message}
          </div>
        </div>
      </div>

      {/* Entry Window */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1 mb-2">
          <div className="w-2 h-2 rounded-full bg-muted" />
          <span className="text-[10px] text-muted-foreground uppercase">Entry Window</span>
        </div>

        <div className={`p-2 rounded border mb-3 ${
          remaining > 60 ? 'border-bullish/50 bg-bullish/10' : 'border-warning/50 bg-warning/10'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
              remaining > 60 ? 'border-bullish bg-bullish' : 'border-warning bg-warning'
            }`}>
              <Check className="w-3 h-3 text-background" />
            </div>
            <span className={`text-sm font-semibold ${remaining > 60 ? 'text-bullish' : 'text-warning'}`}>
              ENTRY WINDOW {remaining > 60 ? 'OPEN' : 'CLOSING'}
            </span>
          </div>
        </div>

        <div className="text-center">
          <div className={`text-5xl font-bold tabular-nums ${remaining < 60 ? 'text-warning' : 'text-foreground'}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <div className="text-[9px] text-muted-foreground mt-1">15M REMAINING</div>
          <div className="flex justify-center gap-4 mt-2 text-[9px]">
            <span className="text-muted-foreground">15:PM</span>
            <span className="text-info">^ 2-Min ^</span>
          </div>
        </div>
      </div>

      {/* Calculator */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1 mb-3">
          <div className="w-2 h-2 rounded-full bg-muted" />
          <span className="text-[10px] text-muted-foreground uppercase">Calculator</span>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSelectedSide('YES')}
            className={`flex-1 py-2 rounded font-semibold transition-colors ${
              selectedSide === 'YES'
                ? 'bg-bullish text-background'
                : 'bg-muted/20 text-muted-foreground hover:bg-muted/30'
            }`}
          >
            A YES
          </button>
          <button
            onClick={() => setSelectedSide('NO')}
            className={`flex-1 py-2 rounded font-semibold transition-colors ${
              selectedSide === 'NO'
                ? 'bg-bearish text-background'
                : 'bg-muted/20 text-muted-foreground hover:bg-muted/30'
            }`}
          >
            v NO
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Risk $</span>
            <div className="flex items-center gap-1">
              <span className="text-foreground">$</span>
              <input
                type="number"
                value={riskAmount}
                onChange={(e) => setRiskAmount(Number(e.target.value) || 0)}
                className="w-16 bg-muted/20 border border-border/30 rounded px-2 py-1 text-right text-foreground focus:outline-none focus:border-info/50"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Shares</span>
            <span className={`font-bold ${selectedSide === 'YES' ? 'text-bullish' : 'text-bearish'}`}>
              {shares.toFixed(1)} {selectedSide}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function IndicatorTag({ label, active, check }: { label: string; active: boolean | null; check?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] ${
      active ? 'border-bullish/50 bg-bullish/10 text-bullish' : 'border-border/30 text-muted-foreground'
    }`}>
      {label}
      {active !== null && (
        active
          ? (check ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5 text-bearish" />)
          : <X className="w-2.5 h-2.5 text-bearish" />
      )}
    </span>
  )
}
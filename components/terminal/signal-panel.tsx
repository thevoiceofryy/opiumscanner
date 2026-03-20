'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { AlertTriangle, Check, ChevronRight, TrendingUp, TrendingDown, Activity, Zap, BookOpen, RotateCcw } from 'lucide-react'
import { useConvergence } from '@/hooks/use-convergence'
import { useOrderFlow } from '@/hooks/use-order-flow'
import type { CryptoData } from '@/lib/types'
import type { BookDepthData } from '@/hooks/use-convergence'

interface SignalPanelProps {
  cryptoData: CryptoData | null
  marketPrices: { yes: number | null; no: number | null }
  selectedMarket: string | null
  priceToBeat: number
  btcPrice: number
  clobAskYes?: number | null
  clobAskNo?: number | null
  bookDepth?: BookDepthData
  lastResult?: 'UP' | 'DOWN' | 'UNKNOWN'
  upRounds?: number
  downRounds?: number
  correctRounds?: number
  wrongRounds?: number
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
  bookDepth,
  correctRounds = 0,
  wrongRounds = 0,
  upRounds = 0,
  downRounds = 0,
}: SignalPanelProps) {
  const [remaining, setRemaining] = useState<number>(0)
  const [riskAmount, setRiskAmount] = useState<number>(50)
  const [bankroll, setBankroll] = useState<number>(500)
  const [selectedSide, setSelectedSide] = useState<'YES' | 'NO'>('YES')
  const [collapsed, setCollapsed] = useState(false)
  const [useKelly, setUseKelly] = useState(true)
const lastLoggedSignalRef = useRef<string | null>(null)
const lastSentRef = useRef<number>(0)
const lastSignalRef = useRef<string | null>(null)

  const confidence = marketPrices?.yes !== null ? Math.round(marketPrices.yes ?? 0) : 50
  const indicators = cryptoData?.indicators ?? null

  const {
    score: convergenceScore,
    status: convergenceStatus,
    direction,
    trueProb,
    volatilityRegime,
    driftBps,
    confidence: modelConfidence,
    kellyFraction,
    kellySuggestedBet,
    bookPressure,
    meanReversionActive,
    meanReversionDir,
  } = useConvergence(indicators, remaining, confidence, btcPrice, priceToBeat, bookDepth, bankroll)

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

  useEffect(() => {
    if (direction === 'UP') setSelectedSide('YES')
    else if (direction === 'DOWN') setSelectedSide('NO')
  }, [direction])

  useEffect(() => {
    if (useKelly && kellySuggestedBet > 0) {
      setRiskAmount(Math.round(kellySuggestedBet))
    }
  }, [useKelly, kellySuggestedBet])

  const ev = useMemo(() => {
    const yesAsk = clobAskYes ?? (confidence / 100)
    const noAsk = clobAskNo ?? (1 - (clobAskYes ?? confidence / 100))

    const yesEV = calcEV(trueProb, yesAsk)
    const noEV = calcEV(1 - trueProb, noAsk)

    const yesEdge = yesAsk > 0 ? (yesEV / yesAsk) * 100 : 0
    const noEdge = noAsk > 0 ? (noEV / noAsk) * 100 : 0

    let bestSide: 'YES' | 'NO' | null = null
    if (yesEV > noEV && yesEV > 0.02) bestSide = 'YES'
    else if (noEV > yesEV && noEV > 0.02) bestSide = 'NO'

    const hasEdge = (bestSide === 'YES' && yesEdge > 3) ||
                    (bestSide === 'NO' && noEdge > 3)

    return { trueProb, yesEV, noEV, bestSide, yesAsk, noAsk, yesEdge, noEdge, hasEdge }
  }, [trueProb, clobAskYes, clobAskNo, confidence])

const logPrediction = useCallback(async () => {
  const currentBucket = Math.floor(Date.now() / 1000 / 900) * 900
  if (direction === 'NEUTRAL') return

  const signalKey = `${currentBucket}-${direction}-${Math.round(trueProb * 100)}`

  // ✅ prevent duplicate signals
  if (lastSignalRef.current === signalKey) return
  lastSignalRef.current = signalKey

  // ✅ cooldown (30 sec)
  const now = Date.now()
  if (now - lastSentRef.current < 30000) return
  lastSentRef.current = now

  try {
    await fetch('/api/polymarket/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: currentBucket, predicted: direction }),
    })
  } catch {}

  try {
    const edge = direction === 'UP' ? ev.yesEdge : ev.noEdge
    const prob = direction === 'UP'
      ? Math.round(trueProb * 100)
      : Math.round((1 - trueProb) * 100)

    const ask = direction === 'UP'
      ? Math.round((ev.yesAsk || 0) * 100)
      : Math.round((ev.noAsk || 0) * 100)

    const timeMin = Math.floor(remaining / 60)
    const timeSec = remaining % 60

    const message =
      direction === 'UP'
        ? `🟢 <b>SIGNAL: YES (UP)</b>\nModel: ${prob}% | Market: ${ask}¢ | Edge: +${edge.toFixed(0)}%\nConfidence: ${modelConfidence}% | Time left: ${timeMin}:${String(timeSec).padStart(2, '0')}`
        : `🔴 <b>SIGNAL: NO (DOWN)</b>\nModel: ${prob}% | Market: ${ask}¢ | Edge: +${edge.toFixed(0)}%\nConfidence: ${modelConfidence}% | Time left: ${timeMin}:${String(timeSec).padStart(2, '0')}`

    await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
  } catch {}
}, [direction, ev, trueProb, modelConfidence, remaining])

useEffect(() => {
  if (
    direction !== 'NEUTRAL' &&
    modelConfidence >= 50 &&   // ⬆️ stronger filter
    ev.hasEdge &&
    remaining > 60
  ) {
    logPrediction()
  }
}, [direction, modelConfidence, ev.hasEdge, remaining])

  const compositeSignal = useMemo(() => {
    const distFromTarget = btcPrice && priceToBeat ? btcPrice - priceToBeat : 0
    const distStr = distFromTarget >= 0 ? `+$${distFromTarget.toFixed(0)}` : `-$${Math.abs(distFromTarget).toFixed(0)}`

    const sideProbPct = ev.bestSide === 'NO'
      ? Math.round((1 - trueProb) * 100)
      : Math.round(trueProb * 100)

    if (modelConfidence < 25) {
      return {
        type: 'wait' as const,
        side: null as 'YES' | 'NO' | null,
        title: 'BUILDING MODEL',
        subtitle: 'COLLECTING DATA',
        message: `Gathering price data. Confidence: ${modelConfidence}%`,
      }
    }

    if (meanReversionActive && meanReversionDir) {
      const revertSide = meanReversionDir === 'UP' ? 'YES' : 'NO'
      const edge = revertSide === 'YES' ? ev.yesEdge : ev.noEdge
      const revertProbPct = revertSide === 'YES'
        ? Math.round(trueProb * 100)
        : Math.round((1 - trueProb) * 100)
      if (edge > 3) {
        return {
          type: 'entry' as const,
          side: revertSide as 'YES' | 'NO',
          title: `REVERSION ${revertSide} — ${revertProbPct}% ${meanReversionDir}`,
          subtitle: `SNAP-BACK +${edge.toFixed(0)}% EDGE`,
          message: `Sharp move detected — reversal likely. ${distStr} from target. Model: ${revertProbPct}% ${meanReversionDir}.`,
        }
      }
    }

    if (!ev.hasEdge) {
      return {
        type: 'wait' as const,
        side: null as 'YES' | 'NO' | null,
        title: `${direction} ${Math.round(trueProb * 100)}% YES — NO EDGE`,
        subtitle: volatilityRegime === 'HIGH' ? 'HIGH VOL' : 'FAIR PRICE',
        message: `Model says ${Math.round(trueProb * 100)}% YES but market is fairly priced. ${distStr} from target.`,
      }
    }

    if (ev.bestSide && ev.hasEdge && modelConfidence >= 40) {
      const edge = ev.bestSide === 'YES' ? ev.yesEdge : ev.noEdge
      return {
        type: 'entry' as const,
        side: ev.bestSide,
        title: `${ev.bestSide} — ${sideProbPct}% ${direction}`,
        subtitle: `+${edge.toFixed(0)}% EDGE`,
        message: `Model: ${sideProbPct}% ${direction}. Market: ${Math.round((ev.bestSide === 'YES' ? ev.yesAsk : ev.noAsk) * 100)}¢. Edge: +${edge.toFixed(1)}%. ${distStr} from target.`,
      }
    }

    return {
      type: 'warning' as const,
      side: null as 'YES' | 'NO' | null,
      title: `WEAK ${direction} ${Math.round(trueProb * 100)}% YES`,
      subtitle: 'LOW CONFIDENCE',
      message: `Signal detected but confidence ${modelConfidence}%. ${distStr} from target. Vol: ${volatilityRegime}.`,
    }
  }, [direction, trueProb, ev, modelConfidence, volatilityRegime, btcPrice, priceToBeat, meanReversionActive, meanReversionDir])

  const accuracy = useMemo(() => {
    const total = correctRounds + wrongRounds
    if (total === 0) return { rate: 0, total: 0, label: 'NO DATA' }
    const rate = Math.round((correctRounds / total) * 100)
    return { rate, total, label: `${rate}% (${correctRounds}/${total})` }
  }, [correctRounds, wrongRounds])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  const effectiveRisk = useKelly && kellySuggestedBet > 0 ? kellySuggestedBet : riskAmount
  const shares = selectedSide === 'YES'
    ? effectiveRisk / (ev.yesAsk || 1)
    : effectiveRisk / (ev.noAsk || 1)

  const signalBorderBg = compositeSignal.type === 'entry'
    ? compositeSignal.side === 'NO'
      ? 'border-bearish/50 bg-bearish/5'
      : 'border-bullish/50 bg-bullish/5'
    : compositeSignal.type === 'warning'
      ? 'border-warning/50 bg-warning/5'
      : 'border-border/30 bg-muted/5'

  const signalTitleColor = compositeSignal.type === 'entry'
    ? compositeSignal.side === 'NO' ? 'text-bearish' : 'text-bullish'
    : compositeSignal.type === 'warning' ? 'text-warning' : 'text-foreground'

  if (collapsed) {
    return (
      <div className="flex flex-col bg-card/50 backdrop-blur-sm">
        <button onClick={() => setCollapsed(false)} className="flex items-center justify-center p-2 hover:bg-muted/20 transition-colors">
          <ChevronRight className="w-5 h-5 text-info" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-card/50 backdrop-blur-sm text-xs font-mono overflow-y-auto">
      {/* Collapse */}
      <div className="flex justify-end p-1">
        <button onClick={() => setCollapsed(true)} className="p-1 hover:bg-muted/20 rounded transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180" />
        </button>
      </div>

      {/* ═══ WIN / LOSS ═══ */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-muted/5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Record</span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-bullish">{correctRounds}W</span>
          <span className="text-[10px] text-muted-foreground">/</span>
          <span className="text-[11px] font-bold text-bearish">{wrongRounds}L</span>
          {correctRounds + wrongRounds > 0 && (
            <span className={`text-[10px] font-semibold ${
              Math.round(correctRounds / (correctRounds + wrongRounds) * 100) >= 55 ? 'text-bullish' : 'text-bearish'
            }`}>
              {Math.round(correctRounds / (correctRounds + wrongRounds) * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* ═══ PROBABILITY MODEL ═══ */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            compositeSignal.type === 'entry' ? (compositeSignal.side === 'NO' ? 'bg-bearish' : 'bg-bullish') :
            compositeSignal.type === 'warning' ? 'bg-warning' : 'bg-muted'
          }`} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Probability Model</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
            volatilityRegime === 'HIGH' ? 'bg-warning/20 text-warning' :
            volatilityRegime === 'LOW' ? 'bg-bullish/20 text-bullish' :
            'bg-muted/20 text-muted-foreground'
          }`}>
            {volatilityRegime} VOL
          </span>
          {meanReversionActive && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-info/20 text-info flex items-center gap-0.5">
              <RotateCcw className="w-2.5 h-2.5" /> REVERT
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className={`p-2 rounded border ${ev.bestSide === 'YES' ? 'border-bullish/50 bg-bullish/5' : 'border-border/30 bg-muted/5'}`}>
            <div className="text-[9px] text-muted-foreground mb-1">YES = UP</div>
            <div className="flex items-baseline gap-1">
              <div className="text-2xl font-bold text-bullish">{Math.round(trueProb * 100)}%</div>
              <div className="text-[10px] text-muted-foreground">model</div>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">mkt {Math.round((ev.yesAsk || 0) * 100)}¢</span>
              <span className={`text-[10px] font-semibold ${ev.yesEV > 0 ? 'text-bullish' : 'text-bearish'}`}>
                {ev.yesEV > 0 ? '+' : ''}{ev.yesEdge.toFixed(0)}% edge
              </span>
            </div>
          </div>

          <div className={`p-2 rounded border ${ev.bestSide === 'NO' ? 'border-bearish/50 bg-bearish/5' : 'border-border/30 bg-muted/5'}`}>
            <div className="text-[9px] text-muted-foreground mb-1">NO = DOWN</div>
            <div className="flex items-baseline gap-1">
              <div className="text-2xl font-bold text-bearish">{Math.round((1 - trueProb) * 100)}%</div>
              <div className="text-[10px] text-muted-foreground">model</div>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">mkt {Math.round((ev.noAsk || 0) * 100)}¢</span>
              <span className={`text-[10px] font-semibold ${ev.noEV > 0 ? 'text-bullish' : 'text-bearish'}`}>
                {ev.noEV > 0 ? '+' : ''}{ev.noEdge.toFixed(0)}% edge
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SIGNAL ═══ */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1 mb-2">
          <Zap className="w-3 h-3 text-warning" />
          <span className="text-[10px] text-muted-foreground uppercase">Signal</span>
        </div>

        <div className={`p-3 rounded border ${signalBorderBg}`}>
          <div className="flex items-center gap-2 mb-1">
            {compositeSignal.type === 'entry' ? (
              compositeSignal.side === 'NO'
                ? <TrendingDown className="w-4 h-4 text-bearish" />
                : <TrendingUp className="w-4 h-4 text-bullish" />
            ) : compositeSignal.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-warning" />
            ) : null}
            <span className={`text-sm font-bold ${signalTitleColor}`}>
              {compositeSignal.title}
            </span>
          </div>
          <div className="text-[9px] text-muted-foreground mb-1">{compositeSignal.subtitle}</div>
          <div className="text-[10px] text-muted-foreground">{compositeSignal.message}</div>
        </div>
      </div>

      {/* ═══ MODEL INPUTS ═══ */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1 mb-2">
          <Activity className="w-3 h-3 text-info" />
          <span className="text-[10px] text-muted-foreground uppercase">Model Inputs</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">PRICE vs TARGET</span>
            <span className={`text-[10px] font-semibold ${
              btcPrice > priceToBeat ? 'text-bullish' : btcPrice < priceToBeat ? 'text-bearish' : 'text-muted-foreground'
            }`}>
              {priceToBeat > 0 ? `${btcPrice > priceToBeat ? '+' : ''}${(btcPrice - priceToBeat).toFixed(0)} (${((btcPrice - priceToBeat) / priceToBeat * 100).toFixed(2)}%)` : '--'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">VOLATILITY</span>
            <span className={`text-[10px] ${
              volatilityRegime === 'HIGH' ? 'text-warning' : volatilityRegime === 'LOW' ? 'text-bullish' : 'text-foreground'
            }`}>{volatilityRegime}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">ORDER FLOW (60s)</span>
            <span className={`text-[10px] ${
              buyVolumeRatio60s >= 0.55 ? 'text-bullish' : buyVolumeRatio60s <= 0.45 ? 'text-bearish' : 'text-muted-foreground'
            }`}>{Math.round(buyVolumeRatio60s * 100)}% buy</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">PUSH</span>
            <span className={`text-[10px] ${
              (driftBps ?? 0) > 1 ? 'text-bullish' : (driftBps ?? 0) < -1 ? 'text-bearish' : 'text-muted-foreground'
            }`}>{(driftBps ?? 0) > 0 ? '+' : ''}{(driftBps ?? 0).toFixed(1)} bps</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">CONFIDENCE</span>
            <span className="text-[10px] text-foreground">{modelConfidence ?? 0}%</span>
          </div>
          <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${
              (modelConfidence ?? 0) >= 60 ? 'bg-bullish' : (modelConfidence ?? 0) >= 35 ? 'bg-warning' : 'bg-muted'
            }`} style={{ width: `${modelConfidence ?? 0}%` }} />
          </div>
        </div>
      </div>

      {/* ═══ ORDERBOOK DEPTH ═══ */}
      {bookDepth && (bookDepth.upBidDepth + bookDepth.upAskDepth) > 0 && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="flex items-center gap-1 mb-2">
            <BookOpen className="w-3 h-3 text-info" />
            <span className="text-[10px] text-muted-foreground uppercase">Book Depth</span>
            <span className={`text-[9px] ml-auto px-1.5 py-0.5 rounded ${
              (bookPressure ?? 0) > 0.2 ? 'bg-bullish/20 text-bullish' :
              (bookPressure ?? 0) < -0.2 ? 'bg-bearish/20 text-bearish' :
              'bg-muted/20 text-muted-foreground'
            }`}>
              {(bookPressure ?? 0) > 0.2 ? 'BID HEAVY' : (bookPressure ?? 0) < -0.2 ? 'ASK HEAVY' : 'BALANCED'}
            </span>
          </div>

          <div className="flex gap-0.5 mb-2">
            <div className="flex-1 h-5 bg-bullish/20 rounded-l flex items-center justify-start pl-1">
              <span className="text-[9px] text-bullish font-semibold">{bookDepth.upBidDepth}</span>
            </div>
            <div className="flex-1 h-5 bg-bearish/20 rounded-r flex items-center justify-end pr-1">
              <span className="text-[9px] text-bearish font-semibold">{bookDepth.upAskDepth}</span>
            </div>
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Bid depth</span>
            <span>Spread: {bookDepth.upSpread !== null ? `${(bookDepth.upSpread * 100).toFixed(1)}¢` : '--'}</span>
            <span>Ask depth</span>
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
            <span>Tight bid: {bookDepth.upBidDepth5}</span>
            <span>Tight ask: {bookDepth.upAskDepth5}</span>
          </div>
        </div>
      )}

      {/* ═══ MEAN REVERSION ═══ */}
      {meanReversionActive && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="flex items-center gap-1 mb-1">
            <RotateCcw className="w-3 h-3 text-info" />
            <span className="text-[10px] text-muted-foreground uppercase">Mean Reversion</span>
          </div>
          <div className="p-2 rounded border border-info/50 bg-info/5">
            <span className="text-[10px] text-info">
              Sharp move detected — expecting snap-back {meanReversionDir}.
              Price likely to revert toward target.
            </span>
          </div>
        </div>
      )}

      {/* ═══ ENTRY WINDOW ═══ */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className={`p-2 rounded border mb-2 ${
          remaining > 120 ? 'border-bullish/50 bg-bullish/10' :
          remaining > 30 ? 'border-warning/50 bg-warning/10' :
          'border-bearish/50 bg-bearish/10'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
              remaining > 120 ? 'border-bullish bg-bullish' :
              remaining > 30 ? 'border-warning bg-warning' :
              'border-bearish bg-bearish'
            }`}>
              <Check className="w-3 h-3 text-background" />
            </div>
            <span className={`text-sm font-semibold ${
              remaining > 120 ? 'text-bullish' : remaining > 30 ? 'text-warning' : 'text-bearish'
            }`}>
              {remaining > 120 ? 'ENTRY OPEN' : remaining > 30 ? 'CLOSING' : 'ROUND ENDING'}
            </span>
          </div>
        </div>
        <div className="text-center">
          <div className={`text-5xl font-bold tabular-nums ${remaining < 60 ? 'text-warning' : 'text-foreground'}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <div className="text-[9px] text-muted-foreground mt-1">15M REMAINING</div>
        </div>
      </div>

      {/* ═══ POSITION SIZE ═══ */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-muted" />
            <span className="text-[10px] text-muted-foreground uppercase">Position Size</span>
          </div>
          <button
            onClick={() => setUseKelly(!useKelly)}
            className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
              useKelly ? 'border-info/50 bg-info/10 text-info' : 'border-border/30 text-muted-foreground'
            }`}
          >
            {useKelly ? 'AUTO' : 'MANUAL'}
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSelectedSide('YES')}
            className={`flex-1 py-2 rounded font-semibold transition-colors ${
              selectedSide === 'YES' ? 'bg-bullish text-background' : 'bg-muted/20 text-muted-foreground hover:bg-muted/30'
            }`}
          >▲ YES</button>
          <button
            onClick={() => setSelectedSide('NO')}
            className={`flex-1 py-2 rounded font-semibold transition-colors ${
              selectedSide === 'NO' ? 'bg-bearish text-background' : 'bg-muted/20 text-muted-foreground hover:bg-muted/30'
            }`}
          >▼ NO</button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">BANKROLL</span>
            <div className="flex items-center gap-1">
              <span className="text-foreground">$</span>
              <input type="number" value={bankroll}
                onChange={(e) => setBankroll(Number(e.target.value) || 0)}
                className="w-16 bg-muted/20 border border-border/30 rounded px-2 py-1 text-right text-foreground focus:outline-none focus:border-info/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{useKelly ? 'BEST BET' : 'Risk $'}</span>
            {useKelly ? (
              <span className={`font-bold ${kellySuggestedBet > 0 ? 'text-info' : 'text-muted-foreground'}`}>
                ${kellySuggestedBet > 0 ? kellySuggestedBet.toFixed(0) : '0'}
                <span className="text-[9px] text-muted-foreground ml-1">
                  ({(kellyFraction * 100).toFixed(1)}%)
                </span>
              </span>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-foreground">$</span>
                <input type="number" value={riskAmount}
                  onChange={(e) => setRiskAmount(Number(e.target.value) || 0)}
                  className="w-16 bg-muted/20 border border-border/30 rounded px-2 py-1 text-right text-foreground focus:outline-none focus:border-info/50"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">SHARES</span>
            <span className={`font-bold ${selectedSide === 'YES' ? 'text-bullish' : 'text-bearish'}`}>
              {shares.toFixed(1)} {selectedSide}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">PAYOUT</span>
            <span className="text-bullish font-bold">${shares.toFixed(0)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">EXPECTED VALUE</span>
            <span className={`font-bold ${
              (selectedSide === 'YES' ? ev.yesEV : ev.noEV) > 0 ? 'text-bullish' : 'text-bearish'
            }`}>
              ${((selectedSide === 'YES' ? ev.yesEV : ev.noEV) * effectiveRisk / (selectedSide === 'YES' ? ev.yesAsk || 1 : ev.noAsk || 1)).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
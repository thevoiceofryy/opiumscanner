'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Target, Zap, Calculator, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { useConvergence } from '@/hooks/use-convergence'
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

function calcEdge(trueProbability: number, askPrice: number): number {
  return (trueProbability - askPrice) * 100
}

export function SignalPanel({
  cryptoData,
  marketPrices,
  selectedMarket,
  clobAskYes = null,
  clobAskNo = null,
  correctRounds = 0,
  wrongRounds = 0,
  resultsLog = [],
}: SignalPanelProps) {
  const [remaining, setRemaining] = useState<number>(0)

  const confidence = marketPrices?.yes !== null ? Math.round(marketPrices.yes ?? 0) : 0
  const indicators = cryptoData?.indicators ?? null
  const { score: convergenceScore, status: convergenceStatus, direction } = useConvergence(
    indicators,
    remaining,
    confidence
  )

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
    // ── True probability calculation ─────────────────────────────────────────
    // convergenceScore 0-100 = how strong the signal is
    // Scale from 0.5 (no signal) toward 0.99 (max conviction)
    // UP:   score 0% → 0.50, score 50% → 0.745, score 100% → 0.99
    // DOWN: score 0% → 0.50, score 50% → 0.255, score 100% → 0.01
    let trueProb = 0.5
    if (direction === 'UP') {
      trueProb = 0.5 + (convergenceScore / 100) * 0.49
    } else if (direction === 'DOWN') {
      trueProb = 0.5 - (convergenceScore / 100) * 0.49
    }
    trueProb = Math.min(0.99, Math.max(0.01, trueProb))

    const yesAsk = clobAskYes
    const noAsk  = clobAskNo

    const yesEV   = yesAsk !== null ? calcEV(trueProb, yesAsk) : null
    const noEV    = noAsk  !== null ? calcEV(1 - trueProb, noAsk) : null
    const yesEdge = yesAsk !== null ? calcEdge(trueProb, yesAsk) : null
    const noEdge  = noAsk  !== null ? calcEdge(1 - trueProb, noAsk) : null

    const yesAskReal = yesAsk !== null && yesAsk > 0.05 && yesAsk < 0.95
    const noAskReal  = noAsk  !== null && noAsk  > 0.05 && noAsk  < 0.95
    const hasClobData = yesAskReal || noAskReal

    const marketProb = confidence / 100
    const isHighConvictionMarket = marketProb >= 0.85 || marketProb <= 0.15

    let bestSide: 'YES' | 'NO' | null = null
    let bestEVFinal: number | null = null

    if (isHighConvictionMarket) {
      if (marketProb >= 0.85 && trueProb >= 0.65) {
        bestSide = 'YES'
        bestEVFinal = yesAsk !== null ? calcEV(trueProb, yesAsk) : null
      } else if (marketProb <= 0.15 && trueProb <= 0.35) {
        bestSide = 'NO'
        bestEVFinal = noAsk !== null ? calcEV(1 - trueProb, noAsk) : null
      }
    } else if (hasClobData) {
      const yesEVReal = yesAskReal && yesEV !== null ? yesEV : null
      const noEVReal  = noAskReal  && noEV  !== null ? noEV  : null
      if (yesEVReal !== null && noEVReal !== null) {
        if (yesEVReal > noEVReal && yesEVReal > 0) { bestSide = 'YES'; bestEVFinal = yesEVReal }
        else if (noEVReal > yesEVReal && noEVReal > 0) { bestSide = 'NO'; bestEVFinal = noEVReal }
      } else if (yesEVReal !== null && yesEVReal > 0) { bestSide = 'YES'; bestEVFinal = yesEVReal }
      else if (noEVReal  !== null && noEVReal  > 0) { bestSide = 'NO'; bestEVFinal = noEVReal }
    }

    return {
      trueProb, yesEV, noEV, yesEdge, noEdge, bestSide,
      bestEV: bestEVFinal,
      hasClobData: hasClobData || isHighConvictionMarket,
      isHighConvictionMarket,
    }
  }, [convergenceScore, direction, clobAskYes, clobAskNo, confidence])

  const hasPositiveEV = ev.bestEV !== null && ev.bestEV > 0
  const isHighConviction = convergenceStatus === 'CONVERGENCE'
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const totalDecisions = correctRounds + wrongRounds
  const winRate = totalDecisions > 0 ? Math.round((correctRounds / totalDecisions) * 100) : null

  // Display asks: use CLOB when available, else approximate from market % so YES/NO always show something
  const marketYes = confidence / 100
  const marketNo = (100 - confidence) / 100
  const showAskYes = clobAskYes ?? (confidence > 0 ? marketYes : null)
  const showAskNo = clobAskNo ?? (confidence < 100 ? marketNo : null)
  const fromClobYes = clobAskYes != null
  const fromClobNo = clobAskNo != null

  return (
    <div className="flex flex-col h-full bg-card p-3 space-y-3 border-l border-border/50">
      {/* HEADER */}
      <div className="flex items-center gap-2">
        <Target className={`w-3 h-3 ${isHighConviction ? 'text-bullish animate-pulse' : 'text-muted-foreground'}`} />
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-red-500">VERSION 2.0 LIVE</h2>
      </div>

      <div className="text-xs font-mono font-bold text-primary leading-tight line-clamp-2">
        {selectedMarket || 'Scanning Live BTC Markets...'}
      </div>

      {/* CONFIDENCE DONUT */}
      <div className="relative flex flex-col items-center justify-center py-2">
        <div className={`relative transition-all duration-700 ${isHighConviction ? 'drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]' : ''}`}>
          <svg className="w-28 h-28 transform -rotate-90">
            <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-muted/10" />
            <circle
              cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent"
              strokeDasharray={314}
              strokeDashoffset={314 - (314 * confidence) / 100}
              strokeLinecap="round"
              className={`${confidence >= 50 ? 'text-bullish' : 'text-bearish'} transition-all duration-1000`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-mono font-bold tracking-tighter">{confidence}%</span>
            <span className="text-[8px] uppercase text-muted-foreground font-bold">Market</span>
          </div>
        </div>
      </div>

      {/* SIGNAL */}
      <div className="flex flex-col items-center gap-1 py-2 border-y border-border/30">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Signal:</span>
          <span className={`text-[11px] font-mono font-bold flex items-center gap-1 ${
            direction === 'UP' ? 'text-bullish' : direction === 'DOWN' ? 'text-bearish' : 'text-muted-foreground'
          }`}>
            {direction === 'UP' ? <TrendingUp className="w-3 h-3" /> : direction === 'DOWN' ? <TrendingDown className="w-3 h-3" /> : null}
            {direction} {convergenceScore}%
          </span>
          <span className={`text-[9px] px-1 py-0.5 rounded font-mono ${
            convergenceStatus === 'CONVERGENCE' ? 'bg-bullish/20 text-bullish'
            : convergenceStatus === 'STRENGTH' ? 'bg-warning/20 text-warning'
            : 'bg-muted/20 text-muted-foreground'
          }`}>
            {convergenceStatus}
          </span>
        </div>
        {convergenceStatus === 'CONVERGENCE' && <Zap className="w-3 h-3 text-bullish animate-bounce" />}
      </div>

      {/* BEST BET — clear card layout */}
      <div className={`rounded-lg border-2 p-3 space-y-3 ${
        hasPositiveEV ? 'border-bullish/50 bg-bullish/10' : 'border-border bg-muted/5'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Best bet</span>
          {!ev.hasClobData ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground font-medium animate-pulse">Updating…</span>
          ) : hasPositiveEV ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-bullish/30 text-bullish font-semibold">+EV</span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-bearish/20 text-bearish font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Skip
            </span>
          )}
        </div>

        {/* Always show a clear best-bet line */}
        <div className="text-[11px] font-semibold text-foreground">
          Best bet: {ev.bestSide && hasPositiveEV
            ? (ev.bestSide === 'YES' ? '▲ YES' : '▼ NO')
            : ev.hasClobData || ev.isHighConvictionMarket
              ? 'Skip this round'
              : `▲ ${direction === 'UP' ? 'YES' : direction === 'DOWN' ? 'NO' : '—'} (signal only)`}
        </div>
        <div className="text-[9px] text-muted-foreground">
          YES = BTC above target · NO = below · Skip = no edge this round
        </div>

        {ev.bestSide && hasPositiveEV ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className={`text-xl font-bold font-mono ${ev.bestSide === 'YES' ? 'text-bullish' : 'text-bearish'}`}>
                {ev.bestSide === 'YES' ? '▲ YES' : '▼ NO'}
              </span>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase">Edge per $1</div>
                <div className="text-base font-mono font-bold text-bullish">+{((ev.bestEV ?? 0) * 100).toFixed(1)}¢</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
              <div className="text-center p-1.5 rounded bg-muted/20">
                <div className="text-[9px] text-muted-foreground uppercase mb-0.5">YES</div>
                <div className={`text-sm font-mono font-bold ${(ev.yesEV ?? 0) > 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {ev.yesEV !== null ? `${ev.yesEV > 0 ? '+' : ''}${(ev.yesEV * 100).toFixed(1)}¢` : '—'}
                </div>
                <div className="text-[9px] text-muted-foreground">Ask {showAskYes != null ? `${fromClobYes ? '' : '~'}$${showAskYes.toFixed(2)}` : '—'}</div>
              </div>
              <div className="text-center p-1.5 rounded bg-muted/20">
                <div className="text-[9px] text-muted-foreground uppercase mb-0.5">NO</div>
                <div className={`text-sm font-mono font-bold ${(ev.noEV ?? 0) > 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {ev.noEV !== null ? `${ev.noEV > 0 ? '+' : ''}${(ev.noEV * 100).toFixed(1)}¢` : '—'}
                </div>
                <div className="text-[9px] text-muted-foreground">Ask {showAskNo != null ? `${fromClobNo ? '' : '~'}$${showAskNo.toFixed(2)}` : '—'}</div>
              </div>
            </div>
          </>
        ) : ev.hasClobData ? (
          <div className="space-y-2">
            <div className="text-center py-1">
              <div className="text-xs font-bold text-bearish">No edge — skip this round</div>
              <div className="text-[10px] text-muted-foreground mt-1">Signal {(ev.trueProb * 100).toFixed(0)}% {direction} · Market {confidence}%</div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
              <div className="text-center p-1.5 rounded bg-muted/20">
                <div className="text-[9px] text-muted-foreground uppercase mb-0.5">YES</div>
                <div className={`text-sm font-mono font-bold ${(ev.yesEV ?? 0) > 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {ev.yesEV !== null ? `${(ev.yesEV * 100).toFixed(1)}¢` : '—'}
                </div>
                <div className="text-[9px] text-muted-foreground">Ask {showAskYes != null ? `${fromClobYes ? '' : '~'}$${showAskYes.toFixed(2)}` : '—'}</div>
              </div>
              <div className="text-center p-1.5 rounded bg-muted/20">
                <div className="text-[9px] text-muted-foreground uppercase mb-0.5">NO</div>
                <div className={`text-sm font-mono font-bold ${(ev.noEV ?? 0) > 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {ev.noEV !== null ? `${(ev.noEV * 100).toFixed(1)}¢` : '—'}
                </div>
                <div className="text-[9px] text-muted-foreground">Ask {showAskNo != null ? `${fromClobNo ? '' : '~'}$${showAskNo.toFixed(2)}` : '—'}</div>
              </div>
            </div>
          </div>
        ) : ev.isHighConvictionMarket ? (
          <div className="space-y-2">
            <div className="text-center py-1">
              <div className="text-xs font-bold text-bearish">Skip — high conviction market</div>
              <div className="text-[10px] text-muted-foreground mt-1">Market {confidence}% · signal disagrees</div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
              <div className="text-center p-1.5 rounded bg-muted/20">
                <div className="text-[9px] text-muted-foreground uppercase mb-0.5">YES</div>
                <div className={`text-sm font-mono font-bold ${(ev.yesEV ?? 0) > 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {ev.yesEV !== null ? `${(ev.yesEV * 100).toFixed(1)}¢` : '—'}
                </div>
                <div className="text-[9px] text-muted-foreground">Ask {showAskYes != null ? `${fromClobYes ? '' : '~'}$${showAskYes.toFixed(2)}` : '—'}</div>
              </div>
              <div className="text-center p-1.5 rounded bg-muted/20">
                <div className="text-[9px] text-muted-foreground uppercase mb-0.5">NO</div>
                <div className={`text-sm font-mono font-bold ${(ev.noEV ?? 0) > 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {ev.noEV !== null ? `${(ev.noEV * 100).toFixed(1)}¢` : '—'}
                </div>
                <div className="text-[9px] text-muted-foreground">Ask {showAskNo != null ? `${fromClobNo ? '' : '~'}$${showAskNo.toFixed(2)}` : '—'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 py-1">
            <span className={`text-xl font-bold font-mono ${direction === 'UP' ? 'text-bullish' : direction === 'DOWN' ? 'text-bearish' : 'text-muted-foreground'}`}>
              {direction === 'UP' ? '▲ YES' : direction === 'DOWN' ? '▼ NO' : '—'}
            </span>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Signal only · orderbook updating…</div>
              <div className="text-[10px] font-mono text-muted-foreground">{(ev.trueProb * 100).toFixed(0)}% {direction} · market {confidence}%</div>
            </div>
          </div>
        )}
      </div>

      {/* CALCULATOR — Coming soon */}
      <div className="p-3 rounded-lg border border-border/40 bg-muted/10 flex flex-col items-center justify-center gap-2 min-h-[100px]">
        <Calculator className="w-6 h-6 text-muted-foreground/60" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Calculator</span>
        <span className="text-xs text-muted-foreground font-medium">Coming soon</span>
      </div>

      {/* WIN / LOSS LOG */}
      <div className="p-2 rounded border border-border/40 bg-muted/10 space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground">
          <span>Win / Loss Log</span>
          <span className="font-mono">
            {correctRounds}✓ / {wrongRounds}✗
            {winRate !== null && (
              <span className="ml-1 text-[9px] text-bullish">({winRate}%)</span>
            )}
          </span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {resultsLog.length === 0 ? (
            <span className="text-[10px] font-mono text-muted-foreground">Waiting for first closed round...</span>
          ) : (
            resultsLog.slice(0, 10).map((e) => (
              <span key={e.bucket}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                  e.correct === true ? 'bg-bullish/20 text-bullish'
                  : e.correct === false ? 'bg-bearish/20 text-bearish'
                  : 'bg-muted/30 text-muted-foreground'
                }`}
                title={`Bucket ${e.bucket} • Result ${e.result}${e.predicted ? ` • Pred ${e.predicted}` : ''}`}
              >
                {e.correct === true ? '✓' : e.correct === false ? '✗' : '•'}
              </span>
            ))
          )}
        </div>
      </div>

      {/* TIMER */}
      <div className={`mt-auto p-3 rounded border transition-colors ${remaining < 90 ? 'bg-warning/10 border-warning/30' : 'bg-bullish/5 border-bullish/20'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] font-bold font-mono ${remaining < 90 ? 'text-warning' : 'text-bullish'}`}>
            {remaining < 90 ? 'WINDOW CLOSING' : 'ENTRY WINDOW OPEN'}
          </span>
          <span className="text-xs font-mono font-bold">{minutes}:{seconds.toString().padStart(2, '0')}</span>
        </div>
        <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-1000 ${remaining < 90 ? 'bg-warning' : 'bg-bullish'}`}
            style={{ width: `${(remaining / (15 * 60)) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}
'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import type { Indicators } from '@/lib/types'
import { useOrderFlow } from './use-order-flow'

type ConvergenceStatus = 'WAIT' | 'STRENGTH' | 'CONVERGENCE'

export interface BookDepthData {
  upBidDepth: number
  upAskDepth: number
  upImbalance: number
  upSpread: number | null
  downBidDepth: number
  downAskDepth: number
  downImbalance: number
  downSpread: number | null
  upBidDepth5: number
  upAskDepth5: number
  downBidDepth5: number
  downAskDepth5: number
}

export interface UseConvergenceResult {
  score: number
  status: ConvergenceStatus
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  trueProb: number
  volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH'
  driftBps: number
  confidence: number
  kellyFraction: number
  kellySuggestedBet: number
  bookPressure: number
  meanReversionActive: boolean
  meanReversionDir: 'UP' | 'DOWN' | null
}

/**
 * PROBABILITY-FIRST CONVERGENCE ENGINE v2
 *
 * Upgrades over v1:
 * 1. Polymarket orderbook depth — detect thin books and liquidity imbalance
 * 2. Multi-timeframe volatility — 1m ticks + 5m windows + 15m ATR
 * 3. Mean reversion detector — catch snap-backs after sharp moves
 * 4. Kelly criterion — optimal bet sizing based on edge
 */
export function useConvergence(
  indicators: Indicators | null,
  entryWindowRemainingSeconds: number,
  yesProbability?: number | null,
  btcPrice?: number,
  priceToBeat?: number,
  bookDepth?: BookDepthData | null,
  bankroll?: number,
): UseConvergenceResult {
  const { buyVolumeRatio60s, buyVolumeRatio10s } = useOrderFlow()
  const priceHistoryRef = useRef<{ price: number; ts: number }[]>([])

  // Track price history for realized vol + mean reversion
  useEffect(() => {
    if (!btcPrice || btcPrice <= 0) return
    const now = Date.now()
    priceHistoryRef.current.push({ price: btcPrice, ts: now })
    // Keep last 20 minutes
    const cutoff = now - 20 * 60 * 1000
    priceHistoryRef.current = priceHistoryRef.current.filter(p => p.ts >= cutoff)
  }, [btcPrice])

  const result = useMemo(() => {
    const defaults = {
      rawProb: 0.5,
      direction: 'NEUTRAL' as const,
      volatilityRegime: 'NORMAL' as const,
      driftBps: 0,
      confidence: 0,
      kellyFraction: 0,
      kellySuggestedBet: 0,
      bookPressure: 0,
      meanReversionActive: false,
      meanReversionDir: null as 'UP' | 'DOWN' | null,
    }

    if (!btcPrice || !priceToBeat || btcPrice <= 0 || priceToBeat <= 0) {
      return defaults
    }

    const timeLeft = Math.max(entryWindowRemainingSeconds, 1)
    const totalRoundTime = 15 * 60
    const history = priceHistoryRef.current

    // ════════════════════════════════════════════════════════════════
    // UPGRADE 2: MULTI-TIMEFRAME VOLATILITY
    // Blend 1-min tick vol, 5-min window vol, and 15-min ATR
    // ════════════════════════════════════════════════════════════════
    let vol1m = 0
    let vol5m = 0
    let vol15m = 0

    const now = Date.now()

    // 1-minute tick volatility (most responsive)
    const ticks1m = history.filter(p => p.ts >= now - 60_000)
    if (ticks1m.length >= 5) {
      const returns1m: number[] = []
      for (let i = 1; i < ticks1m.length; i++) {
        const dt = ticks1m[i].ts - ticks1m[i - 1].ts
        if (dt > 0 && dt < 15000) {
          returns1m.push(Math.log(ticks1m[i].price / ticks1m[i - 1].price))
        }
      }
      if (returns1m.length >= 3) {
        const mean = returns1m.reduce((a, b) => a + b, 0) / returns1m.length
        const variance = returns1m.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns1m.length - 1)
        const avgInt = 60 / returns1m.length // average seconds between ticks
        vol1m = Math.sqrt(variance) / Math.sqrt(Math.max(avgInt, 0.5))
      }
    }

    // 5-minute window volatility (medium-term)
    const ticks5m = history.filter(p => p.ts >= now - 5 * 60_000)
    if (ticks5m.length >= 10) {
      const returns5m: number[] = []
      for (let i = 1; i < ticks5m.length; i++) {
        const dt = ticks5m[i].ts - ticks5m[i - 1].ts
        if (dt > 0 && dt < 15000) {
          returns5m.push(Math.log(ticks5m[i].price / ticks5m[i - 1].price))
        }
      }
      if (returns5m.length >= 5) {
        const mean = returns5m.reduce((a, b) => a + b, 0) / returns5m.length
        const variance = returns5m.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns5m.length - 1)
        const avgInt = (5 * 60) / returns5m.length
        vol5m = Math.sqrt(variance) / Math.sqrt(Math.max(avgInt, 0.5))
      }
    }

    // 15-min ATR-based volatility (most stable)
    if (indicators?.atr && indicators.atr > 0) {
      vol15m = (indicators.atr / btcPrice) / Math.sqrt(totalRoundTime)
    }

    // Blended volatility: weight recent vol higher when it spikes
    // If 1m vol is 2x the 15m vol, something is happening — trust the spike
    let realizedVolPerSecond = 0
    const volCount = [vol1m, vol5m, vol15m].filter(v => v > 0).length

    if (volCount === 0) {
      realizedVolPerSecond = 0.005 / Math.sqrt(totalRoundTime) // fallback
    } else if (vol1m > 0 && vol1m > vol15m * 1.5) {
      // Vol spike detected — weight 1m heavily
      realizedVolPerSecond = vol1m * 0.6 + (vol5m || vol15m || vol1m) * 0.3 + (vol15m || vol5m || vol1m) * 0.1
    } else {
      // Normal conditions — blend evenly
      const weights = { w1: vol1m > 0 ? 0.3 : 0, w5: vol5m > 0 ? 0.4 : 0, w15: vol15m > 0 ? 0.3 : 0 }
      const totalW = weights.w1 + weights.w5 + weights.w15
      if (totalW > 0) {
        realizedVolPerSecond = (vol1m * weights.w1 + vol5m * weights.w5 + vol15m * weights.w15) / totalW
      } else {
        realizedVolPerSecond = 0.005 / Math.sqrt(totalRoundTime)
      }
    }

    // Volatility regime
    const volAnnualized = realizedVolPerSecond * Math.sqrt(totalRoundTime)
    let volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL'
    if (volAnnualized < 0.002) volatilityRegime = 'LOW'
    else if (volAnnualized > 0.006) volatilityRegime = 'HIGH'

    // ════════════════════════════════════════════════════════════════
    // STEP 2: Price Distance → Z-Score
    // ════════════════════════════════════════════════════════════════
    const distancePct = (btcPrice - priceToBeat) / priceToBeat
    const remainingVol = realizedVolPerSecond * Math.sqrt(timeLeft)
    const effectiveVol = Math.max(remainingVol, 0.0001)
    const zScore = distancePct / effectiveVol

    // ════════════════════════════════════════════════════════════════
    // UPGRADE 3: MEAN REVERSION DETECTOR
    // If price moved sharply in the last 2-5 minutes, it often snaps back
    // ════════════════════════════════════════════════════════════════
    let meanReversionActive = false
    let meanReversionDir: 'UP' | 'DOWN' | null = null
    let meanReversionAdj = 0

    const ticks2m = history.filter(p => p.ts >= now - 2 * 60_000)
    const ticks5mFull = history.filter(p => p.ts >= now - 5 * 60_000)

    if (ticks2m.length >= 5 && ticks5mFull.length >= 10) {
      const price2mAgo = ticks2m[0].price
      const price5mAgo = ticks5mFull[0].price
      const move2m = (btcPrice - price2mAgo) / price2mAgo
      const move5m = (btcPrice - price5mAgo) / price5mAgo

      // Sharp move = more than 1.5x the expected vol for that time period
      const expected2mVol = realizedVolPerSecond * Math.sqrt(120)
      const expected5mVol = realizedVolPerSecond * Math.sqrt(300)

      const isSharp2m = Math.abs(move2m) > expected2mVol * 1.5
      const isSharp5m = Math.abs(move5m) > expected5mVol * 1.5

      if (isSharp2m || isSharp5m) {
        const sharpMove = isSharp2m ? move2m : move5m
        meanReversionActive = true
        // If price spiked UP, mean reversion says it'll come DOWN (and vice versa)
        meanReversionDir = sharpMove > 0 ? 'DOWN' : 'UP'

        // Adjustment: pull probability toward 50% (against the sharp move)
        // Stronger for very sharp moves, weaker as time runs out (less time to revert)
        const timeRatio = timeLeft / totalRoundTime
        const sharpness = isSharp2m
          ? Math.abs(move2m) / expected2mVol
          : Math.abs(move5m) / expected5mVol
        // Max adjustment of ~8% probability
        meanReversionAdj = Math.min(0.08, (sharpness - 1.5) * 0.04) * timeRatio
        if (sharpMove > 0) meanReversionAdj = -meanReversionAdj // pull DOWN if spiked UP
      }
    }

    // ════════════════════════════════════════════════════════════════
    // UPGRADE 1: POLYMARKET ORDERBOOK DEPTH
    // Thin book on one side = price about to move toward thick side
    // ════════════════════════════════════════════════════════════════
    let bookPressure = 0 // -1 to +1: positive = bullish for UP token

    if (bookDepth) {
      // Tight liquidity imbalance (within 5 cents) — most actionable
      const tightTotal = (bookDepth.upBidDepth5 || 0) + (bookDepth.upAskDepth5 || 0)
      if (tightTotal > 0) {
        const tightImbalance = ((bookDepth.upBidDepth5 || 0) - (bookDepth.upAskDepth5 || 0)) / tightTotal
        bookPressure += tightImbalance * 0.6
      }

      // Full book imbalance — background signal
      bookPressure += (bookDepth.upImbalance || 0) * 0.3

      // Thin book detection: if total depth is very low, price is fragile
      const totalUpDepth = (bookDepth.upBidDepth || 0) + (bookDepth.upAskDepth || 0)
      if (totalUpDepth < 100) {
        // Very thin book — amplify the imbalance signal
        bookPressure *= 1.5
      }

      // Spread signal: wide spread = uncertain, narrow = stable
      // Wide spread on YES side with price below target = bearish
      if (bookDepth.upSpread !== null && bookDepth.upSpread > 0.08) {
        // Wide spread — reduce confidence, slight push toward NO
        bookPressure -= 0.1
      }

      bookPressure = Math.max(-1, Math.min(1, bookPressure))
    }

    // ════════════════════════════════════════════════════════════════
    // MICRO-DRIFT (order flow + VWAP + MACD + book pressure)
    // ════════════════════════════════════════════════════════════════
    let driftBps = 0

    // Order flow
    const flowImbalance = buyVolumeRatio60s - 0.5
    driftBps += flowImbalance * 8

    // Short-term surge
    const surgeBias = buyVolumeRatio10s - 0.5
    driftBps += surgeBias * 4

    // VWAP
    if (indicators?.vwapDeviation) {
      const vwapBias = Math.max(-1, Math.min(1, indicators.vwapDeviation / 2))
      driftBps += vwapBias * 3
    }

    // MACD
    if (indicators?.macdHistogram) {
      const macdDir = indicators.macdHistogram > 0 ? 1 : -1
      const macdStrength = Math.min(1, Math.abs(indicators.macdHistogram) / (btcPrice * 0.001))
      driftBps += macdDir * macdStrength * 2
    }

    // Book pressure → drift (NEW)
    driftBps += bookPressure * 5

    const driftPct = driftBps / 10000
    const driftAdjustment = driftPct * (timeLeft / totalRoundTime)

    // ════════════════════════════════════════════════════════════════
    // FINAL PROBABILITY: Normal CDF + mean reversion adjustment
    // ════════════════════════════════════════════════════════════════
    const adjustedZ = zScore + (driftAdjustment / effectiveVol)

    const normalCDF = (x: number): number => {
      const a1 = 0.254829592
      const a2 = -0.284496736
      const a3 = 1.421413741
      const a4 = -1.453152027
      const a5 = 1.061405429
      const p = 0.3275911
      const sign = x < 0 ? -1 : 1
      const absX = Math.abs(x)
      const t = 1.0 / (1.0 + p * absX)
      const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2)
      return 0.5 * (1.0 + sign * y)
    }

    let rawProb = normalCDF(adjustedZ)

    // Apply mean reversion adjustment
    rawProb = rawProb + meanReversionAdj
    rawProb = Math.max(0.05, Math.min(0.95, rawProb))

    // ════════════════════════════════════════════════════════════════
    // CONFIDENCE
    // ════════════════════════════════════════════════════════════════
    let confidence = 0

    const timeElapsedRatio = 1 - (timeLeft / totalRoundTime)
    confidence += timeElapsedRatio * 35

    const absZ = Math.abs(adjustedZ)
    confidence += Math.min(25, absZ * 12)

    if (volatilityRegime === 'LOW') confidence += 15
    else if (volatilityRegime === 'NORMAL') confidence += 8

    // More tick data = better vol estimate
    if (history.length >= 50) confidence += 10
    else if (history.length >= 20) confidence += 5

    // Book depth data available = better signal
    if (bookDepth && (bookDepth.upBidDepth + bookDepth.upAskDepth) > 0) confidence += 5

    // Mean reversion active = slight confidence penalty (uncertain)
    if (meanReversionActive) confidence -= 5

    // Multi-TF vol agreement boosts confidence
    if (vol1m > 0 && vol5m > 0 && vol15m > 0) {
      const volRatio = Math.max(vol1m, vol5m, vol15m) / Math.min(vol1m, vol5m, vol15m)
      if (volRatio < 2) confidence += 10 // vols agree
    }

    confidence = Math.max(0, Math.min(100, Math.round(confidence)))

    // ════════════════════════════════════════════════════════════════
    // UPGRADE 4: KELLY CRITERION
    // Optimal bet fraction: f* = (bp - q) / b
    // where b = net odds, p = win probability, q = 1-p
    // ════════════════════════════════════════════════════════════════
    const direction: 'UP' | 'DOWN' | 'NEUTRAL' = rawProb > 0.52 ? 'UP' : rawProb < 0.48 ? 'DOWN' : 'NEUTRAL'

    // Use half-Kelly for safety (full Kelly is too aggressive in practice)
    const halfKellyMultiplier = 0.5
    let kellyFraction = 0
    const effectiveBankroll = bankroll || 500 // default bankroll assumption

    // We need at least some confidence to bet
    if (confidence >= 30 && direction !== 'NEUTRAL') {
      // For YES side: pay yesAsk, win $1 if correct
      // b = (1 - askPrice) / askPrice = payout ratio
      // For simplicity, calculate for the best side
      const p = direction === 'UP' ? rawProb : (1 - rawProb)
      const q = 1 - p

      // Assume market ask price around the Polymarket probability
      const marketAsk = direction === 'UP'
        ? (yesProbability && yesProbability > 0 ? yesProbability / 100 : 0.5)
        : (yesProbability && yesProbability > 0 ? (100 - yesProbability) / 100 : 0.5)

      if (marketAsk > 0.01 && marketAsk < 0.99) {
        const b = (1 - marketAsk) / marketAsk // odds received
        const fullKelly = (b * p - q) / b

        if (fullKelly > 0) {
          kellyFraction = fullKelly * halfKellyMultiplier
          // Cap at 15% of bankroll (risk management)
          kellyFraction = Math.min(kellyFraction, 0.15)
        }
      }
    }

    const kellySuggestedBet = Math.round(kellyFraction * effectiveBankroll * 100) / 100

    return {
      rawProb,
      direction,
      volatilityRegime,
      driftBps: Math.round(driftBps * 10) / 10,
      confidence,
      kellyFraction,
      kellySuggestedBet,
      bookPressure: Math.round(bookPressure * 100) / 100,
      meanReversionActive,
      meanReversionDir,
    }
  }, [indicators, btcPrice, priceToBeat, entryWindowRemainingSeconds, buyVolumeRatio60s, buyVolumeRatio10s, bookDepth, yesProbability, bankroll])

  // Smooth probability
  const [smoothedProb, setSmoothedProb] = useState(0.5)
  useEffect(() => {
    setSmoothedProb(prev => prev + 0.2 * (result.rawProb - prev))
  }, [result.rawProb])

  const finalProb = Math.round(smoothedProb * 100) / 100
  const score = Math.round(Math.abs(finalProb - 0.5) * 200)

  let status: ConvergenceStatus = 'WAIT'
  if (score >= 60) status = 'CONVERGENCE'
  else if (score >= 35) status = 'STRENGTH'

  return {
    score,
    status,
    direction: result.direction,
    trueProb: finalProb,
    volatilityRegime: result.volatilityRegime,
    driftBps: result.driftBps,
    confidence: result.confidence,
    kellyFraction: result.kellyFraction,
    kellySuggestedBet: result.kellySuggestedBet,
    bookPressure: result.bookPressure,
    meanReversionActive: result.meanReversionActive,
    meanReversionDir: result.meanReversionDir,
  }
}
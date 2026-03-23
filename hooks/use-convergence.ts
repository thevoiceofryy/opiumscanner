'use client'

import { useEffect, useMemo, useRef } from 'react'
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

export function useConvergence(
  indicators: Indicators | null,
  entryWindowRemainingSeconds: number,
  yesProbability?: number | null,
  btcPrice?: number,
  priceToBeat?: number,
  bookDepth?: BookDepthData | null,
  bankroll?: number,
): UseConvergenceResult {
const { buyVolumeRatio60s, buyVolumeRatio10s, aggression, absorption } = useOrderFlow()
  const priceHistoryRef = useRef<{ price: number; ts: number }[]>([])

  // Track price history for realized vol + mean reversion
  useEffect(() => {
    if (!btcPrice || btcPrice <= 0) return
    const now = Date.now()
    priceHistoryRef.current.push({ price: btcPrice, ts: now })
    const cutoff = now - 20 * 60 * 1000
    priceHistoryRef.current = priceHistoryRef.current.filter(p => p.ts >= cutoff)
  }, [btcPrice])

  const result = useMemo(() => {
    const defaults = {
      rawProb: 0.5,
      direction: (yesProbability && yesProbability > 50 ? 'UP' : 'DOWN') as 'UP' | 'DOWN' | 'NEUTRAL',
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




    // ── MULTI-TIMEFRAME VOLATILITY ────────────────────────────────
    let vol1m = 0
    let vol5m = 0
    let vol15m = 0
    const now = Date.now()

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
        const avgInt = 60 / returns1m.length
        vol1m = Math.sqrt(variance) / Math.sqrt(Math.max(avgInt, 0.5))
      }
    }

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

    if (indicators?.atr && indicators.atr > 0) {
      vol15m = (indicators.atr / btcPrice) / Math.sqrt(totalRoundTime)
    }

    let realizedVolPerSecond = 0
    const volCount = [vol1m, vol5m, vol15m].filter(v => v > 0).length

    if (volCount === 0) {
      realizedVolPerSecond = 0.005 / Math.sqrt(totalRoundTime)
    } else if (vol1m > 0 && vol1m > vol15m * 1.5) {
      realizedVolPerSecond = vol1m * 0.6 + (vol5m || vol15m || vol1m) * 0.3 + (vol15m || vol5m || vol1m) * 0.1
    } else {
      const weights = { w1: vol1m > 0 ? 0.3 : 0, w5: vol5m > 0 ? 0.4 : 0, w15: vol15m > 0 ? 0.3 : 0 }
      const totalW = weights.w1 + weights.w5 + weights.w15
      if (totalW > 0) {
        realizedVolPerSecond = (vol1m * weights.w1 + vol5m * weights.w5 + vol15m * weights.w15) / totalW
      } else {
        realizedVolPerSecond = 0.005 / Math.sqrt(totalRoundTime)
      }
    }

    const volAnnualized = realizedVolPerSecond * Math.sqrt(totalRoundTime)
    let volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL'
    if (volAnnualized < 0.002) volatilityRegime = 'LOW'
    else if (volAnnualized > 0.006) volatilityRegime = 'HIGH'

    // ── Z-SCORE ───────────────────────────────────────────────────
    const distancePct = (btcPrice - priceToBeat) / priceToBeat
    const remainingVol = realizedVolPerSecond * Math.sqrt(timeLeft)
    const effectiveVol = Math.max(remainingVol, 0.0001)
    const zScore = distancePct / effectiveVol

    // ── MEAN REVERSION ────────────────────────────────────────────
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

      const expected2mVol = realizedVolPerSecond * Math.sqrt(120)
      const expected5mVol = realizedVolPerSecond * Math.sqrt(300)

      const isSharp2m = Math.abs(move2m) > expected2mVol * 1.5
      const isSharp5m = Math.abs(move5m) > expected5mVol * 1.5

      if (isSharp2m || isSharp5m) {
        const sharpMove = isSharp2m ? move2m : move5m
        meanReversionActive = true
        meanReversionDir = sharpMove > 0 ? 'DOWN' : 'UP'

        const timeRatio = timeLeft / totalRoundTime
        const sharpness = isSharp2m
          ? Math.abs(move2m) / expected2mVol
          : Math.abs(move5m) / expected5mVol
        meanReversionAdj = Math.min(0.08, (sharpness - 1.5) * 0.04) * timeRatio
        if (sharpMove > 0) meanReversionAdj = -meanReversionAdj
      }
    }

    // ── ORDERBOOK DEPTH ───────────────────────────────────────────
    let bookPressure = 0

    if (bookDepth) {
      const tightTotal = (bookDepth.upBidDepth5 || 0) + (bookDepth.upAskDepth5 || 0)
      if (tightTotal > 0) {
        const tightImbalance = ((bookDepth.upBidDepth5 || 0) - (bookDepth.upAskDepth5 || 0)) / tightTotal
        bookPressure += tightImbalance * 0.6
      }
      bookPressure += (bookDepth.upImbalance || 0) * 0.3
      const totalUpDepth = (bookDepth.upBidDepth || 0) + (bookDepth.upAskDepth || 0)
      if (totalUpDepth < 100) bookPressure *= 1.5
      if (bookDepth.upSpread !== null && bookDepth.upSpread > 0.08) bookPressure -= 0.1
      bookPressure = Math.max(-1, Math.min(1, bookPressure))
    }

    // ── MICRO-DRIFT ───────────────────────────────────────────────
    let driftBps = 0
driftBps += (buyVolumeRatio60s - 0.5) * 20
driftBps += (buyVolumeRatio10s - 0.5) * 12
driftBps += (aggression - 0.5) * 30

if (absorption > 0.3) {
  driftBps -= (aggression - 0.5) * 25
}

    if (indicators?.vwapDeviation) {
      const vwapBias = Math.max(-1, Math.min(1, indicators.vwapDeviation / 2))
      driftBps += vwapBias * 3
    }
    if (indicators?.macdHistogram) {
      const macdDir = indicators.macdHistogram > 0 ? 1 : -1
      const macdStrength = Math.min(1, Math.abs(indicators.macdHistogram) / (btcPrice * 0.001))
      driftBps += macdDir * macdStrength * 2
    }
    driftBps += bookPressure * 5

    const driftPct = driftBps / 10000
    const driftAdjustment = driftPct * (timeLeft / totalRoundTime)

    // ── FINAL PROBABILITY ─────────────────────────────────────────
    const adjustedZ = zScore + (driftAdjustment / effectiveVol)

let rawProb = 1 / (1 + Math.exp(-adjustedZ * 1.2))
meanReversionActive = false          // disable until re-enabled intentionally
meanReversionDir = null
rawProb = Math.max(0.05, Math.min(0.95, rawProb))

    // ── CONFIDENCE ────────────────────────────────────────────────
    let confidence = 0
    const timeElapsedRatio = 1 - (timeLeft / totalRoundTime)
    confidence += timeElapsedRatio * 35
    confidence += Math.min(25, Math.abs(adjustedZ) * 12)
    if (volatilityRegime === 'LOW') confidence += 15
    else if (volatilityRegime === 'NORMAL') confidence += 8
    if (history.length >= 50) confidence += 10
    else if (history.length >= 20) confidence += 5
    if (bookDepth && (bookDepth.upBidDepth + bookDepth.upAskDepth) > 0) confidence += 5
    if (vol1m > 0 && vol5m > 0 && vol15m > 0) {
      const volRatio = Math.max(vol1m, vol5m, vol15m) / Math.min(vol1m, vol5m, vol15m)
      if (volRatio < 2) confidence += 10
    }
    confidence = Math.max(0, Math.min(100, Math.round(confidence)))

    // ── KELLY CRITERION ───────────────────────────────────────────
    const direction: 'UP' | 'DOWN' | 'NEUTRAL' =
      rawProb > 0.50 ? 'UP' : rawProb < 0.50 ? 'DOWN' : 'NEUTRAL'

    let kellyFraction = 0
    const effectiveBankroll = bankroll || 500

    if (confidence >= 30 && direction !== 'NEUTRAL') {
      const p = direction === 'UP' ? rawProb : (1 - rawProb)
      const q = 1 - p
      const marketAsk = direction === 'UP'
        ? (yesProbability && yesProbability > 0 ? yesProbability / 100 : 0.5)
        : (yesProbability && yesProbability > 0 ? (100 - yesProbability) / 100 : 0.5)

      if (marketAsk > 0.01 && marketAsk < 0.99) {
        const b = (1 - marketAsk) / marketAsk
        const fullKelly = (b * p - q) / b
        if (fullKelly > 0) {
kellyFraction = Math.min(fullKelly * 0.25, 0.08)
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

  // ── REF-BASED SMOOTHING (no useState = no render lag) ─────────
  // Updates synchronously during render so direction is always current
  const smoothedProbRef = useRef(0.5)
  smoothedProbRef.current = smoothedProbRef.current + 0.4 * (result.rawProb - smoothedProbRef.current)

  const finalProb = Math.round(smoothedProbRef.current * 100) / 100
  const score = Math.round(Math.abs(finalProb - 0.5) * 200)

  let status: ConvergenceStatus = 'WAIT'
if (score >= 30) status = 'CONVERGENCE'
else if (score >= 15) status = 'STRENGTH'

  // Deadband prevents NEUTRAL trap at exactly 0.50
  const direction: 'UP' | 'DOWN' | 'NEUTRAL' =
    finalProb > 0.51 ? 'UP' :
    finalProb < 0.49 ? 'DOWN' :
    'NEUTRAL'

  return {
    score,
    status,
    direction,
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
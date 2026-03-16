'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Indicators } from '@/lib/types'
import { useOrderFlow } from './use-order-flow'

type ConvergenceStatus = 'WAIT' | 'STRENGTH' | 'CONVERGENCE'

interface UseConvergenceResult {
  score: number
  status: ConvergenceStatus
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
}

export function useConvergence(
  indicators: Indicators | null,
  entryWindowRemainingSeconds: number,
  yesProbability?: number | null
): UseConvergenceResult {
  const { buyVolumeRatio60s, buyVolumeRatio10s } = useOrderFlow()

  const { rawScore, direction } = useMemo((): { rawScore: number; direction: 'UP' | 'DOWN' | 'NEUTRAL' } => {
    if (!indicators) return { rawScore: 0, direction: 'NEUTRAL' }

    let upScore = 0
    let downScore = 0

    // ── RSI ──────────────────────────────────────────────────────────────────
    // For BTC UP/DOWN prediction: HIGH RSI = strong momentum = likely ABOVE target
    // LOW RSI = weak momentum = likely BELOW target
    const rsi = indicators.rsi
    if (rsi >= 70) upScore += 15      // Overbought = strong upward momentum = UP
    else if (rsi >= 60) upScore += 10 // Bullish momentum
    else if (rsi >= 50) upScore += 5  // Slightly bullish
    else if (rsi <= 30) downScore += 15 // Oversold = weak momentum = DOWN
    else if (rsi <= 40) downScore += 10 // Bearish momentum
    else downScore += 5               // Below 50 = slightly bearish

    // ── MACD ─────────────────────────────────────────────────────────────────
    if (indicators.macdHistogram > 0 && indicators.macd > indicators.macdSignal) upScore += 12
    else if (indicators.macdHistogram < 0 && indicators.macd < indicators.macdSignal) downScore += 12
    else if (indicators.macdHistogram > 0) upScore += 5
    else downScore += 5

    // ── StochRSI ─────────────────────────────────────────────────────────────
    // For BTC UP/DOWN: HIGH Stoch = strong momentum = likely ABOVE target
    const k = indicators.stochK
    const d = indicators.stochD
    if (k >= 80 && d >= 80) upScore += 12  // Strong bullish momentum = UP
    else if (k >= 60) upScore += 8
    else if (k <= 20 && d <= 20) downScore += 12 // Strong bearish momentum = DOWN
    else if (k <= 40) downScore += 8
    else if (k > d) upScore += 4  // K crossing above D = bullish
    else downScore += 4

    // ── Trend ─────────────────────────────────────────────────────────────────
    if (indicators.trend === 'UP') upScore += 10
    else if (indicators.trend === 'DOWN') downScore += 10

    // ── VWAP ─────────────────────────────────────────────────────────────────
    // Price ABOVE VWAP = bullish = likely to stay UP
    // Price BELOW VWAP = bearish = likely to stay DOWN
    const vd = indicators.vwapDeviation
    if (vd > 1.0) upScore += 12      // Far above VWAP = very bullish
    else if (vd > 0.3) upScore += 8  // Above VWAP = bullish
    else if (vd > 0) upScore += 4    // Slightly above
    else if (vd < -1.0) downScore += 12 // Far below VWAP = very bearish
    else if (vd < -0.3) downScore += 8
    else downScore += 4              // Slightly below

    // ── Order flow 60s (max ±20) ──────────────────────────────────────────────
    if (buyVolumeRatio60s >= 0.65) upScore += 20
    else if (buyVolumeRatio60s >= 0.58) upScore += 12
    else if (buyVolumeRatio60s >= 0.52) upScore += 6
    else if (buyVolumeRatio60s <= 0.35) downScore += 20
    else if (buyVolumeRatio60s <= 0.42) downScore += 12
    else if (buyVolumeRatio60s <= 0.48) downScore += 6

    // ── Order flow 10s (short-term surge, max ±10) ────────────────────────────
    if (buyVolumeRatio10s >= 0.7) upScore += 10
    else if (buyVolumeRatio10s <= 0.3) downScore += 10

    // ── Polymarket crowd ──────────────────────────────────────────────────────
    if (typeof yesProbability === 'number') {
      const edge = yesProbability - 50
      if (Math.abs(edge) >= 20) {
        if (edge > 0) upScore += 8
        else downScore += 8
      } else if (Math.abs(edge) >= 10) {
        if (edge > 0) upScore += 4
        else downScore += 4
      }
    }

    // ── Time sensitivity multiplier ───────────────────────────────────────────
    const t = entryWindowRemainingSeconds
    let multiplier = 1
    if (t <= 0) multiplier = 0
    else if (t <= 10 * 60 && t >= 4 * 60) multiplier = 1.25

    const leading = upScore >= downScore ? 'UP' : 'DOWN'
    const winScore = Math.max(upScore, downScore)
    const total = upScore + downScore || 1
    const rawScore = Math.max(0, Math.min(100, (winScore / total) * 100 * multiplier))

    return {
      rawScore,
      direction: upScore === downScore ? 'NEUTRAL' : leading,
    }
  }, [indicators, buyVolumeRatio60s, buyVolumeRatio10s, entryWindowRemainingSeconds, yesProbability])

  const [smoothedScore, setSmoothedScore] = useState(0)
  useEffect(() => {
    setSmoothedScore(prev => prev + 0.15 * (rawScore - prev))
  }, [rawScore])

  const finalScore = Math.round(smoothedScore)
  let status: ConvergenceStatus = 'WAIT'
  if (finalScore >= 75) status = 'CONVERGENCE'
  else if (finalScore >= 60) status = 'STRENGTH'

  return { score: finalScore, status, direction }
}

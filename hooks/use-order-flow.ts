'use client'

import { useEffect, useRef, useState } from 'react'
import { subscribeToTrades } from './use-btc-price'

type Side = 'BUY' | 'SELL'

interface OrderFlowTrade {
  id: number
  price: number
  size: number
  side: Side
  ts: number
}

interface OrderFlowStats {
  trades: OrderFlowTrade[]
  buyVolumeRatio60s: number
  buyVolumeRatio10s: number
  totalVolume60s: number
  largeTradeThreshold: number
  aggression: number
  absorption: number // 🔥 NEW
}

const MAX_TRADES = 500

export function useOrderFlow(): OrderFlowStats {
  const [trades, setTrades] = useState<OrderFlowTrade[]>([])
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const unsub = subscribeToTrades((trade) => {
      if (!mountedRef.current) return
      setTrades(prev => {
        const next = [trade, ...prev]
        return next.length > MAX_TRADES ? next.slice(0, MAX_TRADES) : next
      })
    })

    return () => {
      mountedRef.current = false
      unsub()
    }
  }, [])

  const now = Date.now()
  const cutoff60 = now - 60_000
  const cutoff10 = now - 10_000

  let buyVol60 = 0, totalVol60 = 0
  let buyVol10 = 0, totalVol10 = 0
  const sizes: number[] = []

  let aggressiveBuyVol = 0
  let aggressiveSellVol = 0
  let prevPrice: number | null = null

  let flatVolume = 0

  // ── PASS 1: collect sizes ──
  for (const t of trades) {
    if (t.ts >= cutoff60) {
      sizes.push(t.size)
    }
  }

  sizes.sort((a, b) => a - b)
  const largeTradeThreshold =
    sizes.length > 10
      ? sizes[Math.floor(sizes.length * 0.9)]
      : 0.5

  // ── PASS 2: compute volumes + aggression + absorption ──
  for (const t of trades) {
// NEW — fixed
if (t.ts >= cutoff60) {
  const weightedSize = t.size > largeTradeThreshold ? t.size * 1.5 : t.size
  totalVol60 += weightedSize

  if (t.side === 'BUY') buyVol60 += weightedSize

      // 🔥 AGGRESSION + ABSORPTION
      if (prevPrice !== null) {
        if (t.price > prevPrice) {
          aggressiveBuyVol += weightedSize
        } else if (t.price < prevPrice) {
          aggressiveSellVol += weightedSize
        } else {
          flatVolume += weightedSize
        }
      }

      prevPrice = t.price
    }

    if (t.ts >= cutoff10) {
      totalVol10 += t.size
      if (t.side === 'BUY') buyVol10 += t.size
    }
  }

  const aggression =
    aggressiveBuyVol + aggressiveSellVol > 0
      ? aggressiveBuyVol / (aggressiveBuyVol + aggressiveSellVol)
      : 0.5

  const absorption =
    totalVol60 > 0
      ? Math.min(1, flatVolume / totalVol60)
      : 0

  return {
    trades,
buyVolumeRatio60s: totalVol60 > 0 ? buyVol60 / totalVol60 : 0.5,
    buyVolumeRatio10s: totalVol10 > 0 ? Math.min(1, buyVol10 / totalVol10) : 0.5,
    totalVolume60s: totalVol60,
    largeTradeThreshold,
    aggression,
    absorption, // 🔥 IMPORTANT
  }
}
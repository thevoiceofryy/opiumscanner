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
}

const MAX_TRADES = 500

/**
 * Reads real trades from the shared Binance aggTrade WebSocket.
 * No second connection — piggybacks on useBTCPrice's stream.
 */
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

  // Compute stats
  const now = Date.now()
  const cutoff60 = now - 60_000
  const cutoff10 = now - 10_000

  let buyVol60 = 0, totalVol60 = 0
  let buyVol10 = 0, totalVol10 = 0
  const sizes: number[] = []

  for (const t of trades) {
    if (t.ts >= cutoff60) {
      totalVol60 += t.size
      if (t.side === 'BUY') buyVol60 += t.size
      sizes.push(t.size)
    }
    if (t.ts >= cutoff10) {
      totalVol10 += t.size
      if (t.side === 'BUY') buyVol10 += t.size
    }
  }

  sizes.sort((a, b) => a - b)
  const largeTradeThreshold = sizes.length > 10 ? sizes[Math.floor(sizes.length * 0.9)] : 0.5

  return {
    trades,
    buyVolumeRatio60s: totalVol60 > 0 ? Math.min(1, buyVol60 / totalVol60) : 0.5,
    buyVolumeRatio10s: totalVol10 > 0 ? Math.min(1, buyVol10 / totalVol10) : 0.5,
    totalVolume60s: totalVol60,
    largeTradeThreshold,
  }
}
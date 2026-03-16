'use client'

import { useEffect, useState, useRef } from 'react'

// Global ref for real-time BTC price - accessible outside React
export const globalBTCPriceRef = { current: 0 }

// Trade subscriber type
type TradeCallback = (trade: { id: number; price: number; size: number; side: 'BUY' | 'SELL'; ts: number }) => void
const tradeSubscribers = new Set<TradeCallback>()

export function subscribeToTrades(callback: TradeCallback): () => void {
  tradeSubscribers.add(callback)
  return () => tradeSubscribers.delete(callback)
}

function notifyTradeSubscribers(trade: { id: number; price: number; size: number; side: 'BUY' | 'SELL'; ts: number }) {
  tradeSubscribers.forEach(cb => cb(trade))
}

// Coinbase Advanced Trade WebSocket - no geo-block, no auth needed for market data
const COINBASE_WS = 'wss://advanced-trade-api.coinbase.com/ws/user'
const COINBASE_MARKET_WS = 'wss://advanced-trade-api.coinbase.com/ws/market'

let wsInstance: WebSocket | null = null
let wsConnecting = false
let tradeIdCounter = 0

function connectWebSocket() {
  if (wsInstance || wsConnecting) return
  // Skip WebSocket on localhost — REST fallback handles it
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') return
  wsConnecting = true

  try {
    // Coinbase public market data WebSocket - no auth required
    const ws = new WebSocket(COINBASE_MARKET_WS)

    ws.onopen = () => {
      wsConnecting = false
      wsInstance = ws
      console.log('[useBTCPrice] Coinbase WebSocket connected')

      // Subscribe to BTC-USD market trades
      ws.send(JSON.stringify({
        type: 'subscribe',
        product_ids: ['BTC-USD'],
        channel: 'market_trades',
      }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        // Coinbase sends { channel: 'market_trades', events: [{ trades: [...] }] }
        if (msg.channel === 'market_trades' && msg.events) {
          for (const event of msg.events) {
            if (event.trades) {
              for (const trade of event.trades) {
                const price = parseFloat(trade.price)
                const size = parseFloat(trade.size)
                const side = trade.side === 'BUY' ? 'BUY' : 'SELL'

                if (price > 0) {
                  globalBTCPriceRef.current = price

                  notifyTradeSubscribers({
                    id: ++tradeIdCounter,
                    price,
                    size,
                    side,
                    ts: Date.now(),
                  })
                }
              }
            }
          }
        }
      } catch {}
    }

    ws.onerror = () => {
      wsConnecting = false
      wsInstance = null
    }

    ws.onclose = () => {
      wsConnecting = false
      wsInstance = null
      setTimeout(connectWebSocket, 3000)
    }
  } catch {
    wsConnecting = false
  }
}

export function useBTCPrice() {
  const [price, setPrice] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    connectWebSocket()

    const updateFromGlobal = () => {
      if (globalBTCPriceRef.current > 0) {
        setPrice(globalBTCPriceRef.current)
      }
    }

    // Coinbase REST fallback
    const fetchFallback = async () => {
      try {
        const res = await fetch('/api/coinbase/spot')
        const json = await res.json()
        const value = parseFloat(json.data.amount)
        if (value > 0) {
          globalBTCPriceRef.current = value
          setPrice(value)
        }
      } catch {}
    }

    fetchFallback()
    updateFromGlobal()

    intervalRef.current = setInterval(() => {
      updateFromGlobal()
      fetchFallback() // always fetch, not just when 0
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return price
}
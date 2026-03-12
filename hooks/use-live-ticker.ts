'use client'

import { useEffect, useState } from 'react'

/**
 * Live Binance ticker via WebSocket.
 * Returns the latest traded price for the given symbol (e.g. BTCUSDT).
 */
export function useLiveTicker(symbol: string = 'BTCUSDT') {
  const [price, setPrice] = useState<number | null>(null)

  useEffect(() => {
    const sym = symbol.toLowerCase()
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@trade`)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const p = parseFloat(data.p)
        if (!Number.isNaN(p)) {
          setPrice(p)
        }
      } catch {
        // Ignore malformed messages
      }
    }

    return () => {
      ws.close()
    }
  }, [symbol])

  return price
}


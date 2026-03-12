'use client'

import { useEffect, useRef, useState } from 'react'

export function useBTCWebSocket(symbol: string = 'btcusdt') {

  const [price, setPrice] = useState<number | null>(null)

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {

    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${symbol}@miniTicker`
    )

    wsRef.current = ws

    ws.onmessage = (event) => {

      const data = JSON.parse(event.data)

      if (data?.c) {
        setPrice(parseFloat(data.c))
      }

    }

    ws.onclose = () => {

      setTimeout(() => {
        wsRef.current = new WebSocket(
          `wss://stream.binance.com:9443/ws/${symbol}@miniTicker`
        )
      }, 2000)

    }

    ws.onerror = () => ws.close()

    return () => ws.close()

  }, [symbol])

  return price
}
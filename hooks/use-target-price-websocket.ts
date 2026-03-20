'use client'

import { useEffect, useRef, useState } from 'react'

const POLYMARKET_WS = 'wss://ws-live-data.polymarket.com'

export function useTargetPriceWebSocket() {
  const [chainlinkLive, setChainlinkLive] = useState<number | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let isMounted = true

    function connect() {
      if (!isMounted) return
      if (wsRef.current) {
        try { wsRef.current.close() } catch {}
      }

      try {
        const ws = new WebSocket(POLYMARKET_WS)
        wsRef.current = ws

        ws.onopen = () => {
          if (!isMounted) return
          console.log('[Chainlink WS] Connected to Polymarket RTDS')
          ws.send(JSON.stringify({
            action: 'subscribe',
            subscriptions: [
              {
                topic: 'crypto_prices_chainlink',
                type: '*',
                filters: '{"symbol":"btc/usd"}',
              }
            ]
          }))
        }

        ws.onmessage = (event) => {
          if (!isMounted) return
          try {
            const msg = JSON.parse(event.data)
            if (msg.topic === 'crypto_prices_chainlink' && msg.payload) {
              const price = msg.payload.value
              if (typeof price !== 'number' || price <= 0) return
              setChainlinkLive(price)
            }
          } catch {}
        }

        ws.onerror = () => {
          console.warn('[Chainlink WS] Error, will reconnect')
        }

        ws.onclose = () => {
          wsRef.current = null
          if (isMounted) {
            reconnectRef.current = setTimeout(connect, 3000)
          }
        }
      } catch {
        if (isMounted) {
          reconnectRef.current = setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      isMounted = false
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        try { wsRef.current.close() } catch {}
      }
    }
  }, [])

  return { chainlinkLive }
}
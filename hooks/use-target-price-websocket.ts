'use client'

import { useEffect, useRef, useState } from 'react'

// Coinbase REST candles API - no WebSocket needed, no geo-block
// Docs: https://docs.cdp.coinbase.com/advanced-trade/reference/retailbrokerageapi_getpubliccandles

export function useTargetPriceWebSocket(symbol: string = 'btcusdt') {
  const [priceToBeat, setPriceToBeat] = useState<number | null>(null)
  const [bucket, setBucket] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastBucketRef = useRef<number | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchCandles() {
      try {
        const res = await fetch("/api/coinbase/candles")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
    
        const candles = json.candles
        if (!candles || candles.length < 2) return
    
        // candles[0] = current open candle, candles[1] = last completed
        const lastCompleted = candles[1]
        const closePrice = parseFloat(lastCompleted.close)
        
        // start is already in seconds — this IS the bucket key Polymarket uses
        const bucketSeconds = parseInt(lastCompleted.start)
    
        console.log('[Coinbase] raw start:', lastCompleted.start, 'bucket:', bucketSeconds)
    
        if (!isMounted) return
    
        if (bucketSeconds !== lastBucketRef.current) {
          lastBucketRef.current = bucketSeconds
          setPriceToBeat(closePrice)
          // bucket + 900 = start of NEXT candle = current active round
          setBucket(bucketSeconds + 900)
          console.log(`[Coinbase] Target: $${closePrice}, active bucket: ${bucketSeconds + 900}`)
        }
      } catch (err) {
        console.error('[useTargetPrice] Candle fetch error:', err)
      }
    }

    // Fetch immediately then every 15 seconds
    fetchCandles()
    intervalRef.current = setInterval(fetchCandles, 15_000)

    return () => {
      isMounted = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [symbol])

  return { priceToBeat, bucket }
}
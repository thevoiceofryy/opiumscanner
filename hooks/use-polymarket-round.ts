'use client'
import { useState, useEffect } from 'react'

export function usePolymarketRound() {
  const [marketTitle, setMarketTitle] = useState("Initializing...")
  const [priceToBeat, setPriceToBeat] = useState(0)
  const [probability, setProbability] = useState(50)
  const [clobAskYes, setClobAskYes] = useState<number | null>(null)
  const [clobAskNo, setClobAskNo] = useState<number | null>(null)
  const [lastResult, setLastResult] = useState<'UP' | 'DOWN' | 'UNKNOWN'>('UNKNOWN')
  const [upRounds, setUpRounds] = useState(0)
  const [downRounds, setDownRounds] = useState(0)

  useEffect(() => {
    async function fetchRound() {
      try {
        const res = await fetch('/api/polymarket/round')
        const data = await res.json()

        console.log("MARKET TITLE FROM API:", data.title)
        console.log("TARGET PRICE FROM API:", data.priceToBeat)
        console.log("PROBABILITY FROM API:", data.probability)

        setMarketTitle(data.title || "Searching for BTC Market...")
        setPriceToBeat(data.priceToBeat ?? 0)
        setProbability(data.probability ?? 50)
        setClobAskYes(typeof data?.clob?.up?.bestAsk === 'number' ? data.clob.up.bestAsk : null)
        setClobAskNo(typeof data?.clob?.down?.bestAsk === 'number' ? data.clob.down.bestAsk : null)

        if (data.lastRound) {
          setLastResult(data.lastRound.result || 'UNKNOWN')

          if (typeof window !== 'undefined') {
            try {
              const bucketKey = String(data.lastRound.bucket)
              const lastBucketSeen = window.localStorage.getItem('btcupdown_lastBucket')

              let up = Number(window.localStorage.getItem('btcupdown_up') || '0')
              let down = Number(window.localStorage.getItem('btcupdown_down') || '0')

              if (bucketKey && bucketKey !== lastBucketSeen && data.lastRound.result !== 'UNKNOWN') {
                if (data.lastRound.result === 'UP') up += 1
                if (data.lastRound.result === 'DOWN') down += 1

                window.localStorage.setItem('btcupdown_up', String(up))
                window.localStorage.setItem('btcupdown_down', String(down))
                window.localStorage.setItem('btcupdown_lastBucket', bucketKey)
              }

              setUpRounds(up)
              setDownRounds(down)
            } catch {
              // ignore localStorage issues
            }
          }
        }
      } catch (err) {
        console.error("Hook Fetch Error:", err)
      }
    }

    // hydrate initial record from localStorage
    if (typeof window !== 'undefined') {
      try {
        const up = Number(window.localStorage.getItem('btcupdown_up') || '0')
        const down = Number(window.localStorage.getItem('btcupdown_down') || '0')
        setUpRounds(up)
        setDownRounds(down)
      } catch {
        // ignore
      }
    }

    fetchRound()
    const interval = setInterval(fetchRound, 15000)
    return () => clearInterval(interval)
  }, [])

  return { marketTitle, priceToBeat, probability, clobAskYes, clobAskNo, lastResult, upRounds, downRounds }
}
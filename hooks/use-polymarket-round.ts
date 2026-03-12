'use client'
import { useState, useEffect } from 'react'

export function usePolymarketRound() {
  const [marketTitle, setMarketTitle] = useState("Initializing...")
  const [priceToBeat, setPriceToBeat] = useState(0)
  const [probability, setProbability] = useState(50)

  useEffect(() => {
    async function fetchRound() {
      try {
        const res = await fetch('/api/polymarket/round')
        const data = await res.json()

        // Debugging logs - now they will show 0/50 instead of undefined
        console.log("MARKET TITLE FROM API:", data.title)
        console.log("TARGET PRICE FROM API:", data.priceToBeat)
        console.log("PROBABILITY FROM API:", data.probability)

        setMarketTitle(data.title || "Searching for BTC Market...")
        setPriceToBeat(data.priceToBeat ?? 0)
        setProbability(data.probability ?? 50)
      } catch (err) {
        console.error("Hook Fetch Error:", err)
      }
    }

    fetchRound()
    const interval = setInterval(fetchRound, 15000)
    return () => clearInterval(interval)
  }, [])

  return { marketTitle, priceToBeat, probability }
}
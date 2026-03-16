'use client'

import { useState, useEffect, useRef } from 'react'
import { useTargetPriceWebSocket } from './use-target-price-websocket'
import { subscribeToTrades } from './use-btc-price'

type RoundResult = 'UP' | 'DOWN'

export function usePolymarketRound() {

  const [marketTitle, setMarketTitle] = useState("Initializing...")
  const [priceToBeat, setPriceToBeat] = useState(0)
  const [probability, setProbability] = useState(50)

  const [clobAskYes, setClobAskYes] = useState<number | null>(null)
  const [clobAskNo, setClobAskNo] = useState<number | null>(null)

  const [lastResult, setLastResult] = useState<'UP' | 'DOWN' | 'UNKNOWN'>('UNKNOWN')

  const [upRounds, setUpRounds] = useState(0)
  const [downRounds, setDownRounds] = useState(0)

  const [correctRounds, setCorrectRounds] = useState(0)
  const [wrongRounds, setWrongRounds] = useState(0)

  const latestIndicatorsRef = useRef<any>(null)
  const latestBtcPriceRef = useRef<number>(0)
  const orderFlowRef = useRef<number>(0.5)

  const priceToBeatRef = useRef<number>(0)
  const priceToBeatBucketRef = useRef<number | null>(null)

  const lastPostedBucketRef = useRef<number | null>(null)

  const { priceToBeat: wsPriceToBeat, bucket: wsBucket } = useTargetPriceWebSocket()

  useEffect(() => {
    priceToBeatRef.current = priceToBeat
  }, [priceToBeat])

  // ORDER FLOW
  useEffect(() => {

    const window60s: any[] = []

    const unsub = subscribeToTrades((trade) => {

      const now = Date.now()

      window60s.push({
        size: trade.size,
        side: trade.side,
        ts: now
      })

      const cutoff = now - 60000

      while (window60s.length && window60s[0].ts < cutoff) {
        window60s.shift()
      }

      let buyVol = 0
      let totalVol = 0

      for (const t of window60s) {
        totalVol += t.size
        if (t.side === 'BUY') buyVol += t.size
      }

      if (totalVol > 0) {
        orderFlowRef.current = buyVol / totalVol
      }

    })

    return () => unsub()

  }, [])

  // INDICATORS
  useEffect(() => {

    const fetchIndicators = async () => {

      try {

        const res = await fetch('/api/crypto/indicators?symbol=BTCUSDT&interval=15m')
        const data = await res.json()

        if (data?.indicators) {
          latestIndicatorsRef.current = data.indicators
        }

        if (data?.price && data.price > 50000) {
          latestBtcPriceRef.current = data.price
        }

      } catch {}

    }

    fetchIndicators()

    const id = setInterval(fetchIndicators, 15000)

    return () => clearInterval(id)

  }, [])

  // WEBSOCKET TARGET
  useEffect(() => {

    if (
      wsPriceToBeat &&
      wsPriceToBeat > 50000 &&
      wsBucket &&
      priceToBeatBucketRef.current !== wsBucket
    ) {

      priceToBeatBucketRef.current = wsBucket

      priceToBeatRef.current = wsPriceToBeat

      setPriceToBeat(wsPriceToBeat)

    }

  }, [wsPriceToBeat, wsBucket])

  // MAIN POLLING
  useEffect(() => {

    async function fetchRound() {

      try {

        const res = await fetch('/api/polymarket/round')
        const data = await res.json()

        setMarketTitle(data.title || 'Searching for BTC Market...')

        const apiPrice = data.priceToBeat ?? 0

        if (apiPrice > 50000 && apiPrice < 200000) {

          setPriceToBeat(apiPrice)

          priceToBeatRef.current = apiPrice

        }

        const prob = data.probability ?? 50

        setProbability(prob)

        // REAL CLOB DATA

        const rawYesAsk = data?.clob?.up?.bestAsk
        const rawNoAsk = data?.clob?.down?.bestAsk

        const yesValid =
          typeof rawYesAsk === 'number' &&
          rawYesAsk >= 0.01 &&
          rawYesAsk <= 0.99

        const noValid =
          typeof rawNoAsk === 'number' &&
          rawNoAsk >= 0.01 &&
          rawNoAsk <= 0.99

        setClobAskYes(yesValid ? rawYesAsk : null)
        setClobAskNo(noValid ? rawNoAsk : null)

        console.log('CLOB PRICES', {
          yes: rawYesAsk,
          no: rawNoAsk
        })

        if (data.lastRound) {
          setLastResult(data.lastRound.result || 'UNKNOWN')
        }

        if (data.lastRound && data.lastRound.result !== 'UNKNOWN') {

          const bucketKey = Number(data.lastRound.bucket)

          if (lastPostedBucketRef.current !== bucketKey) {

            lastPostedBucketRef.current = bucketKey

            const result = data.lastRound.result as RoundResult

            try {

              const res = await fetch('/api/polymarket/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bucket: bucketKey,
                  result
                })
              })

              if (res.ok) {

                const global = await res.json()

                setUpRounds(global.upRounds ?? 0)
                setDownRounds(global.downRounds ?? 0)
                setCorrectRounds(global.correctRounds ?? 0)
                setWrongRounds(global.wrongRounds ?? 0)

              }

            } catch {}

          }

        }

      } catch (err) {

        console.error('Hook Fetch Error:', err)

      }

    }

    const fetchResults = async () => {

      try {

        const res = await fetch('/api/polymarket/results')

        if (res.ok) {

          const data = await res.json()

          setUpRounds(data.upRounds ?? 0)
          setDownRounds(data.downRounds ?? 0)
          setCorrectRounds(data.correctRounds ?? 0)
          setWrongRounds(data.wrongRounds ?? 0)

        }

      } catch {}

    }

    fetchResults()

    const resultsInterval = setInterval(fetchResults, 10000)

    fetchRound()

    const early = setTimeout(fetchRound, 2500)

    const interval = setInterval(fetchRound, 2000)

    return () => {

      clearTimeout(early)
      clearInterval(interval)
      clearInterval(resultsInterval)

    }

  }, [])

  return {

    marketTitle,
    priceToBeat,
    probability,

    clobAskYes,
    clobAskNo,

    lastResult,

    upRounds,
    downRounds,

    correctRounds,
    wrongRounds

  }

}
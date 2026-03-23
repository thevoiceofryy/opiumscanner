'use client'

import { useState, useEffect, useRef } from 'react'
import { useTargetPriceWebSocket } from './use-target-price-websocket'
import { subscribeToTrades } from './use-btc-price'

type RoundResult = 'UP' | 'DOWN'

type ResultsLogEntry = {
  bucket: number
  result: 'UP' | 'DOWN'
  predicted?: 'UP' | 'DOWN'
  correct?: boolean
  recordedAt: number
}

export function usePolymarketRound() {

  const [marketTitle, setMarketTitle] = useState("Initializing...")
  const [priceToBeat, setPriceToBeat] = useState(0)
  const [probability, setProbability] = useState(50)
const [currentPrediction, setCurrentPrediction] = useState<'UP' | 'DOWN' | null>(null)
  const [clobAskYes, setClobAskYes] = useState<number | null>(null)
  const [clobAskNo, setClobAskNo] = useState<number | null>(null)

  const [bookDepth, setBookDepth] = useState<{
    upBidDepth: number; upAskDepth: number; upImbalance: number; upSpread: number | null;
    downBidDepth: number; downAskDepth: number; downImbalance: number; downSpread: number | null;
    upBidDepth5: number; upAskDepth5: number; downBidDepth5: number; downAskDepth5: number;
  }>({
    upBidDepth: 0, upAskDepth: 0, upImbalance: 0, upSpread: null,
    downBidDepth: 0, downAskDepth: 0, downImbalance: 0, downSpread: null,
    upBidDepth5: 0, upAskDepth5: 0, downBidDepth5: 0, downAskDepth5: 0,
  })

  const [lastResult, setLastResult] = useState<'UP' | 'DOWN' | 'UNKNOWN'>('UNKNOWN')

  const [upRounds, setUpRounds] = useState(0)
  const [downRounds, setDownRounds] = useState(0)

  const [correctRounds, setCorrectRounds] = useState(0)
  const [wrongRounds, setWrongRounds] = useState(0)

  const [resultsLog, setResultsLog] = useState<ResultsLogEntry[]>([])

  const latestIndicatorsRef = useRef<any>(null)
  const latestBtcPriceRef = useRef<number>(0)
  const orderFlowRef = useRef<number>(0.5)

  const priceToBeatRef = useRef<number>(0)

  const lastPostedBucketRef = useRef<number | null>(null)

  const { chainlinkLive } = useTargetPriceWebSocket()

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
  rawYesAsk >= 0.30 &&
  rawYesAsk <= 0.70

const noValid =
  typeof rawNoAsk === 'number' &&
  rawNoAsk >= 0.30 &&
  rawNoAsk <= 0.70

const bothValid =
  yesValid &&
  noValid &&
  Math.abs((rawYesAsk + rawNoAsk) - 1.0) <= 0.05

setClobAskYes(bothValid ? rawYesAsk : null)
setClobAskNo(bothValid ? rawNoAsk : null)

        // Orderbook depth data
        setBookDepth({
          upBidDepth: data?.clob?.up?.bidDepth ?? 0,
          upAskDepth: data?.clob?.up?.askDepth ?? 0,
          upImbalance: data?.clob?.up?.imbalance ?? 0,
          upSpread: data?.clob?.up?.spread ?? null,
          downBidDepth: data?.clob?.down?.bidDepth ?? 0,
          downAskDepth: data?.clob?.down?.askDepth ?? 0,
          downImbalance: data?.clob?.down?.imbalance ?? 0,
          downSpread: data?.clob?.down?.spread ?? null,
          upBidDepth5: data?.clob?.up?.bidDepth5pct ?? 0,
          upAskDepth5: data?.clob?.up?.askDepth5pct ?? 0,
          downBidDepth5: data?.clob?.down?.bidDepth5pct ?? 0,
          downAskDepth5: data?.clob?.down?.askDepth5pct ?? 0,
        })

        if (data.lastRound) {
          setLastResult(data.lastRound.result || 'UNKNOWN')
        }

        if (data.lastRound && data.lastRound.result !== 'UNKNOWN') {

const bucketKey = data.lastRound.bucket

          if (lastPostedBucketRef.current !== bucketKey) {

            lastPostedBucketRef.current = bucketKey

            const result = data.lastRound.result as RoundResult

            try {
              
console.log('POSTING RESULT — bucket:', bucketKey, 'result:', result)
const resultRes = await fetch('/api/polymarket/results', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bucket: bucketKey,
    result
  })
})


if (resultRes.ok) {
  const global = await resultRes.json()

  setUpRounds(global.upRounds ?? 0)
  setDownRounds(global.downRounds ?? 0)
  setCorrectRounds(global.correctRounds ?? 0)
  setWrongRounds(global.wrongRounds ?? 0)
  setResultsLog(global.resultsLog ?? [])
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
          setResultsLog(data.resultsLog ?? [])

        }

      } catch {}

    }

    fetchResults()

    const resultsInterval = setInterval(fetchResults, 10000)

    fetchRound()

    const early = setTimeout(fetchRound, 2500)

    // Fast poll at bucket boundaries to catch new price to beat quickly
    const fastPollInterval = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000)
      const secIntoBucket = nowSec % 900
      // Poll every 500ms in first 30s of bucket, else every 2s
      if (secIntoBucket < 30) {
        fetchRound()
      }
    }, 500)

    const interval = setInterval(fetchRound, 2000)

    return () => {
      clearTimeout(early)
      clearInterval(fastPollInterval)
      clearInterval(interval)
      clearInterval(resultsInterval)
    }

  }, [])
// ===== PRICE TO BEAT ENGINE =====
const currentPrice = chainlinkLive || latestBtcPriceRef.current || 0

const diff = currentPrice && priceToBeat
  ? currentPrice - priceToBeat
  : 0

const diffPct = currentPrice && priceToBeat
  ? (diff / priceToBeat) * 100
  : 0

let bias: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL'

if (diffPct > 0.02) bias = 'UP'
if (diffPct < -0.02) bias = 'DOWN'

  return {

    marketTitle,
    priceToBeat,
    probability,
    currentPrice,
diffPct,
bias,

    clobAskYes,
    clobAskNo,

    bookDepth,

    lastResult,

    upRounds,
    downRounds,

    correctRounds,
    wrongRounds,

    resultsLog,

  }

}
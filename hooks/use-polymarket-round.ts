'use client'
import { useState, useEffect, useRef } from 'react'
import { useTargetPriceWebSocket } from './use-target-price-websocket'
import { subscribeToTrades } from './use-btc-price'

type RoundResult = 'UP' | 'DOWN'
type TradeWindow = { size: number; side: 'BUY' | 'SELL'; ts: number }
type ResultLogEntry = {
  bucket: number
  result: RoundResult
  predicted?: RoundResult
  correct?: boolean
  recordedAt: number
}

function scoreDirection(
  indicators: any,
  polyProb: number,
  btcPrice: number,
  priceToBeat: number,
  orderFlowRatio: number = 0.5,
  atr: number = 0,
  bucketStartSeconds?: number,
): RoundResult {
  let upScore = 0
  let downScore = 0

  const nowSeconds    = Math.floor(Date.now() / 1000)
  const roundDuration = 900
  const elapsed       = bucketStartSeconds
    ? Math.max(0, Math.min(roundDuration, nowSeconds - bucketStartSeconds))
    : roundDuration / 2
  const timeProgress = elapsed / roundDuration

  const earlyRound = timeProgress < 0.2
  const midRound   = timeProgress >= 0.2 && timeProgress < 0.67
  const lateRound  = timeProgress >= 0.67 && timeProgress < 0.93

  const indicatorMult  = earlyRound ? 0.4 : midRound ? 1.0 : lateRound ? 0.8 : 0.3
  const flowMult       = earlyRound ? 0.6 : midRound ? 1.0 : lateRound ? 1.4 : 1.8
  const priceMult      = earlyRound ? 0.5 : midRound ? 1.0 : lateRound ? 1.5 : 2.0
  const volatilityMult = atr > 0 && btcPrice > 0
    ? Math.max(0.5, 1 - ((atr / btcPrice) * 500)) : 1

  if (indicators) {
    let indUp = 0, indDown = 0
    const rsi = indicators.rsi ?? 50
    if      (rsi >= 70) indDown += 15
    else if (rsi >= 60) indUp   += 10
    else if (rsi <= 30) indUp   += 15
    else if (rsi <= 40) indDown += 10
    else if (rsi >= 50) indUp   += 3
    else                indDown += 3

    const hist     = indicators.macdHistogram ?? 0
    const macdLine = indicators.macd ?? 0
    const macdSig  = indicators.macdSignal ?? 0
    if      (hist > 0 && macdLine > macdSig) indUp   += 12
    else if (hist < 0 && macdLine < macdSig) indDown += 12
    else if (hist > 0)                       indUp   += 5
    else                                     indDown += 5

    const k = indicators.stochK ?? 50
    const d = indicators.stochD ?? 50
    if      (k >= 80 && d >= 80) indDown += 10
    else if (k <= 20 && d <= 20) indUp   += 10
    else if (k > d)              indUp   += 5
    else                         indDown += 5

    if      (indicators.trend === 'UP')   indUp   += 10
    else if (indicators.trend === 'DOWN') indDown += 10

    const vd = indicators.vwapDeviation ?? 0
    if      (vd < -0.3) indUp   += 8
    else if (vd > 0.3)  indDown += 8
    else if (vd >= 0)   indUp   += 2
    else                indDown += 2

    upScore   += indUp   * indicatorMult * volatilityMult
    downScore += indDown * indicatorMult * volatilityMult
  }

  let flowUp = 0, flowDown = 0
  if      (orderFlowRatio >= 0.65) flowUp   = 20
  else if (orderFlowRatio >= 0.58) flowUp   = 12
  else if (orderFlowRatio >= 0.52) flowUp   = 6
  else if (orderFlowRatio <= 0.35) flowDown = 20
  else if (orderFlowRatio <= 0.42) flowDown = 12
  else if (orderFlowRatio <= 0.48) flowDown = 6
  upScore   += flowUp   * flowMult
  downScore += flowDown * flowMult

  if (btcPrice > 0 && priceToBeat > 0) {
    const distPct = ((btcPrice - priceToBeat) / priceToBeat) * 100
    let priceUp = 0, priceDown = 0
    if      (distPct > 0.2)  priceUp   = 10
    else if (distPct > 0.1)  priceUp   = 6
    else if (distPct > 0)    priceUp   = 3
    else if (distPct < -0.2) priceDown = 10
    else if (distPct < -0.1) priceDown = 6
    else                     priceDown = 3
    upScore   += priceUp   * priceMult
    downScore += priceDown * priceMult
  }

  const edge = polyProb - 50
  if      (Math.abs(edge) >= 20) { if (edge > 0) upScore += 8;  else downScore += 8  }
  else if (Math.abs(edge) >= 10) { if (edge > 0) upScore += 5;  else downScore += 5  }
  else if (Math.abs(edge) >= 5)  { if (edge > 0) upScore += 2;  else downScore += 2  }

  console.log(`[scoreDirection] UP=${upScore.toFixed(1)} DOWN=${downScore.toFixed(1)} flow=${orderFlowRatio.toFixed(2)}`)
  return upScore >= downScore ? 'UP' : 'DOWN'
}

if (typeof window !== 'undefined') {
  (window as any).debugPredictions = () => {
    const log = JSON.parse(localStorage.getItem('btcupdown_log') || '[]')
    console.group('📊 Prediction Log')
    if (!log.length) { console.log('No log entries found') }
    else log.forEach((e: ResultLogEntry) => {
      const s = e.correct === true ? '✅' : e.correct === false ? '❌' : '❓'
      console.log(`${s} Bucket ${e.bucket} | Result: ${e.result} | Predicted: ${e.predicted ?? 'NONE'} | Correct: ${e.correct}`)
    })
    console.log(`Correct: ${localStorage.getItem('btcupdown_correct')} | Wrong: ${localStorage.getItem('btcupdown_wrong')}`)
    console.groupEnd()
  }
  console.log('💡 Run debugPredictions() in console to inspect prediction log')
}

export function usePolymarketRound() {
  const [marketTitle,   setMarketTitle]   = useState("Initializing...")
  const [priceToBeat,   setPriceToBeat]   = useState(0)
  const [probability,   setProbability]   = useState(50)
  const [clobAskYes,    setClobAskYes]    = useState<number | null>(null)
  const [clobAskNo,     setClobAskNo]     = useState<number | null>(null)
  const [lastResult,    setLastResult]    = useState<'UP' | 'DOWN' | 'UNKNOWN'>('UNKNOWN')
  const [upRounds,      setUpRounds]      = useState(0)
  const [downRounds,    setDownRounds]    = useState(0)
  const [correctRounds, setCorrectRounds] = useState(0)
  const [wrongRounds,   setWrongRounds]   = useState(0)
  const [resultsLog,    setResultsLog]    = useState<ResultLogEntry[]>([])
  const [currentBucket, setCurrentBucket] = useState<number | null>(null)

  const latestIndicatorsRef = useRef<any>(null)
  const latestBtcPriceRef   = useRef<number>(0)
  const orderFlowRef        = useRef<number>(0.5)
  const priceToBeatRef      = useRef<number>(0)
  const priceToBeatBucketRef = useRef<number | null>(null)
  const lastPostedBucketRef = useRef<number | null>(null)

  const { priceToBeat: wsPriceToBeat, bucket: wsBucket } = useTargetPriceWebSocket()

  useEffect(() => { priceToBeatRef.current = priceToBeat }, [priceToBeat])

  // ── Order flow ────────────────────────────────────────────────────────────
  useEffect(() => {
    const window60s: TradeWindow[] = []
    const unsub = subscribeToTrades((trade) => {
      const now = Date.now()
      window60s.push({ size: trade.size, side: trade.side, ts: now })
      const cutoff = now - 60_000
      while (window60s.length > 0 && window60s[0].ts < cutoff) window60s.shift()
      let buyVol = 0, totalVol = 0
      for (const t of window60s) {
        totalVol += t.size
        if (t.side === 'BUY') buyVol += t.size
      }
      if (totalVol > 0) orderFlowRef.current = buyVol / totalVol
    })
    return () => { unsub() }
  }, [])

  // ── Keep indicators + BTC price fresh via your own API (no CORS issues) ──
  // FIXED: removed direct Binance fetch from client — was causing CORS block.
  // Now uses /api/crypto/indicators which runs server-side.
  useEffect(() => {
    const fetchIndicators = async () => {
      try {
        const res  = await fetch('/api/crypto/indicators?symbol=BTCUSDT&interval=15m')
        const data = await res.json()
        if (data?.indicators) latestIndicatorsRef.current = data.indicators
        // Use the price returned by your own API — no CORS issues
        if (data?.price && data.price > 50000) {
          latestBtcPriceRef.current = data.price
          console.log(`[indicators] BTC price updated: ${data.price}`)
        }
      } catch {}
    }
    fetchIndicators()
    const id = setInterval(fetchIndicators, 15000)
    return () => clearInterval(id)
  }, [])

  // ── WebSocket candle price: only set target when bucket is new (target is fixed per round) ──
  useEffect(() => {
    if (
      wsPriceToBeat != null &&
      wsPriceToBeat > 50000 &&
      wsPriceToBeat < 200000 &&
      wsBucket != null &&
      (priceToBeatBucketRef.current === null || priceToBeatBucketRef.current !== wsBucket)
    ) {
      priceToBeatBucketRef.current = wsBucket
      priceToBeatRef.current = wsPriceToBeat
      setPriceToBeat(wsPriceToBeat)
      setCurrentBucket(wsBucket)
      console.log(`WS price to beat: ${wsPriceToBeat} for bucket ${wsBucket}`)
    }
  }, [wsPriceToBeat, wsBucket])

  // ── Main round polling ────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchRound() {
      try {
        const res  = await fetch('/api/polymarket/round')
        const data = await res.json()

        console.log('MARKET TITLE FROM API:', data.title)
        console.log('TARGET PRICE FROM API:', data.priceToBeat)
        console.log('PROBABILITY FROM API:', data.probability)
        console.log('CLOB UP ask:', data?.clob?.up?.bestAsk, '| DOWN ask:', data?.clob?.down?.bestAsk)

        setMarketTitle(data.title || 'Searching for BTC Market...')

        const bucket = typeof data.bucket === 'number' ? data.bucket : null
        if (bucket !== null) setCurrentBucket(bucket)

        const apiPrice = data.priceToBeat ?? 0
        // Target is fixed per round (previous 15m close). Only set when round changes or we have none.
        const bucketChanged = bucket !== null && priceToBeatBucketRef.current !== bucket
        const needTarget = priceToBeatRef.current < 50000 || priceToBeatRef.current > 200000
        if (apiPrice > 50000 && apiPrice < 200000 && (bucketChanged || needTarget)) {
          priceToBeatBucketRef.current = bucket
          priceToBeatRef.current = apiPrice
          setPriceToBeat(apiPrice)
        } else if (apiPrice <= 0 && needTarget) {
          console.log(`[round] API returned priceToBeat=0 — keeping existing $${priceToBeatRef.current}`)
        }

        const prob = data.probability ?? 50
        setProbability(prob)

        // CLOB asks — accept 0.01–0.99 so we can display orderbook (Best Bet shows real asks)
        const rawYesAsk = data?.clob?.up?.bestAsk
        const rawNoAsk  = data?.clob?.down?.bestAsk
        setClobAskYes(typeof rawYesAsk === 'number' && rawYesAsk >= 0.01 && rawYesAsk <= 0.99 ? rawYesAsk : null)
        setClobAskNo( typeof rawNoAsk  === 'number' && rawNoAsk  >= 0.01 && rawNoAsk  <= 0.99 ? rawNoAsk  : null)

        // ── STEP 1: Save prediction for current bucket ────────────────────────
        if (typeof window !== 'undefined' && bucket !== null) {
          try {
            const key = `btcupdown_pred_${String(bucket)}`
            if (!window.localStorage.getItem(key)) {
              const hasPrice      = latestBtcPriceRef.current > 50000
              const hasIndicators = !!latestIndicatorsRef.current
              const hasTarget     = apiPrice > 50000

              if (!hasPrice) {
                console.log(`[prediction] Waiting for BTC price (${latestBtcPriceRef.current}) — will retry next poll`)
              } else if (!hasIndicators) {
                console.log(`[prediction] Waiting for indicators — will retry next poll`)
              } else if (!hasTarget) {
                console.log(`[prediction] Waiting for priceToBeat — will retry next poll`)
              } else {
                const atr  = latestIndicatorsRef.current?.atr ?? 0
                const pred = scoreDirection(
                  latestIndicatorsRef.current,
                  prob,
                  latestBtcPriceRef.current,
                  apiPrice,
                  orderFlowRef.current,
                  atr,
                  bucket,
                )
                window.localStorage.setItem(key, pred)
                console.log(`[prediction] ✅ Saved bucket ${bucket}: ${pred}`)
              }
            }
          } catch {}
        }

        // ── STEP 2: Score previous round — universal Win/Loss (server-backed) ──
        if (data.lastRound) {
          setLastResult(data.lastRound.result || 'UNKNOWN')
        }
        if (data.lastRound && data.lastRound.result !== 'UNKNOWN') {
          const bucketKey = Number(data.lastRound.bucket)
          if (lastPostedBucketRef.current !== bucketKey) {
            lastPostedBucketRef.current = bucketKey
            const result = data.lastRound.result as RoundResult
            let predicted: RoundResult | undefined
            if (typeof window !== 'undefined') {
              try {
                const predRaw = window.localStorage.getItem(`btcupdown_pred_${bucketKey}`)
                predicted = predRaw === 'UP' || predRaw === 'DOWN' ? (predRaw as RoundResult) : undefined
              } catch {}
            }

            try {
              const res = await fetch('/api/polymarket/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bucket: bucketKey, result, predicted }),
              })
              if (res.ok) {
                const global = await res.json()
                setUpRounds(global.upRounds ?? 0)
                setDownRounds(global.downRounds ?? 0)
                setCorrectRounds(global.correctRounds ?? 0)
                setWrongRounds(global.wrongRounds ?? 0)
                if (Array.isArray(global.resultsLog)) setResultsLog(global.resultsLog.slice(0, 20))
              }
            } catch (e) {
              console.error('[results] POST failed:', e)
            }
          }
        }

      } catch (err) {
        console.error('Hook Fetch Error:', err)
      }
    }

    // Seed Win/Loss from universal server state (same for every screen)
    const fetchResults = async () => {
      try {
        const res = await fetch('/api/polymarket/results')
        if (res.ok) {
          const data = await res.json()
          setUpRounds(data.upRounds ?? 0)
          setDownRounds(data.downRounds ?? 0)
          setCorrectRounds(data.correctRounds ?? 0)
          setWrongRounds(data.wrongRounds ?? 0)
          if (Array.isArray(data.resultsLog)) setResultsLog(data.resultsLog.slice(0, 20))
        }
      } catch {}
    }
    fetchResults()
    const resultsInterval = setInterval(fetchResults, 10000)
    fetchRound()
    const early = setTimeout(fetchRound, 2500)
    const interval = setInterval(fetchRound, 8000)
    return () => {
      clearTimeout(early)
      clearInterval(interval)
      clearInterval(resultsInterval)
    }
  }, [])

  return {
    marketTitle, priceToBeat, probability,
    clobAskYes, clobAskNo, lastResult,
    upRounds, downRounds, correctRounds, wrongRounds, resultsLog,
  }
}
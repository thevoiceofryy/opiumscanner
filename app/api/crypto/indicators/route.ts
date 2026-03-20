import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BINANCE_US_API = 'https://api.binance.us/api/v3'
const BINANCE_GLOBAL_API = 'https://api.binance.com/api/v3'

async function fetchKlinesWithFallback(symbol: string, interval: string, limit: number): Promise<{ data: any[], isMock: boolean }> {
  const apis = [BINANCE_GLOBAL_API, BINANCE_US_API]
  
  for (const api of apis) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3000)
      
      const response = await fetch(
        `${api}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
          signal: controller.signal
        }
      )
      clearTimeout(timer)
      
      if (response.ok) {
        return { data: await response.json(), isMock: false }
      }
    } catch {
      continue
    }
  }
  
  return { data: generateMockKlines(symbol, limit), isMock: true }
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function generateMockKlines(symbol: string, limit: number): any[] {
  const now = Date.now()
  const intervalMs = 60000
  const basePrices: { [key: string]: number } = {
    'BTCUSDT': 70200,
    'ETHUSDT': 3500,
    'SOLUSDT': 150,
    'BNBUSDT': 600,
  }
  const basePrice = basePrices[symbol] || 100
  const volatility = basePrice * 0.003
  const klines: any[] = []
  const currentMinute = Math.floor(now / intervalMs) * intervalMs
  const historicalCloses: number[] = []
  let price = basePrice
  for (let i = 0; i < limit - 1; i++) {
    const candleMinute = currentMinute - (limit - 1 - i) * intervalMs
    const seed = candleMinute / 1000
    const rand = seededRandom(seed)
    const change = (rand - 0.5) * volatility * 2
    price = price + change
    historicalCloses.push(price)
  }
  for (let i = 0; i < limit; i++) {
    const candleMinute = currentMinute - (limit - 1 - i) * intervalMs
    const seed = candleMinute / 1000
    const isCurrentCandle = i === limit - 1
    const open = i === 0 ? basePrice : historicalCloses[i - 1]
    let close: number
    if (isCurrentCandle) {
      const secondsIntoCandle = (now % intervalMs) / 1000
      const liveVariation = (Math.sin(now / 500) * 0.5 + Math.random() * 0.5) * volatility
      close = open + liveVariation * (secondsIntoCandle / 60)
    } else {
      close = historicalCloses[i]
    }
    const rand2 = isCurrentCandle ? Math.random() : seededRandom(seed + 0.1)
    const rand3 = isCurrentCandle ? Math.random() : seededRandom(seed + 0.2)
    const rand4 = isCurrentCandle ? Math.random() : seededRandom(seed + 0.3)
    const high = Math.max(open, close) + rand2 * volatility * 0.5
    const low = Math.min(open, close) - rand3 * volatility * 0.5
    const volume = rand4 * 1000 + 100
    klines.push([
      candleMinute,
      open.toFixed(2),
      high.toFixed(2),
      low.toFixed(2),
      close.toFixed(2),
      volume.toFixed(2),
      candleMinute + intervalMs - 1,
      (volume * close).toFixed(2),
      Math.floor(rand4 * 100),
    ])
  }
  return klines
}

// RSI — standard Wilder smoothing
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  let avgGain = 0
  let avgLoss = 0
  // Seed with simple average for first period
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period
  avgLoss /= period
  // Wilder smoothing for remaining periods
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

// EMA
function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return prices.map(() => prices[prices.length - 1])
  const multiplier = 2 / (period + 1)
  const emas: number[] = []
  // Seed with SMA
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  emas.push(...new Array(period - 1).fill(NaN)) // pad so indices align
  emas.push(ema)
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema
    emas.push(ema)
  }
  return emas
}

// MACD — proper 12/26 EMA with real 9-period EMA signal line
function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)

  // MACD line = EMA12 - EMA26, only where both are valid
  const macdLine: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(ema12[i]) || isNaN(ema26[i])) {
      macdLine.push(NaN)
    } else {
      macdLine.push(ema12[i] - ema26[i])
    }
  }

  // Signal line = 9-period EMA of MACD line (only over valid values)
  const validMacd = macdLine.filter(v => !isNaN(v))
  const signalEMAs = calculateEMA(validMacd, 9)
  const signal = signalEMAs[signalEMAs.length - 1]
  const macd = validMacd[validMacd.length - 1]
  const histogram = macd - signal

  return {
    macd: isNaN(macd) ? 0 : macd,
    signal: isNaN(signal) ? 0 : signal,
    histogram: isNaN(histogram) ? 0 : histogram,
  }
}

// ATR — Wilder smoothing
function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period + 1) return 0
  const trueRanges: number[] = []
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    )
    trueRanges.push(tr)
  }
  // Seed ATR
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period
  }
  return atr
}

// StochRSI — correct: K = stoch of RSI values, D = 3-period SMA of K
function calculateStochRSI(closes: number[], rsiPeriod: number = 14, stochPeriod: number = 14, kSmooth: number = 3, dSmooth: number = 3): { k: number; d: number } {
  // Build full RSI series
  const rsiValues: number[] = []
  for (let i = rsiPeriod; i <= closes.length; i++) {
    rsiValues.push(calculateRSI(closes.slice(0, i), rsiPeriod))
  }

  if (rsiValues.length < stochPeriod) return { k: 50, d: 50 }

  // Raw stoch K values
  const rawK: number[] = []
  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1)
    const minRSI = Math.min(...window)
    const maxRSI = Math.max(...window)
    rawK.push(maxRSI === minRSI ? 50 : ((rsiValues[i] - minRSI) / (maxRSI - minRSI)) * 100)
  }

  if (rawK.length < kSmooth) return { k: rawK[rawK.length - 1] ?? 50, d: 50 }

  // Smooth K with SMA(kSmooth)
  const smoothedK: number[] = []
  for (let i = kSmooth - 1; i < rawK.length; i++) {
    const slice = rawK.slice(i - kSmooth + 1, i + 1)
    smoothedK.push(slice.reduce((a, b) => a + b, 0) / kSmooth)
  }

  if (smoothedK.length < dSmooth) return { k: smoothedK[smoothedK.length - 1] ?? 50, d: 50 }

  // D = SMA(dSmooth) of smoothed K
  const kVal = smoothedK[smoothedK.length - 1]
  const dSlice = smoothedK.slice(-dSmooth)
  const dVal = dSlice.reduce((a, b) => a + b, 0) / dSmooth

  return { k: kVal, d: dVal }
}

// VWAP
function calculateVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let cumulativeTPV = 0
  let cumulativeVolume = 0
  for (let i = 0; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3
    cumulativeTPV += typicalPrice * volumes[i]
    cumulativeVolume += volumes[i]
  }
  return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : closes[closes.length - 1]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || 'BTCUSDT'
  const interval = searchParams.get('interval') || '1m'

  try {
    const { data: klines, isMock } = await fetchKlinesWithFallback(symbol, interval, 200)
    
    const highs   = klines.map((k: any[]) => parseFloat(k[2]))
    const lows    = klines.map((k: any[]) => parseFloat(k[3]))
    const closes  = klines.map((k: any[]) => parseFloat(k[4]))
    const volumes = klines.map((k: any[]) => parseFloat(k[5]))
    
    const currentPrice = closes[closes.length - 1]

    const rsi = calculateRSI(closes)
    const { macd, signal: macdSignal, histogram: macdHistogram } = calculateMACD(closes)
    const atr = calculateATR(highs, lows, closes)
    const { k: stochK, d: stochD } = calculateStochRSI(closes)
    const vwap = calculateVWAP(highs, lows, closes, volumes)

    const sma = (period: number) => {
      if (closes.length < period) return currentPrice
      return closes.slice(-period).reduce((a, b) => a + b, 0) / period
    }
    const sma20 = sma(20)
    const sma50 = sma(50)

    const rsiSignal   = rsi >= 70 ? 'OVERBOUGHT' : rsi <= 30 ? 'OVERSOLD' : 'NEUTRAL'
    const stochSignal = stochK >= 80 ? 'OVERBOUGHT' : stochK <= 20 ? 'OVERSOLD' : 'NEUTRAL'
    const macdTrend   = macd >= 0 ? 'BULLISH' : 'BEARISH'
    const trend =
      currentPrice > sma20 && sma20 > sma50 ? 'UP' :
      currentPrice < sma20 && sma20 < sma50 ? 'DOWN' : 'NEUTRAL'
    const vwapDeviation = ((currentPrice - vwap) / vwap) * 100

    return NextResponse.json({
      symbol,
      interval,
      isMock,
      price: currentPrice,
      open: closes[0],
      high: Math.max(...highs),
      low: Math.min(...lows),
      priceChange: currentPrice - closes[0],
      priceChangePercent: ((currentPrice - closes[0]) / closes[0]) * 100,
      volume: volumes.reduce((a, b) => a + b, 0),
      indicators: {
        rsi,
        rsiSignal,
        macd,
        macdSignal,
        macdHistogram,
        macdTrend,
        atr,
        stochK,
        stochD,
        stochSignal,
        vwap,
        vwapDeviation,
        sma20,
        sma50,
        trend,
      },
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Indicators error:', error)
    return NextResponse.json({ error: 'Failed to calculate' }, { status: 500 })
  }
}
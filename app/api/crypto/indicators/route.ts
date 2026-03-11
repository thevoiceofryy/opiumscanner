import { NextResponse } from 'next/server'

// Use Binance.US API which works in the US, fallback to global Binance
const BINANCE_US_API = 'https://api.binance.us/api/v3'
const BINANCE_GLOBAL_API = 'https://api.binance.com/api/v3'

async function fetchKlinesWithFallback(symbol: string, interval: string, limit: number) {
  const apis = [BINANCE_US_API, BINANCE_GLOBAL_API]
  
  for (const api of apis) {
    try {
      const response = await fetch(
        `${api}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 5 }
        }
      )
      
      if (response.ok) {
        return await response.json()
      }
    } catch {
      continue
    }
  }
  
  throw new Error('All Binance APIs unavailable')
}

// Calculate RSI
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50
  
  const changes = closes.slice(1).map((close, i) => close - closes[i])
  const gains = changes.map(c => c > 0 ? c : 0)
  const losses = changes.map(c => c < 0 ? Math.abs(c) : 0)
  
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period
  
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

// Calculate MACD
function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)
  const macdLine = ema12 - ema26
  
  // For signal line, we'd need historical MACD values - simplified here
  const signal = macdLine * 0.9 // Approximation
  const histogram = macdLine - signal
  
  return { macd: macdLine, signal, histogram }
}

// Calculate EMA
function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1]
  
  const multiplier = 2 / (period + 1)
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema
  }
  
  return ema
}

// Calculate ATR
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
  
  return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period
}

// Calculate Stochastic RSI
function calculateStochRSI(closes: number[], period: number = 14): { k: number; d: number } {
  const rsiValues: number[] = []
  for (let i = period; i < closes.length; i++) {
    rsiValues.push(calculateRSI(closes.slice(0, i + 1), period))
  }
  
  if (rsiValues.length < period) return { k: 50, d: 50 }
  
  const recentRSI = rsiValues.slice(-period)
  const currentRSI = recentRSI[recentRSI.length - 1]
  const minRSI = Math.min(...recentRSI)
  const maxRSI = Math.max(...recentRSI)
  
  const k = maxRSI === minRSI ? 50 : ((currentRSI - minRSI) / (maxRSI - minRSI)) * 100
  const d = rsiValues.slice(-3).reduce((a, b) => a + b, 0) / 3 // 3-period SMA of K
  
  return { k, d }
}

// Calculate VWAP
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
    // Fetch klines for indicator calculation with fallback
    const klines = await fetchKlinesWithFallback(symbol, interval, 200)
    
    const opens = klines.map((k: any[]) => parseFloat(k[1]))
    const highs = klines.map((k: any[]) => parseFloat(k[2]))
    const lows = klines.map((k: any[]) => parseFloat(k[3]))
    const closes = klines.map((k: any[]) => parseFloat(k[4]))
    const volumes = klines.map((k: any[]) => parseFloat(k[5]))
    
    const currentPrice = closes[closes.length - 1]
    const openPrice = opens[0]
    const priceChange = currentPrice - openPrice
    const priceChangePercent = (priceChange / openPrice) * 100
    
    const rsi = calculateRSI(closes)
    const macd = calculateMACD(closes)
    const atr = calculateATR(highs, lows, closes)
    const stochRSI = calculateStochRSI(closes)
    const vwap = calculateVWAP(highs, lows, closes, volumes)
    const vwapDeviation = ((currentPrice - vwap) / vwap) * 100
    
    // Simple trend detection
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
    const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length)
    const trend = currentPrice > sma20 && sma20 > sma50 ? 'UP' : 
                  currentPrice < sma20 && sma20 < sma50 ? 'DOWN' : 'NEUTRAL'

    return NextResponse.json({
      symbol,
      interval,
      price: currentPrice,
      open: openPrice,
      high: Math.max(...highs),
      low: Math.min(...lows),
      priceChange,
      priceChangePercent,
      volume: volumes.reduce((a, b) => a + b, 0),
      indicators: {
        rsi: Math.round(rsi * 100) / 100,
        rsiSignal: rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL',
        macd: Math.round(macd.macd * 100) / 100,
        macdSignal: Math.round(macd.signal * 100) / 100,
        macdHistogram: Math.round(macd.histogram * 100) / 100,
        macdTrend: macd.histogram > 0 ? 'BULLISH' : 'BEARISH',
        atr: Math.round(atr * 100) / 100,
        stochK: Math.round(stochRSI.k * 100) / 100,
        stochD: Math.round(stochRSI.d * 100) / 100,
        stochSignal: stochRSI.k > 80 ? 'OVERBOUGHT' : stochRSI.k < 20 ? 'OVERSOLD' : 'NEUTRAL',
        vwap: Math.round(vwap * 100) / 100,
        vwapDeviation: Math.round(vwapDeviation * 10000) / 10000,
        sma20: Math.round(sma20 * 100) / 100,
        sma50: Math.round(sma50 * 100) / 100,
        trend
      },
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Indicators calculation error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate indicators' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'

// Use Binance.US API which works in the US, fallback to global Binance
const BINANCE_US_API = 'https://api.binance.us/api/v3'
const BINANCE_GLOBAL_API = 'https://api.binance.com/api/v3'

async function fetchWithFallback(symbol: string, interval: string, limit: string): Promise<{ data: any[], isMock: boolean }> {
  // Try Binance.US first (works in US)
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
        return { data: await response.json(), isMock: false }
      }
    } catch {
      continue
    }
  }
  
  // Generate mock kline data when APIs are unavailable
  return { data: generateMockKlines(symbol, parseInt(limit)), isMock: true }
}

// Seeded random number generator for consistent mock data
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

// Generate realistic mock kline data for when APIs are unavailable
function generateMockKlines(symbol: string, limit: number): any[] {
  const now = Date.now()
  const intervalMs = 60000 // 1 minute
  
  // Base prices for different symbols
  const basePrices: { [key: string]: number } = {
    'BTCUSDT': 70200,
    'ETHUSDT': 3500,
    'SOLUSDT': 150,
    'BNBUSDT': 600,
  }
  
  const basePrice = basePrices[symbol] || 100
  const volatility = basePrice * 0.003 // 0.3% volatility per candle
  
  const klines: any[] = []
  
  // Calculate the start of the current minute interval
  const currentMinute = Math.floor(now / intervalMs) * intervalMs
  
  // First, calculate all historical closes using seeded random to get consistent price path
  const historicalCloses: number[] = []
  let price = basePrice
  for (let i = 0; i < limit - 1; i++) {
    const candleMinute = currentMinute - (limit - 1 - i) * intervalMs
    const seed = candleMinute / 1000 // Use seconds for seed
    const rand = seededRandom(seed)
    const change = (rand - 0.5) * volatility * 2
    price = price + change
    historicalCloses.push(price)
  }
  
  // Build klines with consistent historical data
  for (let i = 0; i < limit; i++) {
    const candleMinute = currentMinute - (limit - 1 - i) * intervalMs
    const seed = candleMinute / 1000
    const isCurrentCandle = i === limit - 1
    
    // Get open price (previous close or base price for first candle)
    const open = i === 0 ? basePrice : historicalCloses[i - 1]
    
    // For current candle, use real randomness with time-based variation
    let close: number
    if (isCurrentCandle) {
      // Add sub-second variation for live feel
      const secondsIntoCandle = (now % intervalMs) / 1000
      const liveVariation = (Math.sin(now / 500) * 0.5 + Math.random() * 0.5) * volatility
      close = open + liveVariation * (secondsIntoCandle / 60)
    } else {
      close = historicalCloses[i]
    }
    
    // Calculate high/low with seeded random for consistency
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || 'BTCUSDT'
  const interval = searchParams.get('interval') || '1m'
  const limit = searchParams.get('limit') || '100'

  try {
    const { data: klines, isMock } = await fetchWithFallback(symbol, interval, limit)
    
    // Transform kline data
    const transformed = klines.map((k: any[]) => ({
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
      quoteVolume: parseFloat(k[7]),
      trades: k[8],
    }))

    return NextResponse.json({ data: transformed, isMock })
  } catch (error) {
    console.error('Klines fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch klines' },
      { status: 500 }
    )
  }
}

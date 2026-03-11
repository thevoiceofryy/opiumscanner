import { NextResponse } from 'next/server'

// Use Binance.US API which works in the US, fallback to global Binance
const BINANCE_US_API = 'https://api.binance.us/api/v3'
const BINANCE_GLOBAL_API = 'https://api.binance.com/api/v3'

async function fetchWithFallback(symbol: string, interval: string, limit: string) {
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
        return await response.json()
      }
    } catch {
      continue
    }
  }
  
  throw new Error('All Binance APIs unavailable')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || 'BTCUSDT'
  const interval = searchParams.get('interval') || '1m'
  const limit = searchParams.get('limit') || '100'

  try {
    const klines = await fetchWithFallback(symbol, interval, limit)
    
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

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Klines fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch klines' },
      { status: 500 }
    )
  }
}

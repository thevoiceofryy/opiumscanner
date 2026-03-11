import { NextResponse } from 'next/server'

const BINANCE_API = 'https://api.binance.com/api/v3'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || 'BTCUSDT'
  const interval = searchParams.get('interval') || '1m'
  const limit = searchParams.get('limit') || '100'

  try {
    const response = await fetch(
      `${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 5 }
      }
    )

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`)
    }

    const klines = await response.json()
    
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
    console.error('Binance klines fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch klines' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// FIX: Binance Global first — Binance.US is slow/blocked in many environments
// and was causing noticeable delay on every page load
const APIS = [
  'https://api.binance.com/api/v3',
  'https://api.binance.us/api/v3',
]

async function fetchWithFallback(
  symbol: string,
  interval: string,
  limit: string
): Promise<{ data: any[]; isMock: boolean }> {
  for (const api of APIS) {
    try {
      // FIX: removed next:{ revalidate:5 } — was serving stale cached data
      // on first load. Now uses cache:'no-store' for always-fresh data.
      // Added AbortSignal timeout so a slow API fails fast instead of hanging.
      const controller = new AbortController()
      const timer      = setTimeout(() => controller.abort(), 3000)  // 3s timeout per API

      const response = await fetch(
        `${api}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
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

  return { data: generateMockKlines(symbol, parseInt(limit), interval), isMock: true }
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function generateMockKlines(symbol: string, limit: number, interval: string): any[] {
  const now         = Date.now()
  const intervalMap: Record<string, number> = {
    '1m':  60_000,
    '5m':  5  * 60_000,
    '15m': 15 * 60_000,
    '1h':  60 * 60_000,
    '4h':  4  * 60 * 60_000,
  }
  const intervalMs  = intervalMap[interval] ?? intervalMap['1m']
  const basePrices: Record<string, number> = {
    BTCUSDT: 70200,
    ETHUSDT: 3500,
    SOLUSDT: 150,
    BNBUSDT: 600,
  }
  const basePrice   = basePrices[symbol] || 100
  const volatility  = basePrice * 0.003
  const currentMin  = Math.floor(now / intervalMs) * intervalMs
  const historicalCloses: number[] = []
  let price = basePrice

  for (let i = 0; i < limit - 1; i++) {
    const candleMinute = currentMin - (limit - 1 - i) * intervalMs
    const rand         = seededRandom(candleMinute / 1000)
    price += (rand - 0.5) * volatility * 2
    historicalCloses.push(price)
  }

  return Array.from({ length: limit }, (_, i) => {
    const candleMinute  = currentMin - (limit - 1 - i) * intervalMs
    const seed          = candleMinute / 1000
    const isCurrentCandle = i === limit - 1
    const open  = i === 0 ? basePrice : historicalCloses[i - 1]
    let close: number
    if (isCurrentCandle) {
      const secondsIn = (now % intervalMs) / 1000
      close = open + (Math.sin(now / 500) * 0.5 + Math.random() * 0.5) * volatility * (secondsIn / 60)
    } else {
      close = historicalCloses[i]
    }
    const rand2  = isCurrentCandle ? Math.random() : seededRandom(seed + 0.1)
    const rand3  = isCurrentCandle ? Math.random() : seededRandom(seed + 0.2)
    const rand4  = isCurrentCandle ? Math.random() : seededRandom(seed + 0.3)
    const high   = Math.max(open, close) + rand2 * volatility * 0.5
    const low    = Math.min(open, close) - rand3 * volatility * 0.5
    const volume = rand4 * 1000 + 100
    return [
      candleMinute,
      open.toFixed(2),
      high.toFixed(2),
      low.toFixed(2),
      close.toFixed(2),
      volume.toFixed(2),
      candleMinute + intervalMs - 1,
      (volume * close).toFixed(2),
      Math.floor(rand4 * 100),
    ]
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol   = searchParams.get('symbol')   || 'BTCUSDT'
  const interval = searchParams.get('interval') || '1m'
  const limit    = searchParams.get('limit')    || '100'

  try {
    const { data: klines, isMock } = await fetchWithFallback(symbol, interval, limit)

    const transformed = (Array.isArray(klines) ? klines : []).map((k: any[]) => ({
      openTime:    k[0],
      open:        parseFloat(k[1]) || 0,
      high:        parseFloat(k[2]) || 0,
      low:         parseFloat(k[3]) || 0,
      close:       parseFloat(k[4]) || 0,
      volume:      parseFloat(k[5]) || 0,
      closeTime:   k[6],
      quoteVolume: parseFloat(k[7]) || 0,
      trades:      k[8] ?? 0,
    }))

    return NextResponse.json({ data: transformed, isMock })

  } catch (error) {
    console.warn('Klines error, returning mock:', (error as Error)?.message ?? error)
    const mock        = generateMockKlines(symbol, parseInt(limit, 10) || 100, interval)
    const transformed = mock.map((k: any[]) => ({
      openTime:    k[0],
      open:        parseFloat(k[1]) || 0,
      high:        parseFloat(k[2]) || 0,
      low:         parseFloat(k[3]) || 0,
      close:       parseFloat(k[4]) || 0,
      volume:      parseFloat(k[5]) || 0,
      closeTime:   k[6],
      quoteVolume: parseFloat(k[7]) || 0,
      trades:      k[8] ?? 0,
    }))
    return NextResponse.json({ data: transformed, isMock: true })
  }
}
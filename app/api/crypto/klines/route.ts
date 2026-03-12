import { NextResponse } from 'next/server'

const BINANCE_APIS = [
'https://api.binance.com/api/v3',
'https://api1.binance.com/api/v3',
'https://api2.binance.com/api/v3',
'https://api3.binance.com/api/v3',
'https://data-api.binance.vision/api/v3'
]

const COINBASE_API =
'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60'

async function safeFetch(url: string) {
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 5000)

try {
const res = await fetch(url, {
signal: controller.signal,
cache: 'no-store'
})


if (!res.ok) throw new Error('bad response')

return await res.json()


} finally {
clearTimeout(timeout)
}
}

async function fetchBinance(symbol: string, interval: string, limit: string) {
for (const api of BINANCE_APIS) {
try {
return await safeFetch(
`${api}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
)
} catch {
continue
}
}

throw new Error('binance failed')
}

async function fetchCoinbase() {
const data = await safeFetch(COINBASE_API)

return data.map((k: any[]) => ({
openTime: k[0] * 1000,
low: k[1],
high: k[2],
open: k[3],
close: k[4],
volume: k[5]
}))
}

export async function GET(request: Request) {

const { searchParams } = new URL(request.url)

const symbol = searchParams.get('symbol') || 'BTCUSDT'
const interval = searchParams.get('interval') || '1m'
const limit = searchParams.get('limit') || '100'

try {

const klines = await fetchBinance(symbol, interval, limit)

const transformed = klines.map((k: any[]) => ({
  openTime: k[0],
  open: parseFloat(k[1]),
  high: parseFloat(k[2]),
  low: parseFloat(k[3]),
  close: parseFloat(k[4]),
  volume: parseFloat(k[5]),
  closeTime: k[6],
  quoteVolume: parseFloat(k[7]),
  trades: k[8]
}))

return NextResponse.json(transformed)

} catch {

console.log('Binance failed → switching to Coinbase')

const coinbase = await fetchCoinbase()

return NextResponse.json(coinbase)

}

}

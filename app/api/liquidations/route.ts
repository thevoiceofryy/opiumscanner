import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const HL_API = 'https://api.hyperliquid.xyz/info'

async function fetchLeaderboard() {
const res = await fetch(HL_API, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
type: 'leaderboard',
req: { timeWindow: 'day' }
}),
cache: 'no-store',
})

if (!res.ok) {
console.error('Leaderboard failed:', res.status)
return []
}

const data = await res.json()
console.log("LEADERBOARD:", data)

// 🔥 IMPORTANT: return raw array
return Array.isArray(data) ? data : []
}

async function fetchWalletPositions(address: string) {
const res = await fetch(HL_API, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
type: 'clearinghouseState',
user: address,
}),
cache: 'no-store',
})

if (!res.ok) {
console.error('Wallet failed:', address)
return []
}

const data = await res.json()
return data?.assetPositions ?? []
}

export async function GET() {
try {
const leaderboard = await fetchLeaderboard()

// 🔥 FIXED WALLET EXTRACTION
const topWallets = leaderboard
  .slice(0, 30)
  .map((r: any) => r?.account?.address)
  .filter(Boolean)

console.log("WALLETS:", topWallets)

const allPositionsRaw = await Promise.allSettled(
  topWallets.map((addr: string) => fetchWalletPositions(addr))
)

const longs: any[] = []
const shorts: any[] = []

allPositionsRaw.forEach((result, i) => {
  if (result.status !== 'fulfilled') return

  const positions = result.value
  const wallet = topWallets[i]

  positions.forEach((p: any) => {
    const pos = p?.position
    if (!pos) return

    const szi = parseFloat(pos.szi || '0')
    const markPx = parseFloat(pos.markPx || '0')
    const liqPx = parseFloat(pos.liquidationPx || '0')

    const posValue = Math.abs(szi) * markPx

    // 🔥 LOWERED FILTER
    if (posValue < 100 || liqPx <= 0) return

    const isLong = szi > 0

    const distPct = isLong
      ? ((markPx - liqPx) / markPx * 100).toFixed(2)
      : ((liqPx - markPx) / markPx * 100).toFixed(2)

    const entry = {
      coin: pos.coin,
      wallet: wallet.slice(0, 6) + '...' + wallet.slice(-4),
      fullWallet: wallet,
      value: Math.round(posValue),
      liqPrice: liqPx.toFixed(4),
      markPrice: markPx.toFixed(4),
      entryPrice: parseFloat(pos.entryPx || '0').toFixed(4),
      distPct,
      leverage: pos.leverage?.value ? Math.round(pos.leverage.value) : null,
      leverageType: pos.leverage?.type ?? 'cross',
      pnl: parseFloat(pos.unrealizedPnl || '0').toFixed(2),
      size: Math.abs(szi),
    }

    if (isLong) longs.push(entry)
    else shorts.push(entry)
  })
})

longs.sort((a, b) => parseFloat(a.distPct) - parseFloat(b.distPct))
shorts.sort((a, b) => parseFloat(a.distPct) - parseFloat(b.distPct))

return NextResponse.json({
  longs: longs.slice(0, 50),
  shorts: shorts.slice(0, 50),
  walletsScanned: topWallets.length,
})

} catch (error) {
console.error('Liquidations error:', error)
return NextResponse.json(
{ error: 'Failed to fetch', details: String(error) },
{ status: 500 }
)
}
}

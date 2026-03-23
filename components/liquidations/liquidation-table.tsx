'use client'

import { useEffect, useState } from 'react'

interface LiqPosition {
coin: string
wallet: string
fullWallet: string
value: number
liqPrice: string
markPrice: string
entryPrice: string
distPct: string
leverage: number | null
leverageType: string
pnl: string
size: number
}

function formatValue(val: number): string {
if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`
return `$${val}`
}

function DistColor({ pct }: { pct: string }) {
const n = parseFloat(pct)
const color = n < 1 ? '#ef4444' : n < 3 ? '#f97316' : n < 5 ? '#eab308' : '#6b7280'
return <span style={{ color }} className="font-bold">{pct}%</span>
}

function PnlColor({ pnl }: { pnl: string }) {
const n = parseFloat(pnl)
const color = n >= 0 ? '#10b981' : '#ef4444'
return <span style={{ color }}>{n >= 0 ? '+' : ''}${n.toFixed(0)}</span>
}

export function LiquidationTable() {
const [data, setData] = useState<{
longs: LiqPosition[]
shorts: LiqPosition[]
walletsScanned?: number
} | null>(null)

const [loading, setLoading] = useState(true)
const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

const fetchData = async () => {
try {
const res = await fetch('/api/liquidations')
const json = await res.json()
setData(json)
setLastUpdate(new Date())
} catch {
} finally {
setLoading(false)
}
}

useEffect(() => {
fetchData()
const interval = setInterval(fetchData, 15000)
return () => clearInterval(interval)
}, [])

const columns = ( <div className="grid grid-cols-7 px-4 py-1.5 text-[9px] text-[#6b7280] border-b border-[#1a2332] uppercase"> <span>COIN</span> <span className="text-right">VALUE</span> <span className="text-right">ENTRY</span> <span className="text-right">LIQ</span> <span className="text-right">DIST</span> <span className="text-right">LEV</span> <span className="text-right">PNL</span> </div>
)

const renderRow = (pos: LiqPosition, i: number) => (
<div
key={i}
className="grid grid-cols-7 px-4 py-1.5 border-b border-[#1a2332]/50 hover:bg-[#1a2332]/30 transition-colors cursor-pointer"
onClick={() => window.open(`https://app.hyperliquid.xyz/explorer/address/${pos.fullWallet}`, '_blank')}
> <div className="flex flex-col"> <span className="text-white font-semibold">{pos.coin}</span> <span className="text-[8px] text-[#6b7280]">{pos.wallet}</span> </div> <span className="text-right text-[#9ca3af]">{formatValue(pos.value)}</span> <span className="text-right text-[#9ca3af]">${parseFloat(pos.entryPrice).toLocaleString()}</span> <span className="text-right text-[#9ca3af]">${parseFloat(pos.liqPrice).toLocaleString()}</span> <span className="text-right"><DistColor pct={pos.distPct} /></span> <span className="text-right text-[#6b7280]">
{pos.leverage ? `${pos.leverage}x` : 'cross'} </span> <span className="text-right"><PnlColor pnl={pos.pnl} /></span> </div>
)

return ( <div className="min-h-screen bg-[#0a0e14] text-[#e5e7eb] font-mono text-xs">


  {/* HEADER */}
  <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2332]">
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <span className="text-sm font-bold text-white">LIQUIDATION SCANNER</span>
    </div>

    <div className="flex items-center gap-3">
      {lastUpdate && (
        <span className="text-[10px] text-[#6b7280]">
          Updated {lastUpdate.toLocaleTimeString()}
        </span>
      )}

      <button
        onClick={fetchData}
        className="text-[10px] px-2 py-1 border border-[#1a2332] rounded hover:bg-[#1a2332]"
      >
        Refresh
      </button>

      <a
        href="/dashboard"
        className="text-[10px] px-2 py-1 border border-[#1a2332] rounded hover:bg-[#1a2332]"
      >
        Back
      </a>
    </div>
  </div>

  {/* BODY */}
  {loading ? (
    <div className="flex items-center justify-center h-64">
      Loading...
    </div>
  ) : (
    <div className="grid grid-cols-2 h-[calc(100vh-52px)]">

      {/* LONGS */}
      <div className="border-r border-[#1a2332] overflow-auto">
        <div className="px-4 py-2 text-emerald-400 font-bold">
          LONGS ({data?.longs?.length ?? 0})
        </div>

        {columns}

        {(data?.longs?.length ?? 0) === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No long positions
          </div>
        ) : (
          data?.longs?.map(renderRow)
        )}
      </div>

      {/* SHORTS */}
      <div className="overflow-auto">
        <div className="px-4 py-2 text-red-400 font-bold">
          SHORTS ({data?.shorts?.length ?? 0})
        </div>

        {columns}

        {(data?.shorts?.length ?? 0) === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No short positions
          </div>
        ) : (
          data?.shorts?.map(renderRow)
        )}
      </div>

    </div>
  )}
</div>

)
}

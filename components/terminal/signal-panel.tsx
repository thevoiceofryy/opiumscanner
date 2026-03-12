'use client'

import React, { useEffect, useState } from 'react'
import { TrendingUp, Target, Zap, Clock } from 'lucide-react'

interface SignalPanelProps {
  cryptoData: any
  marketPrices: { yes: number | null; no: number | null }
  selectedMarket: string | null
  klines: any[]
  priceToBeat: number
  btcPrice: number
  clobAskYes?: number | null
  clobAskNo?: number | null
  lastResult?: 'UP' | 'DOWN' | 'UNKNOWN'
  upRounds?: number
  downRounds?: number
}

export function SignalPanel({
  marketPrices,
  selectedMarket,
  priceToBeat,
  btcPrice,
  clobAskYes = null,
  clobAskNo = null,
  lastResult = 'UNKNOWN',
  upRounds = 0,
  downRounds = 0,
}: SignalPanelProps) {
  // 1. HYDRATION FIX: Keep time in state and update after mount
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  useEffect(() => {
    setLastUpdate(new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    }))
  }, [marketPrices]) // Updates whenever data refreshes

  const confidence = marketPrices?.yes !== null && marketPrices?.yes !== undefined 
    ? Math.round(marketPrices.yes) 
    : 0

  const target = priceToBeat || 0
  const targetFormatted = target > 0
    ? target.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    : null

  // 2. ENTRY WINDOW TIMER (15m buckets)
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    const updateRemaining = () => {
      const now = Date.now()
      const bucketMs = 15 * 60 * 1000
      const bucketStart = Math.floor(now / bucketMs) * bucketMs
      const bucketEnd = bucketStart + bucketMs
      const secs = Math.max(0, Math.floor((bucketEnd - now) / 1000))
      setRemaining(secs)
    }

    updateRemaining()
    const id = setInterval(updateRemaining, 1000)
    return () => clearInterval(id)
  }, [])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  // 3. SIMPLE POSITION CALCULATOR
  const [risk, setRisk] = useState<string>('50')
  const [side, setSide] = useState<'yes' | 'no'>('yes')

  const fallbackYes = confidence / 100
  const fallbackNo = 1 - fallbackYes

  // Use Polymarket CLOB best ask when available (matches trade panel more closely)
  const priceYes = typeof clobAskYes === 'number' ? clobAskYes : fallbackYes
  const priceNo = typeof clobAskNo === 'number' ? clobAskNo : fallbackNo

  const activePrice = side === 'yes' ? priceYes : priceNo

  const parsedRisk = parseFloat(risk) || 0
  const shares =
    activePrice > 0 ? parsedRisk / activePrice : 0

  // 4. WIN/LOSS ANIMATION when lastResult changes
  const [flash, setFlash] = useState<'UP' | 'DOWN' | 'NONE'>('NONE')

  useEffect(() => {
    if (lastResult === 'UP' || lastResult === 'DOWN') {
      setFlash(lastResult)
      const id = setTimeout(() => setFlash('NONE'), 1200)
      return () => clearTimeout(id)
    }
  }, [lastResult])

  return (
    <div className="flex flex-col h-full bg-card p-3 space-y-4 overflow-y-auto">
      {/* Header + compact last-round info */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className={`w-3 h-3 ${target > 0 ? 'text-primary animate-pulse' : 'text-muted'}`} />
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Active Prediction
            </h2>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <span className="opacity-70">Last:</span>
            <span
              className={`px-1.5 py-0.5 rounded ${
                lastResult === 'UP'
                  ? 'bg-bullish/20 text-bullish'
                  : lastResult === 'DOWN'
                  ? 'bg-bearish/20 text-bearish'
                  : 'bg-muted/30 text-muted-foreground'
              }`}
            >
              {lastResult === 'UNKNOWN' ? 'PENDING' : lastResult}
            </span>
            <span>
              {upRounds}↑ / {downRounds}↓
            </span>
          </div>
        </div>
        <div className="text-sm font-mono font-bold text-primary leading-tight line-clamp-2">
          {selectedMarket || 'Scanning Live BTC Markets...'}
        </div>
      </div>

      <div className="relative flex items-center justify-center py-2">
        <svg className="w-32 h-32 transform -rotate-90 drop-shadow-[0_0_8px_rgba(var(--primary),0.2)]">
          <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted/10" />
          <circle
            cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent"
            strokeDasharray={364.4}
            strokeDashoffset={364.4 - (364.4 * confidence) / 100}
            strokeLinecap="round"
            className={`${confidence >= 50 ? 'text-bullish' : 'text-bearish'} transition-all duration-1000 ease-in-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-mono font-bold tracking-tighter">{confidence}%</span>
          <span className="text-[9px] uppercase text-muted-foreground font-bold">Confidence</span>
        </div>
      </div>

      {/* Live target card removed per design */}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col p-3 bg-muted/20 rounded border border-border/40">
          <span className="text-[9px] text-muted-foreground uppercase font-bold mb-1">YES Probability</span>
          <span className="text-xl font-mono font-bold text-bullish">{confidence}%</span>
        </div>
        <div className="flex flex-col p-3 bg-muted/20 rounded border border-border/40">
          <span className="text-[9px] text-muted-foreground uppercase font-bold mb-1">NO Probability</span>
          <span className="text-xl font-mono font-bold text-bearish">{target > 0 ? 100 - confidence : 0}%</span>
        </div>
      </div>

      {/* ENTRY WINDOW */}
      <div
        className={`p-3 rounded border border-border/40 bg-muted/10 space-y-2 relative overflow-hidden ${
          flash === 'UP'
            ? 'ring-2 ring-bullish/60 animate-pulse'
            : flash === 'DOWN'
            ? 'ring-2 ring-bearish/60 animate-pulse'
            : ''
        }`}
      >
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/40">
            ENTRY WINDOW OPEN
          </span>
          <span className="text-muted-foreground">15m cycle</span>
        </div>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-mono font-bold">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            min remaining
          </span>
        </div>
        <div className="w-full h-1.5 rounded bg-muted overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{
              width: `${((15 * 60 - remaining) / (15 * 60)) * 100}%`
            }}
          />
        </div>
      </div>

      {/* CALCULATOR (compact) */}
      <div className="p-2 rounded border border-border/40 bg-muted/5 space-y-2">
        <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest mb-1">
          Calculator
        </div>
        <div className="text-[9px] text-muted-foreground font-mono">
          Pricing: {typeof clobAskYes === 'number' || typeof clobAskNo === 'number' ? 'CLOB best ask' : 'implied %'}
        </div>
        <div className="flex gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => setSide('yes')}
            className={`flex-1 px-2 py-0.5 rounded border text-center font-mono ${
              side === 'yes'
                ? 'bg-bullish/20 border-bullish text-bullish'
                : 'border-border/40 text-muted-foreground hover:bg-bullish/5'
            }`}
          >
            YES
          </button>
          <button
            type="button"
            onClick={() => setSide('no')}
            className={`flex-1 px-2 py-0.5 rounded border text-center font-mono ${
              side === 'no'
                ? 'bg-bearish/20 border-bearish text-bearish'
                : 'border-border/40 text-muted-foreground hover:bg-bearish/5'
            }`}
          >
            NO
          </button>
        </div>
        <div className="space-y-1">
          <label className="flex items-center justify-between text-[9px] text-muted-foreground uppercase">
            <span>Risk ($)</span>
          </label>
          <input
            type="number"
            min="0"
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            className="w-full px-2 py-0.5 rounded bg-background border border-border/40 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-muted-foreground">Shares</span>
          <span className="font-bold">
            {shares > 0 ? shares.toFixed(1) : '0.0'} {side.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
          <span>Implied</span>
          <span>
            {activePrice > 0 ? (activePrice * 100).toFixed(1) : '0.0'}¢
          </span>
        </div>
      </div>

      <div className="pt-2 mt-auto border-t border-border/20 flex justify-between items-center opacity-50">
        <div className="flex items-center gap-1 text-[9px] uppercase font-bold tracking-tighter">
          <Clock className="w-2.5 h-2.5" />
          Live Scan Active
        </div>
        {/* Only render time if it exists (client-side only) */}
        <span className="text-[9px] font-mono">{lastUpdate || '--:--:--'}</span>
      </div>
    </div>
  )
}
'use client'

import React, { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Target, Zap, Clock } from 'lucide-react'

interface SignalPanelProps {
  cryptoData: any
  marketPrices: { yes: number | null; no: number | null }
  selectedMarket: string | null
  klines: any[]
  priceToBeat: number
  btcPrice: number
}

export function SignalPanel({
  marketPrices,
  selectedMarket,
  priceToBeat,
  btcPrice
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
  const isAboveTarget = btcPrice >= target
  
  const distance = Math.abs(btcPrice - target).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return (
    <div className="flex flex-col h-full bg-card p-4 space-y-6 overflow-y-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Target className={`w-3 h-3 ${target > 0 ? 'text-primary animate-pulse' : 'text-muted'}`} />
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Active Prediction
          </h2>
        </div>
        <div className="text-sm font-mono font-bold text-primary leading-tight min-h-[2.5rem]">
          {selectedMarket || "Scanning Live BTC Markets..."}
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

      <div className={`p-3 rounded border transition-all duration-500 ${
        target === 0 
          ? 'bg-muted/5 border-muted/20 text-muted-foreground'
          : isAboveTarget 
            ? 'bg-bullish/5 border-bullish/20 text-bullish' 
            : 'bg-bearish/5 border-bearish/20 text-bearish'
      }`}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
            <Zap className={`w-3 h-3 ${target > 0 ? 'fill-current' : 'text-muted'}`} />
            <span className="text-[10px] uppercase font-black tracking-widest">Live Status</span>
          </div>
          {target > 0 && (isAboveTarget ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />)}
        </div>
        <div className="text-[11px] font-mono leading-relaxed">
          {target > 0 ? (
            <>BTC IS <span className="font-bold underline">${distance}</span> {isAboveTarget ? 'ABOVE' : 'BELOW'} TARGET</>
          ) : (
            <span className="opacity-50 italic animate-pulse">Syncing target price...</span>
          )}
        </div>
      </div>

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
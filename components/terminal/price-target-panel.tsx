'use client'

import { useMemo, useState, useEffect } from 'react'
import { Target, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { Kline, CryptoData } from '@/lib/types'

interface PriceTargetPanelProps {
  klines: Kline[]
  cryptoData: CryptoData | null
}

export function PriceTargetPanel({ klines, cryptoData }: PriceTargetPanelProps) {
  const [countdown, setCountdown] = useState('')
  
  // Update countdown every second
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const minutes = now.getMinutes()
      const seconds = now.getSeconds()
      
      // Time until next 15-minute mark
      const nextMark = Math.ceil((minutes + 1) / 15) * 15
      const minutesLeft = (nextMark - minutes - 1 + 60) % 60
      const secondsLeft = 59 - seconds
      
      setCountdown(`${minutesLeft.toString().padStart(2, '0')}:${secondsLeft.toString().padStart(2, '0')}`)
    }
    
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [])

  // Calculate price targets
  const targets = useMemo(() => {
    if (!cryptoData || klines.length === 0) return null
    
    const currentPrice = cryptoData.price
    const atr = cryptoData.indicators.atr
    const open = klines[0].open
    
    // High and low targets based on ATR
    const targetHigh = currentPrice + atr * 1.5
    const targetLow = currentPrice - atr * 1.5
    
    // Distance from open
    const fromOpen = ((currentPrice - open) / open * 100).toFixed(1)
    const fromOpenDirection = currentPrice >= open ? 'above' : 'below'
    
    // Target distance
    const toHighTarget = ((targetHigh - currentPrice) / currentPrice * 100).toFixed(2)
    const toLowTarget = ((currentPrice - targetLow) / currentPrice * 100).toFixed(2)
    
    return {
      current: currentPrice,
      high: targetHigh,
      low: targetLow,
      open,
      fromOpen,
      fromOpenDirection,
      toHighTarget,
      toLowTarget
    }
  }, [cryptoData, klines])

  // Prepare chart data - last 20 candles
  const chartData = useMemo(() => {
    const recentKlines = klines.slice(-20)
    return recentKlines.map(k => ({
      time: new Date(k.openTime).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      price: k.close,
      high: k.high,
      low: k.low
    }))
  }, [klines])

  if (!targets) {
    return (
      <div className="p-3 flex items-center justify-center h-full">
        <span className="text-muted-foreground text-sm">Loading targets...</span>
      </div>
    )
  }

  const isAboveOpen = targets.fromOpenDirection === 'above'

  return (
    <div className="h-full flex flex-col p-2">
      {/* Header with prices */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-warning" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Price Target</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground">{countdown}</span>
        </div>
      </div>

      {/* Price display */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="p-2 bg-secondary/30 rounded border border-border">
          <div className="text-[10px] text-muted-foreground uppercase">Open</div>
          <div className="text-sm font-semibold">${targets.open.toLocaleString()}</div>
        </div>
        <div className="p-2 bg-secondary/30 rounded border border-border">
          <div className="text-[10px] text-muted-foreground uppercase">Current</div>
          <div className={`text-sm font-semibold ${isAboveOpen ? 'text-bullish' : 'text-bearish'}`}>
            ${targets.current.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Mini chart */}
      <div className="flex-1 min-h-0 mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop 
                  offset="0%" 
                  stopColor={isAboveOpen ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))'} 
                  stopOpacity={0.3}
                />
                <stop 
                  offset="100%" 
                  stopColor={isAboveOpen ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))'} 
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              interval="preserveEnd"
            />
            <YAxis 
              domain={['auto', 'auto']}
              orientation="right"
              tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={50}
              tickFormatter={(v) => v.toLocaleString()}
            />
            <ReferenceLine 
              y={targets.high} 
              stroke="hsl(var(--bullish))" 
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{ 
                value: `target ${targets.high.toFixed(2)}`, 
                fontSize: 8, 
                fill: 'hsl(var(--bullish))',
                position: 'right'
              }}
            />
            <ReferenceLine 
              y={targets.low} 
              stroke="hsl(var(--bearish))" 
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke={isAboveOpen ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))'}
              fill="url(#priceGradient)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* From open indicator */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          {isAboveOpen ? (
            <TrendingUp className="w-3 h-3 text-bullish" />
          ) : (
            <TrendingDown className="w-3 h-3 text-bearish" />
          )}
          <span className={isAboveOpen ? 'text-bullish' : 'text-bearish'}>
            {targets.fromOpen}% from open
          </span>
        </div>
        <span className={`${isAboveOpen ? 'text-bearish' : 'text-bullish'}`}>
          {isAboveOpen ? `${targets.toLowTarget}%` : `${targets.toHighTarget}%`} to target
        </span>
      </div>
    </div>
  )
}

'use client'

import { useMemo, useState, useEffect } from 'react'
import { Target, TrendingUp, TrendingDown, Clock, ArrowUp, ArrowDown } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { Kline, CryptoData, MarketPrice } from '@/lib/types'

interface PriceTargetPanelProps {
  klines: Kline[]
  cryptoData: CryptoData | null
  yesPrices?: MarketPrice | null
  priceToBeat?: number | null
}

export function PriceTargetPanel({ klines, cryptoData, yesPrices, priceToBeat: propPriceToBeat }: PriceTargetPanelProps) {
  const [countdown, setCountdown] = useState('')
  const [previousPrice, setPreviousPrice] = useState<number | null>(null)
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(null)
  const [showPriceFlash, setShowPriceFlash] = useState(false)
  
  // Track price changes and show animation
  useEffect(() => {
    if (!cryptoData) return
    
    const currentPrice = cryptoData.price
    
    if (previousPrice !== null && previousPrice !== currentPrice) {
      // Price changed, show animation
      if (currentPrice > previousPrice) {
        setPriceDirection('up')
      } else {
        setPriceDirection('down')
      }
      
      // Flash animation
      setShowPriceFlash(true)
      const timer = setTimeout(() => setShowPriceFlash(false), 300)
      
      // Reset direction animation after 500ms
      const directionTimer = setTimeout(() => setPriceDirection(null), 500)
      
      return () => {
        clearTimeout(timer)
        clearTimeout(directionTimer)
      }
    }
    
    setPreviousPrice(currentPrice)
  }, [cryptoData?.price])
  
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
    
    // Use provided priceToBeat or fall back to current period's open
    // propPriceToBeat comes from marketDetails API call
    const priceToBeat = propPriceToBeat !== null && propPriceToBeat !== undefined ? propPriceToBeat : open
    
    // Debug: log if we're using fallback
    if (!propPriceToBeat) {
      console.debug('Using open price as priceToBeat fallback:', open)
    }
    
    // High and low targets based on ATR from the price to beat
    const targetHigh = priceToBeat + atr * 1.5
    const targetLow = priceToBeat - atr * 1.5
    
    // Distance from open
    const fromOpen = ((currentPrice - open) / open * 100).toFixed(1)
    const fromOpenDirection = currentPrice >= open ? 'above' : 'below'
    
    // Target distance
    const toHighTarget = ((targetHigh - currentPrice) / currentPrice * 100).toFixed(2)
    const toLowTarget = ((currentPrice - targetLow) / currentPrice * 100).toFixed(2)
    
    // Extract Polymarket YES/NO prices for display
    const polymarketYesPrice = yesPrices?.midPrice || null
    const polymarketNoPrice = yesPrices ? (1 - yesPrices.midPrice) : null
    
    return {
      current: currentPrice,
      priceToBeat: priceToBeat,
      high: targetHigh,
      low: targetLow,
      open,
      fromOpen,
      fromOpenDirection,
      toHighTarget,
      toLowTarget,
      polymarketYesPrice,
      polymarketNoPrice
    }
  }, [cryptoData, klines, yesPrices, propPriceToBeat])

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
      <div className="space-y-2 mb-2">
        {/* Current Live Price - Prominent with Animation */}
        <div className={`p-2 rounded border transition-all duration-300 ${
          showPriceFlash 
            ? 'bg-secondary border-primary' 
            : 'bg-secondary/50 border-border'
        }`}>
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-muted-foreground uppercase">Current Price (Live)</div>
            {priceDirection && (
              <div className={`transition-all duration-300 ${
                priceDirection === 'up' ? 'text-bullish animate-pulse' : 'text-bearish animate-pulse'
              }`}>
                {priceDirection === 'up' ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
              </div>
            )}
          </div>
          <div className={`text-lg font-bold transition-all duration-300 ${
            isAboveOpen ? 'text-bullish' : 'text-bearish'
          }`}>
            ${targets.current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Price to Beat and Target High */}
        <div className="grid grid-cols-2 gap-1">
          <div className="p-2 bg-secondary/30 rounded border border-border">
            <div className="text-[9px] text-muted-foreground uppercase">Price to Beat</div>
            <div className="text-sm font-semibold">${targets.priceToBeat.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            {propPriceToBeat && (
              <div className="text-[8px] text-bullish mt-0.5">15m Close</div>
            )}
          </div>
          <div className="p-2 bg-secondary/30 rounded border border-border">
            <div className="text-[9px] text-muted-foreground uppercase">Target High</div>
            <div className="text-sm font-semibold text-bullish">${targets.high.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          </div>
        </div>

        {/* Polymarket Prices */}
        {targets.polymarketYesPrice !== null && (
          <div className="p-2 bg-secondary/30 rounded border border-border">
            <div className="text-[9px] text-muted-foreground uppercase">Polymarket Odds</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-bullish">YES {(targets.polymarketYesPrice * 100).toFixed(0)}c</span>
              {targets.polymarketNoPrice !== null && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-bearish">NO {(targets.polymarketNoPrice * 100).toFixed(0)}c</span>
                </>
              )}
            </div>
          </div>
        )}
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

      {/* From open indicator and distance to target */}
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
        <span className="text-bullish">
          {targets.toHighTarget}% to target
        </span>
      </div>
    </div>
  )
}

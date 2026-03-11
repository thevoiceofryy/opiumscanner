'use client'

import { useMemo, useState, useEffect } from 'react'
import { 
  AreaChart, 
  Area,
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid
} from 'recharts'
import { extractPriceTargetFromMarket } from '@/lib/utils'
import type { Kline, CryptoData, Market } from '@/lib/types'

interface PriceChartProps {
  data: Kline[]
  symbol: string
  interval: string
  cryptoData?: CryptoData | null
  selectedMarket?: Market | null
  priceToBeat?: number | null
}

export function PriceChart({ data, symbol, interval, cryptoData, selectedMarket, priceToBeat }: PriceChartProps) {
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [priceUpdateTime, setPriceUpdateTime] = useState<Date | null>(null)
  const [previousPrice, setPreviousPrice] = useState<number | null>(null)
  const [priceFlash, setPriceFlash] = useState(false)
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(null)

  // Update live price from cryptoData every second
  useEffect(() => {
    if (!cryptoData?.price) return

    const timers: NodeJS.Timeout[] = []

    setLivePrice(prev => {
      if (prev !== null && prev !== cryptoData.price) {
        // Price changed
        if (cryptoData.price > prev) {
          setPriceDirection('up')
        } else {
          setPriceDirection('down')
        }
        
        // Flash animation
        setPriceFlash(true)
        const flashTimer = setTimeout(() => setPriceFlash(false), 400)
        timers.push(flashTimer)
        
        // Reset direction animation
        const directionTimer = setTimeout(() => setPriceDirection(null), 600)
        timers.push(directionTimer)
        
        return cryptoData.price
      }
      return prev ?? cryptoData.price
    })

    setPreviousPrice(cryptoData.price)
    setPriceUpdateTime(new Date())

    // Cleanup timers
    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [cryptoData?.price])

  // Also update from data changes
  useEffect(() => {
    if (data && data.length > 0 && !cryptoData?.price) {
      const latestPrice = typeof data[data.length - 1].close === 'number' 
        ? data[data.length - 1].close 
        : parseFloat(String(data[data.length - 1].close))
      setLivePrice(latestPrice)
      setPriceUpdateTime(new Date())
    }
  }, [data])

  // Periodic time indicator update
  useEffect(() => {
    const timer = setInterval(() => {
      setPriceUpdateTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    return data.slice(-100).map((kline, idx) => {
      const closePrice = typeof kline.close === 'number' ? kline.close : parseFloat(String(kline.close))
      return {
        idx,
        time: new Date(kline.openTime).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        price: closePrice,
        open: typeof kline.open === 'number' ? kline.open : parseFloat(String(kline.open)),
        high: typeof kline.high === 'number' ? kline.high : parseFloat(String(kline.high)),
        low: typeof kline.low === 'number' ? kline.low : parseFloat(String(kline.low)),
        close: closePrice,
      }
    })
  }, [data])

  const currentPrice = livePrice !== null ? livePrice : (data.length > 0 ? (typeof data[data.length - 1].close === 'number' ? data[data.length - 1].close : parseFloat(String(data[data.length - 1].close))) : 0)
  const firstPrice = data.length > 0 ? (typeof data[0].open === 'number' ? data[0].open : parseFloat(String(data[0].open))) : 0
  const priceChange = currentPrice - firstPrice
  const priceChangePercent = firstPrice !== 0 ? (priceChange / firstPrice) * 100 : 0
  const isPositive = priceChange >= 0

  const priceRange = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 100 }
    const allPrices = data.flatMap(k => {
      const h = typeof k.high === 'number' ? k.high : parseFloat(String(k.high))
      const l = typeof k.low === 'number' ? k.low : parseFloat(String(k.low))
      return [h, l]
    })
    const min = Math.min(...allPrices)
    const max = Math.max(...allPrices)
    const padding = (max - min) * 0.1
    return { min: min - padding, max: max + padding }
  }, [data])

  // Calculate price targets
  const targets = useMemo(() => {
    // If we have a selected market, extract the price target from it
    if (selectedMarket) {
      const marketPriceTarget = extractPriceTargetFromMarket(selectedMarket.question)
      if (marketPriceTarget !== null) {
        return {
          high: marketPriceTarget,
          low: currentPrice - (Math.abs(marketPriceTarget - currentPrice) * 1.5) // Support at 1.5x the distance
        }
      }
    }
    
    // Otherwise fall back to ATR-based targets
    if (!cryptoData || data.length === 0) return null
    
    const atr = cryptoData.indicators?.atr || 0
    const targetHigh = currentPrice + atr * 1.5
    const targetLow = currentPrice - atr * 1.5
    
    return {
      high: targetHigh,
      low: targetLow
    }
  }, [cryptoData, currentPrice, data, selectedMarket])

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{symbol}</span>
            <span className="px-1.5 py-0.5 text-xs bg-secondary rounded">{interval}</span>
          </div>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
            <span className="text-sm text-muted-foreground">Fetching {symbol} data...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-card animate-in fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">{symbol}</span>
          <span className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded">{interval}</span>
          {priceUpdateTime && (
            <span className="text-[10px] text-muted-foreground animate-pulse">
              🔴 {priceUpdateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6">
          {/* Current Price */}
          <div className="text-right">
            <div className={`text-2xl font-bold transition-all duration-300 ${
              priceFlash ? 'animate-price-flash' : ''
            } ${
              priceDirection === 'up' ? 'text-green-500 animate-pulse' : priceDirection === 'down' ? 'text-red-500 animate-pulse' : isPositive ? 'text-green-500' : 'text-red-500'
            }`}>
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={`text-sm font-semibold transition-all duration-500 ease-out ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </div>
          </div>

          {/* Price to Beat */}
          {priceToBeat !== null && priceToBeat !== undefined && (
            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-1">
                  Price to Beat
                </div>
                <div className="text-lg font-bold text-foreground">
                  ${priceToBeat.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentPrice > priceToBeat ? '+' : '-'}${Math.abs(currentPrice - priceToBeat).toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 min-h-0 w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 0, bottom: 20 }}
              syncId="priceChart"
            >
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={isPositive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={true} />
              <XAxis 
                dataKey="time"
                height={30}
                tick={{ fontSize: 11, fill: '#ffffff' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                interval={Math.max(0, Math.floor(chartData.length / 8))}
              />
              <YAxis 
                domain={[Math.floor(priceRange.min), Math.ceil(priceRange.max)]}
                width={70}
                tick={{ fontSize: 11, fill: '#ffffff' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                tickFormatter={(value) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  padding: '10px',
                }}
                formatter={(value: number) => [
                  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  'Price'
                ]}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '4 4' }}
              />
              {priceToBeat !== null && priceToBeat !== undefined && (
                <ReferenceLine 
                  y={priceToBeat}
                  stroke="#22c55e"
                  strokeDasharray="5 5"
                  strokeWidth={3}
                  ifOverflow="extendDomain"
                  label={{
                    value: `Price to Beat: $${priceToBeat.toFixed(0)}`,
                    position: 'right',
                     fill: '#ffffff',
                      fontSize: 13,
                       fontWeight: 'bold',
                     offset: 15
}}
                />
              )}
              <Area
                type="natural"
                dataKey="price"
                stroke={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorPrice)"
                isAnimationActive={true}
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-muted-foreground">No data available</span>
          </div>
        )}
      </div>
    </div>
  )
}

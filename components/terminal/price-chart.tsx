'use client'

import { useMemo } from 'react'
import { 
  ComposedChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts'
import type { Kline } from '@/lib/types'

interface PriceChartProps {
  data: Kline[]
  symbol: string
  interval: string
}

export function PriceChart({ data, symbol, interval }: PriceChartProps) {
  const chartData = useMemo(() => {
    return data.map((kline, index) => {
      const isGreen = kline.close >= kline.open
      return {
        time: new Date(kline.openTime).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        isGreen,
        // For candlestick visualization
        body: [Math.min(kline.open, kline.close), Math.max(kline.open, kline.close)],
        wick: [kline.low, kline.high],
        index
      }
    })
  }, [data])

  const currentPrice = data.length > 0 ? data[data.length - 1].close : 0
  const priceChange = data.length > 1 ? currentPrice - data[0].open : 0
  const priceChangePercent = data.length > 1 ? (priceChange / data[0].open) * 100 : 0
  const isPositive = priceChange >= 0

  const priceRange = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 100 }
    const prices = data.flatMap(k => [k.high, k.low])
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const padding = (max - min) * 0.05
    return { min: min - padding, max: max + padding }
  }, [data])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{symbol}</span>
          <span className="px-1.5 py-0.5 text-xs bg-secondary rounded">{interval}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className={`text-sm ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
            {isPositive ? '+' : ''}{priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
          </span>
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={[priceRange.min, priceRange.max]}
              orientation="right"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              tickFormatter={(value) => value.toLocaleString()}
              width={70}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload
                return (
                  <div className="bg-popover border border-border rounded p-2 text-xs">
                    <div className="text-muted-foreground">{d.time}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                      <span className="text-muted-foreground">O:</span>
                      <span>${d.open.toLocaleString()}</span>
                      <span className="text-muted-foreground">H:</span>
                      <span>${d.high.toLocaleString()}</span>
                      <span className="text-muted-foreground">L:</span>
                      <span>${d.low.toLocaleString()}</span>
                      <span className="text-muted-foreground">C:</span>
                      <span className={d.isGreen ? 'text-bullish' : 'text-bearish'}>${d.close.toLocaleString()}</span>
                    </div>
                  </div>
                )
              }}
            />
            <ReferenceLine 
              y={currentPrice} 
              stroke={isPositive ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))'} 
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            {/* Candlestick bodies */}
            <Bar 
              dataKey="body" 
              barSize={6}
              shape={(props: any) => {
                const { x, y, width, height, payload } = props
                const color = payload.isGreen ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))'
                return (
                  <g>
                    {/* Wick */}
                    <line 
                      x1={x + width / 2} 
                      y1={y - (payload.high - payload.body[1]) * (height / (payload.body[1] - payload.body[0] || 1))}
                      x2={x + width / 2}
                      y2={y + height + (payload.body[0] - payload.low) * (height / (payload.body[1] - payload.body[0] || 1))}
                      stroke={color}
                      strokeWidth={1}
                    />
                    {/* Body */}
                    <rect 
                      x={x} 
                      y={y} 
                      width={width} 
                      height={Math.max(height, 1)} 
                      fill={color}
                      rx={1}
                    />
                  </g>
                )
              }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.isGreen ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))'} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

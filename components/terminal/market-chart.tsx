'use client'

import { useMemo } from 'react'
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { Calendar, TrendingUp, DollarSign } from 'lucide-react'
import type { Market } from '@/lib/types'
import type { MarketHistoryPoint } from '@/hooks/use-market-data'

interface MarketChartProps {
  market: Market
  history: MarketHistoryPoint[]
  yesPriceNum: number
  noPriceNum: number
}

export function MarketChart({ market, history, yesPriceNum, noPriceNum }: MarketChartProps) {
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return []
    
    return history.map((point, idx) => ({
      idx,
      time: new Date(point.timestamp).toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
      }),
      fullTime: new Date(point.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      price: point.price * 100, // Convert to percentage
    }))
  }, [history])

  const currentPrice = yesPriceNum > 0 ? yesPriceNum * 100 : (chartData.length > 0 ? chartData[chartData.length - 1].price : 50)
  const firstPrice = chartData.length > 0 ? chartData[0].price : 50
  const priceChange = currentPrice - firstPrice
  const isPositive = priceChange >= 0

  // Format volume
  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`
    return `$${vol.toFixed(0)}`
  }

  // Format end date
  const formatEndDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm text-muted-foreground truncate">{market.question}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
            <span className="text-sm text-muted-foreground">Loading market data...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-card animate-in fade-in">
      {/* Market Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Market Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {market.image && (
                <img 
                  src={market.image} 
                  alt="" 
                  className="w-10 h-10 rounded-lg object-cover"
                />
              )}
              <h2 className="text-lg font-semibold text-foreground truncate">
                {market.question}
              </h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                <span>Vol: {formatVolume(market.volume)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatEndDate(market.endDate)}</span>
              </div>
            </div>
          </div>

          {/* Right: Probability Display */}
          <div className="text-right">
            <div className={`text-3xl font-bold ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
              {currentPrice.toFixed(0)}%
              <span className="text-lg ml-1 text-muted-foreground">chance</span>
            </div>
            <div className={`text-sm font-medium ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
              <TrendingUp className={`w-3 h-3 inline mr-1 ${!isPositive ? 'rotate-180' : ''}`} />
              {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* YES/NO Price Buttons */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <button className="flex-1 py-2.5 px-4 rounded-lg bg-bullish/20 border border-bullish text-bullish font-semibold text-sm hover:bg-bullish/30 transition-colors">
          Yes {(yesPriceNum * 100).toFixed(0)}c
        </button>
        <button className="flex-1 py-2.5 px-4 rounded-lg bg-bearish/20 border border-bearish text-bearish font-semibold text-sm hover:bg-bearish/30 transition-colors">
          No {(noPriceNum * 100).toFixed(0)}c
        </button>
      </div>
      
      {/* Chart */}
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
          >
            <defs>
              <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148, 163, 184, 0.2)"
              vertical={false}
            />
            <XAxis 
              dataKey="time"
              height={30}
              tick={{ fontSize: 11, fill: 'rgba(148, 163, 184, 0.9)' }}
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }}
              tickLine={false}
              interval={Math.max(0, Math.floor(chartData.length / 6))}
            />
            <YAxis 
              domain={[0, 100]}
              width={50}
              tick={{ fontSize: 11, fill: 'rgba(148, 163, 184, 0.9)' }}
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                padding: '10px',
              }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Probability']}
              labelFormatter={(_, payload) => payload[0]?.payload?.fullTime || ''}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '4 4' }}
            />
            {/* 50% reference line */}
            <ReferenceLine 
              y={50}
              stroke="rgba(148, 163, 184, 0.5)"
              strokeDasharray="5 5"
              strokeWidth={1}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorProb)"
              isAnimationActive={true}
              animationDuration={600}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Time Range Selector */}
      <div className="px-4 py-2 border-t border-border flex items-center justify-center gap-2">
        {['1H', '6H', '1D', '1W', '1M', 'ALL'].map((range) => (
          <button
            key={range}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              range === 'ALL'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  )
}

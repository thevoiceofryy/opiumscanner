'use client'

import { useMemo, useState, useEffect } from 'react'

import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'

import type { Kline, CryptoData, Market } from '@/lib/types'

interface PriceChartProps {
  data: Kline[]
  symbol: string
  interval: string
  cryptoData?: CryptoData | null
  selectedMarket?: Market | null
  priceToBeat?: number | null
  livePrice?: number | null
}

export function PriceChart({
  data,
  symbol,
  interval,
  cryptoData,
  priceToBeat,
  livePrice
}: PriceChartProps) {

  const [priceUpdateTime, setPriceUpdateTime] = useState<Date | null>(null)

  /*
  SAFE PRICE ENGINE
  Prevents $0.00 bug
  */

  const candlePrice = Number(data[data.length - 1]?.close ?? 0)

  const currentPrice =
    livePrice && livePrice > 1000
      ? livePrice
      : cryptoData?.price && cryptoData.price > 1000
      ? cryptoData.price
      : candlePrice

  // Use the live BTC price for the main display; show Polymarket target separately
  const displayPrice = currentPrice


  useEffect(() => {
    if (!currentPrice) return
    setPriceUpdateTime(new Date())
  }, [currentPrice])


  const chartData = useMemo(() => {

    if (!data) return []

    return data.slice(-100).map((k, i) => ({
      idx: i,
      time: new Date(k.openTime).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      price: Number(k.close),
      volume: Number(k.volume)
    }))

  }, [data])


  const priceRange = useMemo(() => {

    if (!data?.length) return { min: 0, max: 100 }

    const prices = data.flatMap(k => [
      Number(k.high),
      Number(k.low)
    ])

    if (currentPrice) prices.push(currentPrice)

    const min = Math.min(...prices)
    const max = Math.max(...prices)

    const padding = (max - min) * 0.08

    return {
      min: min - padding,
      max: max + padding
    }

  }, [data, currentPrice])


  if (!data?.length) {

    return (
      <div className="w-full h-full flex items-center justify-center bg-card">
        <span className="text-muted-foreground">
          Fetching {symbol} data...
        </span>
      </div>
    )

  }


  return (

    <div className="w-full h-full flex flex-col bg-card">

      <div className="flex items-center justify-between px-4 py-3 border-b border-border">

        <div className="flex items-center gap-3">

          <span className="text-sm font-medium">
            {symbol}
          </span>

          <span className="px-2 py-1 text-xs bg-secondary rounded">
            {interval}
          </span>

          {priceUpdateTime && (
            <span className="text-[10px] text-muted-foreground animate-pulse">
              🔴 {priceUpdateTime.toLocaleTimeString()}
            </span>
          )}

        </div>

        <div className="flex items-center gap-4 font-mono">
          {/* MAIN DISPLAY PRICE (Polymarket price-to-beat when available) */}
          <div className="text-2xl font-bold text-red-500">
            ${displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>

          {/* PRICE TO BEAT LABEL */}
          {priceToBeat && (
            <div className="flex items-center gap-1 text-orange-400">
              <span className="text-[10px] uppercase text-muted-foreground">
                TARGET
              </span>
              <span className="text-sm font-semibold">
                ${priceToBeat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

      </div>


      <div className="flex-1 min-h-0">

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 16, bottom: 16, left: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#0b1220" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#020617" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="2 4" stroke="#1f2937" vertical={false} />

            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickMargin={8}
              axisLine={{ stroke: '#1f2937' }}
              tickLine={false}
            />

            <YAxis
              yAxisId="price"
              domain={[() => priceRange.min, () => priceRange.max]}
              width={70}
              tickFormatter={(v) => `$${v.toLocaleString()}`}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={{ stroke: '#1f2937' }}
              tickLine={false}
            />

            <YAxis yAxisId="volume" orientation="right" hide domain={[0, 'auto']} />

            <Tooltip
              contentStyle={{
                backgroundColor: '#020617',
                border: '1px solid #1f2937',
                borderRadius: 6,
                fontSize: 11,
              }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(value: any, name: any) => {
                if (name === 'price') {
                  return [`$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Price']
                }
                if (name === 'volume') {
                  return [Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }), 'Volume']
                }
                return [value, name]
              }}
            />

            {priceToBeat && priceToBeat > 0 && (
              <ReferenceLine
                yAxisId="price"
                y={priceToBeat}
                stroke="#22c55e"
                strokeDasharray="4 4"
                label={{
                  value: 'TARGET',
                  position: 'right',
                  fill: '#22c55e',
                  fontSize: 10,
                }}
              />
            )}

            <Area
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />

            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="url(#volumeGradient)"
              barSize={3}
            />
          </ComposedChart>
        </ResponsiveContainer>

      </div>

    </div>

  )

}
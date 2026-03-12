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
  livePrice?: number
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

        <div className="text-right">

          <div className="text-2xl font-bold text-red-500">
            ${currentPrice.toLocaleString(undefined,{minimumFractionDigits:2})}
          </div>

        </div>

      </div>


      <div className="flex-1 min-h-0">

        <ResponsiveContainer width="100%" height="100%">

          <ComposedChart data={chartData}>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="time" />

            <YAxis
              yAxisId="price"
              domain={[
                () => priceRange.min,
                () => priceRange.max
              ]}
              width={70}
              tickFormatter={(v)=>`$${v.toLocaleString()}`}
            />

            <YAxis
              yAxisId="volume"
              orientation="right"
              hide
              domain={[0,'auto']}
            />

            <Tooltip />

            {priceToBeat && (

              <ReferenceLine
                yAxisId="price"
                y={priceToBeat}
                stroke="#22c55e"
                strokeDasharray="5 5"
              />

            )}

            <Area
              yAxisId="price"
              type="natural"
              dataKey="price"
              stroke="#ef4444"
              fillOpacity={0.3}
              fill="#ef4444"
            />

            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="rgba(59,130,246,0.5)"
              barSize={2}
            />

          </ComposedChart>

        </ResponsiveContainer>

      </div>

    </div>

  )

}
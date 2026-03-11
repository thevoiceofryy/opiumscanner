'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
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

export function PriceChart({
  data,
  symbol,
  interval,
  cryptoData,
  selectedMarket,
  priceToBeat,
}: PriceChartProps) {

  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [priceUpdateTime, setPriceUpdateTime] = useState<Date | null>(null)
  const [priceFlash, setPriceFlash] = useState(false)
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(null)

  // 🔒 Frozen price to beat (matches Polymarket behaviour)
  const priceToBeatRef = useRef<number | null>(null)

  // Capture price-to-beat only once when a market loads
  useEffect(() => {
    if (!selectedMarket) return

    const extracted = extractPriceTargetFromMarket(selectedMarket.question)

    if (extracted && priceToBeatRef.current === null) {
      priceToBeatRef.current = extracted
    }

  }, [selectedMarket])

  // Reset if new market appears
  useEffect(() => {
    priceToBeatRef.current = null
  }, [selectedMarket?.id])

  const frozenPriceToBeat = priceToBeatRef.current ?? priceToBeat

  // Live BTC price
  useEffect(() => {
    if (!cryptoData?.price) return

    setLivePrice(prev => {

      if (prev && prev !== cryptoData.price) {

        if (cryptoData.price > prev) {
          setPriceDirection('up')
        } else {
          setPriceDirection('down')
        }

        setPriceFlash(true)
        setTimeout(() => setPriceFlash(false), 300)

        setTimeout(() => setPriceDirection(null), 500)

      }

      return cryptoData.price
    })

    setPriceUpdateTime(new Date())

  }, [cryptoData?.price])

  // fallback if cryptoData missing
  useEffect(() => {

    if (!cryptoData?.price && data?.length) {
      const latest = Number(data[data.length - 1].close)
      setLivePrice(latest)
      setPriceUpdateTime(new Date())
    }

  }, [data])

  const chartData = useMemo(() => {

    if (!data?.length) return []

    return data.slice(-100).map((kline, idx) => {

      const close = Number(kline.close)

      return {
        idx,
        time: new Date(kline.openTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        price: close,
        volume: Number(kline.volume),
      }

    })

  }, [data])

  const currentPrice =
    livePrice ??
    (data.length ? Number(data[data.length - 1].close) : 0)

  const firstPrice =
    data.length ? Number(data[0].open) : 0

  const priceChange = currentPrice - firstPrice
  const priceChangePercent =
    firstPrice ? (priceChange / firstPrice) * 100 : 0

  const isPositive = priceChange >= 0

  const priceRange = useMemo(() => {

    if (!data.length) return { min: 0, max: 100 }

    const highs = data.map(d => Number(d.high))
    const lows = data.map(d => Number(d.low))

    const min = Math.min(...lows)
    const max = Math.max(...highs)

    const padding = (max - min) * 0.1

    return {
      min: min - padding,
      max: max + padding,
    }

  }, [data])

  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading market data...
      </div>
    )
  }

  return (

    <div className="w-full h-full flex flex-col bg-card">

      {/* Header */}

      <div className="flex items-center justify-between px-4 py-3 border-b border-border">

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{symbol}</span>
          <span className="text-xs bg-secondary px-2 py-1 rounded">
            {interval}
          </span>

          {priceUpdateTime && (
            <span className="text-[10px] text-muted-foreground animate-pulse">
              🔴 {priceUpdateTime.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Live price */}

        <div className="text-right">

          <div
            className={`text-2xl font-bold ${
              priceDirection === 'up'
                ? 'text-green-500'
                : priceDirection === 'down'
                ? 'text-red-500'
                : isPositive
                ? 'text-green-500'
                : 'text-red-500'
            }`}
          >
            ${currentPrice.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>

          <div
            className={`text-sm ${
              isPositive ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {isPositive ? '+' : ''}
            {priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
          </div>

        </div>

        {/* Price to Beat */}

        {frozenPriceToBeat && (
          <div className="text-right pl-4 border-l border-border">

            <div className="text-xs text-muted-foreground">
              Price to Beat
            </div>

            <div className="text-lg font-bold">
              ${frozenPriceToBeat.toLocaleString()}
            </div>

            <div className="text-xs text-muted-foreground">
              {currentPrice > frozenPriceToBeat ? '+' : '-'}
              ${Math.abs(currentPrice - frozenPriceToBeat).toFixed(2)}
            </div>

          </div>
        )}

      </div>

      {/* Chart */}

      <div className="flex-1">

        <ResponsiveContainer width="100%" height="100%">

          <ComposedChart data={chartData}>

            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isPositive ? '#22c55e' : '#ef4444'}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={isPositive ? '#22c55e' : '#ef4444'}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.2)" />

            <XAxis
              dataKey="time"
              tick={{ fontSize: 11 }}
            />

            <YAxis
              yAxisId="price"
              domain={[
                Math.floor(priceRange.min),
                Math.ceil(priceRange.max),
              ]}
            />

            <YAxis
              yAxisId="volume"
              orientation="right"
              hide
            />

            <Tooltip />

            {/* Frozen price-to-beat line */}

            {frozenPriceToBeat && (
              <ReferenceLine
                yAxisId="price"
                y={frozenPriceToBeat}
                stroke="#22c55e"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: `Price to Beat $${frozenPriceToBeat}`,
                  position: 'right',
                  fill: '#e5e7eb',
                }}
              />
            )}

            <Area
              yAxisId="price"
              type="natural"
              dataKey="price"
              stroke={isPositive ? '#22c55e' : '#ef4444'}
              fill="url(#priceFill)"
              strokeWidth={2}
            />

            {/* Volume bars */}

            <Bar
              yAxisId="volume"
              dataKey="volume"
              barSize={2}
              fill="rgba(59,130,246,.5)"
            />

          </ComposedChart>

        </ResponsiveContainer>

      </div>

    </div>
  )
}
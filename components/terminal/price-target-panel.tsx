'use client'

import { useEffect, useState } from 'react'

interface Props {
  klines: any[]
  priceToBeat: number | null
  livePrice: number | null
}

export function PriceTargetPanel({ priceToBeat, livePrice }: Props) {

  const [history, setHistory] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState(0)

  // Track price history
  useEffect(() => {

    if (!livePrice) return

    setHistory(prev => {

      const updated = [...prev, livePrice]

      if (updated.length > 40) updated.shift()

      return updated

    })

  }, [livePrice])


  // Countdown timer
  useEffect(() => {

    const updateRemaining = () => {
      const now = Date.now()
      const bucketMs = 15 * 60 * 1000
      const bucketStart = Math.floor(now / bucketMs) * bucketMs
      const bucketEnd = bucketStart + bucketMs
      const secs = Math.max(0, Math.floor((bucketEnd - now) / 1000))
      setTimeLeft(secs)
    }

    updateRemaining()
    const timer = setInterval(updateRemaining, 250)

    return () => clearInterval(timer)

  }, [])


  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`


  const diff =
    priceToBeat !== null && livePrice !== null
      ? livePrice - priceToBeat
      : null


  const baseSeries = [...history, livePrice ?? 0].filter((v) => v > 0)
  const max = baseSeries.length ? Math.max(...baseSeries) : (priceToBeat ?? livePrice ?? 0)
  const min = baseSeries.length ? Math.min(...baseSeries) : (priceToBeat ?? livePrice ?? 0)
  const range = max - min || 1


  const points = history.map((p, i) => {

    const x = (i / history.length) * 200
    const y = 70 - ((p - min) / range) * 70

    return `${x},${y}`

  }).join(' ')


  const norm = (value: number) => ((value - min) / range) * 60 + 5
  const targetY =
    priceToBeat !== null
      ? 70 - norm(priceToBeat)
      : 35


  return (

    <div className="h-full flex flex-col px-3 py-2 text-xs bg-[#071018]">

      {/* HEADER */}

      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
        <span>PRICE TO BEAT</span>
        <span>CURRENT</span>
        <span>LEFT</span>
      </div>


      {/* VALUES */}

      <div className="flex justify-between font-mono mb-2 tabular-nums">

        <span className="text-orange-400">
          {priceToBeat !== null ? `$${priceToBeat.toLocaleString()}` : '--'}
        </span>

        <span className="text-red-400">
          {livePrice !== null ? `$${livePrice.toLocaleString()}` : '--'}
        </span>

        <span className="text-red-400 min-w-[48px] text-right">
          {timeText}
        </span>

      </div>


      {/* MINI CHART */}

      <div className="flex-1 bg-[#08131f] rounded">

        <svg width="100%" height="100%" viewBox="0 0 200 70">

          {/* PRICE LINE */}

          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            points={points}
          />

          {/* TARGET LINE */}

          <line
            x1="0"
            y1={targetY}
            x2="200"
            y2={targetY}
            stroke="#f59e0b"
            strokeDasharray="4"
          />

        </svg>

      </div>


      {/* FOOTER */}

      <div className="flex justify-between text-[10px] mt-1">

        <span className="text-muted-foreground">
          {diff !== null ? `${diff.toFixed(0)} from open` : '--'}
        </span>

        <span className={
          diff !== null && diff < 0
            ? 'text-red-400'
            : 'text-green-400'
        }>
          {diff !== null && diff < 0
            ? '▼ Below target'
            : '▲ Above target'}
        </span>

      </div>

    </div>

  )

}
'use client'

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { Kline, Indicators } from '@/lib/types'

interface IndicatorsPanelProps {
  indicators: Indicators | null
  klines: Kline[]
}

// Calculate RSI from klines for charting
function calculateRSIHistory(closes: number[], period: number = 14): number[] {
  const rsiValues: number[] = []
  
  for (let i = period; i < closes.length; i++) {
    const slice = closes.slice(0, i + 1)
    const changes = slice.slice(1).map((close, idx) => close - slice[idx])
    const recentChanges = changes.slice(-period)
    
    const gains = recentChanges.map(c => c > 0 ? c : 0)
    const losses = recentChanges.map(c => c < 0 ? Math.abs(c) : 0)
    
    const avgGain = gains.reduce((a, b) => a + b, 0) / period
    const avgLoss = losses.reduce((a, b) => a + b, 0) / period
    
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))
    rsiValues.push(rsi)
  }
  
  return rsiValues
}

// Calculate MACD history
function calculateMACDHistory(closes: number[]): { macd: number; signal: number; histogram: number }[] {
  const ema = (data: number[], period: number): number[] => {
    const multiplier = 2 / (period + 1)
    const result: number[] = []
    let prevEma = data.slice(0, period).reduce((a, b) => a + b, 0) / period
    
    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        result.push(data.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1))
      } else {
        prevEma = (data[i] - prevEma) * multiplier + prevEma
        result.push(prevEma)
      }
    }
    return result
  }
  
  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signalLine = ema(macdLine, 9)
  
  return macdLine.map((macd, i) => ({
    macd,
    signal: signalLine[i],
    histogram: macd - signalLine[i]
  }))
}

export function IndicatorsPanel({ indicators, klines }: IndicatorsPanelProps) {
  const closes = klines.map(k => k.close)
  const rsiHistory = calculateRSIHistory(closes)
  const macdHistory = calculateMACDHistory(closes)
  
  const rsiData = rsiHistory.slice(-50).map((value, i) => ({ 
    index: i, 
    value,
    time: new Date(klines[klines.length - 50 + i]?.openTime || 0).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }))
  
  const macdData = macdHistory.slice(-50).map((d, i) => ({
    index: i,
    macd: d.macd,
    signal: d.signal,
    histogram: d.histogram,
    time: new Date(klines[klines.length - 50 + i]?.openTime || 0).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }))

  return (
    <div className="flex flex-col h-full">
      {/* RSI Chart */}
      <div className="flex-1 min-h-0 border-b border-border">
        <div className="flex items-center justify-between px-3 py-1 border-b border-border">
          <span className="text-xs text-muted-foreground">RSI (14)</span>
          <span className={`text-xs font-mono ${
            indicators?.rsi && indicators.rsi > 70 ? 'text-bearish' : 
            indicators?.rsi && indicators.rsi < 30 ? 'text-bullish' : 
            'text-foreground'
          }`}>
            {indicators?.rsi?.toFixed(2) || '--'}
          </span>
        </div>
        <div className="h-[calc(100%-28px)]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rsiData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <YAxis 
                domain={[0, 100]} 
                orientation="right"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={30}
                ticks={[30, 50, 70]}
              />
              <ReferenceLine y={70} stroke="hsl(var(--bearish))" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={30} stroke="hsl(var(--bullish))" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--warning))" 
                dot={false} 
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* MACD Chart */}
      <div className="flex-1 min-h-0">
        <div className="flex items-center justify-between px-3 py-1 border-b border-border">
          <span className="text-xs text-muted-foreground">MACD (12,26,9)</span>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-info">M: {indicators?.macd?.toFixed(2) || '--'}</span>
            <span className="text-warning">S: {indicators?.macdSignal?.toFixed(2) || '--'}</span>
            <span className={indicators?.macdHistogram && indicators.macdHistogram > 0 ? 'text-bullish' : 'text-bearish'}>
              H: {indicators?.macdHistogram?.toFixed(2) || '--'}
            </span>
          </div>
        </div>
        <div className="h-[calc(100%-28px)]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={macdData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <XAxis 
                dataKey="time"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                interval="preserveEnd"
              />
              <YAxis 
                orientation="right"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Line 
                type="monotone" 
                dataKey="macd" 
                stroke="hsl(var(--info))" 
                dot={false} 
                strokeWidth={1.5}
              />
              <Line 
                type="monotone" 
                dataKey="signal" 
                stroke="hsl(var(--warning))" 
                dot={false} 
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

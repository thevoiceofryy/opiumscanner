'use client'

import { useMemo } from 'react'
import { AlertTriangle, CheckCircle, XCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import type { CryptoData, MarketPrice } from '@/lib/types'

interface SignalPanelProps {
  cryptoData: CryptoData | null
  marketPrices: { yes: MarketPrice | null; no: MarketPrice | null }
}

interface ConfluenceItem {
  name: string
  signal: 'bullish' | 'bearish' | 'neutral'
  weight: number
}

export function SignalPanel({ cryptoData, marketPrices }: SignalPanelProps) {
  const indicators = cryptoData?.indicators
  
  // Calculate YES/NO prices
  const yesPrice = marketPrices.yes?.midPrice ? (marketPrices.yes.midPrice * 100).toFixed(0) : '--'
  const noPrice = marketPrices.no?.midPrice ? (marketPrices.no.midPrice * 100).toFixed(0) : '--'
  const yesPriceNum = marketPrices.yes?.midPrice || 0
  const noPriceNum = marketPrices.no?.midPrice || 0
  
  // Calculate confluence from multiple indicators
  const confluence = useMemo((): ConfluenceItem[] => {
    if (!indicators) return []
    
    return [
      {
        name: 'RSI',
        signal: indicators.rsi > 70 ? 'bearish' : indicators.rsi < 30 ? 'bullish' : 'neutral',
        weight: 1
      },
      {
        name: 'MACD',
        signal: indicators.macdHistogram > 0 ? 'bullish' : 'bearish',
        weight: 1.5
      },
      {
        name: 'Trend',
        signal: indicators.trend === 'UP' ? 'bullish' : indicators.trend === 'DOWN' ? 'bearish' : 'neutral',
        weight: 2
      },
      {
        name: 'StochRSI',
        signal: indicators.stochK > 80 ? 'bearish' : indicators.stochK < 20 ? 'bullish' : 'neutral',
        weight: 1
      },
      {
        name: 'VWAP',
        signal: indicators.vwapDeviation > 0.5 ? 'bullish' : indicators.vwapDeviation < -0.5 ? 'bearish' : 'neutral',
        weight: 1
      },
      {
        name: 'SMA Cross',
        signal: indicators.sma20 > indicators.sma50 ? 'bullish' : 'bearish',
        weight: 1.5
      }
    ]
  }, [indicators])

  // Calculate overall signal
  const overallSignal = useMemo(() => {
    if (confluence.length === 0) return { direction: 'NEUTRAL', score: 0, totalWeight: 0 }
    
    let bullishScore = 0
    let bearishScore = 0
    let totalWeight = 0
    
    confluence.forEach(item => {
      totalWeight += item.weight
      if (item.signal === 'bullish') bullishScore += item.weight
      else if (item.signal === 'bearish') bearishScore += item.weight
    })
    
    const netScore = bullishScore - bearishScore
    const normalizedScore = totalWeight > 0 ? (netScore / totalWeight) * 100 : 0
    
    return {
      direction: normalizedScore > 20 ? 'UP' : normalizedScore < -20 ? 'DOWN' : 'NEUTRAL',
      score: Math.round(normalizedScore),
      bullish: Math.round((bullishScore / totalWeight) * 100),
      bearish: Math.round((bearishScore / totalWeight) * 100),
      totalWeight
    }
  }, [confluence])

  const bullishCount = confluence.filter(c => c.signal === 'bullish').length
  const bearishCount = confluence.filter(c => c.signal === 'bearish').length

  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto">
      {/* Signal Summary */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Signal</span>
        </div>
        
        {/* YES/NO Price Display */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-3 rounded bg-bullish/10 border border-bullish/30">
            <div className="text-[10px] text-bullish/70 uppercase mb-1">YES</div>
            <div className="text-2xl font-bold text-bullish">{yesPrice}c</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              edge {yesPriceNum > 0.5 ? '+' : ''}{((1 - yesPriceNum) * 100 - 50).toFixed(0)}%
            </div>
          </div>
          <div className="p-3 rounded bg-bearish/10 border border-bearish/30">
            <div className="text-[10px] text-bearish/70 uppercase mb-1">NO</div>
            <div className="text-2xl font-bold text-bearish">{noPrice}c</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              edge {noPriceNum > 0.5 ? '+' : ''}{((1 - noPriceNum) * 100 - 50).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Confluence */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Confluence</span>
          <span className="text-xs text-muted-foreground">~{bullishCount}/{confluence.length} UP</span>
        </div>
        
        <div className="flex gap-1 mb-2">
          {confluence.map((item, i) => (
            <div 
              key={i}
              className={`flex-1 h-2 rounded-full ${
                item.signal === 'bullish' ? 'bg-bullish' :
                item.signal === 'bearish' ? 'bg-bearish' :
                'bg-muted'
              }`}
              title={`${item.name}: ${item.signal}`}
            />
          ))}
        </div>
        
        {/* Individual scores */}
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          {confluence.map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              {item.signal === 'bullish' ? (
                <ArrowUp className="w-3 h-3 text-bullish" />
              ) : item.signal === 'bearish' ? (
                <ArrowDown className="w-3 h-3 text-bearish" />
              ) : (
                <Minus className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Histogram Display */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-bullish">{overallSignal.bullish || 0}% UP</span>
          <span className="text-bearish">{overallSignal.bearish || 0}% DN</span>
        </div>
        <div className="flex h-3 rounded overflow-hidden">
          <div 
            className="bg-bullish transition-all" 
            style={{ width: `${overallSignal.bullish || 50}%` }}
          />
          <div 
            className="bg-bearish transition-all" 
            style={{ width: `${overallSignal.bearish || 50}%` }}
          />
        </div>
      </div>

      {/* Composite Signal */}
      <div className="p-3 rounded border border-border bg-secondary/30">
        <div className="flex items-center gap-2 mb-2">
          {overallSignal.direction === 'UP' ? (
            <CheckCircle className="w-5 h-5 text-bullish" />
          ) : overallSignal.direction === 'DOWN' ? (
            <XCircle className="w-5 h-5 text-bearish" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-warning" />
          )}
          <span className="font-semibold">
            SIGNAL {overallSignal.direction} {overallSignal.direction !== 'NEUTRAL' && 'BUT'} {yesPriceNum * 100 > 50 ? 'YES' : 'NO'} {Math.round(Math.max(yesPriceNum, noPriceNum) * 100)}c
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {overallSignal.direction === 'NEUTRAL' 
            ? 'Mixed signals - wait for clearer setup'
            : `${Math.abs(overallSignal.score)}% confidence based on ${confluence.length} indicators`
          }
        </div>
      </div>

      {/* Entry Window */}
      <div className="mt-4 p-3 rounded border border-bullish/30 bg-bullish/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase text-muted-foreground">Entry Window</span>
          <CheckCircle className="w-4 h-4 text-bullish" />
        </div>
        <div className="text-center">
          <span className="text-xs text-bullish">ENTRY WINDOW OPEN</span>
          <EntryCountdown />
        </div>
      </div>
    </div>
  )
}

function EntryCountdown() {
  // Calculate time until next 15-minute mark
  const now = new Date()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  
  const nextMark = Math.ceil((minutes + 1) / 15) * 15
  const minutesLeft = (nextMark - minutes - 1 + 60) % 60
  const secondsLeft = 60 - seconds
  
  return (
    <div className="text-4xl font-bold text-foreground mt-2">
      {minutesLeft.toString().padStart(2, '0')}:{secondsLeft.toString().padStart(2, '0')}
    </div>
  )
}

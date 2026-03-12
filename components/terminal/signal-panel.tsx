'use client'

import { useMemo, useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, XCircle, ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, Calendar, DollarSign, Users, BarChart3 } from 'lucide-react'
import type { CryptoData, MarketPrice, Market } from '@/lib/types'

interface SignalPanelProps {
  cryptoData: CryptoData | null
  marketPrices: { yes: MarketPrice | null; no: MarketPrice | null }
  selectedMarket?: Market | null
}

interface ConfluenceItem {
  name: string
  signal: 'bullish' | 'bearish' | 'neutral'
  weight: number
}

export function SignalPanel({ cryptoData, marketPrices, selectedMarket }: SignalPanelProps) {
  const indicators = cryptoData?.indicators
  
  // Parse outcome prices from market data as fallback
  const marketOutcomePrices = useMemo(() => {
    if (!selectedMarket?.outcomePrices) return null
    const prices = typeof selectedMarket.outcomePrices === 'string'
      ? JSON.parse(selectedMarket.outcomePrices as string)
      : selectedMarket.outcomePrices
    return {
      yes: prices[0] ? parseFloat(prices[0]) : null,
      no: prices[1] ? parseFloat(prices[1]) : null
    }
  }, [selectedMarket?.outcomePrices])
  
  // Calculate YES/NO prices - prefer CLOB prices, fall back to market outcome prices
  const yesPriceNum = marketPrices.yes?.midPrice ?? marketOutcomePrices?.yes ?? 0
  const noPriceNum = marketPrices.no?.midPrice ?? marketOutcomePrices?.no ?? 0
  const yesPrice = yesPriceNum > 0 ? (yesPriceNum * 100).toFixed(0) : '--'
  const noPrice = noPriceNum > 0 ? (noPriceNum * 100).toFixed(0) : '--'
  
  // Calculate confluence from multiple indicators (only for crypto mode)
  const confluence = useMemo((): ConfluenceItem[] => {
    if (!indicators || selectedMarket) return []
    
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
  }, [indicators, selectedMarket])

  // Calculate overall signal
  const overallSignal = useMemo(() => {
    // Return consistent default values when no data - avoids hydration mismatch
    if (confluence.length === 0) return { direction: 'NEUTRAL' as const, score: 0, totalWeight: 0, bullish: 0, bearish: 0 }
    
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
      direction: (normalizedScore > 20 ? 'UP' : normalizedScore < -20 ? 'DOWN' : 'NEUTRAL') as 'UP' | 'DOWN' | 'NEUTRAL',
      score: Math.round(normalizedScore),
      bullish: Math.round((bullishScore / totalWeight) * 100),
      bearish: Math.round((bearishScore / totalWeight) * 100),
      totalWeight
    }
  }, [confluence])

  const bullishCount = confluence.filter(c => c.signal === 'bullish').length

  // If a market is selected, show market-specific signal panel
  if (selectedMarket) {
    return (
      <MarketSignalPanel 
        selectedMarket={selectedMarket}
        yesPriceNum={yesPriceNum}
        noPriceNum={noPriceNum}
        yesPrice={yesPrice}
        noPrice={noPrice}
      />
    )
  }

  // Crypto mode - show technical indicators
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
          <span className="text-bullish">{confluence.length > 0 ? overallSignal.bullish : 50}% UP</span>
          <span className="text-bearish">{confluence.length > 0 ? overallSignal.bearish : 50}% DN</span>
        </div>
        <div className="flex h-3 rounded overflow-hidden">
          <div 
            className="bg-bullish transition-all" 
            style={{ width: `${confluence.length > 0 ? overallSignal.bullish : 50}%` }}
          />
          <div 
            className="bg-bearish transition-all" 
            style={{ width: `${confluence.length > 0 ? overallSignal.bearish : 50}%` }}
          />
        </div>
      </div>
      
      {/* Composite Signal */}
      <div className="mt-2 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Composite Signal
        </span>
      </div>
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

// Market-specific signal panel for Polymarket events
function MarketSignalPanel({ 
  selectedMarket, 
  yesPriceNum, 
  noPriceNum,
  yesPrice,
  noPrice
}: { 
  selectedMarket: Market
  yesPriceNum: number
  noPriceNum: number
  yesPrice: string
  noPrice: string
}) {
  // Calculate edge (potential profit if correct)
  const yesEdge = yesPriceNum > 0 ? ((1 / yesPriceNum - 1) * 100).toFixed(0) : '--'
  const noEdge = noPriceNum > 0 ? ((1 / noPriceNum - 1) * 100).toFixed(0) : '--'
  
  // Determine which side is favored
  const yesFavored = yesPriceNum > noPriceNum
  const probability = Math.round(yesPriceNum * 100)
  
  // Format volume (selectedMarket.volume is a number in our types)
  const volume = typeof selectedMarket.volume === 'number'
    ? selectedMarket.volume >= 1_000_000
      ? `$${(selectedMarket.volume / 1_000_000).toFixed(1)}M`
      : selectedMarket.volume >= 1_000
        ? `$${(selectedMarket.volume / 1_000).toFixed(0)}K`
        : `$${selectedMarket.volume.toFixed(0)}`
    : '--'

  // Format end date
  const endDate = selectedMarket.endDate ? 
    new Date(selectedMarket.endDate).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    }) : '--'

  // Calculate days remaining
  const daysRemaining = selectedMarket.endDate ? 
    Math.max(0, Math.ceil((new Date(selectedMarket.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null

  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto">
      {/* Market Probability */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Market Odds</span>
        </div>
        
        {/* YES/NO Price Display */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className={`p-3 rounded border ${yesFavored ? 'bg-bullish/10 border-bullish/50' : 'bg-bullish/5 border-bullish/20'}`}>
            <div className="text-[10px] text-bullish/70 uppercase mb-1">YES</div>
            <div className="text-2xl font-bold text-bullish">{yesPrice}c</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              +{yesEdge}% if correct
            </div>
          </div>
          <div className={`p-3 rounded border ${!yesFavored ? 'bg-bearish/10 border-bearish/50' : 'bg-bearish/5 border-bearish/20'}`}>
            <div className="text-[10px] text-bearish/70 uppercase mb-1">NO</div>
            <div className="text-2xl font-bold text-bearish">{noPrice}c</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              +{noEdge}% if correct
            </div>
          </div>
        </div>
      </div>

      {/* Market Info */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="w-3 h-3" />
            <span>Volume</span>
          </div>
          <span className="font-mono">{volume}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>End Date</span>
          </div>
          <span className="font-mono">{endDate}</span>
        </div>
        {daysRemaining !== null && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="w-3 h-3" />
              <span>Time Left</span>
            </div>
            <span className={`font-mono ${daysRemaining < 7 ? 'text-warning' : ''}`}>
              {daysRemaining} days
            </span>
          </div>
        )}
      </div>

      {/* Probability Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-bullish">YES {probability}%</span>
          <span className="text-bearish">NO {100 - probability}%</span>
        </div>
        <div className="flex h-3 rounded overflow-hidden">
          <div 
            className="bg-bullish transition-all duration-500" 
            style={{ width: `${probability}%` }}
          />
          <div 
            className="bg-bearish transition-all duration-500" 
            style={{ width: `${100 - probability}%` }}
          />
        </div>
      </div>

      {/* Market Signal */}
      <div className="p-3 rounded border border-border bg-secondary/30">
        <div className="flex items-center gap-2 mb-2">
          {yesFavored ? (
            <TrendingUp className="w-5 h-5 text-bullish" />
          ) : (
            <TrendingDown className="w-5 h-5 text-bearish" />
          )}
          <span className="font-semibold">
            {yesFavored ? 'YES' : 'NO'} FAVORED AT {yesFavored ? yesPrice : noPrice}c
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {yesFavored 
            ? `Market implies ${probability}% chance of YES outcome`
            : `Market implies ${100 - probability}% chance of NO outcome`
          }
        </div>
      </div>

      {/* Betting Edge Calculator */}
      <div className="mt-4 p-3 rounded border border-primary/30 bg-primary/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase text-muted-foreground">Edge Calculator</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">If you think YES {'>'} {probability}%:</span>
            <span className="text-bullish font-semibold">Buy YES</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">If you think YES {'<'} {probability}%:</span>
            <span className="text-bearish font-semibold">Buy NO</span>
          </div>
        </div>
      </div>

      {/* Time Until Resolution */}
      {daysRemaining !== null && daysRemaining > 0 && (
        <div className="mt-4 p-3 rounded border border-muted/30 bg-muted/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase text-muted-foreground">Resolution</span>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Resolves in</span>
            <div className="text-2xl font-bold text-foreground mt-1">
              {daysRemaining} <span className="text-sm font-normal text-muted-foreground">days</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EntryCountdown() {
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number } | null>(null)
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date()
      const minutes = now.getMinutes()
      const seconds = now.getSeconds()
      
      const nextMark = Math.ceil((minutes + 1) / 15) * 15
      const minutesLeft = (nextMark - minutes - 1 + 60) % 60
      const secondsLeft = 60 - seconds
      
      setTimeLeft({ minutes: minutesLeft, seconds: secondsLeft === 60 ? 0 : secondsLeft })
    }
    
    // Set initial time on client
    calculateTimeLeft()
    
    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(timer)
  }, [])
  
  // Show placeholder during SSR
  if (!timeLeft) {
    return (
      <div className="text-4xl font-bold text-foreground mt-2">
        --:--
      </div>
    )
  }
  
  return (
    <div className="text-4xl font-bold text-foreground mt-2">
      {timeLeft.minutes.toString().padStart(2, '0')}:{timeLeft.seconds.toString().padStart(2, '0')}
    </div>
  )
}

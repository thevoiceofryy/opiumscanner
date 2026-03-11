'use client'

import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { CryptoData, FundingData, FearGreed } from '@/lib/types'

interface MetricsPanelProps {
  cryptoData: CryptoData | null
  fundingData: FundingData | null
  fearGreed: FearGreed | null
}

function MetricCard({ 
  label, 
  value, 
  subValue, 
  status,
  isLive = false 
}: { 
  label: string
  value: string | number
  subValue?: string
  status?: 'bullish' | 'bearish' | 'neutral' | 'warning'
  isLive?: boolean
}) {
  const statusColors = {
    bullish: 'text-bullish',
    bearish: 'text-bearish',
    neutral: 'text-muted-foreground',
    warning: 'text-warning'
  }

  return (
    <div className="p-2 bg-secondary/50 rounded border border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</span>
        {isLive && (
          <span className="px-1 py-0.5 text-[8px] bg-bullish/20 text-bullish rounded">LIVE</span>
        )}
      </div>
      <div className={`text-sm font-semibold ${status ? statusColors[status] : 'text-foreground'}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-[10px] text-muted-foreground">{subValue}</div>
      )}
    </div>
  )
}

export function MetricsPanel({ cryptoData, fundingData, fearGreed }: MetricsPanelProps) {
  const indicators = cryptoData?.indicators

  const getTrendIcon = (trend?: string) => {
    if (trend === 'UP' || trend === 'BULLISH') return <TrendingUp className="w-3 h-3 text-bullish" />
    if (trend === 'DOWN' || trend === 'BEARISH') return <TrendingDown className="w-3 h-3 text-bearish" />
    return <Minus className="w-3 h-3 text-muted-foreground" />
  }

  const getRSIStatus = (rsi?: number): 'bullish' | 'bearish' | 'neutral' => {
    if (!rsi) return 'neutral'
    if (rsi > 70) return 'bearish'
    if (rsi < 30) return 'bullish'
    return 'neutral'
  }

  const getFearGreedStatus = (value?: number): 'bullish' | 'bearish' | 'neutral' | 'warning' => {
    if (!value) return 'neutral'
    if (value <= 25) return 'bearish'
    if (value >= 75) return 'bullish'
    if (value < 45) return 'warning'
    return 'neutral'
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Activity className="w-4 h-4 text-info" />
        <span className="text-xs font-medium uppercase tracking-wider">Metrics</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {/* Technical Indicators */}
        <MetricCard
          label="RSI (14)"
          value={indicators?.rsi?.toFixed(1) || '--'}
          subValue={indicators?.rsiSignal || 'Loading...'}
          status={getRSIStatus(indicators?.rsi)}
          isLive
        />
        
        <MetricCard
          label="Trend"
          value={
            <div className="flex items-center gap-1">
              {getTrendIcon(indicators?.trend)}
              <span>{indicators?.trend || '--'}</span>
            </div>
          }
          subValue={indicators?.macdTrend || 'Loading...'}
          status={indicators?.trend === 'UP' ? 'bullish' : indicators?.trend === 'DOWN' ? 'bearish' : 'neutral'}
          isLive
        />
        
        <MetricCard
          label="ATR (14)"
          value={`$${indicators?.atr?.toFixed(2) || '--'}`}
          subValue="Volatility"
          isLive
        />
        
        <MetricCard
          label="StochRSI"
          value={`K:${indicators?.stochK?.toFixed(0) || '--'} D:${indicators?.stochD?.toFixed(0) || '--'}`}
          subValue={indicators?.stochSignal || 'Loading...'}
          status={getRSIStatus(indicators?.stochK)}
          isLive
        />
        
        <MetricCard
          label="VWAP Dev"
          value={`${indicators?.vwapDeviation ? (indicators.vwapDeviation > 0 ? '+' : '') + indicators.vwapDeviation.toFixed(2) + '%' : '--'}`}
          subValue={indicators?.vwapDeviation && indicators.vwapDeviation > 0 ? 'Above VWAP' : 'Below VWAP'}
          status={indicators?.vwapDeviation && indicators.vwapDeviation > 0 ? 'bullish' : 'bearish'}
          isLive
        />
        
        <MetricCard
          label="SMA Cross"
          value={indicators?.sma20 && indicators?.sma50 
            ? (indicators.sma20 > indicators.sma50 ? 'Bullish' : 'Bearish')
            : '--'}
          subValue={`20: ${indicators?.sma20?.toFixed(0) || '--'} | 50: ${indicators?.sma50?.toFixed(0) || '--'}`}
          status={indicators?.sma20 && indicators?.sma50 && indicators.sma20 > indicators.sma50 ? 'bullish' : 'bearish'}
        />
        
        {/* Market Data */}
        <MetricCard
          label="Funding Rate"
          value={`${fundingData?.fundingRateBps?.toFixed(3) || '--'} bps`}
          subValue={fundingData?.sentiment || 'Loading...'}
          status={fundingData?.sentiment === 'BULLISH' ? 'bullish' : fundingData?.sentiment === 'BEARISH' ? 'bearish' : 'neutral'}
          isLive
        />
        
        <MetricCard
          label="Long/Short"
          value={`${fundingData?.longPercent || '--'}% / ${fundingData?.shortPercent || '--'}%`}
          subValue={`Ratio: ${fundingData?.longShortRatio?.toFixed(2) || '--'}`}
          status={fundingData && fundingData.longPercent > 55 ? 'bullish' : fundingData && fundingData.shortPercent > 55 ? 'bearish' : 'neutral'}
          isLive
        />
        
        <div className="col-span-2">
          <MetricCard
            label="Fear & Greed"
            value={
              <div className="flex items-center gap-2">
                <span className={`text-lg ${getFearGreedStatus(fearGreed?.value) === 'bearish' ? 'text-bearish' : getFearGreedStatus(fearGreed?.value) === 'bullish' ? 'text-bullish' : 'text-warning'}`}>
                  {fearGreed?.value || '--'}
                </span>
                <span className="text-xs">{fearGreed?.classification || 'Loading...'}</span>
              </div>
            }
            status={getFearGreedStatus(fearGreed?.value)}
            isLive
          />
        </div>
      </div>
    </div>
  )
}

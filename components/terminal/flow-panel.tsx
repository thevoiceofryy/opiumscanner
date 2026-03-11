'use client'

import { Activity, ArrowUpRight, ArrowDownRight, BookOpen, Flame, Zap } from 'lucide-react'
import type { CryptoData, FundingData } from '@/lib/types'

interface FlowPanelProps {
  cryptoData: CryptoData | null
  fundingData: FundingData | null
  sessionLabel: string
}

function FlowMetric({ 
  label, 
  value, 
  subLabel,
  status,
  isLive = false 
}: { 
  label: string
  value: string | React.ReactNode
  subLabel?: string
  status?: 'bullish' | 'bearish' | 'neutral' | 'warning'
  isLive?: boolean
}) {
  const statusColors = {
    bullish: 'text-bullish',
    bearish: 'text-bearish',
    neutral: 'text-foreground',
    warning: 'text-warning'
  }

  return (
    <div className="p-2 bg-secondary/30 rounded border border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</span>
        {isLive && (
          <span className="px-1 py-0.5 text-[8px] bg-bullish/20 text-bullish rounded">LIVE</span>
        )}
      </div>
      <div className={`text-sm font-semibold ${status ? statusColors[status] : 'text-foreground'}`}>
        {value}
      </div>
      {subLabel && (
        <div className="text-[10px] text-muted-foreground">{subLabel}</div>
      )}
    </div>
  )
}

export function FlowPanel({ cryptoData, fundingData, sessionLabel }: FlowPanelProps) {
  // OFI (Order Flow Imbalance) - simulated from long/short ratio
  const ofi = fundingData?.longShortRatio 
    ? ((fundingData.longShortRatio - 1) * 100).toFixed(2)
    : '0.00'
  const ofiStatus = parseFloat(ofi) > 5 ? 'bullish' : parseFloat(ofi) < -5 ? 'bearish' : 'neutral'
  
  // Large trade indicator - simulated
  const largeTradeBias = fundingData?.longPercent 
    ? (fundingData.longPercent > 55 ? 'Buy' : fundingData.shortPercent > 55 ? 'Sell' : 'Neutral')
    : 'Neutral'
  const largeTradePct = fundingData?.longPercent 
    ? Math.max(fundingData.longPercent, fundingData.shortPercent)
    : 50
  
  // Order book imbalance - simulated
  const askDominance = fundingData?.shortPercent || 50
  const bidDominance = fundingData?.longPercent || 50
  const bookStatus = bidDominance > 55 ? 'bullish' : askDominance > 55 ? 'bearish' : 'neutral'
  
  // Candle move - from price change
  const candleMove = cryptoData?.priceChange 
    ? `$${cryptoData.priceChange > 0 ? '+' : ''}${cryptoData.priceChange.toFixed(0)}`
    : '--'
  const atrValue = cryptoData?.indicators?.atr || 0
  const candleVsAtr = atrValue > 0 && cryptoData?.priceChange 
    ? Math.abs(cryptoData.priceChange) / atrValue 
    : 0
  
  // Liquidation estimate - simulated based on funding rate
  const oiChange = fundingData?.fundingRate 
    ? `${fundingData.fundingRate > 0 ? '+' : ''}${(fundingData.fundingRate * 100).toFixed(2)}%`
    : '0.00%'

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-warning" />
          <span className="text-xs font-medium uppercase tracking-wider">Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-warning" />
          <span className="text-xs text-muted-foreground">{sessionLabel}</span>
          <div className="w-8 h-1 bg-warning/30 rounded-full">
            <div className="w-1/2 h-full bg-warning rounded-full" />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <FlowMetric
          label="OFI Taker"
          value={
            <div className="flex items-center gap-1">
              <span>{ofi}</span>
              <span className="text-xs text-muted-foreground">
                {ofiStatus === 'bullish' ? 'Bullish' : ofiStatus === 'bearish' ? 'Bearish' : 'Neutral'}
              </span>
            </div>
          }
          subLabel="Balanced supply/demand"
          status={ofiStatus}
          isLive
        />
        
        <FlowMetric
          label="Large Trade"
          value={
            <div className="flex items-center gap-1">
              <span>{largeTradePct}%</span>
              <span className="text-xs">{largeTradeBias}</span>
              {largeTradeBias === 'Buy' ? (
                <ArrowUpRight className="w-3 h-3 text-bullish" />
              ) : largeTradeBias === 'Sell' ? (
                <ArrowDownRight className="w-3 h-3 text-bearish" />
              ) : null}
            </div>
          }
          subLabel={largeTradeBias === 'Neutral' ? 'Mixed flow' : `Strong ${largeTradeBias.toLowerCase()}ers`}
          status={largeTradeBias === 'Buy' ? 'bullish' : largeTradeBias === 'Sell' ? 'bearish' : 'neutral'}
          isLive
        />
        
        <FlowMetric
          label="Order Book"
          value={
            <span>{bidDominance > askDominance ? `${bidDominance}% Bid` : `${askDominance}% Ask`}</span>
          }
          subLabel={bookStatus === 'bullish' ? 'Bid dominating' : bookStatus === 'bearish' ? 'Ask dominating' : 'Balanced book'}
          status={bookStatus}
          isLive
        />
        
        <FlowMetric
          label="Liquidation"
          value={oiChange}
          subLabel="OI stable"
          status="neutral"
        />
        
        <FlowMetric
          label="Candle Move"
          value={
            <div className="flex items-center gap-1">
              <span>{candleMove}</span>
              {cryptoData?.priceChange && cryptoData.priceChange > 0 ? (
                <ArrowUpRight className="w-3 h-3 text-bullish" />
              ) : cryptoData?.priceChange && cryptoData.priceChange < 0 ? (
                <ArrowDownRight className="w-3 h-3 text-bearish" />
              ) : null}
            </div>
          }
          subLabel={`${candleVsAtr.toFixed(1)}x ATR - ${candleVsAtr > 1 ? 'High' : 'Normal'}`}
          status={cryptoData?.priceChange && cryptoData.priceChange > 0 ? 'bullish' : 'bearish'}
          isLive
        />
        
        <FlowMetric
          label="Close Micro"
          value={
            <span className={`${cryptoData?.priceChange && cryptoData.priceChange > 0 ? 'text-bullish' : 'text-bearish'}`}>
              {cryptoData?.priceChange && cryptoData.priceChange > 0 ? 'YES' : 'NO'} {'>'} 50c
            </span>
          }
          subLabel={`YES ${((cryptoData?.priceChangePercent || 0) > 0 ? 50 + Math.abs(cryptoData?.priceChangePercent || 0) : 50 - Math.abs(cryptoData?.priceChangePercent || 0)).toFixed(0)}c`}
        />
      </div>
    </div>
  )
}

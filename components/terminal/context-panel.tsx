'use client'

import { TrendingUp, TrendingDown, Wallet, BarChart3, Activity, DollarSign } from 'lucide-react'
import type { CryptoData, FundingData, FearGreed } from '@/lib/types'

interface ContextPanelProps {
  cryptoData: CryptoData | null
  fundingData: FundingData | null
  fearGreed: FearGreed | null
}

function ContextCard({ 
  icon: Icon,
  label, 
  value, 
  subLabel,
  status,
  isLive = false 
}: { 
  icon: any
  label: string
  value: string | React.ReactNode
  subLabel?: string
  status?: 'bullish' | 'bearish' | 'neutral' | 'warning'
  isLive?: boolean
}) {
  const statusColors = {
    bullish: 'border-bullish/30 bg-bullish/5',
    bearish: 'border-bearish/30 bg-bearish/5',
    neutral: 'border-border bg-secondary/30',
    warning: 'border-warning/30 bg-warning/5'
  }

  const textColors = {
    bullish: 'text-bullish',
    bearish: 'text-bearish',
    neutral: 'text-foreground',
    warning: 'text-warning'
  }

  return (
    <div className={`p-2 rounded border ${status ? statusColors[status] : statusColors.neutral}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</span>
        </div>
        {isLive && (
          <span className="px-1 py-0.5 text-[8px] bg-bullish/20 text-bullish rounded">LIVE</span>
        )}
      </div>
      <div className={`text-sm font-semibold ${status ? textColors[status] : textColors.neutral}`}>
        {value}
      </div>
      {subLabel && (
        <div className="text-[10px] text-muted-foreground">{subLabel}</div>
      )}
    </div>
  )
}

export function ContextPanel({ cryptoData, fundingData, fearGreed }: ContextPanelProps) {
  const indicators = cryptoData?.indicators

  // Determine 4H trend based on current data (simplified)
  const trend4h = indicators?.trend || 'NEUTRAL'
  
  // Support level calculation (simplified - using recent low)
  const supportLevel = cryptoData?.low 
    ? `$${cryptoData.low.toLocaleString()}`
    : '--'
  const supportDistance = cryptoData?.price && cryptoData?.low
    ? ((cryptoData.price - cryptoData.low) / cryptoData.price * 100).toFixed(1)
    : '--'

  // Basis calculation (spot vs futures spread approximation)
  const basis = fundingData?.fundingRate 
    ? (fundingData.fundingRate * 8).toFixed(2) // Approximate annualized
    : '--'

  return (
    <div className="p-2">
      <div className="flex items-center gap-2 mb-3 px-1">
        <BarChart3 className="w-4 h-4 text-info" />
        <span className="text-xs font-medium uppercase tracking-wider">Context</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <ContextCard
          icon={TrendingUp}
          label="4H Macro"
          value={
            <div className="flex items-center gap-1">
              {trend4h === 'UP' ? (
                <TrendingUp className="w-3 h-3" />
              ) : trend4h === 'DOWN' ? (
                <TrendingDown className="w-3 h-3" />
              ) : null}
              <span>{trend4h}</span>
            </div>
          }
          subLabel="4-hour BTC trend"
          status={trend4h === 'UP' ? 'bullish' : trend4h === 'DOWN' ? 'bearish' : 'neutral'}
          isLive
        />
        
        <ContextCard
          icon={Activity}
          label="Fear & Greed"
          value={
            <span>{fearGreed?.value || '--'} {fearGreed?.classification?.split(' ')[0] || ''}</span>
          }
          subLabel={fearGreed?.classification || 'Loading...'}
          status={
            fearGreed?.value && fearGreed.value <= 25 ? 'bearish' :
            fearGreed?.value && fearGreed.value >= 75 ? 'bullish' :
            fearGreed?.value && fearGreed.value < 45 ? 'warning' : 'neutral'
          }
          isLive
        />
        
        <ContextCard
          icon={DollarSign}
          label="Funding Rate"
          value={`${fundingData?.fundingRateBps?.toFixed(2) || '--'} bps`}
          subLabel={fundingData?.sentiment === 'NEUTRAL' ? 'Normal funding rate' : `${fundingData?.sentiment} funding`}
          status={fundingData?.sentiment === 'BULLISH' ? 'bullish' : fundingData?.sentiment === 'BEARISH' ? 'bearish' : 'neutral'}
          isLive
        />
        
        <ContextCard
          icon={BarChart3}
          label="Top Traders"
          value={`${fundingData?.longPercent || '--'}% Long`}
          subLabel={
            fundingData?.longPercent && fundingData.longPercent > 55 ? 'Bullish positioning' :
            fundingData?.shortPercent && fundingData.shortPercent > 55 ? 'Bearish positioning' :
            'Neutral top traders'
          }
          status={
            fundingData?.longPercent && fundingData.longPercent > 55 ? 'bullish' :
            fundingData?.shortPercent && fundingData.shortPercent > 55 ? 'bearish' : 'neutral'
          }
          isLive
        />
        
        <ContextCard
          icon={Wallet}
          label="Support Level"
          value={supportLevel}
          subLabel={`${supportDistance}% from price`}
          status="neutral"
        />
        
        <ContextCard
          icon={TrendingUp}
          label="Basis"
          value={`${basis} bps`}
          subLabel="Futures premium"
          status={parseFloat(basis) > 5 ? 'bullish' : parseFloat(basis) < -5 ? 'bearish' : 'neutral'}
          isLive
        />
      </div>
    </div>
  )
}

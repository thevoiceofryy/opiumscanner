'use client'

import { useState } from 'react'
import { usePolymarketRound } from '@/hooks/use-polymarket-round'
import { TerminalHeader } from './terminal-header'
import { PriceChart } from './price-chart'
import { IndicatorsPanel } from './indicators-panel'
import { MetricsPanel } from './metrics-panel'
import { SignalPanel } from './signal-panel'
import { ContextPanel } from './context-panel'
import { FlowPanel } from './flow-panel'
import { PriceTargetPanel } from './price-target-panel'
import { useBTCPrice } from '@/hooks/use-btc-price'

import {
  useKlines,
  useIndicators,
  useFearGreed,
  useFunding
} from '@/hooks/use-market-data'

import type { TimeInterval } from '@/lib/types'

const INTERVALS: { value: TimeInterval; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
]

export function TerminalLayout() {
  const btcPrice = useBTCPrice()
  
  // These names MUST match the return statement in your usePolymarketRound hook
  const { priceToBeat, probability, marketTitle } = usePolymarketRound()

  const [interval, setInterval] = useState<TimeInterval>('15m')
  const symbol = 'BTCUSDT'

  const { data: klines } = useKlines(symbol, interval, 100)
  const { data: cryptoData } = useIndicators(symbol, interval)
  const { data: fearGreed } = useFearGreed()
  const { data: fundingData } = useFunding(symbol)

  const sessionLabel: 'LIVE' | 'CLOSED' = 'LIVE'

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TerminalHeader />

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-px bg-border p-px">
        {/* Left Sidebar - Flow & Metrics */}
        <div className="col-span-2 bg-card flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-bullish animate-pulse" />
              <span className="text-xs font-medium">{sessionLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">candle</span>
              <span className="text-xs font-mono">{interval}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <FlowPanel
              cryptoData={cryptoData || null}
              fundingData={fundingData || null}
              sessionLabel={sessionLabel}
            />
            <div className="border-t border-border">
              <MetricsPanel
                cryptoData={cryptoData || null}
                fundingData={fundingData || null}
                fearGreed={fearGreed || null}
              />
            </div>
          </div>

          <div className="h-32 border-t border-border flex-shrink-0">
            <PriceTargetPanel
              klines={klines || []}
              priceToBeat={priceToBeat || 0}
              livePrice={btcPrice || 0}
            />
          </div>
        </div>

        {/* CENTER PANEL - Chart Area */}
        <div className="col-span-7 bg-card flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-1">
              {INTERVALS.map((i) => (
                <button
                  key={i.value}
                  onClick={() => setInterval(i.value)}
                  className={`px-2 py-1 text-xs rounded ${
                    interval === i.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
              <PriceChart
                data={klines || []}
                symbol={symbol}
                interval={interval}
                cryptoData={cryptoData || null}
                priceToBeat={priceToBeat || 0}
                livePrice={btcPrice || 0}
              />
            </div>
            <div className="h-64 border-t border-border">
              <IndicatorsPanel
                indicators={cryptoData?.indicators || null}
                klines={klines || []}
              />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Prediction & News */}
        <div className="col-span-3 bg-card flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto border-b border-border">
          <SignalPanel
  cryptoData={cryptoData || null}
  marketPrices={{ 
    // Use the variable names from line 37 directly
    yes: probability ?? 0, 
    no: probability ? (100 - probability) : 0 
  }}
  // Pass marketTitle to overwrite the Joe Biden news
  selectedMarket={marketTitle || "Searching for BTC Market..."}
  klines={klines || []}
  priceToBeat={priceToBeat || 0}
  btcPrice={btcPrice || 0}
/>
          </div>
          
          <div className="h-72 overflow-y-auto">
            <ContextPanel
              cryptoData={cryptoData || null}
              fundingData={fundingData || null}
              fearGreed={fearGreed || null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
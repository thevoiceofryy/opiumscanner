'use client'

import { useState } from 'react'
import TradingViewBTCChart from '@/components/tradingview-btc-chart'

import { TerminalHeader } from './terminal-header'
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

  const [interval, setInterval] = useState<TimeInterval>('1m')

  const symbol = 'BTCUSDT'

  const { data: klines } = useKlines(symbol, interval, 100)
  const { data: cryptoData } = useIndicators(symbol, interval)
  const { data: fearGreed } = useFearGreed()
  const { data: fundingData } = useFunding(symbol)

  const priceToBeat = klines?.[0]?.open ?? null

  // FIX FOR THE ERROR
const sessionLabel: 'LIVE' | 'CLOSED' = 'LIVE'

  return (

    <div className="h-screen flex flex-col bg-background overflow-hidden">

      <TerminalHeader />

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-px bg-border p-px">

        {/* Left Sidebar - Flow & Metrics */}

        <div className="col-span-2 bg-card flex flex-col overflow-hidden">

          {/* Session indicator */}

          <div className="px-3 py-2 border-b border-border flex items-center justify-between">

            <div className="flex items-center gap-2">

              <div
          className="w-2 h-2 rounded-full bg-bullish animate-pulse" />

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

          {/* PRICE TO BEAT PANEL */}

          <div className="h-32 border-t border-border flex-shrink-0">

            <PriceTargetPanel
              klines={klines || []}
              priceToBeat={priceToBeat}
              livePrice={btcPrice}
            />

          </div>

        </div>

        {/* CENTER PANEL */}

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

          <div className="flex-1 min-h-0">

            <TradingViewBTCChart priceToBeat={priceToBeat} />

          </div>

          <div className="h-64 border-t border-border">

            <IndicatorsPanel
              indicators={cryptoData?.indicators || null}
              klines={klines || []}
            />

          </div>

        </div>

        {/* RIGHT PANEL */}

        <div className="col-span-3 bg-card flex flex-col overflow-hidden">

          <SignalPanel
            cryptoData={cryptoData || null}
            marketPrices={{ yes: null, no: null }}
            selectedMarket={null}
          />

          <ContextPanel
            cryptoData={cryptoData || null}
            fundingData={fundingData || null}
            fearGreed={fearGreed || null}
          />

        </div>

      </div>

    </div>

  )

}
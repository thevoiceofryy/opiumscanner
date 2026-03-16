'use client'

import { useState, useMemo } from 'react'
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

const INTERVALS: { label: string; value: TimeInterval; limit: number }[] = [
  { label: '1s', value: '1m', limit: 60  },
  { label: '1m', value: '1m', limit: 100 },
  { label: '5m', value: '5m', limit: 100 },
  { label: '15m', value: '15m', limit: 100 },
  { label: '1H', value: '1h', limit: 100 },
  { label: '4H', value: '4h', limit: 100 },
]

export function TerminalLayout() {
  const btcPrice = useBTCPrice()
  const {
    priceToBeat, probability, marketTitle,
    clobAskYes, clobAskNo, lastResult,
    upRounds, downRounds, correctRounds, wrongRounds
  } = usePolymarketRound()

  const [intervalIdx, setIntervalIdx] = useState(3)
  const selected = INTERVALS[intervalIdx]
  const symbol = 'BTCUSDT'

  const { data: klinesData }  = useKlines(symbol, selected.value, selected.limit)
  const { data: cryptoData }  = useIndicators(symbol, selected.value)
  const { data: fearGreed }   = useFearGreed()
  const { data: fundingData } = useFunding(symbol)

  const klines = useMemo(() => klinesData || [], [klinesData])
  const sessionLabel: 'LIVE' | 'CLOSED' = 'LIVE'

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TerminalHeader />

      <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-px bg-border p-px overflow-y-auto md:overflow-hidden">

        {/* LEFT SIDEBAR */}
        <div className="col-span-12 md:col-span-2 bg-card flex flex-col overflow-hidden min-h-[400px] md:min-h-0">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-bullish animate-pulse" />
              <span className="text-xs font-medium">{sessionLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">candle</span>
              <span className="text-xs font-mono">{selected.label}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
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
          <div className="h-28 border-t border-border flex-shrink-0">
            <PriceTargetPanel
              klines={klines}
              priceToBeat={priceToBeat && priceToBeat > 0 ? priceToBeat : null}
              livePrice={btcPrice || 0}
            />
          </div>
        </div>

        {/* CENTER PANEL */}
        <div className="col-span-12 md:col-span-7 bg-card flex flex-col overflow-hidden min-h-[600px] md:min-h-0">
          <div className="px-3 py-2 border-b border-border flex items-center flex-shrink-0">
            <div className="flex items-center gap-1">
              {INTERVALS.map((item, idx) => (
                <button key={item.label} onClick={() => setIntervalIdx(idx)}
                  className={`px-2 py-1 text-xs rounded ${
                    intervalIdx === idx
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 h-0 min-h-0">
              <PriceChart
                data={klines}
                symbol={symbol}
                interval={selected.label}
                cryptoData={cryptoData || null}
                priceToBeat={priceToBeat && priceToBeat > 0 ? priceToBeat : null}
                livePrice={btcPrice || 0}
              />
            </div>
            <div className="h-96 flex-shrink-0 border-t border-border">
              <IndicatorsPanel
                indicators={cryptoData?.indicators || null}
                klines={klines}
              />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="col-span-12 md:col-span-3 bg-card flex flex-col overflow-hidden min-h-[500px] md:min-h-0">
          <div className="flex-shrink-0 border-b border-border">
            <SignalPanel
              cryptoData={cryptoData || null}
              marketPrices={{
                yes: probability ?? 0,
                no: (probability !== null && probability !== undefined) ? 100 - probability : 0,
              }}
              selectedMarket={marketTitle || 'Searching for BTC Market...'}
              priceToBeat={priceToBeat || 0}
              btcPrice={btcPrice || 0}
              clobAskYes={clobAskYes}
              clobAskNo={clobAskNo}
              lastResult={lastResult}
              upRounds={upRounds}
              downRounds={downRounds}
              correctRounds={correctRounds}
              wrongRounds={wrongRounds}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ContextPanel />
          </div>
        </div>

      </div>
    </div>
  )
}
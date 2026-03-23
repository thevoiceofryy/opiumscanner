'use client'

import { useMemo } from 'react'
import { usePolymarketRound } from '@/hooks/use-polymarket-round'
import { useChartSync } from '@/hooks/use-chart-sync'
import { TerminalHeader } from './terminal-header'
import { PriceChart } from './price-chart'
import { IndicatorsPanel } from './indicators-panel'
import { MetricsPanel } from './metrics-panel'
import { SignalPanel } from './signal-panel'
import { ContextPanel } from './context-panel'
import { FlowPanel } from './flow-panel'
import { PriceTargetPanel } from './price-target-panel'
import { useBTCPrice } from '@/hooks/use-btc-price'
import { useTargetPriceWebSocket } from '@/hooks/use-target-price-websocket'
import { AnnouncementBanner } from './announcement-banner'

import {
  useKlines,
  useIndicators,
  useFearGreed,
  useFunding
} from '@/hooks/use-market-data'

const selected = { label: '15m', value: '15m' as const, limit: 100 }

export function TerminalLayout() {
  const btcPrice = useBTCPrice()
  const { chainlinkLive } = useTargetPriceWebSocket()
const {
  priceToBeat, probability, marketTitle,
currentPrice, diffPct, bias,
    clobAskYes, clobAskNo, bookDepth, lastResult,
upRounds, downRounds, correctRounds, wrongRounds, resultsLog
  } = usePolymarketRound()

  const symbol = 'BTCUSDT'

  const { data: klinesData }  = useKlines(symbol, selected.value, selected.limit)
  const { data: cryptoData }  = useIndicators(symbol, selected.value)
  const { data: fearGreed }   = useFearGreed()
  const { data: fundingData } = useFunding(symbol)

  const klines = useMemo(() => klinesData || [], [klinesData])
  const sessionLabel: 'LIVE' | 'CLOSED' = 'LIVE'
  const { registerChart, unregisterChart } = useChartSync()

  const yesPrice = clobAskYes ?? null
  const noPrice  = clobAskNo  ?? null

  return (
<div className="flex flex-col h-full min-h-0 bg-background overflow-hidden">
      <TerminalHeader />
      <AnnouncementBanner />
<div className="px-3 py-2 border-b border-border text-xs font-mono flex gap-4 overflow-hidden">

  <div>
    <span className="text-gray-400">PTB:</span>{' '}
    <span>${priceToBeat?.toFixed(2)}</span>
  </div>

  <div>
    <span className="text-gray-400">BTC:</span>{' '}
    <span>${currentPrice?.toFixed(2)}</span>
  </div>

  <div>
    <span className="text-gray-400">Δ:</span>{' '}
    <span>{diffPct.toFixed(2)}%</span>
  </div>

  <div>
    <span className="text-gray-400">BIAS:</span>{' '}
    <span className={
      bias === 'UP'
        ? 'text-green-400'
        : bias === 'DOWN'
        ? 'text-red-400'
        : 'text-gray-400'
    }>
      {bias}
    </span>
  </div>

</div>
<div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-0.5 bg-border p-0.5 overflow-hidden min-h-0">        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
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
<div className="flex-1 overflow-hidden min-h-0">
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

        {/* ── CENTER ───────────────────────────────────────────────────────── */}
        <div className="col-span-12 md:col-span-7 bg-card flex flex-col overflow-hidden min-h-[600px] md:min-h-0">

          <div style={{ flex: 3, minHeight: 0 }}>
            <PriceChart
              data={klines}
              symbol={symbol}
              interval={selected.label}
              cryptoData={cryptoData || null}
              priceToBeat={priceToBeat && priceToBeat > 0 ? priceToBeat : null}
              livePrice={btcPrice || 0}
              onChartReady={(ts) => registerChart('price', ts)}
              onChartDestroy={() => unregisterChart('price')}
            />
          </div>

          <div
            className="flex items-center px-3 gap-3 flex-shrink-0 font-mono"
            style={{
              height: '28px',
              borderTop: '1px solid #1a2332',
              borderBottom: '1px solid #1a2332',
              background: '#080b10',
            }}
          >
            {yesPrice != null && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-[#6b7280]">YES</span>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 rounded">
                  {Math.round(yesPrice * 100)}¢
                </span>
              </div>
            )}
            {noPrice != null && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-[#6b7280]">NO</span>
                <span className="text-[11px] font-bold text-red-400 bg-red-950/60 px-1.5 rounded">
                  {Math.round(noPrice * 100)}¢
                </span>
              </div>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-[#4b5563]">7.1m</span>
              <div className="w-8 h-px bg-[#3b82f6]" />
            </div>
          </div>

          <div style={{ flex: 2, minHeight: 0 }}>
            <IndicatorsPanel
              indicators={cryptoData as any}
              klines={klines}
              onChartReady={(id, ts) => registerChart(id, ts)}
              onChartDestroy={(id) => unregisterChart(id)}
            />
          </div>

        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
        <div className="col-span-12 md:col-span-3 bg-card flex flex-col overflow-hidden min-h-[500px] md:min-h-0">
          <div className="flex-shrink-0 border-b border-border">
<SignalPanel
  cryptoData={cryptoData || null}
  marketPrices={{
yes: yesPrice ? yesPrice * 100 : 0,
    no: (probability !== null && probability !== undefined) ? 100 - probability : 0,
  }}
  selectedMarket={marketTitle || 'Searching for BTC Market...'}
  priceToBeat={priceToBeat || 0}
  btcPrice={chainlinkLive || btcPrice || 0}
  bias={bias}
  diffPct={diffPct}
  clobAskYes={clobAskYes}
  clobAskNo={clobAskNo}
  bookDepth={bookDepth}
  lastResult={lastResult}
  upRounds={upRounds}
  downRounds={downRounds}
  correctRounds={correctRounds}
  wrongRounds={wrongRounds}
  resultsLog={resultsLog}
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
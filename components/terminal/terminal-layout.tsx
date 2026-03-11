'use client'

import { useState, useMemo, useEffect } from 'react'
import { TerminalHeader } from './terminal-header'
import { PriceChart } from './price-chart'
import { IndicatorsPanel } from './indicators-panel'
import { MetricsPanel } from './metrics-panel'
import { SignalPanel } from './signal-panel'
import { ContextPanel } from './context-panel'
import { FlowPanel } from './flow-panel'
import { PriceTargetPanel } from './price-target-panel'
import { MarketSearch } from './market-search'
import { useKlines, useIndicators, useFearGreed, useFunding, useMarketPrices, useMarketDetails } from '@/hooks/use-market-data'
import { extractSymbolFromMarket } from '@/lib/utils'
import type { Market, TimeInterval } from '@/lib/types'

const INTERVALS: { value: TimeInterval; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
]

export function TerminalLayout() {
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [interval, setInterval] = useState<TimeInterval>('1m')
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [priceToBeat, setPriceToBeat] = useState<number | null>(null)

  // Update symbol when market is selected
  useEffect(() => {
    if (selectedMarket) {
      const extractedSymbol = extractSymbolFromMarket(selectedMarket.question)
      setSymbol(extractedSymbol)
      // Reset priceToBeat while we load details for the new market
      setPriceToBeat(null)
    } else {
      setPriceToBeat(null)
    }
  }, [selectedMarket])

  // Data hooks
  const { data: klines } = useKlines(symbol, interval, 100)
  const { data: cryptoData } = useIndicators(symbol, interval)
  const { data: fearGreed } = useFearGreed()
  const { data: fundingData } = useFunding(symbol)
  
  // Fetch market details when a market is selected (by slug so we can match Polymarket exactly)
  const { data: marketDetails } = useMarketDetails(selectedMarket?.slug || null)

  // Update price to beat from market details
  useEffect(() => {
    // Use the price to beat from market details (based on Polymarket round start timestamp)
    if (marketDetails?.priceToBeat !== undefined && marketDetails.priceToBeat !== null) {
      setPriceToBeat(marketDetails.priceToBeat)
    }
  }, [marketDetails])

  // Market prices for YES/NO tokens
  const yesTokenId = selectedMarket?.clobTokenIds?.[0] || null
  const noTokenId = selectedMarket?.clobTokenIds?.[1] || null
  const { data: yesPrices } = useMarketPrices(yesTokenId)
  const { data: noPrices } = useMarketPrices(noTokenId)

  // Determine trading session
  const sessionLabel = useMemo(() => {
    const now = new Date()
    const nyHour = parseInt(now.toLocaleTimeString('en-US', { 
      timeZone: 'America/New_York', 
      hour: '2-digit', 
      hour12: false 
    }))
    
    if (nyHour >= 9 && nyHour < 16) return 'NY_OPEN'
    if (nyHour >= 2 && nyHour < 9) return 'LONDON'
    if (nyHour >= 20 || nyHour < 2) return 'ASIA'
    return 'CLOSED'
  }, [])

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TerminalHeader 
        selectedMarket={selectedMarket}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Main Content Grid */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-px bg-border p-px">
        {/* Left Sidebar - Flow & Metrics */}
        <div className="col-span-2 bg-card flex flex-col overflow-hidden">
          {/* Session indicator */}
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${sessionLabel === 'CLOSED' ? 'bg-muted' : 'bg-bullish animate-pulse'}`} />
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
          
          {/* Price Target Mini */}
          <div className="h-48 border-t border-border">
            <PriceTargetPanel 
              klines={klines || []}
              cryptoData={cryptoData || null}
              yesPrices={yesPrices || null}
              priceToBeat={priceToBeat}
            />
          </div>
        </div>

        {/* Center - Charts */}
        <div className="col-span-7 bg-card flex flex-col overflow-hidden">
          {/* Interval Selector */}
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-1">
              {INTERVALS.map((i) => (
                <button
                  key={i.value}
                  onClick={() => setInterval(i.value)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    interval === i.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {i.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">ATR</span>
              <span className="font-mono transition-all duration-500">${cryptoData?.indicators?.atr?.toFixed(0) || '--'}</span>
              <span className="text-muted-foreground">RSI</span>
              <span className={`font-mono transition-all duration-500 ${
                cryptoData?.indicators?.rsi && cryptoData.indicators.rsi > 70 ? 'text-bearish' :
                cryptoData?.indicators?.rsi && cryptoData.indicators.rsi < 30 ? 'text-bullish' :
                'text-foreground'
              }`}>
                {cryptoData?.indicators?.rsi?.toFixed(0) || '--'}
              </span>
            </div>
          </div>

          {/* Price Chart */}
          <div className="flex-1 min-h-0">
            <PriceChart 
              data={klines || []}
              symbol={symbol}
              interval={interval}
              cryptoData={cryptoData || null}
              selectedMarket={selectedMarket || null}
              priceToBeat={priceToBeat}
            />
          </div>

          {/* Indicators */}
          <div className="h-64 border-t border-border">
            <IndicatorsPanel 
              indicators={cryptoData?.indicators || null}
              klines={klines || []}
            />
          </div>

          {/* Market Prices Bar */}
          {selectedMarket && (
            <div className="px-4 py-2 border-t border-border flex items-center justify-between bg-secondary/30">
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground truncate max-w-md">
                  {selectedMarket.question}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">YES</span>
                  <span className="text-bullish font-semibold">
                    {yesPrices?.midPrice ? `${(yesPrices.midPrice * 100).toFixed(0)}c` : '--'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">NO</span>
                  <span className="text-bearish font-semibold">
                    {noPrices?.midPrice ? `${(noPrices.midPrice * 100).toFixed(0)}c` : '--'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Signal & Context */}
        <div className="col-span-3 bg-card flex flex-col overflow-hidden">
          {/* Signal Panel */}
          <div className="flex-1 min-h-0 overflow-y-auto border-b border-border">
            <SignalPanel 
              cryptoData={cryptoData || null}
              marketPrices={{ yes: yesPrices || null, no: noPrices || null }}
            />
          </div>

          {/* Context Panel */}
          <div className="h-72 overflow-y-auto">
            <ContextPanel 
              cryptoData={cryptoData || null}
              fundingData={fundingData || null}
              fearGreed={fearGreed || null}
            />
          </div>
        </div>
      </div>

      {/* Market Search Modal */}
      <MarketSearch 
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectMarket={setSelectedMarket}
        currentMarketId={selectedMarket?.id}
      />
    </div>
  )
}

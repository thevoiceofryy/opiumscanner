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

import {
  useKlines,
  useIndicators,
  useFearGreed,
  useFunding,
  useMarketPrices,
  useMarketDetails
} from '@/hooks/use-market-data'

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
  const [interval, setInterval] = useState<TimeInterval>('1m')
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [priceToBeat, setPriceToBeat] = useState<number | null>(null)

  /*
  -------------------------------------------------
  Detect crypto symbol inside market question
  -------------------------------------------------
  */

  useEffect(() => {

    if (!selectedMarket) return

    const cryptoSymbols = [
      "BTC","ETH","SOL","DOGE","XRP","ADA","AVAX","BNB"
    ]

    const words = selectedMarket.question.toUpperCase().split(" ")

    const found = cryptoSymbols.find(sym => words.includes(sym))

    if (found) {
      setSymbol(found + "USDT")
    }

    setPriceToBeat(null)

  }, [selectedMarket])

  /*
  -------------------------------------------------
  Crypto data
  -------------------------------------------------
  */

  const { data: klines } = useKlines(symbol, interval, 100)
  const { data: cryptoData } = useIndicators(symbol, interval)
  const { data: fearGreed } = useFearGreed()
  const { data: fundingData } = useFunding(symbol)

  /*
  -------------------------------------------------
  Market details
  -------------------------------------------------
  */

  const { data: marketDetails } = useMarketDetails(selectedMarket?.slug || null)

  useEffect(() => {
    if (marketDetails?.priceToBeat !== undefined && marketDetails?.priceToBeat !== null) {
      setPriceToBeat(marketDetails.priceToBeat)
    }
  }, [marketDetails])

 /*
---------------------------------
Extract YES / NO token IDs
---------------------------------
*/

let yesTokenId: string | null = null
let noTokenId: string | null = null

if ((marketDetails as any)?.tokens?.length) {

  const yesToken = (marketDetails as any).tokens.find(
    (t: any) => t.outcome?.toLowerCase() === 'yes'
  )

  const noToken = (marketDetails as any).tokens.find(
    (t: any) => t.outcome?.toLowerCase() === 'no'
  )

  if (yesToken) {
    yesTokenId = yesToken.token_id
  }

  if (noToken) {
    noTokenId = noToken.token_id
  }
}


  /*
  -------------------------------------------------
  Prices
  -------------------------------------------------
  */

  const { data: yesPrices } = useMarketPrices(yesTokenId)
  const { data: noPrices } = useMarketPrices(noTokenId)

  /*
  -------------------------------------------------
  Trading session label
  -------------------------------------------------
  */

  const sessionLabel = useMemo(() => {

    const now = new Date()

    const nyHour = parseInt(
      now.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        hour12: false
      })
    )

    if (nyHour >= 9 && nyHour < 16) return 'NY_OPEN'
    if (nyHour >= 2 && nyHour < 9) return 'LONDON'
    if (nyHour >= 20 || nyHour < 2) return 'ASIA'

    return 'CLOSED'

  }, [])

  /*
  -------------------------------------------------
  Render
  -------------------------------------------------
  */

  return (

    <div className="h-screen flex flex-col bg-background overflow-hidden">

      <TerminalHeader
        selectedMarket={selectedMarket}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => {}}
      />

      <div className="flex-1 grid grid-cols-12 gap-px bg-border p-px">

        {/* LEFT PANEL */}

        <div className="col-span-2 bg-card flex flex-col overflow-hidden">

          <div className="px-3 py-2 border-b border-border flex justify-between">

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                sessionLabel === 'CLOSED'
                  ? 'bg-muted'
                  : 'bg-bullish animate-pulse'
              }`} />
              <span className="text-xs font-medium">{sessionLabel}</span>
            </div>

            <span className="text-xs font-mono">{interval}</span>

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

          <div className="h-48 border-t border-border">

            <PriceTargetPanel
              klines={klines || []}
              cryptoData={cryptoData || null}
              yesPrices={yesPrices || null}
              priceToBeat={priceToBeat}
            />

          </div>

        </div>

        {/* CENTER PANEL */}

        <div className="col-span-7 bg-card flex flex-col overflow-hidden">

          <div className="px-3 py-2 border-b border-border flex gap-1">

            {INTERVALS.map(i => (

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

          {/* CHART SWITCH */}

          <div className="flex-1">

          {selectedMarket ? (

<PriceChart
data={klines || []}
symbol={selectedMarket.question}
interval={interval}
cryptoData={cryptoData || null}
selectedMarket={selectedMarket}
priceToBeat={priceToBeat}
/>

) : (

              <PriceChart
                data={klines || []}
                symbol={symbol}
                interval={interval}
                cryptoData={cryptoData || null}
                selectedMarket={null}
                priceToBeat={null}
              />

            )}

          </div>

          <div className="h-64 border-t border-border">

            <IndicatorsPanel
              indicators={cryptoData?.indicators || null}
              klines={klines || []}
            />

          </div>

          {selectedMarket && (

            <div className="px-4 py-2 border-t border-border flex justify-between bg-secondary/30">

              <span className="text-xs text-muted-foreground truncate max-w-md">
                {selectedMarket.question}
              </span>

              <div className="flex gap-4 text-sm">

                <div className="flex gap-2">
                  <span className="text-muted-foreground">YES</span>
                  <span className="text-bullish font-semibold">
                    {(yesPrices as any)?.price
                      ? `${((yesPrices as any).price * 100).toFixed(0)}c`
                      : '--'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <span className="text-muted-foreground">NO</span>
                  <span className="text-bearish font-semibold">
                    {(noPrices as any)?.price
                      ? `${((noPrices as any).price * 100).toFixed(0)}c`
                      : '--'}
                  </span>
                </div>

              </div>

            </div>

          )}

        </div>

        {/* RIGHT PANEL */}

        <div className="col-span-3 bg-card flex flex-col overflow-hidden">

          <div className="flex-1 overflow-y-auto border-b border-border">

            <SignalPanel
              cryptoData={cryptoData || null}
              marketPrices={{
                yes: yesPrices || null,
                no: noPrices || null
              }}
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

      <MarketSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectMarket={setSelectedMarket}
        currentMarketId={selectedMarket?.id}
      />

    </div>

  )
}
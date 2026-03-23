'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useMarkets } from '@/hooks/use-market-data'
import type { Market } from '@/lib/types'

interface MarketSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectMarket: (market: Market) => void
  currentMarketId?: string
}

export function MarketSearch({
  open,
  onOpenChange,
  onSelectMarket,
  currentMarketId,
}: MarketSearchProps) {

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const { data: markets = [], isLoading } = useMarkets(debouncedQuery)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm">

      <div className="w-[650px] max-h-[600px] bg-card border border-border rounded-lg shadow-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted-foreground" />

          <input
            autoFocus
            placeholder="Search Polymarket markets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
          />

          <button
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[500px] overflow-hidden">

          {isLoading && (
            <div className="p-4 text-sm text-muted-foreground">
              Loading markets...
            </div>
          )}

          {!isLoading && markets.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              No markets found
            </div>
          )}

          {markets.map((market: Market) => {

            const isActive = currentMarketId === market.id

            // safely parse outcome prices
            let yes = 0
            let no = 0

            if (market.outcomePrices) {
              try {
                const prices =
                  typeof market.outcomePrices === 'string'
                    ? JSON.parse(market.outcomePrices)
                    : market.outcomePrices

                yes = prices?.[0] ? parseFloat(prices[0]) : 0
                no = prices?.[1] ? parseFloat(prices[1]) : 0
              } catch {
                yes = 0
                no = 0
              }
            }

            return (
              <div
                key={market.id}
                onClick={() => {
                  onSelectMarket(market)
                  onOpenChange(false)
                }}
                className={`flex items-start gap-3 p-3 border-b border-border cursor-pointer transition-colors
                  ${isActive ? 'bg-accent' : 'hover:bg-accent'}
                `}
              >

                {/* Market info */}
                <div className="flex-1">

                  <div className="text-sm font-medium">
                    {market.question}
                  </div>

                  <div className="text-xs text-muted-foreground mt-1">
                    Volume: ${market.volume?.toLocaleString() || '0'}
                  </div>

                </div>

                {/* YES / NO prices */}
                <div className="text-right text-xs">

                  <div className="text-bullish">
                    YES {yes.toFixed(2)}
                  </div>

                  <div className="text-bearish">
                    NO {no.toFixed(2)}
                  </div>

                </div>

              </div>
            )
          })}

        </div>

      </div>

    </div>
  )
}
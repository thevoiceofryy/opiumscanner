'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Star, X, TrendingUp, Clock, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMarkets } from '@/hooks/use-market-data'
import { createClient } from '@/lib/supabase/client'
import type { Market, UserMarket } from '@/lib/types'
import useSWR from 'swr'

interface MarketSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectMarket: (market: Market) => void
  currentMarketId?: string
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function MarketSearch({ open, onOpenChange, onSelectMarket, currentMarketId }: MarketSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Get user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
    })
  }, [supabase.auth])

  // Fetch markets based on search
  const { data: markets, isLoading } = useMarkets(debouncedQuery)

  // Fetch user's saved markets
  const { data: savedMarkets, mutate: mutateSaved } = useSWR<UserMarket[]>(
    userId ? `/api/user/markets` : null,
    fetcher
  )

  const savedMarketIds = new Set(savedMarkets?.map(m => m.market_id) || [])

  const toggleSaveMarket = useCallback(async (market: Market, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId) return

    const isSaved = savedMarketIds.has(market.id)

    if (isSaved) {
      await supabase
        .from('user_markets')
        .delete()
        .eq('user_id', userId)
        .eq('market_id', market.id)
    } else {
      await supabase
        .from('user_markets')
        .insert({
          user_id: userId,
          market_id: market.id,
          market_slug: market.slug,
          market_title: market.question,
          token_id: market.clobTokenIds?.[0] || null
        })
    }

    mutateSaved()
  }, [userId, savedMarketIds, supabase, mutateSaved])

  const handleSelectMarket = (market: Market) => {
    onSelectMarket(market)
    onOpenChange(false)
    setQuery('')
  }

  // Format volume
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`
    return `$${volume.toFixed(0)}`
  }

  // Get YES price
  const getYesPrice = (market: Market) => {
    if (!market.outcomePrices) return '--'
    const prices = typeof market.outcomePrices === 'string' 
      ? JSON.parse(market.outcomePrices) 
      : market.outcomePrices
    return prices[0] ? `${(parseFloat(prices[0]) * 100).toFixed(0)}c` : '--'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Polymarket
          </DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search markets by keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Saved Markets Section */}
        {savedMarkets && savedMarkets.length > 0 && !query && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-warning" />
              <span className="text-sm font-medium">Saved Markets</span>
            </div>
            <div className="grid gap-2">
              {savedMarkets.slice(0, 3).map((saved) => (
                <button
                  key={saved.id}
                  onClick={() => {
                    const market = markets?.find(m => m.id === saved.market_id)
                    if (market) handleSelectMarket(market)
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                    currentMarketId === saved.market_id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary/50 hover:bg-secondary'
                  }`}
                >
                  <span className="text-sm truncate flex-1">{saved.market_title}</span>
                  <Star className="w-4 h-4 text-warning fill-warning flex-shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Markets List */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : markets && markets.length > 0 ? (
            <div className="grid gap-2 pb-4">
              {markets.map((market) => (
                <button
                  key={market.id}
                  onClick={() => handleSelectMarket(market)}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left group ${
                    currentMarketId === market.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary/30 hover:bg-secondary/60'
                  }`}
                >
                  {/* Market Image */}
                  {market.image ? (
                    <img 
                      src={market.image} 
                      alt="" 
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}

                  {/* Market Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1">
                      {market.question}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="text-bullish font-medium">
                        YES {getYesPrice(market)}
                      </span>
                      <span>Vol: {formatVolume(market.volume || 0)}</span>
                      {market.endDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(market.endDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {userId && (
                      <button
                        onClick={(e) => toggleSaveMarket(market, e)}
                        className="p-1.5 rounded hover:bg-accent transition-colors"
                      >
                        <Star 
                          className={`w-4 h-4 ${
                            savedMarketIds.has(market.id) 
                              ? 'text-warning fill-warning' 
                              : 'text-muted-foreground'
                          }`} 
                        />
                      </button>
                    )}
                    <a
                      href={`https://polymarket.com/event/${market.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                  </div>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-8 h-8 mb-2" />
              <p>No markets found for "{query}"</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <TrendingUp className="w-8 h-8 mb-2" />
              <p>Search for prediction markets</p>
              <p className="text-sm">Try "bitcoin", "election", or "sports"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {markets?.length || 0} markets found
          </span>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

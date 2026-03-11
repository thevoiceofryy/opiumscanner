'use client'

import useSWR from 'swr'
import type { Market, MarketPrice, Kline, CryptoData, FearGreed, FundingData } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Polymarket hooks
export function useMarkets(query?: string) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  params.set('limit', '50')
  
  return useSWR<Market[]>(
    `/api/polymarket/markets?${params}`,
    fetcher,
    { refreshInterval: 30000 }
  )
}

export function useMarketPrices(tokenId: string | null) {
  return useSWR<MarketPrice>(
    tokenId ? `/api/polymarket/prices?tokenId=${tokenId}` : null,
    fetcher,
    {
      // Faster refresh so the YES/NO edge and signal panel update live
      refreshInterval: 1000,
      dedupingInterval: 500,
    }
  )
}

export function useMarketDetails(marketSlug: string | null) {
  return useSWR(
    marketSlug ? `/api/polymarket/market-details?slug=${encodeURIComponent(marketSlug)}` : null,
    fetcher,
    { refreshInterval: 10000 }
  )
}

// Crypto hooks
export function useKlines(symbol: string = 'BTCUSDT', interval: string = '1m', limit: number = 100) {
  return useSWR<Kline[]>(
    `/api/crypto/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    fetcher,
    {
      refreshInterval: 500,
      dedupingInterval: 200
    }
  )
}

export function useIndicators(symbol: string = 'BTCUSDT', interval: string = '1m') {
  return useSWR<CryptoData>(
    `/api/crypto/indicators?symbol=${symbol}&interval=${interval}`,
    fetcher,
    {
      refreshInterval: 200, // 5 updates per second
      dedupingInterval: 100,
      revalidateOnFocus: true
    }
  )
}

export function useFearGreed() {
  return useSWR<FearGreed>(
    '/api/crypto/fear-greed',
    fetcher,
    { refreshInterval: 300000 } // 5 minutes
  )
}

export function useFunding(symbol: string = 'BTCUSDT') {
  return useSWR<FundingData>(
    `/api/crypto/funding?symbol=${symbol}`,
    fetcher,
    { refreshInterval: 60000 }
  )
}


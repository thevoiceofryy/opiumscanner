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
    { refreshInterval: 5000 }
  )
}

export function useMarketDetails(marketId: string | null) {
  return useSWR(
    marketId ? `/api/polymarket/market-details?id=${marketId}` : null,
    fetcher,
    { refreshInterval: 10000 }
  )
}

export interface MarketHistoryPoint {
  timestamp: number
  price: number
}

export function useMarketHistory(tokenId: string | null, fidelity: number = 60) {
  return useSWR<{ history: MarketHistoryPoint[]; isMock: boolean }>(
    tokenId ? `/api/polymarket/history?tokenId=${tokenId}&fidelity=${fidelity}` : null,
    fetcher,
    { refreshInterval: 60000 } // 1 minute
  )
}

// Crypto hooks
interface KlinesResponse {
  data: Kline[]
  isMock: boolean
}

export function useKlines(symbol: string = 'BTCUSDT', interval: string = '1m', limit: number = 100) {
  const result = useSWR<KlinesResponse>(
    `/api/crypto/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    fetcher,
    { refreshInterval: 1000, dedupingInterval: 500 } // 1 second for live feed
  )

  // Return with backwards-compatible data extraction
  return {
    ...result,
    data: result.data?.data,
    isMock: result.data?.isMock ?? false
  }
}

export function useIndicators(symbol: string = 'BTCUSDT', interval: string = '1m') {
  return useSWR<CryptoData>(
    `/api/crypto/indicators?symbol=${symbol}&interval=${interval}`,
    fetcher,
    { refreshInterval: 1000, dedupingInterval: 500 } // ~1s live updates
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


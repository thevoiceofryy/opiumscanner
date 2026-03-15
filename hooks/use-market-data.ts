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
    { refreshInterval: 60000 }
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
    {
      // FIX: was refreshInterval:1000 with dedupingInterval:500
      // — first render had to wait up to 500ms for dedup window.
      // Now: revalidateOnMount forces an immediate fetch on every mount,
      // dedupingInterval:0 means no request is suppressed,
      // and refreshInterval:1000 keeps it live after that.
      revalidateOnMount: true,
      dedupingInterval: 0,
      refreshInterval: 1000,
      // Keep previous data visible while revalidating — no flicker/blank chart
      keepPreviousData: true,
    }
  )

  return {
    ...result,
    data: result.data?.data,
    isMock: result.data?.isMock ?? false,
  }
}

export function useIndicators(symbol: string = 'BTCUSDT', interval: string = '1m') {
  return useSWR<CryptoData>(
    `/api/crypto/indicators?symbol=${symbol}&interval=${interval}`,
    fetcher,
    {
      revalidateOnMount: true,
      dedupingInterval: 0,
      refreshInterval: 1000,
      keepPreviousData: true,
    }
  )
}

export function useFearGreed() {
  return useSWR<FearGreed>(
    '/api/crypto/fear-greed',
    fetcher,
    { refreshInterval: 300000 }
  )
}

export function useFunding(symbol: string = 'BTCUSDT') {
  return useSWR<FundingData>(
    `/api/crypto/funding?symbol=${symbol}`,
    fetcher,
    { refreshInterval: 60000 }
  )
}
// Polymarket Types
export interface Market {
  id: string
  slug: string
  question: string
  description: string
  outcomes: string[]
  outcomePrices: string[] | null
  volume: number
  liquidity: number
  startDate: string
  endDate: string
  image: string
  icon: string
  active: boolean
  closed: boolean
  clobTokenIds: string[] | null
  // Price-related fields
  conditions?: any
  priceBeat?: number | null
  referencePrice?: number | null
  creationPrice?: number | null
  minBid?: number | null
  maxAsk?: number | null
  bestBid?: number | null
  bestAsk?: number | null
}

export interface MarketPrice {
  tokenId: string
  bestBid: number | null
  bestAsk: number | null
  midPrice: number | null
  spread: number | null
  bidLiquidity: number
  askLiquidity: number
  bids: { price: string; size: string }[]
  asks: { price: string; size: string }[]
  timestamp: number
}

// Crypto Types
export interface Kline {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closeTime: number
  quoteVolume: number
  trades: number
}

export interface Indicators {
  rsi: number
  rsiSignal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL'
  macd: number
  macdSignal: number
  macdHistogram: number
  macdTrend: 'BULLISH' | 'BEARISH'
  atr: number
  stochK: number
  stochD: number
  stochSignal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL'
  vwap: number
  vwapDeviation: number
  sma20: number
  sma50: number
  trend: 'UP' | 'DOWN' | 'NEUTRAL'
}

export interface CryptoData {
  symbol: string
  interval: string
  price: number
  open: number
  high: number
  low: number
  priceChange: number
  priceChangePercent: number
  volume: number
  indicators: Indicators
  timestamp: number
}

export interface FearGreed {
  value: number
  classification: string
  timestamp: number
  timeUntilUpdate?: string
  error?: string
}

export interface FundingData {
  symbol: string
  fundingRate: number
  fundingRateBps: number
  nextFundingTime?: number
  openInterest: number
  longShortRatio: number
  longPercent: number
  shortPercent: number
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  timestamp: number
  error?: string
}

// User Types
export interface UserMarket {
  id: string
  user_id: string
  market_id: string
  market_slug: string
  market_title: string
  token_id: string | null
  is_primary: boolean
  created_at: string
}

export interface UserSettings {
  id: string
  user_id: string
  crypto_pair: string
  timeframe: string
  theme: string
  created_at: string
  updated_at: string
}

// Signal Types
export interface Signal {
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  strength: number
  confidence: number
  reasons: string[]
}

export type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

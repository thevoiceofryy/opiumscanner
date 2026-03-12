'use client'

import type { Kline, Indicators } from '@/lib/types'

interface IndicatorsPanelProps {
  indicators: Indicators | null
  klines: Kline[]
}

export function IndicatorsPanel({ indicators }: IndicatorsPanelProps) {
  const hasData = !!indicators

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Market Indicators
        </span>
        {hasData && (
          <span className="text-[10px] text-muted-foreground font-mono">
            Trend: <span className="font-semibold">{indicators?.trend}</span>
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {!hasData && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Syncing indicator data...
          </div>
        )}

        {hasData && indicators && (
          <div className="grid grid-cols-2 gap-3">
            {/* RSI */}
            <div className="p-2 rounded border border-border/40 bg-muted/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  RSI
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    indicators.rsiSignal === 'OVERBOUGHT'
                      ? 'bg-bearish/20 text-bearish'
                      : indicators.rsiSignal === 'OVERSOLD'
                      ? 'bg-bullish/20 text-bullish'
                      : 'bg-muted/30 text-muted-foreground'
                  }`}
                >
                  {indicators.rsiSignal}
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-lg font-semibold">{indicators.rsi.toFixed(1)}</span>
                <span className="text-[10px] text-muted-foreground">0–100</span>
              </div>
              <div className="w-full h-1.5 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, indicators.rsi))}%` }}
                />
              </div>
            </div>

            {/* MACD */}
            <div className="p-2 rounded border border-border/40 bg-muted/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  MACD
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    indicators.macdTrend === 'BULLISH'
                      ? 'bg-bullish/20 text-bullish'
                      : 'bg-bearish/20 text-bearish'
                  }`}
                >
                  {indicators.macdTrend}
                </span>
              </div>
              <div className="font-mono flex justify-between">
                <span>Line: {(indicators.macd ?? 0).toFixed(3)}</span>
                <span>Sig: {(indicators.macdSignal ?? 0).toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>Hist</span>
                <span
                  className={
                    (indicators.macdHistogram ?? 0) >= 0
                      ? 'text-bullish font-semibold'
                      : 'text-bearish font-semibold'
                  }
                >
                  {(indicators.macdHistogram ?? 0).toFixed(3)}
                </span>
              </div>
            </div>

            {/* Stochastic RSI */}
            <div className="p-2 rounded border border-border/40 bg-muted/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Stoch RSI
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    indicators.stochSignal === 'OVERBOUGHT'
                      ? 'bg-bearish/20 text-bearish'
                      : indicators.stochSignal === 'OVERSOLD'
                      ? 'bg-bullish/20 text-bullish'
                      : 'bg-muted/30 text-muted-foreground'
                  }`}
                >
                  {indicators.stochSignal}
                </span>
              </div>
              <div className="font-mono flex justify-between">
                <span>K: {(indicators.stochK ?? 0).toFixed(1)}</span>
                <span>D: {(indicators.stochD ?? 0).toFixed(1)}</span>
              </div>
              <div className="w-full h-1.5 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary/70 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, indicators.stochK ?? 0))}%`,
                  }}
                />
              </div>
            </div>

            {/* ATR */}
            <div className="p-2 rounded border border-border/40 bg-muted/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  ATR (Volatility)
                </span>
              </div>
              <div className="font-mono flex justify-between">
                <span className="text-lg font-semibold">
                  {(indicators.atr ?? 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground">pts</span>
              </div>
              <div className="w-full h-1.5 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(10, indicators.atr ?? 0))}%`,
                  }}
                />
              </div>
            </div>

            {/* VWAP */}
            <div className="p-2 rounded border border-border/40 bg-muted/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  VWAP
                </span>
              </div>
              <div className="font-mono flex justify-between">
                <span>{(indicators.vwap ?? 0).toFixed(2)}</span>
                <span
                  className={
                    (indicators.vwapDeviation ?? 0) >= 0
                      ? 'text-bullish text-[10px]'
                      : 'text-bearish text-[10px]'
                  }
                >
                  {(indicators.vwapDeviation ?? 0) >= 0 ? '+' : ''}
                  {(indicators.vwapDeviation ?? 0).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Moving Averages / Trend */}
            <div className="p-2 rounded border border-border/40 bg-muted/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Moving Averages
                </span>
              </div>
              <div className="font-mono flex justify-between">
                <span>EMA 20: {(indicators.sma20 ?? 0).toFixed(2)}</span>
              </div>
              <div className="font-mono flex justify-between text-[11px]">
                <span>EMA 50: {(indicators.sma50 ?? 0).toFixed(2)}</span>
                <span
                  className={
                    indicators.trend === 'UP'
                      ? 'text-bullish font-semibold'
                      : indicators.trend === 'DOWN'
                      ? 'text-bearish font-semibold'
                      : 'text-muted-foreground'
                  }
                >
                  {indicators.trend}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

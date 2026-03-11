'use client'

import { useState, useEffect } from 'react'
import type { Kline, Indicators } from '@/lib/types'

interface IndicatorsPanelProps {
  indicators: Indicators | null
  klines: Kline[]
}

interface PolymarketNews {
  id: string
  title: string
  timestamp: string
  sentiment?: string
}

export function IndicatorsPanel({ indicators, klines }: IndicatorsPanelProps) {
  const [news, setNews] = useState<PolymarketNews[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPolymarketNews = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/polymarket/news')
        if (response.ok) {
          const data = await response.json()
          setNews(data.news || [])
        }
      } catch (error) {
        console.error('Failed to fetch polymarket news:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPolymarketNews()
    const interval = setInterval(fetchPolymarketNews, 10000) // Refresh every 10 seconds for live updates

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Polymarket News Header */}
      <div className="px-3 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Polymarket News</span>
      </div>

      {/* News Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-muted-foreground">Loading news...</span>
          </div>
        ) : news.length > 0 ? (
          <div className="divide-y divide-border">
            {news.map((item) => (
              <div key={item.id} className="p-3 hover:bg-accent/50 transition-colors border-l-2 border-l-info animate-in fade-in duration-500">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-medium line-clamp-2 flex-1">{item.title}</p>
                  {item.sentiment && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap transition-all duration-500 ${
                      item.sentiment === 'bullish' ? 'bg-bullish/20 text-bullish' :
                      item.sentiment === 'bearish' ? 'bg-bearish/20 text-bearish' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {item.sentiment.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(item.timestamp).toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false 
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-muted-foreground">No news available</span>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useRef } from 'react'
import { ExternalLink, Newspaper, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

interface NewsItem {
  id: number
  title: string
  url: string
  source: { title: string }
  published_at: string
  votes: { positive: number; negative: number }
}

export function ContextPanel() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const initialLoadDone = useRef(false)

  const fetchNews = async () => {
    if (!initialLoadDone.current) setLoading(true)
    try {
      const res = await fetch('/api/polymarket/news')
      const data = await res.json()
      if (data?.items?.length) {
        setNews(data.items)
        setLastUpdated(new Date())
      }
    } catch (e) {
      console.error('News fetch failed:', e)
    } finally {
      setLoading(false)
      initialLoadDone.current = true
    }
  }

  useEffect(() => {
    fetchNews()
    const id = setInterval(fetchNews, 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return ''
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (isNaN(diff) || diff < 0) return ''
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return `${Math.floor(diff / 86400)}d`
  }

  const getSentimentIcon = (votes: { positive: number; negative: number }) => {
    const net = (votes?.positive ?? 0) - (votes?.negative ?? 0)
    if (net > 2) return <TrendingUp className="w-3 h-3 text-bullish" />
    if (net < -2) return <TrendingDown className="w-3 h-3 text-bearish" />
    return null
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card/30">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/30 flex items-center justify-between flex-shrink-0 bg-card/50">
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-primary/70" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">BTC News</span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[9px] text-muted-foreground font-mono">
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchNews() }}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            aria-label="Refresh news"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* News list */}
      <div className="flex-1 overflow-y-auto">
        {loading && news.length === 0 && (
          <div className="flex flex-col gap-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 p-3 rounded-lg bg-muted/10 animate-pulse">
                <div className="h-3 w-3/4 bg-muted/30 rounded" />
                <div className="h-3 w-1/2 bg-muted/30 rounded" />
                <div className="flex gap-2">
                  <div className="h-2 w-16 bg-muted/20 rounded" />
                  <div className="h-2 w-10 bg-muted/20 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!loading && news.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Newspaper className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">No news available</span>
          </div>
        )}
        
        <div className="p-2 space-y-1">
          {news.map((item, idx) => (
            <a 
              key={item.id} 
              href={item.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block p-2.5 rounded-lg hover:bg-muted/15 transition-all group"
            >
              <div className="flex items-start gap-2">
                <span className="text-[9px] text-muted-foreground/50 font-mono mt-0.5">
                  {(idx + 1).toString().padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-medium leading-snug text-foreground/90 group-hover:text-primary transition-colors line-clamp-2">
                      {item.title}
                    </span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] text-muted-foreground/70 font-medium truncate max-w-[80px]">
                      {item.source.title}
                    </span>
                    {item.published_at && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-[9px] text-muted-foreground/60 font-mono">
                          {timeAgo(item.published_at)}
                        </span>
                      </>
                    )}
                    {getSentimentIcon(item.votes)}
                    {(item.votes?.positive ?? 0) > 0 && (
                      <span className="text-[9px] font-mono text-bullish/80">+{item.votes.positive}</span>
                    )}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

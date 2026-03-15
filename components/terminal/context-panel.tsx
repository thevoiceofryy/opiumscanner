'use client'

import { useEffect, useState, useRef } from 'react'
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react'

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
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider">BTC News</span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[9px] text-muted-foreground font-mono">
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchNews() }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Refresh news"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* News list */}
      <div className="flex-1 overflow-y-auto">
        {loading && news.length === 0 && (
          <div className="flex flex-col gap-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded bg-muted/30 animate-pulse" />
            ))}
          </div>
        )}
        {!loading && news.length === 0 && (
          <div className="flex items-center justify-center h-20 text-muted-foreground text-xs">
            No news available
          </div>
        )}
        {news.map((item) => (
          <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
            className="flex flex-col gap-0.5 px-3 py-2 border-b border-border/30 hover:bg-muted/10 transition-colors group">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-medium leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {item.title}
              </span>
              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] text-muted-foreground font-mono">{item.source.title}</span>
              {item.published_at && (
                <span className="text-[9px] text-muted-foreground font-mono">{timeAgo(item.published_at)}</span>
              )}
              {(item.votes?.positive ?? 0) > 0 && (
                <span className="text-[9px] font-mono text-bullish">+{item.votes.positive}</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
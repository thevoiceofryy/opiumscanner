'use client'

import { useState, useEffect } from 'react'
import { Zap, Clock, User, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface TerminalHeaderProps {
  selectedMarket?: { question: string } | null
  onOpenSearch: () => void
  onOpenSettings: () => void
}

export function TerminalHeader({ selectedMarket, onOpenSearch, onOpenSettings }: TerminalHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  const formatTime = (date: Date, tz: string, label: string) => {
    const time = date.toLocaleTimeString('en-US', { 
      timeZone: tz, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    })
    return { time, label }
  }

  const est = formatTime(currentTime, 'America/New_York', 'EST')
  const utc = formatTime(currentTime, 'UTC', 'UTC')

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-warning" />
          <span className="text-lg font-semibold text-foreground">SigmaTerminal</span>
          <span className="px-2 py-0.5 text-xs bg-bullish/20 text-bullish rounded">LIVE</span>
        </div>
        
        <button 
          onClick={onOpenSearch}
          className="px-3 py-1.5 text-sm text-muted-foreground bg-secondary rounded border border-border hover:bg-accent transition-colors max-w-md truncate"
        >
          {selectedMarket?.question || 'Search markets...'}
        </button>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{est.label}</span>
            <span className="text-foreground font-mono">{est.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{utc.label}</span>
            <span className="text-foreground font-mono">{utc.time}</span>
          </div>
        </div>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="w-4 h-4" />
                <span className="text-sm truncate max-w-32">{user.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenSettings}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <a href="/auth/login">Sign In</a>
          </Button>
        )}
      </div>
    </header>
  )
}

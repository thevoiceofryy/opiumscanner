'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export function TerminalHeader() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Safety check: if supabase fails to initialize, stop here
    if (!supabase) {
      setLoading(false)
      return
    }

    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (err) {
        console.error('Error fetching user:', err)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // Listen for auth changes to update UI instantly
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleLogout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    // onAuthStateChange handles the UI update
  }

  return (
    <div className="h-12 border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <span className="font-semibold">🔫 OPIUM SCANNER</span>
        <span className="text-xs text-green-500">LIVE</span>
      </div>

      <div className="flex items-center gap-2">
        {!loading && (
          user ? (
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground uppercase tracking-tight font-mono">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-2 py-1 text-[11px] rounded border border-red-900/30 bg-red-950/20 hover:bg-red-950/40 text-red-400 transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="px-2 py-1 text-[11px] rounded border border-border/60 bg-card/60 hover:bg-accent text-muted-foreground"
              >
                Sign In
              </Link>
              <Link
                href="/auth/sign-up"
                className="px-2 py-1 text-[11px] rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Sign Up
              </Link>
            </>
          )
        )}
      </div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function ClaimUnlock({ onClaimed }: { onClaimed?: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const c = url.searchParams.get('code') || url.searchParams.get('charge') || null
    if (c) setCode(c)
  }, [])

  const claim = async () => {
    if (!code) return
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/commerce/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Claim failed')
      if (data?.paid) {
        onClaimed?.()
        window.location.reload()
        return
      }
      setError('Payment not confirmed yet. Try again in a few seconds.')
      setLoading(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed')
      setLoading(false)
    }
  }

  if (!code) return null

  return (
    <div className="mt-3 rounded border border-border/50 bg-muted/10 p-3">
      <div className="text-xs text-muted-foreground">Payment detected. Finalizing unlock…</div>
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={claim} disabled={loading}>
          {loading ? 'Checking…' : 'Unlock now'}
        </Button>
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>
    </div>
  )
}


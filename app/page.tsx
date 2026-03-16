import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold tracking-wide">OPIUM SCANNER</div>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link href="/dashboard">
              <Button size="sm">Open Dashboard</Button>
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/10 px-3 py-1 text-xs text-muted-foreground">
              Live BTC 15m · Polymarket odds · Signals
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">
              A trading terminal for Polymarket BTC rounds.
            </h1>
            <p className="text-sm text-muted-foreground max-w-md">
              Get a clean dashboard with target price, odds, and signals. Purchase unlocks access.
            </p>
            <div className="flex gap-3">
              <Link href="/pricing">
                <Button>Unlock access</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline">Go to dashboard</Button>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/5 p-6">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">What you get</div>
            <ul className="mt-3 space-y-2 text-sm">
              <li>BTC 15m chart + target price</li>
              <li>Polymarket YES/NO asks</li>
              <li>Signal + entry window guidance</li>
              <li>Universal win/loss log</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
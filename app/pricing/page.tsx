import Link from 'next/link'
import { CheckoutButton } from '@/components/commerce/checkout-button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function PricingPage() {
  return (
    <div className="min-h-svh bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <Link href="/dashboard" className="text-sm text-primary hover:underline">
            Go to Dashboard
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Unlock Opium Scanner</CardTitle>
            <CardDescription>
              One purchase to access the live terminal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded border border-border/50 bg-muted/10 p-3 text-sm">
              <div className="font-medium">Pro access</div>
              <div className="text-muted-foreground">Includes dashboard, signals, and Polymarket odds.</div>
              <div className="mt-2 text-lg font-bold">$29</div>
            </div>
            <CheckoutButton plan="pro" />
            <div className="text-[11px] text-muted-foreground">
              Pay via Coinbase Commerce. After payment, return to the dashboard to unlock.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


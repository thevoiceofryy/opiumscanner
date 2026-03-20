import { cookies } from 'next/headers'
import Link from 'next/link'
import { createServerClient } from '@supabase/ssr'
import { TerminalWrapper } from '@/components/terminal/terminal-wrapper'
import { CheckoutButton } from '@/components/commerce/checkout-button'
import { ClaimUnlock } from '@/components/commerce/claim-unlock'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default async function DashboardPage() {

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        }
      }
    }
  )

  // get logged in user
  const { data: { user } } = await supabase.auth.getUser()

  const ownerEmail = process.env.OWNER_EMAIL

  // check if user exists in paid_users table
  const { data: paid } = await supabase
    .from('paid_users')
    .select('email')
    .eq('email', user?.email)
    .single()

  // OWNER OR PAID USER BYPASS
  if (user?.email === ownerEmail || paid) {
    return <TerminalWrapper />
  }

  return (
    <div className="min-h-svh bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-4">

        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>

          <Link href="/pricing" className="text-sm text-primary hover:underline">
            Pricing
          </Link>
        </div>

        <Card>

          <CardHeader>
            <CardTitle>Unlock required</CardTitle>
            <CardDescription>
              Send payment to the wallet below to unlock access.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">

            <CheckoutButton />

            <ClaimUnlock />

            <div className="text-[11px] text-muted-foreground">
              After sending payment, your account will be unlocked once approved.
            </div>

          </CardContent>

        </Card>

      </div>
    </div>
  )
}
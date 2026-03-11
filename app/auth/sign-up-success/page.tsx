import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Zap, Mail, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          {/* Branding */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-8 h-8 text-warning" />
            <span className="text-2xl font-bold">SigmaTerminal</span>
          </div>
          
          <Card className="border-border bg-card">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-bullish/20 flex items-center justify-center mx-auto mb-2">
                <Mail className="w-6 h-6 text-bullish" />
              </div>
              <CardTitle className="text-2xl">Check Your Email</CardTitle>
              <CardDescription>We sent you a confirmation link</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Click the link in your email to verify your account. Then you can
                save markets to your watchlist and customize your terminal.
              </p>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth/login">
                    Go to Sign In
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/">
                    Continue to Terminal
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

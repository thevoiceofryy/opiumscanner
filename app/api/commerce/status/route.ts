import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyEntitlement } from '@/lib/commerce/token'

export const dynamic = 'force-dynamic'

export async function GET() {
  const secret = process.env.PAYWALL_JWT_SECRET
  if (!secret) return NextResponse.json({ unlocked: false, error: 'Missing PAYWALL_JWT_SECRET' }, { status: 500 })

  const cookieStore = await cookies()
  const token = cookieStore.get('opium_entitlement')?.value
  if (!token) return NextResponse.json({ unlocked: false })

  const payload = verifyEntitlement(token, secret)
  return NextResponse.json({ unlocked: !!payload })
}


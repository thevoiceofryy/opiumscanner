import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { markChargePaid } from '@/lib/commerce/store'

export const dynamic = 'force-dynamic'

function timingSafeEqualStr(a: string, b: string) {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export async function POST(request: Request) {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Missing COINBASE_COMMERCE_WEBHOOK_SECRET' }, { status: 500 })

  const signature = request.headers.get('x-cc-webhook-signature') || ''
  const rawBody = await request.text()
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  if (!signature || !timingSafeEqualStr(signature, expected)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: any
  try { event = JSON.parse(rawBody) } catch { event = null }
  const type = event?.event?.type
  const code = event?.event?.data?.code

  // Coinbase Commerce: treat these as paid
  if ((type === 'charge:confirmed' || type === 'charge:resolved') && typeof code === 'string') {
    markChargePaid(code)
  }

  return NextResponse.json({ ok: true })
}


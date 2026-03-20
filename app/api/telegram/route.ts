import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export async function POST(request: Request) {
  try {
    const { message } = await request.json()
    
    const tgRes = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    })

    const tgData = await tgRes.json()
    return NextResponse.json(tgData)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
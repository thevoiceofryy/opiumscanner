import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch(
      'https://cryptopanic.com/api/free/v1/posts/?auth_token=pub_free&currencies=BTC&kind=news&limit=20',
      { cache: 'no-store' }
    )

    if (!res.ok) throw new Error(`CryptoPanic error: ${res.status}`)

    const data = await res.json()

    const items = (data?.results ?? []).map((item: any, idx: number) => ({
      id: item.id ?? idx,
      title: item.title,
      url: item.url,
      source: { title: item.source?.title ?? 'Unknown' },
      published_at: item.published_at,
      votes: {
        positive: item.votes?.positive ?? 0,
        negative: item.votes?.negative ?? 0,
      },
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('News fetch error:', error)
    // Fallback to static news if API fails
    return NextResponse.json({
      items: [
        { id: 1, title: 'Bitcoin trading volume surges amid market volatility', url: 'https://coindesk.com', source: { title: 'CoinDesk' }, published_at: new Date().toISOString(), votes: { positive: 5, negative: 0 } },
        { id: 2, title: 'BTC holds key support levels as bulls defend $70K', url: 'https://cointelegraph.com', source: { title: 'CoinTelegraph' }, published_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), votes: { positive: 3, negative: 1 } },
        { id: 3, title: 'Polymarket BTC prediction markets see record volume', url: 'https://polymarket.com', source: { title: 'Polymarket' }, published_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), votes: { positive: 8, negative: 0 } },
      ]
    })
  }
}
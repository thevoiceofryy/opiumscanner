import { NextResponse } from 'next/server'

const GAMMA_API = 'https://gamma-api.polymarket.com'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const limit = searchParams.get('limit') || '20'
  const active = searchParams.get('active') !== 'false'

  try {
    const params = new URLSearchParams({
      limit,
      active: String(active),
      closed: 'false',
    })
    
    if (query) {
      params.set('title_contains', query)
    }

    const response = await fetch(`${GAMMA_API}/markets?${params}`, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 30 }
    })

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`)
    }

    const markets = await response.json()
    
    // Transform to simpler format
    const transformed = markets.map((market: any) => ({
      id: market.id,
      slug: market.slug,
      question: market.question,
      description: market.description,
      outcomes: market.outcomes || ['Yes', 'No'],
      outcomePrices: market.outcomePrices ? 
        (typeof market.outcomePrices === 'string' ? 
          JSON.parse(market.outcomePrices) : market.outcomePrices) 
        : null,
      volume: market.volume,
      liquidity: market.liquidity,
      startDate: market.startDate,
      endDate: market.endDate,
      image: market.image,
      icon: market.icon,
      active: market.active,
      closed: market.closed,
      clobTokenIds: market.clobTokenIds ? 
        (typeof market.clobTokenIds === 'string' ? 
          JSON.parse(market.clobTokenIds) : market.clobTokenIds) 
        : null,
    }))

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Polymarket markets fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 }
    )
  }
}

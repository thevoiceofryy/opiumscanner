import { NextResponse } from 'next/server'

const GAMMA_API = 'https://gamma-api.polymarket.com'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const marketId = searchParams.get('id')

  if (!marketId) {
    return NextResponse.json(
      { error: 'Market ID is required' },
      { status: 400 }
    )
  }

  try {
    // Fetch detailed market information so we can read Polymarket's own priceToBeat
    const response = await fetch(`${GAMMA_API}/markets/${marketId}`, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 10 }
    })

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`)
    }

    const market = await response.json()
console.log('FULL MARKET:', JSON.stringify(market, null, 2))
    // Prefer Polymarket's own priceToBeat from event metadata
let priceToBeat: number | null = null

// Check direct market field first (most common in Gamma API)
if (market?.priceToBeat != null) {
  priceToBeat = parseFloat(market.priceToBeat)
}

// Fall back to events[0] eventMetadata
if (priceToBeat === null && Array.isArray(market?.events) && market.events.length > 0) {
  const eventMeta = market.events[0]?.eventMetadata
  if (eventMeta?.priceToBeat != null) {
    priceToBeat = parseFloat(eventMeta.priceToBeat)
  }
}

// Fall back to bestAsk if still null
if (priceToBeat === null && market?.bestAsk != null) {
  priceToBeat = parseFloat(market.bestAsk)
}

    return NextResponse.json({
      id: market.id,
      slug: market.slug,
      question: market.question,
      priceToBeat,
      startDate: market.startDate,
      conditions: market.conditions,
      referencePrice: market.referencePrice,
      creationPrice: market.creationPrice,
      volume: market.volume,
      liquidity: market.liquidity,
      active: market.active,
      closed: market.closed,
    })
  } catch (error) {
    console.error('Polymarket market details fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market details' },
      { status: 500 }
    )
  }
}

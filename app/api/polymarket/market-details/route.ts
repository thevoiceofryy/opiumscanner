import { NextResponse } from 'next/server'

const GAMMA_API = 'https://gamma-api.polymarket.com'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  const marketId = searchParams.get('id')

  if (!slug && !marketId) {
    return NextResponse.json(
      { error: 'Market slug or ID is required' },
      { status: 400 }
    )
  }

  try {
    let market: any = null

    // Preferred: look up by slug so we match Polymarket's own view exactly.
    if (slug) {
      const bySlugResponse = await fetch(
        `${GAMMA_API}/markets?slug=${encodeURIComponent(slug)}`,
        {
          headers: { Accept: 'application/json' },
          next: { revalidate: 5 },
        }
      )

      if (!bySlugResponse.ok) {
        throw new Error(
          `Polymarket slug lookup error: ${bySlugResponse.status}`
        )
      }

      const slugResults: any[] = await bySlugResponse.json()
      if (!Array.isArray(slugResults) || slugResults.length === 0) {
        throw new Error(`No Polymarket markets found for slug ${slug}`)
      }

      market = slugResults[0]
    } else if (marketId) {
      // Fallback: ID lookup if slug isn't provided
      const response = await fetch(`${GAMMA_API}/markets/${marketId}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 5 },
      })

      if (!response.ok) {
        throw new Error(`Polymarket ID lookup error: ${response.status}`)
      }

      market = await response.json()
    }

    // Extract Polymarket's own priceToBeat from eventMetadata
    let priceToBeat: number | null = null

    // a) Root-level eventMetadata
    if (
      market?.eventMetadata &&
      typeof market.eventMetadata.priceToBeat === 'number'
    ) {
      priceToBeat = market.eventMetadata.priceToBeat
    }

    // b) events[0].eventMetadata.priceToBeat (structure seen in Gamma /markets?slug=...)
    if (
      priceToBeat === null &&
      Array.isArray(market?.events) &&
      market.events.length > 0
    ) {
      const eventMeta = market.events[0]?.eventMetadata
      if (eventMeta && typeof eventMeta.priceToBeat === 'number') {
        priceToBeat = eventMeta.priceToBeat
      }
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

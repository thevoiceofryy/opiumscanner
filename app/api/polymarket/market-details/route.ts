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

    // -----------------------------------
    // Fetch market
    // -----------------------------------

    if (slug) {

      const res = await fetch(
        `${GAMMA_API}/markets?slug=${encodeURIComponent(slug)}`,
        {
          headers: { Accept: 'application/json' },
          next: { revalidate: 5 },
        }
      )

      if (!res.ok) throw new Error(`Gamma error ${res.status}`)

      const results = await res.json()

      if (!Array.isArray(results) || !results.length) {
        throw new Error(`No market found for slug ${slug}`)
      }

      market = results[0]

    } else {

      const res = await fetch(`${GAMMA_API}/markets/${marketId}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 5 }
      })

      if (!res.ok) throw new Error(`Gamma error ${res.status}`)

      market = await res.json()

    }

    /*
    -------------------------------------
    Extract tokens
    -------------------------------------
    */

    let tokens = market.tokens || []
    let clobTokenIds = market.clobTokenIds || []

    // fallback through events structure
    if ((!tokens.length || !clobTokenIds.length) && market.events?.length) {

      const eventMarket = market.events[0]?.markets?.[0]

      tokens = eventMarket?.tokens || tokens
      clobTokenIds = eventMarket?.clobTokenIds || clobTokenIds

    }

    /*
    -------------------------------------
    Normalize tokens
    -------------------------------------
    */

    const normalizedTokens = tokens.map((t: any) => ({
      outcome: t.outcome,
      token_id: t.token_id || t.tokenId || t.id
    }))

    /*
    -------------------------------------
    Extract priceToBeat
    -------------------------------------
    */

    let priceToBeat: number | null = null

    if (market?.eventMetadata?.priceToBeat !== undefined) {
      priceToBeat = market.eventMetadata.priceToBeat
    }

    if (
      priceToBeat === null &&
      Array.isArray(market?.events) &&
      market.events.length
    ) {
      const meta = market.events[0]?.eventMetadata
      if (meta?.priceToBeat !== undefined) {
        priceToBeat = meta.priceToBeat
      }
    }

    /*
    -------------------------------------
    Return normalized market
    -------------------------------------
    */

    return NextResponse.json({
      id: market.id,
      slug: market.slug,
      question: market.question,

      priceToBeat,

      tokens: normalizedTokens,
      clobTokenIds,

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
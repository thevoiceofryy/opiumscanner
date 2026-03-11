import { NextResponse } from 'next/server'

const GAMMA_API = 'https://gamma-api.polymarket.com'
const BINANCE_API = 'https://api.binance.com/api/v3'

/**
 * Extract the round start timestamp (in seconds) from a Polymarket slug.
 * Example slug: "btc-updown-5m-1766162700"
 */
function extractRoundTimestampFromSlug(slug: string | undefined | null): number | null {
  if (!slug) return null

  const parts = slug.split('-')
  if (parts.length < 2) return null

  const lastPart = parts[parts.length - 1]
  const timestampSeconds = Number(lastPart)

  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
    return null
  }

  return timestampSeconds
}

/**
 * Fetch the BTCUSDT 1m candle that starts exactly at the given Unix
 * timestamp (in seconds) and return its OPEN price.
 */
async function getPriceToBeatFromBinance(roundTimestampSeconds: number): Promise<number | null> {
  try {
    const startTimeMs = roundTimestampSeconds * 1000

    const response = await fetch(
      `${BINANCE_API}/klines?symbol=BTCUSDT&interval=1m&startTime=${startTimeMs}&limit=1`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`)
    }

    const klines = await response.json()

    if (!Array.isArray(klines) || klines.length === 0) {
      console.warn('No Binance klines returned for round timestamp', {
        roundTimestampSeconds,
        startTimeMs,
      })
      return null
    }

    const firstCandle = klines[0]
    // Kline format: [ openTime, open, high, low, close, ... ]
    const openPrice = firstCandle && firstCandle[1] ? parseFloat(firstCandle[1]) : NaN

    if (!Number.isFinite(openPrice)) {
      console.warn('Invalid open price from Binance kline', { firstCandle })
      return null
    }

    return openPrice
  } catch (error) {
    console.error('Error fetching Binance candle for priceToBeat:', error)
    return null
  }
}

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
    // Fetch detailed market information so we can read the slug
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

    // 1) Extract the round timestamp from the market slug
    const roundTimestampSeconds = extractRoundTimestampFromSlug(market.slug)

    // 2) Use that timestamp to fetch the BTC candle from Binance
    //    and take the OPEN price as the "Price to Beat"
    let priceToBeat: number | null = null

    if (roundTimestampSeconds) {
      priceToBeat = await getPriceToBeatFromBinance(roundTimestampSeconds)
    } else {
      console.warn('Could not extract round timestamp from slug', {
        marketId,
        slug: market.slug,
      })
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

import { NextResponse } from 'next/server'

const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || 'BTCUSDT'

  try {
    // Get funding rate
    const fundingResponse = await fetch(
      `${BINANCE_FUTURES_API}/fundingRate?symbol=${symbol}&limit=1`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      }
    )

    // Get open interest
    const oiResponse = await fetch(
      `${BINANCE_FUTURES_API}/openInterest?symbol=${symbol}`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 30 }
      }
    )

    // Get long/short ratio
    const lsResponse = await fetch(
      `${BINANCE_FUTURES_API}/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      }
    )

    const [fundingData, oiData, lsData] = await Promise.all([
      fundingResponse.ok ? fundingResponse.json() : [],
      oiResponse.ok ? oiResponse.json() : null,
      lsResponse.ok ? lsResponse.json() : []
    ])

    const funding = fundingData[0]
    const fundingRate = funding ? parseFloat(funding.fundingRate) * 100 : 0 // Convert to percentage
    const fundingRateBps = fundingRate * 100 // Basis points
    
    const openInterest = oiData ? parseFloat(oiData.openInterest) : 0
    
    const longShort = lsData[0]
    const longShortRatio = longShort ? parseFloat(longShort.longShortRatio) : 1
    const longPercent = longShort ? (longShortRatio / (1 + longShortRatio)) * 100 : 50
    const shortPercent = 100 - longPercent

    return NextResponse.json({
      symbol,
      fundingRate,
      fundingRateBps: Math.round(fundingRateBps * 100) / 100,
      nextFundingTime: funding?.fundingTime,
      openInterest,
      longShortRatio: Math.round(longShortRatio * 100) / 100,
      longPercent: Math.round(longPercent),
      shortPercent: Math.round(shortPercent),
      sentiment: fundingRate > 0.01 ? 'BULLISH' : fundingRate < -0.01 ? 'BEARISH' : 'NEUTRAL',
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Funding rate fetch error:', error)
    return NextResponse.json({
      symbol,
      fundingRate: 0,
      fundingRateBps: 0,
      openInterest: 0,
      longShortRatio: 1,
      longPercent: 50,
      shortPercent: 50,
      sentiment: 'NEUTRAL',
      timestamp: Date.now(),
      error: 'Using fallback data'
    })
  }
}

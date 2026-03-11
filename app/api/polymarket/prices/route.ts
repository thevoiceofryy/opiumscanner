import { NextResponse } from 'next/server'

const CLOB_API = 'https://clob.polymarket.com'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenId = searchParams.get('tokenId')

  if (!tokenId) {
    return NextResponse.json(
      { error: 'tokenId is required' },
      { status: 400 }
    )
  }

  try {
    // Get orderbook for the token
    const response = await fetch(`${CLOB_API}/book?token_id=${tokenId}`, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 5 }
    })

    if (!response.ok) {
      throw new Error(`CLOB API error: ${response.status}`)
    }

    const orderbook = await response.json()
    
    // Calculate best bid/ask prices
    const bids = orderbook.bids || []
    const asks = orderbook.asks || []
    
    const bestBid = bids.length > 0 ? parseFloat(bids[0].price) : null
    const bestAsk = asks.length > 0 ? parseFloat(asks[0].price) : null
    const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk
    
    // Calculate spread
    const spread = bestBid && bestAsk ? bestAsk - bestBid : null
    
    // Calculate total liquidity at each level
    const bidLiquidity = bids.reduce((sum: number, b: any) => sum + parseFloat(b.size), 0)
    const askLiquidity = asks.reduce((sum: number, a: any) => sum + parseFloat(a.size), 0)

    return NextResponse.json({
      tokenId,
      bestBid,
      bestAsk,
      midPrice,
      spread,
      bidLiquidity,
      askLiquidity,
      bids: bids.slice(0, 10),
      asks: asks.slice(0, 10),
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Polymarket prices fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    )
  }
}

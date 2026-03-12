import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Compute the current 15-minute bucket timestamp in seconds
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(nowSeconds / 900) * 900; // 900s = 15 minutes

    // Slug pattern for the BTC 15m series (e.g. btc-updown-15m-1773352800)
    const slug = `btc-updown-15m-${bucket}`;

    // 2. Fetch that exact market by slug
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?slug=${slug}`,
      { cache: 'no-store' }
    );

    const markets = await response.json();

    if (!Array.isArray(markets) || markets.length === 0) {
      return NextResponse.json({
        success: false,
        priceToBeat: 0,
        probability: 0,
        title: 'Scanning BTC 15m markets...'
      });
    }

    const liveMarket = markets[0];

    // 3. Probability from Polymarket outcome prices (Up is index 0)
    const prices = typeof liveMarket.outcomePrices === 'string'
      ? JSON.parse(liveMarket.outcomePrices)
      : liveMarket.outcomePrices;

    const upProb = prices && prices.length > 0
      ? Math.round(parseFloat(prices[0]) * 100)
      : 0;

    // 4. Approximate "price to beat" using current BTC/USD spot from Coinbase
    let priceToBeat = 0;
    try {
      const spotRes = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot', {
        cache: 'no-store',
      });
      if (spotRes.ok) {
        const spotJson = await spotRes.json();
        const value = parseFloat(spotJson?.data?.amount ?? '0');
        if (!Number.isNaN(value) && value > 0) {
          priceToBeat = value;
        }
      }
    } catch {
      // ignore, fallback to 0
    }

    // 5. Previous 15m round result (for "last round")
    const previousBucket = bucket - 900;
    const prevSlug = `btc-updown-15m-${previousBucket}`;

    let lastResult: 'UP' | 'DOWN' | 'UNKNOWN' = 'UNKNOWN';
    let lastUp = 0;
    let lastDown = 0;

    try {
      const prevRes = await fetch(
        `https://gamma-api.polymarket.com/markets?slug=${prevSlug}`,
        { cache: 'no-store' }
      );
      const prevMarkets = await prevRes.json();
      if (Array.isArray(prevMarkets) && prevMarkets.length > 0) {
        const prev = prevMarkets[0];
        const prevPrices = typeof prev.outcomePrices === 'string'
          ? JSON.parse(prev.outcomePrices)
          : prev.outcomePrices;
        if (prevPrices && prevPrices.length > 0) {
          lastUp = parseFloat(prevPrices[0]);
          lastDown = prevPrices[1] != null ? parseFloat(prevPrices[1]) : 1 - lastUp;
          if (!Number.isNaN(lastUp) && !Number.isNaN(lastDown)) {
            lastResult = lastUp >= lastDown ? 'UP' : 'DOWN';
          }
        }
      }
    } catch {
      // ignore, leave UNKNOWN
    }

    return NextResponse.json({
      success: true,
      priceToBeat,
      probability: upProb,
      title: liveMarket.question,
      lastRound: {
        bucket: previousBucket,
        result: lastResult,
        up: lastUp,
        down: lastDown,
      },
    });

  } catch (error) {
    return NextResponse.json({ success: false, priceToBeat: 0, probability: 0, title: "API Offline" });
  }
}
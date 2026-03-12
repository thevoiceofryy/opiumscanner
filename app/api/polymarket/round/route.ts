import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&limit=30&query=Bitcoin&order=volume&ascending=false',
      { cache: 'no-store' }
    );

    const markets = await response.json();

    // STRICT FILTER: Must be Bitcoin, active, and current (NOT 2020)
    const liveMarket = markets.find((m: any) => {
      const q = m.question?.toLowerCase() || "";
      return q.includes('bitcoin') && m.active === true && !q.includes('2020');
    });

    if (!liveMarket) {
      return NextResponse.json({ success: false, priceToBeat: 0, probability: 0, title: "Scanning Live BTC Markets..." });
    }

    // Extraction logic for $110,000
    const targetPrice = parseFloat(liveMarket.line) || 
                       parseFloat(liveMarket.question.match(/\$(\d{1,3}(,\d{3})*)/)?.[1].replace(/,/g, '') || "0");

    const prices = typeof liveMarket.outcomePrices === 'string' 
      ? JSON.parse(liveMarket.outcomePrices) 
      : liveMarket.outcomePrices;
    
    const liveProb = prices ? Math.round(parseFloat(prices[0]) * 100) : 0;

    return NextResponse.json({
      success: true,
      priceToBeat: targetPrice,
      probability: liveProb,
      title: liveMarket.question
    });

  } catch (error) {
    return NextResponse.json({ success: false, priceToBeat: 0, probability: 0, title: "API Offline" });
  }
}
import { NextRequest, NextResponse } from 'next/server'

// This would typically come from a real news API or database
// For now, we'll return sample data
const SAMPLE_NEWS = [
  {
    id: '1',
    title: 'Bitcoin ETF approvals expected Q2 2026',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    sentiment: 'bullish'
  },
  {
    id: '2',
    title: 'Fed interest rate decisions impact crypto markets',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    sentiment: 'neutral'
  },
  {
    id: '3',
    title: 'Ethereum Shanghai upgrade implementation on track',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    sentiment: 'bullish'
  },
  {
    id: '4',
    title: 'Market volatility increases amid global uncertainty',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    sentiment: 'bearish'
  },
  {
    id: '5',
    title: 'Polymarket volume reaches $2B in monthly trading',
    timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    sentiment: 'bullish'
  }
]

export async function GET(request: NextRequest) {
  try {
    // TODO: Integrate with actual news APIs like CoinGecko, NewsAPI, or custom polymarket news feed
    // For now, return sample data with slight randomization
    
    return NextResponse.json({
      news: SAMPLE_NEWS.map(item => ({
        ...item,
        timestamp: new Date(item.timestamp).toISOString()
      }))
    })
  } catch (error) {
    console.error('Error fetching polymarket news:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    )
  }
}

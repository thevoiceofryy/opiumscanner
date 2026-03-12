import { NextResponse } from 'next/server'

const CLOB_API = 'https://clob.polymarket.com'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenId = searchParams.get('tokenId')
  const fidelity = searchParams.get('fidelity') || '60' // Minutes per data point

  if (!tokenId) {
    return NextResponse.json(
      { error: 'Token ID is required' },
      { status: 400 }
    )
  }

  try {
    // Fetch price history from Polymarket CLOB API
    const response = await fetch(
      `${CLOB_API}/prices-history?market=${tokenId}&interval=all&fidelity=${fidelity}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 60 }
      }
    )

    if (!response.ok) {
      // If CLOB API fails, return mock data
      console.warn('Polymarket price history unavailable, generating mock data')
      return NextResponse.json({
        history: generateMockHistory(),
        isMock: true
      })
    }

    const data = await response.json()
    
    // Transform the data to our format
    const history = data.history?.map((point: { t: number; p: number }) => ({
      timestamp: point.t * 1000, // Convert to milliseconds
      price: point.p,
    })) || []

    return NextResponse.json({
      history,
      isMock: false
    })
  } catch (error) {
    console.error('Polymarket history fetch error:', error)
    // Return mock data on error
    return NextResponse.json({
      history: generateMockHistory(),
      isMock: true
    })
  }
}

function generateMockHistory() {
  const now = Date.now()
  const history = []
  const numPoints = 100
  const intervalMs = 3600000 // 1 hour
  
  let price = 0.3 + Math.random() * 0.4 // Start between 30-70%
  
  for (let i = 0; i < numPoints; i++) {
    const timestamp = now - (numPoints - i) * intervalMs
    // Random walk with slight upward bias
    const change = (Math.random() - 0.48) * 0.05
    price = Math.max(0.01, Math.min(0.99, price + change))
    
    history.push({
      timestamp,
      price,
    })
  }
  
  return history
}

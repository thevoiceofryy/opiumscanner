import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=1', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 } // Cache for 5 minutes
    })

    if (!response.ok) {
      throw new Error(`Fear & Greed API error: ${response.status}`)
    }

    const data = await response.json()
    const fng = data.data?.[0]
    
    if (!fng) {
      throw new Error('No fear & greed data available')
    }

    return NextResponse.json({
      value: parseInt(fng.value),
      classification: fng.value_classification,
      timestamp: parseInt(fng.timestamp) * 1000,
      timeUntilUpdate: fng.time_until_update
    })
  } catch (error) {
    console.error('Fear & Greed fetch error:', error)
    // Return a fallback value
    return NextResponse.json({
      value: 50,
      classification: 'Neutral',
      timestamp: Date.now(),
      error: 'Using fallback data'
    })
  }
}

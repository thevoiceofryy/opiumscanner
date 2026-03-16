import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('round_results')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(200)

  const results = data ?? []
  return NextResponse.json({
    upRounds: results.filter(r => r.result === 'UP').length,
    downRounds: results.filter(r => r.result === 'DOWN').length,
    correctRounds: results.filter(r => r.correct === true).length,
    wrongRounds: results.filter(r => r.correct === false).length,
    resultsLog: results.map(r => ({
      bucket: r.bucket,
      result: r.result,
      predicted: r.predicted,
      correct: r.correct,
      recordedAt: new Date(r.recorded_at).getTime(),
    })),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { bucket, result, predicted } = body

  if (!bucket || !result) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const correct = predicted ? predicted === result : null

  await supabase.from('round_results').upsert({
    bucket,
    result,
    predicted: predicted ?? null,
    correct,
  }, { onConflict: 'bucket' })

  // Return updated stats
  const { data } = await supabase
    .from('round_results')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(200)

  const results = data ?? []
  return NextResponse.json({
    upRounds: results.filter(r => r.result === 'UP').length,
    downRounds: results.filter(r => r.result === 'DOWN').length,
    correctRounds: results.filter(r => r.correct === true).length,
    wrongRounds: results.filter(r => r.correct === false).length,
    resultsLog: results.map(r => ({
      bucket: r.bucket,
      result: r.result,
      predicted: r.predicted,
      correct: r.correct,
      recordedAt: new Date(r.recorded_at).getTime(),
    })),
  })
}
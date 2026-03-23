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

  if (!bucket) return NextResponse.json({ error: 'Missing bucket' }, { status: 400 })
  if (!result && !predicted) return NextResponse.json({ error: 'Missing result or predicted' }, { status: 400 })

// 🟢 CASE 1: save prediction only (during round)
// AFTER — only write if no prediction exists yet for this bucket
if (predicted && !result) {
  const { data: existingPred } = await supabase
    .from('round_results')
    .select('predicted')
    .eq('bucket', bucket)
    .maybeSingle()

  if (!existingPred?.predicted) {
    await supabase
      .from('round_results')
      .upsert(
        { bucket, predicted, recorded_at: new Date().toISOString() },
        { onConflict: 'bucket' }
      )
  }

  return NextResponse.json({ success: true, type: 'prediction' })
}

// 🔴 CASE 2: save result (after round ends)
if (result) {
  const { data: existing } = await supabase
    .from('round_results')
    .select('predicted')
    .eq('bucket', bucket)
    .single()

  const correct = existing?.predicted ? existing.predicted === result : null

  if (existing) {
    // Row exists — UPDATE only result+correct, preserve predicted
    await supabase
      .from('round_results')
      .update({ result, correct })
      .eq('bucket', bucket)
  } else {
    // No prediction was made — INSERT fresh row
    await supabase
      .from('round_results')
      .insert({ bucket, result, correct, recorded_at: new Date().toISOString() })
  }

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

  return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
}
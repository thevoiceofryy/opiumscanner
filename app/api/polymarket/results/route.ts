import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RoundResult = 'UP' | 'DOWN'
type ResultLogEntry = {
  bucket: number
  result: RoundResult
  predicted?: RoundResult
  correct?: boolean
  recordedAt: number
}

type ResultsState = {
  upRounds: number
  downRounds: number
  correctRounds: number
  wrongRounds: number
  resultsLog: ResultLogEntry[]
}

const initialState: ResultsState = {
  upRounds: 0,
  downRounds: 0,
  correctRounds: 0,
  wrongRounds: 0,
  resultsLog: [],
}

let state: ResultsState = { ...initialState, resultsLog: [] }

function getState(): ResultsState {
  return {
    upRounds: state.upRounds,
    downRounds: state.downRounds,
    correctRounds: state.correctRounds,
    wrongRounds: state.wrongRounds,
    resultsLog: [...state.resultsLog],
  }
}

export async function GET() {
  return NextResponse.json(getState())
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bucket = typeof body.bucket === 'number' ? body.bucket : null
    const result = body.result === 'UP' || body.result === 'DOWN' ? body.result : null
    const predicted = body.predicted === 'UP' || body.predicted === 'DOWN' ? body.predicted : undefined

    if (bucket == null || result == null) {
      return NextResponse.json(getState(), { status: 400 })
    }

    const exists = state.resultsLog.some((e) => e.bucket === bucket)
    if (exists) {
      return NextResponse.json(getState())
    }

    const isCorrect = predicted != null ? predicted === result : undefined
    const entry: ResultLogEntry = {
      bucket,
      result,
      predicted,
      correct: isCorrect,
      recordedAt: Date.now(),
    }

    state.resultsLog = [entry, ...state.resultsLog].slice(0, 50)
    if (result === 'UP') state.upRounds += 1
    if (result === 'DOWN') state.downRounds += 1
    if (isCorrect === true) state.correctRounds += 1
    if (isCorrect === false) state.wrongRounds += 1

    return NextResponse.json(getState())
  } catch {
    return NextResponse.json(getState(), { status: 400 })
  }
}

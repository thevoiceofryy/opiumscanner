import fs from 'fs'
import path from 'path'

type StoreShape = {
  paidChargeCodes: Record<string, { paidAt: number }>
}

const STORE_PATH = path.join(process.cwd(), 'data', 'commerce-store.json')

function ensureDir() {
  const dir = path.dirname(STORE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readStore(): StoreShape {
  try {
    if (!fs.existsSync(STORE_PATH)) return { paidChargeCodes: {} }
    const raw = fs.readFileSync(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { paidChargeCodes: {} }
    if (!parsed.paidChargeCodes || typeof parsed.paidChargeCodes !== 'object') return { paidChargeCodes: {} }
    return { paidChargeCodes: parsed.paidChargeCodes }
  } catch {
    return { paidChargeCodes: {} }
  }
}

function writeStore(next: StoreShape) {
  ensureDir()
  fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf8')
}

export function markChargePaid(chargeCode: string) {
  const store = readStore()
  store.paidChargeCodes[chargeCode] = { paidAt: Date.now() }
  writeStore(store)
}

export function isChargePaid(chargeCode: string): boolean {
  const store = readStore()
  return !!store.paidChargeCodes[chargeCode]
}


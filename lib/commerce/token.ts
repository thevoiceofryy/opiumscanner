import crypto from 'crypto'

export type EntitlementPayload = {
  iat: number
  exp: number
  chargeCode?: string
}

function b64urlEncode(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8')
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function b64urlDecodeToString(input: string) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const s = input.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(s, 'base64').toString('utf8')
}

export function signEntitlement(payload: EntitlementPayload, secret: string) {
  const body = b64urlEncode(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64')
  const sigUrl = sig.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${body}.${sigUrl}`
}

export function verifyEntitlement(token: string, secret: string): EntitlementPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null
  let payload: EntitlementPayload
  try {
    payload = JSON.parse(b64urlDecodeToString(body))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null
  return payload
}


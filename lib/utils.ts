import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract crypto symbol from a market question
 * Examples:
 * "Bitcoin exceeds $50k" -> "BTCUSDT"
 * "Ethereum above $3000" -> "ETHUSDT"
 * "XRP price reaches $2" -> "XRPUSDT"
 */
export function extractSymbolFromMarket(question: string): string {
  const question_lower = question.toLowerCase()
  
  // Map of crypto names to trading symbols
  const cryptoMap: Record<string, string> = {
    bitcoin: 'BTCUSDT',
    btc: 'BTCUSDT',
    ethereum: 'ETHUSDT',
    eth: 'ETHUSDT',
    ripple: 'XRPUSDT',
    xrp: 'XRPUSDT',
    cardano: 'ADAUSDT',
    ada: 'ADAUSDT',
    solana: 'SOLUSDT',
    sol: 'SOLUSDT',
    dogecoin: 'DOGEUSDT',
    doge: 'DOGEUSDT',
    polkadot: 'DOTUSDT',
    dot: 'DOTUSDT',
    litecoin: 'LTCUSDT',
    ltc: 'LTCUSDT',
    uniswap: 'UNIUSDT',
    uni: 'UNIUSDT',
    link: 'LINKUSDT',
    chainlink: 'LINKUSDT',
    polygon: 'MATICUSDT',
    matic: 'MATICUSDT',
    avalanche: 'AVAXUSDT',
    avax: 'AVAXUSDT',
    near: 'NEARUSDT',
    arbitrum: 'ARBUSDT',
    arb: 'ARBUSDT',
    optimism: 'OPUSDT',
    op: 'OPUSDT',
    blast: 'BLASTUSDT',
    sui: 'SUIUSDT',
    aptos: 'APTUSDT',
    apt: 'APTUSDT',
    zcash: 'ZECUSDT',
    zec: 'ZECUSDT',
    monero: 'XMRUSDT',
    xmr: 'XMRUSDT',
    cosmos: 'ATOMUSDT',
    atom: 'ATOMUSDT',
    filecoin: 'FILUSDT',
    fil: 'FILUSDT',
    tron: 'TRXUSDT',
    trx: 'TRXUSDT',
    vechain: 'VETUSDT',
    vet: 'VETUSDT',
    thetas: 'THETAUSDT',
    theta: 'THETAUSDT',
    iota: 'IOTAUSDT',
    miota: 'IOTAUSDT',
    algorand: 'ALGOUSDT',
    algo: 'ALGOUSDT',
    hedera: 'HBARUSDT',
    hbar: 'HBARUSDT',
    zilliqa: 'ZILUSDT',
    zil: 'ZILUSDT',
  }
  
  // Try to find exact matches for crypto names
  for (const [name, symbol] of Object.entries(cryptoMap)) {
    if (question_lower.includes(name)) {
      return symbol
    }
  }
  
  // Try to match 3-4 letter symbols at word boundaries
  const symbolMatch = question.match(/\b([A-Z]{3,4})\b/i)
  if (symbolMatch) {
    const potential_symbol = symbolMatch[1].toUpperCase() + 'USDT'
    // Validate if it looks like a known crypto symbol
    if (cryptoMap[symbolMatch[1].toLowerCase()]) {
      return cryptoMap[symbolMatch[1].toLowerCase()]
    }
    // Otherwise return the matched symbol with USDT suffix
    return potential_symbol
  }
  
  // Default to Bitcoin if no match found
  return 'BTCUSDT'
}

/**
 * Extract price target from a market question
 * Examples:
 * "Bitcoin above $70,000" -> 70000
 * "Will BTC reach $75,500.50" -> 75500.50
 * "Bitcoin exceeds $69,500 on March 31?" -> 69500
 */
export function extractPriceTargetFromMarket(question: string): number | null {
  // Match price patterns like $70,000 or $75,500.50
  const priceMatch = question.match(/\$[\d,]+(?:\.\d+)?/g)
  
  if (priceMatch && priceMatch.length > 0) {
    // Get the first price found (usually the strike price)
    const priceStr = priceMatch[0].replace(/[$,]/g, '')
    const price = parseFloat(priceStr)
    
    // Validate it's a reasonable crypto price
    if (!isNaN(price) && price > 0 && price < 1000000) {
      return price
    }
  }
  
  return null
}

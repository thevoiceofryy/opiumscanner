import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MIN_BTC_PRICE = 50_000;
const MAX_BTC_PRICE = 200_000;

function isValidBtcPrice(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_BTC_PRICE && value <= MAX_BTC_PRICE;
}

const BINANCE_API = 'https://api.binance.com/api/v3';
let cachedPriceToBeat: { bucket: number; price: number } | null = null;

async function fetchBinanceOpen(bucketSeconds: number): Promise<number | null> {
  const startTimeMs = bucketSeconds * 1000;
  const endTimeMs   = startTimeMs + 900_000 - 1;
  try {
    const res = await fetch(
      `${BINANCE_API}/klines?symbol=BTCUSDT&interval=15m&limit=1&startTime=${startTimeMs}&endTime=${endTimeMs}`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    const open = parseFloat(String(data[0][1]));
    return isValidBtcPrice(open) ? open : null;
  } catch {
    return null;
  }
}

async function fetchCoinbaseOpen(bucketSeconds: number): Promise<number | null> {
  try {
    const start = bucketSeconds;
    const end = bucketSeconds + 900;
    const res = await fetch(
      `https://api.coinbase.com/api/v3/brokerage/market/products/BTC-USD/candles?start=${start}&end=${end}&granularity=FIFTEEN_MINUTE`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const candles = data?.candles;
    if (!Array.isArray(candles) || candles.length === 0) return null;
    const match = candles.find((c: any) => Math.abs(parseInt(c.start) - bucketSeconds) < 60);
    const open = match ? parseFloat(match.open) : parseFloat(candles[0].open);
    return isValidBtcPrice(open) ? open : null;
  } catch {
    return null;
  }
}

function formatRoundTimeET(bucketSeconds: number): string {
  const roundEndMs = (bucketSeconds + 900) * 1000;
  return new Date(roundEndMs).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' ET';
}

const fetchBook = async (tokenId: string | null) => {
  const empty = {
    bestBid: null as number | null,
    bestAsk: null as number | null,
    mid:     null as number | null,
    spread:  null as number | null,
    bidDepth: 0,
    askDepth: 0,
    bidDepth5pct: 0,
    askDepth5pct: 0,
    imbalance: 0,
  };
  if (!tokenId) return empty;
  try {
    const r = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`, {
      headers: { Accept: 'application/json' }, cache: 'no-store',
    });
    if (!r.ok) return empty;
    const book = await r.json();

    const parsedBids = (book?.bids ?? [])
      .map((b: any) => ({ price: parseFloat(b.price), size: parseFloat(b.size) }))
      .filter((b: any) => Number.isFinite(b.price) && Number.isFinite(b.size))
      .sort((a: any, b: any) => b.price - a.price);

    const parsedAsks = (book?.asks ?? [])
      .map((a: any) => ({ price: parseFloat(a.price), size: parseFloat(a.size) }))
      .filter((a: any) => Number.isFinite(a.price) && Number.isFinite(a.size))
      .sort((a: any, b: any) => a.price - b.price);

    const bestBid = parsedBids[0]?.price ?? null;
    const bestAsk = parsedAsks[0]?.price ?? null;
    const mid = bestBid !== null && bestAsk !== null
      ? (bestBid + bestAsk) / 2
      : (bestBid ?? bestAsk ?? null);
    const spread = bestBid !== null && bestAsk !== null
      ? bestAsk - bestBid
      : null;

    const bidDepth = parsedBids.reduce((sum: number, b: any) => sum + b.size, 0);
    const askDepth = parsedAsks.reduce((sum: number, a: any) => sum + a.size, 0);

    const bidDepth5pct = parsedBids
      .filter((b: any) => bestBid !== null && bestBid - b.price <= 0.05)
      .reduce((sum: number, b: any) => sum + b.size, 0);
    const askDepth5pct = parsedAsks
      .filter((a: any) => bestAsk !== null && a.price - bestAsk <= 0.05)
      .reduce((sum: number, a: any) => sum + a.size, 0);

    const totalDepth = bidDepth + askDepth;
    const imbalance = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0;

    return {
      bestBid: bestBid !== null && Number.isFinite(bestBid) ? bestBid : null,
      bestAsk: bestAsk !== null && Number.isFinite(bestAsk) ? bestAsk : null,
      mid:     mid     !== null && Number.isFinite(mid)     ? mid     : null,
      spread,
      bidDepth: Math.round(bidDepth),
      askDepth: Math.round(askDepth),
      bidDepth5pct: Math.round(bidDepth5pct),
      askDepth5pct: Math.round(askDepth5pct),
      imbalance: Math.round(imbalance * 1000) / 1000,
    };
  } catch { return empty; }
};

export async function GET() {
  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bucket     = Math.floor(nowSeconds / 900) * 900;

    // ── 1. Find live Polymarket market ────────────────────────────────────────
    const slugCandidates = [bucket, bucket - 900, bucket + 900];
    let slug       = `btc-updown-15m-${bucket}`;
    let liveMarket: any = null;

    for (const ts of slugCandidates) {
      const trySlug = `btc-updown-15m-${ts}`;
      try {
        const evRes = await fetch(
          `https://gamma-api.polymarket.com/events/slug/${trySlug}`,
          { cache: 'no-store' }
        );
        if (!evRes.ok) continue;
        const ev = await evRes.json();
        if (!ev || typeof ev !== 'object') continue;
        if (Array.isArray(ev.markets) && ev.markets.length > 0) {
          liveMarket = ev.markets[0];
          slug = trySlug;
          break;
        }
      } catch { continue; }
    }

    if (!liveMarket) {
      const response = await fetch(
        `https://gamma-api.polymarket.com/markets?slug=${slug}`,
        { cache: 'no-store' }
      );
      const markets = await response.json();
      if (!Array.isArray(markets) || markets.length === 0) {
        return NextResponse.json({
          success: false, priceToBeat: 0, probability: 0,
          title: 'Scanning BTC 15m markets...',
        });
      }
      liveMarket = markets[0];
    }

    const market = liveMarket;

    // ── 2. Token ID mapping ───────────────────────────────────────────────────
    const rawClobTokenIds = market.clobTokenIds;
    const clobTokenIds    = typeof rawClobTokenIds === 'string'
      ? JSON.parse(rawClobTokenIds) : rawClobTokenIds;

    const upTokenId   = Array.isArray(clobTokenIds) && clobTokenIds.length > 0 ? clobTokenIds[0] : null;
    const downTokenId = Array.isArray(clobTokenIds) && clobTokenIds.length > 1 ? clobTokenIds[1] : null;

    const [upBook, downBook] = await Promise.all([
      fetchBook(upTokenId),
      fetchBook(downTokenId),
    ]);

    const gammaPrices = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices) : market.outcomePrices;

    const gammaUpPrice = Array.isArray(gammaPrices) && gammaPrices[0]
      ? parseFloat(gammaPrices[0]) : null;
    const gammaDownPrice = Array.isArray(gammaPrices) && gammaPrices[1]
      ? parseFloat(gammaPrices[1]) : null;

    const finalUpAsk = upBook.bestAsk ?? gammaUpPrice;
    const finalDownAsk = downBook.bestAsk ?? gammaDownPrice;

    // ── 3. Probability ────────────────────────────────────────────────────────
    const prices = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices) : market.outcomePrices;

    let upProb = Array.isArray(prices) && prices.length > 0
      ? Math.round(parseFloat(prices[0]) * 100)
      : 50;

    if (upBook.mid !== null && Math.abs(upProb - 50) <= 1) {
      upProb = Math.round(upBook.mid * 100);
    }

    // ── 4. Price to beat ──────────────────────────────────────────────────────
    let priceToBeat = 0;
    let priceToBeatSource = 'none';

// 1. Read eventMetadata.priceToBeat from the event endpoint
try {
  const evRes = await fetch(
    `https://gamma-api.polymarket.com/events/slug/${slug}`,
    { cache: 'no-store' }
  );
  if (evRes.ok) {
    const ev = await evRes.json();
  }
} catch {}

    // 2. Parse from question text as fallback
    if (priceToBeat <= 0 && market?.question) {
      const match = String(market.question).match(/\$?([\d,]+\.?\d*)/);
      if (match) {
        const parsed = parseFloat(match[1].replace(/,/g, ''));
        if (isValidBtcPrice(parsed)) {
          priceToBeat = parsed;
          priceToBeatSource = 'question-parse';
        }
      }
    }

    // 3. Cache as last resort — same bucket only
    if (priceToBeat <= 0 && cachedPriceToBeat?.bucket === bucket) {
      priceToBeat = cachedPriceToBeat.price;
      priceToBeatSource = 'cached';
    }

    // 4. Exchange open price as final fallback
    if (priceToBeat <= 0) {
      const [binanceOpen, coinbaseOpen] = await Promise.all([
        fetchBinanceOpen(bucket),
        fetchCoinbaseOpen(bucket),
      ]);

      if (coinbaseOpen !== null) {
        priceToBeat = coinbaseOpen;
        priceToBeatSource = 'coinbase';
      } else if (binanceOpen !== null) {
        priceToBeat = binanceOpen;
        priceToBeatSource = 'binance';
      }

      if (priceToBeat > 0) {
        cachedPriceToBeat = { bucket, price: priceToBeat };
      }
    }

    console.log(`Final priceToBeat: ${priceToBeat} (source: ${priceToBeatSource})`);

    // ── 5. Previous round result ──────────────────────────────────────────────
    const previousBucket = bucket - 900;
    const prevSlug       = `btc-updown-15m-${previousBucket}`;
    let lastResult: 'UP' | 'DOWN' | 'UNKNOWN' = 'UNKNOWN';
    let lastUp   = 0;
    let lastDown = 0;

    try {
      const prevRes     = await fetch(
        `https://gamma-api.polymarket.com/markets?slug=${prevSlug}`,
        { cache: 'no-store' }
      );
      const prevMarkets = await prevRes.json();
      if (Array.isArray(prevMarkets) && prevMarkets.length > 0) {
        const prev       = prevMarkets[0];
        const prevPrices = typeof prev.outcomePrices === 'string'
          ? JSON.parse(prev.outcomePrices) : prev.outcomePrices;
        if (Array.isArray(prevPrices) && prevPrices.length > 0) {
          lastUp   = parseFloat(prevPrices[0]);
          lastDown = prevPrices[1] != null ? parseFloat(prevPrices[1]) : 1 - lastUp;
          if (!Number.isNaN(lastUp) && !Number.isNaN(lastDown)) {
            lastResult = lastUp >= lastDown ? 'UP' : 'DOWN';
          }
        }
      }
    } catch {}

    // ── 6. Title ──────────────────────────────────────────────────────────────
    const baseTitle   = (market.question && String(market.question).trim()) || 'Bitcoin Up or Down - 15 Minutes';
    const roundTimeEt = formatRoundTimeET(bucket);
    const title       = `${baseTitle.replace(/\s*-\s*[A-Za-z]{3}\s+\d{1,2},?\s+.*ET$/i, '').trim()} - ${roundTimeEt}`;

    return NextResponse.json({
      success: true,
      priceToBeat,
      priceToBeatSource,
      bucket,
      probability: upProb,
      title,
      clob: {
        up:   { tokenId: upTokenId,   ...upBook,   bestAsk: finalUpAsk   },
        down: { tokenId: downTokenId, ...downBook, bestAsk: finalDownAsk },
      },
      lastRound: {
        bucket: previousBucket,
        result: lastResult,
        up:     lastUp,
        down:   lastDown,
      },
    });

  } catch (error) {
    console.error('Round API error:', error);
    return NextResponse.json({
      success: false, priceToBeat: 0, probability: 0, title: 'API Offline',
    });
  }
}
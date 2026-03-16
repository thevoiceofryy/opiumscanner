import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MIN_BTC_PRICE = 50_000;
const MAX_BTC_PRICE = 200_000;

function isValidBtcPrice(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_BTC_PRICE && value <= MAX_BTC_PRICE;
}

const BINANCE_API          = 'https://api.binance.com/api/v3';
const COINBASE_EXCHANGE_API = 'https://api.exchange.coinbase.com';
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
    console.log(`Binance open for bucket ${bucketSeconds}: ${open}`);
    return isValidBtcPrice(open) ? open : null;
  } catch (e) {
    console.error('Binance fetch error:', e);
    return null;
  }
}

async function fetchCoinbaseOpen(bucketSeconds: number): Promise<number | null> {
  try {
    // Coinbase Advanced Trade API — more reliable for specific candles
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
    // Find the candle matching our bucket
    const match = candles.find((c: any) => Math.abs(parseInt(c.start) - bucketSeconds) < 60);
    const open = match ? parseFloat(match.open) : parseFloat(candles[0].open);
    console.log(`Coinbase Advanced open for bucket ${bucketSeconds}: ${open}`);
    return isValidBtcPrice(open) ? open : null;
  } catch (e) {
    console.error('Coinbase Advanced fetch error:', e);
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
  };
  if (!tokenId) return empty;
  try {
    const r = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`, {
      headers: { Accept: 'application/json' }, cache: 'no-store',
    });
    if (!r.ok) return empty;
    const book = await r.json();

    console.log(`CLOB book for token ${tokenId.slice(0, 10)}...: bids=${book?.bids?.length ?? 0} asks=${book?.asks?.length ?? 0}`)

    // Sort bids descending (highest first), asks ascending (lowest first)
    const sortedBids = (book?.bids ?? [])
      .map((b: any) => parseFloat(b.price))
      .filter((p: number) => Number.isFinite(p))
      .sort((a: number, b: number) => b - a);

    const sortedAsks = (book?.asks ?? [])
      .map((a: any) => parseFloat(a.price))
      .filter((p: number) => Number.isFinite(p))
      .sort((a: number, b: number) => a - b);

    const bestBid = sortedBids[0] ?? null;
    const bestAsk = sortedAsks[0] ?? null;
    const mid = bestBid !== null && bestAsk !== null
      ? (bestBid + bestAsk) / 2
      : (bestBid ?? bestAsk ?? null);

    return {
      bestBid: bestBid !== null && Number.isFinite(bestBid) ? bestBid : null,
      bestAsk: bestAsk !== null && Number.isFinite(bestAsk) ? bestAsk : null,
      mid:     mid     !== null && Number.isFinite(mid)     ? mid     : null,
    };
  } catch { return empty; }
};

export async function GET() {
  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bucket     = Math.floor(nowSeconds / 900) * 900;

    console.log(`Round API called. Now: ${nowSeconds}, Bucket: ${bucket}, Time: ${new Date(bucket * 1000).toISOString()}`);

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
          console.log(`Found market at slug: ${trySlug}`);
          break;
        }
      } catch { continue; }
    }

    if (!liveMarket) {
      const response  = await fetch(
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
    // Polymarket clobTokenIds layout for BTC Up/Down markets:
    //   [0] = UP  token  (YES — BTC ends higher)
    //   [1] = DOWN token (NO  — BTC ends lower)
    //
    // outcomePrices layout matches outcomes array:
    //   outcomes[0] = "Up"   → outcomePrices[0] = UP probability
    //   outcomes[1] = "Down" → outcomePrices[1] = DOWN probability
    //
    // Log outcomes array so we can verify ordering in server logs
    console.log('market.outcomes:', market.outcomes)
    console.log('market.outcomePrices:', market.outcomePrices)
    console.log('market.clobTokenIds:', market.clobTokenIds)

    const rawClobTokenIds = market.clobTokenIds;
    const clobTokenIds    = typeof rawClobTokenIds === 'string'
      ? JSON.parse(rawClobTokenIds) : rawClobTokenIds;

    // ── FIX: correct index assignment ────────────────────────────────────────
    // outcomes[0] = "Up"   → token[0] = UP  token
    // outcomes[1] = "Down" → token[1] = DOWN token
    const upTokenId   = Array.isArray(clobTokenIds) && clobTokenIds.length > 0 ? clobTokenIds[0] : null;
    const downTokenId = Array.isArray(clobTokenIds) && clobTokenIds.length > 1 ? clobTokenIds[1] : null;

    console.log(`Token mapping — UP: ${upTokenId?.slice(0,10)}... DOWN: ${downTokenId?.slice(0,10)}...`)

    const [upBook, downBook] = await Promise.all([
      fetchBook(upTokenId),
      fetchBook(downTokenId),
    ]);

    console.log(`CLOB result — UP ask: ${upBook.bestAsk} DOWN ask: ${downBook.bestAsk}`)

    // Fallback: If CLOB doesn't have orderbook data, use outcomePrices from Gamma API
    // outcomePrices[0] = UP price, outcomePrices[1] = DOWN price
    const gammaPrices = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices) : market.outcomePrices;
    
    const gammaUpPrice = Array.isArray(gammaPrices) && gammaPrices[0] 
      ? parseFloat(gammaPrices[0]) : null;
    const gammaDownPrice = Array.isArray(gammaPrices) && gammaPrices[1]
      ? parseFloat(gammaPrices[1]) : null;

    console.log(`Gamma prices — UP: ${gammaUpPrice} DOWN: ${gammaDownPrice}`)

    // Use CLOB if available, otherwise fall back to Gamma prices
    const finalUpAsk = upBook.bestAsk ?? gammaUpPrice;
    const finalDownAsk = downBook.bestAsk ?? gammaDownPrice;

    // ── 3. Event-level priceToBeat (canonical Polymarket source) ──────────────
    let eventPriceToBeat: number | null = null;
    try {
      const evRes = await fetch(
        `https://gamma-api.polymarket.com/events/slug/${slug}`,
        { cache: 'no-store' }
      );
      if (evRes.ok) {
        const ev = await evRes.json();
        if (ev && typeof ev === 'object') {
          const meta = ev.eventMetadata ?? ev.metadata ?? ev.data;
          const raw  = meta?.priceToBeat ?? ev.priceToBeat;
          const n    = typeof raw === 'number' ? raw : raw != null ? parseFloat(String(raw)) : NaN;
          if (isValidBtcPrice(n)) eventPriceToBeat = n;
        }
      }
    } catch {}

    // ── 4. Probability ────────────────────────────────────────────────────────
    // outcomePrices[0] = UP probability (matches outcomes[0] = "Up")
    const prices  = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices) : market.outcomePrices;

    let upProb = Array.isArray(prices) && prices.length > 0
      ? Math.round(parseFloat(prices[0]) * 100)
      : 50;

    // If gamma price is stuck at 50, use CLOB mid as better estimate
    if (upBook.mid !== null && Math.abs(upProb - 50) <= 1) {
      upProb = Math.round(upBook.mid * 100);
    }

    console.log(`Probability — UP: ${upProb}% (from outcomePrices[0]=${prices?.[0]}, clobMid=${upBook.mid})`)

    // ── 5. Price to beat ──────────────────────────────────────────────────────
    // Polymarket should be the source of truth for priceToBeat so we match their UI.
    const parsePolymarketP2B = (raw: unknown): number => {
      if (typeof raw === 'number' && isValidBtcPrice(raw)) return raw;
      if (raw != null) {
        const n = parseFloat(String(raw));
        if (isValidBtcPrice(n)) return n;
      }
      return 0;
    };

    let priceToBeat       = 0;
    let priceToBeatSource = 'polymarket';

    // a) Event-level priceToBeat (closest to Polymarket \"Price to beat\")
    if (eventPriceToBeat != null && eventPriceToBeat > 0) {
      priceToBeat = eventPriceToBeat;
    } else {
      // b) Market / eventMetadata priceToBeat as backup
      const fromMarketMeta =
        (market?.events?.[0]?.eventMetadata?.priceToBeat ??
         market?.eventMetadata?.priceToBeat ??
         (market as any)?.priceToBeat);
      const marketP2B = parsePolymarketP2B(fromMarketMeta);
      if (marketP2B > 0) {
        priceToBeat = marketP2B;
      }
    }

    // TO:
    if (priceToBeat <= 0) {
      // Return cached price if same bucket — don't let it drift mid-round
      if (cachedPriceToBeat && cachedPriceToBeat.bucket === bucket) {
        priceToBeat = cachedPriceToBeat.price;
        priceToBeatSource = 'cached';
      } else {
        priceToBeatSource = 'exchange-fallback';
        const [binanceOpen, coinbaseOpen] = await Promise.all([
          fetchBinanceOpen(bucket),
          fetchCoinbaseOpen(bucket),
        ]);

        if (coinbaseOpen !== null) {
          priceToBeat       = coinbaseOpen;
          priceToBeatSource = 'coinbase';
        } else if (binanceOpen !== null) {
          priceToBeat       = binanceOpen;
          priceToBeatSource = 'binance';
        }

        if (priceToBeat <= 0) {
          try {
            const tickerRes = await fetch(
              'https://api.exchange.coinbase.com/products/BTC-USD/ticker',
              { cache: 'no-store' }
            );
            if (tickerRes.ok) {
              const ticker = await tickerRes.json();
              const spot   = parseFloat(ticker.price);
              if (isValidBtcPrice(spot)) {
                priceToBeat       = spot;
                priceToBeatSource = 'coinbase-spot';
              }
            }
          } catch {}
        }

        // Lock this price for the rest of the bucket
        if (priceToBeat > 0) {
          cachedPriceToBeat = { bucket, price: priceToBeat };
        }
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
          // prevPrices[0] = UP outcome price (1.00 = resolved UP, 0.00 = resolved DOWN)
          lastUp   = parseFloat(prevPrices[0]);
          lastDown = prevPrices[1] != null ? parseFloat(prevPrices[1]) : 1 - lastUp;
          if (!Number.isNaN(lastUp) && !Number.isNaN(lastDown)) {
            lastResult = lastUp >= lastDown ? 'UP' : 'DOWN';
          }
        }
      }
    } catch {}

    // ── 6. Title ──────────────────────────────────────────────────────────────
    const baseTitle    = (market.question && String(market.question).trim()) || 'Bitcoin Up or Down - 15 Minutes';
    const roundTimeEt  = formatRoundTimeET(bucket);
    const title        = `${baseTitle.replace(/\s*-\s*[A-Za-z]{3}\s+\d{1,2},?\s+.*ET$/i, '').trim()} - ${roundTimeEt}`;

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

import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(
    "https://api.coinbase.com/api/v3/brokerage/market/products/BTC-USD/candles?granularity=FIFTEEN_MINUTE&limit=3"
  );
  const data = await res.json();
  return NextResponse.json(data);
}
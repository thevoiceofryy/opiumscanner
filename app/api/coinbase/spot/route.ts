import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
  const data = await res.json();
  return NextResponse.json(data);
}
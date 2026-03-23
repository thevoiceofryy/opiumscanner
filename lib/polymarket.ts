import { ClobClient } from "@polymarket/clob-client"

export async function executeTrade({
  marketId,
  outcome,
  amount,
  price,
}: {
  marketId: string
  outcome: "YES" | "NO"
  amount: number
  price: number
}) {
  try {
const client = new ClobClient(
  "https://clob.polymarket.com",
  137
)

    // convert $ → shares
    const shares = amount / price

const order = await client.createOrder({
  tokenID: marketId,
  price: Number(price),
  size: Number(shares),
  side: outcome === "YES" ? "BUY" : "SELL",
} as any)

    const result = await client.postOrder(order)

    console.log("Order result:", result)

    return result
  } catch (err) {
    console.error("Trade error:", err)
    throw err
  }
}
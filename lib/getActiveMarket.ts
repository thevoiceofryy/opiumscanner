export async function getActiveBTCMarket() {
const res = await fetch('/api/polymarket/markets')

  if (!res.ok) throw new Error('Failed to fetch market')

  const data = await res.json()

  return data // already { yesToken, noToken, question }
}
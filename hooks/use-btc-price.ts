'use client'

import { useEffect, useState } from 'react'

export function useBTCPrice() {

  const [price, setPrice] = useState<number | null>(null)

  useEffect(() => {

    const fetchPrice = async () => {

      try {

        const res = await fetch(
          "https://api.coinbase.com/v2/prices/BTC-USD/spot"
        )

        const json = await res.json()

        const value = parseFloat(json.data.amount)

        setPrice(value)

      } catch (err) {

        console.log("Coinbase price fetch error", err)

      }

    }

    fetchPrice()

    const interval = setInterval(fetchPrice, 2000)

    return () => clearInterval(interval)

  }, [])

  return price

}
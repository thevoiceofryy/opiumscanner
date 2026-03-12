'use client'

import { useEffect, useRef } from "react"

interface Props {
  priceToBeat?: number | null
}

export default function TradingViewBTCChart({ priceToBeat }: Props) {

  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {

    if (!container.current) return

    const script = document.createElement("script")
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
    script.async = true

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: "COINBASE:BTCUSD",
      interval: "1",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: false,
      studies: [],
      support_host: "https://www.tradingview.com"
    })

    container.current.innerHTML = ""
    container.current.appendChild(script)

  }, [priceToBeat])

  return (
    <div className="w-full h-full">
      <div
        ref={container}
        className="tradingview-widget-container w-full h-full"
      />
    </div>
  )
}
'use client'

import { useEffect, useRef } from "react"

interface Props {
  priceToBeat?: number | null
}

export default function TradingViewBTCChart({ priceToBeat }: Props) {

  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return

    // 🔥 FULL RESET (prevents HA caching)
    while (container.current.firstChild) {
      container.current.removeChild(container.current.firstChild)
    }

    const script = document.createElement("script")
script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js"
    script.async = true

    script.innerHTML = JSON.stringify({
      autosize: true,

      // ✅ BEST FEED
symbol: "BINANCE:BTCUSD",

      // ✅ SMOOTHER
      interval: "3",

      timezone: "Etc/UTC",
      theme: "dark",
      locale: "en",

      // ❌ DO NOT rely on "style"
      // widget ignores it sometimes

      allow_symbol_change: true,
      save_image: false,
  underLineColor: "rgba(55, 166, 239, 0.15)",
    trendLineColor: "#37a6ef",
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      withdateranges: true,
        isTransparent: true,

      studies: [],

      // 🔥 FORCE NORMAL CANDLES (THIS IS KEY)
      overrides: {
        "mainSeriesProperties.style": 1, // candles
        "mainSeriesProperties.haStyle.color": "#000000" // kills HA bleed
      }
    })

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
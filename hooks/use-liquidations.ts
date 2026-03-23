import { useEffect, useState } from 'react'

export function useLiquidations() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    const eventSource = new EventSource('/api/liquidations')

    eventSource.onmessage = (event) => {
      const liq = JSON.parse(event.data)

      setData((prev) => [liq, ...prev.slice(0, 50)])
    }

    return () => eventSource.close()
  }, [])

  return data
}
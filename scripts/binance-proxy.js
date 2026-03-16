// scripts/binance-proxy.js
// Run this alongside Next.js: node scripts/binance-proxy.js
// Proxies Binance WebSocket streams so the browser never hits Binance directly.
// Binance geo-blocks US IPs in the browser, but server-side Node.js connections work fine.

const { WebSocketServer, WebSocket } = require('ws')
const http = require('http')

const PORT = 3001

const STREAM_MAP = {
  '/aggtrade': 'wss://stream.binance.com:9443/ws/btcusdt@aggTrade',
  '/kline_15m': 'wss://stream.binance.com:9443/ws/btcusdt@kline_15m',
}

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/plain',
  })
  res.end('Binance WebSocket Proxy running')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (clientWs, req) => {
  const path = req.url || ''
  const upstream = STREAM_MAP[path]

  if (!upstream) {
    console.error(`[proxy] Unknown path: ${path}`)
    clientWs.close(1008, 'Unknown stream path')
    return
  }

  console.log(`[proxy] Client connected → ${upstream}`)

  const binanceWs = new WebSocket(upstream)

  binanceWs.on('open', () => {
    console.log(`[proxy] Upstream connected: ${upstream}`)
  })

  // Forward Binance → browser
  binanceWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data)
    }
  })

  // Forward browser → Binance (subscriptions etc.)
  clientWs.on('message', (data) => {
    if (binanceWs.readyState === WebSocket.OPEN) {
      binanceWs.send(data)
    }
  })

  binanceWs.on('close', (code, reason) => {
    console.log(`[proxy] Upstream closed: ${code}`)
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(code)
    }
  })

  binanceWs.on('error', (err) => {
    console.error(`[proxy] Upstream error:`, err.message)
    clientWs.close(1011, 'Upstream error')
  })

  clientWs.on('close', () => {
    console.log(`[proxy] Client disconnected`)
    if (binanceWs.readyState === WebSocket.OPEN) {
      binanceWs.close()
    }
  })

  clientWs.on('error', (err) => {
    console.error(`[proxy] Client error:`, err.message)
    binanceWs.close()
  })
})

server.listen(PORT, () => {
  console.log(`[proxy] Binance WebSocket proxy running on ws://localhost:${PORT}`)
  console.log(`[proxy]   /aggtrade  → btcusdt@aggTrade`)
  console.log(`[proxy]   /kline_15m → btcusdt@kline_15m`)
})
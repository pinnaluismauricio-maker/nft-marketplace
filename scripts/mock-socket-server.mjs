
import { createServer } from 'node:http'
import { Server } from 'socket.io'

const PORT = Number(process.env.SOCKET_PORT || 3001)

const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  if (req.method !== 'POST' || req.url !== '/events') {
    res.writeHead(404)
    return res.end('Not found')
  }

  let body = ''
  req.on('data', (chunk) => {
    body += chunk
    if (body.length > 1_000_000) {
      req.destroy()
    }
  })

  req.on('end', () => {
    try {
      const event = JSON.parse(body)

      if (
        !event ||
        typeof event.type !== 'string' ||
        typeof event.version !== 'number' ||
        !event.resource
      ) {
        res.writeHead(400)
        return res.end('Invalid event')
      }

      if (event.type === 'nft.updated') {
        io.emit('domain:event', event)
      } else if (
        event.type === 'order.updated' &&
        typeof event.userId === 'string'
      ) {
        io.to(`user:${event.userId}`).emit('domain:event', event)
      }

      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ received: true }))
    } catch {
      res.writeHead(400)
      res.end('Invalid JSON')
    }
  })
})

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
})

io.on('connection', (socket) => {
  socket.on('join:user', (userId) => {
    if (typeof userId === 'string' && userId.length > 0) {
      socket.join(`user:${userId}`)
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`Mock Socket.IO ativo em http://localhost:${PORT}`)
})

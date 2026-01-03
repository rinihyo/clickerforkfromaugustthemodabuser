/** @import { DurableObjectState, DurableObjectNamespace, Fetcher, ExportedHandler } from '@cloudflare/workers-types' */

/**
 * @typedef {Object} ClientData
 * @property {string} id - Unique client identifier
 * @property {string} name - Display name of the client
 * @property {string | null} country - Country code from CF-IPCountry header
 * @property {string | null} userAgent - User agent string
 * @property {number} connectedAt - Timestamp when client connected
 * @property {boolean} isAdmin - Whether this is an admin connection
 * @property {boolean} [connected] - Whether client is currently connected (for admin view)
 */

/**
 * @typedef {Object} AdminData
 * @property {string} id - Unique admin identifier
 * @property {boolean} isAdmin - Always true for admin connections
 */

/**
 * @typedef {ClientData | AdminData} SocketAttachment
 */

/**
 * @typedef {Object} Env
 * @property {DurableObjectNamespace} CLICKER_ROOM - Durable Object binding
 * @property {Fetcher} ASSETS - Static assets binding
 * @property {string} ADMIN_PASSWORD - Admin password from environment
 * @property {string} SLACK_TOKEN - Slack bot token
 * @property {string} SLACK_CHANNEL - Slack channel ID
 */

/**
 * @typedef {Object} WsMessage
 * @property {string} type - Message type
 * @property {string} [id] - Client ID for ack/leave messages
 * @property {string} [targetId] - Target client ID for targeted trigger
 * @property {ClientData} [client] - Client data for join messages
 * @property {ClientData[]} [clients] - Client list for clients message
 */

/**
 * Durable Object class for managing WebSocket connections and broadcasting clicks
 */
export class ClickerRoom {
  /** @type {DurableObjectState} */
  ctx

  /** @type {Env} */
  env

  /**
   * @param {DurableObjectState} ctx - Durable Object state
   * @param {Env} env - Environment bindings
   */
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env

    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          country TEXT,
          userAgent TEXT,
          connectedAt INTEGER NOT NULL
        )
      `)
    })
  }

  /**
   * Save a client to the database
   * @param {ClientData} client - Client data to save
   */
  saveClient(client) {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO clients (id, name, country, userAgent, connectedAt)
       VALUES (?, ?, ?, ?, ?)`,
      client.id,
      client.name,
      client.country,
      client.userAgent,
      client.connectedAt
    )
  }

  /**
   * Delete a client from the database
   * @param {string} id - Client ID to delete
   */
  deleteClient(id) {
    this.ctx.storage.sql.exec(`DELETE FROM clients WHERE id = ?`, id)
  }

  /**
   * Get all clients from the database
   * @returns {ClientData[]} Array of all stored clients
   */
  getAllStoredClients() {
    const rows = this.ctx.storage.sql.exec(
      `SELECT id, name, country, userAgent, connectedAt FROM clients ORDER BY connectedAt DESC`
    )
    /** @type {ClientData[]} */
    const clients = []
    for (const row of rows) {
      clients.push({
        id: /** @type {string} */ (row.id),
        name: /** @type {string} */ (row.name),
        country: /** @type {string | null} */ (row.country),
        userAgent: /** @type {string | null} */ (row.userAgent),
        connectedAt: /** @type {number} */ (row.connectedAt),
        isAdmin: false,
      })
    }
    return clients
  }

  /**
   * Handle incoming HTTP requests to the Durable Object
   * @param {Request} request - The incoming request
   * @returns {Promise<Response>} The response
   */
  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 })
      }

      const id = url.searchParams.get('id') || 'unknown'
      const name = url.searchParams.get('name') || 'Anonymous'
      const country = request.headers.get('CF-IPCountry') || null
      const userAgent = request.headers.get('User-Agent') || null

      const pair = new WebSocketPair()
      /** @type {ClientData} */
      const clientData = {
        id,
        name,
        country,
        userAgent,
        connectedAt: Date.now(),
        isAdmin: false,
      }

      this.ctx.acceptWebSocket(pair[1])
      pair[1].serializeAttachment(clientData)

      this.saveClient(clientData)

      this.broadcastToAdmins({
        type: 'join',
        client: { ...clientData, connected: true },
      })

      this.notifySlack(clientData)

      return new Response(null, { status: 101, webSocket: pair[0] })
    }

    if (url.pathname === '/ws/admin') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 })
      }

      const pair = new WebSocketPair()
      /** @type {AdminData} */
      const adminData = {
        id: 'admin_' + Date.now(),
        isAdmin: true,
      }

      this.ctx.acceptWebSocket(pair[1])
      pair[1].serializeAttachment(adminData)

      const clients = this.getFullClientList()
      pair[1].send(JSON.stringify({ type: 'clients', clients }))

      return new Response(null, { status: 101, webSocket: pair[0] })
    }

    if (url.pathname === '/api/clients' && request.method === 'DELETE') {
      const clientId = url.searchParams.get('id')
      if (!clientId) {
        return new Response('Missing id', { status: 400 })
      }
      this.deleteClient(clientId)
      this.broadcastToAdmins({ type: 'deleted', id: clientId })
      return new Response('OK', { status: 200 })
    }

    return new Response('Not found', { status: 404 })
  }

  /**
   * Send a Slack notification when a user connects
   * @param {ClientData} client - The client data
   */
  notifySlack(client) {
    const flag = client.country
      ? String.fromCodePoint(
          ...client.country
            .toUpperCase()
            .split('')
            .map((c) => 127397 + c.charCodeAt(0))
        )
      : '🌍'
    const device = client.userAgent?.includes('Mobile') ? '📱' : '💻'
    const text = `${flag} ${device} *${client.name}* joined`

    fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.SLACK_TOKEN}`,
      },
      body: JSON.stringify({
        channel: this.env.SLACK_CHANNEL,
        text,
      }),
    }).catch(() => {
      // Ignore Slack errors
    })
  }

  /**
   * Get set of currently connected client IDs
   * @returns {Set<string>} Set of connected client IDs
   */
  getConnectedClientIds() {
    const sockets = this.ctx.getWebSockets()
    /** @type {Set<string>} */
    const connectedIds = new Set()
    for (const ws of sockets) {
      /** @type {SocketAttachment | null} */
      const data = ws.deserializeAttachment()
      if (data && !data.isAdmin) {
        const clientData = /** @type {ClientData} */ (data)
        connectedIds.add(clientData.id)
      }
    }
    return connectedIds
  }

  /**
   * Get full client list with connected status (connected first, then disconnected)
   * @returns {ClientData[]} Array of client data objects with connected flag
   */
  getFullClientList() {
    const connectedIds = this.getConnectedClientIds()
    const allClients = this.getAllStoredClients()

    const connected = []
    const disconnected = []

    for (const client of allClients) {
      if (connectedIds.has(client.id)) {
        connected.push({ ...client, connected: true })
      } else {
        disconnected.push({ ...client, connected: false })
      }
    }

    return [...connected, ...disconnected]
  }

  /**
   * Broadcast a message to all admin WebSocket connections
   * @param {WsMessage} msg - Message to broadcast
   */
  broadcastToAdmins(msg) {
    const sockets = this.ctx.getWebSockets()
    const msgStr = JSON.stringify(msg)
    for (const ws of sockets) {
      /** @type {SocketAttachment | null} */
      const data = ws.deserializeAttachment()
      if (data && data.isAdmin) {
        try {
          ws.send(msgStr)
        } catch (_e) {
          // Ignore send errors
        }
      }
    }
  }

  /**
   * Broadcast a message to all non-admin client WebSocket connections
   * @param {WsMessage} msg - Message to broadcast
   */
  broadcastToClients(msg) {
    const sockets = this.ctx.getWebSockets()
    const msgStr = JSON.stringify(msg)
    for (const ws of sockets) {
      /** @type {SocketAttachment | null} */
      const data = ws.deserializeAttachment()
      if (data && !data.isAdmin) {
        try {
          ws.send(msgStr)
        } catch (_e) {
          // Ignore send errors
        }
      }
    }
  }

  /**
   * Send a message to a specific client by ID
   * @param {string} targetId - The client ID to send to
   * @param {WsMessage} msg - Message to send
   */
  sendToClient(targetId, msg) {
    const sockets = this.ctx.getWebSockets()
    const msgStr = JSON.stringify(msg)
    for (const ws of sockets) {
      /** @type {SocketAttachment | null} */
      const data = ws.deserializeAttachment()
      if (data && !data.isAdmin) {
        const clientData = /** @type {ClientData} */ (data)
        if (clientData.id === targetId) {
          try {
            ws.send(msgStr)
          } catch (_e) {
            // Ignore send errors
          }
          break
        }
      }
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @param {WebSocket} ws - The WebSocket that received the message
   * @param {string | ArrayBuffer} message - The message data
   */
  webSocketMessage(ws, message) {
    /** @type {SocketAttachment | null} */
    const data = ws.deserializeAttachment()
    if (!data) return

    /** @type {WsMessage | undefined} */
    let msg
    try {
      msg = JSON.parse(/** @type {string} */ (message))
    } catch (_e) {
      return
    }

    if (!msg) return

    if (data.isAdmin && msg.type === 'trigger') {
      if (msg.targetId) {
        this.sendToClient(msg.targetId, { type: 'click' })
      } else {
        this.broadcastToClients({ type: 'click' })
      }
    } else if (!data.isAdmin && msg.type === 'ack') {
      const clientData = /** @type {ClientData} */ (data)
      this.broadcastToAdmins({ type: 'ack', id: clientData.id })
    }
  }

  /**
   * Handle WebSocket close event
   * @param {WebSocket} ws - The WebSocket that closed
   * @param {number} _code - Close code
   * @param {string} _reason - Close reason
   * @param {boolean} _wasClean - Whether the close was clean
   */
  webSocketClose(ws, _code, _reason, _wasClean) {
    /** @type {SocketAttachment | null} */
    const data = ws.deserializeAttachment()
    if (data && !data.isAdmin) {
      const clientData = /** @type {ClientData} */ (data)
      this.broadcastToAdmins({ type: 'leave', id: clientData.id })
    }
  }

  /**
   * Handle WebSocket error event
   * @param {WebSocket} ws - The WebSocket that errored
   * @param {unknown} _error - The error
   */
  webSocketError(ws, _error) {
    ws.close(1011, 'WebSocket error')
  }
}

/**
 * Check if request has valid admin session cookie
 * @param {Request} request - The incoming request
 * @param {Env} env - Environment bindings
 * @returns {boolean} Whether cookie auth is valid
 */
function checkCookieAuth(request, env) {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/(?:^|; )adminToken=([^;]+)/)
  if (!match) return false
  const expected = btoa(env.ADMIN_PASSWORD).replace(/[^a-zA-Z0-9]/g, '')
  return match[1] === expected
}

/**
 * Generate the admin auth cookie value
 * @param {Env} env - Environment bindings
 * @returns {string} Cookie value
 */
function generateAuthCookie(env) {
  return btoa(env.ADMIN_PASSWORD).replace(/[^a-zA-Z0-9]/g, '')
}

/** @type {ExportedHandler<Env>} */
export default {
  /**
   * Handle incoming fetch requests
   * @param {Request} request - The incoming request
   * @param {Env} env - Environment bindings
   * @returns {Promise<Response>} The response
   */
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/ws') {
      const id = env.CLICKER_ROOM.idFromName('main')
      const stub = env.CLICKER_ROOM.get(id)
      return stub.fetch(request)
    }

    if (url.pathname === '/ws/admin') {
      if (!checkCookieAuth(request, env)) {
        return new Response('Unauthorized', { status: 401 })
      }
      const id = env.CLICKER_ROOM.idFromName('main')
      const stub = env.CLICKER_ROOM.get(id)
      return stub.fetch(request)
    }

    if (url.pathname === '/admin/auth') {
      if (request.method === 'GET') {
        if (checkCookieAuth(request, env)) {
          return new Response('OK', { status: 200 })
        }
        return new Response('Unauthorized', { status: 401 })
      }

      if (request.method === 'POST') {
        try {
          /** @type {{ password?: string }} */
          const body = await request.json()
          if (body.password === env.ADMIN_PASSWORD) {
            return new Response('OK', {
              status: 200,
              headers: {
                'Set-Cookie': `adminToken=${generateAuthCookie(env)}; Path=/; HttpOnly; SameSite=Strict`,
              },
            })
          }
        } catch (_e) {
          // Invalid JSON
        }
        return new Response('Unauthorized', { status: 401 })
      }

      return new Response('Method not allowed', { status: 405 })
    }

    if (url.pathname === '/api/clients' && request.method === 'DELETE') {
      if (!checkCookieAuth(request, env)) {
        return new Response('Unauthorized', { status: 401 })
      }
      const id = env.CLICKER_ROOM.idFromName('main')
      const stub = env.CLICKER_ROOM.get(id)
      return stub.fetch(request)
    }

    if (url.pathname === '/click.mp3') {
      const response = await env.ASSETS.fetch(request)
      const newResponse = new Response(response.body, response)
      newResponse.headers.set('Access-Control-Allow-Origin', '*')
      return newResponse
    }

    return env.ASSETS.fetch(request)
  },
}

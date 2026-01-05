<script lang="ts">
  import { onMount } from 'svelte'
  import { getAdminWsUrl, getApiBaseUrl } from '$lib/platform'
  import { countryToFlag, parseUserAgent, formatTime, formatTimeAgo } from '$lib/utils'
  import type { ClientData, WsMessage } from '$lib/types'

  let authenticated = $state(false)
  let password = $state('')
  let loginError = $state('')
  let result = $state('')
  let clients = $state<Record<string, ClientData>>({})
  let copiedClientId = $state<string | null>(null)

  let resultTimeout: ReturnType<typeof setTimeout>
  let copyTimeout: ReturnType<typeof setTimeout>
  const ackTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}

  let ws: WebSocket | null = null
  const apiBase = getApiBaseUrl()

  $effect(() => {
    // Keep clients reactive
  })

  const clientList = $derived(Object.values(clients))
  const connectedClients = $derived(clientList.filter((c) => c.connected !== false))
  const disconnectedClients = $derived(clientList.filter((c) => c.connected === false))
  const sortedClients = $derived([...connectedClients, ...disconnectedClients])

  async function checkAuth(): Promise<boolean> {
    try {
      const res = await fetch(`${apiBase}/admin/auth`, { credentials: 'include' })
      return res.ok
    } catch {
      return false
    }
  }

  async function tryLogin(pwd: string): Promise<boolean> {
    try {
      const res = await fetch(`${apiBase}/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
        credentials: 'include',
      })
      return res.ok
    } catch {
      return false
    }
  }

  function connectWs() {
    ws = new WebSocket(getAdminWsUrl())

    ws.onmessage = (e) => {
      const msg: WsMessage = JSON.parse(e.data)
      if (msg.type === 'clients' && msg.clients) {
        clients = {}
        for (const c of msg.clients) {
          clients[c.id] = c
        }
      } else if (msg.type === 'join' && msg.client) {
        clients[msg.client.id] = msg.client
      } else if (msg.type === 'leave' && msg.id) {
        if (clients[msg.id]) {
          clients[msg.id].connected = false
          clients[msg.id].lastSeen = Date.now()
        }
      } else if (msg.type === 'deleted' && msg.id) {
        delete clients[msg.id]
      } else if (msg.type === 'ack' && msg.id) {
        blinkClient(msg.id)
      } else if (msg.type === 'noteUpdated' && msg.id) {
        if (clients[msg.id]) {
          clients[msg.id].note = msg.note ?? null
        }
      }
    }

    ws.onclose = () => {
      result = 'Disconnected. Reconnecting...'
      setTimeout(connectWs, 1000)
    }

    ws.onerror = () => ws?.close()
    ws.onopen = () => (result = '')
  }

  function blinkClient(id: string) {
    const row = document.getElementById('client-' + id)
    if (row) {
      row.classList.add('ack')
      if (ackTimeouts[id]) clearTimeout(ackTimeouts[id])
      ackTimeouts[id] = setTimeout(() => {
        row.classList.remove('ack')
        delete ackTimeouts[id]
      }, 300)
    }
  }

  function triggerAll() {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'trigger' }))
      result = 'Triggered!'
      clearTimeout(resultTimeout)
      resultTimeout = setTimeout(() => (result = ''), 1000)
    } else {
      result = 'Not connected'
    }
  }

  function triggerClient(id: string) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'trigger', targetId: id }))
    }
  }

  async function deleteClient(id: string) {
    await fetch(`${apiBase}/api/clients?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
  }

  async function saveNote(id: string, note: string) {
    await fetch(`${apiBase}/api/clients/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, note: note || null }),
      credentials: 'include',
    })
  }

  function copyUA(id: string, ua: string | null) {
    if (ua) {
      navigator.clipboard.writeText(ua)
      copiedClientId = id
      clearTimeout(copyTimeout)
      copyTimeout = setTimeout(() => {
        if (copiedClientId === id) {
          copiedClientId = null
        }
      }, 1000)
    }
  }

  async function handleLogin(e: Event) {
    e.preventDefault()
    loginError = ''
    if (await tryLogin(password)) {
      authenticated = true
      connectWs()
    } else {
      loginError = 'Invalid password'
    }
  }

  onMount(async () => {
    if (await checkAuth()) {
      authenticated = true
      connectWs()
    }
  })
</script>

{#if !authenticated}
  <div class="login-modal">
    <form class="login-form" onsubmit={handleLogin}>
      <h2>Admin Login</h2>
      <input
        type="password"
        bind:value={password}
        placeholder="Password"
        autocomplete="current-password"
        required
      />
      <button type="submit">Login</button>
      {#if loginError}
        <div class="login-error">{loginError}</div>
      {/if}
    </form>
  </div>
{:else}
  <div class="main-content">
    <button class="trigger-btn" onclick={triggerAll}>Click!</button>
    <div class="result">{result}</div>
    <div class="client-count">{connectedClients.length} client{connectedClients.length !== 1 ? 's' : ''} connected</div>

    <div class="clients-grid">
      {#each sortedClients as client (client.id)}
        <div
          id="client-{client.id}"
          class="client-card"
          class:disconnected={client.connected === false}
        >
          <!-- Row 1: Name -->
          <div class="row name-row">
            <span class="flag">{countryToFlag(client.country)}</span>
            <span class="name" title={client.id}>{client.name}</span>
            <span class="country-code">{client.country || '?'}</span>
          </div>

          <!-- Row 2: Note -->
          <div class="row note-row">
            <input
              class="note-input"
              type="text"
              value={client.note || ''}
              placeholder="Add note..."
              onblur={(e) => saveNote(client.id, (e.target as HTMLInputElement).value)}
              onkeydown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
            />
          </div>

          <!-- Row 3: Type, Time -->
          <div class="row info-row">
            <span class="badge type-badge">{client.type || 'web'}</span>
            <span class="time-info">
              {formatTime(client.connectedAt)}
              {#if client.connected === false && client.lastSeen}
                <span class="last-seen"> ({formatTimeAgo(client.lastSeen)})</span>
              {/if}
            </span>
          </div>

          <!-- Row 4: OS/Browser -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="row ua-row"
            role="button"
            tabindex="0"
            onclick={() => copyUA(client.id, client.userAgent)}
            title="Click to copy User Agent"
          >
            <span style:opacity={copiedClientId === client.id ? 0 : 1}>
              {parseUserAgent(client.userAgent)}
            </span>
            {#if copiedClientId === client.id}
              <div class="copied-overlay">Copied!</div>
            {/if}
          </div>

          <!-- Row 5: Buttons -->
          <div class="row actions-row">
            {#if client.connected !== false}
              <button class="action-btn click-btn" onclick={() => triggerClient(client.id)}
                >Click</button
              >
            {/if}
            <button class="action-btn delete-btn" onclick={() => deleteClient(client.id)}
              >Delete</button
            >
          </div>
        </div>
      {:else}
        <div class="no-clients">No clients connected</div>
      {/each}
    </div>
  </div>
{/if}

<style>
  :global(html),
  :global(body) {
    overflow: auto !important;
    height: auto !important;
    min-height: 100% !important;
  }
  :global(body) {
    justify-content: flex-start !important;
  }

  .login-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .login-form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .login-form h2 {
    margin-bottom: 0.5rem;
  }
  .login-form input {
    padding: 0.75rem 1rem;
    font-size: 1.25rem;
    border: none;
    width: 250px;
    text-align: center;
  }
  .login-form button {
    padding: 0.75rem 2rem;
    font-size: 1.25rem;
    cursor: pointer;
    background: #3b82f6;
    color: white;
    border: none;
  }
  .login-form button:hover {
    background: #2563eb;
  }
  .login-error {
    color: #ef4444;
  }

  .main-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    width: 100vw;
    min-height: 100vh;
  }
  .trigger-btn {
    width: 120px;
    height: 120px;
    font-size: 1.25rem;
    cursor: pointer;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 50%;
    transition: transform 0.1s;
    margin-bottom: 1rem;
    flex-shrink: 0;
  }
  .trigger-btn:hover {
    background: #dc2626;
  }
  .trigger-btn:active {
    transform: scale(0.95);
  }
  .result {
    margin-bottom: 1rem;
    min-height: 1.5em;
  }
  .client-count {
    color: #888;
    margin-bottom: 0.5rem;
  }

  .clients-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
    width: 100%;
  }

  .client-card {
    background: #222;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: background 0.2s, transform 0.2s;
    border: 1px solid #333;
  }

  .client-card:global(.ack) {
    background-color: #224b31 !important;
  }

  .disconnected {
    opacity: 0.6;
  }

  .row {
    display: flex;
    align-items: center;
    width: 100%;
  }

  .name-row {
    font-weight: bold;
    font-size: 1.1rem;
    gap: 0.5rem;
  }

  .flag {
    font-size: 1.2rem;
  }

  .country-code {
    color: #888;
    font-size: 0.9rem;
    margin-left: auto;
  }

  .note-row {
    margin-bottom: 0.25rem;
  }

  .note-input {
    width: 100%;
    padding: 0.25rem 0.5rem;
    background: #111;
    color: inherit;
    border: 1px solid #333;
    font-size: 0.9rem;
  }

  .note-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .info-row {
    font-size: 0.85rem;
    color: #aaa;
    gap: 0.5rem;
  }

  .badge {
    padding: 0.1rem 0.4rem;
    background: #333;
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .time-info {
    margin-left: auto;
  }

  .ua-row {
    font-size: 0.85rem;
    color: #ccc;
    cursor: pointer;
    padding: 0.25rem;
    background: #1a1a1a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block; /* For text-overflow */
    position: relative;
  }

  .ua-row:hover {
    background: #333;
    color: white;
  }

  .copied-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1a1a;
    color: #4ade80;
    font-weight: bold;
  }

  .actions-row {
    margin-top: 0.5rem;
    gap: 0.5rem;
  }

  .action-btn {
    flex: 1;
    padding: 0.5rem;
    cursor: pointer;
    border: none;
    font-weight: bold;
    transition: opacity 0.2s;
  }

  .action-btn:hover {
    opacity: 0.9;
  }

  .click-btn {
    background: #3b82f6;
    color: white;
  }

  .delete-btn {
    background: #ef4444;
    color: white;
  }

  .no-clients {
    width: 100%;
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 2rem;
  }
</style>

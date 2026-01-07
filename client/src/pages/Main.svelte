<script lang="ts">
  import { onMount } from 'svelte'
  import { isTauri, getWsUrl, getOsUsername } from '$lib/platform'
  import { initAudio, playClick, isAudioReady } from '$lib/audio'
  import { getClientId, getUsername, setUsername } from '$lib/storage'
  import Flash from '$lib/Flash.svelte'

  let status = $state('')
  let showForm = $state(true)
  let showStatus = $state(false)
  let nameInput = $state('')
  let flashActive = $state(false)

  let ws: WebSocket | null = null
  let connected = false
  let clientId = ''
  let username = ''

  const isDesktop = isTauri()
  const requireName = !isDesktop
  const defaultName = isDesktop ? 'Desktop App' : ''
  const clientIdPrefix = isDesktop ? 'desktop_' : 'web_'
  const hint = isDesktop
    ? 'Runs in background. Right-click tray icon to quit.'
    : 'Keep this tab open to receive clicks.'

  function flash() {
    flashActive = true
    setTimeout(() => (flashActive = false), 100)
  }

  function connect() {
    if (connected || !isAudioReady()) return
    const url = getWsUrl(clientId)
    ws = new WebSocket(url)

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'click') {
          if (playClick()) flash()
          ws?.send(JSON.stringify({ type: 'ack' }))
        } else if (msg.type === 'reload') {
          location.reload()
        }
      } catch {}
    }

    ws.onopen = () => {
      connected = true
      status = 'Connected :3'
      ws?.send(JSON.stringify({
        type: 'identify',
        name: username,
        clientType: isDesktop ? 'desktop' : 'web',
        userAgent: navigator.userAgent
      }))
    }

    ws.onclose = () => {
      connected = false
      status = 'Disconnected. Reconnecting...'
      setTimeout(connect, 1000)
    }

    ws.onerror = () => ws?.close()
  }

  async function tryConnect() {
    showStatus = true
    status = 'Initializing audio...'
    const ok = await initAudio()
    if (ok) {
      status = 'Connecting...'
      connect()
    } else {
      status = 'Audio failed. Click anywhere to retry.'
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault()
    const name = nameInput.trim()
    if (!name) return
    setUsername(name)
    username = name
    showForm = false
    tryConnect()
  }

  function handleNameChange() {
    const name = nameInput.trim()
    if (name) {
      setUsername(name)
      username = name
      if (connected && ws) {
        ws.send(JSON.stringify({
          type: 'identify',
          name: username,
          clientType: isDesktop ? 'desktop' : 'web',
          userAgent: navigator.userAgent
        }))
      }
    }
  }

  onMount(() => {
    clientId = getClientId(clientIdPrefix)
    const savedName = getUsername()

    if (requireName) {
      showForm = true
      showStatus = false
      nameInput = savedName
    } else {
      username = savedName || defaultName
      if (!savedName && defaultName) setUsername(defaultName)
      showForm = false
      showStatus = true
      nameInput = username

      if (isDesktop) {
        tryConnect()

        if (!savedName) {
          getOsUsername().then((osUsername) => {
            if (osUsername) {
              username = osUsername
              nameInput = osUsername
              setUsername(osUsername)
              if (connected && ws) {
                ws.send(
                  JSON.stringify({
                    type: 'identify',
                    name: username,
                    clientType: 'desktop',
                    userAgent: navigator.userAgent,
                  }),
                )
              }
            }
          })
        }
      } else {
        status = 'Click anywhere to start'
        const handler = () => {
          document.removeEventListener('click', handler)
          tryConnect()
        }
        document.addEventListener('click', handler, { once: true })
      }
    }
  })
</script>

<Flash bind:active={flashActive} />

{#if showStatus}
  <div class="status">{status}</div>
{/if}

{#if showForm}
  <form class="connect-form" onsubmit={handleSubmit}>
    <input
      type="text"
      bind:value={nameInput}
      placeholder="Your name"
      autocomplete="off"
      required
    />
    <button type="submit">Connect</button>
  </form>
{:else if !requireName}
  <form class="name-form" onsubmit={(e) => { e.preventDefault(); handleNameChange() }}>
    <input
      type="text"
      bind:value={nameInput}
      placeholder="Your name"
      onblur={handleNameChange}
    />
  </form>
{/if}

<p class="hint">{hint}</p>

<style>
  .status {
    font-size: 1.25rem;
    color: #22c55e;
    margin-bottom: 1rem;
  }
  .connect-form, .name-form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 1rem;
  }
  input {
    padding: 10px 14px;
    font-size: 1.1rem;
    border: none;
    border-radius: 6px;
    width: 220px;
    text-align: center;
  }
  button {
    padding: 10px 24px;
    font-size: 1.1rem;
    cursor: pointer;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
  }
  button:hover {
    background: #2563eb;
  }
  .hint {
    font-size: 0.85rem;
    color: #888;
    text-align: center;
  }
</style>

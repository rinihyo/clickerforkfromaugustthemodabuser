;(function () {
  let username = window._username
  const WS_URL = `${
    location.protocol === 'https:' ? 'wss:' : 'ws:'
  }//clicker.jer.app/ws`
  const SOUND_URL = 'https://clicker.jer.app/click.mp3'

  /** @type {WebSocket | null} */
  let ws = null
  /** @type {AudioContext | null} */
  let audioCtx = null
  /** @type {AudioBuffer | null} */
  let clickBuffer = null
  /** @type {boolean} */
  let audioReady = false
  /** @type {boolean} */
  let connected = false
  /** @type {string} */
  let clientId = getOrCreateClientId()

  function getOrCreateClientId() {
    const key = 'clicker_client_id'
    let id = null
    try {
      id = localStorage.getItem(key)
    } catch (_e) {}
    if (!id) {
      id = 'c_' + Math.random().toString(36).slice(2, 11)
      try {
        localStorage.setItem(key, id)
      } catch (_e) {}
    }
    return id
  }

  async function initAudio() {
    if (audioReady) return
    try {
      audioCtx = new AudioContext({ latencyHint: 'interactive' })
      const response = await fetch(SOUND_URL)
      const arrayBuffer = await response.arrayBuffer()
      clickBuffer = await audioCtx.decodeAudioData(arrayBuffer)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }
      audioReady = true
      maybeConnect()
    } catch (_e) {}
  }

  function playClick() {
    if (!audioCtx || !clickBuffer) return
    const source = audioCtx.createBufferSource()
    source.buffer = clickBuffer
    source.connect(audioCtx.destination)
    source.start(0)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ack' }))
    }
  }

  function connect() {
    if (connected || !audioReady) return
    const host = location.host
    const name = username ? `${username} - ${host}` : host
    const params = new URLSearchParams({ id: clientId, name })
    ws = new WebSocket(WS_URL + '?' + params)

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'click') {
          playClick()
        }
      } catch (_e) {}
    }

    ws.onopen = () => {
      connected = true
    }

    ws.onclose = () => {
      connected = false
      setTimeout(() => {
        if (audioReady) connect()
      }, 1000)
    }

    ws.onerror = () => {
      if (ws) ws.close()
    }
  }

  function maybeConnect() {
    if (audioReady && !connected) {
      connect()
    }
  }

  function waitForUserInteraction() {
    const events = ['click', 'touchstart', 'keydown']
    function handler() {
      events.forEach((e) => document.removeEventListener(e, handler))
      initAudio()
    }
    events.forEach((e) => document.addEventListener(e, handler, { once: true }))
  }

  Object.defineProperty(window, '_username', {
    get() {
      return username
    },
    set(value) {
      username = value
      if (connected && ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
        connected = false
        setTimeout(connect, 100)
      }
    },
    configurable: true,
  })

  waitForUserInteraction()
})()

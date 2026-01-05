import { getSoundUrl } from './platform'

let audioCtx: AudioContext | null = null
let clickBuffer: AudioBuffer | null = null
let audioReady = false

export function isAudioReady(): boolean {
  return audioReady
}

export async function initAudio(): Promise<boolean> {
  if (audioReady) return true
  try {
    audioCtx = new AudioContext({ latencyHint: 'interactive' })

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume()
    }

    const response = await fetch(getSoundUrl())
    if (!response.ok) throw new Error('Failed to fetch audio')
    const arrayBuffer = await response.arrayBuffer()
    clickBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    audioReady = true
    return true
  } catch (e) {
    console.error('Failed to init audio:', e)
    return false
  }
}

export function playClick(): boolean {
  if (!audioCtx || !clickBuffer) {
    return false
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }

  try {
    const source = audioCtx.createBufferSource()
    source.buffer = clickBuffer
    source.connect(audioCtx.destination)
    source.start(0)
    return true
  } catch (e) {
    console.error('Failed to play click:', e)
    return false
  }
}

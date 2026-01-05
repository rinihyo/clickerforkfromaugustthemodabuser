declare global {
  interface Window {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }
}

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window.__TAURI__ || window.__TAURI_INTERNALS__)
}

export async function getOsUsername(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    // @ts-ignore
    return await window.__TAURI__?.core.invoke('get_username')
  } catch (e) {
    console.error('Failed to get username:', e)
    return null
  }
}

const PROD_HOST = 'clicker.jer.app'

export function getWsUrl(clientId: string): string {
  const params = new URLSearchParams({ id: clientId })
  if (isTauri() || import.meta.env.DEV) {
    return `wss://${PROD_HOST}/ws?${params}`
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws?${params}`
}

export function getAdminWsUrl(): string {
  if (import.meta.env.DEV) {
    return `wss://${PROD_HOST}/ws/admin`
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws/admin`
}

export function getSoundUrl(): string {
  if (isTauri() || import.meta.env.DEV) {
    return `https://${PROD_HOST}/click.mp3`
  }
  return '/click.mp3'
}

export function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return `https://${PROD_HOST}`
  }
  return ''
}

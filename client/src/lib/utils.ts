import { UAParser } from 'ua-parser-js'

export function countryToFlag(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return '🌍'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

export function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown'

  const parser = new UAParser(ua)
  const { browser, os, device } = parser.getResult()

  let icon = '💻'
  if (device.type === 'mobile' || device.type === 'tablet') {
    icon = '📱'
  }
  if (device.type === 'console') {
    icon = '🎮'
  }
  if (device.type === 'wearable') {
    icon = '⌚'
  }
  if (device.type === 'smarttv') {
    icon = '📺'
  }
  if (device.type === 'xr') {
    icon = '🕶️'
  }

  if (!os.name && !browser.name) {
    return `❓ ${ua}`
  }

  const osName = os.name || 'Unknown'
  const osVersion = os.version
  const browserName = browser.name
  const browserVersion = browser.version

  let osDisplay = osName
  // macOS 10.15.7 is often reported for newer macOS versions due to UA capping
  // This also applies to iPadOS requesting desktop site
  const isMac = osName === 'macOS' || osName === 'Mac OS'
  const isCappedMac = isMac && osVersion && osVersion.startsWith('10.15')

  if (osVersion && !isCappedMac) {
    osDisplay += ` ${osVersion}`
  }

  let browserDisplay = browserName || ''
  // Safari 605.1.15 is the frozen WebKit version often reported
  const isSafari = browserName && browserName.includes('Safari')
  const isCappedSafari = isSafari && browserVersion === '605.1.15'

  if (browserName && browserVersion && !isCappedSafari) {
    browserDisplay += ` ${browserVersion}`
  }

  return browserDisplay
    ? `${icon} ${osDisplay} · ${browserDisplay}`
    : `${icon} ${osDisplay}`
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

export function formatTimeAgo(ts: number | null): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours + 'h ago'
  const days = Math.floor(hours / 24)
  return days + 'd ago'
}

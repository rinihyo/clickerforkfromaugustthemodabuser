export function getClientId(prefix: string): string {
  const key = 'clicker_client_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = prefix + Math.random().toString(36).slice(2, 11)
    localStorage.setItem(key, id)
  }
  return id
}

export function getUsername(): string {
  return localStorage.getItem('clicker_username') || ''
}

export function setUsername(name: string): void {
  localStorage.setItem('clicker_username', name)
}

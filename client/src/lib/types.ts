export interface ClientData {
  id: string
  name: string
  country: string | null
  userAgent: string | null
  type: string | null
  connectedAt: number
  lastSeen: number | null
  note: string | null
  connected?: boolean
}

export interface WsMessage {
  type: string
  id?: string
  targetId?: string
  client?: ClientData
  clients?: ClientData[]
  note?: string | null
  name?: string
  userAgent?: string
  clientType?: string
}

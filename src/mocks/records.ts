import type { NetworkId, Nft, OrderStatus, Pricing, QuoteItem } from '../types/api'

/** Tipos internos do "banco" simulado (não fazem parte do contrato REST). */

export interface UserRecord {
  id: string
  name: string
  email: string
  passwordHash: string // nunca senha em claro
  avatarUrl: string | null
  bio: string | null
  createdAt: string
}

export interface SessionRecord {
  userId: string
  expiresAt: number
}

export interface CartItemRecord {
  id: string
  nftId: string
  editionId: string
  quantity: number
}

export interface CartRecord {
  items: CartItemRecord[]
  couponCode: string | null
  updatedAt: string
}

export interface WalletRecord {
  id: string
  label: string
  address: string
  network: NetworkId
  isPrimary: boolean
  createdAt: string
}

export interface QuoteLine {
  nftId: string
  editionId: string
  quantity: number
  unitPrice: string
}

export interface QuoteRecord {
  id: string
  userId: string
  network: NetworkId
  walletId: string | null
  couponCode: string | null
  lines: QuoteLine[]
  pricing: Pricing
  createdAt: number
  expiresAt: number
}

export interface OrderSnapshot {
  items: QuoteItem[]
  pricing: Pricing
  network: NetworkId
  couponCode: string | null
  wallet: { id: string; label: string; address: string }
  collector: { name: string; email: string; notes?: string }
}

export interface OrderRecord {
  id: string
  userId: string
  status: OrderStatus
  version: number
  createdAt: string
  updatedAt: string
  settleAt: number
  settlesTo: 'confirmed' | 'declined'
  snapshot: OrderSnapshot
  txHash: string | null
  declineReason: 'PAYMENT_DECLINED' | 'OUT_OF_STOCK' | null
}

export interface IdempotencyRecord {
  fingerprint: string
  orderId: string
}

export interface DbState {
  users: UserRecord[]
  sessions: Record<string, SessionRecord>
  nfts: Nft[]
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord> // chave: "user:<id>" ou "guest:<guestId>"
  wallets: Record<string, WalletRecord[]>
  walletConnections: Record<string, string | null>
  quotes: Record<string, QuoteRecord>
  orders: OrderRecord[]
  idempotency: Record<string, IdempotencyRecord> // chave: "<userId>:<Idempotency-Key>"
  counters: { user: number; item: number; quote: number; order: number; event: number; wallet: number }
}

/**
 * Contratos REST e de eventos do marketplace (compartilhados por cliente, mocks e testes).
 * Regras gerais: valores em ETH são strings decimais; quantidades são inteiros; datas em ISO 8601.
 */
export type EthString = string

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export type NetworkId = (typeof NETWORKS)[number]
export const NETWORK_LABELS: Record<NetworkId, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const COLLECTIONS = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export type CollectionId = (typeof COLLECTIONS)[number]
export const COLLECTION_LABELS: Record<CollectionId, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

/* ------------------------------- Erros ------------------------------- */

export type ErrorCode =
  | 'VALIDATION_ERROR' // 422
  | 'UNAUTHENTICATED' // 401
  | 'SESSION_EXPIRED' // 401
  | 'INVALID_CREDENTIALS' // 401
  | 'FORBIDDEN' // 403
  | 'WALLET_REJECTED' // 403
  | 'NOT_FOUND' // 404
  | 'EMAIL_TAKEN' // 409
  | 'OUT_OF_STOCK' // 409
  | 'LIMIT_EXCEEDED' // 409
  | 'PRICE_CHANGED' // 409 (details.quote traz a nova cotação)
  | 'QUOTE_EXPIRED' // 409
  | 'COUPON_INVALID' // 422
  | 'COUPON_EXPIRED' // 422 (ou 409 na revalidação do pedido)
  | 'IDEMPOTENCY_CONFLICT' // 409
  | 'WALLET_DUPLICATE' // 409
  | 'RATE_LIMITED' // 429
  | 'TRANSIENT' // 503
  | 'INTERNAL' // 500

export interface ApiErrorBody {
  error: {
    code: ErrorCode
    message: string
    fieldErrors?: Record<string, string>
    details?: unknown
  }
}

/* -------------------------------- NFTs -------------------------------- */

export interface Edition {
  id: string
  label: string
  supply: number
  available: number
  price: EthString
}

export interface Creator {
  name: string
}

export interface NftSummary {
  id: string
  name: string
  image: string
  price: EthString // menor preço entre as edições ("a partir de")
  previousPrice: EthString | null
  collection: CollectionId
  network: NetworkId
  creator: Creator
  soldOut: boolean
  version: number
}

export interface Nft extends NftSummary {
  images: string[]
  description: string
  attributes: { trait: string; value: string }[]
  editions: Edition[]
  maxPerOrder: number
  rating: { average: number; count: number }
  listedAt: string
  trending: boolean
  isNew: boolean
  contract: string
  tokenId: string
  updatedAt: string
}

export type NftTab = 'all' | 'new' | 'trending'
export type NftSort = 'recent' | 'price-asc' | 'price-desc' | 'name'

/** Query já interpretada. Na URL: ?q=&collection=a,b&network=x&minPrice=&maxPrice=&tab=&sort=&page=&pageSize= */
export interface NftListQuery {
  q: string
  collections: CollectionId[]
  networks: NetworkId[]
  minPrice: EthString | null
  maxPrice: EthString | null
  tab: NftTab
  sort: NftSort
  page: number
  pageSize: number
}

export interface NftListResponse {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: {
    collections: Partial<Record<CollectionId, number>>
    networks: Partial<Record<NetworkId, number>>
  }
  priceRange: { min: EthString; max: EthString }
}

/* ------------------------------ Sessão/conta ------------------------------ */

export interface UserDto {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  bio: string | null
}

export interface AuthResponse {
  user: UserDto
  token: string
  expiresAt: string
}

export interface SessionResponse {
  user: UserDto
  expiresAt: string
}

/* -------------------------------- Carrinho -------------------------------- */

export interface Pricing {
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  networkFeeBps: number
  total: EthString
}

export interface CartLine {
  id: string
  nftId: string
  editionId: string
  name: string
  image: string
  editionLabel: string
  unitPrice: EthString
  quantity: number
  lineTotal: EthString
  available: number
  maxQuantity: number
  issue: 'SOLD_OUT' | 'INSUFFICIENT_STOCK' | null
  nftVersion: number
}

export interface CouponInfo {
  code: string
  label: string
  bps: number
}

export interface CartDto {
  items: CartLine[]
  coupon: CouponInfo | null
  couponIssue: 'COUPON_EXPIRED' | 'COUPON_INVALID' | null
  pricing: Pricing
  updatedAt: string
}

/* ----------------------------- Checkout e pedidos ----------------------------- */

export interface QuoteItem {
  nftId: string
  editionId: string
  name: string
  image: string
  editionLabel: string
  unitPrice: EthString
  quantity: number
  lineTotal: EthString
}

export interface QuoteDto {
  id: string
  network: NetworkId
  walletId: string | null
  couponCode: string | null
  items: QuoteItem[]
  pricing: Pricing
  expiresAt: string
}

export interface CreateOrderRequest {
  quoteId: string
  walletId: string
  collector: { name: string; email: string; notes?: string }
}

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface OrderDto {
  id: string
  status: OrderStatus
  version: number
  createdAt: string
  updatedAt: string
  items: QuoteItem[] // snapshot: não muda se o catálogo mudar depois
  pricing: Pricing
  network: NetworkId
  couponCode: string | null
  wallet: { id: string; label: string; address: string }
  collector: { name: string; email: string; notes?: string }
  txHash: string | null
  explorerUrl: string | null // simulado
  declineReason: 'PAYMENT_DECLINED' | 'OUT_OF_STOCK' | null
}

/* ------------------------------ Perfil e carteiras ------------------------------ */

export interface WalletDto {
  id: string
  label: string
  address: string
  network: NetworkId
  isPrimary: boolean
  connected: boolean
}

/* --------------------------------- Eventos --------------------------------- */

export interface NftUpdatedPayload {
  nftId: string
  price: EthString
  editions: { id: string; price: EthString; available: number }[]
}

export interface OrderUpdatedPayload {
  orderId: string
  status: OrderStatus
  txHash: string | null
  declineReason: OrderDto['declineReason']
}

/** Envelope: id estável (dedupe), recurso afetado e versão (descarta eventos antigos). */
export type DomainEvent = (
  | { type: 'nft.updated'; payload: NftUpdatedPayload }
  | { type: 'order.updated'; payload: OrderUpdatedPayload }
) & {
  id: string
  resource: { kind: 'nft' | 'order'; id: string }
  version: number
  occurredAt: string
  userId?: string // eventos privados (order.updated) só valem para este usuário
}

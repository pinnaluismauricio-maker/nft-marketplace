import { isEthString } from '../lib/eth'
import type { DomainEvent, Nft } from '../types/api'
import { mockBus } from './bus'
import { fakeHex, recomputeDerived } from './domain'
import type { DbState, OrderRecord } from './records'
import { buildSeed } from './seed'
import { resetRuntime } from './scenarios'

/**
 * "Banco" simulado: um único objeto em memória, persistido no localStorage a cada commit().
 * - Persistência: sobrevive a F5. Isolada por navegador/origem.
 * - reset(): descarta tudo e volta ao seed conhecido.
 */
const STORAGE_KEY = 'kurio:db:v2'
export const SESSION_TTL_MS = 60 * 60 * 1000

let state: DbState = load()

function load(): DbState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (raw) return JSON.parse(raw) as DbState
  } catch {
    /* JSON corrompido ou storage indisponível: cai no seed */
  }
  return buildSeed()
}

export const getState = (): DbState => state

export function commit(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* sem persistência: o estado segue válido em memória */
  }
}

export function resetDb(): void {
  state = buildSeed()
  resetRuntime()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  commit()
}

export function nextId(kind: keyof DbState['counters'], prefix: string): string {
  state.counters[kind] += 1
  return `${prefix}-${String(state.counters[kind]).padStart(4, '0')}`
}

/* ------------------------------ Sessão e senha ------------------------------ */

export async function hashPassword(email: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`kurio:${email.toLowerCase()}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = `tok_${crypto.randomUUID()}`
  const expiresAt = Date.now() + SESSION_TTL_MS
  state.sessions[token] = { userId, expiresAt }
  return { token, expiresAt }
}

/** Invalida todas as sessões (útil em testes: simula expiração no momento exato). */
export function expireAllSessions(): void {
  state.sessions = {}
  commit()
}

/* --------------------------------- Eventos --------------------------------- */

type EventInput = Omit<DomainEvent, 'id' | 'occurredAt'>

export function publish(event: EventInput): DomainEvent {
  const full = { ...event, id: nextId('event', 'evt'), occurredAt: new Date().toISOString() } as DomainEvent
  mockBus.emit(full)
  if (import.meta.env.DEV) {
  void fetch('http://localhost:3001/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(full),
  }).catch((error) => {
    console.warn('Não foi possível encaminhar o evento Socket.IO:', error)
  })
}
  return full
}

function publishNft(nft: Nft): void {
  publish({
    type: 'nft.updated',
    resource: { kind: 'nft', id: nft.id },
    version: nft.version,
    payload: {
      nftId: nft.id,
      price: nft.price,
      editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
    },
  })
}

/**
 * Altera preço e/ou estoque de UMA edição, incrementa a versão do NFT e publica `nft.updated`.
 * Usado pelos handlers (compra) e por testes/demos via window.__kurioMocks.updateNft(...).
 */
export function updateNft(
  nftId: string,
  patch: { editionId?: string; price?: string; available?: number },
): Nft | null {
  const nft = state.nfts.find((n) => n.id === nftId)
  if (!nft) return null
  const edition = patch.editionId ? nft.editions.find((e) => e.id === patch.editionId) : nft.editions[0]
  if (!edition) return null
  if (patch.price !== undefined) {
    if (!isEthString(patch.price)) throw new Error(`Preço inválido: ${patch.price}`)
    edition.price = patch.price
  }
  if (patch.available !== undefined) {
    if (!Number.isInteger(patch.available) || patch.available < 0 || patch.available > edition.supply) {
      throw new Error(`Estoque inválido: ${patch.available}`)
    }
    edition.available = patch.available
  }
  nft.version += 1
  nft.updatedAt = new Date().toISOString()
  recomputeDerived(nft)
  commit()
  publishNft(nft)
  return nft
}

/* ------------------------------- Liquidação de pedidos ------------------------------- */

/**
 * Pedido pendente vira confirmado/recusado quando `settleAt` passa.
 * É chamado por timer (agendado na criação e no boot) E de forma preguiçosa em cada leitura do pedido,
 * então recarregar a página ou reconectar nunca "perde" a liquidação.
 */
export function settleOrderIfDue(order: OrderRecord, now = Date.now()): void {
  if (order.status !== 'pending' || now < order.settleAt) return

  let status: 'confirmed' | 'declined' = order.settlesTo
  let declineReason: OrderRecord['declineReason'] = status === 'declined' ? 'PAYMENT_DECLINED' : null

  if (status === 'confirmed') {
    const lacking = order.snapshot.items.some((item) => {
      const edition = state.nfts.find((n) => n.id === item.nftId)?.editions.find((e) => e.id === item.editionId)
      return !edition || edition.available < item.quantity
    })
    if (lacking) {
      status = 'declined'
      declineReason = 'OUT_OF_STOCK'
    } else {
      for (const item of order.snapshot.items) {
        const nft = state.nfts.find((n) => n.id === item.nftId)
        const edition = nft?.editions.find((e) => e.id === item.editionId)
        if (nft && edition) updateNft(nft.id, { editionId: edition.id, available: edition.available - item.quantity })
      }
      removePurchasedFromCart(order)
      order.txHash = `0x${fakeHex(`tx-${order.id}`, 64)}`
    }
  }

  order.status = status
  order.declineReason = declineReason
  order.version += 1
  order.updatedAt = new Date().toISOString()
  commit()
  publish({
    type: 'order.updated',
    resource: { kind: 'order', id: order.id },
    version: order.version,
    userId: order.userId,
    payload: { orderId: order.id, status, txHash: order.txHash, declineReason },
  })
}

/** Remove do carrinho APENAS os itens/quantidades comprados; o restante permanece. */
function removePurchasedFromCart(order: OrderRecord): void {
  const cart = state.carts[`user:${order.userId}`]
  if (!cart) return
  for (const bought of order.snapshot.items) {
    const line = cart.items.find((i) => i.nftId === bought.nftId && i.editionId === bought.editionId)
    if (!line) continue
    line.quantity -= bought.quantity
  }
  cart.items = cart.items.filter((i) => i.quantity > 0)
  cart.updatedAt = new Date().toISOString()
}

export function scheduleSettlement(order: OrderRecord): void {
  const wait = Math.max(0, order.settleAt - Date.now()) + 5
  setTimeout(() => {
    // após um reset(), o timer antigo não deve mexer no estado novo
    if (state.orders.includes(order)) settleOrderIfDue(order)
  }, wait)
}

/** Chamado no boot: reagenda pedidos que ficaram pendentes antes de um refresh. */
export function scheduleSettlements(): void {
  for (const order of state.orders) if (order.status === 'pending') scheduleSettlement(order)
}

import { addEth, cmpEth, isEthString, mulEthInt, percentEth, subEth, sumEth } from '../lib/eth'
import {
  COLLECTIONS,
  COLLECTION_LABELS,
  NETWORKS,
  type CollectionId,
  type NetworkId,
  type Nft,
  type NftListQuery,
  type NftListResponse,
  type NftSort,
  type NftSummary,
  type NftTab,
  type Pricing,
} from '../types/api'

/** Lógica pura (sem MSW, sem storage): fácil de testar e de reutilizar no cliente se necessário. */

/* ------------------------------- Utilidades ------------------------------- */

export const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Hex determinístico (FNV-1a + mulberry32). Usado para hashes/endereços falsos reproduzíveis. */
export function fakeHex(seed: string, length: number): string {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let a = h >>> 0
  let out = ''
  while (out.length < length) {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    out += (((t ^ (t >>> 14)) >>> 0) % 0xffffffff).toString(16).padStart(8, '0')
  }
  return out.slice(0, length)
}

/* --------------------------------- Cupons --------------------------------- */

export const COUPONS: Record<string, { label: string; bps: number; expiresAt: string }> = {
  KURIO10: { label: '10% de desconto', bps: 1000, expiresAt: '2030-12-31T23:59:59.000Z' },
  WELCOME5: { label: '5% de boas-vindas', bps: 500, expiresAt: '2030-12-31T23:59:59.000Z' },
  EXPIRED20: { label: '20% (encerrado)', bps: 2000, expiresAt: '2026-01-01T00:00:00.000Z' },
}

export type CouponResult =
  | { ok: true; code: string; label: string; bps: number }
  | { ok: false; code: 'COUPON_INVALID' | 'COUPON_EXPIRED' }

export function resolveCoupon(raw: string, now: number): CouponResult {
  const code = raw.trim().toUpperCase()
  const coupon = COUPONS[code]
  if (!coupon) return { ok: false, code: 'COUPON_INVALID' }
  if (Date.parse(coupon.expiresAt) <= now) return { ok: false, code: 'COUPON_EXPIRED' }
  return { ok: true, code, label: coupon.label, bps: coupon.bps }
}

/* --------------------------------- Preços --------------------------------- */

/** Taxa de rede em basis points sobre o valor líquido (subtotal - desconto). */
export const NETWORK_FEE_BPS: Record<NetworkId, number> = { ethereum: 120, polygon: 30, solana: 20 }

export function computePricing(
  lines: { unitPrice: string; quantity: number }[],
  couponBps: number,
  network: NetworkId,
): Pricing {
  const subtotal = sumEth(lines.map((l) => mulEthInt(l.unitPrice, l.quantity)))
  const discount = percentEth(subtotal, couponBps)
  const net = subEth(subtotal, discount)
  const networkFeeBps = NETWORK_FEE_BPS[network]
  const networkFee = percentEth(net, networkFeeBps)
  return { subtotal, discount, networkFee, networkFeeBps, total: addEth(net, networkFee) }
}

/** Recalcula campos derivados do NFT (menor preço e esgotado) após qualquer mudança nas edições. */
export function recomputeDerived(nft: Nft): void {
  const prices = nft.editions.map((e) => e.price)
  nft.price = prices.reduce((min, p) => (cmpEth(p, min) < 0 ? p : min), prices[0] ?? '0.00')
  nft.soldOut = nft.editions.every((e) => e.available === 0)
}

export const editionLimit = (nft: Nft, available: number): number => Math.min(available, nft.maxPerOrder)

/* --------------------------- Listagem de NFTs --------------------------- */

const TABS: NftTab[] = ['all', 'new', 'trending']
const SORTS: NftSort[] = ['recent', 'price-asc', 'price-desc', 'name']

export function parseListQuery(
  sp: URLSearchParams,
): { query: NftListQuery } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const list = (key: string) =>
    (sp.get(key) ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

  const collections = list('collection')
  if (collections.some((c) => !(COLLECTIONS as readonly string[]).includes(c))) errors.collection = 'Coleção inválida'
  const networks = list('network')
  if (networks.some((n) => !(NETWORKS as readonly string[]).includes(n))) errors.network = 'Rede inválida'

  const tab = (sp.get('tab') ?? 'all') as NftTab
  if (!TABS.includes(tab)) errors.tab = 'Aba inválida'
  const sort = (sp.get('sort') ?? 'recent') as NftSort
  if (!SORTS.includes(sort)) errors.sort = 'Ordenação inválida'

  const page = Number(sp.get('page') ?? 1)
  if (!Number.isInteger(page) || page < 1) errors.page = 'Página inválida'
  const pageSize = Number(sp.get('pageSize') ?? 9)
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) errors.pageSize = 'Tamanho de página inválido'

  const minRaw = sp.get('minPrice')
  const maxRaw = sp.get('maxPrice')
  if (minRaw && !isEthString(minRaw)) errors.minPrice = 'Preço mínimo inválido'
  if (maxRaw && !isEthString(maxRaw)) errors.maxPrice = 'Preço máximo inválido'
  if (minRaw && maxRaw && isEthString(minRaw) && isEthString(maxRaw) && cmpEth(minRaw, maxRaw) > 0) {
    errors.minPrice = 'Preço mínimo maior que o máximo'
  }

  if (Object.keys(errors).length) return { errors }
  return {
    query: {
      q: (sp.get('q') ?? '').trim(),
      collections: collections as CollectionId[],
      networks: networks as NetworkId[],
      minPrice: minRaw || null,
      maxPrice: maxRaw || null,
      tab,
      sort,
      page,
      pageSize,
    },
  }
}

function filterNfts(nfts: Nft[], q: NftListQuery, skip?: 'collection' | 'network'): Nft[] {
  const needle = q.q ? normalize(q.q) : ''
  return nfts.filter((n) => {
    if (needle) {
      const haystack = normalize(`${n.name} ${n.creator.name} ${COLLECTION_LABELS[n.collection]}`)
      if (!haystack.includes(needle)) return false
    }
    if (skip !== 'collection' && q.collections.length && !q.collections.includes(n.collection)) return false
    if (skip !== 'network' && q.networks.length && !q.networks.includes(n.network)) return false
    if (q.minPrice && cmpEth(n.price, q.minPrice) < 0) return false
    if (q.maxPrice && cmpEth(n.price, q.maxPrice) > 0) return false
    if (q.tab === 'new' && !n.isNew) return false
    if (q.tab === 'trending' && !n.trending) return false
    return true
  })
}

function sortNfts(items: Nft[], sort: NftSort): Nft[] {
  const copy = [...items]
  copy.sort((a, b) => {
    switch (sort) {
      case 'price-asc':
        return cmpEth(a.price, b.price) || a.id.localeCompare(b.id)
      case 'price-desc':
        return cmpEth(b.price, a.price) || a.id.localeCompare(b.id)
      case 'name':
        return a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
      default:
        return b.listedAt.localeCompare(a.listedAt) || a.id.localeCompare(b.id)
    }
  })
  return copy
}

export function toSummary(n: Nft): NftSummary {
  return {
    id: n.id,
    name: n.name,
    image: n.image,
    price: n.price,
    previousPrice: n.previousPrice,
    collection: n.collection,
    network: n.network,
    creator: n.creator,
    soldOut: n.soldOut,
    version: n.version,
  }
}

export function listNfts(all: Nft[], q: NftListQuery): NftListResponse {
  const filtered = sortNfts(filterNfts(all, q), q.sort)
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / q.pageSize))
  const start = (q.page - 1) * q.pageSize

  // Contagens de cada filtro consideram os OUTROS filtros ativos (comportamento usual de facetas).
  const collections: NftListResponse['facets']['collections'] = {}
  for (const n of filterNfts(all, q, 'collection')) collections[n.collection] = (collections[n.collection] ?? 0) + 1
  const networks: NftListResponse['facets']['networks'] = {}
  for (const n of filterNfts(all, q, 'network')) networks[n.network] = (networks[n.network] ?? 0) + 1

  const prices = all.map((n) => n.price).sort((a, b) => cmpEth(a, b))
  return {
    items: filtered.slice(start, start + q.pageSize).map(toSummary),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages,
    facets: { collections, networks },
    priceRange: { min: prices[0] ?? '0.00', max: prices[prices.length - 1] ?? '0.00' },
  }
}

/* ------------------------------- Validações ------------------------------- */

export type FieldErrors = Record<string, string>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export function validatePasswordRule(password: string): string | null {
  if (password.length < 8) return 'A senha deve ter ao menos 8 caracteres'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use letras e números na senha'
  return null
}

export function validateRegister(input: { name: string; email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {}
  if (input.name.length < 2 || input.name.length > 60) errors.name = 'Informe um nome com 2 a 60 caracteres'
  if (!EMAIL_RE.test(input.email)) errors.email = 'Informe um e-mail válido'
  const pw = validatePasswordRule(input.password)
  if (pw) errors.password = pw
  return errors
}

export function validateProfile(input: { name: string; bio: string }): FieldErrors {
  const errors: FieldErrors = {}
  if (input.name.length < 2 || input.name.length > 60) errors.name = 'Informe um nome com 2 a 60 caracteres'
  if (input.bio.length > 280) errors.bio = 'A bio deve ter no máximo 280 caracteres'
  return errors
}

export function validateWallet(input: { label: string; address: string; network: string }): FieldErrors {
  const errors: FieldErrors = {}
  if (input.label.length < 2 || input.label.length > 30) errors.label = 'O apelido deve ter de 2 a 30 caracteres'
  if (!ADDRESS_RE.test(input.address)) errors.address = 'Endereço inválido (0x seguido de 40 caracteres hexadecimais)'
  if (!(NETWORKS as readonly string[]).includes(input.network)) errors.network = 'Selecione uma rede válida'
  return errors
}

export function validateCollector(input: { name: string; email: string }): FieldErrors {
  const errors: FieldErrors = {}
  if (input.name.length < 2) errors['collector.name'] = 'Informe o nome do colecionador'
  if (!EMAIL_RE.test(input.email)) errors['collector.email'] = 'Informe um e-mail válido'
  return errors
}

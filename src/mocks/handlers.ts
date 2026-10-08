import { delay, http, HttpResponse, type JsonBodyType } from 'msw'
import { addEth, mulEthInt, percentEth } from '../lib/eth'
import {
  NETWORKS,
  type ApiErrorBody,
  type AuthResponse,
  type CartDto,
  type CartLine,
  type CouponInfo,
  type ErrorCode,
  type NetworkId,
  type Nft,
  type OrderDto,
  type QuoteDto,
  type QuoteItem,
  type UserDto,
  type WalletDto,
} from '../types/api'
import {
  commit,
  createSession,
  getState,
  hashPassword,
  nextId,
  publish,
  scheduleSettlement,
  settleOrderIfDue,
  updateNft,
} from './db'
import {
  computePricing,
  editionLimit,
  listNfts,
  parseListQuery,
  resolveCoupon,
  validateCollector,
  validatePasswordRule,
  validateProfile,
  validateRegister,
  validateWallet,
  type FieldErrors,
} from './domain'
import type { CartRecord, OrderRecord, QuoteLine, QuoteRecord, UserRecord, WalletRecord } from './records'
import { getScenario, latencyFor, runtime } from './scenarios'

/* ===================================================================
 * Infra: cenários, autenticação e respostas padronizadas
 * =================================================================== */

type Params = Record<string, string | readonly string[] | undefined>
interface Ctx {
  request: Request
  url: URL
  params: Params
  user: UserRecord | null
  token: string | null
  owner: string // "user:<id>" ou "guest:<X-Guest-Id>"
}
type AuthedCtx = Ctx & { user: UserRecord }
type Result = Response | Promise<Response>

const json = (data: JsonBodyType, status = 200) => HttpResponse.json(data, { status })
const noContent = () => new HttpResponse(null, { status: 204 })

function fail(
  status: number,
  code: ErrorCode,
  message: string,
  fieldErrors?: FieldErrors,
  details?: unknown,
): Response {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
      ...(details !== undefined ? { details } : {}),
    },
  }
  return HttpResponse.json(body, { status })
}

const matchesPath = (pathname: string, paths?: string[]) =>
  !paths || paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

type AuthState =
  | { status: 'anonymous' }
  | { status: 'ok'; user: UserRecord; token: string }
  | { status: 'expired' | 'unknown' }

function authenticate(request: Request): AuthState {
  const header = request.headers.get('authorization')
  if (!header) return { status: 'anonymous' }
  const token = header.replace(/^Bearer\s+/i, '').trim()
  const s = getState()
  const session = s.sessions[token]
  if (!session) return { status: 'unknown' }
  if (session.expiresAt <= Date.now()) {
    delete s.sessions[token]
    commit()
    return { status: 'expired' }
  }
  const user = s.users.find((u) => u.id === session.userId)
  return user ? { status: 'ok', user, token } : { status: 'unknown' }
}

/**
 * mode 'public':   ignora token (login, cadastro)
 * mode 'optional': usa o token se houver (catálogo, carrinho de visitante)
 * mode 'private':  exige sessão válida
 */
function core(mode: 'public' | 'optional' | 'private', handler: (ctx: Ctx) => Result) {
  return async ({ request, params }: { request: Request; params: Params }): Promise<Response> => {
    const scenario = getScenario()
    runtime.requestCount += 1
    await delay(latencyFor(scenario, runtime.requestCount))
    const url = new URL(request.url)

    if (scenario.networkDown) return HttpResponse.error()

    if (scenario.fail && matchesPath(url.pathname, scenario.fail.paths)) {
      runtime.failCounter += 1
      if (runtime.failCounter % scenario.fail.everyNth === 0) {
        const { status } = scenario.fail
        const code: ErrorCode = status === 429 ? 'RATE_LIMITED' : status >= 500 ? 'TRANSIENT' : 'FORBIDDEN'
        return fail(status, code, 'Falha simulada pelo cenário ativo.')
      }
    }

    let user: UserRecord | null = null
    let token: string | null = null
    if (mode !== 'public') {
      const auth = authenticate(request)
      if (auth.status === 'expired') return fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
      if (auth.status === 'unknown') return fail(401, 'UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
      if (auth.status === 'ok') {
        if (runtime.expireNextAuthed) {
          runtime.expireNextAuthed = false
          delete getState().sessions[auth.token]
          commit()
          return fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
        }
        user = auth.user
        token = auth.token
      }
      if (mode === 'private' && !user) return fail(401, 'UNAUTHENTICATED', 'Entre para continuar.')
    }

    const guestId = request.headers.get('x-guest-id') ?? 'anonymous'
    const owner = user ? `user:${user.id}` : `guest:${guestId}`
    return handler({ request, url, params, user, token, owner })
  }
}

const open = (handler: (ctx: Ctx) => Result) => core('public', handler)
const optional = (handler: (ctx: Ctx) => Result) => core('optional', handler)
const authed = (handler: (ctx: AuthedCtx) => Result) => core('private', (ctx) => handler(ctx as AuthedCtx))

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json()
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/* ===================================================================
 * Conversores (registro interno -> DTO)
 * =================================================================== */

const toUserDto = (u: UserRecord): UserDto => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
  bio: u.bio,
})

function toWalletDto(w: WalletRecord, userId: string): WalletDto {
  return {
    id: w.id,
    label: w.label,
    address: w.address,
    network: w.network,
    isPrimary: w.isPrimary,
    connected: getState().walletConnections[userId] === w.id,
  }
}

function quoteItem(line: QuoteLine): QuoteItem {
  const nft = getState().nfts.find((n) => n.id === line.nftId)
  const edition = nft?.editions.find((e) => e.id === line.editionId)
  return {
    nftId: line.nftId,
    editionId: line.editionId,
    name: nft?.name ?? line.nftId,
    image: nft?.image ?? '',
    editionLabel: edition?.label ?? line.editionId,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    lineTotal: mulEthInt(line.unitPrice, line.quantity),
  }
}

const toQuoteDto = (q: QuoteRecord): QuoteDto => ({
  id: q.id,
  network: q.network,
  walletId: q.walletId,
  couponCode: q.couponCode,
  items: q.lines.map(quoteItem),
  pricing: q.pricing,
  expiresAt: new Date(q.expiresAt).toISOString(),
})

function toOrderDto(o: OrderRecord): OrderDto {
  return {
    id: o.id,
    status: o.status,
    version: o.version,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    items: o.snapshot.items,
    pricing: o.snapshot.pricing,
    network: o.snapshot.network,
    couponCode: o.snapshot.couponCode,
    wallet: o.snapshot.wallet,
    collector: o.snapshot.collector,
    txHash: o.txHash,
    explorerUrl: o.txHash ? `https://explorer.kurio.test/tx/${o.txHash}` : null, // simulado
    declineReason: o.declineReason,
  }
}

/* ===================================================================
 * Carrinho
 * =================================================================== */

function cartRecord(owner: string): CartRecord {
  const s = getState()
  return (s.carts[owner] ??= { items: [], couponCode: null, updatedAt: new Date().toISOString() })
}

function touch(cart: CartRecord): void {
  cart.updatedAt = new Date().toISOString()
  commit()
}

function hydrateCart(owner: string): CartDto {
  const s = getState()
  const cart = cartRecord(owner)
  const items: CartLine[] = []
  for (const item of cart.items) {
    const nft = s.nfts.find((n) => n.id === item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!nft || !edition) continue
    items.push({
      id: item.id,
      nftId: nft.id,
      editionId: edition.id,
      name: nft.name,
      image: nft.image,
      editionLabel: edition.label,
      unitPrice: edition.price,
      quantity: item.quantity,
      lineTotal: mulEthInt(edition.price, item.quantity),
      available: edition.available,
      maxQuantity: editionLimit(nft, edition.available),
      issue: edition.available === 0 ? 'SOLD_OUT' : item.quantity > edition.available ? 'INSUFFICIENT_STOCK' : null,
      nftVersion: nft.version,
    })
  }
  let coupon: CouponInfo | null = null
  let couponIssue: CartDto['couponIssue'] = null
  if (cart.couponCode) {
    const result = resolveCoupon(cart.couponCode, Date.now())
    if (result.ok) coupon = { code: result.code, label: result.label, bps: result.bps }
    else couponIssue = result.code
  }
  return {
    items,
    coupon,
    couponIssue,
    pricing: computePricing(items, coupon?.bps ?? 0, 'ethereum'),
    updatedAt: cart.updatedAt,
  }
}

function checkQuantity(nft: Nft, available: number, quantity: number): Response | null {
  if (available === 0) return fail(409, 'OUT_OF_STOCK', 'Esta edição está esgotada.')
  const max = editionLimit(nft, available)
  if (quantity > max) {
    return fail(409, 'LIMIT_EXCEEDED', `Quantidade máxima disponível para esta edição: ${max}.`, undefined, { max })
  }
  return null
}

/* ===================================================================
 * Checkout: cotação e revalidação
 * =================================================================== */

function buildQuote(
  userId: string,
  network: NetworkId,
  walletId: string | null,
): { quote: QuoteRecord } | { response: Response } {
  const s = getState()
  const cart = s.carts[`user:${userId}`]
  if (!cart || cart.items.length === 0) {
    return { response: fail(422, 'VALIDATION_ERROR', 'O carrinho está vazio.', { cart: 'Carrinho vazio' }) }
  }
  const lines: QuoteLine[] = []
  const lacking: { nftId: string; editionId: string; available: number; requested: number }[] = []
  for (const item of cart.items) {
    const edition = s.nfts.find((n) => n.id === item.nftId)?.editions.find((e) => e.id === item.editionId)
    if (!edition) return { response: fail(404, 'NOT_FOUND', 'Item do carrinho não existe mais no catálogo.') }
    if (edition.available < item.quantity) {
      lacking.push({ nftId: item.nftId, editionId: item.editionId, available: edition.available, requested: item.quantity })
    }
    lines.push({ nftId: item.nftId, editionId: item.editionId, quantity: item.quantity, unitPrice: edition.price })
  }
  if (lacking.length) {
    return {
      response: fail(409, 'OUT_OF_STOCK', 'Alguns itens não têm estoque suficiente.', undefined, { items: lacking }),
    }
  }
  let bps = 0
  let couponCode: string | null = null
  if (cart.couponCode) {
    const result = resolveCoupon(cart.couponCode, Date.now())
    if (!result.ok) {
      return { response: fail(422, result.code, 'O cupom aplicado não é mais válido.', { code: 'Cupom inválido ou expirado' }) }
    }
    bps = result.bps
    couponCode = result.code
  }
  const now = Date.now()
  const quote: QuoteRecord = {
    id: nextId('quote', 'quote'),
    userId,
    network,
    walletId,
    couponCode,
    lines,
    pricing: computePricing(lines, bps, network),
    createdAt: now,
    expiresAt: now + 5 * 60_000,
  }
  s.quotes[quote.id] = quote
  const ids = Object.values(s.quotes)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((q) => q.id)
  for (const old of ids.slice(20)) delete s.quotes[old]
  commit()
  return { quote }
}

type Revalidation = { code: ErrorCode; message: string; details?: Record<string, unknown> } | null

/** Compara a cotação aceita pelo usuário com o estado ATUAL do catálogo, cupom e estoque. */
function revalidateQuote(quote: QuoteRecord): Revalidation {
  const s = getState()
  for (const line of quote.lines) {
    const edition = s.nfts.find((n) => n.id === line.nftId)?.editions.find((e) => e.id === line.editionId)
    if (!edition || edition.available < line.quantity) {
      return { code: 'OUT_OF_STOCK', message: 'Um item ficou sem estoque durante a compra.' }
    }
  }
  const priceChanged = quote.lines.some((line) => {
    const edition = s.nfts.find((n) => n.id === line.nftId)?.editions.find((e) => e.id === line.editionId)
    return edition?.price !== line.unitPrice
  })
  if (priceChanged) {
    return { code: 'PRICE_CHANGED', message: 'Os preços mudaram desde a cotação. Revise e confirme novamente.' }
  }
  if (quote.couponCode) {
    const result = resolveCoupon(quote.couponCode, Date.now())
    if (!result.ok) return { code: result.code, message: 'O cupom não é mais válido. Revise e confirme novamente.' }
  }
  return null
}

function conflictWithNewQuote(
  userId: string,
  quote: QuoteRecord,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Response {
  const rebuilt = buildQuote(userId, quote.network, quote.walletId)
  if ('response' in rebuilt) return rebuilt.response
  return fail(409, code, message, undefined, { ...details, quote: toQuoteDto(rebuilt.quote) })
}

/* ===================================================================
 * Handlers
 * =================================================================== */

export const handlers = [
  /* ------------------------------ Sessão e conta ------------------------------ */
  http.post(
    '/api/auth/register',
    open(async ({ request }) => {
      const body = await readJson(request)
      const input = {
        name: str(body.name).trim(),
        email: str(body.email).trim().toLowerCase(),
        password: str(body.password),
      }
      const errors = validateRegister(input)
      if (Object.keys(errors).length) return fail(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', errors)
      const s = getState()
      if (s.users.some((u) => u.email === input.email)) {
        return fail(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', { email: 'E-mail já cadastrado' })
      }
      const user: UserRecord = {
        id: nextId('user', 'user'),
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.email, input.password),
        avatarUrl: null,
        bio: null,
        createdAt: new Date().toISOString(),
      }
      s.users.push(user)
      s.favorites[user.id] = []
      s.wallets[user.id] = []
      const session = createSession(user.id)
      commit()
      const response: AuthResponse = {
        user: toUserDto(user),
        token: session.token,
        expiresAt: new Date(session.expiresAt).toISOString(),
      }
      return json(response, 201)
    }),
  ),

  http.post(
    '/api/auth/login',
    open(async ({ request }) => {
      const body = await readJson(request)
      const email = str(body.email).trim().toLowerCase()
      const password = str(body.password)
      const errors: FieldErrors = {}
      if (!email) errors.email = 'Informe o e-mail'
      if (!password) errors.password = 'Informe a senha'
      if (Object.keys(errors).length) return fail(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', errors)
      const user = getState().users.find((u) => u.email === email)
      const hash = await hashPassword(email, password)
      if (!user || user.passwordHash !== hash) {
        return fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
      }
      const session = createSession(user.id)
      commit()
      const response: AuthResponse = {
        user: toUserDto(user),
        token: session.token,
        expiresAt: new Date(session.expiresAt).toISOString(),
      }
      return json(response)
    }),
  ),

  http.get(
    '/api/auth/session',
    authed(({ user, token }) => {
      const session = token ? getState().sessions[token] : undefined
      return json({ user: toUserDto(user), expiresAt: new Date(session?.expiresAt ?? Date.now()).toISOString() })
    }),
  ),

  http.post(
    '/api/auth/logout',
    authed(({ token }) => {
      if (token) delete getState().sessions[token]
      commit()
      return noContent()
    }),
  ),

  /* ----------------------------------- NFTs ----------------------------------- */
  http.get(
    '/api/nfts',
    optional(({ url }) => {
      const parsed = parseListQuery(url.searchParams)
      if ('errors' in parsed) return fail(422, 'VALIDATION_ERROR', 'Parâmetros de busca inválidos.', parsed.errors)
      return json(listNfts(getState().nfts, parsed.query))
    }),
  ),

  http.get(
    '/api/nfts/:id',
    optional(({ params }) => {
      const nft = getState().nfts.find((n) => n.id === params.id)
      return nft ? json(nft) : fail(404, 'NOT_FOUND', 'NFT não encontrado.')
    }),
  ),

  /* --------------------------------- Favoritos --------------------------------- */
  http.get(
    '/api/favorites',
    authed(({ user }) => json({ nftIds: getState().favorites[user.id] ?? [] })),
  ),

  http.put(
    '/api/favorites/:nftId',
    authed(({ user, params }) => {
      if (getScenario().favoritesMutationFails) return fail(500, 'INTERNAL', 'Falha simulada ao favoritar.')
      const s = getState()
      const nftId = String(params.nftId)
      if (!s.nfts.some((n) => n.id === nftId)) return fail(404, 'NOT_FOUND', 'NFT não encontrado.')
      const list = (s.favorites[user.id] ??= [])
      if (!list.includes(nftId)) list.push(nftId)
      commit()
      return json({ nftIds: list })
    }),
  ),

  http.delete(
    '/api/favorites/:nftId',
    authed(({ user, params }) => {
      if (getScenario().favoritesMutationFails) return fail(500, 'INTERNAL', 'Falha simulada ao desfavoritar.')
      const s = getState()
      s.favorites[user.id] = (s.favorites[user.id] ?? []).filter((id) => id !== String(params.nftId))
      commit()
      return json({ nftIds: s.favorites[user.id] })
    }),
  ),

  /* ---------------------------------- Carrinho ---------------------------------- */
  http.get(
    '/api/cart',
    optional(({ owner }) => json(hydrateCart(owner))),
  ),

  http.post(
    '/api/cart/items',
    optional(async ({ request, owner }) => {
      const body = await readJson(request)
      const nftId = str(body.nftId)
      const editionId = str(body.editionId)
      const quantity = Number(body.quantity)
      const errors: FieldErrors = {}
      if (!Number.isInteger(quantity) || quantity < 1) errors.quantity = 'A quantidade deve ser um inteiro maior que zero'
      const nft = getState().nfts.find((n) => n.id === nftId)
      if (!nft) return fail(404, 'NOT_FOUND', 'NFT não encontrado.')
      const edition = nft.editions.find((e) => e.id === editionId)
      if (!edition) errors.editionId = 'Selecione uma edição válida'
      if (Object.keys(errors).length || !edition) {
        return fail(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', errors)
      }
      const cart = cartRecord(owner)
      const existing = cart.items.find((i) => i.nftId === nftId && i.editionId === editionId)
      const newQuantity = (existing?.quantity ?? 0) + quantity
      const problem = checkQuantity(nft, edition.available, newQuantity)
      if (problem) return problem
      if (existing) existing.quantity = newQuantity
      else cart.items.push({ id: nextId('item', 'item'), nftId, editionId, quantity })
      touch(cart)
      return json(hydrateCart(owner), 201)
    }),
  ),

  http.patch(
    '/api/cart/items/:itemId',
    optional(async ({ request, owner, params }) => {
      const body = await readJson(request)
      const quantity = Number(body.quantity)
      if (!Number.isInteger(quantity) || quantity < 1) {
        return fail(422, 'VALIDATION_ERROR', 'Quantidade inválida.', {
          quantity: 'A quantidade deve ser um inteiro maior que zero (para remover, use DELETE)',
        })
      }
      const cart = cartRecord(owner)
      const item = cart.items.find((i) => i.id === params.itemId)
      if (!item) return fail(404, 'NOT_FOUND', 'Item do carrinho não encontrado.')
      const nft = getState().nfts.find((n) => n.id === item.nftId)
      const edition = nft?.editions.find((e) => e.id === item.editionId)
      if (!nft || !edition) return fail(404, 'NOT_FOUND', 'NFT não encontrado.')
      const problem = checkQuantity(nft, edition.available, quantity)
      if (problem) return problem
      item.quantity = quantity
      touch(cart)
      return json(hydrateCart(owner))
    }),
  ),

  http.delete(
    '/api/cart/items/:itemId',
    optional(({ owner, params }) => {
      const cart = cartRecord(owner)
      cart.items = cart.items.filter((i) => i.id !== params.itemId) // idempotente
      touch(cart)
      return json(hydrateCart(owner))
    }),
  ),

  http.put(
    '/api/cart/coupon',
    optional(async ({ request, owner }) => {
      const body = await readJson(request)
      const result = resolveCoupon(str(body.code), Date.now())
      if (!result.ok) {
        const message = result.code === 'COUPON_EXPIRED' ? 'Este cupom expirou.' : 'Cupom inválido.'
        return fail(422, result.code, message, { code: message })
      }
      const cart = cartRecord(owner)
      cart.couponCode = result.code
      touch(cart)
      return json(hydrateCart(owner))
    }),
  ),

  http.delete(
    '/api/cart/coupon',
    optional(({ owner }) => {
      const cart = cartRecord(owner)
      cart.couponCode = null
      touch(cart)
      return json(hydrateCart(owner))
    }),
  ),

  /** Após o login: incorpora o carrinho do visitante (X-Guest-Id) ao carrinho do usuário. */
  http.post(
    '/api/cart/merge',
    authed(async ({ request, owner }) => {
      const body = await readJson(request)
      const guestKey = `guest:${str(body.guestId)}`
      const s = getState()
      const guest = s.carts[guestKey]
      if (guest) {
        const cart = cartRecord(owner)
        for (const g of guest.items) {
          const nft = s.nfts.find((n) => n.id === g.nftId)
          const edition = nft?.editions.find((e) => e.id === g.editionId)
          if (!nft || !edition) continue
          const existing = cart.items.find((i) => i.nftId === g.nftId && i.editionId === g.editionId)
          const cap = Math.max(1, editionLimit(nft, edition.available))
          const merged = Math.min((existing?.quantity ?? 0) + g.quantity, cap)
          if (existing) existing.quantity = merged
          else cart.items.push({ id: nextId('item', 'item'), nftId: g.nftId, editionId: g.editionId, quantity: merged })
        }
        if (!cart.couponCode) cart.couponCode = guest.couponCode
        delete s.carts[guestKey]
        touch(cart)
      }
      return json(hydrateCart(owner))
    }),
  ),

  /* ----------------------------- Checkout e pedidos ----------------------------- */
  http.post(
    '/api/checkout/quote',
    authed(async ({ request, user }) => {
      const body = await readJson(request)
      const network = str(body.network) || 'ethereum'
      if (!(NETWORKS as readonly string[]).includes(network)) {
        return fail(422, 'VALIDATION_ERROR', 'Rede inválida.', { network: 'Selecione uma rede válida' })
      }
      const result = buildQuote(user.id, network as NetworkId, str(body.walletId) || null)
      return 'response' in result ? result.response : json(toQuoteDto(result.quote))
    }),
  ),

  http.post(
    '/api/orders',
    authed(async ({ request, user }) => {
      const key = request.headers.get('idempotency-key')?.trim()
      if (!key) {
        return fail(422, 'VALIDATION_ERROR', 'O cabeçalho Idempotency-Key é obrigatório.', {
          'Idempotency-Key': 'Obrigatório',
        })
      }
      const body = await readJson(request)
      const raw = (body.collector && typeof body.collector === 'object' ? body.collector : {}) as Record<string, unknown>
      const input = {
        quoteId: str(body.quoteId),
        walletId: str(body.walletId),
        collector: {
          name: str(raw.name).trim(),
          email: str(raw.email).trim(),
          notes: str(raw.notes).trim() || undefined,
        },
      }
      const errors = validateCollector(input.collector)
      if (!input.quoteId) errors.quoteId = 'Informe a cotação'
      if (!input.walletId) errors.walletId = 'Selecione uma carteira'
      if (Object.keys(errors).length) return fail(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', errors)

      const s = getState()
      const idempotencyKey = `${user.id}:${key}`
      const fingerprint = JSON.stringify([
        input.quoteId,
        input.walletId,
        input.collector.name,
        input.collector.email,
        input.collector.notes ?? '',
      ])

      // Mesma chave + mesmo conteúdo => devolve o MESMO pedido. Conteúdo diferente => conflito.
      const prior = s.idempotency[idempotencyKey]
      if (prior) {
        if (prior.fingerprint !== fingerprint) {
          return fail(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        }
        const existing = s.orders.find((o) => o.id === prior.orderId)
        if (existing) {
          settleOrderIfDue(existing)
          return json(toOrderDto(existing), 200)
        }
      }

      const quote = s.quotes[input.quoteId]
      if (!quote || quote.userId !== user.id) return fail(404, 'NOT_FOUND', 'Cotação não encontrada.')
      if (quote.expiresAt <= Date.now()) {
        return conflictWithNewQuote(user.id, quote, 'QUOTE_EXPIRED', 'A cotação expirou. Revise os valores e confirme novamente.')
      }
      const wallet = (s.wallets[user.id] ?? []).find((w) => w.id === input.walletId)
      if (!wallet) return fail(422, 'VALIDATION_ERROR', 'Carteira inválida.', { walletId: 'Carteira não encontrada' })
      if (wallet.network !== quote.network) {
        return fail(422, 'VALIDATION_ERROR', 'Carteira incompatível com a rede.', {
          walletId: 'A carteira não pertence à rede selecionada',
        })
      }

      // Cenários: algo muda ENTRE a cotação e a criação do pedido (dispara uma única vez).
      const checkout = getScenario().checkout
      const first = quote.lines[0]
      if (first && checkout?.priceChangeOnOrder && !runtime.firedPriceChange) {
        runtime.firedPriceChange = true
        const edition = s.nfts.find((n) => n.id === first.nftId)?.editions.find((e) => e.id === first.editionId)
        if (edition) {
          updateNft(first.nftId, { editionId: first.editionId, price: addEth(edition.price, percentEth(edition.price, 1000)) })
        }
      }
      if (first && checkout?.soldOutOnOrder && !runtime.firedSoldOut) {
        runtime.firedSoldOut = true
        updateNft(first.nftId, { editionId: first.editionId, available: 0 })
      }

      const problem = revalidateQuote(quote)
      if (problem) return conflictWithNewQuote(user.id, quote, problem.code, problem.message, problem.details)

      const now = Date.now()
      const order: OrderRecord = {
        id: nextId('order', 'order'),
        userId: user.id,
        status: 'pending',
        version: 1,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        settleAt: now + (checkout?.settleDelayMs ?? 2500),
        settlesTo: checkout?.payment ?? 'confirmed',
        snapshot: {
          items: quote.lines.map(quoteItem), // snapshot: o recibo não muda se o catálogo mudar depois
          pricing: quote.pricing,
          network: quote.network,
          couponCode: quote.couponCode,
          wallet: { id: wallet.id, label: wallet.label, address: wallet.address },
          collector: input.collector,
        },
        txHash: null,
        declineReason: null,
      }
      s.orders.unshift(order)
      s.idempotency[idempotencyKey] = { fingerprint, orderId: order.id }
      commit()
      scheduleSettlement(order)
      publish({
        type: 'order.updated',
        resource: { kind: 'order', id: order.id },
        version: order.version,
        userId: user.id,
        payload: { orderId: order.id, status: order.status, txHash: null, declineReason: null },
      })

      if (checkout?.timeoutAfterCreate) {
        // O pedido JÁ existe, mas a resposta nunca chega: o cliente deve estourar o timeout
        // e repetir a requisição com a MESMA Idempotency-Key para recuperar este pedido.
        await delay('infinite')
      }
      return json(toOrderDto(order), 201)
    }),
  ),

  http.get(
    '/api/orders/:id',
    authed(({ user, params }) => {
      const order = getState().orders.find((o) => o.id === params.id && o.userId === user.id)
      if (!order) return fail(404, 'NOT_FOUND', 'Pedido não encontrado.') // 404 também para pedidos de outros usuários
      settleOrderIfDue(order)
      return json(toOrderDto(order))
    }),
  ),

  http.get(
    '/api/orders',
    authed(({ user, url }) => {
      const status = url.searchParams.get('status')
      const mine = getState().orders.filter((o) => o.userId === user.id)
      mine.forEach((o) => settleOrderIfDue(o))
      return json({ items: mine.filter((o) => !status || o.status === status).map(toOrderDto) })
    }),
  ),

  /* ------------------------------------ Perfil ------------------------------------ */
  http.get(
    '/api/profile',
    authed(({ user }) => json(toUserDto(user))),
  ),

  http.patch(
    '/api/profile',
    authed(async ({ request, user }) => {
      const body = await readJson(request)
      const input = {
        name: body.name === undefined ? user.name : str(body.name).trim(),
        bio: body.bio === undefined ? (user.bio ?? '') : str(body.bio).trim(),
      }
      const errors = validateProfile(input)
      if (Object.keys(errors).length) return fail(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', errors)
      user.name = input.name
      user.bio = input.bio || null
      commit()
      return json(toUserDto(user))
    }),
  ),

  http.put(
    '/api/profile/avatar',
    authed(async ({ request, user }) => {
      const body = await readJson(request)
      const dataUrl = str(body.dataUrl)
      if (!dataUrl.startsWith('data:image/') || dataUrl.length > 700_000) {
        return fail(422, 'VALIDATION_ERROR', 'Avatar inválido.', {
          avatar: 'Envie uma imagem (data URL) de até ~500 KB',
        })
      }
      user.avatarUrl = dataUrl
      commit()
      return json(toUserDto(user))
    }),
  ),

  http.post(
    '/api/profile/password',
    authed(async ({ request, user }) => {
      const body = await readJson(request)
      const errors: FieldErrors = {}
      const currentHash = await hashPassword(user.email, str(body.currentPassword))
      if (currentHash !== user.passwordHash) errors.currentPassword = 'Senha atual incorreta'
      const rule = validatePasswordRule(str(body.newPassword))
      if (rule) errors.newPassword = rule
      if (Object.keys(errors).length) return fail(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', errors)
      user.passwordHash = await hashPassword(user.email, str(body.newPassword))
      commit()
      return noContent()
    }),
  ),

  /* ----------------------------------- Carteiras ----------------------------------- */
  http.get(
    '/api/wallets',
    authed(({ user }) => json({ items: (getState().wallets[user.id] ?? []).map((w) => toWalletDto(w, user.id)) })),
  ),

  http.post(
    '/api/wallets',
    authed(async ({ request, user }) => {
      const body = await readJson(request)
      const input = { label: str(body.label).trim(), address: str(body.address).trim(), network: str(body.network) }
      const errors = validateWallet(input)
      if (Object.keys(errors).length) return fail(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', errors)
      const s = getState()
      const list = (s.wallets[user.id] ??= [])
      if (list.some((w) => w.address.toLowerCase() === input.address.toLowerCase())) {
        return fail(409, 'WALLET_DUPLICATE', 'Esta carteira já está cadastrada.', { address: 'Carteira já cadastrada' })
      }
      const makePrimary = body.isPrimary === true || list.length === 0
      if (makePrimary) list.forEach((w) => (w.isPrimary = false))
      const wallet: WalletRecord = {
        id: nextId('wallet', 'wallet'),
        label: input.label,
        address: input.address,
        network: input.network as NetworkId,
        isPrimary: makePrimary,
        createdAt: new Date().toISOString(),
      }
      list.push(wallet)
      commit()
      return json(toWalletDto(wallet, user.id), 201)
    }),
  ),

  http.patch(
    '/api/wallets/:id',
    authed(async ({ request, user, params }) => {
      const list = getState().wallets[user.id] ?? []
      const wallet = list.find((w) => w.id === params.id)
      if (!wallet) return fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
      const body = await readJson(request)
      const errors: FieldErrors = {}
      if (body.label !== undefined) {
        const label = str(body.label).trim()
        if (label.length < 2 || label.length > 30) errors.label = 'O apelido deve ter de 2 a 30 caracteres'
        else wallet.label = label
      }
      if (body.isPrimary === true) {
        list.forEach((w) => (w.isPrimary = w.id === wallet.id))
      } else if (body.isPrimary === false && wallet.isPrimary) {
        errors.isPrimary = 'Defina outra carteira como principal em vez de remover esta marcação'
      }
      if (Object.keys(errors).length) return fail(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', errors)
      commit()
      return json(toWalletDto(wallet, user.id))
    }),
  ),

  http.post(
    '/api/wallets/:id/connect',
    authed(({ user, params }) => {
      const wallet = (getState().wallets[user.id] ?? []).find((w) => w.id === params.id)
      if (!wallet) return fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
      if (getScenario().walletConnect === 'rejected') {
        return fail(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
      }
      getState().walletConnections[user.id] = wallet.id
      commit()
      return json(toWalletDto(wallet, user.id))
    }),
  ),

  http.post(
    '/api/wallets/:id/disconnect',
    authed(({ user }) => {
      getState().walletConnections[user.id] = null
      commit()
      return noContent()
    }),
  ),
]

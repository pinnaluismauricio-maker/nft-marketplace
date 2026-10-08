/**
 * Cenários determinísticos de rede/falha. Escolha via:
 *   - URL:      http://localhost:5173/?scenario=slow
 *   - Console:  window.__kurioMocks.setScenario('slow')
 *   - Playwright: page.evaluate(() => window.__kurioMocks.setScenario('slow'))
 * O cenário escolhido fica salvo no localStorage (sobrevive a F5).
 */

export interface Scenario {
  description: string
  latency:
    | { mode: 'fixed'; ms: number }
    | { mode: 'seeded'; min: number; max: number } // latência variável, mas reproduzível
    | { mode: 'alternating'; slowMs: number; fastMs: number } // 1ª resposta lenta, 2ª rápida... (fora de ordem)
  networkDown?: boolean // toda requisição falha como "Failed to fetch"
  fail?: { everyNth: number; status: number; paths?: string[] } // 4xx/5xx a cada N requisições
  expireSessionOnNextAuthedRequest?: boolean
  favoritesMutationFails?: boolean
  walletConnect?: 'ok' | 'rejected'
  checkout?: {
    priceChangeOnOrder?: boolean // preço sobe 10% entre a cotação e a criação do pedido
    soldOutOnOrder?: boolean // edição esgota entre a cotação e a criação do pedido
    timeoutAfterCreate?: boolean // pedido é criado, mas a resposta nunca chega (1ª tentativa)
    payment: 'confirmed' | 'declined'
    settleDelayMs: number // tempo em "pendente" antes de confirmar/recusar
  }
}

const base = (description: string, extra: Partial<Scenario> = {}): Scenario => ({
  description,
  latency: { mode: 'fixed', ms: 120 },
  checkout: { payment: 'confirmed', settleDelayMs: 2500 },
  ...extra,
})

export const SCENARIOS = {
  default: base('Sucesso, latência baixa e pagamento confirmado'),
  slow: base('Latência alta (2,5 s) em tudo: exercita skeletons e carregamento', {
    latency: { mode: 'fixed', ms: 2500 },
  }),
  'variable-latency': base('Latência variável (100–1800 ms), reproduzível', {
    latency: { mode: 'seeded', min: 100, max: 1800 },
  }),
  'out-of-order': base('Respostas fora de ordem: a requisição 1 demora mais que a 2', {
    latency: { mode: 'alternating', slowMs: 1500, fastMs: 100 },
  }),
  'network-down': base('Sem conexão: toda requisição falha', { networkDown: true }),
  'http-5xx': base('A cada 2ª requisição de /api/nfts responde 503', {
    fail: { everyNth: 2, status: 503, paths: ['/api/nfts'] },
  }),
  'http-4xx': base('A cada 2ª requisição de /api/nfts responde 429', {
    fail: { everyNth: 2, status: 429, paths: ['/api/nfts'] },
  }),
  'session-expired': base('A próxima requisição autenticada responde 401 SESSION_EXPIRED', {
    expireSessionOnNextAuthedRequest: true,
  }),
  'favorites-fail': base('Mutações de favoritos respondem 500 (testa rollback otimista)', {
    favoritesMutationFails: true,
  }),
  'wallet-rejected': base('A conexão com a carteira é recusada', { walletConnect: 'rejected' }),
  'price-changed': base('O preço muda entre a cotação e a criação do pedido', {
    checkout: { priceChangeOnOrder: true, payment: 'confirmed', settleDelayMs: 2500 },
  }),
  'sold-out': base('A edição esgota entre a cotação e a criação do pedido', {
    checkout: { soldOutOnOrder: true, payment: 'confirmed', settleDelayMs: 2500 },
  }),
  'order-timeout': base('Pedido criado, mas a resposta não chega (recupere com a mesma Idempotency-Key)', {
    checkout: { timeoutAfterCreate: true, payment: 'confirmed', settleDelayMs: 2500 },
  }),
  'payment-declined': base('Pagamento recusado após o período pendente', {
    checkout: { payment: 'declined', settleDelayMs: 2500 },
  }),
} satisfies Record<string, Scenario>

export type ScenarioName = keyof typeof SCENARIOS
export const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[]
export const isScenarioName = (v: string | null): v is ScenarioName => !!v && v in SCENARIOS

const STORAGE_KEY = 'kurio:scenario'

/** Flags e contadores efêmeros (por carregamento de página). Zerados em reset(). */
export const runtime = {
  requestCount: 0,
  failCounter: 0,
  expireNextAuthed: false,
  firedPriceChange: false,
  firedSoldOut: false,
}

export function resetRuntime(): void {
  runtime.requestCount = 0
  runtime.failCounter = 0
  runtime.expireNextAuthed = false
  runtime.firedPriceChange = false
  runtime.firedSoldOut = false
}

let current: ScenarioName = readStoredScenario()

function readStoredScenario(): ScenarioName {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return isScenarioName(stored) ? stored : 'default'
  } catch {
    return 'default'
  }
}

export const getScenarioName = (): ScenarioName => current
export const getScenario = (): Scenario => SCENARIOS[current]

export function setScenario(name: ScenarioName): void {
  current = name
  resetRuntime()
  runtime.expireNextAuthed = !!SCENARIOS[name].expireSessionOnNextAuthedRequest
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    /* storage indisponível: o cenário vale só nesta página */
  }
}

/** Mulberry32: gerador pseudoaleatório com semente (reproduzível). */
function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Latência (ms) da n-ésima requisição, determinística para um mesmo cenário. */
export function latencyFor(scenario: Scenario, n: number): number {
  const l = scenario.latency
  if (l.mode === 'fixed') return l.ms
  if (l.mode === 'seeded') return Math.round(l.min + mulberry32(n) * (l.max - l.min))
  return n % 2 === 1 ? l.slowMs : l.fastMs
}

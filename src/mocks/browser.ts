import { setupWorker } from 'msw/browser'
import { mockBus } from './bus'
import { expireAllSessions, resetDb, scheduleSettlements, updateNft } from './db'
import { handlers } from './handlers'
import { getScenarioName, isScenarioName, SCENARIOS, SCENARIO_NAMES, setScenario, type ScenarioName } from './scenarios'

/** API de controle dos mocks, exposta em window.__kurioMocks (demo e testes Playwright). */
export interface KurioMocksApi {
  scenarios: Record<ScenarioName, string> // nome -> descrição
  getScenario(): ScenarioName
  setScenario(name: ScenarioName): void
  /** Restaura o seed conhecido e ativa um cenário (padrão: "default"). */
  reset(scenario?: ScenarioName): void
  /** Invalida todas as sessões agora (simula expiração no instante exato). */
  expireSession(): void
  /** Muda preço/estoque de uma edição, incrementa a versão e publica `nft.updated`. */
  updateNft: typeof updateNft
  bus: typeof mockBus
}

declare global {
  interface Window {
    __kurioMocks?: KurioMocksApi
  }
}

export const worker = setupWorker(...handlers)

export async function enableMocks(): Promise<void> {
  const fromUrl = new URLSearchParams(window.location.search).get('scenario')
  if (isScenarioName(fromUrl)) setScenario(fromUrl)

  await worker.start({
    onUnhandledRequest: 'bypass', // fontes, imagens e arquivos estáticos passam direto
    quiet: import.meta.env.PROD,
  })
  scheduleSettlements() // reagenda pedidos que estavam pendentes antes de um refresh

  window.__kurioMocks = {
    scenarios: Object.fromEntries(SCENARIO_NAMES.map((n) => [n, SCENARIOS[n].description])) as Record<
      ScenarioName,
      string
    >,
    getScenario: getScenarioName,
    setScenario,
    reset(scenario = 'default') {
      resetDb()
      setScenario(scenario)
    },
    expireSession: expireAllSessions,
    updateNft,
    bus: mockBus,
  }
}

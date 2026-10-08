/**
 * Aritmética decimal de ETH sem ponto flutuante.
 * Valores trafegam como string decimal ("1.19"); internamente usamos BigInt em unidades de 1e-18.
 * Use SEMPRE estas funções para somar/multiplicar valores, nunca Number.
 */
const DECIMALS = 18
const SCALE = 10n ** 18n
const ETH_RE = /^\d+(\.\d{1,18})?$/

export function isEthString(value: unknown): value is string {
  return typeof value === 'string' && ETH_RE.test(value)
}

export function parseEth(value: string): bigint {
  if (!ETH_RE.test(value)) throw new Error(`Valor ETH inválido: ${value}`)
  const [int, frac = ''] = value.split('.')
  return BigInt(int) * SCALE + BigInt(frac.padEnd(DECIMALS, '0'))
}

/** Formata sem zeros à direita, mantendo no mínimo `minDecimals` casas (padrão 2). */
export function formatEth(units: bigint, minDecimals = 2): string {
  const int = units / SCALE
  let frac = (units % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, '0')
  return frac ? `${int}.${frac}` : `${int}`
}

export const sumEth = (values: string[]): string =>
  formatEth(values.reduce((acc, v) => acc + parseEth(v), 0n))

export const addEth = (a: string, b: string): string => formatEth(parseEth(a) + parseEth(b))

export function subEth(a: string, b: string): string {
  const result = parseEth(a) - parseEth(b)
  if (result < 0n) throw new Error('Resultado negativo em subEth')
  return formatEth(result)
}

/** Multiplica um valor ETH por uma quantidade inteira. */
export function mulEthInt(value: string, quantity: number): string {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Quantidade deve ser inteira')
  return formatEth(parseEth(value) * BigInt(quantity))
}

/** Aplica um percentual em basis points (100 bps = 1%), arredondando para baixo. */
export const percentEth = (value: string, bps: number): string =>
  formatEth((parseEth(value) * BigInt(bps)) / 10_000n)

export function cmpEth(a: string, b: string): -1 | 0 | 1 {
  const x = parseEth(a)
  const y = parseEth(b)
  return x < y ? -1 : x > y ? 1 : 0
}

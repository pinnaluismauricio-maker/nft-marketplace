import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { cmpEth } from '@/lib/eth'
import {
  COLLECTIONS,
  COLLECTION_LABELS,
  NETWORKS,
  NETWORK_LABELS,
  type NftListResponse,
} from '@/types/api'

export interface FilterValues {
  collection?: string
  network?: string
  minPrice?: string
  maxPrice?: string
}

interface Props {
  values: FilterValues
  facets?: NftListResponse['facets']
  priceRange?: NftListResponse['priceRange']
  onChange: (patch: Partial<FilterValues>) => void
}

const ETH_RE = /^\d+(\.\d{1,18})?$/
const INPUT =
  'h-9 w-full rounded-md border border-primary/30 bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-primary'

/** Liga/desliga um item numa lista separada por vírgulas ("a,b"); lista vazia vira undefined. */
function toggle(csv: string | undefined, item: string): string | undefined {
  const set = new Set(csv ? csv.split(',') : [])
  if (set.has(item)) set.delete(item)
  else set.add(item)
  return set.size ? [...set].join(',') : undefined
}

export function FiltersPanel({ values, facets, priceRange, onChange }: Props) {
  const collections = values.collection?.split(',') ?? []
  const networks = values.network?.split(',') ?? []
  const [min, setMin] = useState(values.minPrice ?? '')
  const [max, setMax] = useState(values.maxPrice ?? '')
  const [error, setError] = useState('')

  const hasFilters = !!(values.collection || values.network || values.minPrice || values.maxPrice)

  function applyPrice(e: FormEvent) {
    e.preventDefault()
    const lo = min.trim().replace(',', '.')
    const hi = max.trim().replace(',', '.')
    if ((lo && !ETH_RE.test(lo)) || (hi && !ETH_RE.test(hi))) {
      setError('Use números como 0.5 ou 1.25')
      return
    }
    if (lo && hi && cmpEth(lo, hi) > 0) {
      setError('O mínimo não pode ser maior que o máximo')
      return
    }
    setError('')
    onChange({ minPrice: lo || undefined, maxPrice: hi || undefined })
  }

  return (
    <div className="space-y-5 rounded-md bg-card p-5">
      <fieldset>
        <legend className="mb-3 text-sm font-bold">Coleções</legend>
        <div className="space-y-2">
          {COLLECTIONS.map((c) => (
            <label key={c} className="flex cursor-pointer items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={collections.includes(c)}
                  onChange={() => onChange({ collection: toggle(values.collection, c) })}
                />
                {COLLECTION_LABELS[c]}
              </span>
              <span className="text-primary">{facets ? (facets.collections[c] ?? 0) : ''}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <form onSubmit={applyPrice} noValidate>
        <fieldset>
          <legend className="mb-3 text-sm font-bold">Faixa de preço (ETH)</legend>
          <div className="flex items-center gap-2">
            <input
              aria-label="Preço mínimo em ETH"
              inputMode="decimal"
              placeholder={priceRange?.min ?? 'mín'}
              value={min}
              onChange={(e) => setMin(e.target.value)}
              aria-invalid={!!error}
              className={INPUT}
            />
            <span aria-hidden="true">–</span>
            <input
              aria-label="Preço máximo em ETH"
              inputMode="decimal"
              placeholder={priceRange?.max ?? 'máx'}
              value={max}
              onChange={(e) => setMax(e.target.value)}
              aria-invalid={!!error}
              className={INPUT}
            />
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-primary">
              {error}
            </p>
          )}
          <Button type="submit" size="sm" className="mt-3">
            Aplicar
          </Button>
        </fieldset>
      </form>

      <fieldset>
        <legend className="mb-3 text-sm font-bold">Rede</legend>
        <div className="space-y-2">
          {NETWORKS.map((n) => (
            <label key={n} className="flex cursor-pointer items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={networks.includes(n)}
                  onChange={() => onChange({ network: toggle(values.network, n) })}
                />
                {NETWORK_LABELS[n]}
              </span>
              <span className="text-primary">{facets ? (facets.networks[n] ?? 0) : ''}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {hasFilters && (
        <button
          type="button"
          className="text-xs underline"
          onClick={() => onChange({ collection: undefined, network: undefined, minPrice: undefined, maxPrice: undefined })}
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
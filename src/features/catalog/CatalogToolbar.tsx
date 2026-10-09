import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { NftSort, NftTab } from '@/types/api'

const TAB_LABELS: Record<NftTab, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

const SORT_LABELS: Record<NftSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  name: 'Nome (A–Z)',
}

interface Props {
  q?: string
  tab: NftTab
  sort: NftSort
  onSearch: (q: string) => void
  onTab: (tab: NftTab) => void
  onSort: (sort: NftSort) => void
  mobileFilters: ReactNode
}

export function CatalogToolbar({ q, tab, sort, onSearch, onTab, onSort, mobileFilters }: Props) {
  return (
    <div className="mb-6 space-y-4">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = new FormData(e.currentTarget).get('q')
          onSearch(typeof value === 'string' ? value.trim() : '')
        }}
      >
        <input
          key={q ?? ''} // ressincroniza quando a URL muda (ex.: botão voltar)
          type="search"
          name="q"
          aria-label="Buscar NFTs"
          placeholder="Buscar por nome, criador ou coleção..."
          defaultValue={q}
          className="h-10 w-full rounded-md border border-primary/30 bg-card px-3 text-xs focus-visible:outline-2 focus-visible:outline-primary"
        />
        <button type="submit" className="rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground">
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {mobileFilters}
          <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-4 text-xs">
            {(Object.keys(TAB_LABELS) as NftTab[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => onTab(t)}
                className={cn('pb-1', tab === t ? 'border-b-2 border-primary font-bold text-primary' : 'text-foreground')}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs">
          Ordenar por:
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as NftSort)}
            className="h-9 rounded-md border border-primary/30 bg-card px-2 text-xs"
          >
            {(Object.keys(SORT_LABELS) as NftSort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
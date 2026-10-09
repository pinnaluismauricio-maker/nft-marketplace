import { createFileRoute } from '@tanstack/react-router'
import { Container } from '@/components/layout/Container'
import { Pagination } from '@/components/Pagination'
import { useNfts } from '@/features/catalog/api'
import { CatalogToolbar } from '@/features/catalog/CatalogToolbar'
import { FiltersPanel } from '@/features/catalog/FiltersPanel'
import { MobileFilters } from '@/features/catalog/MobileFilters'
import { NftGrid } from '@/features/catalog/NftGrid'
import type { NftSort, NftTab } from '@/types/api'

type HomeSearch = {
  q?: string
  collection?: string
  network?: string
  minPrice?: string
  maxPrice?: string
  tab?: NftTab
  sort?: NftSort
  page?: number
}

const TABS: NftTab[] = ['all', 'new', 'trending']
const SORTS: NftSort[] = ['recent', 'price-asc', 'price-desc', 'name']
const PAGE_SIZE = 9

const text = (v: unknown) =>
  typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : undefined

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const page = Number(search.page)
    return {
      q: text(search.q),
      collection: text(search.collection),
      network: text(search.network),
      minPrice: text(search.minPrice),
      maxPrice: text(search.maxPrice),
      tab: TABS.find((t) => t === search.tab && t !== 'all'),
      sort: SORTS.find((s) => s === search.sort && s !== 'recent'),
      page: Number.isInteger(page) && page > 1 ? page : undefined,
    }
  },
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, isPending, isFetching, error, refetch } = useNfts({ ...search, pageSize: PAGE_SIZE })

  /** Qualquer mudança de busca/filtro/aba/ordem aplica o patch e REINICIA a paginação. */
  const setSearch = (patch: Partial<HomeSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) })

  const activeCount = [search.collection, search.network, search.minPrice || search.maxPrice].filter(Boolean).length

  const panel = (
    <FiltersPanel
      key={`${search.minPrice ?? ''}-${search.maxPrice ?? ''}`} // ressincroniza os campos de preço com a URL
      values={search}
      facets={data?.facets}
      priceRange={data?.priceRange}
      onChange={setSearch}
    />
  )

  return (
    <Container>
      <h1 className="text-display font-bold">Início</h1>

      <section id="catalogo" aria-label="Catálogo de NFTs" className="scroll-mt-8 py-12">
        <div className="lg:grid lg:grid-cols-[310px_1fr] lg:gap-8">
          <aside aria-label="Filtros" className="hidden lg:block">
            {panel}
          </aside>

          <div>
            <CatalogToolbar
              q={search.q}
              tab={search.tab ?? 'all'}
              sort={search.sort ?? 'recent'}
              onSearch={(q) => setSearch({ q: q || undefined })}
              onTab={(t) => setSearch({ tab: t === 'all' ? undefined : t })}
              onSort={(s) => setSearch({ sort: s === 'recent' ? undefined : s })}
              mobileFilters={<MobileFilters activeCount={activeCount}>{panel}</MobileFilters>}
            />

            <NftGrid
              items={data?.items}
              isPending={isPending}
              isFetching={isFetching}
              error={error}
              onRetry={() => refetch()}
              pageSize={PAGE_SIZE}
            />

            {data && data.totalPages > 1 && (
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onChange={(p) => navigate({ search: (prev) => ({ ...prev, page: p > 1 ? p : undefined }) })}
              />
            )}
          </div>
        </div>
      </section>
    </Container>
  )
}
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NftSummary } from '@/types/api'
import { NftCard, NftCardSkeleton } from './NftCard'

const GRID = 'grid grid-cols-2 gap-4 md:grid-cols-3'

interface Props {
  items?: NftSummary[]
  isPending: boolean
  isFetching: boolean
  error: Error | null
  onRetry: () => void
  pageSize: number
}

export function NftGrid({ items, isPending, isFetching, error, onRetry, pageSize }: Props) {
  if (isPending) {
    return (
      <>
        <p role="status" className="sr-only">Carregando NFTs...</p>
        <div className={GRID} aria-hidden="true">
          {Array.from({ length: pageSize }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
      </>
    )
  }

  if (error && !items) {
    return (
      <div role="alert" className="rounded-md bg-card p-6">
        <p className="font-bold">Não foi possível carregar os NFTs.</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-4" onClick={onRetry}>Tentar de novo</Button>
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div role="status" className="rounded-md bg-card p-6">
        <p className="font-bold">Nenhum NFT encontrado.</p>
        <p className="mt-1 text-sm text-muted-foreground">Tente remover algum filtro ou buscar por outro termo.</p>
      </div>
    )
  }

  return (
    <div className={cn(GRID, isFetching && 'opacity-60 transition-opacity')} aria-busy={isFetching}>
      {items.map((nft) => (
        <NftCard key={nft.id} nft={nft} />
      ))}
    </div>
  )
}
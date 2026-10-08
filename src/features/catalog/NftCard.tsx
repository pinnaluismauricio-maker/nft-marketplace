import { Link } from '@tanstack/react-router'
import { Skeleton } from '@/components/Skeleton'
import type { NftSummary } from '@/types/api'

export function NftCard({ nft }: { nft: NftSummary }) {
  return (
    <Link
      to="/nfts/$id"
      params={{ id: nft.id }}
      className="block rounded-md bg-card p-3 transition-colors hover:bg-surface-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <img
        src={nft.image}
        alt={`${nft.name}, arte digital de ${nft.creator.name}`}
        width={400}
        height={400}
        loading="lazy"
        className="aspect-square w-full rounded-sm object-cover"
      />
      <h3 className="mt-3 text-xs font-bold">{nft.name}</h3>
      <p className="mt-1 flex gap-2 text-xs">
        <span className="font-bold text-primary">{nft.price} ETH</span>
        {nft.previousPrice && <s className="text-muted-foreground">{nft.previousPrice} ETH</s>}
      </p>
      {nft.soldOut && <p className="mt-1 text-xs text-muted-foreground">Esgotado</p>}
    </Link>
  )
}

/** Mesmas dimensões do card real, para a página não "pular" quando os dados chegam. */
export function NftCardSkeleton() {
  return (
    <div className="rounded-md bg-card p-3">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-1 h-4 w-1/3" />
    </div>
  )
}
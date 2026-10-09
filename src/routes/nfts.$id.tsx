
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/button'
import {
  COLLECTION_LABELS,
  NETWORK_LABELS,
  type CartDto,
  type Nft,
} from '@/types/api'

export const Route = createFileRoute('/nfts/$id')({
  component: NftDetails,
})

function NftDetails() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const [added, setAdded] = useState(false)

  const {
    data: nft,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['nft', id],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Nft>(`/nfts/${id}`, { signal })
      return data
    },
  })

  const addToCart = useMutation({
    mutationFn: async () => {
      if (!nft) throw new Error('NFT não encontrado.')

      const edition = nft.editions[0]
      if (!edition) throw new Error('Nenhuma edição disponível.')

      const { data } = await api.post<CartDto>('/cart/items', {
        nftId: nft.id,
        editionId: edition.id,
        quantity: 1,
      })

      return data
    },
    onSuccess: async () => {
      setAdded(true)
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })

  if (isPending) {
    return (
      <Container>
        <p className="py-16" role="status">Carregando detalhes do NFT...</p>
      </Container>
    )
  }

  if (isError || !nft) {
    return (
      <Container>
        <section className="py-16">
          <h1 className="text-2xl font-bold">Não foi possível carregar o NFT</h1>
          <p className="mt-3 text-muted-foreground">
            Verifique sua conexão e tente novamente.
          </p>
          <Button className="mt-5" onClick={() => refetch()}>
            Tentar novamente
          </Button>
          <div className="mt-4">
            <Link to="/" className="underline">Voltar ao catálogo</Link>
          </div>
        </section>
      </Container>
    )
  }

  const edition = nft.editions[0]
  const image = nft.images?.[0] ?? nft.image

  return (
    <Container>
      <div className="py-8">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar ao catálogo
        </Link>

        <section className="mt-8 grid gap-8 md:grid-cols-2 md:gap-12">
          <div>
            <img
              src={image}
              alt={`Obra ${nft.name}, criada por ${nft.creator.name}`}
              className="aspect-square w-full rounded-xl object-cover"
            />

            {nft.images && nft.images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-3">
                {nft.images.slice(1, 5).map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt={`Outra imagem da obra ${nft.name}`}
                    loading="lazy"
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-primary">
              {COLLECTION_LABELS[nft.collection]}
            </p>

            <h1 className="mt-2 text-3xl font-bold">{nft.name}</h1>

            <p className="mt-3 text-muted-foreground">
              Criado por {nft.creator.name}
            </p>

            <p className="mt-6 leading-7 text-muted-foreground">
              {nft.description}
            </p>

            <div className="mt-6 rounded-xl border border-border p-5">
              <p className="text-sm text-muted-foreground">Preço da edição</p>

              <p className="mt-1 text-3xl font-bold">
                {edition?.price ?? nft.price} ETH
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                Rede: {NETWORK_LABELS[nft.network]}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                {edition
                  ? `${edition.available} unidades disponíveis`
                  : 'Edição indisponível'}
              </p>

              <Button
                className="mt-5 w-full"
                disabled={
                  !edition ||
                  edition.available < 1 ||
                  addToCart.isPending
                }
                onClick={() => {
                  setAdded(false)
                  addToCart.mutate()
                }}
              >
                {addToCart.isPending
                  ? 'Adicionando...'
                  : 'Adicionar ao carrinho'}
              </Button>

              {addToCart.isError && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {addToCart.error instanceof Error
                    ? addToCart.error.message
                    : 'Não foi possível adicionar o NFT.'}
                </p>
              )}

              {added && (
                <div className="mt-4" role="status">
                  <p className="text-sm">NFT adicionado ao carrinho!</p>
                  <Link
                    to="/cart"
                    className="mt-2 inline-block font-medium text-primary underline"
                  >
                    Ir para o carrinho
                  </Link>
                </div>
              )}
            </div>

            {nft.attributes.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-bold">Características</h2>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  {nft.attributes.map((attribute) => (
                    <div
                      key={`${attribute.trait}-${attribute.value}`}
                      className="rounded-lg border border-border p-3"
                    >
                      <p className="text-xs text-muted-foreground">
                        {attribute.trait}
                      </p>
                      <p className="mt-1 font-medium">{attribute.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </Container>
  )
}


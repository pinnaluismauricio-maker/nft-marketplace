
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { requireAuth } from '@/features/auth/guard'
import { api } from '@/lib/api'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/button'
import {
  NETWORKS,
  NETWORK_LABELS,
  type CartDto,
  type CreateOrderRequest,
  type NetworkId,
  type OrderDto,
  type QuoteDto,
  type WalletDto,
} from '@/types/api'

export const Route = createFileRoute('/checkout')({
  beforeLoad: requireAuth,
  component: CheckoutPage,
})

function CheckoutPage() {
  const queryClient = useQueryClient()
  const idempotencyKey = useRef('')
  const navigate = useNavigate()

  const [network, setNetwork] = useState<NetworkId>('ethereum')
  const [walletId, setWalletId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<CartDto>('/cart', { signal })
      return data
    },
  })

  const walletsQuery = useQuery({
    queryKey: ['wallets'],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ items: WalletDto[] }>(
        '/wallets',
        { signal },
      )
      return data.items
    },
  })

  const wallets = walletsQuery.data ?? []
  const compatibleWallets = wallets.filter(
    (wallet) => wallet.network === network,
  )

  const selectedWallet =
    compatibleWallets.find((wallet) => wallet.id === walletId) ??
    compatibleWallets.find((wallet) => wallet.isPrimary) ??
    compatibleWallets[0]

  const cart = cartQuery.data

  const quoteQuery = useQuery({
    queryKey: [
      'checkout-quote',
      network,
      selectedWallet?.id ?? null,
      cart?.updatedAt ?? null,
    ],
    queryFn: async ({ signal }) => {
      const { data } = await api.post<QuoteDto>(
        '/checkout/quote',
        {
          network,
          walletId: selectedWallet?.id ?? null,
        },
        { signal },
      )
      return data
    },
    enabled: Boolean(cart && cart.items.length > 0 && selectedWallet),
    staleTime: 15_000,
    retry: false,
  })

  const connectWallet = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<WalletDto>(
        `/wallets/${id}/connect`,
      )
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
  })

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!quoteQuery.data) {
        throw new Error('A cotação ainda não está disponível.')
      }

      if (!selectedWallet) {
        throw new Error('Selecione uma carteira compatível com a rede.')
      }

      if (!selectedWallet.connected) {
        throw new Error('Conecte sua carteira antes de continuar.')
      }

      const payload: CreateOrderRequest = {
        quoteId: quoteQuery.data.id,
        walletId: selectedWallet.id,
        collector: {
          name: name.trim(),
          email: email.trim(),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      }

      if (!idempotencyKey.current) {
        idempotencyKey.current = crypto.randomUUID()
      }

      const { data } = await api.post<OrderDto>(
        '/orders',
        payload,
        {
          headers: {
            'Idempotency-Key': idempotencyKey.current,
          },
        },
      )

      return data
    },
    onSuccess: async (order) => {
  await queryClient.invalidateQueries({ queryKey: ['cart'] })

  await navigate({
    to: '/orders/$orderId',
    params: { orderId: order.id },
  })
    },
  })

  const busy = createOrder.isPending || connectWallet.isPending

  if (cartQuery.isPending || walletsQuery.isPending) {
    return (
      <Container>
        <main className="py-16" role="status">
          Preparando seu checkout...
        </main>
      </Container>
    )
  }

  if (cartQuery.isError || walletsQuery.isError) {
    return (
      <Container>
        <main className="py-12">
          <h1 className="text-2xl font-bold">
            Não foi possível carregar o checkout
          </h1>
          <p className="mt-3 text-muted-foreground">
            Confira sua conexão e tente novamente.
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              void cartQuery.refetch()
              void walletsQuery.refetch()
            }}
          >
            Tentar novamente
          </Button>
        </main>
      </Container>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <Container>
        <main className="py-16">
          <h1 className="text-2xl font-bold">Seu carrinho está vazio</h1>
          <p className="mt-3 text-muted-foreground">
            Adicione um NFT antes de iniciar o checkout.
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              window.location.href = '/'
            }}
          >
            Voltar ao catálogo
          </Button>
        </main>
      </Container>
    )
  }

  const formatError = (error: Error) => error.message

  return (
    <Container>
      <main className="mx-auto max-w-5xl py-10">
        <h1 className="text-3xl font-bold">Finalizar compra</h1>
        <p className="mt-2 text-muted-foreground">
          Confira os dados, escolha sua carteira e confirme o pedido.
        </p>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-xl border border-border p-5 sm:p-6">
              <h2 className="text-xl font-semibold">
                1. Dados do colecionador
              </h2>

              <form
                id="checkout-form"
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  createOrder.mutate()
                }}
              >
                <div>
                  <label
                    htmlFor="collector-name"
                    className="mb-2 block text-sm font-medium"
                  >
                    Nome completo
                  </label>
                  <input
                    id="collector-name"
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      idempotencyKey.current = ''
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Seu nome"
                  />
                </div>

                <div>
                  <label
                    htmlFor="collector-email"
                    className="mb-2 block text-sm font-medium"
                  >
                    E-mail
                  </label>
                  <input
                    id="collector-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      idempotencyKey.current = ''
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="voce@exemplo.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="collector-notes"
                    className="mb-2 block text-sm font-medium"
                  >
                    Observações (opcional)
                  </label>
                  <textarea
                    id="collector-notes"
                    name="notes"
                    value={notes}
                    onChange={(event) => {
                      setNotes(event.target.value)
                      idempotencyKey.current = ''
                    }}
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Alguma informação adicional"
                  />
                </div>
              </form>
            </section>

            <section className="rounded-xl border border-border p-5 sm:p-6">
              <h2 className="text-xl font-semibold">
                2. Rede e carteira
              </h2>

              <div className="mt-5">
                <label
                  htmlFor="network"
                  className="mb-2 block text-sm font-medium"
                >
                  Rede blockchain
                </label>
                <select
                  id="network"
                  value={network}
                  onChange={(event) => {
                    setNetwork(event.target.value as NetworkId)
                    setWalletId('')
                    idempotencyKey.current = ''
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  {NETWORKS.map((item) => (
                    <option key={item} value={item}>
                      {NETWORK_LABELS[item]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="wallet"
                  className="mb-2 block text-sm font-medium"
                >
                  Carteira
                </label>

                {compatibleWallets.length > 0 ? (
                  <select
                    id="wallet"
                    value={selectedWallet?.id ?? ''}
                    onChange={(event) => {
                      setWalletId(event.target.value)
                      idempotencyKey.current = ''
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5"
                  >
                    {compatibleWallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.label}
                        {wallet.isPrimary ? ' (Principal)' : ''}
                        {wallet.connected ? ' — Conectada' : ' — Desconectada'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm text-muted-foreground">
                      Você não possui uma carteira cadastrada nessa rede.
                    </p>
                    <Button
                      className="mt-3"
                      variant="outline"
                      onClick={() => {
                        window.location.href = '/wallets'
                      }}
                    >
                      Cadastrar carteira
                    </Button>
                  </div>
                )}
              </div>

              {selectedWallet && (
                <div className="mt-4 rounded-lg bg-muted/50 p-4">
                  <p className="text-sm font-medium">
                    {selectedWallet.label}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {selectedWallet.address}
                  </p>
                  <p className="mt-2 text-sm">
                    Status:{' '}
                    {selectedWallet.connected ? 'Conectada' : 'Desconectada'}
                  </p>

                  {!selectedWallet.connected && (
                    <Button
                      className="mt-3"
                      variant="outline"
                      disabled={busy}
                      onClick={() => connectWallet.mutate(selectedWallet.id)}
                    >
                      {connectWallet.isPending
                        ? 'Conectando...'
                        : 'Conectar carteira'}
                    </Button>
                  )}

                  {connectWallet.isError && (
                    <p className="mt-3 text-sm text-destructive" role="alert">
                      {formatError(connectWallet.error)}
                    </p>
                  )}
                </div>
              )}

              {wallets.length === 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Cadastre uma carteira para prosseguir com a compra.
                </p>
              )}
            </section>
          </div>

          <aside className="rounded-xl border border-border p-5 lg:sticky lg:top-6">
            <h2 className="text-xl font-semibold">Resumo do pedido</h2>

            <div className="mt-5 space-y-4">
              {cart.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Quantidade: {item.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium">
                    {item.lineTotal} ETH
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{cart.pricing.subtotal} ETH</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Desconto</span>
                <span>− {cart.pricing.discount} ETH</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Taxa de rede</span>
                <span>{cart.pricing.networkFee} ETH</span>
              </div>
            </div>

            {quoteQuery.isPending && selectedWallet && (
              <p className="mt-5 text-sm text-muted-foreground" role="status">
                Calculando cotação...
              </p>
            )}

            {quoteQuery.isError && (
              <div className="mt-5" role="alert">
                <p className="text-sm text-destructive">
                  Não foi possível gerar a cotação. Verifique o estoque e tente novamente.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() => void quoteQuery.refetch()}
                >
                  Atualizar cotação
                </Button>
              </div>
            )}

            {quoteQuery.data && (
              <>
                <div className="mt-4 flex justify-between gap-3 border-t border-border pt-4 text-lg font-bold">
                  <span>Total</span>
                  <span>{quoteQuery.data.pricing.total} ETH</span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Cotação válida até{' '}
                  {new Date(quoteQuery.data.expiresAt).toLocaleTimeString(
                    'pt-BR',
                    { hour: '2-digit', minute: '2-digit' },
                  )}
                </p>
              </>
            )}

            {createOrder.isError && (
              <div className="mt-5 rounded-lg border border-destructive/30 p-3">
                <p className="text-sm text-destructive" role="alert">
                  {formatError(createOrder.error)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Confira os dados e tente novamente. Uma nova tentativa mantém
                  a chave de idempotência para evitar pedidos duplicados.
                </p>
              </div>
            )}

            <Button
              className="mt-6 w-full"
              disabled={
                busy ||
                !selectedWallet ||
                !selectedWallet.connected ||
                !quoteQuery.data ||
                cart.items.some((item) => Boolean(item.issue)) ||
                !name.trim() ||
                !email.trim()
              }
              onClick={() => {
                const form = document.getElementById(
                  'checkout-form',
                ) as HTMLFormElement | null

                if (form?.reportValidity()) {
                  createOrder.mutate()
                }
              }}
            >
              {createOrder.isPending
                ? 'Processando pagamento...'
                : 'Confirmar e pagar'}
            </Button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Pagamento simulado. Nenhuma transação real será realizada.
            </p>
          </aside>
        </div>
      </main>
    </Container>
  )
}

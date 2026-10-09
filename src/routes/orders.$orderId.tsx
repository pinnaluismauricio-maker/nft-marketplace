
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { requireAuth } from '@/features/auth/guard'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/button'
import type { OrderDto } from '@/types/api'

export const Route = createFileRoute('/orders/$orderId')({
  beforeLoad: requireAuth,
  component: OrderPage,
})

function OrderPage() {
  const { orderId } = Route.useParams()

  const {
    data: order,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<OrderDto>(
        `/orders/${orderId}`,
        { signal },
      )
      return data
    },
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' ? 1500 : false,
  })

  if (isPending) {
    return (
      <Container>
        <main className="py-16" role="status">
          Consultando seu pedido...
        </main>
      </Container>
    )
  }

  if (isError || !order) {
    return (
      <Container>
        <main className="py-16">
          <h1 className="text-2xl font-bold">
            Não foi possível localizar o pedido
          </h1>
          <p className="mt-3 text-muted-foreground">
            {error instanceof Error
              ? error.message
              : 'Verifique o pedido e tente novamente.'}
          </p>
          <Button className="mt-5" onClick={() => refetch()}>
            Tentar novamente
          </Button>
          <div className="mt-4">
            <Link to="/" className="underline">
              Voltar ao catálogo
            </Link>
          </div>
        </main>
      </Container>
    )
  }

  const confirmed = order.status === 'confirmed'
  const declined = order.status === 'declined'

  return (
    <Container>
      <main className="mx-auto max-w-3xl py-12">
        <section className="rounded-2xl border border-border p-6 sm:p-8">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
              confirmed
                ? 'bg-green-500/10 text-green-600'
                : declined
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-primary/10 text-primary'
            }`}
            aria-hidden="true"
          >
            {confirmed ? '✓' : declined ? '!' : '…'}
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            {confirmed
              ? 'Pedido confirmado!'
              : declined
                ? 'Pagamento não aprovado'
                : 'Pagamento em processamento'}
          </h1>

          <p className="mt-3 text-muted-foreground" role="status">
            {confirmed
              ? 'Sua compra foi concluída com sucesso.'
              : declined
                ? order.declineReason === 'OUT_OF_STOCK'
                  ? 'Uma das edições ficou indisponível. Seu pedido não foi concluído.'
                  : 'O pagamento foi recusado. Você pode revisar sua compra e tentar novamente.'
                : 'Estamos aguardando a confirmação do pagamento. Esta página será atualizada automaticamente.'}
          </p>

          <div className="mt-6 rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Número do pedido</p>
            <p className="mt-1 break-all font-mono font-medium">
              {order.id}
            </p>

            <p className="mt-4 text-sm text-muted-foreground">Status</p>
            <p className="mt-1 font-medium">
              {confirmed
                ? 'Confirmado'
                : declined
                  ? 'Recusado'
                  : 'Pendente'}
            </p>

            <p className="mt-4 text-sm text-muted-foreground">Data do pedido</p>
            <p className="mt-1">
              {new Date(order.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>

          <h2 className="mt-8 text-xl font-semibold">Resumo da compra</h2>

          <div className="mt-4 space-y-4">
            {order.items.map((item) => (
              <div
                key={`${item.nftId}-${item.editionId}`}
                className="flex items-center gap-4"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-20 w-20 rounded-lg object-cover"
                />

                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.editionLabel} · Quantidade: {item.quantity}
                  </p>
                </div>

                <p className="shrink-0 font-medium">
                  {item.lineTotal} ETH
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3 border-t border-border pt-5">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{order.pricing.subtotal} ETH</span>
            </div>

            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Desconto</span>
              <span>− {order.pricing.discount} ETH</span>
            </div>

            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Taxa de rede</span>
              <span>{order.pricing.networkFee} ETH</span>
            </div>

            <div className="flex justify-between gap-4 border-t border-border pt-4 text-lg font-bold">
              <span>Total</span>
              <span>{order.pricing.total} ETH</span>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Carteira utilizada</p>
            <p className="mt-1 font-medium">{order.wallet.label}</p>
            <p className="mt-1 break-all font-mono text-sm">
              {order.wallet.address}
            </p>

            {order.txHash && (
              <>
                <p className="mt-4 text-sm text-muted-foreground">
                  Hash da transação
                </p>
                <p className="mt-1 break-all font-mono text-sm">
                  {order.txHash}
                </p>
              </>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            
            <Link to="/">
            <Button className="mt-5">
            Continuar comprando
            </Button>
            </Link>


            {declined && (
              
          <Link to="/">
          <Button className="mt-5">
          Confirmar o pedido
          </Button>
</Link>

            )}
          </div>
        </section>
      </main>
    </Container>
  )
}


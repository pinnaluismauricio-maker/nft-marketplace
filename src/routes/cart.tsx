
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/button'
import type { CartDto } from '@/types/api'

export const Route = createFileRoute('/cart')({
  component: CartPage,
})

function CartPage() {
  const queryClient = useQueryClient()
  const [couponCode, setCouponCode] = useState('')
  const [couponMessage, setCouponMessage] = useState('')

  const {
    data: cart,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['cart'],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<CartDto>('/cart', { signal })
      return data
    },
  })

  const refreshCart = async () => {
    await queryClient.invalidateQueries({ queryKey: ['cart'] })
  }

  const updateQuantity = useMutation({
    mutationFn: async ({
      itemId,
      quantity,
    }: {
      itemId: string
      quantity: number
    }) => {
      const { data } = await api.patch<CartDto>(
        `/cart/items/${itemId}`,
        { quantity },
      )
      return data
    },
    onSuccess: refreshCart,
  })

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await api.delete<CartDto>(`/cart/items/${itemId}`)
      return data
    },
    onSuccess: refreshCart,
  })

  const applyCoupon = useMutation({
    mutationFn: async (code: string) => {
      const { data } = await api.put<CartDto>('/cart/coupon', { code })
      return data
    },
    onSuccess: async () => {
      setCouponMessage('Cupom aplicado com sucesso!')
      await refreshCart()
    },
    onError: (error) => {
      setCouponMessage(
        error instanceof Error ? error.message : 'Não foi possível aplicar o cupom.',
      )
    },
  })

  const removeCoupon = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<CartDto>('/cart/coupon')
      return data
    },
    onSuccess: async () => {
      setCouponCode('')
      setCouponMessage('Cupom removido.')
      await refreshCart()
    },
  })

  const busy =
    updateQuantity.isPending ||
    removeItem.isPending ||
    applyCoupon.isPending ||
    removeCoupon.isPending

  if (isPending) {
    return (
      <Container>
        <p className="py-16" role="status">Carregando seu carrinho...</p>
      </Container>
    )
  }

  if (isError || !cart) {
    return (
      <Container>
        <section className="py-16">
          <h1 className="text-2xl font-bold">Não foi possível carregar o carrinho</h1>
          <p className="mt-3 text-muted-foreground">
            {error instanceof Error ? error.message : 'Tente novamente.'}
          </p>
          <Button className="mt-5" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </section>
      </Container>
    )
  }

  const { pricing } = cart

  return (
    <Container>
      <main className="py-10">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Continuar comprando
        </Link>

        <h1 className="mt-5 text-3xl font-bold">Meu carrinho</h1>
        <p className="mt-2 text-muted-foreground">
          Revise suas obras antes de continuar para o pagamento.
        </p>

        {(updateQuantity.isError || removeItem.isError || removeCoupon.isError) && (
          <p className="mt-5 rounded-lg border border-destructive/30 p-3 text-sm text-destructive" role="alert">
            Não foi possível atualizar o carrinho. Confira o estoque e tente novamente.
          </p>
        )}

        {cart.items.length === 0 ? (
          <section className="mt-8 rounded-xl border border-border p-8 text-center">
            <h2 className="text-xl font-semibold">Seu carrinho está vazio</h2>
            <p className="mt-2 text-muted-foreground">
              Explore o catálogo e encontre sua próxima obra digital.
            </p>
            
        <Link to="/">
        <Button className="mt-5">
        Explorar NFTs
        </Button>
</Link>

          </section>
        ) : (
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
            <section aria-label="Itens do carrinho" className="space-y-4">
              {cart.items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="aspect-square w-full rounded-lg object-cover sm:w-28"
                  />

                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{item.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.editionLabel}
                    </p>
                    <p className="mt-2 text-sm">
                      {item.unitPrice} ETH por unidade
                    </p>

                    {item.issue && (
                      <p className="mt-2 text-sm text-destructive" role="alert">
                        {item.issue === 'SOLD_OUT'
                          ? 'Esta edição está esgotada.'
                          : 'A quantidade excede o estoque disponível.'}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`Diminuir quantidade de ${item.name}`}
                          disabled={busy || item.quantity <= 1}
                          onClick={() =>
                            updateQuantity.mutate({
                              itemId: item.id,
                              quantity: item.quantity - 1,
                            })
                          }
                        >
                          −
                        </Button>

                        <span className="min-w-6 text-center" aria-label="Quantidade">
                          {item.quantity}
                        </span>

                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`Aumentar quantidade de ${item.name}`}
                          disabled={
                            busy ||
                            item.quantity >= item.maxQuantity ||
                            Boolean(item.issue)
                          }
                          onClick={() =>
                            updateQuantity.mutate({
                              itemId: item.id,
                              quantity: item.quantity + 1,
                            })
                          }
                        >
                          +
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => removeItem.mutate(item.id)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-sm text-muted-foreground">Total do item</p>
                    <p className="mt-1 font-semibold">{item.lineTotal} ETH</p>
                  </div>
                </article>
              ))}
            </section>

            <aside className="rounded-xl border border-border p-5 lg:sticky lg:top-6">
              <h2 className="text-xl font-semibold">Resumo do pedido</h2>

              <form
                className="mt-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  setCouponMessage('')
                  applyCoupon.mutate(couponCode.trim())
                }}
              >
                <label htmlFor="coupon" className="text-sm font-medium">
                  Cupom de desconto
                </label>

                <div className="mt-2 flex gap-2">
                  <input
                    id="coupon"
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                    placeholder="Ex.: KURIO10"
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />

                  <Button
                    type="submit"
                    variant="outline"
                    disabled={!couponCode.trim() || busy}
                  >
                    Aplicar
                  </Button>
                </div>
              </form>

              {couponMessage && (
                <p
                  className="mt-3 text-sm"
                  role="status"
                  aria-live="polite"
                >
                  {couponMessage}
                </p>
              )}

              {cart.coupon && (
                <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                  <span>
                    Cupom {cart.coupon.code} — {cart.coupon.label}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => removeCoupon.mutate()}
                  >
                    Remover
                  </Button>
                </div>
              )}

              {cart.couponIssue && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {cart.couponIssue === 'COUPON_EXPIRED'
                    ? 'O cupom aplicado expirou.'
                    : 'O cupom não é válido.'}
                </p>
              )}

              <div className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{pricing.subtotal} ETH</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Desconto</span>
                  <span>− {pricing.discount} ETH</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Taxa de rede ({(pricing.networkFeeBps / 100).toFixed(2)}%)
                  </span>
                  <span>{pricing.networkFee} ETH</span>
                </div>

                <div className="flex justify-between gap-4 border-t border-border pt-4 text-base font-bold">
                  <span>Total</span>
                  <span>{pricing.total} ETH</span>
                </div>
              </div>

              <Button
                className="mt-6 w-full"
                disabled={
                  cart.items.length === 0 ||
                  busy ||
                  cart.items.some((item) => Boolean(item.issue))
                }
                onClick={() => {
                  window.location.href = '/checkout'
                }}
              >
                Continuar para checkout
              </Button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                Valores simulados para este desafio.
              </p>
            </aside>
          </div>
        )}
      </main>
    </Container>
  )
}

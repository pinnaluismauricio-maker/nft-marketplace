
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { io } from 'socket.io-client'
import { Container } from '@/components/layout/Container'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { useSession } from '@/features/auth/api'
import type { DomainEvent } from '@/types/api'

function RealtimeBridge() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const versions = useRef(new Map<string, number>())

  useEffect(() => {
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.DEV ? 'http://localhost:3001' : '')

    if (!socketUrl) return

    const socket = io(socketUrl)

    socket.on('connect', () => {
      console.info('[Socket.IO] Conectado ao servidor')
      if (session?.id) {
        socket.emit('join:user', session.id)
      }
    })

    const handleEvent = (event: DomainEvent) => {
      console.log('[Socket.IO] Evento recebido pelo React:', event)
      const resourceKey = `${event.resource.kind}:${event.resource.id}`
      const previousVersion = versions.current.get(resourceKey) ?? 0

      // Ignora eventos repetidos ou mais antigos.
      if (event.version <= previousVersion) return

      versions.current.set(resourceKey, event.version)

      if (event.type === 'nft.updated') {
        void queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey.some(
              (key) =>
                key === 'nfts' ||
                key === 'nft' ||
                key === event.payload.nftId,
            ),
        })
      }

      if (
        event.type === 'order.updated' &&
        session?.id &&
        event.userId === session.id
      ) {
        void queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey.some(
              (key) =>
                key === 'orders' ||
                key === 'order' ||
                key === event.payload.orderId,
            ),
        })
      }
    }

    socket.on('domain:event', handleEvent)

    return () => {
      socket.off('domain:event', handleEvent)
      socket.disconnect()
    }
  }, [queryClient, session?.id])

  return null
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: () => (
    <>
      <RealtimeBridge />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  ),
  notFoundComponent: () => (
    <Container>
      <h1 className="py-12 text-display font-bold">
        Página não encontrada
      </h1>
    </Container>
  ),
})

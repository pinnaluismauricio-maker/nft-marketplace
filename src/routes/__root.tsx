import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Container } from '@/components/layout/Container'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  ),
  notFoundComponent: () => (
    <Container>
      <h1 className="py-12 text-display font-bold">Página não encontrada</h1>
    </Container>
  ),
})
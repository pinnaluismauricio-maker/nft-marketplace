import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export const Route = createRootRoute({
  component: () => (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  ),
  notFoundComponent: () => <p>Página não encontrada</p>,
})
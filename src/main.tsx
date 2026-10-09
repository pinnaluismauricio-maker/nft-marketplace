import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/roboto-mono'
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { resetPrivateCache } from './features/auth/api'
import { queryClient } from './lib/query-client'
import { clearToken, onSessionExpired } from './lib/session'

const router = createRouter({ routeTree, context: { queryClient } })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const PRIVATE_PATHS = ['/checkout', '/profile', '/wallets', '/orders']

// Sessão expirou no meio da navegação: limpa os dados privados e, se a pessoa estava numa
// área privada, manda para o login guardando onde ela estava (volta para lá depois).
onSessionExpired(() => {
  clearToken()
  resetPrivateCache(queryClient)
  const { pathname, href } = router.state.location
  if (PRIVATE_PATHS.some((p) => pathname.startsWith(p))) {
    void router.navigate({ to: '/login', search: { redirect: href, reason: 'expired' } })
  }
})

async function bootstrap() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { enableMocks } = await import('./mocks/browser')
    await enableMocks()
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

bootstrap()
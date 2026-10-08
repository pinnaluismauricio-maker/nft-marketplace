import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/roboto-mono'
import './index.css'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query-client'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

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
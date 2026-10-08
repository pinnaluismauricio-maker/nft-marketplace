import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // por 30 s o dado é "fresco" e não é refeito ao reabrir a tela
      gcTime: 5 * 60_000, // dados sem uso saem do cache depois de 5 min
      retry: (failureCount, error) => {
        // Erros de cliente (4xx) não melhoram sozinhos: não repetir.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) return false
        return failureCount < 2 // rede, timeout, 5xx e 429: até 2 novas tentativas
      },
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000), // 0,5 s, 1 s, 2 s... (backoff)
    },
    mutations: {
      retry: false, // mutações NUNCA repetem sozinhas: evita operação duplicada
    },
  },
})
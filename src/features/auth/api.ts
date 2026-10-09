import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { clearToken, getGuestId, getToken, setToken } from '@/lib/session'
import type { AuthResponse, SessionResponse, UserDto } from '@/types/api'

/** Chaves de cache que pertencem ao usuário logado (usadas também nas próximas features). */
const PRIVATE_KEYS = ['session', 'cart', 'favorites', 'orders', 'wallets', 'profile', 'quote']
const isPrivateQuery = (q: { queryKey: readonly unknown[] }) => PRIVATE_KEYS.includes(String(q.queryKey[0]))

export const resetPrivateCache = (qc: QueryClient): void => {
  void qc.resetQueries({ predicate: isPrivateQuery })
}

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async (): Promise<UserDto | null> => {
    if (!getToken()) return null
    try {
      const { data } = await api.get<SessionResponse>('/auth/session', { skipSessionExpiry: true })
      return data.user
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearToken() // token velho: vira visitante, sem alarde
        return null
      }
      throw error
    }
  },
  staleTime: 5 * 60_000,
  retry: false,
})

export const useSession = () => useQuery(sessionQuery)

async function onAuthenticated(qc: QueryClient, auth: AuthResponse): Promise<void> {
  setToken(auth.token)
  // Itens do carrinho de visitante passam para a conta (não bloqueia o login se falhar).
  await api.post('/cart/merge', { guestId: getGuestId() }).catch(() => undefined)
  resetPrivateCache(qc) // nada do visitante/usuário anterior sobrevive no cache
  qc.setQueryData(sessionQuery.queryKey, auth.user)
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) =>
      (await api.post<AuthResponse>('/auth/login', input)).data,
    onSuccess: (auth) => onAuthenticated(qc, auth),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; email: string; password: string }) =>
      (await api.post<AuthResponse>('/auth/register', input)).data,
    onSuccess: (auth) => onAuthenticated(qc, auth),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await api.post('/auth/logout')
      } catch {
        /* encerra localmente mesmo que o servidor não responda */
      }
    },
    onSettled: () => {
      clearToken()
      resetPrivateCache(qc)
    },
  })
}
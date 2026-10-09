const TOKEN_KEY = 'kurio:token'
const GUEST_KEY = 'kurio:guest-id'

let expiredHandler: (() => void) | null = null
let expiredNotified = false

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)

export function setToken(token: string): void {
  expiredNotified = false
  localStorage.setItem(TOKEN_KEY, token)
}

export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY)

export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(GUEST_KEY, id)
  }
  return id
}

/** O app registra aqui o que fazer quando a API informa que a sessão acabou. */
export const onSessionExpired = (handler: () => void): void => {
  expiredHandler = handler
}

/** Chamado pelo Axios. Dispara o handler uma única vez, mesmo com várias respostas 401 simultâneas. */
export function notifySessionExpired(): void {
  if (expiredNotified || !getToken()) return
  expiredNotified = true
  expiredHandler?.()
}
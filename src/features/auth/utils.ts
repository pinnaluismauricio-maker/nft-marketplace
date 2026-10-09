const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const validateEmail = (v: string): string | null =>
  EMAIL_RE.test(v) ? null : 'Informe um e-mail válido'

export function validatePassword(v: string): string | null {
  if (v.length < 8) return 'A senha deve ter ao menos 8 caracteres'
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Use letras e números na senha'
  return null
}

export const validateName = (v: string): string | null =>
  v.length >= 2 && v.length <= 60 ? null : 'Informe um nome com 2 a 60 caracteres'

/** Só aceita caminhos internos: evita que um link malicioso mande o usuário para outro site. */
export function safeRedirect(value: string | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/'
}
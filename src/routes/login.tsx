import { useState, type FormEvent } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { FormField } from '@/components/FormField'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/button'
import { useLogin } from '@/features/auth/api'
import { safeRedirect, validateEmail } from '@/features/auth/utils'
import { ApiError } from '@/lib/api'

type LoginSearch = { redirect?: string; reason?: 'expired' }

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    redirect: typeof s.redirect === 'string' ? s.redirect : undefined,
    reason: s.reason === 'expired' ? 'expired' : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect, reason } = Route.useSearch()
  const router = useRouter()
  const login = useLogin()
  const [errors, setErrors] = useState<Record<string, string>>({})

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    const next: Record<string, string> = {}
    const emailError = validateEmail(email)
    if (emailError) next.email = emailError
    if (!password) next.password = 'Informe a senha'
    setErrors(next)
    if (Object.keys(next).length) return

    login.mutate(
      { email, password },
      { onSuccess: () => router.history.push(safeRedirect(redirect)) },
    )
  }

  const apiError = login.error instanceof ApiError ? login.error : null
  const fieldErrors = { ...errors, ...apiError?.fieldErrors }

  return (
    <Container className="py-12">
      <div className="mx-auto max-w-md rounded-md bg-card p-6">
        <h1 className="text-xl font-bold">Entrar</h1>

        {reason === 'expired' && (
          <p role="status" className="mt-3 text-xs">
            Sua sessão expirou. Entre novamente para continuar de onde parou.
          </p>
        )}

        {apiError && !apiError.fieldErrors && (
          <p role="alert" className="mt-3 text-xs text-primary">
            Erro: {apiError.message}
          </p>
        )}

        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
          <FormField label="E-mail" name="email" type="email" autoComplete="email" error={fieldErrors.email} />
          <FormField
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            error={fieldErrors.password}
          />
          <Button type="submit" disabled={login.isPending} className="w-full">
            {login.isPending ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-4 text-xs">
          Ainda não tem conta?{' '}
          <Link to="/register" search={{ redirect }} className="underline">
            Cadastre-se
          </Link>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Demonstração: ana@kurio.test / Kurio@123</p>
      </div>
    </Container>
  )
}

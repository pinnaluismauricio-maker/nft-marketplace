import { useState, type FormEvent } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { FormField } from '@/components/FormField'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/button'
import { useRegister } from '@/features/auth/api'
import { safeRedirect, validateEmail, validateName, validatePassword } from '@/features/auth/utils'
import { ApiError } from '@/lib/api'

export const Route = createFileRoute('/register')({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === 'string' ? s.redirect : undefined,
  }),
  component: RegisterPage,
})

function RegisterPage() {
  const { redirect } = Route.useSearch()
  const router = useRouter()
  const register = useRegister()
  const [errors, setErrors] = useState<Record<string, string>>({})

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    const next: Record<string, string> = {}
    const nameError = validateName(name)
    if (nameError) next.name = nameError
    const emailError = validateEmail(email)
    if (emailError) next.email = emailError
    const passwordError = validatePassword(password)
    if (passwordError) next.password = passwordError
    setErrors(next)
    if (Object.keys(next).length) return

    register.mutate(
      { name, email, password },
      { onSuccess: () => router.history.push(safeRedirect(redirect)) },
    )
  }

  const apiError = register.error instanceof ApiError ? register.error : null
  const fieldErrors = { ...errors, ...apiError?.fieldErrors } // inclui "e-mail já cadastrado" vindo da API

  return (
    <Container className="py-12">
      <div className="mx-auto max-w-md rounded-md bg-card p-6">
        <h1 className="text-xl font-bold">Criar conta</h1>

        {apiError && !apiError.fieldErrors && (
          <p role="alert" className="mt-3 text-xs text-primary">
            Erro: {apiError.message}
          </p>
        )}

        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
          <FormField label="Nome" name="name" autoComplete="name" error={fieldErrors.name} />
          <FormField label="E-mail" name="email" type="email" autoComplete="email" error={fieldErrors.email} />
          <FormField
            label="Senha"
            name="password"
            type="password"
            autoComplete="new-password"
            error={fieldErrors.password}
          />
          <Button type="submit" disabled={register.isPending} className="w-full">
            {register.isPending ? 'Criando...' : 'Criar conta'}
          </Button>
        </form>

        <p className="mt-4 text-xs">
          Já tem conta?{' '}
          <Link to="/login" search={{ redirect }} className="underline">
            Entrar
          </Link>
        </p>
      </div>
    </Container>
  )
}
import { Link, useRouter } from '@tanstack/react-router'
import { buttonVariants } from '@/components/ui/button'
import { useLogout, useSession } from '@/features/auth/api'

export function AccountMenu() {
  const { data: user } = useSession()
  const logout = useLogout()
  const router = useRouter()

  if (!user) {
    return (
      <Link to="/login" className={buttonVariants({ size: 'sm' })}>
        Entrar
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <Link to="/profile" className="font-bold">
        {user.name}
      </Link>
      <button
        type="button"
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSettled: () => router.navigate({ to: '/' }) })}
        className="underline"
      >
        Sair
      </button>
    </div>
  )
}
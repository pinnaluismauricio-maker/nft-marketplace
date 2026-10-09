import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/features/auth/guard'

export const Route = createFileRoute('/wallets')({
  beforeLoad: requireAuth,
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/wallets"!</div>
}

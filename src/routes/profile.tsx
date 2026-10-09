import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/features/auth/guard'

export const Route = createFileRoute('/profile')({
  beforeLoad: requireAuth,
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/profile"!</div>
}

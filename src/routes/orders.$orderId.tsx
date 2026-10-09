import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/features/auth/guard'

export const Route = createFileRoute('/orders/$orderId')({
  beforeLoad: requireAuth,
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/orders/$orderId"!</div>
}

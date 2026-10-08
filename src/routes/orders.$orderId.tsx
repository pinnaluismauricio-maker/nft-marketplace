import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/orders/$orderId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/orders/$orderId"!</div>
}

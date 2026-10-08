import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/wallets')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/wallets"!</div>
}

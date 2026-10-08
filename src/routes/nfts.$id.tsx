import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/nfts/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/nfts/$id"!</div>
}

import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { sessionQuery } from './api'

export async function requireAuth({
  context,
  location,
}: {
  context: { queryClient: QueryClient }
  location: { href: string }
}) {
  const user = await context.queryClient.ensureQueryData(sessionQuery)
  if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
}
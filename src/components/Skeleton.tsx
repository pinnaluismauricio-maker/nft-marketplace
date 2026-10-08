import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('shimmer rounded-sm bg-surface-dark', className)} />
}
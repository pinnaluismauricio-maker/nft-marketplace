import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-[120px]', className)}>
      {children}
    </div>
  )
}
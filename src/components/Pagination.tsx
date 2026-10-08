import { cn } from '@/lib/utils'

interface Props {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

const BASE =
  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

export function Pagination({ page, totalPages, onChange }: Props) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  return (
    <nav aria-label="Paginação" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={cn(BASE, 'bg-card disabled:opacity-50')}
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-label={`Página ${p}`}
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onChange(p)}
          className={cn(BASE, p === page ? 'bg-primary text-primary-foreground' : 'bg-card')}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        aria-label="Próxima página"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={cn(BASE, 'bg-card disabled:opacity-50')}
      >
        ›
      </button>
    </nav>
  )
}
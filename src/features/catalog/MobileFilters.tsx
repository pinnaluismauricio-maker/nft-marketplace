import { useRef, type ReactNode } from 'react'

export function MobileFilters({ children, activeCount }: { children: ReactNode; activeCount: number }) {
  const ref = useRef<HTMLDialogElement>(null)

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-md border border-primary px-3 py-2 text-xs font-bold"
      >
        Filtros{activeCount ? ` (${activeCount})` : ''}
      </button>

      <dialog
        ref={ref}
        aria-label="Filtros"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close() // clique no fundo escuro fecha
        }}
        className="m-0 ml-auto h-full max-h-none w-[min(22rem,100%)] overflow-y-auto bg-background p-4 text-foreground backdrop:bg-black/60"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold">Filtros</h2>
          <button type="button" onClick={() => ref.current?.close()} className="text-xs underline">
            Fechar
          </button>
        </div>
        {children}
      </dialog>
    </div>
  )
}
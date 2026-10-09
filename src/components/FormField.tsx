import { useId, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'

interface Props extends Omit<ComponentProps<'input'>, 'id'> {
  label: string
  error?: string
}

export function FormField({ label, error, ...props }: Props) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-bold">
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className="h-10 border-primary/30 bg-background"
        {...props}
      />
      {error && (
        <p id={errorId} className="text-xs text-primary">
          Erro: {error}
        </p>
      )}
    </div>
  )
}
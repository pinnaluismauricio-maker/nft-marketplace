import type { DomainEvent } from '../types/api'

/**
 * Barramento interno dos mocks. Toda mudança nos dados simulados (preço, estoque, pedido)
 * publica um DomainEvent aqui. Na etapa do Socket.IO, o servidor simulado assina este barramento
 * e repassa cada evento ao cliente pelo protocolo Socket.IO, então REST e eventos nunca divergem.
 *
 * Importante: o código da interface NUNCA importa este arquivo. Só a camada de mocks usa.
 */
type Listener = (event: DomainEvent) => void

const listeners = new Set<Listener>()

export const mockBus = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  emit(event: DomainEvent): void {
    for (const listener of [...listeners]) listener(event)
  },
}

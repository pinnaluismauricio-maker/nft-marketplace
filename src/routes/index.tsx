import { createFileRoute } from '@tanstack/react-router'
import { Container } from '@/components/layout/Container'
import { useNfts } from '@/features/catalog/api'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { data, isPending, isError, error, refetch } = useNfts({ page: 1 })
  return (
    <Container>
      <h1 className="text-display font-bold">Início</h1>
      {isPending && <p>Carregando...</p>}
      {isError && (
        <p role="alert">
          {error.message} <button onClick={() => refetch()}>Tentar de novo</button>
        </p>
      )}
      {data && (
        <ul>
          {data.items.map((n) => (
            <li key={n.id}>{n.name}: {n.price} ETH</li>
          ))}
        </ul>
      )}
    </Container>
  )
}
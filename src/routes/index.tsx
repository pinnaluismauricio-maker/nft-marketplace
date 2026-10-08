import { createFileRoute } from '@tanstack/react-router'
import { Container } from '@/components/layout/Container'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <Container>
      <h1 className="text-display font-bold">Início</h1>
    </Container>
  )
}

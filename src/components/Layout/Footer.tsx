import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Container } from './Container'

const highlights = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]
const profileSoon = ['Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse']
const helpSoon = ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item']
const collections = ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade']

function Soon({ children }: { children: string }) {
  return <span aria-disabled="true" title="Em breve" className="text-foreground/60">{children}</span>
}

function Newsletter() {
  const [notice, setNotice] = useState('')
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setNotice('Newsletter indisponível nesta demonstração.') }}
      className="space-y-2"
    >
      <h2 className="text-sm font-bold">Antecipe-se ao próximo lançamento</h2>
      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">E-mail</label>
        <Input id="newsletter-email" type="email" placeholder="digite seu e-mail..." />
        <button type="submit" className={buttonVariants()}>Enviar</button>
      </div>
      <p className="text-xs text-muted-foreground">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
      <p role="status" className="text-xs">{notice}</p>
    </form>
  )
}

export function Footer() {
  return (
    <footer className="mt-24">
      <section className="bg-card py-8">
        <Container className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {highlights.map((h) => (
            <div key={h.title} className="space-y-2 xl:border-r xl:border-primary/30 xl:pr-6">
              <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{h.letter}</span>
              <h2 className="text-sm font-bold">{h.title}</h2>
              <p className="text-xs text-muted-foreground">{h.text}</p>
            </div>
          ))}
          <Newsletter />
        </Container>
      </section>

      <section className="bg-surface-dark py-4">
        <Container className="grid gap-2 text-xs md:grid-cols-4">
          <strong>KURIO</strong>
          <p>Feito para colecionadores, criadores e cultura</p>
          <p>contato@email.com</p>
          <p>+55 11 4002 8922</p>
        </Container>
      </section>

      <section className="bg-card py-8">
        <Container className="grid gap-8 text-xs md:grid-cols-2 xl:grid-cols-4">
          <nav aria-label="Meu perfil">
            <h2 className="mb-3 text-sm font-bold">Meu perfil</h2>
            <ul className="space-y-2">
              <li><Link to="/profile">Meu perfil</Link></li>
              {profileSoon.map((t) => <li key={t}><Soon>{t}</Soon></li>)}
            </ul>
          </nav>
          <nav aria-label="Central de ajuda">
            <h2 className="mb-3 text-sm font-bold">Central de ajuda</h2>
            <ul className="space-y-2">{helpSoon.map((t) => <li key={t}><Soon>{t}</Soon></li>)}</ul>
          </nav>
          <nav aria-label="Coleções">
            <h2 className="mb-3 text-sm font-bold">Coleções</h2>
            <ul className="space-y-2">{collections.map((t) => <li key={t}>{t}</li>)}</ul>
          </nav>
          <div>
            
          </div>
        </Container>
      </section>

      <p className="py-3 text-center text-xs">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
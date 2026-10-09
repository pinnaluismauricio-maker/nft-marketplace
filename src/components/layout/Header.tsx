
import { Link } from '@tanstack/react-router'
import { Search, ShoppingCart } from 'lucide-react'
import { Container } from './Container'
import { AccountMenu } from './AccountMenu'

export function Header() {
  return (
    <header className="py-4 sm:py-6">
      <Container className="flex flex-wrap items-center justify-between gap-x-4 gap-y-5">
        <Link to="/" className="text-xs font-bold tracking-widest">
          KURIO
        </Link>

        <nav
          aria-label="Principal"
          className="order-3 w-full md:order-none md:w-auto"
        >
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs sm:gap-x-8 sm:text-sm">
            <li>
              <Link
                to="/"
                activeOptions={{ exact: true }}
                activeProps={{ className: 'border-b-2 border-primary' }}
                className="pb-2"
              >
                Início
              </Link>
            </li>
            <li>
              <Link to="/" hash="catalogo" className="pb-2">
                Mercado
              </Link>
            </li>
            <li>
              <span
                aria-disabled="true"
                title="Em breve"
                className="pb-2 text-foreground/60"
              >
                Criadores
              </span>
            </li>
            <li>
              <span
                aria-disabled="true"
                title="Em breve"
                className="pb-2 text-foreground/60"
              >
                Aprende
              </span>
            </li>
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <button type="button" aria-label="Buscar">
            <Search size={18} />
          </button>
          <Link to="/cart" aria-label="Carrinho, 0 itens">
            <ShoppingCart size={18} />
          </Link>
          <AccountMenu />
        </div>
      </Container>
    </header>
  )
}

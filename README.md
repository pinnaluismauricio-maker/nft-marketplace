# NFT Marketplace

Marketplace de NFTs desenvolvido com React e TypeScript, com foco em uma experiência de compra completa, gerenciamento de estado, comunicação com API REST e atualização de dados em tempo real.

**Aplicação publicada:** https://nft-marketplace-dun-delta.vercel.app/

## Funcionalidades

- Catálogo de NFTs com navegação e visualização de detalhes.
- Busca, filtros, ordenação e paginação do catálogo.
- Carrinho com gerenciamento de itens e quantidades.
- Autenticação com telas de login e cadastro.
- Perfil e gerenciamento de carteiras.
- Checkout com cotação, validação de carteira e criação de pedido.
- Tela de confirmação e consulta de pedidos.
- Cupons de desconto, incluindo validação de cupons expirados.
- Atualização de dados em tempo real por eventos Socket.IO.
- Interface responsiva.
- Testes automatizados de ponta a ponta com Playwright.

## Tecnologias utilizadas

- **React + TypeScript:** construção da interface e tipagem.
- **Vite:** desenvolvimento e build de produção.
- **TanStack Router:** gerenciamento de rotas.
- **TanStack Query:** gerenciamento de estado assíncrono e cache.
- **Axios:** comunicação com a API REST.
- **Tailwind CSS:** estilização da interface.
- **shadcn/ui:** componentes de interface.
- **MSW:** simulação de requisições e respostas da API.
- **Socket.IO Client:** comunicação em tempo real.
- **Playwright:** testes automatizados E2E.

## Requisitos

- Node.js e npm instalados.
- Git instalado para clonar o repositório.

## Como executar o projeto

### 1. Clonar o repositório

```bash
git clone https://github.com/pinnaluismauricio-maker/nft-marketplace.git
cd nft-marketplace
```

### 2. Instalar as dependências

```bash
npm install
```

### 3. Iniciar a aplicação

```bash
npm run dev
```

O Vite exibirá no terminal o endereço local para acessar a aplicação.

### 4. Iniciar o servidor Socket.IO

Em outro terminal, na raiz do projeto, execute:

```bash
npm run socket:server
```

O servidor local de eventos utiliza a porta `3001`.

### 5. Executar os testes E2E

Com as dependências instaladas e os navegadores do Playwright configurados:

```bash
npx playwright test --workers=1
```

Para executar os testes com a interface do Playwright:

```bash
npx playwright test --ui
```

## Validação do projeto

### Verificação de código

```bash
npm run lint
```

### Build de produção

```bash
npm run build
```

Os arquivos gerados para produção ficam na pasta `dist/`.

## Arquitetura

O projeto organiza suas funcionalidades por rotas e módulos, separando componentes de interface, comunicação com a API, tipos e dados simulados.

- `src/routes/`: páginas e definições de rotas.
- `src/features/`: funcionalidades organizadas por domínio.
- `src/components/`: componentes reutilizáveis.
- `src/lib/`: utilitários e configuração de comunicação.
- `src/mocks/`: dados e infraestrutura de simulação.
- `src/types/`: tipos da aplicação e da API.
- `scripts/mock-socket-server.mjs`: servidor local de eventos Socket.IO.
- `tests/`: testes automatizados.
- `playwright.config.ts`: configuração do Playwright.
- `ARCHITECTURE.md`: documentação complementar da arquitetura.

## API simulada e eventos em tempo real

O projeto utiliza mocks para simular respostas da API e permitir testar os principais fluxos sem depender de um backend real.

O Socket.IO recebe eventos de domínio, como `nft.updated` e `order.updated`, para atualizar os dados relevantes da aplicação. O tratamento dos eventos considera versões dos recursos e a sessão do usuário para reduzir o risco de processar atualizações duplicadas, antigas ou destinadas a outra sessão.

Para executar os eventos localmente, mantenha o servidor Socket.IO em execução. Em produção, é necessário disponibilizar um servidor Socket.IO acessível e configurar a variável `VITE_SOCKET_URL` com seu endereço.

**Observação:** a aplicação utiliza serviços simulados para desenvolvimento e demonstração. Isso não representa uma integração com blockchain ou processamento real de pagamentos.

## Deploy

A aplicação frontend está publicada na Vercel:

https://nft-marketplace-dun-delta.vercel.app/

O deploy do frontend não hospeda automaticamente o servidor Socket.IO local. A funcionalidade de eventos em tempo real em produção depende de uma infraestrutura de servidor configurada separadamente.

## Objetivo

Este projeto foi desenvolvido como desafio técnico de Front-End, com o objetivo de demonstrar organização de código, uso de ferramentas modernas do ecossistema React, integração com API, gerenciamento de estado, testes automatizados e construção de fluxos completos de uma aplicação web.
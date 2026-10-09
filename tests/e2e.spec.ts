import { test, expect } from '@playwright/test'

test('a página inicial apresenta o catálogo de NFTs', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('#catalogo')).toBeVisible()
})

test('o login valida a senha vazia', async ({ page }) => {
  await page.goto('/login')

  await expect(
    page.getByRole('heading', { name: 'Entrar' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByText('Informe a senha')).toBeVisible()
})
  test('adiciona um NFT ao carrinho e permite removê-lo', async ({ page }) => {
  await page.goto('/')

  // Restaura os dados de teste para um estado previsível.
  await page.waitForFunction(() => Boolean(window.__kurioMocks))
  await page.evaluate(() => window.__kurioMocks!.reset('default'))

  // Abre o primeiro NFT disponível no catálogo.
  await page.goto('/nfts/nft-001')

  await expect(
    page.getByRole('heading', { name: /Emerald Ape/i }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()

  await expect(page.getByText('NFT adicionado ao carrinho!')).toBeVisible()

  await page.getByRole('link', { name: 'Ir para o carrinho' }).click()

  await expect(
    page.getByRole('heading', { name: 'Meu carrinho' }),
  ).toBeVisible()

  await expect(
    page.getByRole('heading', { name: /Emerald Ape/i }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Remover' }).click()

  await expect(
    page.getByRole('heading', { name: 'Seu carrinho está vazio' }),
  ).toBeVisible()
})


test('um evento Socket.IO chega ao React', async ({ page }) => {
  const connected = page.waitForEvent('console', (message) =>
    message.text().includes('[Socket.IO] Conectado ao servidor'),
  )

  const receivedEvent = page.waitForEvent('console', (message) =>
    message.text().includes('[Socket.IO] Evento recebido pelo React:'),
  )

  await page.goto('/')
  await connected

  const response = await page.request.post(
    'http://localhost:3001/events',
    {
      data: {
        type: 'nft.updated',
        version: 100,
        resource: {
          kind: 'nft',
          id: 'playwright-socket-test',
        },
        payload: {
          nftId: 'playwright-socket-test',
        },
      },
    },
  )

  expect(response.status()).toBe(202)
  await receivedEvent
})


test('aplica o cupom de desconto KURIO10 no carrinho', async ({ page }) => {
  await page.goto('/')

  // Restaura os dados para deixar o teste previsível.
  await page.waitForFunction(() => Boolean(window.__kurioMocks))
  await page.evaluate(() => window.__kurioMocks!.reset('default'))

  // Adiciona um NFT ao carrinho.
  await page.goto('/nfts/nft-001')

  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()

  await expect(page.getByText('NFT adicionado ao carrinho!')).toBeVisible()

  // Abre o carrinho.
  await page.getByRole('link', { name: 'Ir para o carrinho' }).click()

  await expect(
    page.getByRole('heading', { name: 'Meu carrinho' }),
  ).toBeVisible()

  // Aplica o cupom de 10%.
  await page.getByLabel('Cupom de desconto').fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar' }).click()

  // Confirma que o desconto foi apresentado na tela.
  await expect(page.getByText(/10%/)).toBeVisible()
})
 

test('informa erro ao aplicar um cupom expirado', async ({ page }) => {
  await page.goto('/')

  await page.waitForFunction(() => Boolean(window.__kurioMocks))
  await page.evaluate(() => window.__kurioMocks!.reset('default'))

  // Adiciona um NFT ao carrinho.
  await page.goto('/nfts/nft-001')

  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()

  await expect(page.getByText('NFT adicionado ao carrinho!')).toBeVisible()

  // Acessa o carrinho.
  await page.getByRole('link', { name: 'Ir para o carrinho' }).click()

  await expect(
    page.getByRole('heading', { name: 'Meu carrinho' }),
  ).toBeVisible()

  // Tenta aplicar o cupom expirado.
  await page.getByLabel('Cupom de desconto').fill('EXPIRED20')
  await page.getByRole('button', { name: 'Aplicar' }).click()

  // Verifica a mensagem de erro.
  await expect(page.getByText('Este cupom expirou.')).toBeVisible()
})


test('aumenta a quantidade de um NFT no carrinho', async ({ page }) => {
  await page.goto('/')

  await page.waitForFunction(() => Boolean(window.__kurioMocks))
  await page.evaluate(() => window.__kurioMocks!.reset('default'))

  // Adiciona o NFT ao carrinho.
  await page.goto('/nfts/nft-001')

  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()

  await expect(page.getByText('NFT adicionado ao carrinho!')).toBeVisible()

  await page.getByRole('link', { name: 'Ir para o carrinho' }).click()

  await expect(
    page.getByRole('heading', { name: 'Meu carrinho' }),
  ).toBeVisible()

  // Aumenta a quantidade do NFT.
  await page.getByRole('button', {
    name: 'Aumentar quantidade de Emerald Ape #042',
  }).click()

  // Confirma que a quantidade foi atualizada para 2.
  await expect(
    page.getByRole('button', {
      name: 'Diminuir quantidade de Emerald Ape #042',
    }),
  ).toBeVisible()

  await expect(page.getByText('2', { exact: true })).toBeVisible()
})



test('recalcula o total do item ao aumentar a quantidade no carrinho', async ({ page }) => {
  await page.goto('/')

  // Reseta os mocks para iniciar com o estado padrão.
  await page.waitForFunction(() => Boolean(window.__kurioMocks))
  await page.evaluate(() => window.__kurioMocks!.reset('default'))

  // Abre a página do NFT.
  await page.goto('/nfts/nft-001')

  // Adiciona o NFT ao carrinho.
  await page.getByRole('button', {
    name: /Adicionar ao carrinho/i,
  }).click()

  await expect(
    page.getByText('NFT adicionado ao carrinho!'),
  ).toBeVisible()

  // Acessa o carrinho.
  await page.getByRole('link', {
    name: /Ir para o carrinho/i,
  }).click()

  await expect(
    page.getByRole('heading', { name: 'Meu carrinho' }),
  ).toBeVisible()

  const itensCarrinho = page.getByRole('region', {
    name: 'Itens do carrinho',
  })

  // Confirma o total inicial: 1 NFT = 1.19 ETH.
  await expect(
    itensCarrinho.getByText('1.19 ETH', { exact: true }),
  ).toBeVisible()

  // Aumenta a quantidade para 2.
  await page.getByRole('button', {
    name: /Aumentar quantidade de Emerald Ape #042/i,
  }).click()

  // Confirma que a quantidade foi atualizada.
  await expect(itensCarrinho.getByText('2', { exact: true })).toBeVisible()

  // Confirma o novo total: 2 NFTs = 2.38 ETH.
  await expect(
    itensCarrinho.getByText('2.38 ETH', { exact: true }),
  ).toBeVisible()
})

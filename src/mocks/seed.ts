import { percentEth } from '../lib/eth'
import { COLLECTIONS, NETWORKS, type Edition, type Nft } from '../types/api'
import { fakeHex, recomputeDerived } from './domain'
import type { DbState, UserRecord, WalletRecord } from './records'

/**
 * Dados iniciais 100% determinísticos (sem Math.random): mesmo seed => mesmos NFTs, ids e preços.
 *
 * Imagens: exporte do Figma as 4 artes e salve em public/nfts/art-01.png ... art-04.png
 *   art-01 = macaco de óculos e jaqueta verde (Emerald Ape)
 *   art-02 = gorila de chapéu e moletom roxo (Sage Nomad, Cosmic Bloom, Violet Nomad)
 *   art-03 = gorila escuro de casaco bege (Neon Vessel, Ivory Baron)
 *   art-04 = macaco laranja com fones (Golden Beat, Golden Signal)
 */

/** Credenciais fictícias: ana@kurio.test / bruno@kurio.test, ambos com a senha Kurio@123 */
const USERS: UserRecord[] = [
  {
    id: 'user-ana',
    name: 'Ana Souza',
    email: 'ana@kurio.test',
    passwordHash: '406dfffd617f0ac5fe9dfc64bb1ca3e3ebb0fdf9348411c6aef1457e65b2e42d',
    avatarUrl: null,
    bio: 'Colecionadora de arte digital.',
    createdAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'user-bruno',
    name: 'Bruno Lima',
    email: 'bruno@kurio.test',
    passwordHash: '9d82261d2198662938c18cef58550c7397711ef12a960a57b9435eb477aa2e88',
    avatarUrl: null,
    bio: null,
    createdAt: '2026-08-02T10:00:00.000Z',
  },
]

const WALLETS: Record<string, WalletRecord[]> = {
  'user-ana': [
    {
      id: 'wallet-0001',
      label: 'Carteira principal',
      address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      network: 'ethereum',
      isPrimary: true,
      createdAt: '2026-08-01T10:05:00.000Z',
    },
    {
      id: 'wallet-0002',
      label: 'Polygon secundária',
      address: '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
      network: 'polygon',
      isPrimary: false,
      createdAt: '2026-08-01T10:06:00.000Z',
    },
  ],
  'user-bruno': [
    {
      id: 'wallet-0003',
      label: 'Carteira do Bruno',
      address: '0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB',
      network: 'ethereum',
      isPrimary: true,
      createdAt: '2026-08-02T10:05:00.000Z',
    },
  ],
}

const BASE_ARTS = [
  { name: 'Emerald Ape', art: 1, num: 42 },
  { name: 'Sage Nomad', art: 2, num: 9 },
  { name: 'Neon Vessel', art: 3, num: 552 },
  { name: 'Cosmic Bloom', art: 2, num: 118 },
  { name: 'Violet Nomad', art: 2, num: 314 },
  { name: 'Ivory Baron', art: 3, num: 88 },
  { name: 'Golden Beat', art: 4, num: 287 },
  { name: 'Golden Signal', art: 4, num: 169 },
]

const PRICES = [
  '1.19', '1.69', '1.99', '1.29', '1.39', '1.79', '0.99', '0.39', '0.02', '2.40', '3.15', '0.75',
  '4.20', '0.55', '5.80', '1.05', '0.09', '2.95', '12.30', '0.65', '1.49', '0.45', '6.75', '2.10',
  '0.15', '3.60', '0.85', '1.25', '8.40', '0.35', '2.75', '1.59', '0.25', '4.90', '0.12', '1.89',
]

const CREATORS = ['Marina Voss', 'Kenji Arai', 'Lia Contreras', 'Otto Brandt', 'Sana Okoye', 'Davi Moraes']
const BACKGROUNDS = ['Sálvia', 'Marfim', 'Néon', 'Ouro']
const OUTFITS = ['Jaqueta verde', 'Moletom roxo', 'Casaco bege', 'Fones dourados']

/** Rótulos provisórios das edições: ajuste conforme o seletor "Edição" do Figma. */
const EDITION_SPECS = [
  { key: '100', label: '1/100', supply: 100, bps: 10_000 },
  { key: '10', label: '1/10', supply: 10, bps: 15_000 },
  { key: '1', label: '1/1', supply: 1, bps: 25_000 },
]

function buildNfts(): Nft[] {
  return PRICES.map((base, i) => {
    const spec = BASE_ARTS[i % BASE_ARTS.length]
    const num = i < BASE_ARTS.length ? spec.num : ((i * 97 + 13) % 900) + 100
    const id = `nft-${String(i + 1).padStart(3, '0')}`
    const collection = COLLECTIONS[i % COLLECTIONS.length]
    const network = NETWORKS[(i + Math.floor(i / 3)) % NETWORKS.length]
    const art = spec.art
    const soldOutAll = i === 10 // NFT totalmente esgotado, útil para testes
    const availability = [20 + ((i * 13) % 70), (i * 3) % 9, i % 4 === 0 ? 0 : 1]

    const editions: Edition[] = EDITION_SPECS.map((e, k) => ({
      id: `${id}-ed-${e.key}`,
      label: e.label,
      supply: e.supply,
      available: soldOutAll ? 0 : Math.min(availability[k], e.supply),
      price: percentEth(base, e.bps),
    }))

    const gallery = [art, (art % 4) + 1, ((art + 1) % 4) + 1, ((art + 2) % 4) + 1].map(
      (n) => `/nfts/art-0${n}.png`,
    )
    const rarity = i % 7 === 0 ? 'Lendária' : i % 3 === 0 ? 'Rara' : 'Comum'
    const nft: Nft = {
      id,
      name: `${spec.name} #${String(num).padStart(3, '0')}`,
      image: gallery[0],
      images: gallery,
      price: base,
      previousPrice: i % 5 === 2 ? percentEth(base, 11_500) : null,
      collection,
      network,
      creator: { name: CREATORS[i % CREATORS.length] },
      soldOut: false,
      version: 1,
      description:
        `${spec.name} é uma obra digital limitada da coleção ${collection.replace('-', ' ')}. ` +
        'Cada edição é verificada e vem com registro de procedência simulado para esta demonstração.',
      attributes: [
        { trait: 'Fundo', value: BACKGROUNDS[art - 1] },
        { trait: 'Estilo', value: OUTFITS[art - 1] },
        { trait: 'Raridade', value: rarity },
      ],
      editions,
      maxPerOrder: 5,
      rating: { average: Number((3.8 + (i % 12) / 10).toFixed(1)), count: 8 + ((i * 7) % 40) },
      listedAt: new Date(Date.UTC(2026, 7, 1) + i * 36 * 3600 * 1000).toISOString(),
      trending: i % 4 === 1,
      isNew: i >= 28,
      contract: `0x${fakeHex(`contract-${collection}`, 40)}`,
      tokenId: String(num),
      updatedAt: '2026-10-01T00:00:00.000Z',
    }
    recomputeDerived(nft)
    return nft
  })
}

export function buildSeed(): DbState {
  return {
    users: structuredClone(USERS),
    sessions: {},
    nfts: buildNfts(),
    favorites: { 'user-ana': ['nft-001', 'nft-004'], 'user-bruno': [] },
    carts: {},
    wallets: structuredClone(WALLETS),
    walletConnections: {},
    quotes: {},
    orders: [],
    idempotency: {},
    counters: { user: 2, item: 0, quote: 0, order: 0, event: 0, wallet: 3 },
  }
}

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { NftListResponse, NftSort, NftTab } from '@/types/api'

export interface NftListParams {
  q?: string
  collection?: string // "arte-digital,musica"
  network?: string
  minPrice?: string
  maxPrice?: string
  tab?: NftTab
  sort?: NftSort
  page?: number
  pageSize?: number
}

export function useNfts(params: NftListParams) {
  return useQuery({
    queryKey: ['nfts', 'list', params],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<NftListResponse>('/nfts', { params, signal })
      return data
    },
    placeholderData: keepPreviousData, // ao mudar de página, mostra a anterior enquanto carrega
  })
}
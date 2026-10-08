import axios from 'axios'
import type { ApiErrorBody, ErrorCode } from '@/types/api'
import { getGuestId, getToken } from './session'

export class ApiError extends Error {
  status: number
  code: ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT'
  fieldErrors?: Record<string, string>
  details?: unknown

  constructor(init: {
    message: string
    status: number
    code: ApiError['code']
    fieldErrors?: Record<string, string>
    details?: unknown
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors
    this.details = init.details
  }
}

export const api = axios.create({ baseURL: '/api', timeout: 8000 })

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Guest-Id', getGuestId())
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError<ApiErrorBody>(error)) throw error
    if (axios.isCancel(error)) throw error // requisição cancelada de propósito: não é falha

    const body = error.response?.data?.error
    if (body) {
      throw new ApiError({
        message: body.message,
        status: error.response!.status,
        code: body.code,
        fieldErrors: body.fieldErrors,
        details: body.details,
      })
    }
    if (error.code === 'ECONNABORTED') {
      throw new ApiError({ message: 'A requisição demorou demais.', status: 0, code: 'TIMEOUT' })
    }
    throw new ApiError({ message: 'Sem conexão com o servidor.', status: 0, code: 'NETWORK_ERROR' })
  },
)
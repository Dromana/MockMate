import { HttpMethod } from '@/types'

export const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
]

export const COMMON_STATUS_CODES = [200, 201, 204, 400, 401, 403, 404, 409, 422, 500, 502, 503]

export const STORAGE_KEYS = {
  RULES: 'mockmate_rules',
  GLOBAL_ENABLED: 'mockmate_global_enabled',
} as const

export const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  PATCH: 'bg-orange-100 text-orange-800',
  DELETE: 'bg-red-100 text-red-800',
  OPTIONS: 'bg-purple-100 text-purple-800',
  HEAD: 'bg-gray-100 text-gray-800',
}

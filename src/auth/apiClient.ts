import { tokenStorage } from './tokenStorage'
import type { ApiErrorBody, RefreshResponse } from './types'

const API_BASE_URL = 'http://127.0.0.1:8000/api'

export class ApiError extends Error {
  status: number
  body: ApiErrorBody | null

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.message ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** Thrown when the refresh token itself is invalid/expired — the user must sign in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired. Please sign in again.')
    this.name = 'SessionExpiredError'
  }
}

interface RequestOptions extends RequestInit {
  /** Attach `Authorization: Bearer <access_token>` and auto-refresh on a 401. Default true. */
  auth?: boolean
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function rawRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const { auth = true, headers, ...rest } = options
  const finalHeaders = new Headers(headers)
  finalHeaders.set('Accept', 'application/json')
  if (rest.body && !(rest.body instanceof FormData)) {
    finalHeaders.set('Content-Type', 'application/json')
  }
  if (auth) {
    const token = tokenStorage.getAccessToken()
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`)
  }
  return fetch(`${API_BASE_URL}${path}`, { ...rest, headers: finalHeaders })
}

// Concurrent 401s share a single in-flight refresh call instead of each firing their own.
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) throw new SessionExpiredError()

  const response = await rawRequest('/auth/refresh', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) {
    tokenStorage.clear()
    throw new SessionExpiredError()
  }

  const data = (await parseJsonBody(response)) as RefreshResponse
  tokenStorage.setTokens(data)
  return data.access_token
}

/** Low-level request helper: JSON in, JSON out, with auth header injection and one 401-triggered refresh+retry. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await rawRequest(path, options)

  if (response.status === 401 && options.auth !== false) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    await refreshPromise
    response = await rawRequest(path, options)
  }

  if (!response.ok) {
    const body = (await parseJsonBody(response)) as ApiErrorBody | null
    throw new ApiError(response.status, body)
  }

  return (await parseJsonBody(response)) as T
}

import { env } from '@/shared/config'

/*
 * Сессия — httpOnly-cookie `sid` от бэка, токенов в JS нет.
 * Для небезопасных методов бэк ждёт значение cookie csrf_token в заголовке X-CSRF-Token (API_DOCUMENTATION.md).
 */
const CSRF_COOKIE = 'csrf_token'
const CSRF_HEADER = 'X-CSRF-Token'
/** Кабинет роли в адресе: права запроса сервер сужает до этой роли */
const ACTIVE_ROLE_HEADER = 'X-Active-Role'
const ACTIVE_ROLE = /^\/cabinet\/(athlete|coach|judge|organizer|federation)(?:\/|$)/
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Проверьте введённые данные',
  401: 'Нужно войти в аккаунт',
  403: 'Недостаточно прав для этого действия',
  404: 'Не нашли то, что вы искали',
  409: 'Такая запись уже существует',
  413: 'Файл слишком большой',
  422: 'Проверьте введённые данные',
  429: 'Слишком много попыток, подождите немного',
}

/** Формат ошибки бэка: {"error": {"code", "message", "fields"}} — API_DOCUMENTATION.md */
interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string[]> | null }
}

export class ApiError extends Error {
  readonly status: number
  /** Машинный код: email_taken, invalid_credentials, csrf_failed… */
  readonly code: string | undefined
  /** Ошибки по полям формы: поле → сообщения (только у validation_error) */
  readonly fields: Record<string, string[]>
  readonly body: unknown
  /** Через сколько секунд можно повторить (429, заголовок Retry-After) */
  readonly retryAfter: number | undefined

  constructor(status: number, body: unknown, retryAfter?: number) {
    const error = (body as ErrorBody | undefined)?.error
    super(error?.message ?? STATUS_MESSAGES[status] ?? 'Что-то пошло не так. Попробуйте ещё раз')
    this.name = 'ApiError'
    this.status = status
    this.code = error?.code
    this.fields = error?.fields ?? {}
    this.body = body
    this.retryAfter = retryAfter
  }

  /** Первое сообщение по полю — для error у Field */
  field(name: string) {
    return this.fields[name]?.[0]
  }
}

let onUnauthorized: (() => void) | undefined

/** Что делать при 401 (обычно — на логин). Ставится один раз в app. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue | QueryValue[]>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Query
  /** Объект уходит как JSON, FormData — как есть (загрузка файлов) */
  body?: unknown
  signal?: AbortSignal
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${env.apiUrl}${path}`, window.location.origin)
  for (const [key, raw] of Object.entries(query ?? {})) {
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.append(key, String(value))
    }
  }
  return url
}

function readCookie(name: string) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

export async function request<T>(path: string, { method = 'GET', query, body, signal }: RequestOptions = {}) {
  const headers = new Headers({ Accept: 'application/json' })
  const cabinet = ACTIVE_ROLE.exec(window.location.pathname)
  if (cabinet) headers.set(ACTIVE_ROLE_HEADER, cabinet[1]!)
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers.set('Content-Type', 'application/json')
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE)
    if (csrf) headers.set(CSRF_HEADER, decodeURIComponent(csrf))
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    credentials: 'include',
    signal,
  })

  if (response.status === 401) onUnauthorized?.()

  const text = await response.text()
  const data: unknown = text ? safeJson(text) : undefined
  if (!response.ok) {
    const retryAfter = Number(response.headers.get('Retry-After')) || undefined
    throw new ApiError(response.status, data, retryAfter)
  }
  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Файл с бэка (PDF, xlsx) как Blob: ошибки приходят обычным ApiError, а не страницей с JSON */
export async function requestBlob(path: string, query?: Query, signal?: AbortSignal) {
  const response = await fetch(buildUrl(path, query), { credentials: 'include', signal })
  if (response.status === 401) onUnauthorized?.()
  if (!response.ok) {
    const text = await response.text()
    throw new ApiError(response.status, text ? safeJson(text) : undefined)
  }
  return response.blob()
}

/** Ссылка на файл с бэка (.xlsx, .pdf, .docx) — скачивание обычной навигацией, cookie уйдёт сама */
export const fileUrl = (path: string, query?: Query) => buildUrl(path, query).toString()

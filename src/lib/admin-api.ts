// ==================== ADMIN API ====================

// Types for admin API responses
export interface AdminStats {
  totalUsers: number
  todayGenerations: number
  activeSubscriptions: number
  totalGenerations: number
  uptimeSeconds: number
  serverStartedAt: string
}

export interface AdminUser {
  id: string
  email: string
  name: string | null
  image: string | null
  role: 'user' | 'admin'
  provider: string | null
  providerId: string | null
  generationsLeft: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  isBlocked: boolean
  generationsCount: number
  worksheetsCount: number
}

export interface AdminUserDetail extends AdminUser {
  subscription: {
    plan: 'free' | 'basic' | 'premium'
    status: 'active' | 'canceled' | 'expired' | 'trial'
    expiresAt: string | null
  }
}

export interface AdminGeneration {
  id: string
  userId: string
  userEmail: string | null
  userName: string | null
  subject: 'math' | 'algebra' | 'geometry' | 'russian'
  grade: number
  topic: string
  title: string | null
  difficulty: 'easy' | 'medium' | 'hard'
  createdAt: string
}

export interface AdminPayment {
  id: string
  userId: string
  userEmail: string | null
  userName: string | null
  amount: number
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  providerPaymentId: string | null
  createdAt: string
}

export interface AdminWorksheet {
  id: string
  subject: 'math' | 'algebra' | 'geometry' | 'russian'
  grade: number
  topic: string
  title: string | null
  createdAt: string
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ==================== STATS ====================

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch('/api/admin/stats', {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить статистику')
  }

  const data = await res.json()
  return data.stats
}

// ==================== USERS ====================

export interface FetchAdminUsersOptions {
  page?: number
  limit?: number
  search?: string
  status?: 'all' | 'active' | 'blocked'
  sortBy?: 'createdAt' | 'email' | 'name'
  sortOrder?: 'asc' | 'desc'
}

export interface FetchAdminUsersResponse {
  users: AdminUser[]
  pagination: Pagination
}

export async function fetchAdminUsers(options?: FetchAdminUsersOptions): Promise<FetchAdminUsersResponse> {
  const params = new URLSearchParams()

  if (options?.page) params.set('page', String(options.page))
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.search) params.set('search', options.search)
  if (options?.status) params.set('status', options.status)
  if (options?.sortBy) params.set('sortBy', options.sortBy)
  if (options?.sortOrder) params.set('sortOrder', options.sortOrder)

  const url = `/api/admin/users${params.toString() ? `?${params}` : ''}`

  const res = await fetch(url, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить список пользователей')
  }

  return res.json()
}

export interface FetchAdminUserDetailResponse {
  user: AdminUserDetail
  generations: AdminGeneration[]
  worksheets: AdminWorksheet[]
}

export async function fetchAdminUserDetail(userId: string): Promise<FetchAdminUserDetailResponse> {
  const res = await fetch(`/api/admin/users/${userId}`, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    if (res.status === 404) throw new Error('Пользователь не найден')
    throw new Error('Не удалось загрузить данные пользователя')
  }

  return res.json()
}

// ==================== BLOCK/UNBLOCK ====================

export async function blockUser(userId: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/block`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа')
    if (res.status === 404) throw new Error('Пользователь не найден')
    if (res.status === 400) {
      const error = await res.json()
      throw new Error(error.error || 'Ошибка блокировки')
    }
    throw new Error('Не удалось заблокировать пользователя')
  }
}

export async function unblockUser(userId: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/unblock`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа')
    if (res.status === 404) throw new Error('Пользователь не найден')
    if (res.status === 400) {
      const error = await res.json()
      throw new Error(error.error || 'Ошибка разблокировки')
    }
    throw new Error('Не удалось разблокировать пользователя')
  }
}

// ==================== GENERATIONS ====================

export type SubjectFilter = 'all' | 'math' | 'algebra' | 'geometry' | 'russian'

export interface FetchAdminGenerationsOptions {
  page?: number
  limit?: number
  subject?: SubjectFilter
  search?: string
}

export interface FetchAdminGenerationsResponse {
  generations: AdminGeneration[]
  pagination: Pagination
}

export async function fetchAdminGenerations(options?: FetchAdminGenerationsOptions): Promise<FetchAdminGenerationsResponse> {
  const params = new URLSearchParams()

  if (options?.page) params.set('page', String(options.page))
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.subject) params.set('subject', options.subject)
  if (options?.search) params.set('search', options.search)

  const url = `/api/admin/generations${params.toString() ? `?${params}` : ''}`

  const res = await fetch(url, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить список генераций')
  }

  return res.json()
}

// ==================== GENERATION ERROR LOGS ====================

export interface GenerationLog {
  id: string
  userId: string
  userEmail: string | null
  userName: string | null
  subject: 'math' | 'algebra' | 'geometry' | 'russian' | null
  grade: number | null
  topic: string | null
  errorMessage: string | null
  createdAt: string
}

export interface FetchGenerationLogsOptions {
  page?: number
  limit?: number
  search?: string
}

export interface FetchGenerationLogsResponse {
  logs: GenerationLog[]
  pagination: Pagination
}

export async function fetchGenerationLogs(options?: FetchGenerationLogsOptions): Promise<FetchGenerationLogsResponse> {
  const params = new URLSearchParams()

  if (options?.page) params.set('page', String(options.page))
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.search) params.set('search', options.search)

  const url = `/api/admin/generation-logs${params.toString() ? `?${params}` : ''}`

  const res = await fetch(url, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить логи генераций')
  }

  return res.json()
}

// ==================== PAYMENTS ====================

export type PaymentStatusFilter = 'all' | 'pending' | 'succeeded' | 'failed' | 'refunded'

export interface FetchAdminPaymentsOptions {
  page?: number
  limit?: number
  status?: PaymentStatusFilter
  search?: string
}

export interface FetchAdminPaymentsResponse {
  payments: AdminPayment[]
  pagination: Pagination
}

export async function fetchAdminPayments(options?: FetchAdminPaymentsOptions): Promise<FetchAdminPaymentsResponse> {
  const params = new URLSearchParams()

  if (options?.page) params.set('page', String(options.page))
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.status) params.set('status', options.status)
  if (options?.search) params.set('search', options.search)

  const url = `/api/admin/payments${params.toString() ? `?${params}` : ''}`

  const res = await fetch(url, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить список платежей')
  }

  return res.json()
}

// ==================== STUCK GENERATIONS ====================

export interface StuckGeneration {
  id: string
  userId: string
  userEmail: string | null
  userName: string | null
  subject: 'math' | 'algebra' | 'geometry' | 'russian' | null
  grade: number | null
  topic: string | null
  startedAt: string | null
  createdAt: string
}

export async function fetchStuckGenerations(): Promise<{ stuckGenerations: StuckGeneration[] }> {
  const res = await fetch('/api/admin/stuck-generations', {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить зависшие генерации')
  }

  return res.json()
}

export async function forceFailGeneration(id: string, refund: boolean = true): Promise<{ success: boolean; refunded: boolean }> {
  const res = await fetch(`/api/admin/stuck-generations/${id}/force-fail`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refund }),
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа')
    if (res.status === 404) throw new Error('Генерация не найдена')
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || data.message || 'Не удалось завершить генерацию')
  }

  return res.json()
}

// ==================== PAYMENT INTENTS ====================

export type PaymentIntentStatusFilter = 'all' | 'created' | 'paid' | 'failed' | 'expired'

export interface AdminPaymentIntent {
  id: string
  userId: string
  userEmail: string | null
  userName: string | null
  productCode: string
  amount: number
  currency: string
  status: 'created' | 'paid' | 'failed' | 'expired'
  provider: string
  providerOrderId: string
  providerPaymentId: string | null
  createdAt: string
  paidAt: string | null
  expiresAt: string | null
}

export interface FetchPaymentIntentsOptions {
  page?: number
  limit?: number
  status?: PaymentIntentStatusFilter
  search?: string
}

export interface FetchPaymentIntentsResponse {
  paymentIntents: AdminPaymentIntent[]
  pagination: Pagination
}

export async function fetchPaymentIntents(options?: FetchPaymentIntentsOptions): Promise<FetchPaymentIntentsResponse> {
  const params = new URLSearchParams()

  if (options?.page) params.set('page', String(options.page))
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.status) params.set('status', options.status)
  if (options?.search) params.set('search', options.search)

  const url = `/api/admin/payment-intents${params.toString() ? `?${params}` : ''}`

  const res = await fetch(url, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить платежные интенты')
  }

  return res.json()
}

export async function applyPaymentIntent(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/admin/payment-intents/${id}/apply`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа')
    if (res.status === 404) throw new Error('Платежный интент не найден')
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || data.message || 'Не удалось применить оплату')
  }

  return res.json()
}

// ==================== WEBHOOK EVENTS ====================

export interface AdminWebhookEvent {
  id: string
  provider: string
  eventKey: string
  rawPayloadHash: string
  processedAt: string
  createdAt: string
}

export interface FetchWebhookEventsOptions {
  page?: number
  limit?: number
  provider?: string
}

export interface FetchWebhookEventsResponse {
  webhookEvents: AdminWebhookEvent[]
  pagination: Pagination
}

export async function fetchWebhookEvents(options?: FetchWebhookEventsOptions): Promise<FetchWebhookEventsResponse> {
  const params = new URLSearchParams()

  if (options?.page) params.set('page', String(options.page))
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.provider) params.set('provider', options.provider)

  const url = `/api/admin/webhook-events${params.toString() ? `?${params}` : ''}`

  const res = await fetch(url, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить вебхук-события')
  }

  return res.json()
}

// ==================== TRENDS ====================

export interface TrendPoint {
  date: string
  count: number
}

export interface RevenueTrendPoint {
  date: string
  revenue: number
  transactions: number
}

export async function fetchSubscriberTrend(days: number = 30): Promise<{ trend: TrendPoint[] }> {
  const res = await fetch(`/api/admin/stats/subscriber-trend?days=${days}`, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить тренд подписчиков')
  }

  return res.json()
}

export async function fetchRevenueTrend(days: number = 30): Promise<{ trend: RevenueTrendPoint[] }> {
  const res = await fetch(`/api/admin/stats/revenue-trend?days=${days}`, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить тренд выручки')
  }

  return res.json()
}

// ==================== SETTINGS ====================

export interface AdminSettings {
  telegramChatId: string | null
  wantsAlerts: boolean
}

export async function fetchAdminSettings(): Promise<AdminSettings> {
  const res = await fetch('/api/admin/settings', {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить настройки')
  }

  return res.json()
}

export async function updateTelegramChatId(chatId: string): Promise<AdminSettings> {
  const res = await fetch('/api/admin/settings/telegram', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Не удалось сохранить Chat ID')
  }

  return res.json()
}

export async function removeTelegramChatId(): Promise<AdminSettings> {
  const res = await fetch('/api/admin/settings/telegram', {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!res.ok) {
    throw new Error('Не удалось отключить Telegram')
  }

  return res.json()
}

export async function sendTestAlert(message?: string): Promise<{ success: boolean; sentCount: number; message: string }> {
  const res = await fetch('/api/admin/test-alert', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level: 'info', message }),
  })

  if (!res.ok) {
    throw new Error('Не удалось отправить тестовый алерт')
  }

  return res.json()
}

// ==================== AI COSTS ====================

export interface AICostsByModel {
  model: string
  costRubles: number
  calls: number
  promptTokens: number
  completionTokens: number
}

export interface AICostsByCallType {
  callType: string
  costRubles: number
  calls: number
}

export interface AICostsSummary {
  totalCostRubles: number
  totalCalls: number
  totalPromptTokens: number
  totalCompletionTokens: number
  costByModel: AICostsByModel[]
  costByCallType: AICostsByCallType[]
}

export interface AICostsDaily {
  date: string
  costRubles: number
  calls: number
}

export async function fetchAICostsSummary(period: 'today' | 'week' | 'month' | 'all' = 'month'): Promise<AICostsSummary> {
  const res = await fetch(`/api/admin/ai-costs/summary?period=${period}`, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить данные о расходах AI')
  }

  return res.json()
}

export async function fetchAICostsDaily(days: number = 30): Promise<{ daily: AICostsDaily[] }> {
  const res = await fetch(`/api/admin/ai-costs/daily?days=${days}`, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к админ-панели')
    throw new Error('Не удалось загрузить данные о расходах AI')
  }

  return res.json()
}

// ==================== HELPERS ====================

export function formatProviderName(provider: string | null): string {
  if (!provider) return 'Неизвестно'
  const names: Record<string, string> = {
    yandex: 'Яндекс',
    telegram: 'Telegram',
  }
  return names[provider] || provider
}

export function formatRoleName(role: string): string {
  const names: Record<string, string> = {
    user: 'Пользователь',
    admin: 'Администратор',
  }
  return names[role] || role
}

export function formatGenerationStatus(status: string): string {
  const names: Record<string, string> = {
    pending: 'Ожидание',
    processing: 'Обработка',
    completed: 'Завершено',
    failed: 'Ошибка',
  }
  return names[status] || status
}

export function formatPaymentStatus(status: string): string {
  const names: Record<string, string> = {
    pending: 'Ожидание',
    succeeded: 'Успешно',
    failed: 'Ошибка',
    refunded: 'Возврат',
  }
  return names[status] || status
}

export function formatPaymentIntentStatus(status: string): string {
  const names: Record<string, string> = {
    created: 'Создан',
    paid: 'Оплачен',
    failed: 'Ошибка',
    expired: 'Истёк',
  }
  return names[status] || status
}

export function formatSubjectName(subject: string | null): string {
  if (!subject) return 'Неизвестно'
  const names: Record<string, string> = {
    math: 'Математика',
    russian: 'Русский язык',
  }
  return names[subject] || subject
}

export function formatDifficulty(difficulty: string | null): string {
  if (!difficulty) return 'Средний'
  const names: Record<string, string> = {
    easy: 'Лёгкий',
    medium: 'Средний',
    hard: 'Сложный',
  }
  return names[difficulty] || difficulty
}

export function formatAmount(kopecks: number): string {
  const rubles = kopecks / 100
  return rubles.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

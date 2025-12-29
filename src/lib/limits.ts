import { User } from './auth'

const GUEST_GENERATION_LIMIT = 2

export function getGenerationsLeft(user: User | null): number {
  if (user) {
    // Зарегистрированный пользователь
    return user.generationsLeft ?? 3
  }

  // Гость - читаем из localStorage
  const guestUsage = localStorage.getItem('guest_generations_used')
  const used = guestUsage ? parseInt(guestUsage, 10) : 0
  return Math.max(0, GUEST_GENERATION_LIMIT - used)
}

export function incrementGuestUsage() {
  const guestUsage = localStorage.getItem('guest_generations_used')
  const used = guestUsage ? parseInt(guestUsage, 10) : 0
  localStorage.setItem('guest_generations_used', String(used + 1))
}

export function canGenerate(user: User | null): boolean {
  return getGenerationsLeft(user) > 0
}

export function requiresAuth(user: User | null): boolean {
  // Требуется авторизация, если гость исчерпал лимит
  if (!user) {
    return getGenerationsLeft(null) <= 0
  }
  return false
}

export const GUEST_LIMIT = GUEST_GENERATION_LIMIT

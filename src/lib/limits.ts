import { User } from './auth'

export function getGenerationsLeft(user: User | null): number {
  if (!user) return 0
  return user.generationsLeft ?? 0
}

export function canGenerate(user: User | null): boolean {
  if (!user) return false
  return getGenerationsLeft(user) > 0
}

export function requiresAuth(user: User | null): boolean {
  return !user
}

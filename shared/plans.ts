/**
 * Subscription plans configuration.
 * Single source of truth for all plan limits and parameters.
 * Easily extensible — just add new fields to PlanConfig.
 */

export type SubscriptionPlanId = 'free' | 'starter' | 'teacher' | 'expert'

export interface PlanConfig {
  id: SubscriptionPlanId
  name: string
  price: number // rubles per month, 0 for free
  generationsPerPeriod: number
  isRecurring: boolean
  folders: number
  paidModel: boolean
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Бесплатный',
    price: 0,
    generationsPerPeriod: 5, // one-time, not renewable
    isRecurring: false,
    folders: 2,
    paidModel: false,
  },
  starter: {
    id: 'starter',
    name: 'Начинающий',
    price: 390,
    generationsPerPeriod: 25,
    isRecurring: true,
    folders: 10,
    paidModel: true,
  },
  teacher: {
    id: 'teacher',
    name: 'Методист',
    price: 890,
    generationsPerPeriod: 60,
    isRecurring: true,
    folders: 10,
    paidModel: true,
  },
  expert: {
    id: 'expert',
    name: 'Эксперт',
    price: 1690,
    generationsPerPeriod: 120,
    isRecurring: true,
    folders: 10,
    paidModel: true,
  },
} as const

/** All paid plan IDs */
export const PAID_PLAN_IDS = ['starter', 'teacher', 'expert'] as const
export type PaidPlanId = typeof PAID_PLAN_IDS[number]

/** Check if a plan ID is valid */
export function isValidPlanId(plan: string): plan is SubscriptionPlanId {
  return plan in SUBSCRIPTION_PLANS
}

/** Check if a plan ID is a paid plan */
export function isPaidPlan(plan: string): plan is PaidPlanId {
  return PAID_PLAN_IDS.includes(plan as PaidPlanId)
}

/** Get plan config by ID, returns free plan if invalid */
export function getPlanConfig(plan: string): PlanConfig {
  if (isValidPlanId(plan)) {
    return SUBSCRIPTION_PLANS[plan]
  }
  return SUBSCRIPTION_PLANS.free
}

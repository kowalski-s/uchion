import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'

// ==================== PRODUCT CATALOG ====================

export interface ProductInfo {
  name: string
  price: number  // in rubles
  type: 'generations' | 'subscription'
  value: number | boolean  // generations count or subscription flag
}

export const PRODUCTS: Record<string, ProductInfo> = {
  // Test product (for development only)
  'generations_5_test': {
    name: 'Тестовый пакет 5 генераций',
    price: 50,
    type: 'generations',
    value: 5,
  },
  'generations_10': {
    name: 'Пакет 10 генераций',
    price: 99,
    type: 'generations',
    value: 10,
  },
  'generations_50': {
    name: 'Пакет 50 генераций',
    price: 399,
    type: 'generations',
    value: 50,
  },
  'generations_100': {
    name: 'Пакет 100 генераций',
    price: 699,
    type: 'generations',
    value: 100,
  },
  'premium_monthly': {
    name: 'Премиум подписка (месяц)',
    price: 499,
    type: 'subscription',
    value: true,
  },
}

// Dynamic pricing configuration
export const PRICE_PER_GENERATION = 20  // rubles
export const ALLOWED_GENERATION_COUNTS = [5, 15, 30, 60, 120, 200] as const

// Discounted packages (specific counts with fixed prices)
const DISCOUNT_PACKAGES: Record<number, number> = {
  60: 990,    // base 1200, -18%
  120: 2190,  // base 2400, -9%
  200: 3790,  // base 4000, -5%
}

export function getGenerationsPrice(count: number): number {
  if (count in DISCOUNT_PACKAGES) return DISCOUNT_PACKAGES[count]
  return count * PRICE_PER_GENERATION
}

/**
 * Apply product effect to user after successful payment
 */
export async function applyProductEffect(
  userId: string,
  productCode: string
): Promise<{ success: boolean; message: string }> {
  // Check for dynamic generations product (format: generations_dynamic_N)
  const dynamicMatch = productCode.match(/^generations_dynamic_(\d+)$/)
  if (dynamicMatch) {
    const generationsCount = parseInt(dynamicMatch[1], 10)
    if (ALLOWED_GENERATION_COUNTS.includes(generationsCount as any)) {
      await db
        .update(users)
        .set({
          generationsLeft: sql`${users.generationsLeft} + ${generationsCount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))

      console.log(`[Billing] Added ${generationsCount} generations (dynamic) to user ${userId}`)
      return { success: true, message: `Added ${generationsCount} generations` }
    }
    return { success: false, message: `Invalid dynamic generations count: ${generationsCount}` }
  }

  // Fixed product lookup
  const product = PRODUCTS[productCode]

  if (!product) {
    console.warn(`[Billing] Unknown product code: ${productCode}`)
    return { success: false, message: `Unknown product code: ${productCode}` }
  }

  if (product.type === 'generations') {
    await db
      .update(users)
      .set({
        generationsLeft: sql`${users.generationsLeft} + ${product.value}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    console.log(`[Billing] Added ${product.value} generations to user ${userId}`)
    return { success: true, message: `Added ${product.value} generations` }
  }

  if (product.type === 'subscription') {
    // TODO: Implement subscription logic
    console.log(`[Billing] Granted subscription to user ${userId}`)
    return { success: true, message: 'Subscription activated' }
  }

  return { success: false, message: 'Unknown product type' }
}

/**
 * Prodamus Payment Integration
 *
 * Implements payment link generation according to official Prodamus documentation.
 * Algorithm:
 * 1. Convert all values to strings (recursively)
 * 2. Sort keys alphabetically (recursively)
 * 3. JSON.stringify with sorted keys, no spaces
 * 4. Escape forward slashes (/ → \/)
 * 5. HMAC-SHA256 signature
 * 6. Build URL with query parameters
 */

import * as crypto from 'crypto'

// ==================== TYPES ====================

export interface ProdamusProduct {
  name: string
  price: string
  quantity: string
  sku?: string
}

export interface ProdamusPaymentData {
  order_id: string
  customer_phone?: string
  customer_email?: string
  products: ProdamusProduct[]
  do: 'pay'
  urlReturn?: string
  urlSuccess?: string
  urlNotification?: string
  payment_method?: string  // AC, SBP, etc.
  customer_extra?: string
  link_expired?: string  // Format: dd.mm.yyyy hh:mm or yyyy-mm-dd hh:mm
}

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
interface JsonObject { [key: string]: JsonValue }
type JsonArray = JsonValue[]

// Type for input data (can be more permissive)
type InputObject = Record<string, unknown>

// ==================== HELPERS ====================

/**
 * Recursively converts all values in an object to strings
 * This is required by Prodamus signature algorithm
 */
function deepToString(obj: InputObject): JsonObject {
  const result: JsonObject = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = ''
    } else if (Array.isArray(value)) {
      // Convert array to object with string indices
      const arrayObj: JsonObject = {}
      for (let i = 0; i < value.length; i++) {
        const item = value[i]
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          arrayObj[String(i)] = deepToString(item as InputObject)
        } else {
          arrayObj[String(i)] = String(item ?? '')
        }
      }
      result[key] = arrayObj
    } else if (typeof value === 'object') {
      result[key] = deepToString(value as InputObject)
    } else {
      result[key] = String(value)
    }
  }

  return result
}

/**
 * Recursively sorts object keys alphabetically
 * Required for consistent signature generation
 */
function sortObjectKeys(obj: JsonObject): JsonObject {
  const sortedKeys = Object.keys(obj).sort()
  const result: JsonObject = {}

  for (const key of sortedKeys) {
    const value = obj[key]
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = sortObjectKeys(value as JsonObject)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Creates HMAC-SHA256 signature for Prodamus
 *
 * Algorithm:
 * 1. Convert all values to strings
 * 2. Sort keys alphabetically (recursive)
 * 3. JSON stringify without spaces
 * 4. Escape forward slashes
 * 5. HMAC-SHA256
 */
export function createProdamusSignature(data: Record<string, unknown>, secretKey: string): string {
  // Step 1: Convert all values to strings
  const stringData = deepToString(data)

  // Step 2: Sort keys alphabetically
  const sortedData = sortObjectKeys(stringData)

  // Step 3: JSON stringify without spaces
  // Step 4: Escape forward slashes (/ → \/)
  const jsonString = JSON.stringify(sortedData)
    .replace(/\//g, '\\/')

  // Step 5: HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(jsonString, 'utf8')
    .digest('hex')

  return signature
}

/**
 * Builds URL query string from nested object
 * Converts nested objects to bracket notation: products[0][name]=value
 */
function buildQueryString(obj: JsonObject, parentKey?: string): string {
  const parts: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = parentKey ? `${parentKey}[${key}]` : key

    if (typeof value === 'object' && value !== null) {
      parts.push(buildQueryString(value as JsonObject, fullKey))
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value ?? ''))}`)
    }
  }

  return parts.filter(Boolean).join('&')
}

/**
 * Generates a complete Prodamus payment link
 *
 * @param payformUrl - Base URL of your Prodamus payform (e.g., https://your-shop.payform.ru/)
 * @param data - Payment data
 * @param secretKey - Secret key from Prodamus dashboard
 * @returns Complete payment URL
 */
export function generatePaymentLink(
  payformUrl: string,
  data: ProdamusPaymentData,
  secretKey: string
): string {
  // Convert to plain object for signature
  const paymentData: JsonObject = {
    order_id: data.order_id,
    do: data.do,
    callbackType: 'json',  // Required by Prodamus for JSON webhook responses
  }

  // Add optional fields only if present
  if (data.customer_phone) {
    paymentData.customer_phone = data.customer_phone
  }
  if (data.customer_email) {
    paymentData.customer_email = data.customer_email
  }
  if (data.urlReturn) {
    paymentData.urlReturn = data.urlReturn
  }
  if (data.urlSuccess) {
    paymentData.urlSuccess = data.urlSuccess
  }
  if (data.urlNotification) {
    paymentData.urlNotification = data.urlNotification
  }
  if (data.payment_method) {
    paymentData.payment_method = data.payment_method
  }
  if (data.customer_extra) {
    paymentData.customer_extra = data.customer_extra
  }
  if (data.link_expired) {
    paymentData.link_expired = data.link_expired
  }

  // Add products
  paymentData.products = data.products.map(p => {
    const product: JsonObject = {
      name: p.name,
      price: p.price,
      quantity: p.quantity,
    }
    if (p.sku) {
      product.sku = p.sku
    }
    return product
  })

  // Generate signature
  const signature = createProdamusSignature(paymentData, secretKey)

  // Add signature to data
  const signedData = { ...paymentData, signature }

  // Convert to string data for URL building
  const stringData = deepToString(signedData)

  // Build query string
  const queryString = buildQueryString(stringData)

  // Ensure URL ends with / or ?
  const baseUrl = payformUrl.endsWith('/') ? payformUrl : payformUrl + '/'

  return `${baseUrl}?${queryString}`
}

/**
 * Verifies Prodamus webhook signature
 *
 * Prodamus sends signature in 'sign' field or 'X-Signature' header
 * The signature is calculated the same way as for payment links
 */
export function verifyWebhookSignature(
  payload: Record<string, unknown>,
  signature: string,
  secretKey: string
): boolean {
  if (!signature || !secretKey) {
    return false
  }

  try {
    // Remove 'sign' field from payload if present (it's not part of signed data)
    const dataWithoutSign = { ...payload }
    delete dataWithoutSign.sign

    // Calculate expected signature
    const expectedSignature = createProdamusSignature(dataWithoutSign, secretKey)

    // Timing-safe comparison
    if (signature.length !== expectedSignature.length) {
      return false
    }

    const sigBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')

    if (sigBuffer.length !== expectedBuffer.length) {
      return false
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  } catch {
    return false
  }
}

/**
 * Formats expiration date for Prodamus link_expired parameter
 * @param date - Date object
 * @returns Formatted string: yyyy-mm-dd hh:mm
 */
export function formatExpirationDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

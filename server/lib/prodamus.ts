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
  customer_fio?: string  // Customer full name (ФИО)
  products: ProdamusProduct[]
  do: 'pay'
  urlReturn?: string
  urlSuccess?: string
  urlNotification?: string
  payment_method?: string  // AC, SBP, etc.
  customer_extra?: string
  link_expired?: string  // Format: dd.mm.yyyy hh:mm or yyyy-mm-dd hh:mm
}

type JsonValue = string | JsonObject | JsonArray
interface JsonObject { [key: string]: JsonValue }
type JsonArray = JsonValue[]

// Type for input data (can be more permissive)
type InputObject = Record<string, unknown>

// ==================== HELPERS ====================

/**
 * Recursively converts all values in an object/array to strings
 * Arrays remain arrays, objects remain objects, but all primitive values become strings
 * This is required by Prodamus signature algorithm
 */
function deepToString(data: unknown): JsonValue {
  if (data === null || data === undefined) {
    return ''
  }

  if (Array.isArray(data)) {
    // Keep arrays as arrays, recursively convert items
    return data.map(item => deepToString(item))
  }

  if (typeof data === 'object') {
    // Convert object, recursively convert values
    const result: JsonObject = {}
    for (const [key, value] of Object.entries(data)) {
      result[key] = deepToString(value)
    }
    return result
  }

  // Convert primitives to strings
  return String(data)
}

/**
 * Wrapper for object input - ensures we return JsonObject
 */
function deepToStringObject(obj: InputObject): JsonObject {
  const result = deepToString(obj)
  if (typeof result === 'object' && !Array.isArray(result)) {
    return result as JsonObject
  }
  return {}
}

/**
 * Recursively sorts object keys alphabetically
 * Arrays are processed recursively but their order is preserved
 * Required for consistent signature generation
 */
function sortObjectKeys(data: JsonValue): JsonValue {
  if (Array.isArray(data)) {
    // Sort items inside array if they are objects, keep array order
    return data.map(item => sortObjectKeys(item))
  }

  if (typeof data === 'object' && data !== null) {
    const sortedKeys = Object.keys(data).sort()
    const result: JsonObject = {}

    for (const key of sortedKeys) {
      result[key] = sortObjectKeys(data[key])
    }
    return result
  }

  return data
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
  const DEBUG = process.env.PRODAMUS_DEBUG === 'true'

  if (DEBUG) {
    console.log('[Prodamus Signature] === START SIGNATURE GENERATION ===')
    console.log('[Prodamus Signature] Input data:', JSON.stringify(data, null, 2))
    console.log('[Prodamus Signature] Secret key:', secretKey ? 'configured' : 'NOT SET')
  }

  // Step 1: Convert all values to strings (arrays stay arrays!)
  const stringData = deepToStringObject(data)
  if (DEBUG) {
    console.log('[Prodamus Signature] After deepToString:', JSON.stringify(stringData, null, 2))
  }

  // Step 2: Sort keys alphabetically
  const sortedData = sortObjectKeys(stringData) as JsonObject
  if (DEBUG) {
    console.log('[Prodamus Signature] After sortObjectKeys:', JSON.stringify(sortedData, null, 2))
  }

  // Step 3: JSON stringify without spaces
  // Step 4: Escape forward slashes (/ → \/)
  const jsonString = JSON.stringify(sortedData)
    .replace(/\//g, '\\/')

  if (DEBUG) {
    console.log('[Prodamus Signature] JSON string for signing:')
    console.log(jsonString)
    console.log('[Prodamus Signature] JSON string length:', jsonString.length)
  }

  // Step 5: HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(jsonString, 'utf8')
    .digest('hex')

  if (DEBUG) {
    console.log('[Prodamus Signature] Generated signature:', signature)
    console.log('[Prodamus Signature] === END SIGNATURE GENERATION ===')
  }

  return signature
}

/**
 * Builds URL query string from nested object/array
 * Converts nested structures to bracket notation: products[0][name]=value
 */
function buildQueryString(data: JsonValue, parentKey?: string): string {
  const parts: string[] = []

  if (Array.isArray(data)) {
    // Handle arrays: products[0], products[1], etc.
    for (let i = 0; i < data.length; i++) {
      const fullKey = parentKey ? `${parentKey}[${i}]` : String(i)
      parts.push(buildQueryString(data[i], fullKey))
    }
  } else if (typeof data === 'object' && data !== null) {
    // Handle objects
    for (const [key, value] of Object.entries(data)) {
      const fullKey = parentKey ? `${parentKey}[${key}]` : key
      parts.push(buildQueryString(value, fullKey))
    }
  } else {
    // Handle primitives (strings)
    if (parentKey) {
      parts.push(`${encodeURIComponent(parentKey)}=${encodeURIComponent(String(data ?? ''))}`)
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
  if (data.customer_fio) {
    paymentData.customer_fio = data.customer_fio
  }
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
  const stringData = deepToStringObject(signedData)

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
 * Prodamus expects Moscow time (UTC+3), so we convert to Moscow timezone
 * @param date - Date object (in any timezone)
 * @returns Formatted string in Moscow time: yyyy-mm-dd hh:mm
 */
export function formatExpirationDate(date: Date): string {
  // Convert to Moscow timezone (UTC+3)
  // Intl.DateTimeFormat handles DST automatically
  const moscowFormatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = moscowFormatter.formatToParts(date)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

  const year = getPart('year')
  const month = getPart('month')
  const day = getPart('day')
  const hours = getPart('hour')
  const minutes = getPart('minute')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

import { Router } from 'express'
import type { Request, Response } from 'express'
import * as crypto from 'crypto'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { paymentIntents, webhookEvents, subscriptions, users } from '../../db/schema.js'
import { withAuth } from '../middleware/auth.js'
import {
  checkBillingCreateLinkRateLimit,
  checkBillingWebhookRateLimit,
  getClientIp,
} from '../middleware/rate-limit.js'
import {
  generatePaymentLink,
  generateSubscriptionLink,
  verifyWebhookSignature,
  formatExpirationDate,
  type ProdamusPaymentData,
} from '../lib/prodamus.js'
import {
  PRODUCTS,
  ALLOWED_GENERATION_COUNTS,
  getGenerationsPrice,
  applyProductEffect,
  type ProductInfo,
} from '../lib/billing-effects.js'
import { SUBSCRIPTION_PLANS, isPaidPlan, getPlanConfig, type PaidPlanId } from '../../shared/plans.js'
import { sendAdminAlert } from '../../api/_lib/telegram/bot.js'

const router = Router()

// ==================== CONFIGURATION ====================

const PRODAMUS_SECRET = process.env.PRODAMUS_SECRET
const PRODAMUS_PAYFORM_URL = process.env.PRODAMUS_PAYFORM_URL // e.g., https://your-shop.payform.ru/
const APP_URL = process.env.APP_URL || 'http://localhost:3000'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Startup validation
if (IS_PRODUCTION) {
  if (!PRODAMUS_SECRET) {
    console.error('[FATAL] PRODAMUS_SECRET is required in production mode')
  }
  if (!PRODAMUS_PAYFORM_URL) {
    console.error('[FATAL] PRODAMUS_PAYFORM_URL is required in production mode')
  }
}

// Prodamus subscription product IDs (from Prodamus panel)
const PRODAMUS_SUBSCRIPTION_IDS: Record<PaidPlanId, string | undefined> = {
  starter: process.env.PRODAMUS_SUBSCRIPTION_STARTER_ID,
  teacher: process.env.PRODAMUS_SUBSCRIPTION_TEACHER_ID,
  expert: process.env.PRODAMUS_SUBSCRIPTION_EXPERT_ID,
}

// ==================== TYPES ====================

interface CreateLinkPayload {
  productCode?: string
  generationsCount?: number  // Dynamic generations (5-200)
  customerEmail?: string
  customerPhone?: string
  paymentMethod?: string  // 'AC' (card), 'SBP', etc.
}

// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Russian phone regex: +7 followed by 10 digits
const PHONE_REGEX = /^\+7\d{10}$/

interface ProdamusWebhookPayload {
  order_id?: string
  order_num?: string
  payment_status?: string
  payment_status_description?: string
  payment_init?: string  // 'manual' | 'auto'
  sum?: string
  currency?: string
  date?: string
  sign?: string
  customer_phone?: string
  customer_email?: string
  customer_extra?: string
  // Subscription-specific fields (real Prodamus structure)
  subscription?: {
    id?: string
    profile_id?: string
    // Active flags are strings "0" or "1"
    active_user?: string
    active_user_date?: string
    active_manager?: string
    active_manager_date?: string
    // Payment tracking
    autopayment?: number | string  // 0 = first/manual, 1 = auto-debit (can be number or string)
    payment_num?: string
    autopayments_num?: string
    // Dates
    date_create?: string
    date_first_payment?: string
    date_last_payment?: string
    date_next_payment?: string
    date_next_payment_discount?: string
    date_completion?: string
    // Pricing
    cost?: string
    currency?: string
    name?: string
    // Limits
    limit_autopayments?: string
    first_payment_discount?: string
    next_payment_discount?: string
    next_payment_discount_num?: string
    // Meta
    demo?: string
    notification?: string
    process_started_at?: string
    [key: string]: unknown
  }
  // Pass-through params
  _param_userId?: string
  _param_plan?: string
  [key: string]: unknown
}

// ==================== HELPERS ====================

/**
 * Generate unique order ID for payment intent
 * Format: UC_{timestamp}_{random} (UC = Uchion)
 */
function generateOrderId(): string {
  const timestamp = Date.now().toString(36)
  const random = crypto.randomBytes(6).toString('hex')
  return `UC_${timestamp}_${random}`
}

/**
 * Calculate SHA-256 hash of payload for idempotency
 */
function hashPayload(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex')
}

/**
 * Try to atomically mark webhook event as processed (idempotency with race condition protection)
 * Returns true if this is the first processing, false if already processed
 *
 * Uses INSERT ... ON CONFLICT to ensure atomic check-and-insert
 */
async function tryMarkEventProcessed(
  provider: string,
  eventKey: string,
  rawPayloadHash: string
): Promise<boolean> {
  try {
    // Attempt to insert - will fail if (provider, eventKey) already exists due to unique index
    await db.insert(webhookEvents).values({
      provider,
      eventKey,
      rawPayloadHash,
    })
    return true  // Successfully inserted - first time processing
  } catch (error) {
    // Check if it's a unique constraint violation (PostgreSQL error code 23505)
    const pgError = error as { code?: string }
    if (pgError.code === '23505') {
      return false  // Already exists - duplicate
    }
    // Re-throw other errors
    throw error
  }
}

// ==================== ROUTES ====================

/**
 * GET /api/billing/subscription-plans
 *
 * Returns available subscription plans
 */
router.get('/subscription-plans', (_req, res) => {
  const plans = Object.entries(SUBSCRIPTION_PLANS).map(([id, plan]) => ({
    id,
    name: plan.name,
    price: plan.price,
    generationsPerPeriod: plan.generationsPerPeriod,
    isRecurring: plan.isRecurring,
    folders: plan.folders,
    paidModel: plan.paidModel,
  }))
  return res.json({ plans })
})

/**
 * GET /api/billing/products
 *
 * Returns available products for purchase
 */
router.get('/products', (_req, res) => {
  const products = Object.entries(PRODUCTS).map(([code, info]) => ({
    code,
    name: info.name,
    price: info.price,
    type: info.type,
  }))

  return res.json({ products })
})

/**
 * POST /api/billing/prodamus/create-link
 *
 * Creates a payment intent and returns a Prodamus payment URL
 * Requires authentication
 */
router.post('/prodamus/create-link', withAuth(async (req, res) => {
  const userId = req.user.id
  const userEmail = req.user.email
  const userName = req.user.name

  // Rate limiting
  const rateLimitResult = await checkBillingCreateLinkRateLimit(req, userId)
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    console.warn(`[Billing] Rate limit exceeded for user ${userId}`)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Слишком много запросов. Попробуйте позже.' })
  }

  try {
    const { productCode, generationsCount, customerEmail, customerPhone, paymentMethod } = req.body as CreateLinkPayload

    // Determine if this is a dynamic generations purchase or fixed product
    let product: ProductInfo | null = null
    let effectiveProductCode: string
    let isDynamicPurchase = false

    if (generationsCount !== undefined) {
      // Dynamic generations purchase
      if (typeof generationsCount !== 'number' || !Number.isInteger(generationsCount)) {
        return res.status(400).json({ error: 'Количество генераций должно быть целым числом' })
      }
      if (!ALLOWED_GENERATION_COUNTS.includes(generationsCount as any)) {
        return res.status(400).json({ error: `Допустимые количества генераций: ${ALLOWED_GENERATION_COUNTS.join(', ')}` })
      }

      isDynamicPurchase = true
      effectiveProductCode = `generations_dynamic_${generationsCount}`
      product = {
        name: `Пакет ${generationsCount} генераций`,
        price: getGenerationsPrice(generationsCount),
        type: 'generations',
        value: generationsCount,
      }
    } else if (productCode) {
      // Fixed product purchase (legacy support)
      effectiveProductCode = productCode
      product = PRODUCTS[productCode] || null
      if (!product) {
        return res.status(400).json({ error: 'Неизвестный код продукта' })
      }
    } else {
      return res.status(400).json({ error: 'Укажите количество генераций или код продукта' })
    }

    // Validate optional email format
    if (customerEmail && !EMAIL_REGEX.test(customerEmail)) {
      return res.status(400).json({ error: 'Некорректный формат email' })
    }

    // Validate optional phone format
    if (customerPhone && !PHONE_REGEX.test(customerPhone)) {
      return res.status(400).json({ error: 'Некорректный формат телефона. Ожидается: +7XXXXXXXXXX' })
    }

    // Check configuration
    if (!PRODAMUS_SECRET || !PRODAMUS_PAYFORM_URL) {
      if (IS_PRODUCTION) {
        console.error('[Billing] Missing Prodamus configuration')
        return res.status(500).json({ error: 'Платежная система не настроена' })
      }
      // Development mode - return test URL
      const testOrderId = generateOrderId()
      return res.status(201).json({
        success: true,
        orderId: testOrderId,
        paymentUrl: `${APP_URL}/api/billing/prodamus/test-payment?order_id=${testOrderId}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        testMode: true,
      })
    }

    // Generate unique order ID
    const orderId = generateOrderId()

    // Calculate expiration (1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    // Create payment intent in database BEFORE calling external API
    const [paymentIntent] = await db
      .insert(paymentIntents)
      .values({
        userId,
        productCode: effectiveProductCode,
        amount: product.price * 100,  // Store in kopecks
        currency: 'RUB',
        status: 'created',
        provider: 'prodamus',
        providerOrderId: orderId,
        metadata: JSON.stringify({
          productName: product.name,
          customerEmail: customerEmail || userEmail,
          customerPhone: customerPhone || null,
        }),
        expiresAt,
      })
      .returning()

    // Build payment data for Prodamus
    const paymentData: ProdamusPaymentData = {
      order_id: orderId,
      do: 'pay',
      products: [{
        name: product.name,
        price: String(product.price),
        quantity: '1',
        sku: effectiveProductCode,
      }],
      urlSuccess: `${APP_URL}/payment/success?order_id=${orderId}`,
      urlReturn: `${APP_URL}/payment/cancel?order_id=${orderId}`,
      link_expired: formatExpirationDate(expiresAt),
    }

    // Add customer FIO (name)
    if (userName) {
      paymentData.customer_fio = userName
    }

    // Add optional customer info
    // Don't send fake emails like "name@telegram" from Telegram auth
    const email = customerEmail || userEmail
    const isValidEmail = email && !email.endsWith('@telegram') && EMAIL_REGEX.test(email)
    if (isValidEmail) {
      paymentData.customer_email = email
    }
    if (customerPhone) {
      paymentData.customer_phone = customerPhone
    }
    if (paymentMethod) {
      paymentData.payment_method = paymentMethod
    }

    // Generate signed payment URL
    const paymentUrl = generatePaymentLink(
      PRODAMUS_PAYFORM_URL,
      paymentData,
      PRODAMUS_SECRET
    )

    console.log(`[Billing] Created payment link for order ${orderId}`)

    return res.status(201).json({
      success: true,
      paymentIntentId: paymentIntent.id,
      orderId,
      paymentUrl,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('[Billing] Create link error:', error)
    return res.status(500).json({ error: 'Не удалось создать платежную ссылку' })
  }
}))

/**
 * POST /api/billing/create-subscription-link
 *
 * Creates a Prodamus subscription payment link
 * Requires authentication, validates no active subscription exists
 */
router.post('/create-subscription-link', withAuth(async (req, res) => {
  const userId = req.user.id
  const userEmail = req.user.email
  const userName = req.user.name

  // Rate limiting (same as create-link)
  const rateLimitResult = await checkBillingCreateLinkRateLimit(req, userId)
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    console.warn(`[Subscription] Rate limit exceeded for user ${userId}`)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Слишком много запросов. Попробуйте позже.' })
  }

  try {
    const { plan } = req.body as { plan?: string }

    // Validate plan
    if (!plan || !isPaidPlan(plan)) {
      return res.status(400).json({ error: 'Укажите корректный тариф: starter, teacher или expert' })
    }

    // Check for existing active subscription
    const [existingSub] = await db
      .select({ id: subscriptions.id, status: subscriptions.status, plan: subscriptions.plan })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)

    if (existingSub && (existingSub.status === 'active' || existingSub.status === 'past_due')) {
      return res.status(409).json({
        error: 'У вас уже есть активная подписка. Сначала отмените текущую.',
        currentPlan: existingSub.plan,
      })
    }

    // Get Prodamus subscription ID
    const subscriptionId = PRODAMUS_SUBSCRIPTION_IDS[plan]

    // Check configuration
    if (!PRODAMUS_SECRET || !PRODAMUS_PAYFORM_URL) {
      if (IS_PRODUCTION) {
        console.error('[Subscription] Missing Prodamus configuration')
        return res.status(500).json({ error: 'Платежная система не настроена' })
      }
      // Development mode
      return res.status(201).json({
        success: true,
        paymentUrl: `${APP_URL}/payment/success?plan=${plan}`,
        testMode: true,
      })
    }

    if (!subscriptionId) {
      console.error(`[Subscription] Missing Prodamus subscription ID for plan: ${plan}`)
      return res.status(500).json({ error: 'Тариф не настроен в платежной системе' })
    }

    // Build subscription link with do=link (Prodamus returns short URL as plain text)
    const email = userEmail && !userEmail.endsWith('@telegram') && EMAIL_REGEX.test(userEmail) ? userEmail : undefined

    const prodamusUrl = generateSubscriptionLink(
      PRODAMUS_PAYFORM_URL,
      {
        subscription: subscriptionId,
        do: 'link',
        callbackType: 'json',
        customer_email: email,
        customer_fio: userName || undefined,
        urlSuccess: `${APP_URL}/payment/success?type=subscription&plan=${plan}`,
        urlReturn: `${APP_URL}/payment/cancel`,
        _param_userId: userId,
        _param_plan: plan,
      },
      PRODAMUS_SECRET
    )

    // Fetch the short link from Prodamus (do=link returns plain text URL)
    console.log(`[Subscription] Fetching short link from Prodamus for user ${userId}, plan: ${plan}`)
    const prodamusResponse = await fetch(prodamusUrl)

    if (!prodamusResponse.ok) {
      const errorText = await prodamusResponse.text().catch(() => '')
      console.error(`[Subscription] Prodamus returned ${prodamusResponse.status}: ${errorText}`)
      return res.status(502).json({ error: 'Не удалось получить ссылку на оплату от платежной системы' })
    }

    const paymentUrl = (await prodamusResponse.text()).trim()

    if (!paymentUrl || !paymentUrl.startsWith('http')) {
      console.error(`[Subscription] Invalid short link from Prodamus: ${paymentUrl}`)
      return res.status(502).json({ error: 'Платежная система вернула некорректную ссылку' })
    }

    console.log(`[Subscription] Got short link for user ${userId}, plan: ${plan}`)

    return res.status(201).json({
      success: true,
      paymentUrl,
    })
  } catch (error) {
    console.error('[Subscription] Create link error:', error)
    return res.status(500).json({ error: 'Не удалось создать ссылку на подписку' })
  }
}))

/**
 * POST /api/billing/prodamus/webhook  (legacy path)
 * POST /api/billing/webhook            (primary path — configured in Prodamus panel)
 *
 * Receives payment notifications from Prodamus
 * Verifies signature, checks idempotency, processes payment
 */
async function handleProdamusWebhook(req: Request, res: Response) {
  const ip = getClientIp(req)

  // Rate limiting
  const rateLimitResult = await checkBillingWebhookRateLimit(req)
  if (!rateLimitResult.success) {
    console.warn(`[Prodamus Webhook] Rate limit exceeded for IP ${ip}`)
    return res.status(429).json({ error: 'Too many requests' })
  }

  try {
    console.log(`[Prodamus Webhook] Received from IP: ${ip}`)

    // Parse payload
    let payload: ProdamusWebhookPayload
    if (typeof req.body === 'object') {
      payload = req.body
    } else {
      return res.status(400).json({ error: 'Invalid payload format' })
    }

    // Get signature from request
    // Prodamus sends Sign header in format "Sign: <hash>" — strip the prefix
    let signature = payload.sign as string || req.headers['sign'] as string || ''
    if (signature.startsWith('Sign: ')) {
      signature = signature.slice(6)
    } else if (signature.startsWith('Sign:')) {
      signature = signature.slice(5).trim()
    }

    // Verify configuration
    if (!PRODAMUS_SECRET) {
      console.error('[Prodamus Webhook] PRODAMUS_SECRET not configured - rejecting webhook')
      return res.status(500).json({ status: 'configuration_error' })
    } else {
      // Verify signature
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { sign: _sign, ...payloadWithoutSign } = payload

      if (!verifyWebhookSignature(payloadWithoutSign as Record<string, unknown>, signature, PRODAMUS_SECRET)) {
        console.warn(`[Prodamus Webhook] Invalid signature from IP: ${ip}`)
        return res.status(400).json({ error: 'Invalid signature' })
      }
    }

    // Determine if this is a subscription webhook
    const hasSubscription = payload.subscription && typeof payload.subscription === 'object'

    if (hasSubscription) {
      return await handleSubscriptionWebhook(payload, res)
    }

    // ==================== ONE-TIME PAYMENT HANDLING ====================

    // Get order_id (Prodamus may send it as order_id or order_num)
    const orderId = payload.order_id || payload.order_num
    if (!orderId) {
      console.error('[Prodamus Webhook] Missing order_id')
      return res.status(400).json({ error: 'Missing order_id' })
    }

    // Prepare idempotency data
    const paymentStatus = payload.payment_status || 'unknown'
    const eventKey = `${orderId}:${paymentStatus}`
    const rawBody = JSON.stringify(payload)
    const payloadHash = hashPayload(rawBody)

    // Atomic idempotency check - prevents race conditions
    const isFirstProcessing = await tryMarkEventProcessed('prodamus', eventKey, payloadHash)
    if (!isFirstProcessing) {
      console.log(`[Prodamus Webhook] Event already processed: ${eventKey}`)
      return res.status(200).json({ status: 'already_processed' })
    }

    // Find payment intent
    const [paymentIntent] = await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.providerOrderId, String(orderId)))
      .limit(1)

    if (!paymentIntent) {
      console.warn(`[Prodamus Webhook] Unknown order_id: ${orderId}`)
      return res.status(200).json({ status: 'unknown_order' })
    }

    // Check if already paid (additional protection)
    if (paymentIntent.status === 'paid') {
      console.log(`[Prodamus Webhook] Payment already processed: ${orderId}`)
      return res.status(200).json({ status: 'already_paid' })
    }

    // Process based on status
    // Prodamus statuses: success, fail, pending
    const isSuccess = paymentStatus === 'success'
    const isFailed = paymentStatus === 'fail' || paymentStatus === 'failed'

    if (isFailed) {
      console.log(`[Prodamus Webhook] Payment failed for order: ${orderId}`)
      await db
        .update(paymentIntents)
        .set({ status: 'failed' })
        .where(eq(paymentIntents.id, paymentIntent.id))

      return res.status(200).json({ status: 'noted' })
    }

    if (!isSuccess) {
      console.log(`[Prodamus Webhook] Non-final status for ${orderId}: ${paymentStatus}`)
      return res.status(200).json({ status: 'noted' })
    }

    // Process successful payment
    console.log(`[Prodamus Webhook] Processing successful payment for order: ${orderId}`)

    // Update payment intent
    await db
      .update(paymentIntents)
      .set({
        status: 'paid',
        paidAt: new Date(),
      })
      .where(eq(paymentIntents.id, paymentIntent.id))

    // Apply product effect
    const effectResult = await applyProductEffect(
      paymentIntent.userId,
      paymentIntent.productCode
    )

    if (!effectResult.success) {
      console.error(`[Prodamus Webhook] Failed to apply effect: ${effectResult.message}`)
    }

    console.log(`[Prodamus Webhook] Successfully processed payment for order: ${orderId}`)
    return res.status(200).json({ status: 'processed' })

  } catch (error) {
    console.error('[Prodamus Webhook] Processing error:', error)
    return res.status(500).json({ error: 'Processing failed' })
  }
}

// Register webhook on both paths (Prodamus panel uses /api/billing/webhook)
router.post('/webhook', handleProdamusWebhook)
router.post('/prodamus/webhook', handleProdamusWebhook)

// ==================== SUBSCRIPTION WEBHOOK HANDLER ====================

/**
 * Handle subscription-specific webhook from Prodamus.
 * Determines event type from subscription block fields and processes accordingly.
 */
async function handleSubscriptionWebhook(
  payload: ProdamusWebhookPayload,
  res: Response
): Promise<Response> {
  const sub = payload.subscription!
  const paymentStatus = payload.payment_status || 'unknown'
  // autopayment can be number 0/1 or string "0"/"1"
  const isAutopayment = sub.autopayment === 1 || sub.autopayment === '1'
  // Real Prodamus data uses active_user and active_manager (strings "0"/"1")
  const subscriptionActive = sub.active_user === '1' && sub.active_manager === '1'
  const subscriptionInactive = sub.active_user === '0' || sub.active_manager === '0'
  const prodamusSubId = sub.id || ''
  const prodamusProfileId = sub.profile_id || ''

  // Get userId from pass-through params
  const userId = payload._param_userId as string
  const planFromParam = payload._param_plan as string

  // Build idempotency key using subscription ID + payment_num + status
  const paymentNum = sub.payment_num || '0'
  const eventKey = `sub:${prodamusSubId}:${paymentNum}:${paymentStatus}`
  const rawBody = JSON.stringify(payload)
  const payloadHash = hashPayload(rawBody)

  const isFirstProcessing = await tryMarkEventProcessed('prodamus_subscription', eventKey, payloadHash)
  if (!isFirstProcessing) {
    console.log(`[Subscription Webhook] Already processed: ${eventKey}`)
    return res.status(200).json({ status: 'already_processed' })
  }

  console.log(`[Subscription Webhook] Event: status=${paymentStatus}, autopayment=${isAutopayment}, active_user=${sub.active_user}, active_manager=${sub.active_manager}, payment_num=${sub.payment_num}, subId=${prodamusSubId}, profileId=${prodamusProfileId}, user=${userId}`)

  // Validate userId exists
  if (!userId) {
    console.error('[Subscription Webhook] Missing _param_userId')
    return res.status(200).json({ status: 'missing_user_id' })
  }

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    console.error(`[Subscription Webhook] User not found: ${userId}`)
    return res.status(200).json({ status: 'user_not_found' })
  }

  // Determine plan from param or existing subscription
  let plan = planFromParam
  if (!plan || !isPaidPlan(plan)) {
    // Try to get from existing subscription
    const [existingSub] = await db
      .select({ plan: subscriptions.plan })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)
    plan = existingSub?.plan || 'starter'
  }

  const planConfig = getPlanConfig(plan)

  // Calculate period dates
  const now = new Date()
  const nextPaymentDate = sub.date_next_payment ? new Date(sub.date_next_payment) : null
  const periodEnd = nextPaymentDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days default

  // ==================== EVENT ROUTING ====================

  const isSuccess = paymentStatus === 'success'

  if (isSuccess && !isAutopayment) {
    // FIRST PAYMENT (user-initiated purchase)
    console.log(`[Subscription Webhook] First payment for user ${userId}, plan: ${plan}`)

    await db.transaction(async (tx) => {
      // Upsert subscription record
      const [existing] = await tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1)

      if (existing) {
        await tx
          .update(subscriptions)
          .set({
            prodamusSubscriptionId: prodamusSubId,
            prodamusProfileId: prodamusProfileId,
            plan: plan,
            status: 'active',
            generationsPerPeriod: planConfig.generationsPerPeriod,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            customerEmail: payload.customer_email || user.email,
            customerPhone: payload.customer_phone || null,
            cancelledAt: null,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, existing.id))
      } else {
        await tx
          .insert(subscriptions)
          .values({
            userId,
            prodamusSubscriptionId: prodamusSubId,
            prodamusProfileId: prodamusProfileId,
            plan: plan,
            status: 'active',
            generationsPerPeriod: planConfig.generationsPerPeriod,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            customerEmail: payload.customer_email || user.email,
            customerPhone: payload.customer_phone || null,
          })
      }

      // Update user: set plan + reset generations to plan limit
      await tx
        .update(users)
        .set({
          subscriptionPlan: plan,
          generationsLeft: planConfig.generationsPerPeriod,
          updatedAt: now,
        })
        .where(eq(users.id, userId))
    })

    // Send admin alert (non-blocking)
    sendAdminAlert({
      message: `Новая подписка: ${planConfig.name} (${planConfig.price}₽/мес)\nПользователь: ${user.email}\nГенераций: ${planConfig.generationsPerPeriod}`,
      level: 'info',
    }).catch(err => console.error('[Subscription Webhook] Alert error:', err))

    return res.status(200).json({ status: 'subscription_activated' })
  }

  if (isSuccess && isAutopayment) {
    // AUTO-RENEWAL (successful recurring payment)
    console.log(`[Subscription Webhook] Auto-renewal for user ${userId}, plan: ${plan}`)

    await db.transaction(async (tx) => {
      await tx
        .update(subscriptions)
        .set({
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        })
        .where(eq(subscriptions.userId, userId))

      // Reset generations to plan limit for new period
      await tx
        .update(users)
        .set({
          generationsLeft: planConfig.generationsPerPeriod,
          updatedAt: now,
        })
        .where(eq(users.id, userId))
    })

    sendAdminAlert({
      message: `Автопродление: ${planConfig.name}\nПользователь: ${user.email}\nГенераций начислено: ${planConfig.generationsPerPeriod}`,
      level: 'info',
    }).catch(err => console.error('[Subscription Webhook] Alert error:', err))

    return res.status(200).json({ status: 'subscription_renewed' })
  }

  if (!isSuccess && isAutopayment) {
    // FAILED AUTO-PAYMENT
    console.log(`[Subscription Webhook] Failed auto-payment for user ${userId}`)

    await db
      .update(subscriptions)
      .set({
        status: 'past_due',
        updatedAt: now,
      })
      .where(eq(subscriptions.userId, userId))

    // Do NOT reset generations — grace period while Prodamus retries

    sendAdminAlert({
      message: `Неудачное автосписание: ${planConfig.name}\nПользователь: ${user.email}\nПопытка: ${sub.current_attempt || '?'}/${sub.max_attempts || '?'}`,
      level: 'warning',
    }).catch(err => console.error('[Subscription Webhook] Alert error:', err))

    return res.status(200).json({ status: 'payment_failed_noted' })
  }

  if (subscriptionInactive) {
    // SUBSCRIPTION ENDED (final notification — deactivated or expired)
    console.log(`[Subscription Webhook] Subscription ended for user ${userId}`)

    await db.transaction(async (tx) => {
      await tx
        .update(subscriptions)
        .set({
          status: 'expired',
          updatedAt: now,
        })
        .where(eq(subscriptions.userId, userId))

      // Downgrade user to free
      await tx
        .update(users)
        .set({
          subscriptionPlan: 'free',
          generationsLeft: 0,
          updatedAt: now,
        })
        .where(eq(users.id, userId))
    })

    sendAdminAlert({
      message: `Подписка завершена: ${planConfig.name}\nПользователь: ${user.email}\nСтатус: free, 0 генераций`,
      level: 'warning',
    }).catch(err => console.error('[Subscription Webhook] Alert error:', err))

    return res.status(200).json({ status: 'subscription_expired' })
  }

  // Unknown event type — log and acknowledge
  console.warn(`[Subscription Webhook] Unhandled event: payment_status=${paymentStatus}, autopayment=${sub.autopayment}, active=${sub.active}`)
  return res.status(200).json({ status: 'noted' })
}

/**
 * POST /api/billing/cancel-subscription
 *
 * Cancels the user's active subscription.
 * Subscription remains active until currentPeriodEnd.
 * When period ends, Prodamus won't charge → webhook will downgrade to free.
 */
router.post('/cancel-subscription', withAuth(async (req, res) => {
  const userId = req.user.id

  // Rate limiting
  const rateLimitResult = await checkBillingCreateLinkRateLimit(req, userId)
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: 'Слишком много запросов. Попробуйте позже.' })
  }

  try {
    // Find active subscription
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)

    if (!sub || (sub.status !== 'active' && sub.status !== 'past_due')) {
      return res.status(404).json({ error: 'Активная подписка не найдена' })
    }

    if (sub.cancelledAt) {
      return res.status(409).json({
        error: 'Подписка уже отменена',
        cancelledAt: sub.cancelledAt.toISOString(),
        activeUntil: sub.currentPeriodEnd?.toISOString() || null,
      })
    }

    const now = new Date()

    // Try to deactivate via Prodamus API (best effort)
    let prodamusDeactivated = false
    if (PRODAMUS_SECRET && PRODAMUS_PAYFORM_URL && sub.prodamusSubscriptionId) {
      try {
        const deactivateData: Record<string, unknown> = {
          subscription: sub.prodamusSubscriptionId,
          do: 'deactivate',
        }
        const deactivateSignature = (await import('../lib/prodamus.js')).createProdamusSignature(
          deactivateData,
          PRODAMUS_SECRET
        )
        deactivateData.signature = deactivateSignature

        const baseUrl = PRODAMUS_PAYFORM_URL.endsWith('/') ? PRODAMUS_PAYFORM_URL : PRODAMUS_PAYFORM_URL + '/'
        const params = new URLSearchParams()
        for (const [key, value] of Object.entries(deactivateData)) {
          params.append(key, String(value))
        }

        const response = await fetch(`${baseUrl}?${params.toString()}`)
        prodamusDeactivated = response.ok
        console.log(`[Subscription] Prodamus deactivation response: ${response.status}`)
      } catch (err) {
        console.warn('[Subscription] Prodamus deactivation failed (will handle via period end):', err)
      }
    }

    // Mark as cancelled locally (subscription stays active until period end)
    await db
      .update(subscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id))

    // Do NOT change user's subscriptionPlan or generationsLeft yet
    // They keep access until period end

    sendAdminAlert({
      message: `Подписка отменена: ${sub.plan}\nПользователь: ${req.user.email}\nАктивна до: ${sub.currentPeriodEnd?.toISOString() || 'N/A'}\nProdamus деактивация: ${prodamusDeactivated ? 'OK' : 'не удалось'}`,
      level: 'info',
    }).catch(err => console.error('[Subscription] Alert error:', err))

    return res.status(200).json({
      success: true,
      message: 'Подписка отменена. Доступ сохраняется до конца оплаченного периода.',
      activeUntil: sub.currentPeriodEnd?.toISOString() || null,
      prodamusDeactivated,
    })
  } catch (error) {
    console.error('[Subscription] Cancel error:', error)
    return res.status(500).json({ error: 'Не удалось отменить подписку' })
  }
}))

/**
 * GET /api/billing/payment-status/:orderId
 *
 * Check payment status by order ID (for polling after redirect)
 */
router.get('/payment-status/:orderId', withAuth(async (req, res) => {
  const userId = req.user.id
  const { orderId } = req.params

  if (!orderId) {
    return res.status(400).json({ error: 'Order ID required' })
  }

  const [paymentIntent] = await db
    .select({
      id: paymentIntents.id,
      status: paymentIntents.status,
      productCode: paymentIntents.productCode,
      paidAt: paymentIntents.paidAt,
    })
    .from(paymentIntents)
    .where(and(
      eq(paymentIntents.providerOrderId, orderId),
      eq(paymentIntents.userId, userId)
    ))
    .limit(1)

  if (!paymentIntent) {
    return res.status(404).json({ error: 'Payment not found' })
  }

  const product = PRODUCTS[paymentIntent.productCode]

  return res.json({
    status: paymentIntent.status,
    productName: product?.name || paymentIntent.productCode,
    paidAt: paymentIntent.paidAt?.toISOString() || null,
  })
}))

// ==================== TEST ENDPOINT (Development only) ====================

if (process.env.NODE_ENV === 'development') {
  router.get('/prodamus/test-payment', async (req: Request, res: Response) => {
    // Only allow on localhost to prevent access on staging/shared environments
    const host = req.hostname || req.headers.host || ''
    if (host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('localhost:') && !host.startsWith('127.0.0.1:')) {
      return res.status(404).json({ error: 'Not found' })
    }

    const { order_id } = req.query

    if (!order_id || typeof order_id !== 'string') {
      return res.status(400).send('Missing order_id')
    }

    // Sanitize order_id to prevent XSS
    const safeOrderId = order_id.replace(/[<>"'&]/g, '')

    const html = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <title>Тестовый платеж</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
          h2 { color: #333; }
          .order-id { font-family: monospace; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; }
          .btn { display: inline-block; padding: 12px 24px; margin: 10px 5px; cursor: pointer; border: none; border-radius: 8px; font-size: 16px; }
          .success { background: #22c55e; color: white; }
          .success:hover { background: #16a34a; }
          .fail { background: #ef4444; color: white; }
          .fail:hover { background: #dc2626; }
          .note { color: #666; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h2>Тестовый платеж</h2>
        <p>Order ID: <span class="order-id" id="orderId"></span></p>
        <div>
          <button class="btn success" onclick="simulatePayment('success')">Оплатить</button>
          <button class="btn fail" onclick="simulatePayment('fail')">Отменить</button>
        </div>
        <p class="note">Это тестовая страница. В продакшене здесь будет форма Prodamus.</p>
        <script>
          const orderId = ${JSON.stringify(safeOrderId)};
          document.getElementById('orderId').textContent = orderId;

          async function simulatePayment(status) {
            try {
              const response = await fetch('/api/billing/prodamus/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  order_id: orderId,
                  payment_status: status,
                  sum: '99.00',
                  currency: 'RUB',
                  date: new Date().toISOString(),
                })
              });
              const result = await response.json();

              if (status === 'success') {
                alert('Платеж успешно обработан!');
                window.location.href = '/payment/success?order_id=' + orderId;
              } else {
                alert('Платеж отменен');
                window.location.href = '/payment/cancel?order_id=' + orderId;
              }
            } catch (err) {
              alert('Ошибка: ' + err.message);
            }
          }
        </script>
      </body>
      </html>
    `
    return res.type('html').send(html)
  })
}

export default router

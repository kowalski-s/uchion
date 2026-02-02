import { Router } from 'express';
import * as crypto from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, paymentIntents, webhookEvents } from '../../db/schema.js';
import { withAuth } from '../middleware/auth.js';
import { checkBillingCreateLinkRateLimit, checkBillingWebhookRateLimit, getClientIp, } from '../middleware/rate-limit.js';
import { generatePaymentLink, verifyWebhookSignature, formatExpirationDate, } from '../lib/prodamus.js';
const router = Router();
// ==================== CONFIGURATION ====================
const PRODAMUS_SECRET = process.env.PRODAMUS_SECRET;
const PRODAMUS_PAYFORM_URL = process.env.PRODAMUS_PAYFORM_URL; // e.g., https://your-shop.payform.ru/
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Startup validation
if (IS_PRODUCTION) {
    if (!PRODAMUS_SECRET) {
        console.error('[FATAL] PRODAMUS_SECRET is required in production mode');
    }
    if (!PRODAMUS_PAYFORM_URL) {
        console.error('[FATAL] PRODAMUS_PAYFORM_URL is required in production mode');
    }
}
// Dynamic pricing configuration
const PRICE_PER_GENERATION = 20; // rubles
const MIN_GENERATIONS = 5;
const MAX_GENERATIONS = 200;
// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Russian phone regex: +7 followed by 10 digits
const PHONE_REGEX = /^\+7\d{10}$/;
const PRODUCTS = {
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
};
// ==================== HELPERS ====================
/**
 * Generate unique order ID for payment intent
 * Format: UC_{timestamp}_{random} (UC = Uchion)
 */
function generateOrderId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(6).toString('hex');
    return `UC_${timestamp}_${random}`;
}
/**
 * Calculate SHA-256 hash of payload for idempotency
 */
function hashPayload(payload) {
    return crypto.createHash('sha256').update(payload).digest('hex');
}
/**
 * Try to atomically mark webhook event as processed (idempotency with race condition protection)
 * Returns true if this is the first processing, false if already processed
 *
 * Uses INSERT ... ON CONFLICT to ensure atomic check-and-insert
 */
async function tryMarkEventProcessed(provider, eventKey, rawPayloadHash) {
    try {
        // Attempt to insert - will fail if (provider, eventKey) already exists due to unique index
        await db.insert(webhookEvents).values({
            provider,
            eventKey,
            rawPayloadHash,
        });
        return true; // Successfully inserted - first time processing
    }
    catch (error) {
        // Check if it's a unique constraint violation (PostgreSQL error code 23505)
        const pgError = error;
        if (pgError.code === '23505') {
            return false; // Already exists - duplicate
        }
        // Re-throw other errors
        throw error;
    }
}
/**
 * Apply product effect to user after successful payment
 */
async function applyProductEffect(userId, productCode) {
    // Check for dynamic generations product (format: generations_dynamic_N)
    const dynamicMatch = productCode.match(/^generations_dynamic_(\d+)$/);
    if (dynamicMatch) {
        const generationsCount = parseInt(dynamicMatch[1], 10);
        if (generationsCount >= MIN_GENERATIONS && generationsCount <= MAX_GENERATIONS) {
            await db
                .update(users)
                .set({
                generationsLeft: sql `${users.generationsLeft} + ${generationsCount}`,
                updatedAt: new Date(),
            })
                .where(eq(users.id, userId));
            console.log(`[Billing] Added ${generationsCount} generations (dynamic) to user ${userId}`);
            return { success: true, message: `Added ${generationsCount} generations` };
        }
        return { success: false, message: `Invalid dynamic generations count: ${generationsCount}` };
    }
    // Fixed product lookup
    const product = PRODUCTS[productCode];
    if (!product) {
        console.warn(`[Billing] Unknown product code: ${productCode}`);
        return { success: false, message: `Unknown product code: ${productCode}` };
    }
    if (product.type === 'generations') {
        await db
            .update(users)
            .set({
            generationsLeft: sql `${users.generationsLeft} + ${product.value}`,
            updatedAt: new Date(),
        })
            .where(eq(users.id, userId));
        console.log(`[Billing] Added ${product.value} generations to user ${userId}`);
        return { success: true, message: `Added ${product.value} generations` };
    }
    if (product.type === 'subscription') {
        // TODO: Implement subscription logic
        console.log(`[Billing] Granted subscription to user ${userId}`);
        return { success: true, message: 'Subscription activated' };
    }
    return { success: false, message: 'Unknown product type' };
}
// ==================== ROUTES ====================
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
    }));
    return res.json({ products });
});
/**
 * POST /api/billing/prodamus/create-link
 *
 * Creates a payment intent and returns a Prodamus payment URL
 * Requires authentication
 */
router.post('/prodamus/create-link', withAuth(async (req, res) => {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const userName = req.user.name;
    // Rate limiting
    const rateLimitResult = await checkBillingCreateLinkRateLimit(req, userId);
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        console.warn(`[Billing] Rate limit exceeded for user ${userId}`);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Слишком много запросов. Попробуйте позже.' });
    }
    try {
        const { productCode, generationsCount, customerEmail, customerPhone, paymentMethod } = req.body;
        // Determine if this is a dynamic generations purchase or fixed product
        let product = null;
        let effectiveProductCode;
        let isDynamicPurchase = false;
        if (generationsCount !== undefined) {
            // Dynamic generations purchase
            if (typeof generationsCount !== 'number' || !Number.isInteger(generationsCount)) {
                return res.status(400).json({ error: 'Количество генераций должно быть целым числом' });
            }
            if (generationsCount < MIN_GENERATIONS || generationsCount > MAX_GENERATIONS) {
                return res.status(400).json({ error: `Количество генераций должно быть от ${MIN_GENERATIONS} до ${MAX_GENERATIONS}` });
            }
            isDynamicPurchase = true;
            effectiveProductCode = `generations_dynamic_${generationsCount}`;
            product = {
                name: `Пакет ${generationsCount} генераций`,
                price: generationsCount * PRICE_PER_GENERATION,
                type: 'generations',
                value: generationsCount,
            };
        }
        else if (productCode) {
            // Fixed product purchase (legacy support)
            effectiveProductCode = productCode;
            product = PRODUCTS[productCode] || null;
            if (!product) {
                return res.status(400).json({ error: 'Неизвестный код продукта' });
            }
        }
        else {
            return res.status(400).json({ error: 'Укажите количество генераций или код продукта' });
        }
        // Validate optional email format
        if (customerEmail && !EMAIL_REGEX.test(customerEmail)) {
            return res.status(400).json({ error: 'Некорректный формат email' });
        }
        // Validate optional phone format
        if (customerPhone && !PHONE_REGEX.test(customerPhone)) {
            return res.status(400).json({ error: 'Некорректный формат телефона. Ожидается: +7XXXXXXXXXX' });
        }
        // Check configuration
        if (!PRODAMUS_SECRET || !PRODAMUS_PAYFORM_URL) {
            if (IS_PRODUCTION) {
                console.error('[Billing] Missing Prodamus configuration');
                return res.status(500).json({ error: 'Платежная система не настроена' });
            }
            // Development mode - return test URL
            const testOrderId = generateOrderId();
            return res.status(201).json({
                success: true,
                orderId: testOrderId,
                paymentUrl: `${APP_URL}/api/billing/prodamus/test-payment?order_id=${testOrderId}`,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                testMode: true,
            });
        }
        // Generate unique order ID
        const orderId = generateOrderId();
        // Calculate expiration (1 hour)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        // Create payment intent in database BEFORE calling external API
        const [paymentIntent] = await db
            .insert(paymentIntents)
            .values({
            userId,
            productCode: effectiveProductCode,
            amount: product.price * 100, // Store in kopecks
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
            .returning();
        // Build payment data for Prodamus
        const paymentData = {
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
        };
        // Add customer FIO (name)
        if (userName) {
            paymentData.customer_fio = userName;
        }
        // Add optional customer info
        // Don't send fake emails like "name@telegram" from Telegram auth
        const email = customerEmail || userEmail;
        const isValidEmail = email && !email.endsWith('@telegram') && EMAIL_REGEX.test(email);
        if (isValidEmail) {
            paymentData.customer_email = email;
        }
        if (customerPhone) {
            paymentData.customer_phone = customerPhone;
        }
        if (paymentMethod) {
            paymentData.payment_method = paymentMethod;
        }
        // Generate signed payment URL
        const paymentUrl = generatePaymentLink(PRODAMUS_PAYFORM_URL, paymentData, PRODAMUS_SECRET);
        console.log(`[Billing] Created payment link for order ${orderId}`);
        return res.status(201).json({
            success: true,
            paymentIntentId: paymentIntent.id,
            orderId,
            paymentUrl,
            expiresAt: expiresAt.toISOString(),
        });
    }
    catch (error) {
        console.error('[Billing] Create link error:', error);
        return res.status(500).json({ error: 'Не удалось создать платежную ссылку' });
    }
}));
/**
 * POST /api/billing/prodamus/webhook
 *
 * Receives payment notifications from Prodamus
 * Verifies signature, checks idempotency, processes payment
 */
router.post('/prodamus/webhook', async (req, res) => {
    const ip = getClientIp(req);
    // Rate limiting
    const rateLimitResult = await checkBillingWebhookRateLimit(req);
    if (!rateLimitResult.success) {
        console.warn(`[Prodamus Webhook] Rate limit exceeded for IP ${ip}`);
        return res.status(429).json({ error: 'Too many requests' });
    }
    try {
        console.log(`[Prodamus Webhook] Received from IP: ${ip}`);
        // Parse payload
        let payload;
        if (typeof req.body === 'object') {
            payload = req.body;
        }
        else {
            return res.status(400).json({ error: 'Invalid payload format' });
        }
        // Get signature from request
        const signature = payload.sign || req.headers['sign'];
        // Verify configuration
        if (!PRODAMUS_SECRET) {
            console.error('[Prodamus Webhook] PRODAMUS_SECRET not configured - rejecting webhook');
            return res.status(500).json({ status: 'configuration_error' });
        }
        else {
            // Verify signature
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { sign: _sign, ...payloadWithoutSign } = payload;
            if (!verifyWebhookSignature(payloadWithoutSign, signature, PRODAMUS_SECRET)) {
                console.warn(`[Prodamus Webhook] Invalid signature from IP: ${ip}`);
                return res.status(400).json({ error: 'Invalid signature' });
            }
        }
        // Get order_id (Prodamus may send it as order_id or order_num)
        const orderId = payload.order_id || payload.order_num;
        if (!orderId) {
            console.error('[Prodamus Webhook] Missing order_id');
            return res.status(400).json({ error: 'Missing order_id' });
        }
        // Prepare idempotency data
        const paymentStatus = payload.payment_status || 'unknown';
        const eventKey = `${orderId}:${paymentStatus}`;
        const rawBody = JSON.stringify(payload);
        const payloadHash = hashPayload(rawBody);
        // Atomic idempotency check - prevents race conditions
        const isFirstProcessing = await tryMarkEventProcessed('prodamus', eventKey, payloadHash);
        if (!isFirstProcessing) {
            console.log(`[Prodamus Webhook] Event already processed: ${eventKey}`);
            return res.status(200).json({ status: 'already_processed' });
        }
        // Find payment intent
        const [paymentIntent] = await db
            .select()
            .from(paymentIntents)
            .where(eq(paymentIntents.providerOrderId, String(orderId)))
            .limit(1);
        if (!paymentIntent) {
            console.warn(`[Prodamus Webhook] Unknown order_id: ${orderId}`);
            return res.status(200).json({ status: 'unknown_order' });
        }
        // Check if already paid (additional protection)
        if (paymentIntent.status === 'paid') {
            console.log(`[Prodamus Webhook] Payment already processed: ${orderId}`);
            return res.status(200).json({ status: 'already_paid' });
        }
        // Process based on status
        // Prodamus statuses: success, fail, pending
        const isSuccess = paymentStatus === 'success';
        const isFailed = paymentStatus === 'fail' || paymentStatus === 'failed';
        if (isFailed) {
            console.log(`[Prodamus Webhook] Payment failed for order: ${orderId}`);
            await db
                .update(paymentIntents)
                .set({ status: 'failed' })
                .where(eq(paymentIntents.id, paymentIntent.id));
            return res.status(200).json({ status: 'noted' });
        }
        if (!isSuccess) {
            console.log(`[Prodamus Webhook] Non-final status for ${orderId}: ${paymentStatus}`);
            return res.status(200).json({ status: 'noted' });
        }
        // Process successful payment
        console.log(`[Prodamus Webhook] Processing successful payment for order: ${orderId}`);
        // Update payment intent
        await db
            .update(paymentIntents)
            .set({
            status: 'paid',
            paidAt: new Date(),
        })
            .where(eq(paymentIntents.id, paymentIntent.id));
        // Apply product effect
        const effectResult = await applyProductEffect(paymentIntent.userId, paymentIntent.productCode);
        if (!effectResult.success) {
            console.error(`[Prodamus Webhook] Failed to apply effect: ${effectResult.message}`);
        }
        console.log(`[Prodamus Webhook] Successfully processed payment for order: ${orderId}`);
        return res.status(200).json({ status: 'processed' });
    }
    catch (error) {
        console.error('[Prodamus Webhook] Processing error:', error);
        return res.status(500).json({ error: 'Processing failed' });
    }
});
/**
 * GET /api/billing/payment-status/:orderId
 *
 * Check payment status by order ID (for polling after redirect)
 */
router.get('/payment-status/:orderId', withAuth(async (req, res) => {
    const userId = req.user.id;
    const { orderId } = req.params;
    if (!orderId) {
        return res.status(400).json({ error: 'Order ID required' });
    }
    const [paymentIntent] = await db
        .select({
        id: paymentIntents.id,
        status: paymentIntents.status,
        productCode: paymentIntents.productCode,
        paidAt: paymentIntents.paidAt,
    })
        .from(paymentIntents)
        .where(and(eq(paymentIntents.providerOrderId, orderId), eq(paymentIntents.userId, userId)))
        .limit(1);
    if (!paymentIntent) {
        return res.status(404).json({ error: 'Payment not found' });
    }
    const product = PRODUCTS[paymentIntent.productCode];
    return res.json({
        status: paymentIntent.status,
        productName: product?.name || paymentIntent.productCode,
        paidAt: paymentIntent.paidAt?.toISOString() || null,
    });
}));
// ==================== TEST ENDPOINT (Development only) ====================
if (process.env.NODE_ENV === 'development') {
    router.get('/prodamus/test-payment', async (req, res) => {
        // Only allow on localhost to prevent access on staging/shared environments
        const host = req.hostname || req.headers.host || '';
        if (host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('localhost:') && !host.startsWith('127.0.0.1:')) {
            return res.status(404).json({ error: 'Not found' });
        }
        const { order_id } = req.query;
        if (!order_id || typeof order_id !== 'string') {
            return res.status(400).send('Missing order_id');
        }
        // Sanitize order_id to prevent XSS
        const safeOrderId = order_id.replace(/[<>"'&]/g, '');
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
    `;
        return res.type('html').send(html);
    });
}
export default router;
//# sourceMappingURL=billing.js.map
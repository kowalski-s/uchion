/**
 * Generation Alerts Module
 *
 * Tracks generation metrics and sends alerts to admins:
 * 1. High error rate (>10% failures in last hour) - critical, max 1 per 30 min
 * 2. AI not responding (3 consecutive timeouts) - critical, max 1 per 30 min
 * 3. Low quality generation (score < 8/10) - warning, every time
 */

import { sendAdminAlert } from '../telegram/bot.js'

// --- Configuration ---
const ERROR_RATE_THRESHOLD = 0.10 // 10%
const ERROR_RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const CONSECUTIVE_TIMEOUT_THRESHOLD = 3
const CRITICAL_ALERT_COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes
const LOW_QUALITY_SCORE_THRESHOLD = 8

// --- In-memory tracking ---

interface GenerationRecord {
  timestamp: number
  success: boolean
}

// Circular buffer for generation records
const generationHistory: GenerationRecord[] = []
const MAX_HISTORY_SIZE = 1000

// Consecutive timeout counter
let consecutiveTimeouts = 0

// Last alert timestamps for rate limiting
let lastErrorRateAlertTime = 0
let lastTimeoutAlertTime = 0

// --- Alert Functions ---

/**
 * Track a generation result (success or failure)
 * Triggers error rate alert if threshold exceeded
 */
export async function trackGeneration(success: boolean): Promise<void> {
  const now = Date.now()

  // Add to history
  generationHistory.push({ timestamp: now, success })

  // Limit history size
  if (generationHistory.length > MAX_HISTORY_SIZE) {
    generationHistory.shift()
  }

  // Clean old records
  cleanOldRecords()

  // Check error rate and send alert if needed
  if (!success) {
    await checkErrorRateAndAlert()
  }
}

/**
 * Track an AI API call result
 * Triggers timeout alert if 3 consecutive timeouts
 */
export async function trackAICall(options: {
  success: boolean
  isTimeout: boolean
}): Promise<void> {
  if (options.isTimeout) {
    consecutiveTimeouts++
    console.log(`[Alerts] AI timeout detected. Consecutive count: ${consecutiveTimeouts}`)

    if (consecutiveTimeouts >= CONSECUTIVE_TIMEOUT_THRESHOLD) {
      await sendTimeoutAlert()
    }
  } else if (options.success) {
    // Reset counter on successful call
    if (consecutiveTimeouts > 0) {
      console.log(`[Alerts] AI call succeeded. Resetting timeout counter.`)
    }
    consecutiveTimeouts = 0
  }
}

/**
 * Check validation score and send alert if low quality
 */
export async function checkValidationScore(params: {
  score: number
  topic: string
  subject: string
  grade: number
}): Promise<void> {
  if (params.score < LOW_QUALITY_SCORE_THRESHOLD) {
    await sendLowQualityAlert(params)
  }
}

// --- Internal Functions ---

function cleanOldRecords(): void {
  const cutoff = Date.now() - ERROR_RATE_WINDOW_MS
  while (generationHistory.length > 0 && generationHistory[0].timestamp < cutoff) {
    generationHistory.shift()
  }
}

function getErrorRate(): { total: number; failed: number; rate: number } {
  cleanOldRecords()
  const total = generationHistory.length
  const failed = generationHistory.filter((r) => !r.success).length
  const rate = total > 0 ? failed / total : 0
  return { total, failed, rate }
}

async function checkErrorRateAndAlert(): Promise<void> {
  const { total, failed, rate } = getErrorRate()

  // Need at least 5 generations to calculate meaningful rate
  if (total < 5) {
    return
  }

  if (rate > ERROR_RATE_THRESHOLD) {
    const now = Date.now()

    // Check cooldown
    if (now - lastErrorRateAlertTime < CRITICAL_ALERT_COOLDOWN_MS) {
      console.log(`[Alerts] Error rate alert suppressed (cooldown). Rate: ${(rate * 100).toFixed(1)}%`)
      return
    }

    lastErrorRateAlertTime = now
    const percent = (rate * 100).toFixed(1)

    console.log(`[Alerts] Sending high error rate alert: ${percent}%`)

    await sendAdminAlert({
      message: `Высокий процент ошибок: ${percent}% генераций упали за последний час\n\nВсего: ${total} генераций\nОшибок: ${failed}`,
      level: 'critical',
    })
  }
}

async function sendTimeoutAlert(): Promise<void> {
  const now = Date.now()

  // Check cooldown
  if (now - lastTimeoutAlertTime < CRITICAL_ALERT_COOLDOWN_MS) {
    console.log(`[Alerts] Timeout alert suppressed (cooldown). Count: ${consecutiveTimeouts}`)
    return
  }

  lastTimeoutAlertTime = now

  console.log(`[Alerts] Sending AI timeout alert: ${consecutiveTimeouts} timeouts`)

  await sendAdminAlert({
    message: `OpenAI не отвечает: ${consecutiveTimeouts} таймаутов подряд. Возможно API недоступен`,
    level: 'critical',
  })
}

async function sendLowQualityAlert(params: {
  score: number
  topic: string
  subject: string
  grade: number
}): Promise<void> {
  console.log(`[Alerts] Sending low quality alert: score ${params.score}/10`)

  await sendAdminAlert({
    message: `Низкое качество генерации\n\nТема: ${params.topic}\nПредмет: ${params.subject}\nКласс: ${params.grade}\nScore: ${params.score}/10`,
    level: 'warning',
  })
}

// --- Metrics Export (for testing/monitoring) ---

export function getAlertMetrics() {
  cleanOldRecords()
  const { total, failed, rate } = getErrorRate()

  return {
    generationHistory: {
      total,
      failed,
      rate: (rate * 100).toFixed(1) + '%',
      windowMs: ERROR_RATE_WINDOW_MS,
    },
    timeouts: {
      consecutive: consecutiveTimeouts,
      threshold: CONSECUTIVE_TIMEOUT_THRESHOLD,
    },
    cooldowns: {
      errorRateLastAlert: lastErrorRateAlertTime,
      errorRateCooldownRemaining: Math.max(0, CRITICAL_ALERT_COOLDOWN_MS - (Date.now() - lastErrorRateAlertTime)),
      timeoutLastAlert: lastTimeoutAlertTime,
      timeoutCooldownRemaining: Math.max(0, CRITICAL_ALERT_COOLDOWN_MS - (Date.now() - lastTimeoutAlertTime)),
    },
  }
}

// --- Test Helpers (for test endpoints) ---

export function simulateGenerations(count: number, failRate: number): void {
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    const success = Math.random() > failRate
    generationHistory.push({
      timestamp: now - Math.random() * ERROR_RATE_WINDOW_MS * 0.9, // Random time in last ~54 min
      success,
    })
  }
  // Limit history size
  while (generationHistory.length > MAX_HISTORY_SIZE) {
    generationHistory.shift()
  }
}

export function simulateTimeouts(count: number): void {
  consecutiveTimeouts = count
}

export function resetAlertState(): void {
  generationHistory.length = 0
  consecutiveTimeouts = 0
  lastErrorRateAlertTime = 0
  lastTimeoutAlertTime = 0
}

export function resetCooldowns(): void {
  lastErrorRateAlertTime = 0
  lastTimeoutAlertTime = 0
}

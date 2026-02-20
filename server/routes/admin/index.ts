import { Router } from 'express'
import statsRouter from './stats.js'
import usersRouter from './users.js'
import generationsRouter, { generationLogsRouter, stuckGenerationsRouter } from './generations.js'
import paymentsRouter, { paymentIntentsRouter, webhookEventsRouter, subscriptionsRouter } from './payments.js'
import alertsRouter from './alerts.js'
import settingsRouter from './settings.js'
import aiCostsRouter from './ai-costs.js'

const router = Router()

router.use('/stats', statsRouter)
router.use('/users', usersRouter)
router.use('/generations', generationsRouter)
router.use('/generation-logs', generationLogsRouter)
router.use('/stuck-generations', stuckGenerationsRouter)
router.use('/payments', paymentsRouter)
router.use('/payment-intents', paymentIntentsRouter)
router.use('/webhook-events', webhookEventsRouter)
router.use('/subscriptions', subscriptionsRouter)
router.use('/alerts', alertsRouter)
router.use('/settings', settingsRouter)
router.use('/ai-costs', aiCostsRouter)
// /test-alert is handled by alertsRouter at root level
router.use('/', alertsRouter)

export default router
